import {
  MUDFLAT_RECOVERY_FOODS,
  MUDFLAT_SHOP_EQUIPMENT,
  mudflatEquipmentPrice,
  mudflatEquipmentStats,
} from "./mudflat-survivor-engine.js";

export const MUDFLAT_SUPERVISOR_DECISION_SECONDS = .16;

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
  return { blocked: new Map(), route: null, progress: null, chase: null, heading: { x: 0, y: 0 }, headingKey: null };
}

const targetKey = (kind, item) => `${kind}:${item.id ?? `${Math.round(item.x)},${Math.round(item.y)}`}`;
const isCautious = (creature) => creature.type === "pufferfish" || Boolean(creature.boss);
const isHighRisk = (creature) => Boolean(creature.uncollectible) || isCautious(creature);
const liveCreature = (creature) => creature.hp > 0 && (creature.emergeSeconds ?? 0) <= 0;

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
  if (state.baseCampGuideShown) {
    return { kind: "camp", point: state.baseCamp, intent: "베이스캠프로 귀환 중", desiredDistance: 0 };
  }
  if (state.secondsToTide <= 5.2 && state.safeZone) {
    return { kind: "safe-zone", point: state.safeZone, intent: "돌발 물살 대피 중", desiredDistance: 18 };
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
  const safeHoles = state.clamHoles.filter((hole) => distance(state.player, hole) <= MUDFLAT_SUPERVISOR_CLAM_SEARCH_RANGE
    && workPointIsSafe(hole) && holeHasClearApproach(hole) && allowed("clam", hole));
  const nearestHole = safeHoles.length > 0
    ? safeHoles.reduce((nearest, item) => distance(state.player, item) < distance(state.player, nearest) ? item : nearest)
    : null;
  const activeHole = state.clamHoles
    .filter((item) => (item.progress ?? 0) > 0)
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
    intent: hole.kind === "gaebul" ? "개불 숨구멍 채집 중" : "조개구멍 호미질 중",
    desiredDistance: 20,
  });
  const rockTarget = (rock) => ({
    kind: "rock", point: rock, targetId: rock.id, targetRockId: rock.id, key: targetKey("rock", rock),
    intent: "돌뒤집개로 바위 확인 중",
    desiredDistance: Math.max(rock.radius + 28, rockReach - 8),
  });
  const tongReach = state.tongReach === undefined ? DEFAULT_TONG_REACH : Math.max(0, Number(state.tongReach) || 0);
  const creatureTarget = (creature) => {
    const cautious = isCautious(creature);
    // 복어와 보스는 예전처럼 한 거리(132)를 지키고, 일반 게는 지금 집게가 실제로 닿는 거리 구간에 머문다.
    const band = cautious ? null : mudflatSupervisorAttackBand(creature, tongReach);
    return {
      kind: "creature", point: creature, targetId: creature.id, key: targetKey("creature", creature), creature, band,
      intent: cautious ? `거리 유지 중 · ${creature.name}` : `${creature.name} 채집 중`,
      desiredDistance: cautious ? 132 : band.center,
    };
  };
  const pickupChaseRange = Math.max(MIN_PICKUP_CHASE_RANGE, (Number(state.pickupRadius) || 50) + 105);
  const livePickups = state.pickups.filter((item) => item.xp > 0 && item.phase !== "arrived"
    && distance(state.player, item) <= pickupChaseRange && allowed("pickup", item));
  const pickupTarget = (pickup) => ({
    kind: "pickup", point: pickup, targetId: pickup.id, key: targetKey("pickup", pickup),
    intent: "가까운 경험치 회수 중", desiredDistance: 8,
  });

  // Finish a started field action before selecting fresh work, provided the
  // surrounding area remains clear. This gives the two-second dig/flip actions
  // enough uninterrupted time while still yielding immediately to danger.
  // 호미질이 진행 중이면 그 자리에 그대로 선다: 서 있는 동안 사거리 안의 바위 뒤집기도 함께 진행된다(둘을 서로 막지 않는다).
  if (workIsSafe && activeHole && workPointIsSafe(activeHole)) return clamTarget(activeHole, distance(state.player, activeHole) <= 48);

  // A selected target remains stable for a short action window. Re-evaluating
  // the nearest entity every 160 ms made the heading alternate between equally
  // attractive holes and drops, which looked like the gatherer was vibrating.
  if (state.lockedTargetId !== undefined && state.lockedTargetId !== null) {
    if (state.lockedTargetKind === "clam" && workIsSafe) {
      const hole = safeHoles.find((item) => item.id === state.lockedTargetId);
      if (hole) return clamTarget(hole);
    }
    if (state.lockedTargetKind === "rock" && workIsSafe && (state.rockerLevel ?? 0) > 0) {
      const rock = availableRocks.find((item) => item.id === state.lockedTargetId);
      if (rock) return rockTarget(rock);
    }
    if (state.lockedTargetKind === "pickup") {
      const pickup = livePickups.find((item) => item.id === state.lockedTargetId);
      if (pickup) return pickupTarget(pickup);
    }
    if (state.lockedTargetKind === "creature") {
      const creature = collectible.find((item) => item.id === state.lockedTargetId);
      if (creature) return creatureTarget(creature);
    }
  }

  // Rock turning may run at the same time as hoe work. It becomes the movement
  // target only when there is no active or locked hoe commitment to preserve.
  if (workIsSafe && activeRock) return rockTarget(activeRock);

  // Hoe work is the supervisor's default safe activity. Keeping the nearest
  // local hole ahead of drops, creatures and fresh rock work prevents combat
  // rewards from repeatedly stealing the two-second digging window.
  if (workIsSafe && nearestHole) return clamTarget(nearestHole);

  // Only collect drops that are already near the current action. Experience
  // outside this radius remains in the world instead of pulling the supervisor
  // across the map and starving hoe/rock work indefinitely.
  if (livePickups.length > 0) {
    const pickup = livePickups.reduce((best, item) => {
      const value = item.xp * 18 - distance(state.player, item);
      return !best || value > best.value ? { item, value } : best;
    }, null)?.item;
    if (pickup) return pickupTarget(pickup);
  }

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
  let penalty = Math.max(0, Number(state.terrainRisk?.(point)) || 0) * 260;
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
    const isTarget = target.targetId === creature.id;
    const highRisk = creature.uncollectible || creature.type === "pufferfish" || creature.boss;
    const clearance = creature.size + (highRisk ? 104 : 25);
    const gap = distance(point, creature) - clearance;
    if (gap <= 0) {
      const overlapDepth = Math.min(clearance, -gap);
      penalty += (highRisk ? 15500 : (isTarget ? 2200 : 6800)) + overlapDepth * (highRisk ? 240 : 160);
    }
    else if (highRisk && gap < 90) penalty += (90 - gap) * 6;
    else if (!isTarget && gap < 96) penalty += (96 - gap) * 6.5;
  }
  return penalty;
}

