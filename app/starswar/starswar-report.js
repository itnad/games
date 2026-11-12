// 스타드래프트 결과 화면의 리포트 글. 클립보드에 복사해 개발 대화에 붙여 넣는 용도다.
// - 버그 리포트: 경기 설정, 결과, 흐름, 내 명령, 최근 기록, 마지막 상태, 재현 코드
// - AI 개선 자료: 진 AI의 운영(빌드 순서·일꾼·자원·병력 구성)과 이긴 쪽 비교, 큰 교전, 자동 진단, 재현 코드
import { STW_AI_PERSONAS, STW_BUILDINGS, STW_DIFFICULTIES, STW_RACES, STW_RALLY_POINTS, STW_RESEARCH, STW_UNITS, stwMapData } from "./starswar-data.js";
import { stwClock, stwSupply } from "./starswar-engine.js";
import { stwReplayCode } from "./starswar-replay.js";

const SIDE_NAME = { player: "나", enemy: "적" };

const unitName = (type) => STW_UNITS[type]?.name ?? type;
const buildingName = (type) => STW_BUILDINGS[type]?.name ?? type;
const researchName = (id) => STW_RESEARCH[id]?.name ?? id;
const personaName = (id) => (id ? STW_AI_PERSONAS[id]?.name ?? id : "없음");
const raceName = (state, side) => STW_RACES[state.sides[side].race ?? "protoss"]?.name ?? "?";
const number = (value) => Math.round(value ?? 0).toLocaleString("en-US");
const opponent = (side) => (side === "player" ? "enemy" : "player");

/** 진영 소개: "프로토스 · AI 드라군 운영(7:30 → 템플러 테크)" 또는 "테란 · 직접 지휘". */
function sideLabel(state, side) {
  const record = state.sides[side];
  const race = raceName(state, side);
  if (!state.aiSides.includes(side)) return `${race} · 직접 지휘`;
  const switched = record.ai?.switched;
  const persona = switched ? `${personaName(switched.from)}(${stwClock(switched.at)} → ${personaName(switched.to)})` : personaName(record.persona);
  return `${race} · AI ${persona}`;
}

function resultLabel(state) {
  if (state.winner === "draw") return "무승부(자원 고갈)";
  if (state.winner === "player") return "승리(적 본진 함락)";
  if (state.winner === "enemy") return "패배(아군 본진 함락)";
  return "진행 중";
}

/** 병력 구성 {종류: 수}를 "질럿 12 · 드라군 6"으로. 많은 순. */
function mixText(mix) {
  // 이 기능 전에 시작한 경기의 앞부분 기록에는 병력 구성이 없다.
  if (mix === undefined) return "기록 없음";
  const entries = Object.entries(mix ?? {}).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([type, count]) => `${unitName(type)} ${count}`).join(" · ") : "없음";
}

function liveMix(state, side) {
  const mix = {};
  for (const unit of state.units) if (unit.side === side && unit.hp > 0 && !STW_UNITS[unit.type].worker) mix[unit.type] = (mix[unit.type] ?? 0) + 1;
  return mix;
}

function buildingList(state, side) {
  const counts = new Map();
  for (const building of state.buildings) {
    if (building.side !== side) continue;
    const key = buildingName(building.type);
    const item = counts.get(key) ?? { done: 0, building: 0 };
    if (building.progress >= 1) item.done += 1;
    else item.building += 1;
    counts.set(key, item);
  }
  return [...counts.entries()].map(([name, item]) => `${name} ${item.done}${item.building ? `(+${item.building} 건설 중)` : ""}`).join(" · ") || "없음";
}

function researchList(state, side) {
  const done = Object.entries(state.sides[side].research).filter(([, status]) => status === "done").map(([id]) => researchName(id));
  return done.length ? done.join(" · ") : "없음";
}

