import original from "./economy-original.json";
import burrow from "./burrow-original.json";
import special from "./special-original.json";
import cloak from "./cloak-original.json";
import siege from "./siege-original.json";
import { checksum } from "../core/checksum";
export type Faction = "terran" | "zerg" | "protoss";
export type EconomyDefinition = {
  id: string;
  sourceName: string;
  name: string;
  faction: Faction;
  kind: "worker" | "combat" | "building";
  icon: string;
  minerals: number;
  gas: number;
  frames: number;
  ticks: number;
  health: number;
  shield: number;
  armor: number;
  supply: number;
  provides: number;
  speed: number;
  radius: number;
  width: number;
  height: number;
  sight: number;
  producer: string;
  requires: string[];
  batch: number;
  headquarters: boolean;
  gasBuilding: boolean;
  creep: boolean;
  power: boolean;
  addonParent: string | null;
};
/** 24 original frames/s -> 20 ticks/s -> half duration; round half upwards. */
export const economicTicks = (frames: number) =>
  Math.max(1, Math.floor((frames * 5 + 6) / 12));
export const originalTicks = (frames: number) =>
  Math.max(1, Math.floor((frames * 5 + 3) / 6));
const rows: [string, string, string, string, string[]?][] = [
  ["Terran_SCV", "SCV", "worker", "terran-command-center"],
  ["Terran_Marine", "마린", "infantry", "terran-barracks"],
  ["Terran_Vulture", "벌처", "vehicle", "terran-factory"],
  [
    "Terran_Siege_Tank_Tank_Mode",
    "시즈 탱크",
    "vehicle",
    "terran-factory",
    ["terran-machine-shop"],
  ],
  ["Terran_Command_Center", "커맨드 센터", "headquarters", "terran-scv"],
  ["Terran_Supply_Depot", "서플라이 디포", "supply", "terran-scv"],
  [
    "Terran_Barracks",
    "배럭",
    "military",
    "terran-scv",
    ["terran-supply-depot"],
  ],
  ["Terran_Refinery", "리파이너리", "gas", "terran-scv"],
  [
    "Terran_Engineering_Bay",
    "엔지니어링 베이",
    "research",
    "terran-scv",
    ["terran-command-center"],
  ],
  ["Terran_Factory", "팩토리", "military", "terran-scv", ["terran-barracks"]],
  ["Terran_Machine_Shop", "머신샵", "addon", "terran-factory"],
  ["Zerg_Drone", "드론", "worker", "zerg-hatchery"],
  [
    "Zerg_Zergling",
    "저글링",
    "infantry",
    "zerg-hatchery",
    ["zerg-spawning-pool"],
  ],
  [
    "Zerg_Hydralisk",
    "히드라리스크",
    "infantry",
    "zerg-hatchery",
    ["zerg-hydralisk-den"],
  ],
  ["Zerg_Overlord", "오버로드", "airSupply", "zerg-hatchery"],
  ["Zerg_Hatchery", "해처리", "headquarters", "zerg-drone"],
  [
    "Zerg_Spawning_Pool",
    "스포닝 풀",
    "military",
    "zerg-drone",
    ["zerg-hatchery"],
  ],
  ["Zerg_Extractor", "익스트랙터", "gas", "zerg-drone"],
  ["Zerg_Creep_Colony", "크립 콜로니", "supply", "zerg-drone"],
  [
    "Zerg_Evolution_Chamber",
    "에볼루션 챔버",
    "research",
    "zerg-drone",
    ["zerg-hatchery"],
  ],
  [
    "Zerg_Hydralisk_Den",
    "히드라리스크 덴",
    "military",
    "zerg-drone",
    ["zerg-spawning-pool"],
  ],
  ["Protoss_Probe", "프로브", "worker", "protoss-nexus"],
  ["Protoss_Zealot", "질럿", "infantry", "protoss-gateway"],
  [
    "Protoss_Dragoon",
    "드라군",
    "vehicle",
    "protoss-gateway",
    ["protoss-cybernetics-core"],
  ],
  ["Protoss_Nexus", "넥서스", "headquarters", "protoss-probe"],
  ["Protoss_Pylon", "파일런", "supply", "protoss-probe"],
  [
    "Protoss_Gateway",
    "게이트웨이",
    "military",
    "protoss-probe",
    ["protoss-nexus"],
  ],
  ["Protoss_Assimilator", "어시밀레이터", "gas", "protoss-probe"],
  ["Protoss_Forge", "포지", "research", "protoss-probe", ["protoss-nexus"]],
  [
    "Protoss_Cybernetics_Core",
    "사이버네틱스 코어",
    "research",
    "protoss-probe",
    ["protoss-gateway"],
  ],
];
const specialRows: typeof rows = [
  ["Terran_Starport", "스타포트", "military", "terran-scv", ["terran-factory"]],
  ["Terran_Control_Tower", "컨트롤 타워", "addon", "terran-starport"],
  ["Terran_Dropship", "드롭십", "transport", "terran-starport", ["terran-control-tower"]],
  ["Zerg_Lair", "레어", "headquarters", "zerg-hatchery", ["zerg-spawning-pool"]],
  ["Protoss_Citadel_of_Adun", "시타델 오브 아둔", "research", "protoss-probe", ["protoss-cybernetics-core"]],
  ["Protoss_Templar_Archives", "템플러 아카이브", "research", "protoss-probe", ["protoss-citadel-of-adun"]],
  ["Protoss_Dark_Templar", "다크 템플러", "infantry", "protoss-gateway", ["protoss-templar-archives"]],
  ["Protoss_Robotics_Facility", "로보틱스 퍼실리티", "military", "protoss-probe", ["protoss-cybernetics-core"]],
  ["Protoss_Observatory", "옵저버토리", "research", "protoss-probe", ["protoss-robotics-facility"]],
  ["Protoss_Observer", "옵저버", "detector", "protoss-robotics-facility", ["protoss-observatory"]],
  ["Protoss_Shuttle", "셔틀", "transport", "protoss-robotics-facility"],
];
const cloakRows: typeof rows = [
  ["Terran_Ghost", "고스트", "infantry", "terran-barracks", ["terran-academy", "terran-covert-ops"]],
  ["Terran_Wraith", "레이스", "airCombat", "terran-starport"],
  ["Terran_Academy", "아카데미", "research", "terran-scv", ["terran-barracks"]],
  ["Terran_Science_Facility", "사이언스 퍼실리티", "research", "terran-scv", ["terran-starport"]],
  ["Terran_Covert_Ops", "코버트 옵스", "addon", "terran-science-facility"],
];
const siegeRows: typeof rows = [["Terran_Siege_Tank_Siege_Mode", "시즈 탱크 · 시즈 모드", "vehicle", "terran-siege-tank-tank-mode"]];
export const unitFamily = (id: string) => id === "terran-siege-tank-siege-mode" ? "terran-siege-tank-tank-mode" : id;
/** A Lair retains Hatchery production, prerequisites, larvae and resource return. */
export const countsAsDefinition = (actual: string, expected: string) =>
  actual === expected || (actual === "zerg-lair" && expected === "zerg-hatchery");
