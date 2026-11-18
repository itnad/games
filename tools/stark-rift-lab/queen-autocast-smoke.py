"""Real Worker/Pixi touch checks for opt-in Queen autocast; no energy/state/clock injection."""
import argparse,importlib.util,json,os,sys,time,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent;spec=importlib.util.spec_from_file_location('m',root/'browser-smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,required=True);a.add_argument('--width',type=int,choices=[360,390],required=True);a.add_argument('--mode',choices=['commands','combat'],required=True);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True)
width=args.width;height=640 if width==360 else 844;combat=args.mode=='combat';KEY='paperoid.stark-rift.development.v1.'+('special.zerg'if combat else'infestation.zerg');abilities=['infestation','ensnare','spawn-broodlings','parasite'];case={'viewport':[width,height],'mode':args.mode,'checks':[],'errors':[]}
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts);c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(20000);page.add_init_script(m.OBSERVER);page.on('pageerror',lambda e:case['errors'].append(str(e)))
 def data():return page.evaluate('window.__qa.snapshot')
 def tap(loc):loc.tap()
 def check(name):case['checks'].append(name);print(f'{args.mode}-{width}: {name}',flush=True)
 def save(label):
  m.save(page);raw=page.evaluate('(k)=>localStorage.getItem(k)',KEY);s=json.loads(raw);assert s['formatVersion']==26;(args.output/f'{width}-{label}-save.json').write_text(raw);return s
 def pause():
  b=page.get_by_role('button',name='일시정지',exact=True).bounding_box();assert b;page.mouse.click(**m.center(b));page.wait_for_function('window.__qa.ui.phase==="paused"')
 def reopen(saved):
  tap(page.get_by_role('button',name='저장하고 나가기',exact=True));page.reload(wait_until='networkidle')
  if combat:tap(page.locator('[data-faction="zerg"]'))
  tap(page.get_by_role('button',name='특수 연습'if combat else'감염 연습',exact=True));tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('t=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===t',arg=saved['simulation']['tick']);again=save('restored')
  for k in ['entities','economy','players','queenAutocast','queen','parasites','broodlings','energy','movement','commandState','rngStreams']:assert again['simulation'].get(k)==saved['simulation'].get(k),k
 def ack():
  seq=page.evaluate('window.__qa.commands.at(-1).sequence');page.wait_for_function('n=>window.__qa.events.some(e=>e.kind==="commandAck"&&e.payload.sequence===n)',arg=seq);r=page.evaluate('n=>window.__qa.events.find(e=>e.kind==="commandAck"&&e.payload.sequence===n).payload',seq);assert r['accepted'],r;return r
 def auto(ability):tap(page.locator(f'[data-queen-autocast="{ability}"]'));return ack()
 def ground(x,y):
  m.save(page);pos=m.world(page,{'x':x*256,'y':y*256});b=page.locator('.sr-viewport canvas').bounding_box();assert b['x']<=pos['x']<=b['x']+b['width']and b['y']<=pos['y']<=b['y']+b['height'],(pos,b);page.touchscreen.tap(**pos);return ack()
 def no_manual():assert not page.evaluate('window.__qa.commands.some(c=>c.kind==="castAbility")')
 def wait(js,arg=None,total=110):
  end=time.monotonic()+total
  while True:
   try:page.wait_for_function(js,arg=arg,timeout=min(40000,max(1000,int((end-time.monotonic())*1000))));return
   except Exception:
    assert time.monotonic()<end and page.evaluate('window.__qa.ui.phase')=='running'and not case['errors'];print(f'{args.mode}-{width}: natural regeneration tick={data()["tick"]}',flush=True)
 try:
  page.goto(args.url+'/stark-rift-dev',wait_until='networkidle')
  if combat:tap(page.locator('[data-faction="zerg"]'))
  tap(page.get_by_role('button',name='특수 연습'if combat else'감염 연습',exact=True));tap(page.get_by_role('button',name='새 테스트 시작',exact=True));page.wait_for_function('window.__qa.ui?.phase==="running"');tap(page.get_by_role('button',name='광역',exact=True))
  if not combat:
   tap(page.locator('[data-infestation-queen-select]'));caster=next(e['id']for e in data()['entities']if e['owner']==0 and e['definitionId']=='zerg-queen');target=next(e for e in data()['entities']if e['owner']==1 and e['definitionId']=='terran-command-center'and e['health']==600);tid=target['id']
   for ab in abilities:expect(page.locator(f'[data-queen-autocast="{ab}"]')).to_have_attribute('aria-pressed','false');auto(ab)
   pause();prefs=save('preferences');r=next(r for r in prefs['simulation']['queenAutocast']['records']if r['entityId']==caster);assert r['abilityIds']==abilities;assert set(prefs['simulation']['players'][0]['controlGroups'][0]['autocastAbilityIds'])==set(abilities);no_manual();reopen(prefs);expect(page.locator('[data-queen-autocast="infestation"]')).to_be_disabled();check('four_explicit_native_toggles_default_off_allow_configuration_before_research_or_energy_and_restore_exactly')
   m.resume(page)
   for ab in abilities[1:]:auto(ab)
   before=save('before-capture')['simulation'];ground(23,22);wait('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.owner===0&&e.definitionId==="zerg-infested-command-center")',tid,total=20);pause();captured=save('captured');e=next(e for e in data()['entities']if e['id']==tid);assert e['health']==1500;be=next(e for e in before['energy']if e['entityId']==caster);ae=next(e for e in captured['simulation']['energy']if e['entityId']==caster);assert ae['amount']==be['amount']+((be['frameRemainder']+(captured['simulation']['tick']-before['tick'])*6)//5)*8;no_manual();reopen(captured);check('movement_and_manual_grace_then_automatic_same_ID_capture_without_energy_payment_or_manual_cast_command')
   m.resume(page);auto('infestation');auto('parasite');wait('window.__qa.snapshot.entities.some(e=>e.parasited)',total=60);pause();infected=save('parasite');assert infected['simulation']['parasites']['records'];no_manual();reopen(infected);check('natural75energy_automatic_parasite_and_permanent_infection_energy_cooldown_preferences_restore_exactly')
   m.resume(page);tap(page.get_by_role('button',name='위치 사수',exact=True));hold=ack();pause();held=save('manual-grace');r=held['simulation']['queenAutocast']['records'][0];assert r['manualUntilTick']==hold['executeTick']+20;check('accepted_native_hold_sets_exact20tick_manual_priority')
   m.resume(page);auto('parasite');pause();off=save('off');assert off['simulation']['queenAutocast']['records']==[];assert off['simulation']['players'][0]['controlGroups'][0]['autocastAbilityIds']==[];reopen(off);check('turning_last_option_off_removes_actor_state_and_group_default_and_stays_off_after_reload')
  else:
   actors=sorted(e['id']for e in data()['entities']if e['owner']==0 and e['definitionId']=='zerg-queen');a,b=actors;zealots=[e['id']for e in data()['entities']if e['owner']==1 and e['definitionId']=='protoss-zealot'];assert len(zealots)==2;tap(page.locator('[data-slot="4"]'));auto('ensnare');tap(page.locator('[data-queen-nest-select]'));gas=data()['economy']['gas'];tap(page.locator('[data-research="ensnare"]'));ack();assert data()['economy']['gas']==gas-100;wait('window.__qa.snapshot.entities.filter(e=>e.ensnareTicks).length>=2',total=65);pause();ensnared=save('ensnared');assert len(ensnared['simulation']['queen']['ensnared'])==2;assert next(e for e in ensnared['simulation']['energy']if e['entityId']==b)['amount']==50*256+(ensnared['simulation']['tick']*6//5)*8-75*256;no_manual();reopen(ensnared);check('paid_Ensnare_research_natural75energy_then_safe_two_enemy_autocast_with_exact_status_and_cooldown_reload')
   m.resume(page);tap(page.locator('[data-queen-nest-select]'));tap(page.locator('[data-research="spawn-broodlings"]'));ack();wait('window.__qa.snapshot.economy.upgrades.some(u=>u.technologyId==="spawn-broodlings")',total=50);tap(page.locator('[data-slot="3"]'));ground(22,24);wait('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&Math.abs(e.x-22*256)<60&&Math.abs(e.y-24*256)<60)',a,total=20);auto('spawn-broodlings');auto('parasite');page.wait_for_timeout(2000);pause();reserved=save('reserved');en=next(e for e in data()['entities']if e['id']==a)['energy'];assert 75<en<150,en;assert not reserved['simulation'].get('parasites',{}).get('records',[]);assert all(z in reserved['simulation']['entities']['id']for z in zealots);reopen(reserved);check('paid_Broodlings_research_and_in_range_valuable_target_reserve150energy_before_Parasite_without_moving_automatically')
   m.resume(page);wait('window.__qa.snapshot.entities.filter(e=>e.definitionId==="zerg-broodling").length===2',total=110);pause();spawned=save('spawned');assert len(spawned['simulation']['broodlings']['records'])==2;assert sum(z in spawned['simulation']['entities']['id']for z in zealots)==1;assert next(e for e in spawned['simulation']['energy']if e['entityId']==a)['amount']==50*256+(spawned['simulation']['tick']*6//5)*8-150*256;no_manual();reopen(spawned);check('natural150energy_automatic_Broodlings_kills_one_valuable_target_spawns_two_and_restores_lifetimes_and_preferences')
   m.resume(page);tap(page.locator('[data-queen-select]'));expect(page.locator('[data-queen-autocast-status="spawn-broodlings"]')).to_have_text('일부 켜짐');slot=page.locator('[data-slot="3"]');slot.scroll_into_view_if_needed();m.touch(c.new_cdp_session(page),page,m.center(slot.bounding_box()),hold=700);ack();pause();group=save('group');g=group['simulation']['players'][0]['controlGroups'][3];assert sorted(g['entityIds'])==actors;assert set(g['autocastAbilityIds'])=={'spawn-broodlings','parasite'};assert all(set(r['abilityIds'])=={'spawn-broodlings','parasite'}for r in group['simulation']['queenAutocast']['records']);check('native_long_touch_group_registration_inherits_slot_preferences_for_both_Queens')
   m.resume(page);auto('spawn-broodlings');auto('parasite');pause();off=save('off');assert off['simulation']['queenAutocast']['records']==[];reopen(off);check('mixed_selection_toggles_clear_both_actors_and_group_preferences_with_exact_reload')
  page.screenshot(path=str(args.output/f'{width}-complete.png'));m.resume(page);page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});assert page.evaluate('window.__qa.ui.phase')=='paused';assert not case['errors']and not any(e['kind']=='fatalError'for e in m.state(page)['events']);check('portrait_only_rotation_pause_and_no_runtime_errors')
 except Exception as e:
  case['failure']=str(e);traceback.print_exc()
  try:save('failure');page.screenshot(path=str(args.output/f'{width}-failure.png'));case['snapshot']=data();case['commands']=page.evaluate('window.__qa.commands');case['events']=page.evaluate('window.__qa.events')
  except Exception:pass
 finally:c.close();browser.close()
report={'url':args.url,'scope':'Native touch,actual Worker/Pixi,paid research,natural energy,exact save continuity. No state/resource/energy injection or clock acceleration. Chromium SwiftShader does not certify physical Android/iOS or hardware GPU.','results':[case]};(args.output/'queen-autocast-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in case.items()if k not in ['snapshot','commands','events']},ensure_ascii=False),flush=True);raise SystemExit(int('failure'in case))
