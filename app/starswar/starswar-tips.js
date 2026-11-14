/**
 * 스타드래프트 게임 팁: 메뉴·일시정지·결과 화면에 한 줄씩 보여 준다.
 * 화면 표시용이라 엔진·리플레이에는 영향이 없다. 문장은 모두 고정 문구다(런타임 값에 조사를 붙이지 않는다).
 */
import { STW_UNITS } from "./starswar-data.js";

/** @typedef {{ id: string, text: string, race?: "protoss" | "terran" | "zerg", first?: boolean }} StwTip */
// first: 새로 넣은 규칙처럼 꼭 먼저 알려 줄 팁. 아직 안 봤으면 다른 안 본 팁보다 앞에 둔다.

/** @type {StwTip[]} */
export const STW_TIPS = [
  // 공통: 지휘
  { id: "map-tap", text: "지도 앞쪽을 누르면 싸우며 전진하고, 병력 선두보다 뒤쪽을 누르면 교전을 끊고 물러나요." },
  { id: "map-back", text: "지도 맨 뒤 \"본진 안쪽\"까지 병력을 물릴 수 있어요. 드랍 막기나 마법 유닛 대피에 좋아요." },
  { id: "map-attack", text: "적 앞마당 안쪽을 누르면 출격이에요. 집결지는 그대로 남아요." },
  { id: "auto-wave", text: "자동 출격은 집결지에 3·6·10기가 모이면 알아서 나가요. 후퇴 명령을 내리면 다음 전진 명령까지 잠시 멈춰요." },
  { id: "squad", text: "지도 왼쪽 위 \"부대\"로 유닛 종류별 부대를 골라 따로 움직일 수 있어요." },
  { id: "squad-pass", text: "따로 옮기는 부대가 지나가면 막고 선 아군이 옆으로 비켜 줘요. 뒤에 있는 다크템플러만 보내기도 쉬워요." },
  { id: "infiltrate", text: "본진 침투·앞마당 침투를 고르면 부대가 싸우지 않고 가장자리로 돌아 들어가 일꾼을 노려요. 닿은 뒤에는 \"지금 회수\"를 누를 때까지 싸워요." },
  { id: "infiltrate-cancel", text: "침투 중인 부대는 칩에 \"침투\"가 붙어요. 다른 곳을 누르거나 \"본대로\"를 누르면 바로 작전을 멈춰요." },
  { id: "fresh", text: "갓 나온 유닛은 집결지로 가는 길에 적을 만나면 싸우면서 이동해요." },
  { id: "target", text: "공격 목표 \"건물 우선\"은 맞아도 무시하고 생산·기술 건물부터 깨요. 방어선이 약할 때 써 보세요." },
  { id: "drop", text: "셔틀·드랍십이 생기면 병력 탭 \"수송 작전\"에서 게릴라 드랍이나 폭탄 드랍을 보낼 수 있어요." },
  { id: "drop-recall", text: "수송 작전은 \"지금 회수\"로 언제든 불러들일 수 있어요. 누르지 않아도 25초나 체력 절반이면 알아서 빠져요." },
  { id: "drop-defense", text: "적 수송선이 보이면 본진에 방어 건물을 하나 세워 두세요. 전군이 출격해 비었을 때 드랍이 가장 아파요." },
  { id: "evacuate", text: "광물 줄에 적이 들어오면 그 기지 채취가 40%로 떨어져요. 빨리 쫓아내는 게 이득이에요." },
  { id: "defense-zone", text: "방어 건물은 사거리 밖이라도 같은 기지 건물을 때리는 적을 모두 쏴요." },
  // 공통: 정찰·경제
  { id: "scout", text: "지도 오른쪽 \"본진 정찰\"로 적 건물과 병력, 연구를 확인할 수 있어요." },
  { id: "scout-res", text: "\"자원 정찰\"은 적 일꾼 수와 가스, 앞마당 확장 여부를 알려 줘요." },
  { id: "bank", text: "광물이 쌓이면 생산 건물을 더 지어 바로 병력으로 바꾸세요. 쓰지 않은 자원은 싸우지 않아요." },
  { id: "cloak", text: "은폐 유닛은 탐지기가 없으면 공격받지 않아요. 상대가 다크템플러·럴커·은폐를 쓰면 탐지부터 챙기세요." },
  { id: "storm", text: "사이오닉 스톰과 범위 공격은 은폐 유닛에도 맞아요." },
  // 공통: 편의
  { id: "pause-report", text: "일시정지 화면의 \"리포트 데이터 복사\"로 경기 중에도 지금까지의 기록을 바로 복사할 수 있어요." },
  { id: "resume", text: "경기는 5초마다 저장돼요. 앱을 닫아도 전투 설정 화면에서 이어할 수 있어요." },
  { id: "lab", text: "실험실에서 원하는 병력·연구·시각으로 교전을 미리 시험해 볼 수 있어요." },
  // 프로토스
  { id: "p-dark", race: "protoss", text: "다크템플러는 늘 은폐 상태예요. 탐지되면 탐지 밖으로 비켰다가 다시 들어가요." },
  { id: "p-cannon", race: "protoss", text: "포톤 캐논은 지상·공중을 쏘고 은폐도 탐지해요. 드랍과 다크템플러를 함께 막아요." },
  { id: "p-storm", race: "protoss", text: "하이템플러는 뒤에서 기다리다 스톰이 준비되면 앞으로 나가요. 마법 유닛은 본진 안쪽으로 물려 지킬 수 있어요." },
  // 테란
  { id: "t-cloak", race: "terran", text: "은폐 장치(레이스)와 고스트 은폐는 연구 시 영구 은폐예요. 에너지를 쓰지 않아요." },
  { id: "t-yamato", race: "terran", text: "야마토 포는 체력 100 이상인 목표에 260 피해를 줘요. 전투 유닛과 공격하는 건물을 먼저 노려요." },
  { id: "t-turret", race: "terran", text: "미사일 터렛은 공중 유닛과 은폐 유닛을 함께 막아요. 레이스·뮤탈 상대로 본진에 하나 두세요." },
  { id: "t-repair", race: "terran", first: true, text: "기계 유닛을 커맨드 센터 곁으로 물려 3초 넘게 두면 SCV가 붙어 고쳐요. 채운 체력만큼 유닛 값의 1/3을 쓰고, 채취는 멈추지 않아요." },
  { id: "t-siege", race: "terran", text: "시즈 탱크와 스팀팩은 알아서 써요. 탱크는 방어 건물 사거리 밖에서 때릴 수 있어요." },
  // 저그
  { id: "z-overlord", race: "zerg", text: "오버로드가 있는 기지는 은폐를 탐지해요. 병력 탭에서 오버로드를 출격에 동행시킬 수 있어요." },
  { id: "z-lurker", race: "zerg", text: "럴커는 적이 오면 알아서 땅속에 숨어요. 탐지기가 없는 상대에게 특히 강해요." },
  { id: "z-hatch", race: "zerg", text: "해처리를 더 지으면 생산 라인이 늘어나요. 광물이 쌓이면 해처리부터 늘려 보세요." },
];