export const isLarvaProducer = (id: string) => countsAsDefinition(id, "zerg-hatchery");
export const economyLayer = (d: EconomyDefinition): "air" | "ground" =>
  ["airSupply", "transport", "detector", "airCombat"].includes(d.icon) ? "air" : "ground";
export const economyId = (name: string) =>
  name.toLowerCase().replaceAll("_", "-");
export const ECONOMY_DEFINITIONS: EconomyDefinition[] = [...rows, ...specialRows, ...cloakRows, ...siegeRows].map(
  ([sourceName, name, icon, producer, requires = []]) => {
    const raw = [...original.units, ...special.units, ...cloak.units, ...siege.units].find((u) => u.name === sourceName);
    if (!raw) throw new Error("Missing original definition " + sourceName);
    const id = economyId(sourceName),
      faction = id.split("-")[0] as Faction;
    const kind =
      icon === "worker"
        ? "worker"
        : ["infantry", "vehicle", "airSupply", "transport", "detector", "airCombat"].includes(icon)
          ? "combat"
          : "building";
    const headquarters = icon === "headquarters",
      gasBuilding = icon === "gas";
    return {
      id,
      sourceName,
      name,
      faction,
      kind,
      icon,
      minerals: raw.defaultOreCost,
      gas: raw.defaultGasCost,
      frames: raw.defaultTimeCost,
      ticks: economicTicks(raw.defaultTimeCost),
      health: raw.defaultMaxHP,
      shield: raw.defaultMaxSP,
      armor: raw.defaultArmorAmount,
      supply: raw.unitSupplyRequired,
      provides: raw.unitSupplyProvided,
      speed:
        kind === "building" ? 0 : Math.floor(raw.unitTopSpeeds * 24 * 8 + 0.5),
      radius:
        kind === "building"
          ? Math.max(raw.dimensions[0], raw.dimensions[1]) * 128
          : Math.max(...raw.dimensions.slice(2)) * 8,
      width: raw.dimensions[0],
      height: raw.dimensions[1],
      sight: raw.sightRangeTiles,
      producer,
      requires,
      batch: id === "zerg-zergling" ? 2 : 1,
      headquarters,
      gasBuilding,
      creep:
        kind === "building" &&
        faction === "zerg" &&
        !headquarters &&
        !gasBuilding,
      power:
        kind === "building" &&
        faction === "protoss" &&
        !headquarters &&
        !gasBuilding &&
        id !== "protoss-pylon",
      addonParent: icon === "addon" ? producer : null,
    };
  },
);
const lookup = new Map(ECONOMY_DEFINITIONS.map((d) => [d.id, d]));
export const economyDefinition = (id: string) => lookup.get(id);
export const factionHeadquarters = (f: Faction) =>
  ECONOMY_DEFINITIONS.find((d) => d.faction === f && d.headquarters)!;