function rallyName(rally) {
  if (typeof rally === "number") return `y=${rally}`;
  return STW_RALLY_POINTS.find((point) => point.id === rally)?.name ?? String(rally);
}

/** 명령 한 줄 설명. */
export function stwDescribeCommand(state, command) {
  switch (command.type) {
    case "probe":
    case "worker": return "일꾼 생산";
    case "build": return command.building === "expand" ? "앞마당 확장" : `건설: ${buildingName(command.building)}`;
    case "research": return `연구: ${researchName(command.research)}`;
    case "line": {
      const id = command.buildingId ?? command.gatewayId;
      const type = command.at ?? state.buildings.find((item) => item.id === id)?.type;
      return `생산 라인(${type ? `${buildingName(type)} ` : ""}#${id}): ${command.unit ? unitName(command.unit) : "멈춤"}`;
    }
    case "lineAll": return `모든 생산 라인: ${command.unit ? unitName(command.unit) : "멈춤"}`;
    case "merge": return "아콘 합체";
    case "darkMerge": return "다크 아콘 합체";
    case "drop": return `수송 작전 출발: ${command.mission ?? "기본"}${command.target ? ` → ${command.target}` : ""}`;
    case "dropPlan": return `수송 작전 설정: ${[command.mission, command.target, command.repeat === undefined ? null : `반복 ${command.repeat ? "켬" : "끔"}`, command.sync === undefined ? null : `동시 ${command.sync ? "켬" : "끔"}`].filter(Boolean).join(" · ")}`;
    case "rally": return `집결지: ${rallyName(command.point)}`;
    case "move": return `지도 이동: y=${Math.round(command.y)}`;
    case "attack": return command.keepSquads ? "공격(자동)" : "공격";
    case "squadMove": return `부대 이동(${(command.units ?? []).map((type) => unitName(type)).join("·")}): ${command.y <= 30 ? "출격" : `y=${Math.round(command.y)}`}`;
    case "squadRelease": return `부대 합류(${(command.units ?? []).map((type) => unitName(type)).join("·") || "모두"})`;
    case "dropRecall": return "작전 회수";
    case "infiltrate": return `침투(${(command.units ?? []).map((type) => unitName(type)).join("·")} → ${command.base === "natural" ? "앞마당" : "본진"} 광물 줄)`;
    case "retreat": return "후퇴";
    case "recall": return `귀환: ${rallyName(command.point)}`;
    case "focus": return `공격 목표: ${command.mode === "buildings" ? "건물 먼저" : "싸울 수 있는 적 먼저"}`;
    case "autoWave": return command.size ? `자동 출격: ${command.size}기마다` : "자동 출격 끔";
    case "escort": return `호위 ${command.on ? "켬" : "끔"}`;
    case "scout": return command.target === "resources" ? "자원 정찰" : "본진 정찰";
    case "cancelBuild": return `건설 취소 #${command.buildingId}`;
    case "cancelProbe": return "일꾼 생산 취소";
    case "cancelResearch": return `연구 취소: ${researchName(command.research)}`;
    case "cancelUnit": return `생산 취소 #${command.buildingId}`;
    default: return JSON.stringify(command);
  }
}

/** 10초 기록 가운데 every초마다 하나씩(마지막 점은 늘 넣는다). */
function sampled(state, every) {
  const history = state.history ?? [];
  return history.filter((point, index) => point.t % every === 0 || index === history.length - 1);
}

/** 시각 t에 가장 가까운 기록. */
function pointAt(state, t) {
  const history = state.history ?? [];
  let best = null;
  for (const point of history) if (!best || Math.abs(point.t - t) < Math.abs(best.t - t)) best = point;
  return best && Math.abs(best.t - t) <= 15 ? best : null;
}