const TIP_BY_ID = new Map(STW_TIPS.map((tip) => [tip.id, tip]));

/**
 * 보여 줄 팁 순서: 고른 종족에 맞는 팁(무작위면 공통 팁만)을, 아직 안 본 것부터 섞어서(안 본 first 팁이 맨 앞).
 * @param {string} race 내 종족(protoss·terran·zerg·random)
 * @param {Iterable<string>} seen 이미 본 팁 id
 * @param {() => number} [random]
 */
export function stwTipQueue(race, seen, random = Math.random) {
  const seenSet = new Set(seen);
  const pool = STW_TIPS.filter((tip) => !tip.race || tip.race === race);
  const shuffle = (list) => {
    const out = [...list];
    for (let index = out.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(random() * (index + 1));
      [out[index], out[pick]] = [out[pick], out[index]];
    }
    return out;
  };
  const unseen = pool.filter((tip) => !seenSet.has(tip.id));
  const fresh = [...shuffle(unseen.filter((tip) => tip.first)), ...shuffle(unseen.filter((tip) => !tip.first))];
  const old = shuffle(pool.filter((tip) => seenSet.has(tip.id)));
  return [...fresh, ...old];
}

const value = (type) => (STW_UNITS[type]?.minerals ?? 0) + (STW_UNITS[type]?.gas ?? 0);
const hitsAir = (type) => STW_UNITS[type]?.targets === "both" || STW_UNITS[type]?.targets === "air";

const AIR_ANSWER = {
  protoss: "적 공중 병력이 많았어요. 드라군·커세어·아콘과 포톤 캐논으로 대공을 갖추세요.",
  terran: "적 공중 병력이 많았어요. 해병·골리앗과 미사일 터렛으로 대공을 갖추세요.",
  zerg: "적 공중 병력이 많았어요. 히드라리스크·스커지와 스포어 콜로니로 대공을 갖추세요.",
};
const CLOAK_ANSWER = {
  protoss: "적이 은폐 유닛을 썼어요. 포톤 캐논이나 옵저버로 탐지를 챙기세요.",
  terran: "적이 은폐 유닛을 썼어요. 미사일 터렛·컴샛 스테이션·사이언스 베슬로 탐지를 챙기세요.",
  zerg: "적이 은폐 유닛을 썼어요. 오버로드를 출격에 동행시키고 스포어 콜로니로 탐지를 챙기세요.",
};