export const factionWorker = (f: Faction) =>
  ECONOMY_DEFINITIONS.find((d) => d.faction === f && d.kind === "worker")!;
const weaponUpgrades = original.upgrades.map((raw, i) => ({
  id: economyId(raw.name),
  name: ["보병 무기", "근접 공격", "지상 무기"][i],
  faction: ["terran", "zerg", "protoss"][i] as Faction,
  producer: [
    "terran-engineering-bay",
    "zerg-evolution-chamber",
    "protoss-forge",
  ][i],
  minerals: raw.defaultOreCostBase,
  gas: raw.defaultOreCostBase,
  factor: raw.defaultOreCostFactor,
  frames: raw.defaultTimeCostBase,
  ticks: economicTicks(raw.defaultTimeCostBase),
  timeFactor: raw.defaultTimeCostFactor,
  maxLevel: raw.defaultMaxRepeats,
  availableLevels: 1,
}));
const burrowUpgrades = [
  ...weaponUpgrades,
  {
    id: "burrowing",
    name: "버로우",
    faction: "zerg" as Faction,
    producer: burrow.producer,
    minerals: burrow.minerals,
    gas: burrow.gas,
    factor: 0,
    frames: burrow.frames,
    ticks: economicTicks(burrow.frames),
    timeFactor: 0,
    maxLevel: 1,
    availableLevels: 1,
  },
];
const sacs = special.upgrades[0];
const specialUpgrades = [...burrowUpgrades, {
  id: "ventral-sacs", name: "오버로드 수송", faction: "zerg" as Faction,
  producer: "zerg-lair", minerals: sacs.defaultOreCostBase, gas: sacs.defaultOreCostBase,
  factor: 0, frames: sacs.defaultTimeCostBase, ticks: economicTicks(sacs.defaultTimeCostBase),
  timeFactor: 0, maxLevel: 1, availableLevels: 1,
}];
const cloakUpgrades = [...specialUpgrades, ...cloak.technologies.map((raw, i) => ({
  id: economyId(raw.name), name: i === 0 ? "개인 은폐" : "클로킹 필드", faction: "terran" as Faction, producer: raw.producer,
  minerals: raw.minerals, gas: raw.gas, factor: 0, frames: raw.frames, ticks: economicTicks(raw.frames), timeFactor: 0, maxLevel: 1, availableLevels: 1,
}))];
const siegeTech = siege.technology;
export const ECONOMY_UPGRADES = [...cloakUpgrades, {
  id: "tank-siege-mode", name: "시즈 모드", faction: "terran" as Faction, producer: siegeTech.producer, minerals: siegeTech.minerals, gas: siegeTech.gas, factor: 0, frames: siegeTech.frames, ticks: economicTicks(siegeTech.frames), timeFactor: 0, maxLevel: 1, availableLevels: 1,
}];
export const ECONOMY_SOURCE = original.source;
export const ECONOMY_MECHANICS = {
  mineralHarvestTicks: economicTicks(75),
  gasHarvestTicks: economicTicks(37),
  load: 8,
  depletedGasLoad: 2,
  larvaTicks: originalTicks(342),
  creepSpreadTicks: originalTicks(16),
  maxSupplyHalf: 200,
  queueLimit: 5,
  buildingRefundNumerator: 3,
  buildingRefundDenominator: 4,
};
export const LEGACY_ECONOMY_DATA_VERSION =
  "bw1161-economy-" +
  checksum({
    original: JSON.stringify(original),
    definitions: ECONOMY_DEFINITIONS.slice(0, rows.length),
    upgrades: weaponUpgrades,
    mechanics: ECONOMY_MECHANICS,
  });
export const BURROW_ECONOMY_DATA_VERSION =
  "burrow-economy-" + checksum({ base: LEGACY_ECONOMY_DATA_VERSION, burrow });
export const SPECIAL_ECONOMY_DATA_VERSION = "special-economy-" + checksum({
  base: BURROW_ECONOMY_DATA_VERSION, special: JSON.stringify(special), definitions: ECONOMY_DEFINITIONS.slice(0, rows.length + specialRows.length),
  upgrades: specialUpgrades,
});
export const CLOAK_ECONOMY_DATA_VERSION = "cloak-economy-" + checksum({ base: SPECIAL_ECONOMY_DATA_VERSION, cloak: JSON.stringify(cloak), definitions: ECONOMY_DEFINITIONS.slice(0, rows.length + specialRows.length + cloakRows.length), upgrades: cloakUpgrades });
export const ECONOMY_DATA_VERSION = "siege-economy-" + checksum({ base: CLOAK_ECONOMY_DATA_VERSION, siege: JSON.stringify(siege), definitions: ECONOMY_DEFINITIONS, upgrades: ECONOMY_UPGRADES });
for (const d of ECONOMY_DEFINITIONS) {
  if (
    !lookup.has(d.producer) ||
    d.requires.some((id) => !lookup.has(id)) ||
    d.radius < 1 ||
    d.radius > 512 ||
    d.speed > 4096
  )
    throw new Error("Invalid economic catalog " + d.id);
}