function flowRow(point, sides) {
  const cell = (data) => (data ? `인구 ${data.supply} · 병력 ${number(data.army)} · 일꾼 ${data.workers}${data.minerals === undefined ? "" : ` · 보유 ${number(data.minerals)}/${number(data.gas)}`}` : "-");
  return `${stwClock(point.t)} | ${sides.map((side) => `${SIDE_NAME[side]}: ${cell(point[side])}`).join(" | ")}`;
}

function statsTable(state) {
  const mine = state.sides.player.stats;
  const theirs = state.sides.enemy.stats;
  const rows = [
    ["채취 광물", mine.minerals, theirs.minerals],
    ["채취 가스", mine.gas, theirs.gas],
    ["생산 유닛", mine.produced, theirs.produced],
    ["잃은 유닛", mine.lost, theirs.lost],
    ["잃은 병력 가치", mine.valueLost, theirs.valueLost],
    ["잃은 건물", mine.buildingsLost, theirs.buildingsLost],
    ["파괴한 건물", mine.buildingsDestroyed, theirs.buildingsDestroyed],
    ["잃은 일꾼", mine.workersLost, theirs.workersLost],
    ["처치한 일꾼", mine.workersKilled, theirs.workersKilled],
    ["최대 인구", mine.supplyPeak, theirs.supplyPeak],
    ["마법 사용", (mine.spells ?? 0) + (mine.storms ?? 0), (theirs.spells ?? 0) + (theirs.storms ?? 0)],
  ];
  return ["항목 | 나 | 적", ...rows.map(([label, a, b]) => `${label} | ${number(a)} | ${number(b)}`)].join("\n");
}

function sideState(state, side) {
  const record = state.sides[side];
  const supply = stwSupply(state, side);
  return [
    `- ${SIDE_NAME[side]} (${sideLabel(state, side)})`,
    `  - 자원 ${number(record.minerals)} · 가스 ${number(record.gas)} · 일꾼 ${record.probes} · 인구 ${supply.used}/${supply.cap}`,
    `  - 병력: ${mixText(liveMix(state, side))}`,
    `  - 건물: ${buildingList(state, side)}`,
    `  - 연구: ${researchList(state, side)}`,
    `  - 집결지 ${rallyName(record.rally)} · 자동 출격 ${record.autoWave ? `${record.autoWave}기` : "끔"} · 공격 목표 ${record.focus === "buildings" ? "건물 먼저" : "싸울 수 있는 적 먼저"}`,
  ].join("\n");
}

function replayBlock(state, build) {
  const code = stwReplayCode(state, build);
  if (!code) return "## 재현 코드\n없음(이 기능 전에 시작해 이어 한 경기입니다)";
  const note = state.status === "playing"
    ? `경기 중(${stwClock(state.time)})에 복사한 코드입니다. 같은 판의 게임에서 처음부터 이 시각까지 똑같이 다시 돌릴 수 있습니다.`
    : "같은 판의 게임에서 이 코드로 경기를 처음부터 똑같이 다시 돌릴 수 있습니다.";
  return ["## 재현 코드", note, "```json", JSON.stringify(code), "```"].join("\n");
}

function headerLines(state, env) {
  const lines = [
    `- 결과: ${resultLabel(state)} · 경기 시간 ${stwClock(state.time)} · 난이도 ${STW_DIFFICULTIES[state.difficulty]?.name ?? state.difficulty} · 맵 ${stwMapData(state.map).name}`,
    `- 나: ${sideLabel(state, "player")}`,
    `- 적: ${sideLabel(state, "enemy")}${state.hiddenEnemyRace ? " (무작위 종족)" : ""}`,
  ];
  if (state.lab) lines.push(`- 실험실 경기: 배치 ${state.lab.placement === "home" ? "각자 집결지" : "맵 가운데 대치"} · 아군 ${state.lab.control.player === "ai" ? "AI 운영" : "직접 지휘"} · 적 ${state.lab.control.enemy === "ai" ? "AI 운영" : "교전만"}`);
  if (env?.build) lines.push(`- 게임 판: ${env.build}`);
  if (env?.device) lines.push(`- 기기: ${env.device}`);
  if (env?.copiedAt) lines.push(`- 복사한 때: ${env.copiedAt}`);
  return lines;
}

