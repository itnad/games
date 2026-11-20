import {
  MUDFLAT_GENERAL_UPGRADES,
  MUDFLAT_RECOVERY_FOODS,
  MUDFLAT_RETURN_GUIDE_SECONDS,
  MUDFLAT_RUN_SECONDS,
  MUDFLAT_SHOP_EQUIPMENT,
  mudflatAdvancedSkillUnlocks,
  mudflatEquipmentPrice,
  mudflatEquipmentStats,
  mudflatTrainingPrice,
} from "./mudflat-survivor-engine.js";

export const MUDFLAT_SUPERVISOR_DECISION_SECONDS = .16;
export const CLAM_DIG_SECONDS = 2;
export const GAEBUL_DIG_SECONDS = 3.1;

const MOSQUITO_REPELLENT_KEY = "mosquitoRepellent";
const MOSQUITO_REPELLENT_PRICE = 100;
const FULL_HEAL_PRICE = MUDFLAT_RECOVERY_FOODS.find((item) => item.heal === Infinity)?.price ?? 110;
const EQUIPMENT_PRIORITY = ["vest", "gloves", "waders", "cooler", "headlamp"];
const MIN_PICKUP_CHASE_RANGE = 150;
export const MUDFLAT_SUPERVISOR_CLAM_SEARCH_RANGE = 720;

const DEFAULT_TONG_REACH = 84;
const DEFAULT_TONG_ROTATION_SPEED = 1.55;
// 집게 끝이 생물을 건드리는 반경(생물 크기 + 10)과 접촉 피해 반경(생물 크기 + 17)은 실제 원정 규칙과 같다.
const TONG_TIP_HIT_MARGIN = 10;
const CONTACT_MARGIN = 17;
const ROUTE_CELL = 26;
const ROUTE_MARGIN = 208;
const ROUTE_MAX_CELLS = 60;
const ROUTE_REPLAN_SECONDS = .48;
const ROUTE_ROCK_CLEARANCE = 30;
const ROUTE_LOOKAHEAD = 170;
const NO_PROGRESS_SECONDS = 4.5;
const NO_PROGRESS_STEP = 10;
const UNREACHABLE_BLOCK_SECONDS = 20;
const NO_PROGRESS_BLOCK_SECONDS = 15;
const HP_STALL_BLOCK_SECONDS = 14;
const CHASE_BLOCK_SECONDS = 10;
const CHASE_LIMIT = 520;
const HEADING_HYSTERESIS = 16;
// 쫓아오는 목표: 상대가 다가오는 속도에 맞춰 물러나며 집게가 닿는 거리를 지킨다.
const KITE_MIN_APPROACH = 10;        // 초당 이만큼 넘게 다가오면 "쫓아온다"고 본다(px/s)
const KITE_GAIN = 3;                 // 지킬 거리에서 벗어난 1px마다 더하는 후퇴 속도(px/s)
const KITE_ENGAGE_SECONDS = 2.8;     // 복어·보스가 이 시간 안에 닿을 거리면 하던 일을 두고 먼저 상대한다(호미질 2초 + 여유)
const KITE_BREAK_GAP = 14;           // 접촉 반경까지 남은 거리가 이보다 작으면 거리 맞추기를 그만두고 최대 속도로 벌린다
const KITE_SPEED_MARGIN = 1.04;      // 내 속도가 상대 접근 속도의 이 배수에 못 미치면(느린 지형) 최대 속도로 벌린다
const KITE_CAUTIOUS_INSET = 10;      // 복어·보스는 구간 바깥 끝에서 이만큼 안쪽을 지킨다(접촉 여유를 크게)
const KITE_CONTACT_PAD = 10;         // 상대하는 복어·보스의 접촉 반경 바깥에 두는 금지 여유
const KITE_ANGLES = [0, 15, -15, 30, -30, 45, -45, 60, -60, 75, -75];
const KITE_ESCAPE_ANGLES = [...KITE_ANGLES, 95, -95, 115, -115];
const KITE_HORIZON = .6;             // 물러날 방향을 고를 때 내다보는 시간(초)
const KITE_SLOW_AHEAD_PENALTY = 900; // 그 너머가 느린 지형이면 들어가지 않게 하는 벌점
const RETURN_TERRAIN_WEIGHT = 20;    // 귀환·대피 때의 느린 지형 벌점(평소 260)
const DEFAULT_PLAYER_SPEED = 155;
const TONG_TRAINING_TARGET_LEVEL = 3;
const KITE_GRAB_MIN_XP = 5;          // 복어를 상대하는 사이에도 먼저 주울 만한 경험치(복어 7, 큰 게 6~10)
const KITE_GRAB_GAP = 35;            // 주우러 간 자리에서 추격자의 접촉 반경까지 남아야 하는 거리
const KITE_GRAB_RANGE = 240;         // 큰 경험치를 주우러 가는 최대 거리
const PICKUP_CROWD_GAP = 26;         // 줍는 자리에서 일반 게의 접촉 반경까지 남아야 하는 거리(무리 속 보상은 고르지 않는다)
const PICKUP_SWEEP_RANGE = 520;      // 경험치가 많이 떨어진 자리로 돌아가는 최대 거리(둘레 180px의 경험치 × 10px까지)
const PICKUP_FIELD_RADIUS = 180;     // 한 번 가면 이어서 주울 수 있는 둘레
const FRONT_CRAB_RANGE = 70;         // 집게 구간 바깥으로 이만큼 안에 들어온 쫓는 게는 맨 앞부터 상대한다
const FRONT_SWITCH_GAP = 12;         // 다른 게가 이만큼 더 가까워지면 그 게로 바꾼다
const DIG_START_MARGIN = .4;         // 호미질을 시작하려면 끝낼 시간에 더해 이만큼(초) 여유가 있어야 한다
const DIG_KEEP_MARGIN = .1;          // 시작한 호미질은 이 여유만 남아도 끝낸다
const BOSS_SYNC_GAIN = 2.5;          // 집게가 보스 위에 있을 때, 중심에서 벗어난 각도를 되돌리는 세기(1/s)
const BOSS_GIVE_UP_SECONDS = 9;      // 이만큼 상대해 본 뒤, 돌아가야 할 때까지 잡을 속도가 안 나오면 그만둔다
const BOSS_GIVE_UP_RATIO = 1.8;      // 남은 체력이 "지금 속도 × 남은 시간"의 이 배수를 넘으면 가망 없음
const BOSS_MIN_HP_RATIO = .3;        // 내 체력이 이 비율 아래면 대왕 박하지를 상대하지 않는다
const BOSS_DEADLINE = MUDFLAT_RUN_SECONDS - MUDFLAT_RETURN_GUIDE_SECONDS; // 귀환 알림이 뜨면 대왕 박하지를 두고 돌아간다
const CAMP_RUSH_SLACK = 3;           // 밀물까지 남은 시간에서 직선 귀환 시간을 뺀 여유가 이보다 적으면 게를 스치며 곧장 간다

const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const normalized = (x, y) => {
  const length = Math.hypot(x, y);
  return length > .001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};

/**
 * 감독 AI가 판단 사이에 기억하는 것: 임시로 포기한 목표(블랙리스트), 계획한 경로, 진전 기록, 추격 중인 게의 체력 기록, 직전 진행 방향.
 * 게임은 원정마다 하나를 만들어 매 판단에 넘긴다. 넘기지 않으면 판단마다 새로 만들어 예전처럼 기억 없이 움직인다.
 */
export function createMudflatSupervisorMemory() {
  return { blocked: new Map(), route: null, progress: null, chases: new Map(), escapeTarget: null, heading: { x: 0, y: 0 }, headingKey: null, tracks: new Map(), boss: null };
}

const targetKey = (kind, item) => `${kind}:${item.id ?? `${Math.round(item.x)},${Math.round(item.y)}`}`;
const isCautious = (creature) => creature.type === "pufferfish" || Boolean(creature.boss);
const isHighRisk = (creature) => Boolean(creature.uncollectible) || isCautious(creature);
const liveCreature = (creature) => creature.hp > 0 && (creature.emergeSeconds ?? 0) <= 0;

/** 판단 사이에 생물이 움직인 거리로 "플레이어 쪽으로 다가오는 속도"(px/s)를 잰다. 처음 본 생물은 아직 값이 없다. */
function updateCreatureTracks(state, memory, elapsed) {
  const tracks = memory.tracks ?? (memory.tracks = new Map());
  const seen = new Set();
  for (const creature of state.creatures) {
    if (creature.id === undefined || !liveCreature(creature)) continue;
    seen.add(creature.id);
    const previous = tracks.get(creature.id);
    const seconds = previous ? elapsed - previous.at : -1;
    // 같은 순간에 다시 판단할 때(목표를 풀고 재판단)는 기록을 그대로 둔다.
    if (previous && seconds >= 0 && seconds < .04) continue;
    let approach;
    if (previous && seconds > 0 && seconds < 1.5) {
      const toward = normalized(state.player.x - creature.x, state.player.y - creature.y);
      const measured = ((creature.x - previous.x) * toward.x + (creature.y - previous.y) * toward.y) / seconds;
      approach = previous.approach === undefined ? measured : previous.approach * .45 + measured * .55;
    }
    tracks.set(creature.id, { x: creature.x, y: creature.y, at: elapsed, approach });
  }
  for (const id of tracks.keys()) if (!seen.has(id)) tracks.delete(id);
}

/** 생물이 플레이어 쪽으로 다가오는 속도. 아직 재지 못했으면 움직임 종류로 짐작한다(돌진 복어와 쫓는 게는 제 속도로 온다). */
function approachSpeed(memory, creature) {
  const measured = memory.tracks?.get(creature.id)?.approach;
  if (measured !== undefined) return measured;
  const chases = creature.eventKind === "puffer-rush" || (creature.type !== "pufferfish" && creature.movement === "chase");
  return chases ? Math.max(0, Number(creature.speed) || 0) : 0;
}

