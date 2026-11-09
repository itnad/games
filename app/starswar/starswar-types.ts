// 스타즈워 엔진 상태의 TypeScript 표면 타입.
export type StwSide = "player" | "enemy";
export type StwDifficulty = "easy" | "normal" | "hard";
export type StwRaceId = "protoss" | "terran" | "zerg";
export type StwArmyType = "zealot" | "dragoon" | "templar" | "dark" | "archon" | "darkArchon" | "observer" | "shuttle" | "reaver" | "scout" | "corsair" | "carrier" | "arbiter"
  | "marine" | "firebat" | "medic" | "ghost" | "vulture" | "tank" | "goliath" | "wraith" | "dropship" | "vessel" | "valkyrie" | "battlecruiser"
  | "zergling" | "hydra" | "lurker" | "ultra" | "overlord" | "mutalisk" | "scourge" | "guardian" | "devourer" | "queen" | "defiler" | "infested" | "broodling";
export type StwUnitType = StwArmyType | "probe" | "scv" | "drone";
export type StwBuildingType = "nexus" | "pylon" | "gateway" | "assimilator" | "core" | "forge" | "cannon" | "citadel" | "archives" | "robo" | "bay" | "stargate" | "beacon" | "tribunal"
  | "cc" | "depot" | "refinery" | "barracks" | "ebay" | "bunker" | "turret" | "academy" | "comsat" | "factory" | "shop" | "armory" | "starport" | "science"
  | "hatchery" | "hatch" | "overlord" | "extractor" | "pool" | "evo" | "sunken" | "spore" | "den" | "spire" | "nest" | "mound" | "cavern";
export type StwProducerType = "gateway" | "robo" | "stargate" | "barracks" | "factory" | "starport" | "hatchery" | "hatch";
export type StwBuildChoice = Exclude<StwBuildingType, "nexus"> | "expand";
export type StwResearchId = "weapons1" | "armor1" | "weapons2" | "shields1" | "range" | "charge" | "storm" | "scarab" | "carrierCapacity" | "stasis" | "maelstrom"
  | "irradiate" | "emp" | "yamato" | "lockdown" | "personnelCloak" | "hive" | "ventral" | "greaterSpire" | "ensnare" | "broodling" | "plague"
  | "infWeapons1" | "infArmor1" | "infWeapons2" | "stim" | "u238" | "siege" | "ion" | "wraithCloak"
  | "lair" | "metabolic" | "adrenal" | "spines" | "augments" | "lurkerAspect" | "pneumatized" | "chitin" | "zMelee1" | "zMissile1" | "zCarapace1" | "zMelee2" | "zMissile2";
export type StwRallyId = "main" | "natural" | "center" | "forward";
export type StwCheck = { ok: boolean; reason?: string };

export type StwFocus = "fight" | "buildings";

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
  group: "rally" | "attack" | "scout" | "drop" | "cargo" | "board";
  targetId: number | null;
  sieged?: boolean;
  siegeUntil?: number;
  healTargetId?: number | null;
  stimAt?: number;
  burrowed?: boolean;
  burrowUntil?: number;
  stunUntil?: number;
  stasisUntil?: number;
  ensnareUntil?: number;
  plagueUntil?: number;
  irradiateUntil?: number;
  matrix?: { hp: number; until: number };
  acid?: { stacks: number; until: number };
  cargo?: number[];
  bornAt?: number;
  escort?: boolean;
  op?: number;
  raid?: number;
  bomb?: StwDropTarget;
  scoutPhase?: "out" | "back" | null;
  scoutMode?: "resources";
  scoutPath?: { x: number; y: number }[];
  hitBy?: number;
  hitAt?: number;
  threatScanAt?: number;
  approach?: { id: number; x: number; y: number; at: number };
  blocked?: { id: number; until: number };
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

export type StwEffect = { kind: "slash" | "plasma" | "photon" | "shock" | "scarab" | "warp" | "death" | "collapse" | "bullet" | "flame" | "grenade" | "tankshot" | "shell" | "stim" | "scan" | "bite" | "spine" | "spines" | "tentacle" | "laser" | "neutron" | "glaive" | "flak" | "sporeShot" | "burst"
    | "interceptor" | "yamato" | "spell"; side: StwSide; x1: number; y1: number; x2: number; y2: number; ttl: number; max: number; radius?: number; attackerId?: number; targetId?: number; spell?: string };
