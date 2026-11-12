import { uphillAttack } from "../vision/rules";
import { nextUint32 } from "../core/rng";
import type { BattleMap } from "../data/maps";
import { projectileRule, MAX_COMBAT_PROJECTILES } from "./mechanics";
import { integrate } from "../core/fixed-point";
import { integerSqrt } from "../pathfinding/formation";
import type { SimulationState } from "../core/state";
import type { EngineRules } from "../core/simulation";
import type { VisibilityCheck } from "../core/movement-rules";
import { allocateId, removeEntity } from "../core/world";
import { idleMovement } from "../core/orders";
import { economyDefinition, economyId } from "../data/economy-catalog";
import { combatProfile, weaponFor, combatWeapon } from "./catalog";
import { COMBAT_RULES_VERSION, type Scenario } from "./state";
import {
  createEconomicEntity,
  recomputeSupply,
  workerOf,
  releaseWork,
} from "../economy/helpers";

export function synchronizeCombat(s: SimulationState) {
  if (!s.combat) return;
  const previous = new Map(s.combat.records.map((r) => [r.entityId, r]));
  s.combat.records = s.entities.id.map((id, i) => {
    const definitionId = s.entities.definitionId[i],
      old = previous.get(id);
    if (old?.definitionId === definitionId) return old;
    const restored = definitionId === "zerg-drone" ? old?.workerFraction : null;
    return {
      entityId: id,
      definitionId,
      resumeTarget: old?.resumeTarget ?? null,
      lastSeenTarget: null,
      nextAttackTick: old?.nextAttackTick ?? 0,
      remainder: old?.remainder ?? 3,
      healthFraction: restored?.health ?? 0,
      shieldFraction: restored?.shield ?? 0,
      workerFraction:
        old?.definitionId === "zerg-drone"
          ? { health: old.healthFraction, shield: old.shieldFraction }
          : null,
    };
  });
}
export function initializeCombat(
  s: SimulationState,
  scenario: Scenario = "economy",
) {
  s.combat = {
    rulesVersion: COMBAT_RULES_VERSION,
    scenario,
    records: [],
    projectiles: [],
    effects: [],
    friendlyIds: [],
    targetIds: [],
  };
  if (scenario !== "economy") {
    const race = s.players[0].faction,
      ranged = scenario === "ranged-practice";
    const army = ranged
      ? race === "terran"
        ? ["terran-vulture", "terran-vulture", "terran-siege-tank-tank-mode"]
        : race === "zerg"
          ? Array(3).fill("zerg-hydralisk")
          : Array(2).fill("protoss-dragoon")
      : race === "terran"
        ? Array(4).fill("terran-marine")
        : race === "zerg"
          ? Array(6).fill("zerg-zergling")
          : Array(2).fill("protoss-zealot");
    for (let n = 0; n < army.length; n++)
      s.combat.friendlyIds.push(
        createEconomicEntity(s, 0, economyDefinition(army[n])!, {
          x: (ranged ? (n === 2 ? 13 : 14) : 16 - Math.floor(n / 3)) * 256,
          y: (ranged ? 19 + n : 18 + (n % 3)) * 256,
        }),
      );
    if (scenario !== "siege-practice")
      for (const [x, y, id] of [
        [22, 18, "zerg-zergling"],
        [22, 20, "zerg-zergling"],
        [23, 18, ranged && race !== "terran" ? "zerg-overlord" : "zerg-drone"],
      ] as const) {
        const eid = createEconomicEntity(s, 1, economyDefinition(id)!, {
          x: x * 256,
          y: y * 256,
        });
        s.combat.targetIds.push(eid);
        s.movement[s.entities.id.indexOf(eid)].order = "hold";
        const worker = workerOf(s, eid);
        if (worker) releaseWork(s, worker, false);
      }
    const groups = new Map<string, number[]>();
    for (const id of s.combat.friendlyIds) {
      const d = s.entities.definitionId[s.entities.id.indexOf(id)];
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(id);
    }
    [...groups.values()].forEach(
      (ids, slot) => (s.players[0].controlGroups[slot].entityIds = ids),
    );
    recomputeSupply(s);
  }
  if (scenario === "siege-practice") {
    const enemyHQ = s.economy.structures.find(
      (b) =>
        s.entities.owner[s.entities.id.indexOf(b.entityId)] === 1 &&
        economyDefinition(
          s.entities.definitionId[s.entities.id.indexOf(b.entityId)],
        )?.headquarters,
    )!;
    const i = s.entities.id.indexOf(enemyHQ.entityId),
      d = economyDefinition(s.entities.definitionId[i])!;
    enemyHQ.tileX = 20;
    enemyHQ.tileY = 31;
    enemyHQ.started = true;
    enemyHQ.completedTick = -1;
    enemyHQ.builderId = null;
    enemyHQ.remainingTicks =
      enemyHQ.totalTicks - Math.floor(enemyHQ.totalTicks / 8);
    s.entities.x[i] = (20 + d.width / 2) * 256;
    s.entities.y[i] = (31 + d.height / 2) * 256;
    s.entities.health[i] = Math.max(
      1,
      Math.floor(
        (d.health * (enemyHQ.totalTicks - enemyHQ.remainingTicks)) /
          enemyHQ.totalTicks,
      ),
    );
    s.combat!.targetIds = [enemyHQ.entityId];
    s.map.obstacleVersion++;
    recomputeSupply(s);
  }
  synchronizeCombat(s);
}
/** Original collision boxes; fixed coordinates use eight units per original pixel. */
export function weaponInRange(s: SimulationState, a: number, b: number) {
  const e = s.entities,
    w = weaponFor(e.definitionId[a], e.layer[b]),
    p = combatProfile(e.definitionId[a]),
    q = combatProfile(e.definitionId[b]);
  if (!w || !p || !q) return false;
  const dx = Math.max(
    0,
    e.x[b] - q.bounds[0] * 8 - (e.x[a] + p.bounds[2] * 8),
    e.x[a] - p.bounds[0] * 8 - (e.x[b] + q.bounds[2] * 8),
  );
  const dy = Math.max(
    0,
    e.y[b] - q.bounds[1] * 8 - (e.y[a] + p.bounds[3] * 8),
    e.y[a] - p.bounds[1] * 8 - (e.y[b] + q.bounds[3] * 8),
  );
  return (
    dx * dx + dy * dy <= (w.wpnMaxRange * 8) ** 2 &&
    dx * dx + dy * dy >= (w.wpnMinRange * 8) ** 2
  );
}
/** HP is stored in 1/256 units while the public entity column remains ceiling integer HP. */
export function hitPoints(
  health: number,
  shield: number,
  damage: number,
  armor: number,
  size: string,
  type: string,
) {
  const absorbed = Math.min(shield, damage);
  shield -= absorbed;
  damage -= absorbed;
  if (damage > 0) {
    const factor =
      type === "Concussive"
        ? size === "large"
          ? 64
          : size === "medium"
            ? 128
            : 256
        : type === "Explosive"
          ? size === "small"
            ? 128
            : size === "medium"
              ? 192
              : 256
          : 256;
    health = Math.max(
      0,
      health -
        Math.max(
          128,
          Math.floor((Math.max(0, damage - armor * 256) * factor) / 256),
        ),
    );
  }
  return { health, shield };
}
function validTarget(
  s: SimulationState,
  a: number,
  b: number,
  visible: VisibilityCheck,
) {
  const e = s.entities;
  return (
    b >= 0 &&
    a !== b &&
    e.owner[a] !== e.owner[b] &&
    e.health[b] > 0 &&
    !!weaponFor(e.definitionId[a], e.layer[b]) &&
    visible(s, e.owner[a], b) &&
    !s.economy.structures.some((x) => x.entityId === e.id[b] && !x.started)
  );
}
export function combatReach(s: SimulationState, a: number, b: number) {
  return s.combat ? weaponInRange(s, a, b) : undefined;
}
function targetFor(s: SimulationState, a: number, visible: VisibilityCheck) {
  const m = s.movement[a],
    e = s.entities;
  if (m.order === "focusAttack") {
    const b = e.id.indexOf(m.targetEntityId!);
    return validTarget(s, a, b, visible) && weaponInRange(s, a, b) ? b : -1;
  }
  if (
    e.kind[a] !== "combat" ||
    !["idle", "hold", "attackMove"].includes(m.order)
  )
    return -1;
  let best = -1,
    distance = Infinity;
  for (let b = 0; b < e.id.length; b++)
    if (
      e.owner[a] !== e.owner[b] &&
      weaponInRange(s, a, b) &&
      validTarget(s, a, b, visible)
    ) {
      const d = (e.x[a] - e.x[b]) ** 2 + (e.y[a] - e.y[b]) ** 2;
      if (d < distance) {
        best = b;
        distance = d;
      }
    }
  return best;
}
function resumeAttackMove(s: SimulationState, a: number) {
  const r = s.combat!.records[a],
    m = s.movement[a],
    target = r.resumeTarget;
  if (!target) return;
  const style = { formation: m.formation, stance: m.stance };
  Object.assign(m, idleMovement(m.entityId), style, {
    order: "attackMove",
    target: { ...target },
    origin: { x: s.entities.x[a], y: s.entities.y[a] },
    status: "waiting",
    requestTick: s.tick,
    priority: 0,
    obstacleVersion: s.map.obstacleVersion,
  });
  r.resumeTarget = null;
  s.navigation.jobs = s.navigation.jobs.filter(
    (j) => j.entityId !== m.entityId,
  );
}
function acquireAttackMove(
  s: SimulationState,
  a: number,
  visible: VisibilityCheck,
) {
  const e = s.entities,
    m = s.movement[a];
  if (m.order !== "attackMove" || e.kind[a] !== "combat") return;
  const sight = (economyDefinition(e.definitionId[a])?.sight ?? 0) * 256;
  let best = -1,
    distance = sight * sight + 1;
  for (let b = 0; b < e.id.length; b++) {
    const d = (e.x[a] - e.x[b]) ** 2 + (e.y[a] - e.y[b]) ** 2;
    if (d < distance && d <= sight * sight && validTarget(s, a, b, visible)) {
      best = b;
      distance = d;
    }
  }
  if (best < 0) return;
  s.combat!.records[a].resumeTarget = m.target ? { ...m.target } : null;
  m.order = "focusAttack";
  m.targetEntityId = e.id[best];
  m.trackedTarget = { x: e.x[best], y: e.y[best] };
  m.target = { x: e.x[best], y: e.y[best] };
  m.path = [];
  m.pathIndex = 0;
  m.status = "waiting";
  m.requestTick = s.tick;
  s.navigation.jobs = s.navigation.jobs.filter(
    (j) => j.entityId !== m.entityId,
  );
}

