import { siegeTransitionOf } from "../abilities/siege-state";
import { activeCloak, energyView } from "../abilities/cloak-state";
import { isEmbarked, permanentCloak } from "../abilities/special-state";
import { isBurrowed } from "../abilities/burrow";
import { SCENARIOS } from "../combat/state";
import { contactSchema, MEMORY_TICKS, type Contact } from "../vision/state";
import {
  canSeeEntity,
  rememberedContacts,
  revealedBody,
} from "../vision/rules";
import {
  renderCombatEffectSchema,
  renderProjectileSchema,
  type CombatState,
} from "../combat/state";
import {
  createEconomyView,
  economyViewSchema,
  type EconomyView,
} from "./economy-view";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import {
  array,
  boolean,
  integer,
  object,
  parse,
  refine,
  reject,
  optional,
  enumeration,
  text,
  type Schema,
} from "../core/validation";
export type RenderEffect = Omit<CombatState["effects"][number], "sourceId" | "kind"> & { kind: CombatState["effects"][number]["kind"] | "hiddenAttack" };
export type RenderEntity = {
  id: number;
  owner: number;
  definitionId: string;
  x: number;
  y: number;
  health: number;
  shield?: number;
  burrowed?: boolean;
  cloaked?: boolean;
  energy?: number;
  maxEnergy?: number;
  siegeTransition?: { targetDefinitionId: string; remainingTicks: number; totalTicks: number };
  kind: "combat" | "worker" | "building";
  layer: "ground" | "air";
  radius: number;
};
export type RenderSnapshot = {
  tick: number;
  previousTick: number;
  bufferId: number;
  viewerPlayerId: number;
  widthTiles: number;
  heightTiles: number;
  entities: RenderEntity[];
  economy?: EconomyView;
  scouting?: {
    contacts: Contact[];
    exploredCells: number;
    visibleCells: number;
  };
  combat?: {
    scenario: CombatState["scenario"];
    friendlyRemaining: number;
    targetsRemaining: number;
    totalTargets: number;
    effects: RenderEffect[];
    projectiles: {
      id: number;
      owner: number;
      weaponId: "Fragmentation_Grenade" | "Phase_Disruptor";
      x: number;
      y: number;
    }[];
  };
  visibility: Uint8Array;
};
const visibilitySchema: Schema<Uint8Array> = {
  check: (input, path, issues) =>
    (input instanceof Uint8Array &&
      input.length <= 128 * 128 &&
      !input.some((v) => v > 2)) ||
    reject(issues, path, "Expected a visibility mask with values 0, 1 or 2."),
};
export const renderSnapshotSchema: Schema<RenderSnapshot> = refine(
  object({
    tick: integer(),
    previousTick: integer(),
    bufferId: integer(),
    viewerPlayerId: integer(0, 1),
    widthTiles: integer(1, 128),
    heightTiles: integer(1, 128),
    entities: array(
      object({
        id: integer(1),
        owner: integer(0, 1),
        definitionId: text,
        x: integer(),
        y: integer(),
        health: integer(),
        shield: optional(integer()),
        burrowed: optional(boolean),
        cloaked: optional(boolean),
        energy: optional(integer(0, 200)),
        maxEnergy: optional(integer(200, 200)),
        siegeTransition: optional(object({ targetDefinitionId: enumeration(["terran-siege-tank-tank-mode", "terran-siege-tank-siege-mode"]), remainingTicks: integer(1, 40), totalTicks: integer(40, 40) })),
        kind: enumeration(["combat", "worker", "building"]),
        layer: enumeration(["ground", "air"]),
        radius: integer(1, 512),
      }),
      0,
      2048,
    ),
    combat: optional(
      object({
        scenario: enumeration(SCENARIOS),
        friendlyRemaining: integer(0, 10),
        targetsRemaining: integer(0, 10),
        totalTargets: integer(0, 10),
        effects: array(renderCombatEffectSchema, 0, 128),
        projectiles: array(renderProjectileSchema, 0, 4096),
      }),
    ),
    visibility: visibilitySchema,
    economy: optional(economyViewSchema),
    scouting: optional(
      object({
        contacts: array(contactSchema, 0, 2048),
        exploredCells: integer(0, 16384),
        visibleCells: integer(0, 16384),
      }),
    ),
  }),
  (snapshot) =>
    snapshot.previousTick <= snapshot.tick &&
    snapshot.visibility.length === snapshot.widthTiles * snapshot.heightTiles &&
    (!snapshot.scouting ||
      (new Set(snapshot.scouting.contacts.map((c) => c.entityId)).size ===
        snapshot.scouting.contacts.length &&
        snapshot.scouting.contacts.every(
          (c) =>
            c.x < snapshot.widthTiles * 256 &&
            c.y < snapshot.heightTiles * 256 &&
            c.owner !== snapshot.viewerPlayerId &&
            c.seenTick <= snapshot.tick &&
            (c.kind === "building" ||
              snapshot.tick - c.seenTick < MEMORY_TICKS) &&
            !snapshot.entities.some((e) => e.id === c.entityId) &&
            revealedBody(snapshot, snapshot.visibility, c, false, 1),
        ))) &&
    (!snapshot.combat ||
      (snapshot.combat.targetsRemaining <= snapshot.combat.totalTargets &&
        new Set(snapshot.combat.projectiles.map((p) => p.id)).size ===
          snapshot.combat.projectiles.length &&
        snapshot.combat.projectiles.every(
          (p) =>
            p.x < snapshot.widthTiles * 256 &&
            p.y < snapshot.heightTiles * 256 &&
            snapshot.visibility[
              Math.floor(p.y / 256) * snapshot.widthTiles +
                Math.floor(p.x / 256)
            ] === 2,
        ) &&
        snapshot.combat.effects.every(
          (e) =>
            e.tick <= snapshot.tick &&
            e.x < snapshot.widthTiles * 256 &&
            e.y < snapshot.heightTiles * 256 &&
            e.toX < snapshot.widthTiles * 256 &&
            e.toY < snapshot.heightTiles * 256 &&
            snapshot.visibility[
              Math.floor(e.y / 256) * snapshot.widthTiles +
                Math.floor(e.x / 256)
            ] === 2 &&
            snapshot.visibility[
              Math.floor(e.toY / 256) * snapshot.widthTiles +
                Math.floor(e.toX / 256)
            ] === 2,
        ))) &&
    (!snapshot.economy ||
      ((snapshot.economy.transports ?? []).every((t) => snapshot.entities.some((e) => e.id === t.entityId && e.owner === snapshot.viewerPlayerId) &&
        t.passengers.every((p) => !snapshot.entities.some((e) => e.id === p.id)) &&
        t.loading.every((p) => snapshot.entities.some((e) => e.id === p.id && e.owner === snapshot.viewerPlayerId))) && snapshot.economy.structures.every((b) =>
        snapshot.entities.some(
          (e) =>
            e.id === b.entityId &&
            e.owner === snapshot.viewerPlayerId &&
            e.kind === "building",
        ),
      ) &&
        snapshot.economy.workers.every((w) =>
          snapshot.entities.some(
            (e) =>
              e.id === w.entityId &&
              e.owner === snapshot.viewerPlayerId &&
              e.kind === "worker",
          ),
        ) &&
        snapshot.economy.creepCells.every(
          (c) => c < snapshot.visibility.length && snapshot.visibility[c] === 2,
        ))) &&
    new Set(snapshot.entities.map((e) => e.id)).size ===
      snapshot.entities.length &&
    snapshot.entities.every((e) => {
      const x = Math.floor(e.x / 256),
        y = Math.floor(e.y / 256);
      return (
        x < snapshot.widthTiles &&
        y < snapshot.heightTiles &&
        (e.owner === snapshot.viewerPlayerId ||
          revealedBody(snapshot, snapshot.visibility, e))
      );
    }),
  "Invalid snapshot dimensions, IDs or visibility.",
);
export const validateRenderSnapshot = (input: unknown) =>
  parse(renderSnapshotSchema, input);
