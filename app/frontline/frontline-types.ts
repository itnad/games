// 전선 지휘관 엔진 상태의 TypeScript 표면 타입. 엔진은 순수 JS이므로 화면에서 이 타입으로 읽는다.
export type FrontlineSide = "player" | "enemy";
export type FrontlineDifficulty = "easy" | "normal" | "hard";
export type FrontlineUnitType = "rifle" | "guard" | "tank";
export type FrontlineTrainable = FrontlineUnitType | "worker";
export type FrontlineBuildingType = "hq" | "outpost" | "depot" | "barracks" | "factory" | "turret";
export type FrontlineFormation = "line" | "wedge" | "spread";
export type FrontlineOrder = "attack" | "move";
export type FrontlineSquadId = 1 | 2 | 3;

export type FrontlineCheck = { ok: boolean; reason?: string };

export type FrontlineUnit = {
  id: number;
  kind: "unit";
  side: FrontlineSide;
  type: FrontlineUnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  squad: FrontlineSquadId;
  mode: "travel" | "station";
};

export type FrontlineBuilding = {
  id: number;
  kind: "building";
  side: FrontlineSide;
  type: FrontlineBuildingType;
  zone: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  progress: number;
  queue: { unit: FrontlineTrainable; remaining: number }[];
};

export type FrontlineSquad = {
  id: FrontlineSquadId;
  order: FrontlineOrder;
  zone: string;
  formation: FrontlineFormation;
  engagedAt: number;
};

export type FrontlineStats = {
  oreMined: number;
  unitsProduced: number;
  unitsLost: number;
  kills: number;
  buildingsLost: number;
  buildingsDestroyed: number;
  workersLost: number;
};

export type FrontlineSideState = {
  id: FrontlineSide;
  ore: number;
  workers: Record<string, number>;
  transit: { from: string; to: string; eta: number; start: number }[];
  autoWorkers: boolean;
  rallySquad: FrontlineSquadId;
  squads: Record<FrontlineSquadId, FrontlineSquad>;
  stats: FrontlineStats;
};

export type FrontlineLogEntry = { id: number; time: number; side: FrontlineSide; text: string; tone: "info" | "good" | "warn" | "danger" | "order" };

export type FrontlineState = {
  time: number;
  difficulty: FrontlineDifficulty;
  status: "playing" | "over";
  winner: FrontlineSide | "draw" | null;
  zones: Record<string, { id: string; ore: number }>;
  sides: Record<FrontlineSide, FrontlineSideState>;
  buildings: FrontlineBuilding[];
  units: FrontlineUnit[];
  log: FrontlineLogEntry[];
};

export type FrontlineSquadSummary = {
  id: FrontlineSquadId;
  name: string;
  zone: string;
  zoneName: string;
  order: FrontlineOrder;
  formation: FrontlineFormation;
  counts: Record<FrontlineUnitType, number>;
  size: number;
  supply: number;
  health: number;
  status: string;
};

export type FrontlineCommand =
  | { type: "train"; buildingId: number; unit: FrontlineTrainable }
  | { type: "cancel"; buildingId: number }
  | { type: "build"; zone: string; building: FrontlineBuildingType }
  | { type: "order"; squad: FrontlineSquadId; order: FrontlineOrder; zone: string }
  | { type: "formation"; squad: FrontlineSquadId; formation: FrontlineFormation }
  | { type: "rally"; squad: FrontlineSquadId }
  | { type: "transfer"; from: FrontlineSquadId; to: FrontlineSquadId; unitType?: FrontlineUnitType | null }
  | { type: "workers"; from: string; to: string; count?: number }
  | { type: "autoWorkers"; enabled: boolean };
