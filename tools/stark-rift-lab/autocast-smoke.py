"""Touch and normal-time Stasis autocast checks, against the actual Worker/Pixi build."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent;spec=importlib.util.spec_from_file_location('m',root/'browser-smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,required=True);a.add_argument('--width',type=int,choices=[360,390]);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[];KEY='paperoid.stark-rift.development.v1.special.protoss'
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 for width,height in [(360,640),(390,844)]:
  if args.width and args.width!=width:continue
  c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(20000);page.add_init_script(m.OBSERVER);cdp=c.new_cdp_session(page);case={'viewport':[width,height],'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
  def data():return page.evaluate('window.__qa.snapshot')
  def check(name):case['checks'].append(name);print(f'{width}: {name}',flush=True)
  def visible(locator):locator.evaluate('(e)=>e.scrollIntoView({block:"end",inline:"nearest"})');expect(locator).to_be_visible();return locator.bounding_box()
  def tap(locator):visible(locator);locator.tap()
  def point(x,y):
   p=m.world(page,{'x':x*256,'y':y*256});b=page.locator('.sr-viewport canvas').bounding_box();assert b['x']<=p['x']<=b['x']+b['width'] and b['y']<=p['y']<=b['y']+b['height'],(p,b);page.touchscreen.tap(**p)
  def hold():
   loc=page.locator('[data-cast-ability="stasis-field"]');box=visible(loc);m.touch(cdp,page,m.center(box),hold=700)
  try:
   page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');tap(page.locator('[data-faction="protoss"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='새 테스트 시작',exact=True));page.wait_for_function('window.__qa.ui?.phase==="running"&&window.__qa.snapshot?.combat?.scenario==="special-practice"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled();tap(page.locator('[data-arbiter-select]'))
   actors=[e['id'] for e in data()['entities'] if e['definitionId']=='protoss-arbiter' and e['owner']==0];observer=next(e['id'] for e in data()['entities'] if e['definitionId']=='protoss-observer' and e['owner']==0);assert len(actors)==2 and all(not e.get('stasisAutocast') for e in data()['entities'] if e['id'] in actors);check('autocast_is_opt_in_and_both_casters_default_off')
   hold();page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.stasisAutocast))',arg=actors);expect(page.get_by_role('button',name='지시 취소',exact=True)).to_have_count(0);assert not any(cmd['kind']=='castAbility' for cmd in page.evaluate('window.__qa.commands'));page.wait_for_timeout(600);assert all(e['energy']==200 for e in data()['entities'] if e['id'] in actors);check('long_touch_enables_group_preferences_without_manual_cast_or_hidden_target_spending');page.screenshot(path=str(args.output/f'{width}-enabled.png'))
   tap(page.locator('[data-stasis-autocast-toggle]'));page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&!e.stasisAutocast))',arg=actors);check('accessible_explicit_toggle_disables_every_selected_caster')
   tap(page.locator('[data-cast-ability="stasis-field"]'));expect(page.get_by_role('button',name='지시 취소',exact=True)).to_be_visible();tap(page.get_by_role('button',name='지시 취소',exact=True));check('short_touch_keeps_manual_targeting_available')
   hold();page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.stasisAutocast))',arg=actors);tap(page.get_by_role('button',name='일시정지',exact=True));page.wait_for_function('window.__qa.ui.phase==="paused"');m.save(page);raw=page.evaluate('(k)=>localStorage.getItem(k)',KEY);saved=json.loads(raw);assert saved['formatVersion']==26 and sorted(r['entityId'] for r in saved['simulation']['autocast']['records'])==sorted(actors);assert all('stasis-field' in saved['simulation']['players'][0]['controlGroups'][slot]['autocastAbilityIds'] for slot in [2,3]);(args.output/f'{width}-autocast-save.json').write_text(raw);tap(page.get_by_role('button',name='저장하고 나가기',exact=True));page.reload(wait_until='networkidle');tap(page.locator('[data-faction="protoss"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('t=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===t',arg=saved['simulation']['tick']);assert all(e['stasisAutocast'] for e in data()['entities'] if e['id'] in actors);check('save_reload_preserves_exact_tick_per_unit_preferences_and_group_settings');m.resume(page)
   m.save(page);point(14,18);page.wait_for_timeout(150)
   point(24,17);page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.x>23*256)',arg=observer);page.wait_for_function('window.__qa.snapshot.entities.filter(e=>e.owner===1&&["protoss-probe","protoss-dark-templar"].includes(e.definitionId)).length===2');check('normal_observer_movement_reveals_the_enemy_pair')
   tap(page.locator('[data-arbiter-select]'));m.save(page);point(21,17);page.wait_for_function('window.__qa.snapshot.entities.filter(e=>e.owner===1&&e.stasisTicks).length===2',timeout=25000);cas=[e for e in data()['entities'] if e['id'] in actors];assert sum(e['energy']<110 for e in cas)==1 and sum(e['energy']>190 for e in cas)==1;assert not any(e.get('stasisTicks') for e in data()['entities'] if e['owner']==0);assert not any(cmd['kind']=='castAbility' for cmd in page.evaluate('window.__qa.commands'));check('after_manual_arrival_one_caster_freezes_visible_pair_without_duplicate_cost_or_friendly_freeze');page.screenshot(path=str(args.output/f'{width}-automatic-stasis.png'))
   m.save(page);case['finalTick']=data()['tick'];tap(page.locator('[data-stasis-autocast-toggle]'));page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&!e.stasisAutocast))',arg=actors);check('autocast_can_be_disabled_after_casting')
   page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});assert not case['errors'];assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('portrait_only_pause_and_no_runtime_errors')
  except Exception as e:
   case['failure']=str(e);traceback.print_exc()
   try:page.screenshot(path=str(args.output/f'{width}-failure.png'));case['snapshot']=data();case['commands']=page.evaluate('window.__qa.commands');case['ui']=page.evaluate('window.__qa.ui')
   except Exception:pass
  finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Actual Worker/Pixi, native mobile touch/long press and normal-time gameplay; no new-game state/resource injection. Chromium SwiftShader; not physical Android/iOS or hardware GPU certification.','results':results};(args.output/'autocast-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['snapshot','commands']} for r in results],ensure_ascii=False),flush=True);raise SystemExit(int(any('failure' in r for r in results)))
