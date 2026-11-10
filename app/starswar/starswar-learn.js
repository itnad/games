// 스타즈워 최상급 AI의 학습. 엔진·화면 어디에도 의존하지 않는 순수 함수만 둔다(데이터만 읽는다).
// 1) 경기가 끝나면 사람 쪽 운영을 분석해(전략 꼬리표·빌드·출격) 기록하고, AI가 고른 전략의 승패를 센다.
// 2) 새 최상급 경기를 만들 때 그 기록을 작은 묶음(snapshot)으로 넘긴다. 묶음은 재현 정보에 함께 남아 같은 경기가 다시 돌아간다.
// 3) AI는 묶음으로 전략을 고르고(이긴 사람의 운영을 따라 한 계획 포함), 정찰로 상대 전략을 짐작해 맞받는다.
import { STW_AI_PERSONAS, STW_BUILDINGS, STW_RACES, STW_UNITS } from "./starswar-data.js";

export const STW_LEARN_VERSION = 1;
/** 보관하는 기록 수와, 종족마다 들고 다니는 따라 하기 계획 수. */
const MAX_RECORDS = 40;
const MAX_PLANS_PER_RACE = 6;
/** 따라 하기 계획에 담는 빌드 단계 수와, 그 단계를 모으는 시간(초). */
const PLAN_STEPS = 22;
const PLAN_UNTIL = 600;

/** 전략 꼬리표. 앞의 것이 우선이다(하나만 고를 때). */
export const STW_LEARN_TAGS = ["rush", "cloak", "air", "turtle", "fastExpand", "macro"];

const AIR = new Set(["scout", "corsair", "carrier", "arbiter", "wraith", "valkyrie", "battlecruiser", "mutalisk", "scourge", "guardian", "devourer"]);
const CLOAK = new Set(["dark", "lurker", "arbiter"]);
const CLOAK_RESEARCH = new Set(["wraithCloak", "ghostCloak", "lurkerAspect"]);
const AIR_TECH = new Set(["stargate", "beacon", "starport", "spire"]);
const CLOAK_TECH = new Set(["archives", "tribunal"]);

const value = (type) => (STW_UNITS[type] ? (STW_UNITS[type].minerals + STW_UNITS[type].gas) / (STW_UNITS[type].pair ? 2 : 1) : 0);
const raceOf = (state, side) => state.sides[side].race ?? "protoss";
const opponent = (side) => (side === "player" ? "enemy" : "player");

/** 빈 저장 묶음. */
export function stwLearnEmpty() {
  return { v: STW_LEARN_VERSION, records: [], stats: {}, tagStats: {}, foeTags: {} };
}

/** 저장소에서 읽은 값을 검사해 쓸 수 있는 묶음으로(형식이 다르면 빈 묶음). */
export function stwLearnNormalize(raw) {
  if (!raw || raw.v !== STW_LEARN_VERSION || !Array.isArray(raw.records)) return stwLearnEmpty();
  return { v: STW_LEARN_VERSION, records: raw.records.slice(-MAX_RECORDS), stats: raw.stats ?? {}, tagStats: raw.tagStats ?? {}, foeTags: raw.foeTags ?? {} };
}

/**
 * 한 진영의 운영 특징: 빌드·연구 순서와 시각, 확장, 가스, 방어 건물, 첫 공격, 병력 구성, 공중·은폐.
 * 연대기(state.chronicle)와 10초 기록(state.history)만 쓴다.
 */
export function stwLearnFeatures(state, side) {
  const race = STW_RACES[raceOf(state, side)];
  const entries = (state.chronicle ?? []).filter((entry) => entry[1] === side);
  const builds = entries.filter((entry) => entry[2].type === "build").map((entry) => ({ t: entry[0], building: entry[2].building }));
  const researches = entries.filter((entry) => entry[2].type === "research").map((entry) => ({ t: entry[0], research: entry[2].research }));
  const attacks = entries.filter((entry) => entry[2].type === "attack" || (entry[2].type === "move" && entry[2].y <= 30)).map((entry) => entry[0]);
  const count = (until, test) => builds.filter((item) => item.t <= until && test(item.building)).length;
  const expand = builds.find((item) => item.building === "expand")?.t ?? null;
  const producers = count(180, (type) => race.producers.includes(type));
  const gasBy180 = count(180, (type) => type === race.refinery);
  const defenses = count(420, (type) => Boolean(STW_BUILDINGS[type]?.defense));
  const history = (state.history ?? []).filter((point) => point[side]?.mix);
  const armyAt = (t) => {
    const point = history.reduce((best, item) => (!best || Math.abs(item.t - t) < Math.abs(best.t - t) ? item : best), null);
    return point ? Object.values(point[side].mix).reduce((sum, n) => sum + n, 0) : 0;
  };
  let peakMix = {};
  let peakValue = 0;
  for (const point of history) {
    const total = Object.entries(point[side].mix).reduce((sum, [type, n]) => sum + value(type) * n, 0);
    if (total > peakValue) {
      peakValue = total;
      peakMix = point[side].mix;
    }
  }
  const airShare = peakValue ? Object.entries(peakMix).reduce((sum, [type, n]) => sum + (AIR.has(type) ? value(type) * n : 0), 0) / peakValue : 0;
  const cloakAt = history.find((point) => point.t <= 560 && Object.keys(point[side].mix).some((type) => CLOAK.has(type)))?.t
    ?? researches.find((item) => item.t <= 560 && CLOAK_RESEARCH.has(item.research))?.t ?? null;
  return {
    race: race.id,
    builds,
    researches,
    attacks,
    attackSizes: attacks.map((t) => armyAt(t)),
    expand,
    producers,
    gasBy180,
    defenses,
    peakMix,
    airShare: Math.round(airShare * 100) / 100,
    cloakAt,
  };
}