/** The visibility system supplies a player-specific mask. Never give the renderer hidden state. */
export function createRenderSnapshot(
  state: SimulationState,
  map: BattleMap,
  viewer: number,
  visibility: Uint8Array,
): RenderSnapshot {
  if (
    !state.players.some((p) => p.id === viewer) ||
    visibility.length !== map.widthTiles * map.heightTiles ||
    visibility.some((v) => v > 2)
  )
    throw new RangeError("Invalid viewer visibility.");
  const entities: RenderEntity[] = [];
  const s = state.entities;
  for (let i = 0; i < s.id.length; i++) {
    if (s.health[i] === 0 || isEmbarked(state, s.id[i])) continue;
    const tileX = Math.floor(s.x[i] / 256),
      tileY = Math.floor(s.y[i] / 256);
    if (
      tileX < 0 ||
      tileX >= map.widthTiles ||
      tileY < 0 ||
      tileY >= map.heightTiles
    )
      continue;
    if (
      s.owner[i] !== viewer &&
      (state.vision
        ? !canSeeEntity(state, map, viewer, i, visibility)
        : !revealedBody(map, visibility, {
            x: s.x[i],
            y: s.y[i],
            kind: s.kind[i],
            definitionId: s.definitionId[i],
          }))
    )
      continue;
    if (
      state.economy.structures.some(
        (b) => b.entityId === s.id[i] && !b.started,
      ) &&
      s.owner[i] !== viewer
    )
      continue;
    entities.push({
      ...(state.economy.enabled ? { shield: s.shield[i] } : {}),
      ...(isBurrowed(state, s.id[i]) ? { burrowed: true } : {}),
      ...(state.economy.enabled ? energyView(state, s.id[i]) : {}),
      ...(permanentCloak(s.definitionId[i]) || activeCloak(state, s.id[i]) ? { cloaked: true } : {}),
      ...(siegeTransitionOf(state, s.id[i]) ? { siegeTransition: { targetDefinitionId: siegeTransitionOf(state, s.id[i])!.targetDefinitionId, remainingTicks: siegeTransitionOf(state, s.id[i])!.remainingTicks, totalTicks: siegeTransitionOf(state, s.id[i])!.totalTicks } } : {}),
      id: s.id[i],
      owner: s.owner[i],
      definitionId: s.definitionId[i],
      x: s.x[i],
      y: s.y[i],
      health: s.health[i],
      kind: s.kind[i],
      layer: s.layer[i],
      radius: s.radius[i],
    });
  }
  const seen = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < map.widthTiles * 256 &&
    y < map.heightTiles * 256 &&
    visibility[Math.floor(y / 256) * map.widthTiles + Math.floor(x / 256)] ===
      2;
  const combat = state.combat
    ? {
        scenario: state.combat.scenario,
        friendlyRemaining: state.combat.friendlyIds.filter((id) =>
          s.id.includes(id),
        ).length,
        targetsRemaining: state.combat.targetIds.filter((id) =>
          s.id.includes(id),
        ).length,
        totalTargets: state.combat.targetIds.length,
        projectiles: state.combat.projectiles
          .filter((p) => seen(p.x, p.y))
          .map((p) => ({
            id: p.id,
            owner: p.owner,
            weaponId: p.weaponId,
            x: p.x,
            y: p.y,
          })),
        effects: state.combat.effects
          .filter((e) => seen(e.x, e.y) && seen(e.toX, e.toY))
          .map((effect): RenderEffect => {
            const { sourceId, ...e } = effect;
            const source = sourceId === undefined ? -1 : s.id.indexOf(sourceId);
            if (e.owner !== viewer && (["shot", "slash", "launch"].includes(e.kind) || (sourceId !== undefined && ["impact", "miss"].includes(e.kind))) &&
              (source < 0 || !canSeeEntity(state, map, viewer, source, visibility))) {
              const { weaponId, ...anonymous } = e;
              return { ...anonymous, kind: "hiddenAttack", toX: e.x, toY: e.y };
            }
            return e;
          }),
      }
    : undefined;
  return {
    ...(state.vision
      ? {
          scouting: {
            contacts: rememberedContacts(state, map, viewer, visibility),
            exploredCells: [...visibility].filter((v) => v > 0).length,
            visibleCells: [...visibility].filter((v) => v === 2).length,
          },
        }
      : {}),
    ...(combat ? { combat } : {}),
    ...(state.economy.enabled
      ? { economy: createEconomyView(state, map, viewer, visibility) }
      : {}),
    bufferId: 0,
    tick: state.tick,
    previousTick: Math.max(0, state.tick - 1),
    viewerPlayerId: viewer,
    widthTiles: map.widthTiles,
    heightTiles: map.heightTiles,
    entities,
    visibility: visibility.slice(),
  };
}