/**
 * 버그 리포트 글.
 * env: { build, device, copiedAt, note } 화면 쪽에서 채운다(note는 사용자가 적은 내용).
 */
export function stwBugReport(state, env = {}) {
  const commands = state.replay?.commands ?? [];
  const shownCommands = commands.slice(-150);
  const log = (state.log ?? []).slice(-40);
  return [
    "# 스타드래프트 버그 리포트",
    "",
    "무슨 일이 있었나요? (언제쯤, 어떤 유닛·버튼에서, 기대한 것과 실제로 일어난 것)",
    env?.note ? `- ${env.note}` : "- (여기에 적어 주세요)",
    "",
    "## 경기",
    ...headerLines(state, env),
    "",
    "## 결과 표",
    statsTable(state),
    "",
    "## 흐름 (30초마다)",
    ...sampled(state, 30).map((point) => flowRow(point, ["player", "enemy"])),
    "",
    `## 내 명령 (${commands.length}개${commands.length > shownCommands.length ? `, 마지막 ${shownCommands.length}개` : ""})`,
    ...(shownCommands.length ? shownCommands.map(([tick, side, command]) => `${stwClock(tick / 10)}${side === "player" ? "" : ` [${SIDE_NAME[side]}]`} ${stwDescribeCommand(state, command)}`) : ["없음"]),
    "",
    "## 최근 경기 기록",
    ...(log.length ? log.map((entry) => `${stwClock(entry.time)} [${SIDE_NAME[entry.side] ?? entry.side}] ${entry.text}`) : ["없음"]),
    "",
    "## 마지막 상태",
    sideState(state, "player"),
    sideState(state, "enemy"),
    "",
    replayBlock(state, env?.build ?? ""),
  ].join("\n");
}

/** 진 AI 진영(들). 이긴 AI만 있거나 AI가 없으면 빈 배열. 무승부면 AI 진영 모두. */
export function stwLosingAiSides(state) {
  if (state.status !== "over") return [];
  return state.aiSides.filter((side) => state.winner !== side);
}

/** 연대기에서 한 진영의 운영 명령(빌드·연구·라인·공격·수송 등). */
function chronicleLines(state, side, limit = 80) {
  const all = (state.chronicle ?? []).filter((entry) => entry[1] === side);
  // 생산 라인을 20초 안에 다시 바꾼 기록(자원에 따라 질럿↔드라군을 오가는 것)은 빼고, 자리 잡은 바꿈만 남긴다.
  const lineId = (command) => command.buildingId ?? command.gatewayId;
  const entries = all.filter((entry, index) => {
    if (entry[2].type !== "line") return true;
    const next = all.slice(index + 1).find((item) => item[2].type === "line" && lineId(item[2]) === lineId(entry[2]));
    return !next || next[0] - entry[0] >= 20;
  });
  const lines = entries.slice(0, limit).map(([time, , command]) => `${stwClock(time)} ${stwDescribeCommand(state, command)}`);
  if (entries.length > limit) lines.push(`… 이후 ${entries.length - limit}개 생략`);
  if (all.length > entries.length) lines.push(`(20초 안에 다시 바꾼 생산 라인 ${all.length - entries.length}개는 뺐습니다)`);
  return lines.length ? lines : ["없음"];
}