/**
 * 결과 화면용 "다음 판 팁": 이 경기에서 드러난 약점에 맞는 문장(최대 2개). 없으면 일반 팁 하나.
 * @param {import("./starswar-types").StwState} game
 * @returns {string[]}
 */
export function stwResultTips(game) {
  const race = game.sides.player.race;
  const mine = game.sides.player.stats;
  const theirs = game.sides.enemy.stats;
  const history = game.history ?? [];
  const won = game.winner === "player";
  const out = [];

  // 공중: 적 병력 값의 35% 넘게 공중이던 때, 내 병력 값 가운데 대공 비율이 30% 아래였던 적이 있으면
  const airGap = history.some((point) => {
    const foe = Object.entries(point.enemy?.mix ?? {});
    const own = Object.entries(point.player?.mix ?? {});
    const foeTotal = foe.reduce((sum, [type, count]) => sum + value(type) * count, 0);
    const foeAir = foe.reduce((sum, [type, count]) => sum + (STW_UNITS[type]?.flying && STW_UNITS[type]?.targets ? value(type) * count : 0), 0);
    const ownTotal = own.reduce((sum, [type, count]) => sum + value(type) * count, 0);
    const ownAa = own.reduce((sum, [type, count]) => sum + (hitsAir(type) ? value(type) * count : 0), 0);
    return foeTotal >= 600 && foeAir / foeTotal > 0.35 && ownTotal > 0 && ownAa / ownTotal < 0.3;
  });
  if (airGap && AIR_ANSWER[race]) out.push(AIR_ANSWER[race]);

  // 은폐: 적 병력에 다크템플러·럴커가 있었거나 은폐를 연구했는데 내가 졌으면
  const enemyResearch = game.sides.enemy.research ?? {};
  const foeCloak = history.some((point) => (point.enemy?.mix?.dark ?? 0) + (point.enemy?.mix?.lurker ?? 0) > 0)
    || enemyResearch.wraithCloak === "done" || enemyResearch.personnelCloak === "done";
  if (!won && foeCloak && CLOAK_ANSWER[race]) out.push(CLOAK_ANSWER[race]);

  if ((mine.workersLost ?? 0) >= 8) out.push(`일꾼을 많이 잃었어요. ${TIP_BY_ID.get("map-back")?.text ?? ""}`.trim());

  // 쌓아 둔 광물: 3분 뒤 평균 보유 광물이 500을 넘으면
  const later = history.filter((point) => point.t >= 180 && point.player);
  const bank = later.length ? later.reduce((sum, point) => sum + point.player.minerals, 0) / later.length : 0;
  if (bank > 500) out.push(`평균 ${Math.round(bank)} 광물을 쌓아 두었어요. ${TIP_BY_ID.get("bank")?.text ?? ""}`.trim());

  // 병력을 크게 잃음: 잃은 병력 가치가 적의 2배를 넘으면
  if (!won && (mine.valueLost ?? 0) > 2 * Math.max(300, theirs.valueLost ?? 0)) {
    out.push("병력을 적보다 훨씬 많이 잃었어요. 밀릴 때는 지도 뒤쪽을 눌러 물러나 방어 건물 곁에서 싸우세요.");
  }

  if (!won && game.time < 300) out.push("초반 공격에 무너졌어요. 본진 앞에 방어 건물을 하나 두고 첫 병력을 집결지에 모아 막아 보세요.");

  // 테란 기계 유닛을 썼는데 한 번도 SCV 수리를 하지 않았으면 수리 방법을 알려 준다.
  const usedMech = race === "terran" && history.some((point) => Object.keys(point.player?.mix ?? {}).some((type) => STW_UNITS[type]?.mech && !STW_UNITS[type]?.worker));
  if (usedMech && !(mine.repaired > 0)) out.push(TIP_BY_ID.get("t-repair")?.text ?? "");

  if (out.length) return out.slice(0, 2);
  // 일반 팁 하나: 이미 수리를 해 본 경기면 수리 팁은 건너뛴다.
  const queue = stwTipQueue(race, mine.repaired > 0 ? ["t-repair"] : []);
  return queue.length ? [queue[0].text] : [];
}