/** 운영 특징으로 전략 꼬리표를 붙인다(여러 개일 수 있다). 첫 번째가 대표다. */
export function stwLearnTags(features) {
  const tags = [];
  const firstAttack = features.attacks[0] ?? null;
  if ((firstAttack !== null && firstAttack < 300) || (features.producers >= 3 && features.gasBy180 === 0)) tags.push("rush");
  if (features.cloakAt !== null) tags.push("cloak");
  if (features.airShare >= 0.35) tags.push("air");
  if (features.defenses >= 3) tags.push("turtle");
  if (features.expand !== null && features.expand < 200) tags.push("fastExpand");
  if (!tags.length) tags.push("macro");
  return tags;
}

/** 정찰 정보(takeIntel)로 상대 전략 꼬리표를 짐작한다. 경기 중 AI가 쓴다. */
export function stwIntelTag(intel, time) {
  if (!intel) return null;
  const race = STW_RACES[intel.race ?? "protoss"];
  const has = (set) => Object.keys(intel.buildings).some((type) => set.has(type));
  const producers = race.producers.reduce((sum, type) => sum + (intel.buildings[type] ?? 0), 0);
  const gas = intel.buildings[race.refinery] ?? 0;
  const defenses = Object.entries(intel.buildings).reduce((sum, [type, n]) => sum + (STW_BUILDINGS[type]?.defense ? n : 0), 0);
  const bases = intel.buildings[race.base] ?? 0;
  if (time < 300 && ((producers >= 3 && gas === 0) || (producers >= 2 && gas === 0 && time < 200))) return "rush";
  if (has(CLOAK_TECH) || intel.research.some((item) => CLOAK_RESEARCH.has(item.id)) || Object.entries(intel.units).some(([type, n]) => n && CLOAK.has(type))) return "cloak";
  if (has(AIR_TECH)) return "air";
  if (defenses >= 2) return "turtle";
  if (bases >= 2 && time < 300) return "fastExpand";
  return "macro";
}

/** 병력 구성과 꼬리표에 가장 가까운 기본 성향(생산 라인·출격 규칙은 이 성향을 따른다). */
function basePersona(race, features, tags) {
  const mix = features.peakMix;
  const share = (...types) => {
    const total = Object.values(mix).reduce((sum, n) => sum + n, 0) || 1;
    return types.reduce((sum, type) => sum + (mix[type] ?? 0), 0) / total;
  };
  if (race === "protoss") {
    if (share("carrier") > 0.08) return "carrier";
    if (share("corsair", "scout") > 0.15) return "corsair";
    if (share("dark", "darkArchon") > 0.1) return "dark";
    if (share("reaver") > 0.05) return "robo";
    if (share("templar", "archon") > 0.1) return "templar";
    if (tags.includes("rush") || share("zealot") > 0.7) return "rush";
    return "dragoon";
  }
  if (race === "terran") {
    if (share("battlecruiser") > 0.05) return "bc";
    if (share("wraith") > 0.15) return "wraith";
    if (share("tank") > 0.15 && share("marine", "medic", "firebat") > 0.3) return "tankbio";
    if (share("vulture") > 0.35) return "vulture";
    if (share("tank", "vulture", "goliath") > 0.4) return "mech";
    return "bio";
  }
  if (share("guardian", "defiler") > 0.05) return "hive";
  if (share("mutalisk") > 0.15) return "muta";
  if (share("ultra") > 0.05) return "ultra";
  if (share("hydra", "lurker") > 0.3) return "hydra";
  if (tags.includes("rush")) return "pool";
  return "ling";
}

