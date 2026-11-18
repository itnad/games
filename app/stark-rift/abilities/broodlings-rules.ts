import type { EngineRules } from "../core/simulation";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { idleMovement } from "../core/orders";
import { allocateId,MAX_ENTITIES,removeEntity } from "../core/world";
import { NavigationGrid } from "../pathfinding/navigation";
import { bodyContains,isBlueprint } from "../economy/footprints";
import { createEconomicEntity } from "../economy/helpers";
import { economyDefinition } from "../data/economy-catalog";
import { synchronizeCombat } from "../combat/rules";
import { canSeeEntity } from "../vision/rules";
import { energyOf } from "./cloak-state";
import { isEmbarked } from "./special-state";
import { isBurrowed } from "./burrow";
import { spellLocked,isInStasis } from "./spells-state";
import { medicSpellInRange } from "./medic-spells-rules";
import { QUEEN,ENSNARE,queenCooldown } from "./queen-state";
import { PARASITE,parasiteCooldown } from "./parasite-state";
import { BROODLING,BROODLINGS,BROODLINGS_COOLDOWN,emptyBroodlings,broodlingsCooldown } from "./broodlings-state";
import original from "../data/broodlings-original.json";
const targets=new Set(original.targetableUnits.map(n=>n.toLowerCase().replaceAll("_","-")));
export const broodlingsTarget=(definition:string)=>targets.has(definition);
/** Authored collision policy: target is removed first; each spawn reserves a legal body. */
function spawnPoint(s:SimulationState,map:BattleMap,x:number,y:number){
 const d=economyDefinition(BROODLING)!,grid=new NavigationGrid(map,s),e=s.entities;
 const clear=(p:{x:number;y:number})=>grid.clear(p,d.radius,"ground")&&!e.id.some((id,i)=>e.health[i]>0&&e.layer[i]==="ground"&&!isBlueprint(s,i)&&!isBurrowed(s,id)&&!isEmbarked(s,id)&&bodyContains(s,i,p.x,p.y,d.radius));
 if(clear({x,y}))return {x,y};const cx=Math.floor(x/128),cy=Math.floor(y/128);
 for(let ring=0;ring<=4;ring++){const points:{x:number;y:number}[]=[];for(let dx=-ring;dx<=ring;dx++){const dy=ring-Math.abs(dx);for(const yy of dy?[cy-dy,cy+dy]:[cy])points.push({x:(cx+dx)*128+64,y:yy*128+64});}points.sort((a,b)=>(a.x-x)**2+(a.y-y)**2-(b.x-x)**2-(b.y-y)**2||a.y-b.y||a.x-b.x);const p=points.find(clear);if(p)return p;}
 return null;
}
export function createBroodlingsRules(map:BattleMap,base:EngineRules):EngineRules{
 const fallback=base.commands?.castAbility;
 return {...base,commands:{...base.commands,castAbility:{policy:"partial",validate:(s,c,id)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==BROODLINGS){if(c.kind==="castAbility"&&[PARASITE,ENSNARE].includes(c.payload.abilityId)&&broodlingsCooldown(s,id))return "invalid_state";return fallback?fallback.validate(s,c,id):"invalid_command";}
  const e=s.entities,i=e.id.indexOf(id);if(!s.economy.enabled||!s.combat||c.entityIds.length!==1||c.target.kind!=="entity"||e.definitionId[i]!==QUEEN)return "invalid_target";
  if(spellLocked(s,id)||isEmbarked(s,id)||queenCooldown(s,id)||parasiteCooldown(s,id)||broodlingsCooldown(s,id))return "invalid_state";
  if(!s.economy.upgrades.some(u=>u.playerId===c.playerId&&u.technologyId===BROODLINGS))return "missing_prerequisite";
  const j=e.id.indexOf(c.target.entityId);if(j<0||e.health[j]<=0||e.kind[j]==="building"||e.layer[j]!=="ground"||!broodlingsTarget(e.definitionId[j])||isEmbarked(s,e.id[j])||isInStasis(s,e.id[j])||!canSeeEntity(s,map,c.playerId,j))return "invalid_target";
  if(!medicSpellInRange(s,id,e.id[j],original.technology.rangePixels))return "out_of_range";
  return(energyOf(s,id)?.amount??0)<original.technology.energy*256?"insufficient_resource":null;
 },apply:(s,c,ids)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==BROODLINGS||c.target.kind!=="entity"){fallback?.apply(s,c,ids);return;}
  const id=ids[0],e=s.entities,i=e.id.indexOf(id),j=e.id.indexOf(c.target.entityId),x=e.x[j],y=e.y[j];energyOf(s,id)!.amount-=original.technology.energy*256;s.broodlings??=emptyBroodlings();const b=s.broodlings;
  const m=s.movement[i],style={formation:m.formation,stance:m.stance};Object.assign(m,idleMovement(id),style);s.navigation.jobs=s.navigation.jobs.filter(v=>v.entityId!==id);
  b.cooldowns.push({entityId:id,appliedTick:s.tick,expiresTick:s.tick+BROODLINGS_COOLDOWN});b.cooldowns.sort((a,b)=>a.entityId-b.entityId);
  removeEntity(s,c.target.entityId);
  for(const offset of [-16,16]){if(e.id.length>=MAX_ENTITIES)break;const p=spawnPoint(s,map,x+offset,y+offset);if(p)createEconomicEntity(s,c.playerId,economyDefinition(BROODLING)!,p);}
  synchronizeCombat(s);b.effects.push({id:allocateId(s,"nextEventId"),owner:c.playerId,tick:s.tick,x,y});b.effects=b.effects.slice(-128);
 }}},systems:{...base.systems,construction:s=>{
  if(s.broodlings){for(const r of [...s.broodlings.records])if(r.expiresTick<=s.tick)removeEntity(s,r.entityId);s.broodlings.cooldowns=s.broodlings.cooldowns.filter(r=>r.expiresTick>s.tick);s.broodlings.effects=s.broodlings.effects.filter(r=>s.tick-r.tick<=20);}
  base.systems?.construction?.(s);
 }}};
}
