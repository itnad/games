import {
  array,
  boolean,
  integer,
  nullable,
  object,
  text,
  enumeration,
  refine,
  type Schema,
} from "../core/validation";
export type ResourceState = {
  nodeId: string;
  amount: number;
  occupiedBy: number | null;
};
export type WorkerState = {
  entityId: number;
  task:
    | "idle"
    | "toResource"
    | "harvesting"
    | "returning"
    | "toBuild"
    | "constructing";
  resourceId: string | null;
  homeId: number | null;
  buildingId: number | null;
  buildQueue: number[];
  regionId: string | null;
  cargoMinerals: number;
  cargoGas: number;
  remainingTicks: number;
  autoAllowed: boolean;
  goal: { x: number; y: number } | null;
};
export type ProductionJob = {
  id: number;
  definitionId: string;
  remainingTicks: number;
  totalTicks: number;
  minerals: number;
  gas: number;
  supplyHalf: number;
  count: number;
};
export type ResearchJob = {
  id: number;
  technologyId: string;
  level: number;
  remainingTicks: number;
  totalTicks: number;
  minerals: number;
  gas: number;
};
export type StructureState = {
  entityId: number;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  started: boolean;
  remainingTicks: number;
  totalTicks: number;
  builderId: number | null;
  workerHealth: number;
  workerShield: number;
  morphedWorker: boolean;
  addonParentId: number | null;
  geyserId: string | null;
  completedTick: number;
  seededCreep: boolean;
  rally: { x: number; y: number } | null;
  repeatUnitId: string | null;
  queue: ProductionJob[];
  research: ResearchJob | null;
  larva: number;
  larvaTicks: number;
};
export type EconomyState = {
  enabled: boolean;
  resources: ResourceState[];
  workers: WorkerState[];
  structures: StructureState[];
  upgrades: { playerId: number; technologyId: string; level: number }[];
  creepCells: number[];
  nextCreepTick: number;
};
const point = object({ x: integer(), y: integer() });
const production = refine(
  object({
    id: integer(1),
    definitionId: text,
    remainingTicks: integer(),
    totalTicks: integer(1),
    minerals: integer(),
    gas: integer(),
    supplyHalf: integer(0, 200),
    count: integer(1, 2),
  }),
  (q) => q.remainingTicks <= q.totalTicks,
  "Invalid production clock",
);
const research = refine(
  object({
    id: integer(1),
    technologyId: text,
    level: integer(1, 3),
    remainingTicks: integer(),
    totalTicks: integer(1),
    minerals: integer(),
    gas: integer(),
  }),
  (q) => q.remainingTicks <= q.totalTicks,
  "Invalid research clock",
);
export const economyStateSchema: Schema<EconomyState> = object({
  enabled: boolean,
  resources: array(
    object({
      nodeId: text,
      amount: integer(),
      occupiedBy: nullable(integer(1)),
    }),
    0,
    512,
  ),
  workers: array(
    object({
      entityId: integer(1),
      task: enumeration([
        "idle",
        "toResource",
        "harvesting",
        "returning",
        "toBuild",
        "constructing",
      ]),
      resourceId: nullable(text),
      homeId: nullable(integer(1)),
      buildingId: nullable(integer(1)),
      buildQueue: array(integer(1), 0, 16),
      regionId: nullable(text),
      cargoMinerals: integer(0, 8),
      cargoGas: integer(0, 8),
      remainingTicks: integer(),
      autoAllowed: boolean,
      goal: nullable(point),
    }),
    0,
    2048,
  ),
  structures: array(
    refine(
      object({
        entityId: integer(1),
        tileX: integer(),
        tileY: integer(),
        width: integer(1, 8),
        height: integer(1, 8),
        started: boolean,
        remainingTicks: integer(),
        totalTicks: integer(1),
        builderId: nullable(integer(1)),
        workerHealth: integer(),
        workerShield: integer(),
        morphedWorker: boolean,
        addonParentId: nullable(integer(1)),
        geyserId: nullable(text),
        completedTick: integer(-1),
        seededCreep: boolean,
        rally: nullable(point),
        repeatUnitId: nullable(text),
        queue: array(production, 0, 5),
        research: nullable(research),
        larva: integer(0, 3),
        larvaTicks: integer(),
      }),
      (b) => b.remainingTicks <= b.totalTicks,
      "Invalid construction clock",
    ),
    0,
    2048,
  ),
  upgrades: array(
    object({
      playerId: integer(0, 1),
      technologyId: text,
      level: integer(1, 3),
    }),
    0,
    128,
  ),
  creepCells: refine(
    array(integer(0, 16383), 0, 16384),
    (a) => a.every((v, i) => i === 0 || v > a[i - 1]),
    "Creep cells must be sorted and unique",
  ),
  nextCreepTick: integer(),
});
export const emptyEconomy = (): EconomyState => ({
  enabled: false,
  resources: [],
  workers: [],
  structures: [],
  upgrades: [],
  creepCells: [],
  nextCreepTick: 0,
});
export const idleWorker = (entityId: number): WorkerState => ({
  entityId,
  task: "idle",
  resourceId: null,
  homeId: null,
  buildingId: null,
  buildQueue: [],
  regionId: null,
  cargoMinerals: 0,
  cargoGas: 0,
  remainingTicks: 0,
  autoAllowed: true,
  goal: null,
});
