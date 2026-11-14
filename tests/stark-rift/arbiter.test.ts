import { describe, expect, it, vi } from "vitest";
import { ARBITER, ARBITER_RANGE, coveredByArbiter } from "../../app/stark-rift/abilities/arbiter";
import { createLurkerRules } from "../../app/stark-rift/abilities/lurker-rules";
import { createSiegeRules } from "../../app/stark-rift/abilities/siege-rules";
import { createCloakRules } from "../../app/stark-rift/abilities/cloak-rules";
import { activeCloak } from "../../app/stark-rift/abilities/cloak-state";
import { createSpecialRules } from "../../app/stark-rift/abilities/special-rules";
import { createBurrowRules } from "../../app/stark-rift/abilities/burrow-rules";
import { isEmbarked } from "../../app/stark-rift/abilities/special-state";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import { economyDefinition, ECONOMY_DATA_VERSION, LURKER_ECONOMY_DATA_VERSION, type Faction } from "../../app/stark-rift/data/economy-catalog";
import { initializeEconomy, createEconomicEntity, newStructure, recomputeSupply, workerOf, releaseWork, indexOf, structureOf, meetsRequirements } from "../../app/stark-rift/economy/helpers";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import { initializeCombat, synchronizeCombat, createCombatRules, combatReach } from "../../app/stark-rift/combat/rules";
import { combatProfile, weaponFor } from "../../app/stark-rift/combat/catalog";
import { LURKER_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { initializeVision, visibilityMask, canSeeEntity, createVisionRules } from "../../app/stark-rift/vision/rules";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import { startSimulation, enqueueCommand, stepSimulation } from "../../app/stark-rift/core/simulation";
import { createPersistenceEnvelope, restoreSnapshot, simulationStateSchema } from "../../app/stark-rift/core/state";
import { parse } from "../../app/stark-rift/core/validation";
import { checksum } from "../../app/stark-rift/core/checksum";
import { removeEntity } from "../../app/stark-rift/core/world";
import { createRenderSnapshot, validateRenderSnapshot } from "../../app/stark-rift/worker/render-snapshot";
import { DevelopmentSaveStore, DEVELOPMENT_SAVE_PREFIX } from "../../app/stark-rift/ui/development-saves";
import type { GameCommand } from "../../app/stark-rift/core/commands";
vi.setConfig({ testTimeout: 30000 });
const session = { camera: { centerX: 22 * 256, centerY: 20 * 256, zoomLevel: 1 as const }, selection: { entityIds: [], controlGroupIds: [] }, openPanel: null };
function fixture(race: Faction = "protoss", enemy: Faction = "terran") {
  const { map, dataVersion } = getRuntimeMap("rift-basin"); map.height.fill(0);
  const state = startSimulation(42, map.id, dataVersion, [0, 1].map((id) => ({ id, faction: id === 0 ? race : enemy, minerals: 1000, gas: 1000, supplyUsedHalf: 0, supplyCapHalf: 0 })));
  initializeEconomy(state, map); initializeCombat(state); initializeVision(state, map);
  for (const w of state.economy.workers) w.autoAllowed = false;
  const visible = (s: typeof state, p: number, i: number) => canSeeEntity(s, map, p, i);
  const rules = createSpecialRules(map, createLurkerRules(createSiegeRules(createCloakRules(createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map)))))));
  const tick = (n = 1) => { for (let i = 0; i < n; i++) stepSimulation(state, rules); };
  const issue = (body: object, owner = 0) => {
    const c = { ...body, sequence: state.commandState.lastAcceptedSequenceByPlayer[owner] + 1, issuedTick: state.tick, executeTick: state.tick + 1, playerId: owner, source: "player" } as GameCommand;
    expect(enqueueCommand(state, c, rules)).toEqual({ ok: true }); return stepSimulation(state, rules)[0];
  };
  const add = (owner: number, name: string, x = 40, y = 40) => {
    const d = economyDefinition(name)!, tx = Math.floor(x - d.width / 2), ty = Math.floor(y - d.height / 2),
      eid = createEconomicEntity(state, owner, d, { x: (d.kind === "building" ? tx + d.width / 2 : x) * 256, y: (d.kind === "building" ? ty + d.height / 2 : y) * 256 });
    if (d.kind === "building") state.economy.structures.push(newStructure(eid, d, tx, ty, true, state.tick));
    const w = workerOf(state, eid); if (w) releaseWork(state, w, false);
    recomputeSupply(state); synchronizeCombat(state); return eid;
  };
  const research = (id: string) => { if (!state.economy.upgrades.some(u => u.playerId === 0 && u.technologyId === id)) state.economy.upgrades.push({ playerId: 0, technologyId: id, level: 1 }); };
  const load = (ships: number[], passenger: number) => issue({ kind: "loadTransport", entityIds: ships, target: { kind: "entity", entityId: passenger } });
  const unload = (ships: number[], x = 40, y = 40) => issue({ kind: "unloadTransport", entityIds: ships, target: { kind: "point", x: x * 256, y: y * 256 } });
  const saved = () => createPersistenceEnvelope(state, session, [], "2026-11-12T00:00:00.000Z");
  const view = (owner = 0) => createRenderSnapshot(state, map, owner, visibilityMask(state, map, owner));
  return { state, map, rules, add, research, tick, issue, load, unload, saved, view };
}
describe('Arbiter production and passive cloak field', () => {
  it('uses original costs, supply, HP, weapons and both Stargate/Tribunal prerequisites', () => {
    const f = fixture(), stargate = economyDefinition('protoss-stargate')!, tribunal = economyDefinition('protoss-arbiter-tribunal')!;
    expect(economyDefinition(ARBITER)).toMatchObject({ minerals:100, gas:350, health:200, shield:150, supply:8, ticks:1000, producer:'protoss-stargate', requires:['protoss-arbiter-tribunal'] });
    expect(stargate).toMatchObject({ minerals:150, gas:150, ticks:438, requires:['protoss-cybernetics-core'] }); expect(tribunal).toMatchObject({ minerals:200, gas:150, ticks:375, requires:['protoss-stargate','protoss-templar-archives'] });
    expect(meetsRequirements(f.state,0,stargate)).toBe(false); f.add(0,'protoss-cybernetics-core'); expect(meetsRequirements(f.state,0,stargate)).toBe(true);
    expect(meetsRequirements(f.state,0,tribunal)).toBe(false); f.add(0,'protoss-stargate',44,40); expect(meetsRequirements(f.state,0,tribunal)).toBe(false);f.add(0,'protoss-templar-archives',48,40); expect(meetsRequirements(f.state,0,tribunal)).toBe(true);
    expect(weaponFor(ARBITER,'air')).toMatchObject({ name:'Phase_Disruptor_Cannon',defaultWpnDamageAmt:10,wpnMaxRange:160,wpnDamageCooldowns:45,damageType:'Explosive' });expect(weaponFor(ARBITER,'ground')).toEqual(weaponFor(ARBITER,'air'));
  });
  it('charges training costs, reserves four supply, refunds cancellation, and produces an air unit', () => {
    const f=fixture(),port=f.add(0,'protoss-stargate',42,40);f.add(0,'protoss-pylon',40,40);const c={kind:'produce',entityIds:[port],payload:{unitId:ARBITER}};
    expect(f.issue(c)).toMatchObject({accepted:false,code:'missing_prerequisite'});f.add(0,'protoss-arbiter-tribunal',44,44);const used=f.state.players[0].supplyUsedHalf;
    expect(f.issue(c).accepted).toBe(true);expect(f.state.players[0]).toMatchObject({minerals:900,gas:650,supplyUsedHalf:used+8});const entry=structureOf(f.state,port)!.queue[0];expect(entry.totalTicks).toBe(1000);
    expect(f.issue({kind:'cancelProduction',entityIds:[port],payload:{queueEntryId:entry.id}}).accepted).toBe(true);expect(f.state.players[0]).toMatchObject({minerals:1000,gas:1000,supplyUsedHalf:used});
    expect(f.issue(c).accepted).toBe(true);f.tick(999);const i=f.state.entities.definitionId.indexOf(ARBITER);expect(i).toBeGreaterThanOrEqual(0);expect(f.state.entities.layer[i]).toBe('air');expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it('cloaks own ground, air and workers immediately without energy, research, or saved flags', () => {
    const f=fixture(),a=f.add(0,ARBITER),ground=f.add(0,'protoss-zealot',42,40),air=f.add(0,'protoss-shuttle',41,42),probe=f.add(0,'protoss-probe',39,40);
    for(const id of [ground,air,probe])expect(coveredByArbiter(f.state,indexOf(f.state,id))).toBe(true);
    expect(coveredByArbiter(f.state,indexOf(f.state,a))).toBe(false);expect(f.state.vision!.concealed).toEqual([]);expect(f.state.energy??[]).toEqual([]);expect(f.state.economy.upgrades).toEqual([]);
    const view=f.view();for(const id of [ground,air,probe])expect(view.entities.find(e=>e.id===id)).toMatchObject({cloaked:true,auraCloaked:true});expect(validateRenderSnapshot(view).ok).toBe(true);
  });
  it('excludes all Arbiters, structures and enemy units', () => {
    const f=fixture('protoss','protoss'),a=f.add(0,ARBITER),b=f.add(0,ARBITER,41,40),building=f.add(0,'protoss-pylon',42,40),enemy=f.add(1,'protoss-zealot',42,41);
    for(const id of [a,b,building,enemy])expect(coveredByArbiter(f.state,indexOf(f.state,id))).toBe(false);
  });
  it('uses exact hitbox boundaries, including diagonal tangencies', () => {
    const f=fixture(),a=f.add(0,ARBITER),target=f.add(0,'protoss-zealot',42,40),i=indexOf(f.state,target),p=combatProfile(ARBITER)!,q=combatProfile('protoss-zealot')!;
    const x=40*256+(p.bounds[2]+q.bounds[0])*8,y=40*256+(p.bounds[3]+q.bounds[1])*8;
    f.state.entities.x[i]=x+ARBITER_RANGE;f.state.entities.y[i]=40*256;expect(coveredByArbiter(f.state,i)).toBe(true);f.state.entities.x[i]++;expect(coveredByArbiter(f.state,i)).toBe(false);
    f.state.entities.x[i]=x+768;f.state.entities.y[i]=y+1024;expect(coveredByArbiter(f.state,i)).toBe(true);f.state.entities.y[i]++;expect(coveredByArbiter(f.state,i)).toBe(false);
  });
  it('updates on source/target movement, source death and overlapping fields without latching', () => {
    const f=fixture(),a=f.add(0,ARBITER),b=f.add(0,ARBITER,43,40),target=f.add(0,'protoss-zealot',42,40),i=indexOf(f.state,target);
    removeEntity(f.state,a);expect(coveredByArbiter(f.state,i-1)).toBe(true);f.state.entities.x[indexOf(f.state,b)]=60*256;expect(coveredByArbiter(f.state,indexOf(f.state,target))).toBe(false);
    f.state.entities.x[indexOf(f.state,target)]=59*256;expect(coveredByArbiter(f.state,indexOf(f.state,target))).toBe(true);f.state.entities.health[indexOf(f.state,b)]=0;expect(coveredByArbiter(f.state,indexOf(f.state,target))).toBe(false);
  });
  it('removes coverage inside cargo and recomputes it after a legal unload', () => {
    const f=fixture(),a=f.add(0,ARBITER,38,38),ship=f.add(0,'protoss-shuttle',40,41),target=f.add(0,'protoss-zealot',41,40);expect(f.load([ship],target).accepted).toBe(true);f.tick(5);
    expect(isEmbarked(f.state,target)).toBe(true);expect(coveredByArbiter(f.state,indexOf(f.state,target))).toBe(false);expect(f.view().entities.some(e=>e.id===target)).toBe(false);
    expect(f.unload([ship],42,40).accepted).toBe(true);for(let n=0;n<200&&isEmbarked(f.state,target);n++)f.tick();expect(isEmbarked(f.state,target)).toBe(false);expect(coveredByArbiter(f.state,indexOf(f.state,target))).toBe(true);
    expect(f.load([ship],a).accepted).toBe(false);
  });
  it('hides covered units from enemy snapshots and focus commands until detection arrives', () => {
    const f=fixture('protoss','protoss'),a=f.add(0,ARBITER),target=f.add(0,'protoss-zealot',42,40),foe=f.add(1,'protoss-dragoon',44,40);f.tick();
    expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,a))).toBe(true);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,target))).toBe(false);
    expect(f.view(1).entities.some(e=>e.id===target)).toBe(false);expect(f.issue({kind:'focusAttack',entityIds:[foe],target:{kind:'entity',entityId:target}},1).accepted).toBe(false);
    f.add(1,'protoss-observer',46,40);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,target))).toBe(true);expect(f.view(1).entities.find(e=>e.id===target)).toMatchObject({cloaked:true,auraCloaked:true});
    expect(f.issue({kind:'focusAttack',entityIds:[foe],target:{kind:'entity',entityId:target}},1).accepted).toBe(true);f.tick(45);expect(f.state.entities.shield[indexOf(f.state,target)]).toBeLessThan(60);
  });
  it('requires current sight in addition to a detector and drops detection when that detector dies', () => {
    const f=fixture('protoss','protoss'),a=f.add(0,ARBITER),target=f.add(0,'protoss-zealot',42,40),det=f.add(1,'protoss-observer',52,40);
    expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,target))).toBe(false);f.state.entities.x[indexOf(f.state,det)]=46*256;expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,target))).toBe(true);removeEntity(f.state,det);f.add(1,'protoss-probe',44,40);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,target))).toBe(false);
  });
  it('keeps permanent cloak when leaving an aura and handles active cloak independently', () => {
    const f=fixture(),a=f.add(0,ARBITER),dt=f.add(0,'protoss-dark-templar',42,40);expect(f.view().entities.find(e=>e.id===dt)).toMatchObject({auraCloaked:true,cloaked:true});removeEntity(f.state,a);expect(f.view().entities.find(e=>e.id===dt)).toMatchObject({cloaked:true});expect(f.view().entities.find(e=>e.id===dt)?.auraCloaked).toBeUndefined();
    // Unit ownership rules normally keep races separate; the pure field query must not overwrite personal cloak state.
    const t=fixture('terran'),ghost=t.add(0,'terran-ghost');t.research('personnel-cloaking');t.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:true}});const source=t.add(0,ARBITER);expect(coveredByArbiter(t.state,indexOf(t.state,ghost))).toBe(true);removeEntity(t.state,source);expect(activeCloak(t.state,ghost)).toBe(true);
  });
  it('fires persistent original ground/air weapons, preserving flights after attacker death', () => {
    const f=fixture(),a=f.add(0,ARBITER),target=f.add(1,'terran-wraith',44,40);f.tick();const bullet=f.state.combat!.projectiles.find(p=>p.sourceId===a)!;expect(bullet).toMatchObject({weaponId:'Phase_Disruptor_Cannon',damage:2560,targetLayer:'air',targetId:target});
    const r=f.state.combat!.records.find(r=>r.entityId===a)!;expect(r.nextAttackTick).toBe(39);removeEntity(f.state,a);f.tick(20);expect(f.state.entities.health[indexOf(f.state,target)]).toBe(110);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it('preserves coverage, flight remainders, groups and deterministic continuation through saves', () => {
    const f=fixture(),a=f.add(0,ARBITER),z=f.add(0,'protoss-zealot',42,40),enemy=f.add(1,'terran-wraith',44,40);f.issue({kind:'assignGroup',entityIds:[a],payload:{slot:2,confirmed:false}});f.tick(2);const saved=f.saved(),restored=restoreSnapshot(JSON.stringify(saved));
    expect(restored.simulation.vision!.concealed).toEqual([]);expect(coveredByArbiter(restored.simulation,indexOf(restored.simulation,z))).toBe(true);expect(restored.simulation.combat!.projectiles).toEqual(f.state.combat!.projectiles);
    for(let n=0;n<90;n++){stepSimulation(f.state,f.rules);stepSimulation(restored.simulation,f.rules);}expect(checksum(restored.simulation)).toBe(checksum(f.state));expect(restored.simulation.players[0].controlGroups[2].entityIds).toEqual([a]);
  });
  it('migrates Stage6E morphs, waves and raw backups without changing their saved progress', () => {
    const f=fixture('zerg','protoss'),hydra=f.add(0,'zerg-hydralisk');f.research('lurker-aspect');f.issue({kind:'morphUnit',entityIds:[hydra],payload:{unitId:'zerg-lurker'}});const l=f.add(0,'zerg-lurker',43,40);f.add(1,'protoss-probe',46,40);f.issue({kind:'toggleStateAbility',entityIds:[l],payload:{abilityId:'burrow',enabled:true}});
    const old=f.saved();old.formatVersion=old.simulation.schemaVersion=14;old.engineVersion=old.simulation.engineVersion='0.15.0-stage6e';old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,LURKER_ECONOMY_DATA_VERSION);old.simulation.combat!.rulesVersion=LURKER_COMBAT_RULES_VERSION;old.simulation.vision!.rulesVersion='fog-2-permanent-cloak-cargo-observer11' as never;old.checksum=checksum(old.simulation);
    const raw=JSON.stringify(old),key=DEVELOPMENT_SAVE_PREFIX+'zerg',records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read('zerg');expect(read.status).toBe('ready');if(read.status!=='ready')throw Error('migration');
    expect(read.snapshot.formatVersion).toBe(15);for(const field of ['lurker','players','rngStreams','commandState'] as const)expect(read.snapshot.simulation[field]).toEqual(old.simulation[field]);expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+'.stage6e-backup')).toBe(raw);
  });
});
