import { createSpellsRules } from "../abilities/spells-rules";
import { spellsFitMap } from "../abilities/spells-state";
import { createLurkerRules } from "../abilities/lurker-rules";
import { lurkerFitsMap } from "../abilities/lurker-state";
import { createSiegeRules } from "../abilities/siege-rules";
import { createCloakRules } from "../abilities/cloak-rules";
import { createSpecialRules } from "../abilities/special-rules";
import { specialFitsMap } from "../abilities/special-validation";
import { createBurrowRules } from "../abilities/burrow-rules";
import {
  initializeVision,
  canSeeEntity,
  createVisionRules,
  visionFitsMap,
} from "../vision/rules";
import {
  initializeCombat,
  createCombatRules,
  combatReach,
  combatFitsMap,
} from "../combat/rules";
import { createEconomyRules } from "../economy/rules";
import { initializeEconomy, localVisibility } from "../economy/helpers";
import { economyFitsMap } from "../economy/validation";
import { checksum } from "../core/checksum";
import { profileStep, type TickSample } from "../diagnostics/profiler";
import { navigationFitsMap } from "../pathfinding/navigation";
import { createMovementRules } from "../core/movement-rules";
import { FixedTickClock } from "../core/clock";
import {
  enqueueCommand,
  startSimulation,
  stepSimulation,
  type EngineRules,
} from "../core/simulation";
import {
  createPersistenceEnvelope,
  restoreSnapshot,
  serializeSnapshot,
  type SessionState,
  type SimulationState,
} from "../core/state";
import { STARK_RIFT_ENGINE_VERSION } from "../core/versions";
import { getRuntimeMap, type BattleMap } from "../data/maps";
import { createRenderSnapshot } from "./render-snapshot";
import {
  createWorkerEnvelope,
  validateMainToWorkerMessage,
  type WorkerToMainMessage,
} from "./messages";

