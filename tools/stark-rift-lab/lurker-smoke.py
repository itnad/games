"""Production Lurker touch/morph/persistence checks. Real time and resources, read-only Worker observation."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('m',root/'browser-smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
observer=m.OBSERVER.replace('snapshot:null,session:null','snapshot:null,history:[],session:null').replace("if(m.kind==='renderSnapshot')window.__qa.snapshot=m.payload;", "if(m.kind==='renderSnapshot'){window.__qa.snapshot=m.payload;window.__qa.history.push({tick:m.payload.tick,entities:structuredClone(m.payload.entities),waves:structuredClone(m.payload.groundWaves??[])});if(window.__qa.history.length>800)window.__qa.history.shift();}")
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,required=True);a.add_argument('--width',type=int,choices=[360,390]);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[]
LURKER='zerg-lurker';HYDRA='zerg-hydralisk';EGG='zerg-lurker-egg';KEY='paperoid.stark-rift.development.v1.special.zerg'
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
  def choose(definition):tap(page.locator('[data-lurker-select="'+definition+'"]'))
  def pause():tap(page.get_by_role('button',name='일시정지',exact=True));page.wait_for_function('window.__qa.ui.phase==="paused"')
  try:
   page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');tap(page.locator('[data-faction="zerg"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='새 테스트 시작',exact=True));page.wait_for_function('window.__qa.snapshot?.combat?.scenario==="special-practice"&&window.__qa.ui?.phase==="running"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
   lurker=next(e['id'] for e in data()['entities'] if e['owner']==0 and e['definitionId']==LURKER);hydras=[e['id'] for e in data()['entities'] if e['owner']==0 and e['definitionId']==HYDRA];enemies={e['id']:e for e in data()['entities'] if e['owner']==1 and e['definitionId']=='protoss-probe'};assert len(enemies)==3;assert data()['economy']['gas']==200;assert any(u['technologyId']=='lurker-aspect' for u in data()['economy']['upgrades']);supply=data()['economy']['supplyUsedHalf'];check('practice_supplies_lurker_morph_research_and_200_gas')
   m.save(page);canvas=page.locator('.sr-viewport canvas').bounding_box();points=[m.world(page,e) for e in data()['entities'] if e['id']==lurker or e['id'] in enemies];assert all(canvas['x']<=p['x']<=canvas['x']+canvas['width'] and canvas['y']<=p['y']<=canvas['y']+canvas['height'] for p in points);check('initial_camera_shows_lurker_and_all_line_targets')
   choose(LURKER);tap(page.locator('[data-state-ability="burrow"][data-enabled="true"]'));page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.burrowed)',arg=lurker)
   page.wait_for_function('window.__qa.history.some(h=>h.waves.length>0)');page.wait_for_function('ids=>window.__qa.history.some(h=>ids.filter(id=>!h.entities.some(e=>e.id===id&&e.shield===20)).length>=2)',arg=list(enemies));history=page.evaluate('window.__qa.history');case['waveFrames']=[h for h in history if h['waves']][:4];assert all(set(w)=={'id','owner','x','y'} for h in history for w in h['waves']);check('burrow_launches_visible_spines_that_hit_multiple_collinear_targets');page.screenshot(path=str(args.output/f'{width}-buried.png'))
   tap(page.locator('[data-state-ability="burrow"][data-enabled="false"]'));choose(HYDRA);tap(page.locator('[data-unit-morph="zerg-lurker"]'));page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.unitMorph))',arg=hydras);assert data()['economy']['gas']==0;assert data()['economy']['supplyUsedHalf']==supply+4;check('touch_morph_charges_two_units_and_reserves_final_supply');pause();m.save(page)
   raw=page.evaluate('(k)=>localStorage.getItem(k)',KEY);saved=json.loads(raw);assert saved['formatVersion']==14;assert len(saved['simulation']['lurker']['morphs'])==2;assert all(0<j['remainingTicks']<250 for j in saved['simulation']['lurker']['morphs']);(args.output/f'{width}-morph-save.json').write_text(raw);case['savedMorphs']=saved['simulation']['lurker']['morphs'];page.screenshot(path=str(args.output/f'{width}-morph.png'))
   tap(page.get_by_role('button',name='저장하고 나가기',exact=True));page.reload(wait_until='networkidle');tap(page.locator('[data-faction="zerg"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('t=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===t',arg=saved['simulation']['tick']);assert all(next(e for e in data()['entities'] if e['id']==j['entityId'])['unitMorph']['remainingTicks']==j['remainingTicks'] for j in saved['simulation']['lurker']['morphs']);check('reload_preserves_exact_morph_progress_and_paid_reservations');m.resume(page)
   choose(EGG);tap(page.get_by_role('button',name='변태 취소 · 전액 환불',exact=True).first);page.wait_for_function('window.__qa.snapshot.economy.gas===100');assert data()['economy']['supplyUsedHalf']==supply+2;choose(HYDRA);tap(page.locator('[data-unit-morph="zerg-lurker"]'));check('cancel_refunds_full_morph_cost_and_allows_remorph')
   page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.definitionId==="zerg-lurker"&&!e.unitMorph))',arg=hydras,timeout=30000);assert page.evaluate('(ids)=>ids.every(id=>window.__qa.ui.controlGroups[1].entityIds.includes(id))',hydras);assert data()['economy']['supplyUsedHalf']==supply+4;assert data()['economy']['gas']==0;check('real_12_point_5_second_morph_finishes_with_group_and_supply_preserved');page.screenshot(path=str(args.output/f'{width}-completed.png'))
   # Each new Lurker needs four slots; both must fit in one eight-slot Overlord.
   m.save(page);ship=next(e for e in data()['entities'] if e['definitionId']=='zerg-overlord' and e['owner']==0 and e['x']==20*256);page.touchscreen.tap(**m.world(page,ship));tap(page.locator('[data-transport="load"]'));tap(page.locator('[data-slot="1"]'));page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.economy.transports.some(t=>t.passengers.some(p=>p.id===id)))',arg=hydras,timeout=45000);assert data()['economy']['supplyUsedHalf']==supply+4;check('completed_lurkers_board_as_four_slot_cargo_without_losing_supply')
   page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});assert not case['errors'];assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('portrait_only_pause_and_no_runtime_errors')
  except Exception as e:
   case['failure']=str(e);traceback.print_exc()
   try:page.screenshot(path=str(args.output/f'{width}-failure.png'));case['snapshot']=data();case['commands']=page.evaluate('window.__qa.commands');case['ui']=page.evaluate('window.__qa.ui')
   except Exception:pass
  finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Production Worker/Pixi; actual mobile touch, original time flow, no state/resource injection. Chromium SwiftShader emulation, not physical Android/iOS or hardware GPU certification.','results':results};(args.output/'lurker-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['snapshot','commands','waveFrames']} for r in results],ensure_ascii=False),flush=True);raise SystemExit(int(any('failure' in r for r in results)))
