import { emptyControlGroups } from "./orders";
import { cloneSimulationState } from "./clone";
import { validateGameCommand, type CommandAcknowledgement, type CommandFailureCode, type CommandKind, type GameCommand } from "./commands";
import { add } from "./fixed-point";
import { createRngStreams } from "./rng";
import { createEmptySimulationState, simulationStateSchema, type PlayerState, type SimulationState } from "./state";
import { parse } from "./validation";

export const SYSTEM_ORDER = [
  "commands", "construction", "economy", "pathfinding", "movement", "vision", "targeting",
  "combatEvents", "damage", "lifecycle", "victory", "ai", "replay", "snapshot",
] as const;
export type SystemName = (typeof SYSTEM_ORDER)[number];
export type RuleSystem = (state: SimulationState) => void;
export type CommandHandler = {
  policy: "partial" | "atomic";
  /** Must be pure; it runs before any selected entity is mutated. */
  validate: (state: SimulationState, command: GameCommand, entityId: number) => CommandFailureCode | null;
  apply: (state: SimulationState, command: GameCommand, entityIds: number[]) => void;
};
export type EngineRules = {
  commands?: Partial<Record<Exclude<CommandKind, "surrender">, CommandHandler>>;
  systems?: Partial<Record<Exclude<SystemName, "commands">, RuleSystem>>;
};
export function startSimulation(seed: number, mapId: string, dataVersion: string, players: (Omit<PlayerState, "controlGroups"> & Partial<Pick<PlayerState, "controlGroups">>)[]): SimulationState {
  const state = createEmptySimulationState(seed);
  state.players = structuredClone(players).map(p => ({ ...p, controlGroups: p.controlGroups ?? emptyControlGroups() })).sort((a, b) => a.id - b.id);
  state.map.definitionId = mapId; state.dataVersion = dataVersion;
  state.rngStreams = createRngStreams(seed);
  state.commandState.lastAcceptedSequenceByPlayer = state.players.map(() => 0);
  state.phase = "running";
  const result = parse(simulationStateSchema, state);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return state;
}
export const compareCommands = (a: GameCommand, b: GameCommand): number =>
  a.executeTick - b.executeTick || a.playerId - b.playerId || a.sequence - b.sequence;
export type QueueResult = { ok: true } | { ok: false; code: CommandFailureCode };
export function enqueueCommand(state: SimulationState, input: unknown, rules: EngineRules = {}): QueueResult {
  const parsed = validateGameCommand(input);
  if (!parsed.ok) return { ok: false, code: "invalid_command" };
  const command = parsed.value;
  if (state.phase !== "running" || command.issuedTick > state.tick || command.executeTick <= state.tick) return { ok: false, code: "invalid_state" };
  if (!state.players.some(p => p.id === command.playerId)) return { ok: false, code: "not_owner" };
  if (command.sequence <= state.commandState.lastAcceptedSequenceByPlayer[command.playerId]) return { ok: false, code: "duplicate_sequence" };
  if (command.kind !== "surrender" && !rules.commands?.[command.kind]) return { ok: false, code: "invalid_command" };
  if (state.commandState.pending.length >= 100_000) return { ok: false, code: "invalid_state" };
  state.commandState.pending.push(structuredClone(command));
  state.commandState.pending.sort(compareCommands);
  state.commandState.lastAcceptedSequenceByPlayer[command.playerId] = command.sequence;
  return { ok: true };
}
function execute(state: SimulationState, command: GameCommand, rules: EngineRules): CommandAcknowledgement {
  const failure = (code: CommandFailureCode): CommandAcknowledgement => ({ accepted: false, playerId: command.playerId, sequence: command.sequence, code });
  if (state.phase !== "running") return failure("invalid_state");
  if (command.kind === "surrender") {
    state.outcome = { kind: "surrender", winnerPlayerId: state.players.find(p => p.id !== command.playerId)!.id, decidedTick: state.tick };
    state.phase = "finished";
    state.commandState.pending = [];
    return { accepted: true, playerId: command.playerId, sequence: command.sequence, executeTick: state.tick, executedEntityIds: [] };
  }
  const handler = rules.commands?.[command.kind];
  if (!handler) return failure("invalid_command");
  const valid: number[] = [];
  let firstFailure: CommandFailureCode | null = null;
  for (const id of [...command.entityIds].sort((a, b) => a - b)) {
    const index = state.entities.id.indexOf(id);
    const error = index < 0 || state.entities.health[index] === 0 ? "invalid_target" :
      state.entities.owner[index] !== command.playerId ? "not_owner" : handler.validate(state, command, id);
    if (error) firstFailure ??= error;
    else valid.push(id);
  }
  if (!valid.length || (firstFailure && handler.policy === "atomic")) return failure(firstFailure ?? "invalid_target");
  handler.apply(state, command, valid);
  return { accepted: true, playerId: command.playerId, sequence: command.sequence, executeTick: state.tick, executedEntityIds: valid };
}
/** One deterministic 50ms step. Systems are installed by later gameplay stages. */
function runTick(state: SimulationState, rules: EngineRules = {}): CommandAcknowledgement[] {
  if (state.phase !== "running") return [];
  state.tick = add(state.tick, 1);
  const due = state.commandState.pending.filter(command => command.executeTick <= state.tick).sort(compareCommands);
  state.commandState.pending = state.commandState.pending.filter(command => command.executeTick > state.tick);
  const results = due.map(command => execute(state, command, rules));
  if (state.phase !== "running") return results;
  for (const system of SYSTEM_ORDER) {
    if (system !== "commands") rules.systems?.[system]?.(state);
    if (state.phase !== "running") break;
  }
  return results;
}

export class SimulationFault extends Error {
  constructor(readonly tick: number, readonly cause: unknown) { super(`Simulation tick ${tick} failed; restored and paused.`); this.name = "SimulationFault"; }
}
export type StepTimings = {checkpointMs:number;executionMs:number;validationMs:number};
/** No caller may observe a partly applied failed tick as running state. */
export function stepSimulation(state: SimulationState, rules: EngineRules = {}, observe?: (timings:StepTimings)=>void): CommandAcknowledgement[] {
  if (state.phase !== "running") return [];
  const start=observe?performance.now():0;
  const checkpoint = cloneSimulationState(state);
  const copied=observe?performance.now():0;
  try {
    const result = runTick(state, rules);
    const executed=observe?performance.now():0;
    const validated = parse(simulationStateSchema, state);
    if (!validated.ok) throw new TypeError(JSON.stringify(validated.issues));
    if(observe){
      const finished=performance.now();
      try{observe({checkpointMs:Math.max(0,copied-start),executionMs:Math.max(0,executed-copied),validationMs:Math.max(0,finished-executed)});}catch{}
    }
    return result;
  }
  catch (cause) {
    Object.assign(state, checkpoint);
    state.phase = "paused";
    throw new SimulationFault(checkpoint.tick + 1, cause);
  }
}
