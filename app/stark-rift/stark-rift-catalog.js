import { STARK_RIFT_BUILDINGS, STARK_RIFT_UNITS } from "./stark-rift-data.js";

// 내부 병종 id는 대열과 생산 규칙을 안정적으로 유지하는 역할 분류다.
// 화면 이름과 실제 전투 수치는 종족 카탈로그에서 결정한다.
const UNIT_CATALOG = {
  vanguard: {
    worker: { name: "개척공", short: "개", note: "표준 채굴·건설 드론" },
    rifle: { name: "레일 사수", short: "레", note: "사거리 7 · 균형 잡힌 주력 사격대" },
    guard: { name: "방벽병", short: "벽", note: "고밀도 장갑으로 앞줄을 유지" },
    tank: { name: "궤도 포대", short: "궤", note: "장거리 광역 포격 · 건물에 강함" },
  },
  brood: {
    worker: { name: "포자 일꾼", short: "포", cost: 42, time: 10, note: "빠르게 증식하는 채집 생체" },
    rifle: { name: "침칼날", short: "침", cost: 42, time: 13, hp: 38, damage: 5.5, speed: 3.7, note: "저렴하고 빠른 원거리 군체" },
    guard: { name: "갑각 수호체", short: "갑", cost: 64, time: 16, hp: 108, armor: 3, damage: 10, speed: 3.6, note: "두꺼운 갑각으로 전열을 고정" },
    tank: { name: "담즙 포격체", short: "담", cost: 132, time: 25, hp: 148, damage: 24, range: 11, splash: 3.1, speed: 2.5, note: "넓은 범위를 부식시키는 생체 포병" },
  },
  conclave: {
    worker: { name: "공명공", short: "공", cost: 58, time: 14, note: "고효율 공명 채집기" },
    rifle: { name: "광자 추적자", short: "광", cost: 60, time: 19, hp: 54, armor: 1, damage: 7.2, range: 7.5, speed: 3.3, note: "정밀 사격을 수행하는 소수 정예" },
    guard: { name: "위상 파수자", short: "위", cost: 90, time: 24, hp: 145, armor: 3, damage: 13, speed: 3.2, note: "위상 장벽으로 피해를 흡수" },
    tank: { name: "성운 투사기", short: "성", cost: 178, time: 35, hp: 195, armor: 3, damage: 34, range: 13, cooldown: 2.8, speed: 2.1, note: "긴 사거리와 강한 단발 화력" },
  },
};

const BUILDING_CATALOG = {
  vanguard: {
    hq: { name: "개척 사령부", short: "◆" }, outpost: { name: "전선 기지", short: "전" }, depot: { name: "보급 모듈", short: "보" },
    barracks: { name: "훈련 격납고", short: "훈" }, factory: { name: "궤도 주조소", short: "주" }, turret: { name: "레일 포탑", short: "포" },
  },
  brood: {
    hq: { name: "군락핵", short: "●", hp: 1350 }, outpost: { name: "번식 둥지", short: "둥", cost: 270, time: 34, hp: 700 }, depot: { name: "영양낭", short: "낭", cost: 90, time: 16, hp: 300 },
    barracks: { name: "부화실", short: "부", cost: 135, time: 24, hp: 560 }, factory: { name: "포격 자궁", short: "궁", cost: 185, time: 34, hp: 650 }, turret: { name: "산성 촉수", short: "촉", cost: 105, time: 20, hp: 360, damage: 9, range: 8.5 },
  },
  conclave: {
    hq: { name: "공명 성소", short: "△", hp: 1650 }, outpost: { name: "위상 관문", short: "문", cost: 330, time: 44, hp: 900 }, depot: { name: "에너지 첨탑", short: "첨", cost: 115, time: 22, hp: 400 },
    barracks: { name: "광자 회랑", short: "광", cost: 170, time: 34, hp: 720 }, factory: { name: "성운 공방", short: "성", cost: 230, time: 46, hp: 840 }, turret: { name: "공명 방첨", short: "방", cost: 140, time: 28, hp: 470, damage: 12, range: 10 },
  },
};

function merge(base, override) {
  return Object.freeze({ ...base, ...override });
}

export function starkRiftUnitDefinition(faction, type) {
  return merge(STARK_RIFT_UNITS[type], UNIT_CATALOG[faction]?.[type] ?? UNIT_CATALOG.vanguard[type]);
}

export function starkRiftBuildingDefinition(faction, type) {
  return merge(STARK_RIFT_BUILDINGS[type], BUILDING_CATALOG[faction]?.[type] ?? BUILDING_CATALOG.vanguard[type]);
}

export function starkRiftFactionRoster(faction) {
  return {
    units: Object.fromEntries(Object.keys(STARK_RIFT_UNITS).map((type) => [type, starkRiftUnitDefinition(faction, type)])),
    buildings: Object.fromEntries(Object.keys(STARK_RIFT_BUILDINGS).map((type) => [type, starkRiftBuildingDefinition(faction, type)])),
  };
}