/**
 * 이긴 사람의 운영을 AI가 그대로 밟을 계획으로 바꾼다.
 * - 빌드 순서: 10분까지의 건설·연구 순서(인구 건물은 AI의 인구 규칙이 짓으므로 뺀다). 확장은 그 시각을 지킨다
 * - 출격: 사람이 공격한 때의 병력 수(최소 4기)를 차례로
 * - 생산 라인과 그 밖의 판단은 병력 구성이 가장 가까운 기본 성향을 따른다
 */
export function stwLearnPlan(features, tags, id) {
  const race = STW_RACES[features.race];
  const order = [];
  const steps = [
    ...features.builds.map((item) => ({ t: item.t, step: item.building === "expand" ? { build: "expand", at: Math.round(item.t) } : { build: item.building } })),
    ...features.researches.map((item) => ({ t: item.t, step: { research: item.research } })),
  ].sort((a, b) => a.t - b.t);
  for (const { t, step } of steps) {
    if (t > PLAN_UNTIL || order.length >= PLAN_STEPS) break;
    if (step.build === race.supply) continue;
    if (step.build && step.build !== "expand" && !STW_BUILDINGS[step.build]) continue;
    order.push(step);
  }
  const sizes = features.attackSizes.filter((n) => n > 0).map((n) => Math.max(4, Math.round(n)));
  const waves = [];
  for (const size of sizes) if (!waves.length || size > waves.at(-1)) waves.push(size);
  while (waves.length < 4) waves.push((waves.at(-1) ?? 12) + 4);
  return { id, race: race.id, base: basePersona(race.id, features, tags), tag: tags[0], order, waves: waves.slice(0, 6) };
}

/** 승패 통계의 맵 머리표: 평원은 없고(예전 기록 그대로), 다른 맵은 "canyon:"처럼 붙는다. */
function mapPrefix(map) {
  return map && map !== "plain" ? `${map}:` : "";
}

/** 그 맵의 승패 표. 다른 맵은 아직 해 보지 않은 선택에 한해 평원의 기록을 빌려 쓴다. */
function mapTable(tables, key, map) {
  const prefix = mapPrefix(map);
  return prefix ? { ...(tables?.[key] ?? {}), ...(tables?.[`${prefix}${key}`] ?? {}) } : tables?.[key] ?? {};
}

/**
 * 끝난 경기를 학습 묶음에 더한다(새 묶음을 돌려준다). 사람 대 AI 경기만 센다.
 * - 모든 경기: AI가 고른 전략(성향 또는 따라 하기 계획)의 승패를 (AI 종족·상대 종족)과 (…·상대 전략 꼬리표)로 센다. 맵마다 따로 센다
 * - 사람의 전략 꼬리표를 상대 종족별로 센다(어떤 전략을 자주 쓰는지)
 * - AI가 졌으면: 이긴 사람의 운영을 따라 하기 계획으로 남긴다(최근 것 위주로 보관)
 */
export function stwLearnAdd(store, state) {
  const next = stwLearnNormalize(JSON.parse(JSON.stringify(store ?? stwLearnEmpty())));
  if (state.status !== "over" || state.lab) return next;
  for (const side of state.aiSides) {
    const human = opponent(side);
    if (state.aiSides.includes(human)) continue;
    const features = stwLearnFeatures(state, human);
    const tags = stwLearnTags(features);
    const aiRace = raceOf(state, side);
    const foeRace = features.race;
    const record = state.sides[side];
    const choice = record.plan ? `plan:${record.plan.id}` : record.ai?.switched?.from ?? record.persona;
    const won = state.winner === side;
    const bump = (table, key) => {
      table[key] ??= {};
      const [games, wins] = table[key][choice] ?? [0, 0];
      table[key][choice] = [games + 1, wins + (won ? 1 : 0)];
    };
    const prefix = mapPrefix(state.map);
    bump(next.stats, `${prefix}${aiRace}|${foeRace}`);
    bump(next.tagStats, `${prefix}${aiRace}|${foeRace}|${tags[0]}`);
    next.foeTags[foeRace] ??= {};
    next.foeTags[foeRace][tags[0]] = (next.foeTags[foeRace][tags[0]] ?? 0) + 1;
    if (!won && state.winner === human) {
      const id = `${foeRace[0]}${Math.round(state.time)}${String(state.rngState % 1000).padStart(3, "0")}`;
      next.records.push({ id, at: Math.round(state.time), aiRace, foeRace, tags, plan: stwLearnPlan(features, tags, id) });
      next.records = next.records.slice(-MAX_RECORDS);
    }
  }
  return next;
}

