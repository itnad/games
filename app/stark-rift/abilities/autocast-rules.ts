import type { EngineRules } from "../core/simulation";
import type { SimulationState } from "../core/state";
import type { GameCommand } from "../core/commands";
import type { BattleMap } from "../data/maps";
import { canSeeEntity, visibilityMask } from "../vision/rules";
import { combatProfile } from "../combat/catalog";
import { isBurrowed } from "./burrow";
import { isEmbarked } from "./special-state";
import { ARBITER } from "./arbiter";
import { isInStasis, spellLocked, STASIS } from "./spells-state";
import { spellArea } from "./spells-rules";
import { AUTO_STASIS, autocastOf, setStasisAutocast, MANUAL_GRACE_TICKS } from "./autocast-state";
import original from "../data/spells-original.json";

const MANUAL = new Set(["move", "attackMove", "focusAttack", "stop", "hold", "patrol", "castAbility", "loadTransport", "unloadTransport"]);
const eligible = (s: SimulationState, i: number) => s.entities.health[i] > 0 && s.entities.kind[i] !== "building" &&
  !!combatProfile(s.entities.definitionId[i]) && !isInStasis(s,s.entities.id[i]) && !isBurrowed(s,s.entities.id[i]) && !isEmbarked(s,s.entities.id[i]);

/** All candidate coordinates come from visible bodies; hidden enemies never affect scoring. */
export function stasisAutocastTarget(s: SimulationState, map: BattleMap, id: number, mask: Uint8Array, validate: (c: GameCommand) => boolean) {
  const e = s.entities, i = e.id.indexOf(id), owner = e.owner[i], half = original.stasis.halfWidthPixels * 8;
  const enemies: number[] = [], friends: number[] = [];
  for (let j=0;j<e.id.length;j++) {
    if (e.owner[j] === owner) { if(j !== i && eligible(s,j)) friends.push(j); }
    else if (canSeeEntity(s,map,owner,j,mask) && eligible(s,j)) enemies.push(j);
  }
  const distance = (j:number) => (e.x[j]-e.x[i])**2+(e.y[j]-e.y[i])**2;
  const anchors = enemies.filter(j => distance(j) <= (12*256)**2).sort((a,b)=>distance(a)-distance(b)||e.id[a]-e.id[b]).slice(0,32);
  const points = anchors.map(j => ({ x:e.x[j], y:e.y[j] }));
  for (const a of anchors) {
    const b = anchors.filter(j=>j!==a).sort((u,v)=>(e.x[u]-e.x[a])**2+(e.y[u]-e.y[a])**2-(e.x[v]-e.x[a])**2-(e.y[v]-e.y[a])**2||e.id[u]-e.id[v])[0];
    if(b !== undefined) points.push({x:Math.floor((e.x[a]+e.x[b])/2),y:Math.floor((e.y[a]+e.y[b])/2)});
  }
  const scored: {x:number;y:number;count:number;distance:number}[] = [], seen = new Set<string>();
  for(const p of points) {
    const key=p.x+","+p.y; if(seen.has(key))continue;seen.add(key);
    if(mask[Math.floor(p.y/256)*map.widthTiles+Math.floor(p.x/256)] !== 2 || !validate(autoCommand(s,id,p)))continue;
    if(friends.some(j=>spellArea(s,j,p.x,p.y,half)))continue;
    const count=enemies.filter(j=>spellArea(s,j,p.x,p.y,half)).length;
    if(count>=2)scored.push({...p,count,distance:(p.x-e.x[i])**2+(p.y-e.y[i])**2});
  }
  return scored.sort((a,b)=>b.count-a.count||a.distance-b.distance||a.y-b.y||a.x-b.x)[0] ?? null;
}
function autoCommand(s:SimulationState,id:number,p:{x:number;y:number}):GameCommand {
  return {kind:"castAbility",entityIds:[id],payload:{abilityId:STASIS},target:{kind:"point",...p},playerId:s.entities.owner[s.entities.id.indexOf(id)],source:"ai",sequence:1,issuedTick:Math.max(0,s.tick-1),executeTick:s.tick};
}
export function createAutocastRules(map: BattleMap, base: EngineRules): EngineRules {
  const commands = {...base.commands}, cast = base.commands?.castAbility;
  for(const kind of Object.keys(commands) as (keyof typeof commands)[]) {
    const h = commands[kind]!;
    commands[kind] = {...h,apply:(s,c,ids)=>{
      h.apply(s,c,ids);
      if(MANUAL.has(c.kind))for(const id of ids){const r=autocastOf(s,id);if(r)r.manualUntilTick=s.tick+MANUAL_GRACE_TICKS;}
      if(c.kind === "assignGroup") {
        const g=s.players[c.playerId].controlGroups[c.payload.slot];
        if(ids.every(id=>s.entities.definitionId[s.entities.id.indexOf(id)]===ARBITER))
          for(const id of ids)setStasisAutocast(s,id,g.autocastAbilityIds.includes(AUTO_STASIS));
        else g.autocastAbilityIds=g.autocastAbilityIds.filter(a=>a!==AUTO_STASIS);
      }
    }};
  }
  commands.toggleAutocast = {policy:"atomic",validate:(s,c,id)=>{
    if(c.kind!=="toggleAutocast" || c.payload.abilityId!==AUTO_STASIS)return "invalid_command";
    if(!s.economy.enabled || !s.combat || s.entities.definitionId[s.entities.id.indexOf(id)]!==ARBITER)return "invalid_target";
    return null;
  },apply:(s,c,ids)=>{
    if(c.kind!=="toggleAutocast")return;
    for(const id of ids)setStasisAutocast(s,id,c.payload.enabled);
    for(const g of s.players[c.playerId].controlGroups)if(g.entityIds.length && g.entityIds.every(id=>ids.includes(id))) {
      g.autocastAbilityIds=g.autocastAbilityIds.filter(a=>a!==AUTO_STASIS);
      if(c.payload.enabled)g.autocastAbilityIds.push(AUTO_STASIS);
    }
  }};
  return {...base,commands,systems:{...base.systems,targeting:s=>{
    // Four casters every five ticks, rotated by stable ID; no unbounded per-tick search.
    if(cast && s.tick%5===0 && s.autocast?.records.length) {
      const records=s.autocast.records, offset=(Math.floor(s.tick/5)*4)%records.length, masks=new Map<number,Uint8Array>();
      for(let n=0;n<Math.min(4,records.length);n++) {
        const r=records[(offset+n)%records.length],i=s.entities.id.indexOf(r.entityId),m=s.movement[i];
        if(r.manualUntilTick>=s.tick || spellLocked(s,r.entityId) || isEmbarked(s,r.entityId) || !(["idle","hold"].includes(m.order) || m.order === "move" && m.status === "arrived"))continue;
        if(cast.validate(s,autoCommand(s,r.entityId,{x:s.entities.x[i],y:s.entities.y[i]}),r.entityId)!==null)continue;
        const owner=s.entities.owner[i];if(!masks.has(owner))masks.set(owner,visibilityMask(s,map,owner));
        const p=stasisAutocastTarget(s,map,r.entityId,masks.get(owner)!,c=>cast.validate(s,c,r.entityId)===null);
        if(p)cast.apply(s,autoCommand(s,r.entityId,p),[r.entityId]);
      }
    }
    base.systems?.targeting?.(s);
  }}};
}