/**
 * 일반 게를 집게로 잡는 거리 구간. 집게 끝은 몸에서 reach만큼 떨어진 원을 돌고, 끝이 생물 크기 + 10 안에 들어야 맞는다.
 * 그래서 생물과의 거리가 reach ± (크기 + 10) 안일 때만 타격할 수 있다. 안쪽 끝은 접촉 피해 반경(크기 + 17)보다 넉넉히 바깥이어야 한다.
 * 집게가 없으면(reach 0) 예전 고정 거리 76 ± 7을 쓴다.
 */
export function mudflatSupervisorAttackBand(creature, tongReach) {
  if (!(tongReach > 0)) return { inner: 69, outer: 83, center: 76 };
  const hitHalf = creature.size + TONG_TIP_HIT_MARGIN;
  const inner = Math.max(tongReach - hitHalf + 6, creature.size + CONTACT_MARGIN + 16);
  const outer = Math.max(inner + 8, tongReach + hitHalf - 6);
  return { inner, outer, center: (inner + outer) / 2 };
}

function targetForState(state, memory) {
  // 쫓아오는 위험 생물(복어·보스·채집 불가): 귀환·대피 때는 이들의 넓은 위험 벽을 접촉 반경 바로 바깥으로 줄인다.
  // 벽을 그대로 두면 뒤에서 쫓아오는 복어를 피하느라 캠프 반대쪽으로 달아나 귀환에 실패한다.
  const pursuerIds = new Set(state.creatures
    .filter((item) => liveCreature(item) && isHighRisk(item) && approachSpeed(memory, item) >= KITE_MIN_APPROACH)
    .map((item) => item.id));
  // 귀환: 알림이 뜨면 하던 일(대왕 박하지 포함)을 두고 돌아간다. 알림 뒤에 보스를 마저 잡게 했을 때는, 보스 곁에 몰린 게
  // 수십 마리를 돌아 나오느라 240초를 넘겨 밀물에 쓰러졌다(밀물이 시작되면 이동 속도가 0.2배가 된다).
  if (state.baseCampGuideShown) {
    const returnSpeed = Math.max(40, Number(state.playerSpeed) || Number(state.player.speed) || DEFAULT_PLAYER_SPEED);
    const slack = MUDFLAT_RUN_SECONDS - state.elapsed - distance(state.player, state.baseCamp) / returnSpeed;
    // 여유가 줄면 서두른다: 일반 게는 접촉 반경 바로 바깥만 피하고(무리 벌점과 우회 경로 비용을 걷어낸다) 곧장 캠프로 간다.
    // 게에 한두 번 닿는 피해보다 밀물을 맞는 피해가 훨씬 크다.
    const rush = slack < CAMP_RUSH_SLACK;
    return {
      kind: "camp", point: state.baseCamp, intent: "베이스캠프로 귀환 중", desiredDistance: 0, kiteIds: pursuerIds, terrainWeight: RETURN_TERRAIN_WEIGHT,
      ...(rush ? { rush: true, crowdSoft: { range: 10, weight: 4 } } : {}),
    };
  }
  if (state.secondsToTide <= 5.2 && state.safeZone) {
    return { kind: "safe-zone", point: state.safeZone, intent: "돌발 물살 대피 중", desiredDistance: 18, kiteIds: pursuerIds, terrainWeight: RETURN_TERRAIN_WEIGHT };
  }
  if ((state.emptySeafoodRisk ?? 0) >= 7.5) {
    let retreat = normalized(state.retreatDirection?.x ?? -state.player.x, state.retreatDirection?.y ?? -state.player.y);
    if (Math.hypot(retreat.x, retreat.y) < .001) {
      const angle = state.stage * 1.91 + .7;
      retreat = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    return {
      kind: "seafood-search",
      point: { x: state.player.x + retreat.x * 280, y: state.player.y + retreat.y * 280 },
      intent: "해산물이 보이는 곳으로 되돌아가는 중",
      desiredDistance: 0,
    };
  }

  // 잠시 포기한 목표(도달 불가, 진전 없음, 체력이 줄지 않는 게, 너무 멀리 끌려간 추격)는 풀릴 때까지 고르지 않는다.
  const allowed = (kind, item) => !memory.blocked.has(targetKey(kind, item));
  const collectible = state.creatures.filter((item) => item.hp > 0 && !item.uncollectible && (item.emergeSeconds ?? 0) <= 0 && allowed("creature", item));
  const workIsSafe = state.creatures.every((item) => {
    if (item.hp <= 0 || (item.emergeSeconds ?? 0) > 0) return true;
    const highRisk = item.uncollectible || item.type === "pufferfish" || item.boss;
    return distance(state.player, item) > item.size + (highRisk ? 170 : 72);
  });
  const workPointIsSafe = (point) => state.creatures.every((item) => {
    if (item.hp <= 0 || (item.emergeSeconds ?? 0) > 0) return true;
    const highRisk = item.uncollectible || item.type === "pufferfish" || item.boss;
    return distance(point, item) > item.size + (highRisk ? 190 : 88);
  });
  const holeHasClearApproach = (hole) => state.rocks.every((rock) => distance(hole, rock) > rock.radius + 54);
  const playerSpeed = Math.max(40, Number(state.playerSpeed) || Number(state.player.speed) || DEFAULT_PLAYER_SPEED);
  // 호미질 안전 판정: 구멍 앞까지 걸어가는 시간 + 남은 호미질 시간 동안 어떤 생물도 그 자리에 닿지 못해야 한다.
  // 예전에는 게가 72px(구멍은 88px) 안에 있으면 무조건 멈춰, 0.5초 남은 호미질을 버리거나 가던 구멍을 자꾸 바꿨다.
  const holeIsWorkable = (hole, margin) => {
    const range = distance(state.player, hole);
    const walk = Math.max(0, range - 24);
    const stand = range <= 30 ? state.player
      : { x: hole.x + (state.player.x - hole.x) / range * 24, y: hole.y + (state.player.y - hole.y) / range * 24 };
    const seconds = walk / playerSpeed + Math.max(0, (hole.kind === "gaebul" ? GAEBUL_DIG_SECONDS : CLAM_DIG_SECONDS) - (hole.progress || 0)) + margin;
    return state.creatures.every((item) => {
      if (!liveCreature(item)) return true;
      const approach = Math.max(0, approachSpeed(memory, item));
      const gap = distance(stand, item) - item.size - CONTACT_MARGIN;
      // 복어·보스·채집 불가: 다가오지 않아도 넓게 비운다. 다가오면 그 시간 동안 올 거리까지 더 비운다.
      if (isHighRisk(item)) return gap > Math.max(170, approach >= KITE_MIN_APPROACH ? approach * seconds + 40 : 0);
      // 쫓아오지 않는 생물(떠도는 새우 등)은 어디로 갈지 몰라 고정 여유를 둔다.
      if (approach < KITE_MIN_APPROACH) return gap > (margin >= DIG_START_MARGIN ? 46 : 20);
      return gap - approach * seconds > 6;
    });
  };
  const lockedHoleId = state.lockedTargetKind === "clam" ? state.lockedTargetId : null;
  const holeMargin = (hole) => (hole.progress > 0 || hole.id === lockedHoleId) ? DIG_KEEP_MARGIN : DIG_START_MARGIN;
  for (const hole of state.clamHoles) {
    if (hole.progress > 0 && !holeIsWorkable(hole, DIG_KEEP_MARGIN)) memory.blocked.set(targetKey("clam", hole), state.elapsed + 1.25);
  }
  const safeHoles = state.clamHoles.filter((hole) => distance(state.player, hole) <= MUDFLAT_SUPERVISOR_CLAM_SEARCH_RANGE
    && holeHasClearApproach(hole) && allowed("clam", hole) && holeIsWorkable(hole, holeMargin(hole)));
  const nearestHole = safeHoles.length > 0
    ? safeHoles.reduce((nearest, item) => distance(state.player, item) < distance(state.player, nearest) ? item : nearest)
    : null;
  const activeHole = state.clamHoles
    .filter((item) => (item.progress ?? 0) > 0 && allowed("clam", item))
    .sort((left, right) => (right.progress ?? 0) - (left.progress ?? 0))[0] ?? null;
  const safeRocks = state.rocks.filter((item) => item.id !== undefined && workPointIsSafe(item));
  const availableRocks = safeRocks.filter((item) => allowed("rock", item));
  const activeRock = state.activeRockId === undefined || state.activeRockId === null
    ? null
    : safeRocks.find((item) => item.id === state.activeRockId) ?? null;
  const nearestRock = availableRocks.length > 0
    ? availableRocks.reduce((nearest, item) => distance(state.player, item) < distance(state.player, nearest) ? item : nearest)
    : null;
  const rockReach = Math.max(60, Number(state.rockReach) || 84);
  const clamTarget = (hole, hold = false) => ({
    kind: "clam", point: hole, targetId: hole.id, key: targetKey("clam", hole), hold,
    intent: !hold && distance(state.player, hole) > 30 ? "구멍으로 이동 중"
      : hole.kind === "gaebul" ? "개불 숨구멍 채집 중" : "조개구멍 호미질 중",
    desiredDistance: 20,
  });
  const rockTarget = (rock) => ({
    kind: "rock", point: rock, targetId: rock.id, targetRockId: rock.id, key: targetKey("rock", rock),
    intent: "돌뒤집개로 바위 확인 중",
    desiredDistance: Math.max(rock.radius + 28, rockReach - 8),
  });
  const tongReach = state.tongReach === undefined ? DEFAULT_TONG_REACH : Math.max(0, Number(state.tongReach) || 0);
  // 쫓아오는 복어·보스: 위험 벽 대신 집게가 닿는 거리에서 물러나며 상대한다(집게가 있을 때만).
  const chasers = tongReach > 0
    ? collectible.filter((item) => isCautious(item) && approachSpeed(memory, item) >= KITE_MIN_APPROACH)
    : [];
  const kiteIds = new Set(chasers.map((item) => item.id));
  const contactGap = (item) => distance(state.player, item) - item.size - CONTACT_MARGIN;
  const creatureTarget = (creature) => {
    const cautious = isCautious(creature);
    const approach = approachSpeed(memory, creature);
    const kite = tongReach > 0 && approach >= KITE_MIN_APPROACH;
    // 다가오지 않는 복어와 보스는 예전처럼 한 거리(132)를 지키고, 그 밖에는 지금 집게가 실제로 닿는 거리 구간에 머문다.
    const band = cautious && !kite ? null : mudflatSupervisorAttackBand(creature, tongReach);
    return {
      kind: "creature", point: creature, targetId: creature.id, key: targetKey("creature", creature), creature, band,
      kite, approach, kiteIds, cautious,
      // 복어·보스에게서 물러나는 걸음은 지형 감속을 예상 간격 계산에 직접 넣으므로 벌점으로는 다시 세지 않는다.
      // 느린 일반 게를 상대할 때는 벌점을 그대로 둔다: 깊은 펄·물골에 서서 게를 잡다가 돌진 복어를 만나면 따라잡힌다.
      ...(kite && cautious ? { terrainWeight: 0 } : {}),
      intent: kite ? `${creature.name} 물러나며 채집 중` : cautious ? `거리 유지 중 · ${creature.name}` : `${creature.name} 채집 중`,
      desiredDistance: !band ? 132 : cautious ? Math.max(band.inner + 4, band.outer - KITE_CAUTIOUS_INSET) : band.center,
    };
  };
  // 돌진해 오는 복어·보스가 곧 닿을 거리면 호미질·바위·경험치보다 먼저 상대한다. 멀리 있을 때는 하던 일을 계속한다.
  const threat = chasers
    .map((item) => ({ item, eta: (distance(state.player, item) - (item.size + CONTACT_MARGIN)) / approachSpeed(memory, item) }))
    .filter((entry) => entry.eta < KITE_ENGAGE_SECONDS)
    .sort((left, right) => left.eta - right.eta)[0];

  // 대왕 박하지: 나타나면 바로 다가가 집게 회전에 맞춰 둘레를 돌며 상대한다(귀환 알림 전까지만).
  // 가만히 서서 맞히면 집게가 한 바퀴에 잠깐만 닿아 240초 안에 잡을 수 없다. 돌진 복어가 닿을 거리면 복어부터 상대한다.
  const boss = tongReach > 0 ? collectible.find((item) => item.boss) : null;
  const playerHpRatio = (Number(state.player.hp) || 0) > 0 && (Number(state.player.maxHp) || 0) > 0 ? state.player.hp / state.player.maxHp : 1;
  if (boss && !(threat && !threat.item.boss) && state.elapsed < BOSS_DEADLINE && playerHpRatio >= BOSS_MIN_HP_RATIO) {
    const fight = memory.boss?.id === boss.id ? memory.boss : (memory.boss = { id: boss.id, hp: boss.hp, engaged: 0, at: state.elapsed, startHp: null });
    const band = mudflatSupervisorAttackBand(boss, tongReach);
    return {
      kind: "creature", point: boss, targetId: boss.id, key: targetKey("creature", boss), creature: boss, band,
      kite: true, approach: Math.max(0, approachSpeed(memory, boss)), kiteIds: new Set([...kiteIds, boss.id]), cautious: true,
      bossFight: fight, terrainWeight: 0, crowdSoft: { range: 34, weight: 5 },
      intent: `${boss.name} 둘레를 돌며 채집 중`,
      // 집게 끝이 보스 한가운데를 지나는 거리(가장 오래 닿는다). 접촉 반경(크기 + 17)보다는 넉넉히 바깥이다.
      desiredDistance: Math.max(tongReach, band.inner + 4),
    };
  }
  if (!boss) memory.boss = null;

  // 경험치 줍기. 경험치는 사라지지 않고, 줍는 반경에 한 번 들어가면 끌려오기 시작해 바로 돌아서도 따라 들어온다.
  // 그래서 반경에 닿는 자리까지만 다녀오면 된다. 그 자리에 닿을 때까지 어떤 생물도 접촉 반경 가까이 오지 못해야 고른다:
  // 게 무리 한가운데 떨어진 보상을 고르면 무리 벌점에 막혀 둘레만 돌다가 포기한다(실제 원정에서 1단계의 15%를 그렇게 썼다).
  // 무리가 나를 따라 자리를 뜨면 그때 안전해지므로, 돌아가서 줍는다.
  const digging = activeHole && distance(state.player, activeHole) <= 48;
  const pickupRadius = Number(state.pickupRadius) || 50;
  const pickupGoal = Math.max(0, pickupRadius - 6);
  const needsCollection = (item) => item.xp > 0 && ["idle", "spawn"].includes(item.phase ?? "idle")
    && distance(state.player, item) >= pickupRadius && allowed("pickup", item);
  const lockedPickupId = state.lockedTargetKind === "pickup" ? state.lockedTargetId : null;
  const safeToCollect = (item) => {
    const range = distance(state.player, item);
    const walk = Math.max(0, range - pickupGoal);
    const stand = { x: state.player.x + (item.x - state.player.x) / Math.max(1, range) * walk, y: state.player.y + (item.y - state.player.y) / Math.max(1, range) * walk };
    // 막 떨어진 경험치는 솟아오르는 동안(0.1초) 주울 수 없다. 방향을 바꾸는 데 드는 시간(0.2초)도 더한다.
    const seconds = walk / playerSpeed + (item.phase === "spawn" ? .1 : 0) + .2;
    // 이미 주우러 가는 중이면 여유를 조금 줄여, 안전 판정이 경계에서 오락가락하며 목표를 뒤집지 않게 한다.
    const ease = item.id === lockedPickupId ? 8 : 0;
    return state.creatures.every((creature) => {
      if (!liveCreature(creature)) return true;
      const approach = Math.max(0, approachSpeed(memory, creature));
      const gap = distance(stand, creature) - approach * seconds - (creature.size + CONTACT_MARGIN);
      if (!isHighRisk(creature)) return gap > PICKUP_CROWD_GAP - ease;
      // 다가오지 않는 복어·보스·채집 불가 생물은 넓은 위험 벽(크기 + 104) 바깥이어야 닿을 수 있다.
      return kiteIds.has(creature.id) ? gap > KITE_GRAB_GAP : distance(stand, creature) > creature.size + 112;
    });
  };
  if (!digging) {
    // 큰 경험치(복어·큰 게를 잡은 보상)는 복어를 상대하는 사이에도, 호미질보다도 먼저 줍는다(진행 중인 호미질은 끝낸다).
    const grabRange = Math.max(MIN_PICKUP_CHASE_RANGE, pickupRadius + 105, KITE_GRAB_RANGE);
    const grab = state.pickups
      .filter((item) => item.xp >= KITE_GRAB_MIN_XP && needsCollection(item)
        && distance(state.player, item) <= grabRange && safeToCollect(item))
      .sort((left, right) => distance(state.player, left) - distance(state.player, right))[0];
    if (grab) {
      return {
        kind: "pickup", point: grab, targetId: grab.id, key: targetKey("pickup", grab),
        intent: "잡은 경험치 회수 중", desiredDistance: pickupGoal, kiteIds, hurry: true,
      };
    }
  }
  if (threat) return creatureTarget(threat.item);
  // 작은 경험치: 가까운 것(150px 또는 줍는 반경 + 105)과, 더 멀어도 그 둘레(180px)에 경험치가 많이 떨어져 있을 때(경험치 × 10px,
  // 최대 520px). 작살·뜰채로 잡은 보상은 뒤따르던 게 무리의 자리에 남는데, 무리가 나를 따라 지나간 뒤에는 안전하게 주울 수 있다.
  // 복어·보스가 쫓아오는 동안에는 줍지 않는다: 주우러 들어간 자리에서 물러날 길이 막힌다(실제 원정에서 복어 접촉이 늘었다).
  const pickupChaseRange = Math.max(MIN_PICKUP_CHASE_RANGE, pickupRadius + 105);
  const collectable = chasers.length > 0 ? [] : state.pickups.filter((item) => needsCollection(item) && distance(state.player, item) <= PICKUP_SWEEP_RANGE);
  const livePickups = collectable
    .map((item) => {
      let cluster = 0;
      let field = 0;
      for (const other of collectable) {
        const gap = distance(item, other);
        if (gap < pickupRadius * .8) cluster += other.xp;
        if (gap < PICKUP_FIELD_RADIUS) field += other.xp;
      }
      return { item, cluster, field, range: distance(state.player, item) };
    })
    .filter((entry) => (entry.range <= pickupChaseRange || entry.field * 10 > entry.range) && safeToCollect(entry.item));
  const pickupTarget = (pickup) => ({
    kind: "pickup", point: pickup, targetId: pickup.id, key: targetKey("pickup", pickup),
    intent: "가까운 경험치 회수 중", desiredDistance: pickupGoal,
    // 안전 판정은 전속력으로 다녀오는 시간으로 계산했다. 천천히 다가가면 그 사이 게가 먼저 온다.
    hurry: true,
  });

  // Finish a started field action before selecting fresh work, provided the
  // surrounding area remains clear. This gives the two-second dig/flip actions
  // enough uninterrupted time while still yielding immediately to danger.
  // 호미질이 진행 중이면 그 자리에 그대로 선다: 서 있는 동안 사거리 안의 바위 뒤집기도 함께 진행된다(둘을 서로 막지 않는다).
  if (activeHole && holeIsWorkable(activeHole, DIG_KEEP_MARGIN)) return clamTarget(activeHole, distance(state.player, activeHole) <= 48);

  // 쫓아오는 일반 게는 맨 앞(접촉까지 가장 가까운) 게부터 상대한다. 값이 높은 먼 게를 고르면 앞의 게를 피하느라
  // 집게가 닿지 않는 거리로 밀려난다. 한번 고른 게는 다른 게가 뚜렷이 더 가까워질 때까지 바꾸지 않는다.
  const frontCrab = tongReach > 0
    ? collectible
      .filter((item) => !isCautious(item) && approachSpeed(memory, item) >= KITE_MIN_APPROACH
        && distance(state.player, item) <= mudflatSupervisorAttackBand(item, tongReach).outer + FRONT_CRAB_RANGE)
      .reduce((best, item) => !best || contactGap(item) < contactGap(best) ? item : best, null)
    : null;

  // A selected target remains stable for a short action window. Re-evaluating
  // the nearest entity every 160 ms made the heading alternate between equally
  // attractive holes and drops, which looked like the gatherer was vibrating.
  if (state.lockedTargetId !== undefined && state.lockedTargetId !== null) {
    if (state.lockedTargetKind === "pickup") {
      const pickup = livePickups.find((entry) => entry.item.id === state.lockedTargetId)?.item;
      if (pickup) return pickupTarget(pickup);
    }
    if (state.lockedTargetKind === "rock" && workIsSafe && (state.rockerLevel ?? 0) > 0) {
      const rock = availableRocks.find((item) => item.id === state.lockedTargetId);
      if (rock) return rockTarget(rock);
    }
  }

  // 안전하게 닿는 경험치는 구멍으로 걸어가는 것보다 먼저 줍는다: 1초 안팎이면 되고, 구멍(조개 1~3)보다 보상이 크다.
  if (livePickups.length > 0) {
    const pickup = livePickups.reduce((best, entry) => {
      const value = entry.cluster * 18 + entry.field * 2 - entry.range;
      return !best || value > best.value ? { item: entry.item, value } : best;
    }, null)?.item;
    if (pickup) return pickupTarget(pickup);
  }

  if (state.lockedTargetId !== undefined && state.lockedTargetId !== null) {
    if (state.lockedTargetKind === "clam") {
      const hole = safeHoles.find((item) => item.id === state.lockedTargetId);
      if (hole) return clamTarget(hole);
    }
    if (state.lockedTargetKind === "creature") {
      const creature = collectible.find((item) => item.id === state.lockedTargetId);
      // 체력이 줄고 있는 게는 끝까지 잡는다(고정 시간 4초는 집게 한 바퀴뿐이라 농게·민꽃게는 그 안에 못 잡는다).
      if (creature && frontCrab && frontCrab !== creature && !isCautious(creature) && contactGap(frontCrab) < contactGap(creature) - FRONT_SWITCH_GAP) return creatureTarget(frontCrab);
      if (creature) return creatureTarget(creature);
    }
  }

  // Rock turning may run at the same time as hoe work. It becomes the movement
  // target only when there is no active or locked hoe commitment to preserve.
  if (workIsSafe && activeRock) return rockTarget(activeRock);

  // 때리던 게가 아직 집게 구간 근처에 있으면 마저 잡는다(고정 시간이 풀려도 다른 일로 넘어가지 않는다).
  const wounded = tongReach > 0 ? collectible
    .filter((item) => !isCautious(item) && memory.chases.get(item.id)?.hit && memory.chases.get(item.id).unproductive < 6
      && distance(state.player, item) <= mudflatSupervisorAttackBand(item, tongReach).outer + 40)
    .reduce((best, item) => !best || contactGap(item) < contactGap(best) ? item : best, null) : null;
  if (wounded) return creatureTarget(frontCrab && contactGap(frontCrab) < contactGap(wounded) - FRONT_SWITCH_GAP ? frontCrab : wounded);

  // Hoe work is the supervisor's default safe activity. Keeping the nearest
  // local hole ahead of creatures and fresh rock work prevents combat
  // rewards from repeatedly stealing the two-second digging window.
  if (nearestHole) return clamTarget(nearestHole);

  if (frontCrab) return creatureTarget(frontCrab);

  // Rotate ordinary gathering and learned rock turning after all safe nearby
  // hoe work has been exhausted.
  const workPhase = Math.floor(Math.max(0, state.elapsed) / 7) % 3;
  if (workIsSafe && workPhase === 1 && (state.rockerLevel ?? 0) > 0 && nearestRock) return rockTarget(nearestRock);

  if (collectible.length > 0) {
    const creature = collectible.reduce((best, item) => {
      const range = distance(state.player, item);
      const dangerPenalty = item.type === "pufferfish" ? 320 : item.boss ? 180 : 0;
      const value = (item.xp ?? 0) * 42 + (item.score ?? 0) * .16 + (item.boss ? 260 : 0) - range - dangerPenalty;
      return !best || value > best.value ? { item, value } : best;
    }, null)?.item;
    if (creature) return creatureTarget(creature);
  }

  if (nearestHole) return clamTarget(nearestHole);
  if ((state.rockerLevel ?? 0) > 0 && nearestRock) return rockTarget(nearestRock);

  const angle = state.elapsed * .31 + state.stage * 1.73;
  return {
    kind: "explore",
    point: { x: state.player.x + Math.cos(angle) * 180, y: state.player.y + Math.sin(angle) * 180 },
    intent: "해산물을 찾아 이동 중",
    desiredDistance: 0,
  };
}

function hazardPenalty(point, state, target, routed = false) {
  // 느린 지형(물골·깊은 펄) 벌점. 귀환·대피는 물골 건너편에 있어도 반드시 가야 하므로 작게 준다: 크게 주면 폭 64px 물골을
  // 건너는 한 걸음의 벌점(약 1,180)이 귀환 진전 점수(약 310)를 넘어, 물골을 따라 캠프 반대쪽으로 올라가다 귀환에 실패했다.
  let penalty = Math.max(0, Number(state.terrainRisk?.(point)) || 0) * (target.terrainWeight ?? 260);
  // 경로를 미리 계획한 목표는 경로가 바위와의 간격을 이미 지킨다. 넓은 여유(84)를 그대로 두면 바위 근처의 구멍으로
  // 다가가는 걸음마다 벌점이 진전 점수를 넘어, 제자리에 서거나 좌우로 방향만 뒤집었다.
  const rockMargin = routed ? 26 : 84;
  for (const rock of state.rocks) {
    const isTarget = target.targetRockId === rock.id;
    const gap = distance(point, rock) - (rock.radius + 24);
    if (gap <= 0) penalty += 12000;
    else if (!isTarget && gap < rockMargin) penalty += (rockMargin - gap) * 7;
  }
  for (const falling of state.fallingRocks) {
    const progress = Math.max(0, Math.min(1, 1 - falling.life / Math.max(.001, falling.maxLife)));
    const gap = distance(point, falling) - (falling.radius + 38 + progress * 42);
    if (gap <= 0) penalty += 18000 + progress * 12000;
    else if (gap < 90) penalty += (90 - gap) * (8 + progress * 12);
  }
  for (const creature of state.creatures) {
    if (creature.hp <= 0 || (creature.emergeSeconds ?? 0) > 0) continue;
    if (target.skipCautious && isCautious(creature)) continue;
    const isTarget = target.targetId === creature.id;
    // 물러나며 상대하는 복어·보스(와 귀환·대피 때 쫓아오는 위험 생물)는 넓은 위험 벽 대신 접촉 반경 바로 바깥만 막는다.
    const kited = Boolean(target.kiteIds?.has(creature.id));
    const highRisk = !kited && (creature.uncollectible || creature.type === "pufferfish" || creature.boss);
    const clearance = creature.size + (kited ? CONTACT_MARGIN + KITE_CONTACT_PAD : highRisk ? 104 : target.rush ? CONTACT_MARGIN + 3 : 25);
    const gap = distance(point, creature) - clearance;
    if (gap <= 0) {
      const overlapDepth = Math.min(clearance, -gap);
      penalty += (kited ? 9000 : highRisk ? 15500 : target.rush ? 1200 : (isTarget ? 2200 : 6800)) + overlapDepth * (highRisk || kited ? 240 : target.rush ? 60 : 160);
    }
    else if (kited) { if (gap < 36 && !(isTarget && target.bossFight)) penalty += (36 - gap) * 6; }
    else if (highRisk && gap < 90) penalty += (90 - gap) * 6;
    // 대왕 박하지 둘레를 돌 때는 따라온 게들이 보스 곁에 모이므로, 넓은 무리 벌점을 그대로 두면 보스에게서 밀려난다.
    else if (!isTarget && target.crowdSoft) { if (gap < target.crowdSoft.range) penalty += (target.crowdSoft.range - gap) * target.crowdSoft.weight; }
    else if (!isTarget && gap < 96) penalty += (96 - gap) * (routed && !highRisk ? 1.5 : 6.5);
  }
  return penalty;
}

function routeHazardPenalty(start, end, state, target, routed = false) {
  let penalty = 0;
  const gatheringRoute = routed && RELEASABLE_KINDS.has(target.kind) && !target.kiteIds?.size;
  // The supervisor applies one direction for several rendered frames. Sampling
  // the route prevents a seemingly safe endpoint on the far side of a crab or
  // rock from authorising a movement that crosses through the obstacle first.
  for (let index = 1; index <= 6; index += 1) {
    const progress = index / 6;
    const sample = hazardPenalty({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    }, state, target, routed);
    penalty = gatheringRoute ? Math.max(penalty, sample) : penalty + sample;
  }
  return penalty;
}

/**
 * 플레이어에서 목표까지의 전체 경로를 격자 A*로 찾는다. 바위(반경 + 여유)와 위험 생물(복어·보스·채집 불가)의 둘레는 막힌 칸이고,
 * 깊은 펄·물골과 바위 가까운 칸은 비용이 더 든다. 목표 둘레 goalRadius 안의 열린 칸에 닿으면 도달이다.
 * 돌려주는 값: { reachable, points(플레이어 다음 칸부터 목표까지), blockedAt(point) }.
 */
function planRoute(state, target, goalRadius) {
  const start = state.player;
  const goal = target.point;
  const span = Math.max(Math.abs(goal.x - start.x), Math.abs(goal.y - start.y)) + ROUTE_MARGIN * 2;
  const cell = Math.max(ROUTE_CELL, span / ROUTE_MAX_CELLS);
  const minX = Math.min(start.x, goal.x) - ROUTE_MARGIN;
  const minY = Math.min(start.y, goal.y) - ROUTE_MARGIN;
  const cols = Math.ceil((Math.max(start.x, goal.x) + ROUTE_MARGIN - minX) / cell) + 1;
  const rows = Math.ceil((Math.max(start.y, goal.y) + ROUTE_MARGIN - minY) / cell) + 1;
  const rocks = state.rocks.map((rock) => ({ x: rock.x, y: rock.y, clear: rock.radius + (target.targetRockId === rock.id ? 17 : ROUTE_ROCK_CLEARANCE) }));
  // 상대하는 추격자는 계속 움직이므로 넓게 막지 않고 접촉 반경 둘레만 막는다.
  const risky = state.creatures.filter((creature) => liveCreature(creature) && isHighRisk(creature) && creature.id !== target.targetId)
    .map((creature) => ({ x: creature.x, y: creature.y, clear: creature.size + (target.kiteIds?.has(creature.id) ? CONTACT_MARGIN + KITE_CONTACT_PAD : 70) }));
  const blockedAt = (point) => rocks.some((rock) => distance(point, rock) < rock.clear) || risky.some((creature) => distance(point, creature) < creature.clear);
  const center = (col, row) => ({ x: minX + col * cell, y: minY + row * cell });
  const size = cols * rows;
  const cost = new Float32Array(size);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const point = center(col, row);
      if (blockedAt(point)) { cost[row * cols + col] = Infinity; continue; }
      let extra = Math.max(0, Number(state.terrainRisk?.(point)) || 0) * 2.5;
      for (const rock of rocks) {
        const gap = distance(point, rock) - rock.clear;
        if (gap < 40) extra += (40 - gap) / 40;
      }
      cost[row * cols + col] = 1 + extra;
    }
  }
  const toCell = (point) => ({
    col: Math.max(0, Math.min(cols - 1, Math.round((point.x - minX) / cell))),
    row: Math.max(0, Math.min(rows - 1, Math.round((point.y - minY) / cell))),
  });
  // 이동 중인 일반 게는 지나갈 수 있는 칸으로 두되, 가까이 스치는 경로에는 비용을 더한다.
  const crowd = new Float32Array(size);
  for (const creature of state.creatures) {
    if (target.rush || !liveCreature(creature) || isHighRisk(creature)) continue;
    const reach = creature.size + 100;
    const first = toCell({ x: creature.x - reach, y: creature.y - reach });
    const last = toCell({ x: creature.x + reach, y: creature.y + reach });
    for (let row = first.row; row <= last.row; row++) {
      for (let col = first.col; col <= last.col; col++) {
        const gap = distance(center(col, row), creature) - creature.size - 25;
        const weight = gap < 0 ? 14 : Math.max(0, 1 - gap / 75) * 4;
        crowd[row * cols + col] += weight;
        cost[row * cols + col] += weight;
      }
    }
  }
  const crowdAt = (point) => {
    const { row, col } = toCell(point);
    return crowd[row * cols + col];
  };
  const startCell = toCell(start);
  const startIndex = startCell.row * cols + startCell.col;
  // 이미 막힌 칸 안에 서 있어도(위험을 피하는 중) 거기서 빠져나오는 경로를 찾는다.
  if (!Number.isFinite(cost[startIndex])) cost[startIndex] = 1;
  const reach = Math.max(goalRadius, cell * .75);
  const isGoal = (index) => {
    const point = center(index % cols, Math.floor(index / cols));
    return distance(point, goal) <= reach;
  };
  const heuristic = (index) => Math.max(0, distance(center(index % cols, Math.floor(index / cols)), goal) - reach) / cell;
  const best = new Float32Array(size).fill(Infinity);
  const from = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  // 작은 이진 힙(열린 목록).
  const heap = [];
  const push = (index, priority) => {
    heap.push({ index, priority });
    let child = heap.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (heap[parent].priority <= heap[child].priority) break;
      [heap[parent], heap[child]] = [heap[child], heap[parent]];
      child = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < heap.length && heap[left].priority < heap[smallest].priority) smallest = left;
        if (right < heap.length && heap[right].priority < heap[smallest].priority) smallest = right;
        if (smallest === parent) break;
        [heap[parent], heap[smallest]] = [heap[smallest], heap[parent]];
        parent = smallest;
      }
    }
    return top;
  };
  best[startIndex] = 0;
  push(startIndex, heuristic(startIndex));
  let found = -1;
  while (heap.length > 0) {
    const { index } = pop();
    if (closed[index]) continue;
    closed[index] = 1;
    if (isGoal(index)) { found = index; break; }
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nextCol = col + dx;
        const nextRow = row + dy;
        if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rows) continue;
        const next = nextRow * cols + nextCol;
        if (closed[next] || !Number.isFinite(cost[next])) continue;
        // 대각선은 양옆 칸이 모두 열려 있을 때만 지난다(막힌 모서리를 스치지 않게).
        if (dx !== 0 && dy !== 0 && (!Number.isFinite(cost[row * cols + nextCol]) || !Number.isFinite(cost[nextRow * cols + col]))) continue;
        const step = (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1) * cost[next];
        const total = best[index] + step;
        if (total < best[next]) {
          best[next] = total;
          from[next] = index;
          push(next, total + heuristic(next));
        }
      }
    }
  }
  if (found < 0) return { reachable: false, points: [], blockedAt, cell };
  const points = [];
  for (let index = found; index !== startIndex && index >= 0; index = from[index]) points.push(center(index % cols, Math.floor(index / cols)));
  points.reverse();
  // 마지막 칸 중심 대신 실제 목표 지점까지 간다(목표가 열려 있을 때).
  if (!blockedAt(goal)) points.push({ x: goal.x, y: goal.y });
  return { reachable: true, points, blockedAt, crowdAt, cell };
}

