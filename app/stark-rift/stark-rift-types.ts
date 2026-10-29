// Stark Rift 엔진 상태의 TypeScript 표면 타입. 엔진은 순수 JS이므로 화면에서 이 타입으로 읽는다.
export type StarkRiftSide = "player" | "enemy";
export type StarkRiftDifficulty = "easy" | "normal" | "hard";
export type StarkRiftFaction = "vanguard" | "brood" | "conclave";
export type StarkRiftStrategy = "balanced" | "expand" | "assault";
export type StarkRiftUnitType = "rifle" | "guard" | "tank";
export type StarkRiftTrainable = StarkRiftUnitType | "worker";
export type StarkRiftBuildingType = "hq" | "outpost" | "depot" | "barracks" | "factory" | "turret";
export type StarkRiftFormation = "line" | "wedge" | "spread";
export type StarkRiftOrder = "attack" | "move" | "scout";
export type StarkRiftSquadId = 1 | 2 | 3;

export type StarkRiftCheck = { ok: boolean; reason?: string };

export type StarkRiftUnit = {
  id: number;
  kind: "unit";
  side: StarkRiftSide;
  type: StarkRiftUnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  role: "melee" | "ranged" | "siege";
  squad: StarkRiftSquadId;
  mode: "travel" | "station";
};

export type StarkRiftBuilding = {
  id: number;
  kind: "building";
  side: StarkRiftSide;
  type: StarkRiftBuildingType;
  zone: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  progress: number;
  cost: number;
  buildTime: number;
  queue: { unit: StarkRiftTrainable; cost: number; duration: number; remaining: number }[];
};

export type StarkRiftSquad = {
  id: StarkRiftSquadId;
  order: StarkRiftOrder;
  zone: string;
  formation: StarkRiftFormation;
  engagedAt: number;
};

export type StarkRiftStats = {
  oreMined: number;
  unitsProduced: number;
  unitsLost: number;
  kills: number;
  buildingsLost: number;
  buildingsDestroyed: number;
  workersLost: number;
};

export type StarkRiftSideState = {
  id: StarkRiftSide;
  faction: StarkRiftFaction;
  strategy: StarkRiftStrategy;
  intel: {
    lastSeen: Record<string, number>;
    contacts: Record<string, {
      key: string;
      kind: "unit" | "building";
      seenAt: number;
      expiresAt: number;
      entity: {
        id: number;
        kind: "unit" | "building";
        side: StarkRiftSide;
        type: string;
        zone?: string;
        x: number;
        y: number;
        radius?: number;
        heading?: number;
      };
    }>;
  };
  ore: number;
  workers: Record<string, number>;
  transit: { from: string; to: string; eta: number; start: number }[];
  autoWorkers: boolean;
  rallySquad: StarkRiftSquadId;
  squads: Record<StarkRiftSquadId, StarkRiftSquad>;
  stats: StarkRiftStats;
};

export type StarkRiftLogEntry = { id: number; time: number; side: StarkRiftSide; text: string; tone: "info" | "good" | "warn" | "danger" | "order" };

export type StarkRiftState = {
  time: number;
  difficulty: StarkRiftDifficulty;
  status: "playing" | "over";
  winner: StarkRiftSide | "draw" | null;
  zones: Record<string, { id: string; ore: number }>;
  sides: Record<StarkRiftSide, StarkRiftSideState>;
  buildings: StarkRiftBuilding[];
  units: StarkRiftUnit[];
  log: StarkRiftLogEntry[];
};

export type StarkRiftSquadSummary = {
  id: StarkRiftSquadId;
  name: string;
  zone: string;
  zoneName: string;
  order: StarkRiftOrder;
  formation: StarkRiftFormation;
  counts: Record<StarkRiftUnitType, number>;
  size: number;
  supply: number;
  health: number;
  status: string;
};

export type StarkRiftCommand =
  | { type: "train"; buildingId: number; unit: StarkRiftTrainable }
  | { type: "cancel"; buildingId: number }
  | { type: "build"; zone: string; building: StarkRiftBuildingType }
  | { type: "order"; squad: StarkRiftSquadId; order: StarkRiftOrder; zone: string }
  | { type: "formation"; squad: StarkRiftSquadId; formation: StarkRiftFormation }
  | { type: "rally"; squad: StarkRiftSquadId }
  | { type: "transfer"; from: StarkRiftSquadId; to: StarkRiftSquadId; unitType?: StarkRiftUnitType | null }
  | { type: "workers"; from: string; to: string; count?: number }
  | { type: "autoWorkers"; enabled: boolean };
