"""Production touch/Worker active cloak, energy timing and persistence. No clock or resource injection."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('m',str(Path(__file__).with_name('browser-smoke.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,default=Path('/workspace/library-files/stark-rift-cloak/local'));a.add_argument('--width',type=int,choices=[360,390]);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[]
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 for width,height in [(360,640),(390,844)]:
  if args.width and args.width!=width:continue
  c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(15000);page.add_init_script(m.OBSERVER);case={'viewport':[width,height],'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
  def data():return page.evaluate('window.__qa.snapshot')
  def entity(id):return next(e for e in data()['entities'] if e['id']==id)
  def check(name):case['checks'].append(name);print(f'{width}: {name}',flush=True)
  def tap(locator):
   locator.evaluate('(e)=>e.scrollIntoView({block:"end",inline:"nearest"})');box=locator.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,box
   assert locator.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}'),'covered control';locator.tap()
  def select(definition):tap(page.locator('[data-cloak-select="'+definition+'"]'))
  def toggle(enabled):tap(page.locator('[data-state-ability="cloak"][data-enabled="'+str(enabled).lower()+'"]'))
  def wait_ticks(n):page.wait_for_function('t=>window.__qa.snapshot.tick>=t',arg=data()['tick']+n,timeout=max(15000,n*100))
  try:
   page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');page.locator('[data-faction="terran"]').tap();page.get_by_role('button',name='특수 연습',exact=True).tap();start=page.get_by_role('button',name='새 테스트 시작',exact=True);box=start.bounding_box();assert box and box['y']+box['height']<=height;tap(start);page.wait_for_function('window.__qa.snapshot?.combat?.scenario==="special-practice"&&window.__qa.ui?.phase==="running"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
   ghost=next(e['id'] for e in data()['entities'] if e['definitionId']=='terran-ghost');wraith=next(e['id'] for e in data()['entities'] if e['definitionId']=='terran-wraith');assert entity(ghost)['energy']>=50 and entity(wraith)['maxEnergy']==200 and entity(wraith)['layer']=='air';assert data()['economy']['supplyUsedHalf']<=data()['economy']['supplyCapHalf'];check('practice_provides_casting_units_research_and_supply')
   select('terran-ghost');before=entity(ghost)['energy'];toggle(True);page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.cloaked)',arg=ghost);assert 23<=before-entity(ghost)['energy']<=27;check('ghost_touch_cloak_pays_25_and_shows_energy')
   m.save(page);target=m.world(page,{'x':22*256,'y':20*256});box=page.locator('.sr-viewport canvas').bounding_box();assert box['x']<=target['x']<=box['x']+box['width'] and box['y']<=target['y']<=box['y']+box['height'];origin=entity(ghost);page.touchscreen.tap(**target);page.wait_for_function('window.__qa.commands.at(-1)?.kind==="move"');wait_ticks(25);assert abs(entity(ghost)['x']-origin['x'])+abs(entity(ghost)['y']-origin['y'])>128 and entity(ghost).get('cloaked');check('cloaked_ghost_keeps_moving');page.screenshot(path=str(args.output/f'ghost-{width}-cloaked.png'))
   select('terran-wraith');toggle(True);page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.cloaked)',arg=wraith);check('wraith_cloaks_on_its_separate_research')
   tap(page.get_by_role('button',name='저장하고 나가기',exact=True));expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible();key='paperoid.stark-rift.development.v1.special.terran';raw=page.evaluate('(k)=>localStorage.getItem(k)',key);saved=json.loads(raw);assert saved['formatVersion']==13;assert len(saved['simulation']['energy'])==2;assert all(any(v['entityId']==id and v['kind']=='cloak' for v in saved['simulation']['vision']['concealed']) for id in [ghost,wraith]);(args.output/f'active-{width}-save.json').write_text(raw);check('active_energy_and_fractional_frames_saved')
   page.reload(wait_until='networkidle');page.locator('[data-faction="terran"]').tap();page.get_by_role('button',name='특수 연습',exact=True).tap();tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('t=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===t',arg=saved['simulation']['tick']);assert entity(ghost).get('cloaked') and entity(wraith).get('cloaked')
   for r in saved['simulation']['energy']:assert entity(r['entityId'])['energy']==r['amount']//256
   check('reload_restores_exact_paused_energy_and_cloak');m.resume(page);g=entity(ghost)['energy'];w=entity(wraith)['energy'];wait_ticks(50);assert entity(ghost)['energy']<g and entity(wraith)['energy']<w;check('both_continue_draining_after_resume')
   select('terran-ghost');toggle(False);page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&!e.cloaked)',arg=ghost);g=entity(ghost)['energy'];wait_ticks(40);assert entity(ghost)['energy']>g;check('manual_decloak_regenerates_energy')
   select('terran-wraith');page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&!e.cloaked)',arg=wraith,timeout=35000);assert entity(wraith)['energy']<=1;expect(page.locator('[data-state-ability="cloak"][data-enabled="true"]')).to_be_disabled();w=entity(wraith)['energy'];wait_ticks(40);assert entity(wraith)['energy']>w;check('depleted_wraith_decloaks_and_insufficient_energy_blocks_recast');page.screenshot(path=str(args.output/f'wraith-{width}-depleted.png'))
   page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});check('portrait_only_pause');assert not case['errors'];assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('no_runtime_errors')
  except Exception as e:
   case['failure']=str(e);traceback.print_exc()
   try:page.screenshot(path=str(args.output/f'{width}-failure.png'));case['snapshot']=data();case['commands']=page.evaluate('window.__qa.commands');case['ui']=page.evaluate('window.__qa.ui')
   except Exception:pass
  finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Actual touch, production Worker/Pixi, real elapsed energy, no resource or clock injection; Chromium SwiftShader emulation, not physical Android/iOS or hardware GPU certification','results':results};(args.output/'cloak-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['snapshot','commands']} for r in results],ensure_ascii=False),flush=True);raise SystemExit(int(any('failure' in r for r in results)))