export type StwScan = { id: number; side: StwSide; x: number; y: number; radius: number; ttl: number };
export type StwStorm = { id: number; side: StwSide; x: number; y: number; ttl: number };
/** 땅에 남는 마법 구역(다크 스웜). */
export type StwZone = { id: number; kind: "swarm"; side: StwSide; x: number; y: number; radius: number; ttl: number; max: number };
export type StwIntel = { race?: StwRaceId; time: number; buildings: Partial<Record<StwBuildingType, number>>; units: Record<StwArmyType, number>; research: { id: StwResearchId; status: string }[]; probes: number };
export type StwSeen = { id: number; type: StwBuildingType; x: number; y: number; base: string; radius: number; at: number };
export type StwStats = { minerals: number; gas: number; produced: number; lost: number; kills: number; buildingsLost: number; buildingsDestroyed: number; storms: number; overkill: number; workersLost?: number; workersKilled?: number; valueLost?: number; supplyPeak?: number; spells?: number };
export type StwDropMission = "raid" | "bomb";
export type StwDropTarget = "main" | "natural" | "tech" | "alternate" | "production";
export type StwDropPlan = { mission: StwDropMission; target: StwDropTarget; repeat: boolean; sync: boolean };
/** 진행 중인 수송 작전. */
export type StwOp = { id: number; side: StwSide; kind: StwDropMission; target: StwDropTarget; base: "main" | "natural"; transports: number[]; riders: number[]; phase: "out" | "fight" | "pickup" | "home" | "gather" | "in"; since: number; sync: boolean; repeat: boolean; value: number };

export type StwSideState = {
  id: StwSide;
  minerals: number;
  gas: number;
  probes: number;
  bases: { main: { minerals: number }; natural: { minerals: number } };
  research: Partial<Record<StwResearchId, "running" | "done">>;
  /** 집결지: 이름표(AI) 또는 아군 기준 세로 위치(플레이어가 지도를 눌러 고름). */
  rally: StwRallyId | number;
  autoWave: number;
  /** 후퇴 명령으로 자동 출격이 잠시 멈췄는지(출격·전진·자동 출격 재선택으로 풀린다). */
  autoWaveHold?: boolean;
  intel: StwIntel | null;
  seen: Record<string, StwSeen>;
  race: StwRaceId;
  escort: boolean;
  /** 공격 목표: 교전 우선(기본) 또는 건물 우선. */
  focus?: StwFocus;
  persona: "rush" | "dragoon" | "templar" | "dark" | "robo" | "bio" | "mech" | "tankbio" | "vulture" | "ling" | "hydra" | "pool" | "ultra" | null;
  sawCloakAt?: number;
  sawAirAt?: number;
  sawTransportAt?: number;
  droppedAt?: number;
  dropPlan?: StwDropPlan;
  raidRelaunchAt?: number;
  stats: StwStats;
  /** AI의 기억(전략 전환 기록 등). 플레이어 쪽은 null. */
  ai?: { switched?: { from: string; to: string; at: number } } | null;
};

export type StwLogEntry = { id: number; time: number; side: StwSide; text: string; tone: "info" | "good" | "warn" | "danger" | "order" };

/** 경기 기록 한 점(10초마다): 양쪽 인구, 병력 가치(광물 + 가스, 일꾼 제외), 일꾼 수. */
export type StwHistoryPoint = { t: number } & Record<StwSide, { supply: number; army: number; workers: number }>;

export type StwState = {
  time: number;
  history?: StwHistoryPoint[];
  hiddenEnemyRace?: boolean;
  difficulty: StwDifficulty;
  status: "playing" | "over";
  winner: StwSide | "draw" | null;
  sides: Record<StwSide, StwSideState>;
  units: StwUnit[];
  buildings: StwBuilding[];
  storms: StwStorm[];
  zones?: StwZone[];
  ops?: StwOp[];
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
  | { type: "darkMerge" }
  | { type: "drop"; mission?: StwDropMission; target?: StwDropTarget; repeat?: boolean; sync?: boolean }
  | { type: "dropPlan"; mission?: StwDropMission; target?: StwDropTarget; repeat?: boolean; sync?: boolean }
  | { type: "rally"; point: StwRallyId }
  | { type: "move"; y: number }
  | { type: "attack" }
  | { type: "retreat" }
  | { type: "recall"; point: StwRallyId }
  | { type: "focus"; mode: StwFocus }
  | { type: "autoWave"; size: number }
  | { type: "escort"; on: boolean }
  | { type: "scout"; target?: "main" | "resources" }
  | { type: "cancelBuild"; buildingId: number }
  | { type: "cancelProbe" }
  | { type: "cancelResearch"; research: StwResearchId }
  | { type: "cancelUnit"; buildingId: number };

export type StwView = { width: number; height: number; scale: number; zoom: number; cx: number; cy: number; ox: number; oy: number };
export type StwUi = { clock: number; timeScale: number; rally: StwRallyId | number };
