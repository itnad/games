import type { EngineRules } from "../core/simulation";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { idleMovement } from "../core/orders";
import { allocateId } from "../core/world";
import { NavigationGrid } from "../pathfinding/navigation";
import { SpatialHash } from "../pathfinding/spatial-hash";
import { combatProfile } from "../combat/catalog";
import { releaseWork, workerOf } from "../economy/helpers";
import { energyOf, ENERGY } from "./cloak-state";
import { isBurrowed } from "./burrow";
import { isEmbarked } from "./special-state";
import { siegeTransitionOf } from "./siege-state";
import { ARBITER } from "./arbiter";
import { emptySpells, isInStasis, recallOf, spellLocked, RECALL, RECALL_TICKS, STASIS, STASIS_TICKS } from "./spells-state";
import original from "../data/spells-original.json";
function stop(s: SimulationState, id: number) {
  const i = s.entities.id.indexOf(id); if (i < 0) return;
  const m = s.movement[i], style = { formation: m.formation, stance: m.stance };
  Object.assign(m, idleMovement(id), style, { order: s.entities.kind[i] === "worker" ? "idle" : "hold" });
  s.navigation.jobs = s.navigation.jobs.filter(j => j.entityId !== id);
  const r = s.combat?.records.find(r => r.entityId === id); if (r) { r.resumeTarget = null; r.lastSeenTarget = null; }
}
/** Original square-area queries intersect body hitboxes rather than just their centres. */
export function spellArea(s: SimulationState, i: number, x: number, y: number, halfWidth: number) {
  const p = combatProfile(s.entities.definitionId[i]); if (!p) return false;
  return s.entities.x[i] + p.bounds[2] * 8 >= x - halfWidth && s.entities.x[i] - p.bounds[0] * 8 <= x + halfWidth && s.entities.y[i] + p.bounds[3] * 8 >= y - halfWidth && s.entities.y[i] - p.bounds[1] * 8 <= y + halfWidth;
}
function effect(s: SimulationState, kind: "recall" | "stasis-field", owner: number, x: number, y: number) {
  s.spells ??= emptySpells(); s.spells.effects.push({ id: allocateId(s, "nextEventId"), kind, owner, x, y, tick: s.tick }); s.spells.effects = s.spells.effects.slice(-128);
}
function landing(s: SimulationState, map: BattleMap, i: number, x: number, y: number) {
  const e = s.entities, grid = new NavigationGrid(map, s), hash = new SpatialHash(s);
  const clear = (p: { x: number; y: number }) => grid.clear(p, e.radius[i], e.layer[i], e.id[i]) && !hash.overlaps(i, p.x, p.y);
  const origin = { x, y }; if (clear(origin)) return origin;
  const cx = Math.floor(x / 128), cy = Math.floor(y / 128);
  for (let ring = 0; ring <= 12; ring++) {
    const points: { x: number; y: number }[] = [];
    for (let dx = -ring; dx <= ring; dx++) { const dy = ring - Math.abs(dx); for (const yy of dy ? [cy - dy, cy + dy] : [cy]) points.push({ x: (cx + dx) * 128 + 64, y: yy * 128 + 64 }); }
    points.sort((a,b) => (a.x-x)**2+(a.y-y)**2-(b.x-x)**2-(b.y-y)**2 || a.y-b.y || a.x-b.x);
    const found = points.find(clear); if (found) return found;
  }
  return null;
}
export function resolveRecall(s: SimulationState, map: BattleMap, caster: number, x: number, y: number) {
  const e = s.entities, a = e.id.indexOf(caster); if (a < 0) return;
  const ids = e.id.filter((id,i) => id !== caster && e.owner[i] === e.owner[a] && e.health[i] > 0 && e.kind[i] !== "building" && e.definitionId[i] !== "zerg-lurker-egg" && !isBurrowed(s,id) && !isEmbarked(s,id) && !isInStasis(s,id) && !siegeTransitionOf(s,id) && spellArea(s,i,x,y,original.recall.halfWidthPixels*8));
  for (const id of ids) {
    const i = e.id.indexOf(id), point = landing(s,map,i,e.x[a],e.y[a]); if (!point) continue;
    const w = workerOf(s,id); if (w) releaseWork(s,w,false); stop(s,id);
    // Teleportation breaks incoming tracking and old boarding/unload reservations.
    s.combat!.projectiles = s.combat!.projectiles.filter(p => p.targetId !== id);
    for (const m of s.movement) if (m.targetEntityId === id) stop(s,m.entityId);
    for (const t of s.special?.transports ?? []) {
      t.loadQueue = t.loadQueue.filter(pid => pid !== id);
      if (t.entityId === id) { for (const pid of t.loadQueue) stop(s,pid); t.loadQueue = []; t.unloads = []; }
    }
    e.x[i] = point.x; e.y[i] = point.y;
    for (const t of s.special?.transports ?? []) if (t.entityId === id) for (const pid of t.passengers) { const j = e.id.indexOf(pid); e.x[j] = point.x; e.y[j] = point.y; }
    effect(s,RECALL,e.owner[i],point.x,point.y);
  }
  s.map.obstacleVersion++;
}
export function createSpellsRules(map: BattleMap, base: EngineRules): EngineRules {
  const commands = { ...base.commands };
  for (const kind of Object.keys(commands) as (keyof typeof commands)[]) {
    const h = commands[kind]!; commands[kind] = { ...h, validate: (s,c,id) => spellLocked(s,id) && !["assignGroup","setFormation","setStance"].includes(c.kind) ? "invalid_state" :
      "target" in c && c.target.kind === "entity" && ["focusAttack","loadTransport","resumeConstruction"].includes(c.kind) && isInStasis(s,c.target.entityId) ? "invalid_target" : h.validate(s,c,id) };
  }
  const fallback = commands.castAbility;
  commands.castAbility = { policy: "atomic", validate: (s,c,id) => {
    if (c.kind !== "castAbility" || ![RECALL,STASIS].includes(c.payload.abilityId)) return fallback ? fallback.validate(s,c,id) : "invalid_command";
    if (c.entityIds.length !== 1 || c.target.kind !== "point" || !s.economy.enabled || !s.combat) return "invalid_target";
    const i = s.entities.id.indexOf(id), target = c.target, tech = original.technologies.find(t => t.name.toLowerCase().replaceAll("_","-") === c.payload.abilityId)!;
    if (s.entities.definitionId[i] !== ARBITER) return "invalid_target";
    if (spellLocked(s,id) || isEmbarked(s,id)) return "invalid_state";
    if (!s.economy.upgrades.some(u => u.playerId === c.playerId && u.technologyId === c.payload.abilityId)) return "missing_prerequisite";
    if ((energyOf(s,id)?.amount ?? 0) < tech.energy*ENERGY.scale) return "insufficient_resource";
    if (target.x < 0 || target.y < 0 || target.x >= map.widthTiles*256 || target.y >= map.heightTiles*256) return "out_of_range";
    if (c.payload.abilityId === STASIS) { const p = combatProfile(ARBITER)!.bounds, dx = Math.max(0,s.entities.x[i]-p[0]*8-target.x,target.x-s.entities.x[i]-p[2]*8), dy = Math.max(0,s.entities.y[i]-p[1]*8-target.y,target.y-s.entities.y[i]-p[3]*8); if (dx*dx+dy*dy > (original.stasis.rangePixels*8)**2) return "out_of_range"; }
    return null;
  }, apply: (s,c,ids) => {
    if (c.kind !== "castAbility" || c.target.kind !== "point" || ![RECALL,STASIS].includes(c.payload.abilityId)) { fallback?.apply(s,c,ids); return; }
    const id = ids[0], i = s.entities.id.indexOf(id), {x,y} = c.target, tech = original.technologies.find(t => t.name.toLowerCase().replaceAll("_","-") === c.payload.abilityId)!;
    energyOf(s,id)!.amount -= tech.energy*ENERGY.scale; s.spells ??= emptySpells(); stop(s,id); effect(s,c.payload.abilityId as "recall"|"stasis-field",c.playerId,x,y);
    if (c.payload.abilityId === RECALL) s.spells.recalls.push({entityId:id,remainingTicks:RECALL_TICKS,x,y});
    else for (let j=0;j<s.entities.id.length;j++) {
      const eid=s.entities.id[j]; if(j===i || s.entities.health[j]===0 || s.entities.kind[j]==="building" || isInStasis(s,eid) || isBurrowed(s,eid) || isEmbarked(s,eid) || !spellArea(s,j,x,y,original.stasis.halfWidthPixels*8)) continue;
      stop(s,eid);s.spells.stasis.push({entityId:eid,x:s.entities.x[j],y:s.entities.y[j],appliedTick:s.tick,expiresTick:s.tick+STASIS_TICKS});
    }
    s.spells.stasis.sort((a,b)=>a.entityId-b.entityId);s.spells.recalls.sort((a,b)=>a.entityId-b.entityId);s.map.obstacleVersion++;
  } };
  return { ...base, commands, systems: { ...base.systems, construction: (s) => {
    if (s.spells) {
      s.spells.stasis = s.spells.stasis.filter(r=>r.expiresTick>s.tick);
      s.spells.effects = s.spells.effects.filter(r=>s.tick-r.tick<=20);
      for (const r of s.spells.recalls) if (!isInStasis(s,r.entityId) && --r.remainingTicks===0) resolveRecall(s,map,r.entityId,r.x,r.y);
      s.spells.recalls = s.spells.recalls.filter(r=>r.remainingTicks>0);
    }
    base.systems?.construction?.(s);
  } } };
}