const antiAir = (type) => {
  const def = STW_UNITS[type];
  return Boolean(def?.damage) && (def.targets === "both" || def.targets === "air");
};
const flyer = (type) => Boolean(STW_UNITS[type]?.flying) && Boolean(STW_UNITS[type]?.damage);
const cloaker = (type) => Boolean(STW_UNITS[type]?.cloaked && STW_UNITS[type]?.damage) || ["lurker", "ghost", "wraith", "arbiter"].includes(type);
const unitCost = (type) => (STW_UNITS[type] ? (STW_UNITS[type].minerals + STW_UNITS[type].gas) / (STW_UNITS[type].pair ? 2 : 1) : 0);
const mixValue = (mix, test = () => true) => Object.entries(mix ?? {}).reduce((sum, [type, count]) => sum + (test(type) ? unitCost(type) * count : 0), 0);

/** 병력 가치가 크게 줄어든 구간(교전). 10초 기록 사이 양쪽 감소분을 이어 붙인다. */
function bigFights(state, side, foe) {
  const history = state.history ?? [];
  const fights = [];
  let current = null;
  for (let index = 1; index < history.length; index += 1) {
    const before = history[index - 1];
    const after = history[index];
    if (!before[side] || !after[side]) continue;
    const lost = Math.max(0, before[side].army - after[side].army);
    const foeLost = Math.max(0, before[foe].army - after[foe].army);
    if (lost + foeLost >= 250) {
      if (!current) current = { from: before.t, to: after.t, lost: 0, foeLost: 0, mix: before[side].mix, foeMix: before[foe].mix, army: before[side].army, foeArmy: before[foe].army };
      current.to = after.t;
      current.lost += lost;
      current.foeLost += foeLost;
    } else if (current) {
      fights.push(current);
      current = null;
    }
  }
  if (current) fights.push(current);
  return fights.sort((a, b) => b.lost + b.foeLost - (a.lost + a.foeLost)).slice(0, 5).sort((a, b) => a.from - b.from);
}

/** 자동 진단: 진 AI(side)와 상대(foe)의 운영 차이를 숫자로 짚는다. 판단의 실마리일 뿐 결론은 아니다. */
/** 병력 구성·보유 자원까지 기록하기 시작한 때(이 기능 전에 시작해 이어 한 경기는 중간부터다). 처음부터면 0. */
function detailFrom(state) {
  const history = state.history ?? [];
  const first = history.find((point) => point.player?.mix !== undefined);
  if (!first) return Infinity;
  return history.indexOf(first) === 0 ? 0 : first.t;
}