/** 새 최상급 경기에 넘길 작은 묶음: 종족마다 최근 계획(같은 기본 성향·꼬리표는 최신 하나)과 승패 통계. */
export function stwLearnSnapshot(store) {
  const data = stwLearnNormalize(store);
  const plans = [];
  const seen = new Set();
  for (const record of [...data.records].reverse()) {
    const key = `${record.plan.race}|${record.plan.base}|${record.plan.tag}`;
    if (seen.has(key) || plans.filter((plan) => plan.race === record.plan.race).length >= MAX_PLANS_PER_RACE) continue;
    seen.add(key);
    plans.push(record.plan);
  }
  return { v: STW_LEARN_VERSION, plans, stats: data.stats, tagStats: data.tagStats, foeTags: data.foeTags };
}

/** 승패 [경기, 승]의 낙관적 점수: 적게 해 본 선택에 기회를 준다(UCB). 기본 성향은 아무 기록이 없으면 0.5. */
function score(entry, total) {
  const [games, wins] = entry ?? [0, 0];
  return (wins + 1) / (games + 2) + 0.2 * Math.sqrt(Math.log(total + 2) / (games + 1));
}

/**
 * 최상급 AI의 전략 고르기. 후보는 그 종족의 기본 성향과, 그 종족으로 이긴 사람을 따라 한 계획.
 * 상대가 자주 쓰는 전략 꼬리표가 있으면 그 꼬리표에서의 승패를 더 무겁게 본다. rand(0~1)는 엔진의 결정적 난수.
 * 돌려주는 값: { persona, plan } (plan이 있으면 그 계획을 밟는다).
 */
export function stwLearnPick(snapshot, aiRace, foeRace, rand, map = "plain") {
  const personas = Object.values(STW_AI_PERSONAS).filter((persona) => persona.race === aiRace || (!persona.race && aiRace === "protoss")).map((persona) => persona.id);
  const plans = (snapshot?.plans ?? []).filter((plan) => plan.race === aiRace);
  const choices = [...personas.map((id) => ({ key: id, persona: id, plan: null })), ...plans.map((plan) => ({ key: `plan:${plan.id}`, persona: plan.base, plan }))];
  const overall = mapTable(snapshot?.stats, `${aiRace}|${foeRace}`, map);
  const tagCounts = snapshot?.foeTags?.[foeRace] ?? {};
  const likelyTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const byTag = likelyTag ? mapTable(snapshot?.tagStats, `${aiRace}|${foeRace}|${likelyTag}`, map) : {};
  const total = Object.values(overall).reduce((sum, [games]) => sum + games, 0);
  let best = null;
  let bestScore = -Infinity;
  for (const choice of choices) {
    // 따라 하기 계획은 사람이 이긴 운영이라 처음에 조금 더 믿어 준다.
    const prior = choice.plan ? 0.08 : 0;
    const tagged = byTag[choice.key] ? score(byTag[choice.key], total) : null;
    const value = (tagged === null ? score(overall[choice.key], total) : tagged * 0.6 + score(overall[choice.key], total) * 0.4) + prior + rand() * 0.06;
    if (value > bestScore) {
      bestScore = value;
      best = choice;
    }
  }
  return best ?? { persona: personas[0], plan: null };
}

/**
 * 정찰로 짐작한 상대 꼬리표에서, 지금 전략보다 확실히 나은 선택이 있으면 그것을 돌려준다(없으면 null).
 * 3판 이상 해 보고 승률이 25%p 넘게 높아야 바꾼다(적은 판으로 바꾸면 운에 휘둘린다).
 */
export function stwLearnSwitch(snapshot, aiRace, foeRace, tag, currentKey, map = "plain") {
  const table = mapTable(snapshot?.tagStats, `${aiRace}|${foeRace}|${tag}`, map);
  if (!Object.keys(table).length) return null;
  const rate = ([games, wins]) => (wins + 1) / (games + 2);
  const current = rate(table[currentKey] ?? [0, 0]);
  let best = null;
  for (const [key, entry] of Object.entries(table)) {
    if (key === currentKey || entry[0] < 3 || rate(entry) < current + 0.25) continue;
    if (!best || rate(entry) > rate(table[best])) best = key;
  }
  if (!best) return null;
  if (best.startsWith("plan:")) {
    const plan = (snapshot.plans ?? []).find((item) => `plan:${item.id}` === best && item.race === aiRace);
    return plan ? { key: best, persona: plan.base, plan } : null;
  }
  return STW_AI_PERSONAS[best] ? { key: best, persona: best, plan: null } : null;
}
