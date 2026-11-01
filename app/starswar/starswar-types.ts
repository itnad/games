// 스타즈워 엔진 상태의 TypeScript 표면 타입.
export type StwSide = "player" | "enemy";
export type StwDifficulty = "easy" | "normal" | "hard";
export type StwRaceId = "protoss" | "terran" | "zerg";
export type StwArmyType = "zealot" | "dragoon" | "templar" | "dark" | "archon" | "observer" | "reaver" | "marine" | "firebat" | "medic" | "vulture" | "tank"
  | "zergling" | "hydra" | "lurker" | "ultra";
export type StwUnitType = StwArmyType | "probe" | "scv" | "drone";
export type StwBuildingType = "nexus" | "pylon" | "gateway" | "assimilator" | "core" | "forge" | "cannon" | "citadel" | "archives" | "robo" | "bay"
  | "cc" | "depot" | "refinery" | "barracks" | "ebay" | "bunker" | "turret" | "academy" | "comsat" | "factory" | "shop"
  | "hatchery" | "hatch" | "overlord" | "extractor" | "pool" | "evo" | "sunken" | "spore" | "den" | "cavern";
export type StwProducerType = "gateway" | "robo" | "barracks" | "factory" | "hatchery" | "hatch";
export type StwBuildChoice = Exclude<StwBuildingType, "nexus"> | "expand";
export type StwResearchId = "weapons1" | "armor1" | "weapons2" | "shields1" | "range" | "charge" | "storm" | "scarab"
  | "infWeapons1" | "infArmor1" | "infWeapons2" | "stim" | "u238" | "siege" | "ion"
  | "lair" | "metabolic" | "spines" | "augments" | "lurkerAspect" | "chitin" | "zMelee1" | "zMissile1" | "zCarapace1" | "zMelee2" | "zMissile2";
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
  sieged?: boolean;
  siegeUntil?: number;
  healTargetId?: number | null;
  stimAt?: number;
  burrowed?: boolean;
  burrowUntil?: number;
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
  queue: { unit: "probe" | "scv" | "drone"; remaining: number }[];
  line: StwArmyType | null;
  current: { unit: StwArmyType; remaining: number; total: number } | null;
  research: { id: StwResearchId; remaining: number } | null;
  blocked: string | null;
  targetId: number | null;
};

export type StwEffect = { kind: "slash" | "plasma" | "photon" | "shock" | "scarab" | "warp" | "death" | "collapse" | "bullet" | "flame" | "grenade" | "tankshot" | "shell" | "stim" | "scan" | "bite" | "spine" | "spines" | "tentacle"; side: StwSide; x1: number; y1: number; x2: number; y2: number; ttl: number; max: number; radius?: number };
export type StwScan = { id: number; side: StwSide; x: number; y: number; radius: number; ttl: number };
export type StwStorm = { id: number; side: StwSide; x: number; y: number; ttl: number };
export type StwIntel = { race?: StwRaceId; time: number; buildings: Partial<Record<StwBuildingType, number>>; units: Record<StwArmyType, number>; research: { id: StwResearchId; status: string }[]; probes: number };
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
  race: StwRaceId;
  persona: "rush" | "dragoon" | "templar" | "dark" | "robo" | "bio" | "mech" | "tankbio" | "vulture" | "ling" | "hydra" | "pool" | "ultra" | null;
  sawCloakAt?: number;
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
  scans?: StwScan[];
  stalemate?: number;
  effects: StwEffect[];
  log: StwLogEntry[];
};

export type StwCommand =
  | { type: "probe" }
  | { type: "worker" }
  | { type: "build"; building: StwBuildChoice }
  | { type: "research"; research: StwResearchId }
  | { type: "line"; buildingId: number; unit: StwArmyType | null }
  | { type: "lineAll"; unit: StwArmyType | null; producer?: StwProducerType }
  | { type: "merge" }
  | { type: "rally"; point: StwRallyId }
  | { type: "attack" }
  | { type: "retreat" }
  | { type: "recall"; point: StwRallyId }
  | { type: "autoWave"; size: number }
  | { type: "scout" }
  | { type: "cancelBuild"; buildingId: number }
  | { type: "cancelProbe" }
  | { type: "cancelResearch"; research: StwResearchId }
  | { type: "cancelUnit"; buildingId: number };

export type StwView = { width: number; height: number; scale: number; zoom: number; cx: number; cy: number; ox: number; oy: number };
export type StwUi = { clock: number; timeScale: number; rally: StwRallyId };
