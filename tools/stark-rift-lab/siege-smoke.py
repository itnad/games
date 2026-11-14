"""Production touch, timed siege, real splash, persistence, movement and cargo. No state/clock injection."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent
helper=(root/'browser-smoke.py') if (root/'browser-smoke.py').exists() else root.parent/'tools/stark-rift-lab/browser-smoke.py'
spec=importlib.util.spec_from_file_location('m',helper);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
observer=m.OBSERVER.replace('snapshot:null,session:null','snapshot:null,history:[],session:null').replace("if(m.kind==='renderSnapshot')window.__qa.snapshot=m.payload;", "if(m.kind==='renderSnapshot'){window.__qa.snapshot=m.payload;window.__qa.history.push({tick:m.payload.tick,entities:structuredClone(m.payload.entities),effects:structuredClone(m.payload.combat?.effects??[])});if(window.__qa.history.length>800)window.__qa.history.shift();}")
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,default=Path('/workspace/library-files/stark-rift-siege/local'));a.add_argument('--width',type=int,choices=[360,390]);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[]
TANK='terran-siege-tank-tank-mode';SIEGE='terran-siege-tank-siege-mode';KEY='paperoid.stark-rift.development.v1.special.terran'
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 for width,height in [(360,640),(390,844)]:
  if args.width and args.width!=width:continue
  c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(15000);page.add_init_script(observer);case={'viewport':[width,height],'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
  def data():return page.evaluate('window.__qa.snapshot')
  def check(name):case['checks'].append(name);print(f'{width}: {name}',flush=True)
  def tap(locator):
   locator.evaluate('(e)=>e.scrollIntoView({block:"end",inline:"nearest"})');box=locator.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,box
   assert locator.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}'),'covered control';locator.tap()
  def wait_ticks(n):page.wait_for_function('t=>window.__qa.snapshot.tick>=t',arg=data()['tick']+n,timeout=max(15000,n*100))
  def toggle(enabled):tap(page.locator('[data-state-ability="siege-mode"][data-enabled="'+str(enabled).lower()+'"]'))
  try:
   page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');page.locator('[data-faction="terran"]').tap();page.get_by_role('button',name='특수 연습',exact=True).tap();start=page.get_by_role('button',name='새 테스트 시작',exact=True);box=start.bounding_box();assert box and box['y']+box['height']<=height;tap(start);page.wait_for_function('window.__qa.snapshot?.combat?.scenario==="special-practice"&&window.__qa.ui?.phase==="running"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
   tanks=[e['id'] for e in data()['entities'] if e['owner']==0 and e['definitionId']==TANK];assert len(tanks)==2;initial_enemies={e['id']:e for e in data()['entities'] if e['owner']==1 and e['definitionId']=='protoss-probe'};assert len(initial_enemies)==3;carriers=[e for e in data()['entities'] if e['definitionId']=='terran-dropship'];assert any(u['technologyId']=='tank-siege-mode' for u in data()['economy']['upgrades']);supply=data()['economy']['supplyUsedHalf'];check('practice_provides_tanks_research_and_clustered_targets')
   tap(page.locator('[data-siege-select]'));toggle(True);page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.siegeTransition))',arg=tanks);pause=page.get_by_role('button',name='일시정지',exact=True);pause_box=pause.bounding_box();assert pause_box and pause_box['y']+pause_box['height']<=height;assert pause.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}');page.touchscreen.tap(**m.center(pause_box));page.wait_for_function('window.__qa.ui.phase==="paused"');m.save(page);raw=page.evaluate('(k)=>localStorage.getItem(k)',KEY);saved=json.loads(raw);assert saved['formatVersion']==13;assert len(saved['simulation']['siege'])==2;assert all(0<j['remainingTicks']<40 for j in saved['simulation']['siege']);(args.output/f'{width}-transition-save.json').write_text(raw);case['savedTransitions']=saved['simulation']['siege'];check('real_touch_starts_timed_transition_and_pause_preserves_progress');page.screenshot(path=str(args.output/f'{width}-transition.png'))
   tap(page.get_by_role('button',name='저장하고 나가기',exact=True));expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible();page.reload(wait_until='networkidle');page.locator('[data-faction="terran"]').tap();page.get_by_role('button',name='특수 연습',exact=True).tap();tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('({t,ids})=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===t&&ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.siegeTransition))',arg={'t':saved['simulation']['tick'],'ids':tanks});assert all(next(e for e in data()['entities'] if e['id']==j['entityId'])['siegeTransition']['remainingTicks']==j['remainingTicks'] for j in saved['simulation']['siege']);check('reload_restores_exact_transition_remaining_time');m.resume(page)
   page.wait_for_function('({ids,d})=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.definitionId===d&&!e.siegeTransition))',arg={'ids':tanks,'d':SIEGE});assert data()['economy']['supplyUsedHalf']==supply;assert page.evaluate('(ids)=>ids.every(id=>window.__qa.ui.controlGroups[1].entityIds.includes(id))',tanks);check('transition_completes_without_losing_group_or_supply')
   page.wait_for_function('window.__qa.history.some(h=>h.effects.some(e=>e.kind==="impact"&&e.weaponId==="Arclite_Shock_Cannon"))');history=page.evaluate('window.__qa.history');hits=[]
   for frame in history:
    impacts=[e for e in frame['effects'] if e['kind']=='impact' and e.get('weaponId')=='Arclite_Shock_Cannon']
    if not impacts:continue
    changed=[id for id,e in initial_enemies.items() if not any(q['id']==id and q['health']>=e['health'] and q.get('shield',0)>=e.get('shield',0) for q in frame['entities'])]
    if len(changed)>=2:hits.append({'tick':frame['tick'],'affectedTargets':changed,'impacts':impacts})
   assert hits,'expected clustered splash victims';case['splashEvidence']=hits[:2];check('real_artillery_impact_damages_multiple_clustered_targets');page.screenshot(path=str(args.output/f'{width}-deployed.png'))
   positions={e['id']:(e['x'],e['y']) for e in data()['entities'] if e['id'] in tanks};m.save(page);point=m.world(page,{'x':23*256,'y':20*256});page.touchscreen.tap(**point);page.wait_for_function('window.__qa.commands.at(-1)?.kind==="move"');page.wait_for_function('window.__qa.events.some(e=>e.kind==="commandAck"&&e.payload.accepted===false&&e.payload.code==="invalid_state")');wait_ticks(15);assert all(positions[e['id']]==(e['x'],e['y']) for e in data()['entities'] if e['id'] in tanks);check('deployed_tanks_refuse_movement_and_remain_fixed')
   toggle(False);page.wait_for_function('({ids,d})=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.definitionId===d&&!e.siegeTransition))',arg={'ids':tanks,'d':TANK});m.save(page);page.touchscreen.tap(**m.world(page,{'x':23*256,'y':20*256}));wait_ticks(35);assert any(positions[e['id']]!=(e['x'],e['y']) for e in data()['entities'] if e['id'] in tanks);check('undeploy_restores_tank_movement');page.screenshot(path=str(args.output/f'{width}-mobile.png'))
   # Transport the undeployed group through the same real input path as previous special practice.
   m.save(page);page.touchscreen.tap(**m.world(page,carriers[-1]));tap(page.locator('[data-transport="load"]'));tap(page.locator('[data-slot="1"]'));page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.economy.transports.some(t=>t.passengers.some(p=>p.id===id)))',arg=tanks,timeout=45000);assert data()['economy']['supplyUsedHalf']==supply;check('undeployed_tanks_board_with_preserved_group_and_supply')
   page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});assert not case['errors'];assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('portrait_only_pause_and_no_runtime_errors')
  except Exception as e:
   case['failure']=str(e);traceback.print_exc()
   try:page.screenshot(path=str(args.output/f'{width}-failure.png'));case['snapshot']=data();case['commands']=page.evaluate('window.__qa.commands');case['ui']=page.evaluate('window.__qa.ui')
   except Exception:pass
  finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Production Worker/Pixi with real mobile touch, original time flow, no resource or state injection; Chromium SwiftShader emulation, not physical Android/iOS or hardware GPU certification','results':results};(args.output/'siege-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['snapshot','commands']} for r in results],ensure_ascii=False),flush=True);raise SystemExit(int(any('failure' in r for r in results)))