function diagnose(state, side, foe) {
  const notes = [];
  const history = state.history ?? [];
  const from = detailFrom(state);
  if (from > 0) notes.push(from === Infinity ? "이 경기에는 자세한 기록(병력 구성·명령)이 없습니다(기능 전에 시작한 경기). 아래 판단 일부는 빠집니다" : `자세한 기록(병력 구성·보유 자원·명령)은 ${stwClock(from)}부터입니다(기능 전에 시작해 이어 한 경기). 그 전 일은 판단에 빠집니다`);
  for (const t of [300, 480, 600]) {
    const point = pointAt(state, t);
    if (!point?.[side] || !point[foe]) continue;
    const mine = point[side].workers;
    const theirs = point[foe].workers;
    notes.push(`일꾼 ${stwClock(t)}: AI ${mine} · 상대 ${theirs}${mine < theirs * 0.8 ? " ← AI 경제가 뒤짐" : ""}`);
  }
  // 앞마당: 연대기의 확장 명령으로 시각을, 몇 번 지었는지(부서져 다시 지은 횟수)를 센다. 기록이 중간부터면 지금 앞마당이 있는지로 대신한다.
  const expansions = (who) => (state.chronicle ?? []).filter((entry) => entry[1] === who && entry[2].type === "build" && entry[2].building === "expand").map((entry) => entry[0]);
  const expandText = (who) => {
    const times = expansions(who);
    const now = state.buildings.some((building) => building.side === who && building.base === "natural" && STW_BUILDINGS[building.type]?.base);
    if (times.length) return `${times.map((t) => stwClock(t)).join(" → ")}${times.length > 1 ? `(${times.length}번 지음)` : ""}${now ? "" : " · 지금 없음"}`;
    if (from > 0) return now ? "있음(시각 기록 없음)" : `없음(${stwClock(from === Infinity ? state.time : from)} 이후)`;
    return now ? "있음" : "안 함";
  };
  notes.push(`앞마당 확장: AI ${expandText(side)} · 상대 ${expandText(foe)}${from === 0 && expansions(side).length === 0 && !state.buildings.some((building) => building.side === side && building.base === "natural" && STW_BUILDINGS[building.type]?.base) && state.time > 480 ? " ← AI가 본진 하나로 버팀" : ""}`);
  const banked = history.filter((point) => point.t >= 180 && point[side]?.minerals !== undefined);
  if (banked.length) {
    const peak = banked.reduce((best, point) => (point[side].minerals > best[side].minerals ? point : best), banked[0]);
    const average = banked.reduce((sum, point) => sum + point[side].minerals, 0) / banked.length;
    notes.push(`AI 보유 광물: 평균 ${number(average)} · 최대 ${number(peak[side].minerals)}(${stwClock(peak.t)})${average > 500 ? " ← 자원을 쓰지 못하고 쌓아 둠" : ""}`);
  }
  const armies = history.filter((point) => point[side] && point[foe]);
  if (armies.length) {
    const peak = (who) => armies.reduce((best, point) => Math.max(best, point[who].army), 0);
    notes.push(`최대 병력 가치: AI ${number(peak(side))} · 상대 ${number(peak(foe))}`);
    // 마지막으로 AI 병력이 상대 이상이던 때: 그 뒤로 역전되지 않았다.
    let lastAhead = null;
    for (const point of armies) if (point[side].army >= point[foe].army && point[side].army > 0) lastAhead = point.t;
    notes.push(lastAhead === null ? "AI 병력이 상대보다 많았던 적이 없음" : `AI 병력이 상대 이상이던 마지막 때: ${stwClock(lastAhead)}`);
  }
  // 상대 병력 값의 1/4 넘게 공중이던 때들: 처음 그렇게 된 시각, 가장 높던 비율, 그동안 AI 병력이 있던 때의 대공 비율 평균.
  const airPoints = armies.filter((point) => point[foe].mix && mixValue(point[foe].mix, flyer) / Math.max(1, mixValue(point[foe].mix)) >= 0.25);
  if (airPoints.length) {
    const share = (point) => mixValue(point[foe].mix, flyer) / Math.max(1, mixValue(point[foe].mix));
    const peak = airPoints.reduce((best, point) => (share(point) > share(best) ? point : best), airPoints[0]);
    const withArmy = airPoints.filter((point) => mixValue(point[side].mix) > 0);
    const mineAa = withArmy.length ? withArmy.reduce((sum, point) => sum + mixValue(point[side].mix, antiAir) / mixValue(point[side].mix), 0) / withArmy.length : null;
    const head = `상대 공중 병력(값 기준): ${stwClock(airPoints[0].t)}부터 25% 넘음, 최고 ${Math.round(share(peak) * 100)}%(${stwClock(peak.t)})`;
    notes.push(mineAa === null ? `${head} · 그동안 AI 병력 없음` : `${head} · 그동안 AI 대공 가능 병력 비율 평균 ${Math.round(mineAa * 100)}%${mineAa < 0.4 ? " ← 대공이 모자람" : ""}`);
  }
  const foeCloak = new Set();
  for (const point of armies) for (const type of Object.keys(point[foe].mix ?? {})) if (cloaker(type)) foeCloak.add(unitName(type));
  if (foeCloak.size) {
    const seen = state.sides[side].sawCloakAt;
    notes.push(`상대 은폐 가능 유닛: ${[...foeCloak].join(" · ")} · AI가 은폐 유닛을 마지막으로 본 때 ${seen === undefined ? "없음" : stwClock(seen)}`);
  }
  const memory = state.sides[side].ai ?? {};
  if (memory.alertSeconds) notes.push(`AI 경계 상태: 처음 ${stwClock(memory.alertFirst ?? 0)} · 모두 ${Math.round(memory.alertSeconds)}초`);
  const researched = (who) => Object.values(state.sides[who].research).filter((status) => status === "done").length;
  notes.push(`완료한 연구: AI ${researched(side)} · 상대 ${researched(foe)}`);
  const attacks = (state.chronicle ?? []).filter((entry) => entry[1] === side && entry[2].type === "attack").map((entry) => stwClock(entry[0]));
  notes.push(`AI 공격 명령: ${attacks.length ? attacks.slice(0, 12).join(", ") + (attacks.length > 12 ? " …" : "") : "없음"}`);
  // 공격과 후퇴를 5초 안에 오간 횟수(판단이 흔들림).
  const orders = (state.chronicle ?? []).filter((entry) => entry[1] === side && (entry[2].type === "attack" || entry[2].type === "retreat"));
  const flips = orders.filter((entry, index) => index > 0 && entry[2].type !== orders[index - 1][2].type && entry[0] - orders[index - 1][0] < 5).length;
  if (flips >= 3) notes.push(`공격·후퇴를 5초 안에 오간 횟수: ${flips} ← 출격 판단이 흔들림`);
  return notes.map((note) => `- ${note}`);
}

