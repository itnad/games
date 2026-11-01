// 스타즈워 엔진 상태의 TypeScript 표면 타입.
export type StwSide = "player" | "enemy";
export type StwDifficulty = "easy" | "normal" | "hard";
export type StwArmyType = "zealot" | "dragoon" | "templar";
export type StwUnitType = StwArmyType | "probe";
export type StwBuildingType = "nexus" | "pylon" | "gateway" | "assimilator" | "core" | "forge" | "cannon" | "citadel" | "archives";
export type StwBuildChoice = Exclude<StwBuildingType, "nexus"> | "expand";
export type StwResearchId = "weapons1" | "armor1" | "weapons2" | "shields1" | "range" | "charge" | "storm";
export type StwRallyId = "main" | "natural" | "center" | "forward";
export type StwCheck = { ok: boolean; reason?: string };

export type StwUnit = {
  id: number;
  kind: "unit";
  side: StwSide;
  type: StwUnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  radius: number;
  heading: number;
  energy: number;
  group: "rally" | "attack" | "scout";
  targetId: number | null;
};

export type StwBuilding = {
  id: number;
  kind: "building";
  side: StwSide;
  type: StwBuildingType;
  x: number;
  y: number;
  base: "main" | "natural";
  radius: number;
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  progress: number;
  queue: { unit: "probe"; remaining: number }[];
  line: StwArmyType | null;
  current: { unit: StwArmyType; remaining: number; total: number } | null;
  research: { id: StwResearchId; remaining: number } | null;
  blocked: string | null;
  targetId: number | null;
};

export type StwEffect = { kind: "slash" | "plasma" | "photon" | "warp" | "death" | "collapse"; side: StwSide; x1: number; y1: number; x2: number; y2: number; ttl: number; max: number; radius?: number };
export type StwStorm = { id: number; side: StwSide; x: number; y: number; ttl: number };
export type StwIntel = { time: number; buildings: Partial<Record<StwBuildingType, number>>; units: Record<StwArmyType, number>; research: { id: StwResearchId; status: string }[]; probes: number };
export type StwSeen = { id: number; type: StwBuildingType; x: number; y: number; base: string; radius: number; at: number };
export type StwStats = { minerals: number; gas: number; produced: number; lost: number; kills: number; buildingsLost: number; buildingsDestroyed: number; storms: number };

export type StwSideState = {
  id: StwSide;
  minerals: number;
  gas: number;
  probes: number;
  bases: { main: { minerals: number }; natural: { minerals: number } };
  research: Partial<Record<StwResearchId, "running" | "done">>;
  rally: StwRallyId;
  autoWave: number;
  intel: StwIntel | null;
  seen: Record<string, StwSeen>;
  persona: "rush" | "dragoon" | "templar" | null;
  stats: StwStats;
};

export type StwLogEntry = { id: number; time: number; side: StwSide; text: string; tone: "info" | "good" | "warn" | "danger" | "order" };

export type StwState = {
  time: number;
  difficulty: StwDifficulty;
  status: "playing" | "over";
  winner: StwSide | "draw" | null;
  sides: Record<StwSide, StwSideState>;
  units: StwUnit[];
  buildings: StwBuilding[];
  storms: StwStorm[];
  effects: StwEffect[];
  log: StwLogEntry[];
};

export type StwCommand =
  | { type: "probe" }
  | { type: "build"; building: StwBuildChoice }
  | { type: "research"; research: StwResearchId }
  | { type: "line"; gatewayId: number; unit: StwArmyType | null }
  | { type: "lineAll"; unit: StwArmyType | null }
  | { type: "rally"; point: StwRallyId }
  | { type: "attack" }
  | { type: "retreat" }
  | { type: "recall"; point: StwRallyId }
  | { type: "autoWave"; size: number }
  | { type: "scout" }
  | { type: "cancelBuild"; buildingId: number }
  | { type: "cancelProbe" }
  | { type: "cancelResearch"; research: StwResearchId }
  | { type: "cancelUnit"; gatewayId: number };

export type StwView = { width: number; height: number; scale: number; zoom: number; cx: number; cy: number; ox: number; oy: number };
export type StwUi = { clock: number; timeScale: number; rally: StwRallyId };