export type RuntimeOptions = {
  emit: (message: WorkerToMainMessage, transfer?: Transferable[]) => void;
  rules?: EngineRules;
  visibility?: (
    state: SimulationState,
    map: BattleMap,
    viewer: number,
  ) => Uint8Array;
  /** Local lab injection only; browser Worker production entry supplies neither option. */
  resolveMap?: typeof getRuntimeMap;
  observeTick?: (sample: TickSample) => void;
};
/** Transport-independent controller: identical code runs in Worker and Node integration tests. */
export class SimulationRuntime {
  private state: SimulationState | null = null;
  private map: BattleMap | null = null;
  private clock = new FixedTickClock();
  private faulted = false;
  private disposed = false;
  private viewer = 0;
  private messageId = 0;
  private bufferId = 0;
  private previousTick = 0;
  private lastPublishedTick = -1;
  private lastUiTick = -4;
  private lastUiSignature = "";
  private inFlight = new Set<number>();
  private rules: EngineRules = {};
  constructor(private options: RuntimeOptions) {}
  private send(message: WorkerToMainMessage, transfer?: Transferable[]) {
    this.options.emit(message, transfer);
  }
  private error(code: string, recoverable = true) {
    this.send(
      createWorkerEnvelope(++this.messageId, "fatalError", {
        code,
        recoverable,
        diagnosticId: null,
      }),
    );
  }
  private phase() {
    if (!this.state) return;
    this.send(
      createWorkerEnvelope(++this.messageId, "phaseChanged", {
        tick: this.state.tick,
        phase: this.state.phase,
      }),
    );
    // Pause/resume can happen without a new render tick. Controls still need the current phase.
    this.ui();
  }
  private installRules(map: BattleMap) {
    let cachedState: SimulationState | null = null,
      cachedTick = -1;
    const masks = new Map<number, Uint8Array | undefined>();
    const visible: import("../core/movement-rules").VisibilityCheck = (
      state,
      viewer,
      index,
    ) => {
      if (cachedState !== state || cachedTick !== state.tick) {
        masks.clear();
        cachedState = state;
        cachedTick = state.tick;
      }
      if (!masks.has(viewer))
        masks.set(
          viewer,
          this.options.visibility?.(state, map, viewer) ??
            (state.economy.enabled
              ? localVisibility(state, map, viewer)
              : undefined),
        );
      const mask = masks.get(viewer);
      if (mask && state.vision)
        return canSeeEntity(state, map, viewer, index, mask);
      const x = Math.floor(state.entities.x[index] / 256),
        y = Math.floor(state.entities.y[index] / 256);
      return (
        !!mask &&
        x >= 0 &&
        x < map.widthTiles &&
        y >= 0 &&
        y < map.heightTiles &&
        mask[y * map.widthTiles + x] === 2
      );
    };
    const defaults = createMovementRules(map, visible, combatReach);
    const combined = createSpellsRules(map, createSpecialRules(map, createLurkerRules(createSiegeRules(createCloakRules(createBurrowRules(map, createVisionRules(
      map,
      createCombatRules(createEconomyRules(map, defaults), visible, map),
    )))))));
    this.rules = {
      commands: { ...combined.commands, ...this.options.rules?.commands },
      systems: {
        ...combined.systems,
        pathfinding: (s) => {
          masks.clear();
          combined.systems?.pathfinding?.(s);
        },
        movement: (s) => {
          combined.systems?.movement?.(s);
          // Targeting after movement must observe the new positions, while checks within a phase share the mask.
          masks.clear();
        },
        ...this.options.rules?.systems,
      },
    };
  }
  private ui() {
    if (!this.state) return;
    const payload = {
      tick: this.state.tick,
      phase: this.state.phase,
      outcome: this.state.outcome ? { ...this.state.outcome } : null,
      lastAcceptedSequence:
        this.state.commandState.lastAcceptedSequenceByPlayer[this.viewer],
      controlGroups: structuredClone(
        this.state.players[this.viewer].controlGroups,
      ),
    };
    const signature = checksum({
      phase: payload.phase,
      outcome: payload.outcome,
      sequence: payload.lastAcceptedSequence,
      groups: payload.controlGroups,
    });
    if (
      signature === this.lastUiSignature &&
      this.state.tick - this.lastUiTick < 4
    )
      return;
    this.lastUiSignature = signature;
    this.lastUiTick = this.state.tick;
    this.send(createWorkerEnvelope(++this.messageId, "uiState", payload));
  }
  private publish() {
    if (
      !this.state ||
      !this.map ||
      this.inFlight.size >= 2 ||
      this.disposed ||
      this.lastPublishedTick === this.state.tick
    )
      return;
    // The vision provider retains explored terrain; entity visibility separately checks detection.
    const visibility =
      this.options.visibility?.(this.state, this.map, this.viewer) ??
      (this.state.economy.enabled
        ? localVisibility(this.state, this.map, this.viewer)
        : new Uint8Array(this.map.widthTiles * this.map.heightTiles));
    const snapshot = createRenderSnapshot(
      this.state,
      this.map,
      this.viewer,
      visibility,
    );
    snapshot.bufferId = ++this.bufferId;
    snapshot.previousTick = this.previousTick;
    this.previousTick = snapshot.tick;
    this.ui();
    this.inFlight.add(snapshot.bufferId);
    this.lastPublishedTick = snapshot.tick;
    this.send(
      createWorkerEnvelope(++this.messageId, "renderSnapshot", snapshot),
      [snapshot.visibility.buffer as ArrayBuffer],
    );
  }
  receive(input: unknown): void {
    if (this.disposed) return;
    const parsed = validateMainToWorkerMessage(input);
    if (!parsed.ok) {
      this.error("INVALID_MESSAGE");
      return;
    }
    const message = parsed.value;
    try {
      if (message.kind === "dispose") {
        this.disposed = true;
        this.state = null;
        this.map = null;
        this.inFlight.clear();
        this.clock.reset();
        this.send(createWorkerEnvelope(++this.messageId, "disposed", {}));
        return;
      }
      if (message.kind === "init") {
        if (this.state) {
          this.error("ALREADY_INITIALIZED");
          return;
        }
        const { map, dataVersion } = (this.options.resolveMap ?? getRuntimeMap)(
          message.payload.mapId,
        );
        if (dataVersion !== message.payload.dataVersion) {
          this.error("VERSION_MISMATCH", false);
          return;
        }
        this.viewer =
          message.payload.players.find((p) => p.controller === "human")?.id ??
          0;
        this.state = startSimulation(
          message.payload.seed,
          map.id,
          dataVersion,
          message.payload.players.map((p) => ({
            id: p.id,
            faction: p.faction,
            minerals: 50,
            gas: 0,
            supplyUsedHalf: 0,
            supplyCapHalf: 0,
          })),
        );
        if (map.id === "rift-basin") {
          initializeEconomy(this.state, map);
          initializeCombat(this.state, message.payload.scenario ?? "economy");
          initializeVision(this.state, map);
        }
        this.map = map;
        this.installRules(map);
        this.send(
          createWorkerEnvelope(++this.messageId, "ready", {
            tick: 0,
            engineVersion: STARK_RIFT_ENGINE_VERSION,
            dataVersion,
          }),
        );
        this.publish();
        return;
      }
      if (!this.state || !this.map) {
        this.error("NOT_INITIALIZED");
        return;
      }
      switch (message.kind) {
        case "commandBatch":
          for (const command of message.payload.commands) {
            if (
              command.playerId !== this.viewer ||
              command.source !== "player"
            ) {
              this.send(
                createWorkerEnvelope(++this.messageId, "commandAck", {
                  accepted: false,
                  playerId: command.playerId,
                  sequence: command.sequence,
                  code: "not_owner",
                }),
              );
              continue;
            }
            const result = enqueueCommand(
              this.state,
              {
                ...command,
                executeTick: Math.max(command.executeTick, this.state.tick + 1),
              },
              this.rules,
            );
            if (!result.ok)
              this.send(
                createWorkerEnvelope(++this.messageId, "commandAck", {
                  accepted: false,
                  playerId: command.playerId,
                  sequence: command.sequence,
                  code: result.code,
                }),
              );
          }
          break;
        case "pause":
          if (this.state.phase === "running") {
            this.state.phase = "paused";
            this.clock.reset();
            this.phase();
          }
          break;
        case "resume":
          if (this.faulted) {
            this.error("RESTORE_REQUIRED");
            break;
          }
          if (this.state.phase === "paused") {
            this.state.phase = "running";
            this.clock.reset();
            this.phase();
          }
          break;
        case "saveSnapshot": {
          if (this.faulted) {
            this.error("RESTORE_REQUIRED");
            break;
          }
          const session: SessionState = {
            camera: { centerX: 0, centerY: 0, zoomLevel: 1 },
            selection: { entityIds: [], controlGroupIds: [] },
            openPanel: null,
          };
          const snapshot = createPersistenceEnvelope(
            this.state,
            message.payload.session ?? session,
            [],
            new Date().toISOString(),
          );
          this.send(
            createWorkerEnvelope(++this.messageId, "saveSnapshotReady", {
              requestId: message.payload.requestId,
              snapshot,
            }),
          );
          break;
        }
        case "loadSnapshot": {
          const saved = restoreSnapshot(
            serializeSnapshot(message.payload.snapshot),
          );
          const registered = (this.options.resolveMap ?? getRuntimeMap)(
            saved.simulation.map.definitionId,
          );
          if (saved.dataVersion !== registered.dataVersion) {
            this.error("VERSION_MISMATCH", false);
            break;
          }
          const maxX = registered.map.widthTiles * 256,
            maxY = registered.map.heightTiles * 256;
          const inside = (point: { x: number; y: number }) =>
            point.x >= 0 && point.x < maxX && point.y >= 0 && point.y < maxY;
          if (
            !visionFitsMap(saved.simulation, registered.map) ||
            !specialFitsMap(saved.simulation, registered.map) ||
            !combatFitsMap(saved.simulation, registered.map) || !lurkerFitsMap(saved.simulation, registered.map) || !spellsFitMap(saved.simulation, registered.map) ||
            !economyFitsMap(saved.simulation, registered.map) ||
            !navigationFitsMap(saved.simulation, registered.map) ||
            saved.simulation.entities.x.some(
              (x, i) => !inside({ x, y: saved.simulation.entities.y[i] }),
            ) ||
            saved.simulation.movement.some(
              (m) =>
                (m.target !== null && !inside(m.target)) ||
                (m.trackedTarget !== null && !inside(m.trackedTarget)) ||
                m.path.some((p) => !inside(p)),
            )
          ) {
            this.error("INVALID_MAP_STATE");
            break;
          }
          if (saved.simulation.phase === "setup") {
            this.error("INVALID_STATE");
            break;
          }
          this.state = saved.simulation;
          if (this.state.economy.enabled && !this.state.combat)
            initializeCombat(this.state);
          if (this.state.economy.enabled && !this.state.vision)
            initializeVision(this.state, registered.map);
          this.map = registered.map;
          this.installRules(registered.map);
          if (this.state.phase === "running") this.state.phase = "paused";
          this.faulted = false;
          this.clock.reset();
          this.previousTick = this.state.tick;
          this.lastPublishedTick = -1;
          this.lastUiTick = -4;
          this.lastUiSignature = "";
          this.send(
            createWorkerEnvelope(++this.messageId, "snapshotLoaded", {
              tick: this.state.tick,
            }),
          );
          this.phase();
          this.publish();
          break;
        }
        case "releaseRenderBuffer":
          if (!this.inFlight.delete(message.payload.bufferId)) {
            this.error("INVALID_BUFFER");
            break;
          }
          this.publish();
          break;
        case "debugMetrics":
          this.send(
            createWorkerEnvelope(++this.messageId, "metrics", {
              tick: this.state.tick,
              windowTicks: message.payload.windowTicks,
              entityCount: this.state.entities.id.length,
              pendingCommands: this.state.commandState.pending.length,
            }),
          );
          break;
        case "replaySeek":
          this.error("REPLAY_NOT_IMPLEMENTED");
          break;
      }
    } catch {
      this.error("REQUEST_FAILED");
    }
  }
  advance(elapsedMs: number): void {
    if (
      !this.state ||
      this.state.phase !== "running" ||
      this.disposed ||
      this.faulted
    )
      return;
    try {
      this.clock.advance(elapsedMs, () => {
        if (!this.state || this.state.phase !== "running") return false;
        let results;
        if (this.options.observeTick) {
          const measured = profileStep(this.state, this.rules);
          results = measured.acknowledgements;
          // Diagnostics failing must not pause or change a valid game tick.
          try {
            this.options.observeTick(measured.sample);
          } catch {}
        } else results = stepSimulation(this.state, this.rules);
        results.forEach((result) =>
          this.send(
            createWorkerEnvelope(++this.messageId, "commandAck", result),
          ),
        );
        if (this.state.phase !== "running") this.phase();
        return true;
      });
      this.ui();
      this.publish();
    } catch {
      this.faulted = true;
      this.clock.reset();
      this.state.phase = "paused";
      this.phase();
      this.error("SIMULATION_FAULT");
    }
  }
}
