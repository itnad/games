// 관문 전쟁 엔진 상태의 TypeScript 표면 타입.
export type GwSide = "player" | "enemy";
export type GwDifficulty = "easy" | "normal" | "hard";
export type GwArmyType = "zealot" | "dragoon" | "templar";
export type GwUnitType = GwArmyType | "probe";
export type GwBuildingType = "nexus" | "pylon" | "gateway" | "assimilator" | "core" | "forge" | "cannon" | "citadel" | "archives";
export type GwBuildChoice = Exclude<GwBuildingType, "nexus"> | "expand";
export type GwResearchId = "weapons1" | "armor1" | "weapons2" | "shields1" | "range" | "charge" | "storm";
export type GwRallyId = "main" | "natural" | "center" | "forward";
export type GwCheck = { ok: boolean; reason?: string };

export type GwUnit = {
  id: number;
  kind: "unit";
  side: GwSide;
  type: GwUnitType;
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

export type GwBuilding = {
  id: number;
  kind: "building";
  side: GwSide;
  type: GwBuildingType;
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
  line: GwArmyType | null;
  current: { unit: GwArmyType; remaining: number; total: number } | null;
  research: { id: GwResearchId; remaining: number } | null;
  blocked: string | null;
  targetId: number | null;
};

export type GwEffect = { kind: "slash" | "plasma" | "photon" | "warp" | "death" | "collapse"; side: GwSide; x1: number; y1: number; x2: number; y2: number; ttl: number; max: number; radius?: number };
export type GwStorm = { id: number; side: GwSide; x: number; y: number; ttl: number };
export type GwIntel = { time: number; buildings: Partial<Record<GwBuildingType, number>>; units: Record<GwArmyType, number>; research: { id: GwResearchId; status: string }[]; probes: number };
export type GwSeen = { id: number; type: GwBuildingType; x: number; y: number; base: string; radius: number; at: number };
export type GwStats = { minerals: number; gas: number; produced: number; lost: number; kills: number; buildingsLost: number; buildingsDestroyed: number; storms: number };

export type GwSideState = {
  id: GwSide;
  minerals: number;
  gas: number;
  probes: number;
  bases: { main: { minerals: number }; natural: { minerals: number } };
  research: Partial<Record<GwResearchId, "running" | "done">>;
  rally: GwRallyId;
  autoWave: number;
  intel: GwIntel | null;
  seen: Record<string, GwSeen>;
  persona: "rush" | "dragoon" | "templar" | null;
  stats: GwStats;
};

export type GwLogEntry = { id: number; time: number; side: GwSide; text: string; tone: "info" | "good" | "warn" | "danger" | "order" };

export type GwState = {
  time: number;
  difficulty: GwDifficulty;
  status: "playing" | "over";
  winner: GwSide | "draw" | null;
  sides: Record<GwSide, GwSideState>;
  units: GwUnit[];
  buildings: GwBuilding[];
  storms: GwStorm[];
  effects: GwEffect[];
  log: GwLogEntry[];
};

export type GwCommand =
  | { type: "probe" }
  | { type: "build"; building: GwBuildChoice }
  | { type: "research"; research: GwResearchId }
  | { type: "line"; gatewayId: number; unit: GwArmyType | null }
  | { type: "lineAll"; unit: GwArmyType | null }
  | { type: "rally"; point: GwRallyId }
  | { type: "attack" }
  | { type: "retreat" }
  | { type: "autoWave"; size: number }
  | { type: "scout" };

export type GwView = { width: number; height: number; scale: number; zoom: number; cx: number; cy: number; ox: number; oy: number };
export type GwUi = { clock: number; timeScale: number; rally: GwRallyId };
