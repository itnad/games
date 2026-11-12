"""Visible touch-only construction controls and command marker regression, against production assets."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('m',str(Path(__file__).with_name('browser-smoke.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4190');a.add_argument('--output',type=Path,default=Path('/workspace/library-files/stark-rift-touch-fix'));args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[]
with sync_playwright() as p:
 proxy={'server':os.environ['HTTPS_PROXY']} if args.url.startswith('https:') else None
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,proxy=proxy,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width,height in [(360,640),(390,844)]:
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(15000);page.add_init_script(m.OBSERVER);cdp=c.new_cdp_session(page);case={'viewport':[width,height],'checks':{},'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
  def check(name):case['checks'][name]=True;print(str(width)+': '+name,flush=True)
  def wait(js,timeout=30000):page.wait_for_function(js,timeout=timeout)
  def visible_tap(locator):
   box=locator.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,('offscreen button',box);point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2};assert locator.evaluate('(e)=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}');page.touchscreen.tap(**point)
  try:
   page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');visible_tap(page.get_by_role('button',name='새 테스트 시작',exact=True));wait('window.__qa.snapshot?.economy&&window.__qa.ui?.phase==="running"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
   visible_tap(page.get_by_role('button',name='일꾼 선택',exact=True));visible_tap(page.get_by_role('button',name='건설',exact=True));expect(page.get_by_role('dialog',name='건설 메뉴')).to_be_visible();check('build_entry_and_menu_visible_without_scrolling')
   visible_tap(page.locator('[data-build="terran-command-center"]'));m.touch(cdp,page,m.world(page,{'x':18*256,'y':17*256}));expect(page.get_by_role('button',name='건설 확정',exact=True)).to_be_disabled();expect(page.locator('.sr-placement-hint')).to_contain_text('자원 부족');visible_tap(page.get_by_role('button',name='배치 취소',exact=True));check('unaffordable_building_explains_cost_and_cancels')
   m.touch(cdp,page,m.world(page,{'x':17*256,'y':18*256}));expect(page.locator('.sr-viewport')).to_have_attribute('data-command-kind','move');page.screenshot(path=str(args.output/f'target-{width}.png'));page.wait_for_timeout(1100);assert page.locator('.sr-viewport').get_attribute('data-command-feedback') is None;check('move_marker_visible_and_expires')
   wait('window.__qa.snapshot.economy.minerals>=100',30000);visible_tap(page.get_by_role('button',name='건설',exact=True));visible_tap(page.locator('[data-build="terran-supply-depot"]'));m.touch(cdp,page,m.world(page,{'x':18*256,'y':17*256}));expect(page.get_by_role('button',name='건설 확정',exact=True)).to_be_enabled();page.screenshot(path=str(args.output/f'placement-{width}.png'));visible_tap(page.get_by_role('button',name='건설 확정',exact=True));wait('window.__qa.snapshot.economy.structures.some(b=>!b.completed)');wait('window.__qa.snapshot.economy.supplyCapHalf===36',35000);check('visible_confirm_constructs_supply_depot')
   assert not case['errors'];assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('no_runtime_errors');page.screenshot(path=str(args.output/f'completed-{width}.png'))
  except Exception as e:case['failure']=str(e);traceback.print_exc()
  finally:
   try:page.screenshot(path=str(args.output/f'last-{width}.png'),timeout=5000)
   except Exception:pass
   c.close()
 b.close()
report={'url':args.url,'scope':'Chromium mobile touch/SwiftShader; no resource injection; not physical Android/iOS','results':results};(args.output/'touch-build.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));raise SystemExit(int(any('failure' in r for r in results)))