/** 계획한 경로에서 지금 향할 지점: 플레이어에서 장애물 없이 바로 보이는 가장 먼 경로점(ROUTE_LOOKAHEAD 안)과, 거기서 목표까지 남은 길이. */
function routeWaypoint(player, route) {
  const clear = (end) => {
    const length = distance(player, end);
    const crowdLimit = Math.max(route.crowdAt(player), route.crowdAt(end)) + .5;
    const steps = Math.max(1, Math.ceil(length / (route.cell * .5)));
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      const sample = { x: player.x + (end.x - player.x) * progress, y: player.y + (end.y - player.y) * progress };
      if (route.blockedAt(sample) || route.crowdAt(sample) > crowdLimit) return false;
    }
    return true;
  };
  let chosen = 0;
  for (let index = 0; index < route.points.length; index += 1) {
    if (distance(player, route.points[index]) > ROUTE_LOOKAHEAD && index > 0) break;
    if (clear(route.points[index])) chosen = index;
  }
  let rest = 0;
  for (let index = chosen; index < route.points.length - 1; index += 1) rest += distance(route.points[index], route.points[index + 1]);
  return { point: route.points[chosen], rest, last: chosen === route.points.length - 1 };
}

const ROUTED_KINDS = new Set(["clam", "rock", "pickup", "camp", "safe-zone"]);
const RELEASABLE_KINDS = new Set(["clam", "rock", "pickup"]);

