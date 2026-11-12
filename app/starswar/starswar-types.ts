// 스타드래프트 엔진 상태의 TypeScript 표면 타입.
export type StwSide = "player" | "enemy";
export type StwDifficulty = "easy" | "normal" | "hard" | "master" | "pro";
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
  /** 따로 둔 부대(유닛 종류). 그 부대의 자리에 선다. */
  squad?: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  radius: number;
  heading: number;
  energy: number;
  /** walk: 침투 중(교전 없이 가장자리를 따라 걷는다). */
  group: "rally" | "attack" | "scout" | "drop" | "cargo" | "board" | "walk";
  /** 따로 옮기는 부대: 길을 막는 아군이 비켜 준다. */
  passing?: boolean;
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
  /** 되돌리기로 돌아오는 정찰(자원 정찰 보고를 하지 않는다). */
  scoutRecalled?: boolean;
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
  /** 건물 자리 키(main-N, natural-N, geyser-N). */
  slot?: string;
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
    | "interceptor" | "decoy" | "yamato" | "spell"; side: StwSide; x1: number; y1: number; x2: number; y2: number; ttl: number; max: number; radius?: number; attackerId?: number; targetId?: number; spell?: string;
    /** 캐리어 공격: 날아가는 인터셉터 수(4, 수용량 연구 뒤 8). */
    count?: number };
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
/** 작전: 게릴라 드랍(raid)·폭탄 드랍(bomb)·걸어서 침투(walk). */
export type StwOp = { id: number; side: StwSide; kind: StwDropMission | "walk"; target: StwDropTarget; base: "main" | "natural"; transports: number[]; riders: number[]; phase: "out" | "fight" | "pickup" | "home" | "gather" | "in"; since: number; sync: boolean; repeat: boolean; value: number };

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
  /** 유닛 종류별로 따로 둔 부대: { 종류: { y } }. */
  squads?: Partial<Record<string, { y: number }>>;
  /** 공격 목표: 교전 우선(기본) 또는 건물 우선. */
  focus?: StwFocus;
  persona: "rush" | "dragoon" | "templar" | "dark" | "robo" | "bio" | "mech" | "tankbio" | "vulture" | "ling" | "hydra" | "pool" | "ultra" | null;
  /** 최상급 AI가 밟는 따라 하기 계획(starswar-learn.js의 stwLearnPlan). */
  plan?: { id: string; race: StwRaceId; base: string; tag: string; order: unknown[]; waves: number[] };
  sawCloakAt?: number;
  sawAirAt?: number;
  sawTransportAt?: number;
  droppedAt?: number;
  dropPlan?: StwDropPlan;
  raidRelaunchAt?: number;
  /** 실험실: 인구 건물 없이 더하는 인구 상한. */
  bonusSupply?: number;
  stats: StwStats;
  /** AI의 기억(전략 전환 기록 등). 플레이어 쪽은 null. */
  ai?: { switched?: { from: string; to: string; at: number } } | null;
};

export type StwLogEntry = { id: number; time: number; side: StwSide; text: string; tone: "info" | "good" | "warn" | "danger" | "order" };

/** 경기 기록 한 점(10초마다): 양쪽 인구, 병력 가치(광물 + 가스, 일꾼 제외), 일꾼 수. */
export type StwHistoryPoint = { t: number } & Record<StwSide, { supply: number; army: number; workers: number; minerals?: number; gas?: number; mix?: Partial<Record<StwUnitType, number>> }>;
/** 재현 정보: 경기를 만든 설정(또는 실험실 설정)과 사람이 내린 명령 [틱, 진영, 명령]. */
export type StwReplayInfo = { setup?: Record<string, unknown>; scenario?: Record<string, unknown>; commands: [number, StwSide, StwCommand][] };

/** 맵 이름: 평원, 협곡, 황금 앞마당. */
export type StwMapId = "plain" | "canyon" | "gold";

type StwSpot = { x: number; y: number };

/** 맵 묶음(starswar-data.js의 STW_MAPS). 좌표는 아군 기준. */
export type StwMapData = {
  id: StwMapId;
  name: string;
  note: string;
  layout: {
    mainNexus: StwSpot;
    naturalNexus: StwSpot;
    mainMinerals: StwSpot;
    naturalMinerals: StwSpot;
    geysers: (StwSpot & { base: "main" | "natural" })[];
    mainSlots: (StwSpot & { blocked?: boolean })[];
    naturalSlots: StwSpot[];
  };
  rallyRange: { min: number; max: number };
  attackZoneY: number;
  rallyPoints: { id: string; name: string; short: string; y: number }[];
  naturalMinerals: number;
  naturalRate: number;
  /** 협곡의 좁은 길: y가 from~to인 구간은 가로 inset~(40 - inset)만 지상 유닛이 선다. */
  corridor: { from: number; to: number; taper: number; inset: number } | null;
};

export type StwState = {
  /** 맵 이름(없으면 평원). */
  map?: StwMapId;
  time: number;
  history?: StwHistoryPoint[];
  replay?: StwReplayInfo;
  /** 양쪽이 성공한 명령 [시각, 진영, 명령]: 리포트의 빌드 순서. */
  chronicle?: [number, StwSide, StwCommand & { at?: string }][];
  /** 실험실에서 세운 경기(저장·전적 제외). */
  lab?: { placement: "clash" | "home"; control: { player: "manual" | "ai"; enemy: "fight" | "ai" } };
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
  /** 마지막으로 무엇이든 피해를 입은 시각(자원이 바닥난 뒤 싸움이 멈췄는지 판단). */
  lastDamageAt?: number;
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
  | { type: "scoutRecall"; target?: "main" | "resources"; all?: boolean }
  | { type: "cancelBuild"; buildingId: number }
  | { type: "cancelProbe" }
  | { type: "cancelResearch"; research: StwResearchId }
  | { type: "cancelUnit"; buildingId: number }
  | { type: "dropRecall"; opId?: number }
  | { type: "infiltrate"; units: string[]; base: "main" | "natural" }
  | { type: "squadMove"; units: string[]; y: number }
  | { type: "squadRelease"; units?: string[] };

export type StwView = { width: number; height: number; scale: number; zoom: number; cx: number; cy: number; ox: number; oy: number };
export type StwUi = { clock: number; timeScale: number; rally: StwRallyId | number; selected?: string[] };