function routeHazardPenalty(start, end, state, target, routed = false) {
  let penalty = 0;
  // The supervisor applies one direction for several rendered frames. Sampling
  // the route prevents a seemingly safe endpoint on the far side of a crab or
  // rock from authorising a movement that crosses through the obstacle first.
  for (let index = 1; index <= 6; index += 1) {
    const progress = index / 6;
    penalty += hazardPenalty({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    }, state, target, routed);
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
  const risky = state.creatures.filter((creature) => liveCreature(creature) && isHighRisk(creature) && creature.id !== target.targetId)
    .map((creature) => ({ x: creature.x, y: creature.y, clear: creature.size + 70 }));
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
  return { reachable: true, points, blockedAt, cell };
}

/** 계획한 경로에서 지금 향할 지점: 플레이어에서 장애물 없이 바로 보이는 가장 먼 경로점(ROUTE_LOOKAHEAD 안)과, 거기서 목표까지 남은 길이. */
function routeWaypoint(player, route) {
  const clear = (end) => {
    const length = distance(player, end);
    const steps = Math.max(1, Math.ceil(length / (route.cell * .5)));
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      if (route.blockedAt({ x: player.x + (end.x - player.x) * progress, y: player.y + (end.y - player.y) * progress })) return false;
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
  // 무진전으로 목표를 풀고 다시 판단할 때는 앞에서 푼 기록을 이어받는다.
  const released = state.releasedSoFar ?? [];
  const release = (target, seconds, reason) => {
    memory.blocked.set(target.key, elapsed + seconds);
    released.push({ kind: target.kind, id: target.targetId ?? null, reason });
    memory.route = null;
    memory.progress = null;
    if (target.kind === "creature") memory.chase = null;
  };

  let target = null;
  let route = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    target = targetForState(state, memory);
    route = null;
    // 추격하는 일반 게: 체력이 한동안 줄지 않거나(집게가 닿지 않는다) 처음 자리에서 너무 멀리 끌려갔으면 포기한다.
    if (target.kind === "creature" && target.band) {
      const creature = target.creature;
      if (memory.chase?.id !== creature.id) memory.chase = { id: creature.id, hp: creature.hp, hpAt: elapsed, originX: state.player.x, originY: state.player.y };
      else if (creature.hp < memory.chase.hp - .01) { memory.chase.hp = creature.hp; memory.chase.hpAt = elapsed; }
      const rotation = Math.max(.2, Number(state.tongRotationSpeed) || DEFAULT_TONG_ROTATION_SPEED);
      const stallSeconds = Math.max(9, (Math.PI * 2 / rotation) * 2.5);
      if (elapsed - memory.chase.hpAt > stallSeconds) { release(target, HP_STALL_BLOCK_SECONDS, "hp-stall"); continue; }
      if (Math.hypot(state.player.x - memory.chase.originX, state.player.y - memory.chase.originY) > CHASE_LIMIT) { release(target, CHASE_BLOCK_SECONDS, "chase-too-far"); continue; }
    } else if (target.kind !== "creature") memory.chase = null;
    if (!ROUTED_KINDS.has(target.kind) || target.hold) break;
    // 전체 경로의 도달 가능성: 경로가 없으면 그 목표를 잠시 포기하고 다른 목표를 고른다(귀환·대피는 포기하지 않고 직진으로 돌아간다).
    const goalRadius = target.kind === "rock" ? target.desiredDistance : target.kind === "clam" ? 22 : target.kind === "pickup" ? 12 : 30;
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
  const canHoldPosition = currentDanger < 1000;
  const band = target.kind === "creature" ? target.band : null;
  const inBand = band ? targetDistance >= band.inner && targetDistance <= band.outer : false;
  const stay = (extra = {}) => ({
    x: 0, y: 0, intent: target.intent, targetKind: target.kind,
    targetId: target.targetId ?? null, targetPoint: target.point,
    targetDistance, desiredDistance: target.desiredDistance, danger: currentDanger, urgent: false, released, ...extra,
  });
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
  const speedScale = currentDanger > 1000 || tooClose || target.kind === "camp" || target.kind === "safe-zone" || target.kind === "explore"
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
    urgent: tooClose,
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

  if (hp < maxHp * .72 && coins >= FULL_HEAL_PRICE) {
    coins -= FULL_HEAL_PRICE;
    hp = maxHp;
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

  const stats = mudflatEquipmentStats(equipment, campaign.baseMaxHp, campaign.mode === "normal" ? campaign.levels?.snack : 0);
  if (stats.maxHp > maxHp) hp += stats.maxHp - maxHp;
  maxHp = stats.maxHp;
  if (hp < maxHp && coins >= FULL_HEAL_PRICE) {
    coins -= FULL_HEAL_PRICE;
    hp = maxHp;
  }

  return { ...campaign, coins, hp: Math.min(maxHp, hp), maxHp, equipment };
}