export function decideMudflatSupervisorMove(state) {
  const memory = state.memory ?? createMudflatSupervisorMemory();
  const elapsed = Number(state.elapsed) || 0;
  for (const [key, until] of memory.blocked) if (until <= elapsed) memory.blocked.delete(key);
  updateCreatureTracks(state, memory, elapsed);
  for (const id of memory.chases.keys()) if (!memory.tracks.has(id)) memory.chases.delete(id);
  // 무진전으로 목표를 풀고 다시 판단할 때는 앞에서 푼 기록을 이어받는다.
  const released = state.releasedSoFar ?? [];
  const release = (target, seconds, reason) => {
    memory.blocked.set(target.key, elapsed + seconds);
    released.push({ kind: target.kind, id: target.targetId ?? null, reason });
    memory.route = null;
    memory.progress = null;
    if (target.kind === "creature") memory.chases.delete(target.targetId);
  };

  let target = null;
  let route = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    target = targetForState(state, memory);
    route = null;
    // 추격하는 일반 게: 체력이 한동안 줄지 않거나(집게가 닿지 않는다) 처음 자리에서 너무 멀리 끌려갔으면 포기한다.
    if (target.kind === "creature" && target.band && !target.bossFight) {
      const creature = target.creature;
      let chase = memory.chases.get(creature.id);
      if (!chase) {
        chase = { hp: creature.hp, at: elapsed, unproductive: 0, origin: { ...state.player }, lastHit: { ...state.player } };
        memory.chases.set(creature.id, chase);
      }
      if (creature.hp < chase.hp - .01) {
        chase.hp = creature.hp;
        chase.unproductive = 0;
        chase.hit = true;
        chase.lastHit = { ...state.player };
      } else {
        chase.unproductive += Math.max(0, Math.min(MUDFLAT_SUPERVISOR_DECISION_SECONDS * 2, elapsed - chase.at));
      }
      chase.at = elapsed;
      const rotation = Math.max(.2, Number(state.tongRotationSpeed) || DEFAULT_TONG_ROTATION_SPEED);
      const stallSeconds = Math.max(9, (Math.PI * 2 / rotation) * 2.5);
      if (chase.unproductive > stallSeconds) { release(target, HP_STALL_BLOCK_SECONDS, "hp-stall"); continue; }
      if (distance(state.player, target.kite ? chase.lastHit : chase.origin) > CHASE_LIMIT) { release(target, CHASE_BLOCK_SECONDS, "chase-too-far"); continue; }
    }
    if (!ROUTED_KINDS.has(target.kind) || target.hold) break;
    // 전체 경로의 도달 가능성: 경로가 없으면 그 목표를 잠시 포기하고 다른 목표를 고른다(귀환·대피는 포기하지 않고 직진으로 돌아간다).
    const goalRadius = target.kind === "rock" || target.kind === "pickup" ? target.desiredDistance : target.kind === "clam" ? 22 : 30;
    const cached = memory.route;
    if (cached && cached.key === (target.key ?? target.kind) && elapsed - cached.at < ROUTE_REPLAN_SECONDS && elapsed >= cached.at
      && distance(cached.goal, target.point) < 20) route = cached.plan;
    else {
      route = planRoute(state, target, goalRadius);
      memory.route = { key: target.key ?? target.kind, at: elapsed, goal: { x: target.point.x, y: target.point.y }, plan: route };
    }
    if (route.reachable) break;
    route = null;
    if (!RELEASABLE_KINDS.has(target.kind)) break;
    release(target, UNREACHABLE_BLOCK_SECONDS, "unreachable");
  }

  const targetDistance = distance(state.player, target.point);
  const routed = Boolean(route?.reachable && route.points.length > 0);
  const waypoint = routed ? routeWaypoint(state.player, route) : { point: target.point, rest: 0, last: true };
  const currentDanger = hazardPenalty(state.player, state, target, routed);
  // 호미질 자리는 "끝낼 때까지 아무도 닿지 못한다"는 판정을 이미 통과했다. 멀리 있는 게들의 무리 벌점 합으로 다시 막지 않고,
  // 바위·낙석·접촉 반경 안으로 들어온 생물만 본다.
  const digSpot = target.kind === "clam" && targetDistance <= 48;
  const canHoldPosition = (digSpot ? hazardPenalty(state.player, state, { ...target, crowdSoft: { range: 0, weight: 0 } }, routed) : currentDanger) < 1000;
  if (!canHoldPosition && digSpot) {
    memory.blocked.set(target.key, elapsed + 1.25);
  }
  if (memory.escapeTarget !== target.key || !target.kite) memory.escapeTarget = null;
  const band = target.kind === "creature" ? target.band : null;
  const inBand = band ? targetDistance >= band.inner && targetDistance <= band.outer : false;
  const stay = (extra = {}) => ({
    x: 0, y: 0, intent: target.intent, targetKind: target.kind,
    targetId: target.targetId ?? null, targetPoint: target.point,
    targetDistance, desiredDistance: target.desiredDistance, danger: currentDanger, urgent: false, released, ...extra,
  });

  // 대왕 박하지: 집게 회전에 맞춰 둘레를 돈다. 집게 끝은 몸 둘레를 일정한 각속도로 돌고, 내가 보스 둘레를 돌면 보스가 보이는
  // 방향도 같이 돈다. 집게가 보스 위에 있을 때는 집게와 같은 쪽으로 돌아 오래 닿게 하고(각속도가 같으면 계속 닿는다),
  // 벗어났을 때는 다시 닿는 쪽으로 가장 빨리 돈다. 서서 맞힐 때(한 바퀴의 20%)보다 닿는 시간이 2~4배 길다.
  if (target.bossFight) {
    const creature = target.creature;
    const fight = target.bossFight;
    const playerSpeed = Math.max(40, Number(state.playerSpeed) || Number(state.player.speed) || DEFAULT_PLAYER_SPEED);
    const reach = Math.max(1, Number(state.tongReach) || DEFAULT_TONG_REACH);
    const hitHalf = creature.size + TONG_TIP_HIT_MARGIN;
    const contactRadius = creature.size + CONTACT_MARGIN;
    const hold = target.desiredDistance;
    const step = Math.max(0, Math.min(MUDFLAT_SUPERVISOR_DECISION_SECONDS * 2, elapsed - fight.at));
    fight.at = elapsed;
    if (targetDistance <= reach + hitHalf - 4) {
      if (fight.startHp === null) fight.startHp = creature.hp;
      fight.engaged += step;
    }
    // 가망 없음: 닿는 거리에서 충분히 상대해 봤는데, 지금 속도로는 귀환 알림 전에 못 잡는다.
    if (fight.engaged >= BOSS_GIVE_UP_SECONDS) {
      const rate = Math.max(0, fight.startHp - creature.hp) / fight.engaged;
      if (creature.hp > rate * Math.max(0, BOSS_DEADLINE - elapsed) * BOSS_GIVE_UP_RATIO) {
        release(target, 90, "boss-out-of-time");
        return decideMudflatSupervisorMove({ ...state, memory, lockedTargetKind: null, lockedTargetId: null, releasedSoFar: released });
      }
    }
    memory.progress = null;
    const toBoss = normalized(creature.x - state.player.x, creature.y - state.player.y);
    // 이 방향으로 움직이면 보스가 보이는 각도가 줄어든다(초당 속도 / 거리 라디안).
    const side = { x: -toBoss.y, y: toBoss.x };
    const rotation = Math.max(.2, Number(state.tongRotationSpeed) || DEFAULT_TONG_ROTATION_SPEED);
    // 집게가 보스에 닿는 각도 폭(보스가 보이는 방향을 가운데로 ± arc). 거리 구간 밖이면 0이다.
    const cosine = (reach * reach + targetDistance * targetDistance - hitHalf * hitHalf) / (2 * reach * Math.max(1, targetDistance));
    const arc = Math.abs(targetDistance - reach) < hitHalf && cosine < 1 ? Math.acos(Math.max(-1, cosine)) : 0;
    let wantedSide = null;
    // 집게가 닿는 거리(끝이 보스 가장자리에 걸치는 137px까지)면 어디서든 회전을 맞춘다: 게들이 보스 곁에 몰려
    // 84px까지 들어갈 수 없을 때도, 바깥 둘레에서 계속 때린다(실제 원정에서 마지막 6초를 다가가려다 놓쳤다).
    if (arc > 0 && Number.isFinite(state.tongAngle)) {
      const turn = Math.PI * 2;
      const offset = ((state.tongAngle - Math.atan2(toBoss.y, toBoss.x)) % turn + turn + Math.PI) % turn - Math.PI;
      const orbit = playerSpeed / Math.max(1, targetDistance);
      if (Math.abs(offset) < arc) {
        // 닿는 중: 집게를 따라 돈다. 내 속도로 따라잡을 수 있으면 집게를 보스 가운데에 묶어 둔다.
        wantedSide = rotation * targetDistance > playerSpeed * .97 ? -playerSpeed
          : Math.max(-playerSpeed, Math.min(playerSpeed, -(rotation + BOSS_SYNC_GAIN * offset) * targetDistance));
      } else {
        // 벗어남: 앞으로 마중 나가는 쪽과(집게 + 내 회전), 되돌아 따라잡는 쪽(내 회전이 더 빠를 때만) 중 빠른 쪽.
        const forward = (((-arc - offset) % turn) + turn) % turn / (rotation + orbit);
        const backward = orbit > rotation * 1.05 ? (((offset - arc) % turn) + turn) % turn / (orbit - rotation) : Infinity;
        wantedSide = backward < forward ? -playerSpeed : playerSpeed;
      }
    }
    const slowAt = (point) => 1 - Math.min(.6, Math.max(0, Number(state.terrainRisk?.(point)) || 0) * .5);
    const openSpeed = playerSpeed / slowAt(state.player);
    const steady = memory.headingKey === target.key && Math.hypot(memory.heading.x, memory.heading.y) > .5;
    const horizon = .3;
    let chosen = null;
    for (let index = -1; index < 48; index += 1) {
      // -1: 제자리. 그 밖에는 24방향 × (전속력, 절반 속도).
      const angle = Math.floor(Math.max(0, index) / 2) / 24 * Math.PI * 2;
      const magnitude = index < 0 ? 0 : index % 2 === 0 ? 1 : .5;
      const direction = index < 0 ? { x: 0, y: 0 } : { x: Math.cos(angle), y: Math.sin(angle) };
      const speed = openSpeed * magnitude * slowAt({ x: state.player.x + direction.x * 20, y: state.player.y + direction.y * 20 });
      const ahead = { x: state.player.x + direction.x * speed * horizon, y: state.player.y + direction.y * speed * horizon };
      const chase = normalized(ahead.x - creature.x, ahead.y - creature.y);
      const range = Math.hypot(ahead.x - creature.x - chase.x * target.approach * horizon, ahead.y - creature.y - chase.y * target.approach * horizon);
      const gap = range - contactRadius;
      let score = -Math.abs(range - hold) * 7 - (gap < 12 ? (12 - gap) * 300 : 0);
      // 닿지 않는 거리에서 서 있지 않는다: 게들이 보스 곁에 몰려 다가갈 길이 막히면, 서서 기다리는 사이 둘러싸인다.
      // 둘레를 계속 돌며 열린 쪽을 찾는다.
      if (magnitude < 1 && !(arc > 0)) score -= 220;
      if (wantedSide !== null) score -= Math.abs((direction.x * side.x + direction.y * side.y) * speed - wantedSide) * .45;
      if (magnitude > 0) {
        score -= (1 - slowAt({ x: ahead.x + direction.x * 60, y: ahead.y + direction.y * 60 })) * KITE_SLOW_AHEAD_PENALTY;
        if (steady) score -= (1 - (direction.x * memory.heading.x + direction.y * memory.heading.y)) * 8;
      }
      // 가는 길의 위험은 표본 합이 아니라 가장 나쁜 한 점으로 센다. 합으로 세면 제자리(표본 하나)가 늘 유리해져,
      // 게 몇 마리가 따라붙는 순간 멈춰 서서 따라잡힌다.
      let path = hazardPenalty(ahead, state, target, false);
      for (let sample = 1; sample <= 3 && magnitude > 0; sample += 1) {
        path = Math.max(path, hazardPenalty({ x: state.player.x + (ahead.x - state.player.x) * sample / 4, y: state.player.y + (ahead.y - state.player.y) * sample / 4 }, state, target, false));
      }
      // 조금 더 가서(0.6초) 다른 게와 마주치는 길도 미리 피한다: 둘레를 도는 속도가 빨라 코앞에서는 비켜 갈 틈이 없다.
      if (magnitude > 0) path = Math.max(path, hazardPenalty({ x: state.player.x + direction.x * speed * horizon * 2, y: state.player.y + direction.y * speed * horizon * 2 }, state, { ...target, kiteIds: new Set() , targetId: null, crowdSoft: { range: 20, weight: 5 }, bossFight: null, terrainWeight: 0, skipCautious: true }, false) * .5);
      score -= path * 2;
      if (!chosen || score > chosen.score) chosen = { direction, magnitude, score };
    }
    memory.headingKey = target.key;
    if (chosen.magnitude > 0) memory.heading = { x: chosen.direction.x, y: chosen.direction.y };
    return {
      x: chosen.direction.x * chosen.magnitude,
      y: chosen.direction.y * chosen.magnitude,
      intent: arc > 0 ? target.intent : `${creature.name}에게 다가가는 중`,
      targetKind: target.kind,
      targetId: target.targetId ?? null,
      targetPoint: target.point,
      targetDistance,
      desiredDistance: hold,
      danger: currentDanger,
      urgent: true,
      released,
    };
  }

  // 쫓아오는 목표: 서 있다가 최대 속도로 달아나는 대신, 상대가 다가오는 속도에 맞춰 물러나며 집게 구간을 지킨다.
  // 쫓아오는 일반 게가 구간 조금 바깥에 있으면 다가가지 않고 올 때까지 기다린다(다가가면 뒤따르는 무리 속으로 들어간다).
  if (target.kind === "creature" && target.kite && (target.cautious || targetDistance <= band.outer + FRONT_CRAB_RANGE)) {
    const creature = target.creature;
    const playerSpeed = Math.max(40, Number(state.playerSpeed) || Number(state.player.speed) || DEFAULT_PLAYER_SPEED);
    const approach = Math.max(0, target.approach);
    const contactGap = targetDistance - (creature.size + CONTACT_MARGIN);
    const wanted = approach + KITE_GAIN * (target.desiredDistance - targetDistance);
    // 이탈: 접촉 여유가 줄었거나, 느린 지형이라 상대보다 빠르지 않거나, 다른 위험 안에 서 있으면 최대 속도로 벌린다.
    const breakGap = memory.escapeTarget === target.key ? KITE_BREAK_GAP + 9 : KITE_BREAK_GAP;
    const dangerLimit = memory.escapeTarget === target.key ? 720 : 1000;
    // 일반 게를 상대할 때는 목표 쪽(앞)에 몰려 있는 게들의 무리 벌점으로는 달아나지 않는다: 물러나면 어차피 멀어지는데,
    // 그 합이 1,000을 넘는다고 달아나면 상대하던 게가 집게 거리 밖으로 벗어난다(실제 원정에서 절반의 시간이 그랬다).
    // 물러날 쪽(옆·뒤)에서 오는 게는 그대로 세어, 둘러싸이기 전에 최대 속도로 빠져나간다.
    let flank = 0;
    const pursued = target.cautious || target.kiteIds.size > 0;
    if (!pursued) {
      for (const other of state.creatures) {
        if (other.id === creature.id || !liveCreature(other)) continue;
        const range = distance(state.player, other);
        const gap = range - other.size - 25;
        if (gap <= 0) flank += 6800;
        else if (gap < 96 && ((other.x - state.player.x) * (state.player.x - creature.x) + (other.y - state.player.y) * (state.player.y - creature.y)) / Math.max(1, range * targetDistance) > -.35) flank += (96 - gap) * 6.5;
      }
    }
    // 복어·보스가 쫓아오는 동안에는 예전처럼 무리 벌점 합으로 일찍 빠진다(무리 곁에 머물면 복어가 왔을 때 물러날 길이 막힌다).
    // 느린 지형 위에 서서 게를 상대하지도 않는다(벌점이 있는 후보를 피해 단단한 땅으로 나간다).
    const crowded = pursued ? currentDanger > dangerLimit
      : (Number(state.terrainRisk?.(state.player)) || 0) > .05 || flank > (memory.escapeTarget === target.key ? 420 : 650)
        || hazardPenalty(state.player, state, { ...target, crowdSoft: { range: 0, weight: 0 } }, false) > 1000;
    const escaping = contactGap < breakGap || playerSpeed < approach * KITE_SPEED_MARGIN || crowded;
    memory.escapeTarget = escaping ? target.key : null;
    memory.progress = null;
    if (!escaping && wanted <= playerSpeed * .04) {
      memory.headingKey = target.key;
      return stay({ urgent: true });
    }
    // 물러날 방향: 가까운 추격자들에게서 멀어지는 쪽(둘이 양쪽에서 오면 옆으로 빠진다).
    let awayX = (state.player.x - creature.x) / Math.max(1, targetDistance);
    let awayY = (state.player.y - creature.y) / Math.max(1, targetDistance);
    for (const other of state.creatures) {
      if (other.id === creature.id || !target.kiteIds.has(other.id) || !liveCreature(other)) continue;
      const range = distance(state.player, other);
      if (range > 260) continue;
      const weight = Math.min(1.5, (contactGap + 30) / Math.max(10, range - (other.size + CONTACT_MARGIN) + 30));
      awayX += (state.player.x - other.x) / Math.max(1, range) * weight;
      awayY += (state.player.y - other.y) / Math.max(1, range) * weight;
    }
    const away = normalized(awayX, awayY);
    const radial = normalized(state.player.x - creature.x, state.player.y - creature.y);
    const base = Math.hypot(away.x, away.y) > .5 ? away : radial;
    const steadyKite = memory.headingKey === target.key && Math.hypot(memory.heading.x, memory.heading.y) > .5;
    // 지형 감속: 물골(위험도 .65)은 0.68배, 깊은 펄은 깊이에 따라 0.4배까지. 지금 속도에서 감속을 걷어낸 값이 평지 속도다.
    const slowAt = (point) => 1 - Math.min(.6, Math.max(0, Number(state.terrainRisk?.(point)) || 0) * .5);
    const openSpeed = playerSpeed / slowAt(state.player);
    const contactRadius = creature.size + CONTACT_MARGIN;
    const holdGap = target.desiredDistance - contactRadius;
    let chosen = null;
    for (const degrees of escaping ? KITE_ESCAPE_ANGLES : KITE_ANGLES) {
      const angle = degrees * Math.PI / 180;
      const direction = {
        x: base.x * Math.cos(angle) - base.y * Math.sin(angle),
        y: base.x * Math.sin(angle) + base.y * Math.cos(angle),
      };
      // 목표에서 멀어지는 성분만 거리 유지에 쓰인다. 비스듬히 갈수록 같은 후퇴 속도를 내려면 더 빨리 움직여야 한다.
      const outward = direction.x * radial.x + direction.y * radial.y;
      if (!escaping && outward < .2) continue;
      const magnitude = escaping ? 1 : Math.max(0, Math.min(1, wanted / (playerSpeed * Math.max(.2, outward))));
      // 이 방향으로 KITE_HORIZON초 간 자리(지형 감속 반영)와, 그동안 따라온 추격자와의 간격을 내다본다.
      let ahead = { x: state.player.x, y: state.player.y };
      for (let index = 0; index < 4; index += 1) {
        const stride = openSpeed * magnitude * slowAt(ahead) * KITE_HORIZON / 4;
        ahead = { x: ahead.x + direction.x * stride, y: ahead.y + direction.y * stride };
      }
      const chase = normalized(ahead.x - creature.x, ahead.y - creature.y);
      const gap = Math.hypot(ahead.x - creature.x - chase.x * approach * KITE_HORIZON, ahead.y - creature.y - chase.y * approach * KITE_HORIZON) - contactRadius;
      // 거리 맞추기: 지킬 간격에 가까울수록 좋다. 이탈: 간격이 클수록 좋다.
      const gapScore = escaping ? Math.min(gap, holdGap + 60) * 12 : -Math.abs(gap - holdGap) * 6;
      // 그 너머가 물골·깊은 펄이면 들어가지 않는다(들어가면 복어보다 느려져 따라잡힌다).
      let slowAhead = 0;
      for (const further of [50, 110]) slowAhead += 1 - slowAt({ x: ahead.x + direction.x * further, y: ahead.y + direction.y * further });
      const turn = steadyKite ? (1 - (direction.x * memory.heading.x + direction.y * memory.heading.y)) * (escaping ? HEADING_HYSTERESIS : 65) : 0;
      const score = gapScore - slowAhead * KITE_SLOW_AHEAD_PENALTY
        - hazardPenalty(ahead, state, target, false) - routeHazardPenalty(state.player, ahead, state, target, false)
        - Math.abs(degrees) * .8 - turn;
      if (!chosen || score > chosen.score) chosen = { direction, magnitude, score };
    }
    const direction = chosen?.direction ?? radial;
    const magnitude = chosen?.magnitude ?? 1;
    memory.headingKey = target.key;
    memory.heading = { x: direction.x, y: direction.y };
    return {
      x: direction.x * magnitude,
      y: direction.y * magnitude,
      intent: escaping ? `거리를 벌리는 중 · ${creature.name}` : target.intent,
      targetKind: target.kind,
      targetId: target.targetId ?? null,
      targetPoint: target.point,
      targetDistance,
      desiredDistance: target.desiredDistance,
      danger: currentDanger,
      // 섞지 않고 그대로 적용해야 후퇴 속도가 상대 속도와 맞는다.
      urgent: true,
      released,
    };
  }
  if (canHoldPosition && ((target.kind === "clam" && (targetDistance <= 30 || target.hold))
    || (target.kind === "rock" && targetDistance <= target.desiredDistance)
    || (target.kind === "pickup" && targetDistance <= 12)
    // 일반 게: 집게가 닿는 거리 구간 안에서는 집게가 때릴 때까지 선다. 복어·보스: 예전처럼 132 ± 7.
    || (target.kind === "creature" && (band ? inBand : Math.abs(targetDistance - target.desiredDistance) <= 7))
    || (target.kind === "safe-zone" && targetDistance <= 42)
    || (target.kind === "camp" && targetDistance <= 28))) {
    memory.progress = null;
    memory.heading = { x: 0, y: 0 };
    return stay();
  }

  const routeTail = routed ? distance(route.points[route.points.length - 1], target.point) : 0;
  // 목표까지 남은 거리(경로를 따라 잰 값). 생물은 지켜야 할 거리에서 벗어난 만큼이다.
  const errorFrom = (point) => {
    if (target.kind === "creature") {
      const range = distance(point, target.point);
      if (band) return range < band.inner ? band.inner - range : range > band.outer ? range - band.outer : 0;
      return Math.abs(range - target.desiredDistance);
    }
    // 마지막 경로점까지 왔으면 실제 목표와의 거리로 잰다(바위는 둘레의 작업 거리까지만 가면 된다).
    if (waypoint.last) return Math.max(0, distance(point, target.point) - target.desiredDistance);
    return Math.max(0, distance(point, waypoint.point) + waypoint.rest + routeTail - target.desiredDistance);
  };
  const currentGoalError = errorFrom(state.player);

  // 무진전 감지: 같은 목표로 가는데 남은 거리가 NO_PROGRESS_SECONDS 동안 NO_PROGRESS_STEP 넘게 줄지 않으면
  // 그 목표를 풀고 잠시 블랙리스트에 올린다(귀환·대피·탐색은 경로만 새로 짠다).
  const progressKey = target.key ?? target.kind;
  if (target.kind !== "creature") {
    if (memory.progress?.key !== progressKey) memory.progress = { key: progressKey, best: currentGoalError, at: elapsed };
    else if (currentGoalError < memory.progress.best - NO_PROGRESS_STEP) { memory.progress.best = currentGoalError; memory.progress.at = elapsed; }
    else if (elapsed - memory.progress.at > NO_PROGRESS_SECONDS) {
      if (RELEASABLE_KINDS.has(target.kind)) {
        release(target, NO_PROGRESS_BLOCK_SECONDS, "no-progress");
        return decideMudflatSupervisorMove({ ...state, memory, lockedTargetKind: null, lockedTargetId: null, releasedSoFar: released });
      }
      memory.route = null;
      memory.progress = { key: progressKey, best: currentGoalError, at: elapsed };
    }
  } else memory.progress = null;

  const direct = normalized(waypoint.point.x - state.player.x, waypoint.point.y - state.player.y);
  const directions = [{ x: 0, y: 0 }, direct];
  if (target.kind === "creature") directions.push(normalized(state.player.x - target.point.x, state.player.y - target.point.y));
  for (let index = 0; index < 20; index += 1) {
    const angle = index / 20 * Math.PI * 2;
    directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  // Match the planning distance to roughly one decision interval of actual
  // movement. A long projected step can land beyond a nearby crab and make a
  // route through it look safer than backing away.
  const step = currentDanger > 1000 ? 88 : 36;
  // 같은 목표로 가는 동안에는 직전 진행 방향에서 크게 꺾는 걸음에 작은 벌점을 준다: 점수가 비슷한 두 방향 사이에서
  // 판단마다 좌우로 뒤집던 떨림을 없앤다. 위험을 피할 때는 적용하지 않는다.
  const steady = memory.headingKey === progressKey && currentDanger <= 1000 && Math.hypot(memory.heading.x, memory.heading.y) > .5;
  let best = null;
  for (const direction of directions) {
    const candidate = { x: state.player.x + direction.x * step, y: state.player.y + direction.y * step };
    const goalError = errorFrom(candidate);
    // Progress means reducing error from the desired distance, not merely
    // getting closer. This makes a creature inside the safe tool range push
    // the supervisor away instead of attracting it into contact damage.
    const progressBonus = (currentGoalError - goalError) * (target.kind === "camp" ? 7 : 2.4);
    const moving = direction.x !== 0 || direction.y !== 0;
    const stillPenalty = !moving && goalError > 24 ? 90 : 0;
    const turnPenalty = steady && moving ? (1 - (direction.x * memory.heading.x + direction.y * memory.heading.y)) * HEADING_HYSTERESIS : 0;
    const score = -goalError * 1.7 + progressBonus
      - hazardPenalty(candidate, state, target, routed)
      - routeHazardPenalty(state.player, candidate, state, target, routed)
      - stillPenalty - turnPenalty;
    if (!best || score > best.score) best = { direction, score };
  }

  const intent = currentDanger > 1000 ? "위험을 피해 이동 중" : target.intent;
  const direction = best?.direction ?? { x: 0, y: 0 };
  // 일반 게가 집게 거리보다 가까이 들어오면 최대 속도로 물러난다(예전에는 거리 오차에 비례해 천천히 물러나 따라잡혔다).
  const tooClose = Boolean(band && targetDistance < band.inner);
  const speedScale = currentDanger > 1000 || tooClose || target.hurry || target.kind === "camp" || target.kind === "safe-zone" || target.kind === "explore"
    ? 1 : Math.max(.22, Math.min(1, currentGoalError / 82));
  memory.headingKey = progressKey;
  memory.heading = Math.hypot(direction.x, direction.y) > .5 ? { x: direction.x, y: direction.y } : memory.heading;
  return {
    x: direction.x * speedScale,
    y: direction.y * speedScale,
    intent,
    targetKind: target.kind,
    targetId: target.targetId ?? null,
    targetPoint: target.point,
    targetDistance,
    desiredDistance: target.desiredDistance,
    danger: currentDanger,
    urgent: tooClose || Boolean(target.hurry),
    released,
  };
}