function effect(
  s: SimulationState,
  kind: "shot" | "slash" | "death" | "launch" | "impact" | "miss",
  a: number,
  b = a,
  weaponId?: string,
) {
  const e = s.entities;
  s.combat!.effects.push({
    id: allocateId(s, "nextEventId"),
    tick: s.tick,
    kind,
    ...(weaponId ? { weaponId } : {}),
    owner: e.owner[a],
    x: e.x[a],
    y: e.y[a],
    toX: e.x[b],
    toY: e.y[b],
  });
  s.combat!.effects = s.combat!.effects.slice(-128);
}
export function createCombatRules(
  base: EngineRules,
  visible: VisibilityCheck,
  map?: BattleMap,
): EngineRules {
  const commands = { ...base.commands },
    focus = commands.focusAttack!;
  commands.focusAttack = {
    ...focus,
    validate: (s, c, id) => {
      const failure = focus.validate(s, c, id);
      if (failure || !s.combat || c.kind !== "focusAttack") return failure;
      return weaponFor(
        s.entities.definitionId[s.entities.id.indexOf(id)],
        s.entities.layer[s.entities.id.indexOf(c.target.entityId)],
      )
        ? null
        : "invalid_target";
    },
  };
  // Explicit player work/movement replaces any interrupted attack-move journey.
  for (const kind of [
    "move",
    "attackMove",
    "focusAttack",
    "patrol",
    "stop",
    "hold",
    "gather",
    "returnCargo",
    "autoGather",
    "placeBuilding",
    "resumeConstruction",
  ] as const) {
    const baseHandler = commands[kind];
    if (!baseHandler) continue;
    commands[kind] = {
      ...baseHandler,
      apply: (s, c, ids) => {
        if (s.combat)
          for (const r of s.combat.records)
            if (ids.includes(r.entityId)) {
              r.resumeTarget = null;
              r.lastSeenTarget = null;
            }
        baseHandler.apply(s, c, ids);
      },
    };
  }
  return {
    commands,
    systems: {
      ...base.systems,
      pathfinding: (s) => {
        if (s.combat) {
          synchronizeCombat(s);
          s.combat.effects = s.combat.effects.filter(
            (e) => s.tick - e.tick <= 8,
          );
          for (let a = 0; a < s.entities.id.length; a++) {
            const m = s.movement[a],
              r = s.combat.records[a];
            if (
              r.resumeTarget &&
              (m.order !== "focusAttack" ||
                !validTarget(
                  s,
                  a,
                  s.entities.id.indexOf(m.targetEntityId!),
                  visible,
                ))
            )
              resumeAttackMove(s, a);
            acquireAttackMove(s, a, visible);
            if (m.order !== "focusAttack") continue;
            const b = s.entities.id.indexOf(m.targetEntityId!);
            if (!validTarget(s, a, b, visible)) {
              const target = m.trackedTarget ?? m.target;
              Object.assign(m, idleMovement(m.entityId));
              if (target) {
                m.order = "move";
                m.target = target;
                m.status = "waiting";
                m.requestTick = s.tick;
              }
              s.navigation.jobs = s.navigation.jobs.filter(
                (j) => j.entityId !== m.entityId,
              );
            }
          }
        }
        base.systems?.pathfinding?.(s);
      },
      movement: (s) => {
        const frozen: {
          index: number;
          status: SimulationState["movement"][number]["status"];
        }[] = [];
        if (s.combat)
          for (let a = 0; a < s.entities.id.length; a++)
            if (
              s.movement[a].order === "attackMove" &&
              targetFor(s, a, visible) >= 0
            ) {
              frozen.push({ index: a, status: s.movement[a].status });
              s.movement[a].status = "arrived";
            }
        base.systems?.movement?.(s);
        for (const f of frozen) s.movement[f.index].status = f.status;
      },
      targeting: (s) => {
        base.systems?.targeting?.(s);
        if (!s.combat) return;
        for (let a = 0; a < s.entities.id.length; a++) {
          const m = s.movement[a],
            b = s.entities.id.indexOf(m.targetEntityId!);
          if (m.order === "focusAttack" && validTarget(s, a, b, visible))
            s.combat.records[a].lastSeenTarget = {
              x: s.entities.x[b],
              y: s.entities.y[b],
            };
        }
      },
      damage: (s) => {
        base.systems?.damage?.(s);
        if (!s.combat) return;
        synchronizeCombat(s);
        const e = s.entities,
          shots: {
            a: number;
            b: number;
            damage: number;
            hits: number;
            type: string;
            weaponId?: string;
          }[] = [];
        const flying: typeof s.combat.projectiles = [];
        for (const bullet of s.combat.projectiles) {
          const b = e.id.indexOf(bullet.targetId),
            rule = projectileRule(bullet.weaponId);
          if (
            b < 0 ||
            e.health[b] === 0 ||
            e.owner[b] === bullet.owner ||
            e.layer[b] !== bullet.targetLayer ||
            s.tick >= bullet.expiresTick
          ) {
            continue;
          }
          const dx = e.x[b] - bullet.x,
            dy = e.y[b] - bullet.y,
            distance = integerSqrt(dx * dx + dy * dy),
            travel = integrate(rule.speed, bullet.remainder);
          bullet.remainder = travel.remainder;
          if (distance <= travel.delta) {
            if (!bullet.miss)
              shots.push({
                a: -1,
                b,
                damage: bullet.damage,
                hits: bullet.hits,
                type: combatWeapon(bullet.weaponId)!.damageType,
                weaponId: bullet.weaponId,
              });
            s.combat.effects.push({
              id: allocateId(s, "nextEventId"),
              tick: s.tick,
              kind: bullet.miss ? "miss" : "impact",
              weaponId: bullet.weaponId,
              owner: bullet.owner,
              x: e.x[b],
              y: e.y[b],
              toX: e.x[b],
              toY: e.y[b],
            });
            s.combat.effects = s.combat.effects.slice(-128);
          } else {
            bullet.x += Math.trunc((dx * travel.delta) / distance);
            bullet.y += Math.trunc((dy * travel.delta) / distance);
            flying.push(bullet);
          }
        }
        s.combat.projectiles = flying;
        for (let a = 0; a < e.id.length; a++) {
          const r = s.combat.records[a];
          if (
            e.health[a] === 0 ||
            s.tick < r.nextAttackTick ||
            e.kind[a] === "building"
          )
            continue;
          const b = targetFor(s, a, visible);
          if (b < 0) continue;
          const w = weaponFor(e.definitionId[a], e.layer[b])!,
            p = combatProfile(e.definitionId[a])!;
          const level =
            s.economy.upgrades.find(
              (u) =>
                u.playerId === e.owner[a] &&
                u.technologyId === economyId(w.upgrade),
            )?.level ?? 0;
          const flight = projectileRule(w.name);
          if (flight && s.combat.projectiles.length >= MAX_COMBAT_PROJECTILES)
            continue;
          const frames = w.wpnDamageCooldowns * 5 + r.remainder;
          r.nextAttackTick = s.tick + Math.max(1, Math.floor(frames / 6));
          r.remainder = frames % 6;
          const miss =
            !!map &&
            w.wpnMaxRange > 32 &&
            uphillAttack(s, map, a, b) &&
            (nextUint32(s.rngStreams, "combat") & 1) === 0;
          const damage =
            (w.defaultWpnDamageAmt + w.defaultWpnDamageBonus * level) * 256;
          if (flight) {
            s.combat.projectiles.push({
              id: allocateId(s, "nextProjectileId"),
              sourceId: e.id[a],
              owner: e.owner[a],
              targetId: e.id[b],
              targetLayer: e.layer[b],
              weaponId: w.name as "Fragmentation_Grenade" | "Phase_Disruptor",
              x: e.x[a],
              y: e.y[a],
              spawnTick: s.tick,
              expiresTick: s.tick + flight.lifetime,
              remainder: 0,
              damage,
              miss,
              hits: p.hits,
            });
            effect(s, "launch", a, a, w.name);
          } else {
            if (!miss)
              shots.push({
                a,
                b,
                damage,
                hits: p.hits,
                type: w.damageType,
                weaponId: w.name,
              });
            effect(s, w.wpnMaxRange >= 128 ? "shot" : "slash", a, b, w.name);
            if (miss) effect(s, "miss", a, b, w.name);
          }
        }
        // Every shot is collected before damage: simultaneous lethal attacks both resolve.
        for (const shot of shots) {
          const r = s.combat.records[shot.b],
            d = economyDefinition(e.definitionId[shot.b])!,
            p = combatProfile(d.id)!;
          let health = e.health[shot.b] * 256 - r.healthFraction,
            shield = e.shield[shot.b] * 256 - r.shieldFraction;
          for (let hit = 0; hit < shot.hits; hit++)
            ({ health, shield } = hitPoints(
              health,
              shield,
              shot.damage,
              d.armor,
              p.size,
              shot.type,
            ));
          e.health[shot.b] = Math.ceil(health / 256);
          e.shield[shot.b] = Math.ceil(shield / 256);
          r.healthFraction = e.health[shot.b] * 256 - health;
          r.shieldFraction = e.shield[shot.b] * 256 - shield;
        }
      },
      lifecycle: (s) => {
        if (s.combat) {
          for (const id of [...s.entities.id]) {
            const i = s.entities.id.indexOf(id);
            if (s.entities.health[i] === 0) {
              effect(s, "death", i);
              removeEntity(s, id);
            }
          }
          synchronizeCombat(s);
        }
        base.systems?.lifecycle?.(s);
      },
    },
  };
}

export function combatFitsMap(
  s: SimulationState,
  map: { widthTiles: number; heightTiles: number },
) {
  return (
    !s.combat ||
    (s.combat.records.every(
      (r) =>
        !r.lastSeenTarget ||
        (r.lastSeenTarget.x < map.widthTiles * 256 &&
          r.lastSeenTarget.y < map.heightTiles * 256),
    ) &&
      s.combat.projectiles.every(
        (p) => p.x < map.widthTiles * 256 && p.y < map.heightTiles * 256,
      ) &&
      s.combat.records.every(
        (r) =>
          !r.resumeTarget ||
          (r.resumeTarget.x < map.widthTiles * 256 &&
            r.resumeTarget.y < map.heightTiles * 256),
      ) &&
      s.combat.effects.every(
        (e) =>
          e.x < map.widthTiles * 256 &&
          e.toX < map.widthTiles * 256 &&
          e.y < map.heightTiles * 256 &&
          e.toY < map.heightTiles * 256,
      ))
  );
}
