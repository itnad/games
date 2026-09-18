export const CAST_NET_FLIGHT = .5;
export const CAST_NET_CLOSE = .3;
export const CAST_NET_FADE = .2;
export const CAST_NET_RETRY = .25;
export const CAST_NET_LIMIT = 2;
export const CAST_NET_RELEASE_GRACE = .8;
export const CAST_NET_PLAYER_CLEARANCE = 17 + 25;

export function castNetPhase(net) {
  if (net.age < CAST_NET_FLIGHT) return "flight";
  if (net.age < CAST_NET_FLIGHT + net.holdSeconds) return "open";
  if (net.age < CAST_NET_FLIGHT + net.holdSeconds + CAST_NET_CLOSE) return "closing";
  if (net.age < net.duration) return "fading";
  return "ended";
}

export function castNetContains(net, point) {
  // Body centres, not legs or sprite corners, must enter the visible circle.
  return Math.hypot(point.x - net.x, point.y - net.y) <= net.radius;
}

export function castNetOnScreen(point, player, width, height, inset = point.size ?? 0) {
  const x = width / 2 + point.x - player.x;
  const y = height / 2 + point.y - player.y;
  return x >= inset + 8 && x <= width - inset - 8 && y >= inset + 8 && y <= height - inset - 8;
}

export function createCastNet(id, player, target, stats, toolPower = 1) {
  return {
    id, x: target.x, y: target.y, originX: player.x, originY: player.y,
    angle: Math.atan2(target.y - player.y, target.x - player.x),
    radius: stats.radius, damage: stats.damage * toolPower, holdSeconds: stats.holdSeconds,
    age: 0, duration: CAST_NET_FLIGHT + stats.holdSeconds + CAST_NET_CLOSE + CAST_NET_FADE,
    hit: false, caughtIds: new Set(), caughtPoints: [],
  };
}

export function findCastNetTarget({ creatures, player, width, height, stats, nets, now = 0, canCatch, canPlace = (_point, _radius) => true }) {
  if (!stats.radius || nets.length >= CAST_NET_LIMIT) return null;
  const reserved = nets.filter((net) => ["flight", "open", "closing"].includes(castNetPhase(net)));
  const eligible = creatures.filter((creature) => creature.hp > 0 && canCatch(creature)
    && castNetOnScreen(creature, player, width, height) && (creature.netReleaseUntil ?? 0) <= now
    && !reserved.some((net) => net.caughtIds.has(creature.id) || castNetContains(net, creature)));
  if (!eligible.length) return null;
  const minimumDistance = stats.radius + CAST_NET_PLAYER_CLEARANCE;
  let best = null;
  let bestCount = 0;
  let bestSpread = Infinity;
  const seen = new Set();
  const consider = (point) => {
    const distance = Math.hypot(point.x - player.x, point.y - player.y);
    if (distance < minimumDistance - .001 || distance > stats.range + .001
      || !castNetOnScreen(point, player, width, height, stats.radius) || !canPlace(point, stats.radius)
      || reserved.some((net) => Math.hypot(point.x - net.x, point.y - net.y) < (stats.radius + net.radius) * .72)) return;
    const key = `${Math.round(point.x * 2)}:${Math.round(point.y * 2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    let count = 0, spread = 0;
    for (const creature of eligible) {
      const squaredDistance = (creature.x - point.x) ** 2 + (creature.y - point.y) ** 2;
      if (squaredDistance <= stats.radius ** 2) { count++; spread += squaredDistance; }
    }
    if (count > bestCount || (count > 0 && count === bestCount && spread < bestSpread)) {
      best = { x: point.x, y: point.y }; bestCount = count; bestSpread = spread;
    }
  };
  const considerNear = (point) => {
    const dx = point.x - player.x, dy = point.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < .001) return;
    const clamped = Math.max(minimumDistance, Math.min(stats.range, distance));
    consider({ x: player.x + dx / distance * clamped, y: player.y + dy / distance * clamped });
  };
  // A bounded local grid plus cluster centres avoids an expensive O(n^3)
  // all-pairs search, and never aims at the empty mean between distant groups.
  const step = Math.max(14, stats.radius / 2);
  const extentX = Math.min(stats.range, width / 2 - stats.radius - 8);
  const extentY = Math.min(stats.range, height / 2 - stats.radius - 8);
  for (let x = -extentX; x <= extentX; x += step) {
    for (let y = -extentY; y <= extentY; y += step) consider({ x: player.x + x, y: player.y + y });
  }
  for (const creature of eligible) {
    considerNear(creature);
    const neighbours = eligible.filter((other) => Math.hypot(other.x - creature.x, other.y - creature.y) <= stats.radius);
    considerNear({ x: neighbours.reduce((sum, item) => sum + item.x, 0) / neighbours.length,
      y: neighbours.reduce((sum, item) => sum + item.y, 0) / neighbours.length });
  }
  return best;
}

export function castNetMovementMultiplier(creature, nets) {
  const held = nets.some((net) => !net.hit && net.caughtIds.has(creature.id)
    && ["open", "closing"].includes(castNetPhase(net)));
  return held ? 0 : 1;
}

export function advanceCastNets(nets, creatures, dt, now, canCatch, damageCreature) {
  const creaturesById = new Map(creatures.map((creature) => [creature.id, creature]));
  const owned = new Set();
  const release = (net, id) => {
    net.caughtIds.delete(id);
    const creature = creaturesById.get(id);
    if (creature?.hp > 0) creature.netReleaseUntil = now + CAST_NET_RELEASE_GRACE;
  };
  // Release invalid targets before any other net can acquire them.
  for (const net of nets) {
    net.age += Math.max(0, dt);
    for (const id of net.caughtIds) {
      const creature = creaturesById.get(id);
      if (!creature || creature.hp <= 0 || owned.has(id)) release(net, id);
      else owned.add(id);
    }
  }
  for (const net of nets) {
    const phase = castNetPhase(net);
    if (phase === "open") {
      for (const creature of creatures) {
        if (creature.hp <= 0 || owned.has(creature.id) || (creature.netReleaseUntil ?? 0) > now
          || !canCatch(creature) || !castNetContains(net, creature)) continue;
        net.caughtIds.add(creature.id); owned.add(creature.id);
      }
    }
    net.caughtPoints = [...net.caughtIds].map((id) => {
      const creature = creaturesById.get(id);
      return { x: creature.x, y: creature.y, id };
    });
    if (!net.hit && net.age >= CAST_NET_FLIGHT + net.holdSeconds + CAST_NET_CLOSE) {
      net.hit = true;
      for (const id of net.caughtIds) {
        const creature = creaturesById.get(id);
        if (creature?.hp > 0) damageCreature(creature, net.damage, .18);
        release(net, id);
      }
    }
  }
  return nets.filter((net) => castNetPhase(net) !== "ended");
}