/** 정지해 있는 동안의 호미질 허용: 조개구멍을 목표로 섰을 때와, 바위를 뒤집느라 서 있을 때(둘은 함께 진행된다). */
export function mudflatSupervisorCanDig(decision) {
  return (decision?.targetKind === "clam" || decision?.targetKind === "rock") && Math.hypot(decision.x ?? 0, decision.y ?? 0) <= .05;
}

export function maintainMudflatSupervisorCampaign(campaign) {
  let coins = Math.max(0, Math.floor(campaign.coins ?? 0));
  let hp = Math.max(1, Number(campaign.hp ?? 1));
  let maxHp = Math.max(1, Number(campaign.maxHp ?? 1));
  const equipment = { ...(campaign.equipment ?? {}) };
  let levels = campaign.levels;
  let pendingSkillDiscovery = campaign.pendingSkillDiscovery;

  if (hp < maxHp * .72 && coins >= FULL_HEAL_PRICE) {
    coins -= FULL_HEAL_PRICE;
    hp = maxHp;
  }

  // 집게 훈련을 장비보다 먼저 산다: 쫓아오는 복어를 물러나며 잡는 속도가 집게 레벨에 달려 있다(회복 값은 남긴다).
  if (campaign.mode === "normal" && levels) {
    const tongs = MUDFLAT_GENERAL_UPGRADES.find((item) => item.id === "tongs");
    const cap = Math.min(tongs?.max ?? 0, TONG_TRAINING_TARGET_LEVEL);
    while ((levels.tongs ?? 0) > 0 && levels.tongs < cap && coins >= mudflatTrainingPrice(levels.tongs) + FULL_HEAL_PRICE) {
      const before = mudflatAdvancedSkillUnlocks(levels);
      coins -= mudflatTrainingPrice(levels.tongs);
      levels = { ...levels, tongs: levels.tongs + 1 };
      const after = mudflatAdvancedSkillUnlocks(levels);
      if ((!before.electric && after.electric) || (!before.castNet && after.castNet)) pendingSkillDiscovery = true;
    }
  }

  let upgradesBought = 0;
  while (upgradesBought < 2) {
    const affordable = EQUIPMENT_PRIORITY
      .map((id) => {
        const item = MUDFLAT_SHOP_EQUIPMENT.find((entry) => entry.id === id);
        const level = Math.max(0, Math.floor(equipment[id] ?? 0));
        return item && level < item.max ? { id, level, price: mudflatEquipmentPrice(id, level) } : null;
      })
      .filter(Boolean)
      .find((item) => item.price <= Math.max(0, coins - FULL_HEAL_PRICE));
    if (!affordable) break;
    equipment[affordable.id] = affordable.level + 1;
    coins -= affordable.price;
    upgradesBought += 1;
  }

  if (campaign.stage >= 2 && (equipment[MOSQUITO_REPELLENT_KEY] ?? 0) <= 0
    && coins >= MOSQUITO_REPELLENT_PRICE + FULL_HEAL_PRICE) {
    equipment[MOSQUITO_REPELLENT_KEY] = 1;
    coins -= MOSQUITO_REPELLENT_PRICE;
  }

  const stats = mudflatEquipmentStats(equipment, campaign.baseMaxHp, campaign.mode === "normal" ? levels?.snack : 0);
  if (stats.maxHp > maxHp) hp += stats.maxHp - maxHp;
  maxHp = stats.maxHp;
  if (hp < maxHp && coins >= FULL_HEAL_PRICE) {
    coins -= FULL_HEAL_PRICE;
    hp = maxHp;
  }

  return {
    ...campaign, coins, hp: Math.min(maxHp, hp), maxHp, equipment,
    ...(levels === campaign.levels ? {} : { levels, pendingSkillDiscovery }),
  };
}
