import type {EngineRules} from "../core/simulation";
import type {BattleMap} from "../data/maps";
import {visibilityMask} from "../vision/rules";
import {spellLocked} from "./spells-state";
import {isEmbarked} from "./special-state";
import {queenCooldown} from "./queen-state";
import {parasiteCooldown} from "./parasite-state";
import {broodlingsCooldown} from "./broodlings-state";
import {queenAutoCommand,queenEntityAutocastTarget,queenEnsnareAutocastTarget} from "./queen-autocast-targets";
import {QUEEN_AUTO_ABILITIES,QUEEN_AUTO_GRACE,QUEEN_AUTO_INTERVAL,QUEEN_AUTO_BUDGET,isQueenAutoAbility,queenAutocastOf,setQueenAutocast} from "./queen-autocast-state";
const MANUAL=new Set(["move","attackMove","focusAttack","stop","hold","patrol","castAbility","loadTransport","unloadTransport"]);
export function createQueenAutocastRules(map:BattleMap,base:EngineRules):EngineRules{
 const commands={...base.commands},fallback=commands.toggleAutocast,cast=base.commands?.castAbility;
 for(const kind of Object.keys(commands)as(keyof typeof commands)[]){const h=commands[kind]!;commands[kind]={...h,apply:(s,c,ids)=>{
  h.apply(s,c,ids);
  if(MANUAL.has(c.kind))for(const id of ids){const r=queenAutocastOf(s,id);if(r)r.manualUntilTick=s.tick+QUEEN_AUTO_GRACE;}
  if(c.kind==="assignGroup"){const g=s.players[c.playerId].controlGroups[c.payload.slot];if(ids.every(id=>s.entities.definitionId[s.entities.id.indexOf(id)]==="zerg-queen")){const enabled=QUEEN_AUTO_ABILITIES.filter(a=>g.autocastAbilityIds.includes(a));for(const id of ids)setQueenAutocast(s,id,enabled);}else{g.autocastAbilityIds=g.autocastAbilityIds.filter(a=>!isQueenAutoAbility(a));if(g.autocastConfiguredAbilityIds)g.autocastConfiguredAbilityIds=g.autocastConfiguredAbilityIds.filter(a=>!isQueenAutoAbility(a));}}
 }};}
 commands.toggleAutocast={policy:"atomic",validate:(s,c,id)=>{
  if(c.kind!=="toggleAutocast"||!isQueenAutoAbility(c.payload.abilityId))return fallback?fallback.validate(s,c,id):"invalid_command";
  return s.economy.enabled&&s.combat&&s.entities.definitionId[s.entities.id.indexOf(id)]==="zerg-queen"?null:"invalid_target";
 },apply:(s,c,ids)=>{
  if(c.kind!=="toggleAutocast"||!isQueenAutoAbility(c.payload.abilityId)){fallback?.apply(s,c,ids);return;}
  const ability=c.payload.abilityId;for(const id of ids){const old=queenAutocastOf(s,id)?.abilityIds??[];setQueenAutocast(s,id,c.payload.enabled?[...old,ability]:old.filter(a=>a!==ability));}
  for(const g of s.players[c.playerId].controlGroups)if(g.entityIds.length&&g.entityIds.every(id=>ids.includes(id))){g.autocastAbilityIds=g.autocastAbilityIds.filter(a=>a!==ability);if(c.payload.enabled)g.autocastAbilityIds.push(ability);}
 }};
 return {...base,commands,systems:{...base.systems,targeting:s=>{
  base.systems?.targeting?.(s);
  const rows=s.queenAutocast?.records??[];if(!cast||!rows.length||s.tick%QUEEN_AUTO_INTERVAL!==0)return;
  const ids=rows.map(r=>r.entityId),offset=(Math.floor(s.tick/QUEEN_AUTO_INTERVAL)*QUEEN_AUTO_BUDGET)%ids.length,masks=new Map<number,Uint8Array>();
  for(let n=0;n<Math.min(QUEEN_AUTO_BUDGET,ids.length);n++){
   const id=ids[(offset+n)%ids.length],r=queenAutocastOf(s,id),e=s.entities,i=e.id.indexOf(id),m=s.movement[i];
   if(!r||i<0||r.manualUntilTick>=s.tick||spellLocked(s,id)||isEmbarked(s,id)||!(["idle","hold"].includes(m.order)||m.order==="move"&&m.status==="arrived"))continue;
   const owner=e.owner[i];if(!masks.has(owner))masks.set(owner,visibilityMask(s,map,owner));const mask=masks.get(owner)!,validate=(c:ReturnType<typeof queenAutoCommand>)=>cast.validate(s,c,id);
   let command=r.abilityIds.includes("infestation")?queenEntityAutocastTarget(s,map,id,"infestation",mask,validate)?.command:null;
   if(!command&&(queenCooldown(s,id)||parasiteCooldown(s,id)||broodlingsCooldown(s,id)))continue;
   if(!command&&r.abilityIds.includes("ensnare")&&cast.validate(s,queenAutoCommand(s,id,"ensnare",{kind:"point",x:e.x[i],y:e.y[i]}),id)===null)command=queenEnsnareAutocastTarget(s,map,id,mask,validate);
   let reserving=false;if(!command&&r.abilityIds.includes("spawn-broodlings")&&s.economy.upgrades.some(u=>u.playerId===owner&&u.technologyId==="spawn-broodlings")){const target=queenEntityAutocastTarget(s,map,id,"spawn-broodlings",mask,validate);reserving=!!target?.reserving;if(target&&!target.reserving)command=target.command;}
   if(!command&&!reserving&&r.abilityIds.includes("parasite")&&cast.validate(s,queenAutoCommand(s,id,"parasite",{kind:"entity",entityId:id}),id)===null)command=queenEntityAutocastTarget(s,map,id,"parasite",mask,validate)?.command;
   if(command&&cast.validate(s,command,id)===null){cast.apply(s,command,[id]);masks.clear();}
  }
 }}};
}