/** AI 개선 자료. 진 AI가 없으면 null. */
export function stwAiReport(state, env = {}) {
  const sides = stwLosingAiSides(state);
  if (!sides.length) return null;
  const parts = ["# 스타드래프트 AI 개선 자료", "", "이 경기에서 진 AI가 왜 졌는지 살펴 대응을 고치기 위한 자료입니다.", "", "## 경기", ...headerLines(state, env)];
  for (const side of sides) {
    const foe = opponent(side);
    const label = `${SIDE_NAME[side]} AI`;
    const memory = state.sides[side].ai ?? {};
    const fights = bigFights(state, side, foe);
    parts.push(
      "",
      `## ${label} (${sideLabel(state, side)}) 대 ${state.aiSides.includes(foe) ? "AI" : "사람"} (${sideLabel(state, foe)})`,
      "",
      "### 자동 진단",
      ...diagnose(state, side, foe),
      "",
      "### 큰 교전 (병력 가치가 크게 줄어든 구간)",
      ...(fights.length
        ? fights.flatMap((fight) => [
          `- ${stwClock(fight.from)}~${stwClock(fight.to)}: AI 잃음 ${number(fight.lost)}(전 ${number(fight.army)}) · 상대 잃음 ${number(fight.foeLost)}(전 ${number(fight.foeArmy)})`,
          `  - 직전 AI: ${mixText(fight.mix)}`,
          `  - 직전 상대: ${mixText(fight.foeMix)}`,
        ])
        : ["- 없음"]),
      "",
      "### 병력 구성 흐름 (1분마다)",
      ...sampled(state, 60).map((point) => `${stwClock(point.t)} | AI: ${mixText(point[side]?.mix)} | 상대: ${mixText(point[foe]?.mix)}`),
      "",
      "### 경제·병력 흐름 (30초마다)",
      ...sampled(state, 30).map((point) => flowRow(point, [side, foe])),
      "",
      "### AI 운영 기록 (성공한 명령, 같은 명령 30초 안 반복과 금방 되돌린 생산 라인은 생략)",
      ...chronicleLines(state, side),
      "",
      `### 상대 운영 기록`,
      ...chronicleLines(state, foe),
      "",
      "### 마지막 상태",
      sideState(state, side),
      sideState(state, foe),
      "",
      "### AI 내부 기억",
      "```json",
      JSON.stringify(memory),
      "```",
    );
  }
  parts.push("", "## 결과 표", statsTable(state), "", replayBlock(state, env?.build ?? ""));
  return parts.join("\n");
}
