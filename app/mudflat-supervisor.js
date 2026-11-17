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

const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const normalized = (x, y) => {
  const length = Math.hypot(x, y);
  return length > .001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};

function targetForState(state) {
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

  const livePickups = state.pickups.filter((item) => item.xp > 0 && item.phase !== "arrived");
  if (livePickups.length > 0) {
    const pickup = livePickups.reduce((best, item) => {
      const value = item.xp * 36 - distance(state.player, item);
      return !best || value > best.value ? { item, value } : best;
    }, null)?.item;
    if (pickup) return { kind: "pickup", point: pickup, intent: "경험치 회수 중", desiredDistance: 8 };
  }

  const collectible = state.creatures.filter((item) => item.hp > 0 && !item.uncollectible && (item.emergeSeconds ?? 0) <= 0);
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
  const safeHoles = state.clamHoles.filter(workPointIsSafe);
  const nearestHole = safeHoles.length > 0
    ? safeHoles.reduce((nearest, item) => distance(state.player, item) < distance(state.player, nearest) ? item : nearest)
    : null;
  const activeHole = state.clamHoles
    .filter((item) => (item.progress ?? 0) > 0)
    .sort((left, right) => (right.progress ?? 0) - (left.progress ?? 0))[0] ?? null;
  const availableRocks = state.rocks.filter((item) => item.id !== undefined && workPointIsSafe(item));
  const activeRock = state.activeRockId === undefined || state.activeRockId === null
    ? null
    : availableRocks.find((item) => item.id === state.activeRockId) ?? null;
  const nearestRock = availableRocks.length > 0
    ? availableRocks.reduce((nearest, item) => distance(state.player, item) < distance(state.player, nearest) ? item : nearest)
    : null;
  const rockReach = Math.max(60, Number(state.rockReach) || 84);
  const clamTarget = (hole) => ({
    kind: "clam", point: hole,
    intent: hole.kind === "gaebul" ? "개불 숨구멍 채집 중" : "조개구멍 호미질 중",
    desiredDistance: 20,
  });
  const rockTarget = (rock) => ({
    kind: "rock", point: rock, targetRockId: rock.id,
    intent: "돌뒤집개로 바위 확인 중",
    desiredDistance: Math.max(rock.radius + 28, rockReach - 8),
  });

  // Finish a started field action before selecting fresh work, provided the
  // surrounding area remains clear. This gives the two-second dig/flip actions
  // enough uninterrupted time while still yielding immediately to danger.
  if (workIsSafe && activeRock) return rockTarget(activeRock);
  if (workIsSafe && activeHole && workPointIsSafe(activeHole)) return clamTarget(activeHole);

  // Rotate ordinary gathering, hoe work and learned rock turning. Without an
  // explicit work phase, a continuously populated field makes creatures win
  // every decision and the supervisor never demonstrates the other tools.
  const workPhase = Math.floor(Math.max(0, state.elapsed) / 7) % 3;
  if (workIsSafe && workPhase === 0 && nearestHole) return clamTarget(nearestHole);
  if (workIsSafe && workPhase === 1 && (state.rockerLevel ?? 0) > 0 && nearestRock) return rockTarget(nearestRock);

  if (collectible.length > 0) {
    const creature = collectible.reduce((best, item) => {
      const range = distance(state.player, item);
      const dangerPenalty = item.type === "pufferfish" ? 320 : item.boss ? 180 : 0;
      const value = (item.xp ?? 0) * 42 + (item.score ?? 0) * .16 + (item.boss ? 260 : 0) - range - dangerPenalty;
      return !best || value > best.value ? { item, value } : best;
    }, null)?.item;
    if (creature) {
      const cautious = creature.type === "pufferfish" || creature.boss;
      return {
        kind: "creature",
        point: creature,
        targetId: creature.id,
        intent: cautious ? `거리 유지 중 · ${creature.name}` : `${creature.name} 채집 중`,
        desiredDistance: cautious ? 132 : 76,
      };
    }
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

function hazardPenalty(point, state, target) {
  let penalty = Math.max(0, Number(state.terrainRisk?.(point)) || 0) * 260;
  for (const rock of state.rocks) {
    const isTarget = target.targetRockId === rock.id;
    const gap = distance(point, rock) - (rock.radius + 24);
    if (gap <= 0) penalty += 12000;
    else if (!isTarget && gap < 84) penalty += (84 - gap) * 7;
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

function routeHazardPenalty(start, end, state, target) {
  let penalty = 0;
  // The supervisor applies one direction for several rendered frames. Sampling
  // the route prevents a seemingly safe endpoint on the far side of a crab or
  // rock from authorising a movement that crosses through the obstacle first.
  for (let index = 1; index <= 6; index += 1) {
    const progress = index / 6;
    penalty += hazardPenalty({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    }, state, target);
  }
  return penalty;
}

export function decideMudflatSupervisorMove(state) {
  const target = targetForState(state);
  const targetDistance = distance(state.player, target.point);
  const currentDanger = hazardPenalty(state.player, state, target);
  const canHoldPosition = currentDanger < 1000;
  if (canHoldPosition && ((target.kind === "clam" && targetDistance <= 30)
    || (target.kind === "rock" && targetDistance <= target.desiredDistance)
    || (target.kind === "pickup" && targetDistance <= 12)
    || (target.kind === "safe-zone" && targetDistance <= 42)
    || (target.kind === "camp" && targetDistance <= 28))) {
    return { x: 0, y: 0, intent: target.intent, targetKind: target.kind };
  }

  const direct = normalized(target.point.x - state.player.x, target.point.y - state.player.y);
  const directions = [{ x: 0, y: 0 }, direct];
  for (let index = 0; index < 20; index += 1) {
    const angle = index / 20 * Math.PI * 2;
    directions.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  // Match the planning distance to roughly one decision interval of actual
  // movement. A long projected step can land beyond a nearby crab and make a
  // route through it look safer than backing away.
  const step = currentDanger > 1000 ? 88 : 36;
  const currentGoalError = target.kind === "creature"
    ? Math.abs(targetDistance - target.desiredDistance)
    : Math.max(0, targetDistance - target.desiredDistance);
  let best = null;
  for (const direction of directions) {
    const candidate = { x: state.player.x + direction.x * step, y: state.player.y + direction.y * step };
    const candidateDistance = distance(candidate, target.point);
    const goalError = target.kind === "creature"
      ? Math.abs(candidateDistance - target.desiredDistance)
      : Math.max(0, candidateDistance - target.desiredDistance);
    // Progress means reducing error from the desired distance, not merely
    // getting closer. This makes a creature inside the safe tool range push
    // the supervisor away instead of attracting it into contact damage.
    const progressBonus = (currentGoalError - goalError) * (target.kind === "camp" ? 7 : 2.4);
    const stillPenalty = direction.x === 0 && direction.y === 0 && goalError > 24 ? 90 : 0;
    const score = -goalError * 1.7 + progressBonus
      - hazardPenalty(candidate, state, target)
      - routeHazardPenalty(state.player, candidate, state, target)
      - stillPenalty;
    if (!best || score > best.score) best = { direction, score };
  }

  const intent = currentDanger > 1000 ? "위험을 피해 이동 중" : target.intent;
  return { ...(best?.direction ?? { x: 0, y: 0 }), intent, targetKind: target.kind };
}

export function mudflatSupervisorCanDig(decision) {
  return decision?.targetKind === "clam" && Math.hypot(decision.x ?? 0, decision.y ?? 0) <= .05;
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
