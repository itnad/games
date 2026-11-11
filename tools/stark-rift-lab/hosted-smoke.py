"""Tests the hosted route and production Worker. No fixture injection or clock acceleration."""
import argparse, importlib.util, json, sys, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('smoke', str(Path(__file__).with_name('browser-smoke.py')))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
parser = argparse.ArgumentParser(); parser.add_argument('--url', default='http://127.0.0.1:4177'); parser.add_argument('--output', type=Path, default=Path('/workspace/library-files/stark-rift-hosted-preview')); parser.add_argument('--full-economy', action='store_true'); args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
 browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width, height in [(390,844),(360,640)]:
  context = browser.new_context(viewport={'width':width,'height':height}, is_mobile=True, has_touch=True, device_scale_factor=1)
  page = context.new_page(); page.set_default_timeout(15000); page.add_init_script(m.OBSERVER); errors=[]; page.on('pageerror', lambda e: errors.append(str(e))); cdp=context.new_cdp_session(page)
  case={'viewport':[width,height],'checks':{},'errors':errors}; results.append(case)
  def check(name):case['checks'][name]=True; print(f'{width}: {name}',flush=True)
  def wait(js,timeout=30000):page.wait_for_function(js,timeout=timeout)
  def data():return page.evaluate('window.__qa.snapshot')
  def click(selector):page.locator(selector).evaluate('(e)=>{e.scrollIntoView({block:"nearest"});e.click();}')
  def stored(faction):return page.evaluate('(f)=>JSON.parse(localStorage.getItem("paperoid.stark-rift.development.v1."+f))',faction)
  try:
   page.goto(args.url+'/',wait_until='networkidle'); entry=page.locator('a[href="/stark-rift-dev"]'); expect(entry).to_have_text('스타크 리프트 개발 테스트 →'); entry.evaluate('(e)=>e.click()'); expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible(); check('home_link_and_route')
   assert 'noindex' in page.locator('meta[name="robots"]').get_attribute('content');check('noindex')
   page.screenshot(path=str(args.output/f'lobby-{width}.png'))
   for faction in ['terran','zerg','protoss']:
    page.locator('[data-faction="'+faction+'"]').click();page.get_by_role('button',name='새 테스트 시작',exact=True).click();wait('window.__qa.snapshot?.economy?.faction==="'+faction+'"&&window.__qa.ui?.phase==="running"');page.locator('.sr-viewport canvas').wait_for(state='visible');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
    assert data()['economy']['supplyUsedHalf']==8; assert data()['economy']['supplyCapHalf']==(20 if faction=='terran' else 18); assert data()['economy']['minerals']>=50; check(faction+'_production_worker_start')
    wait('window.__qa.snapshot.economy.minerals>50',15000);check(faction+'_gathering')
    page.get_by_role('button',name='저장',exact=True).click();page.wait_for_function('(f)=>!!localStorage.getItem("paperoid.stark-rift.development.v1."+f)',arg=faction)
    assert stored(faction)['simulation']['players'][0]['faction']==faction
    if args.full_economy and width==390 and faction=='terran':
     click('[data-produce="terran-scv"]');wait('window.__qa.snapshot.economy.workers.length===5',15000);check('worker_produced')
     wait('window.__qa.snapshot.economy.minerals>=100',30000)
     def place(building,x,y):
      worker=next(e for e in data()['entities'] if e['kind']=='worker');m.touch(cdp,page,m.world(page,worker));click('[data-build="'+building+'"]');m.touch(cdp,page,m.world(page,{'x':x*256,'y':y*256}));expect(page.get_by_role('button',name='건설 확정',exact=True)).to_be_enabled();page.get_by_role('button',name='건설 확정',exact=True).click();wait('window.__qa.snapshot.economy.structures.some(b=>b.completed&&window.__qa.snapshot.entities.find(e=>e.id===b.entityId)?.definitionId==='+json.dumps(building)+')',50000)
     place('terran-supply-depot',18,17);wait('window.__qa.snapshot.economy.minerals>=150',30000);place('terran-barracks',19,20);check('construction')
     building=next(e for e in data()['entities'] if e['definitionId']=='terran-barracks');m.touch(cdp,page,m.world(page,building));click('[data-produce="terran-marine"]');wait('window.__qa.snapshot.entities.some(e=>e.definitionId==="terran-marine")',15000);check('marine_produced')
    page.get_by_role('button',name='저장하고 나가기',exact=True).click();expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible();record=stored(faction);tick=record['simulation']['tick'];assert record['simulation']['phase']=='paused';page.reload(wait_until='networkidle');page.locator('[data-faction="'+faction+'"]').click();expect(page.get_by_role('button',name='이어서 하기',exact=True)).to_be_enabled();page.get_by_role('button',name='이어서 하기',exact=True).click();wait('window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick==='+str(tick));expect(page.get_by_role('button',name='이어서 진행',exact=True)).to_be_visible();check(faction+'_reload_restore')
    if faction=='terran':
     page.set_viewport_size({'width':844,'height':390});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();assert page.locator('.sr-portrait-content').evaluate('(e)=>e.inert');page.set_viewport_size({'width':width,'height':height});wait('window.__qa.ui.phase==="paused"');check('landscape_blocked_and_paused')
    page.get_by_role('button',name='이어서 진행',exact=True).click();wait('window.__qa.ui.phase==="running"');page.screenshot(path=str(args.output/f'{faction}-{width}.png'));page.get_by_role('button',name='저장하고 나가기',exact=True).click();expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible()
   assert not errors,errors;assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('no_worker_or_js_errors')
  except Exception as e:case['failure']=str(e);traceback.print_exc()
  finally:
   try:page.screenshot(path=str(args.output/f'last-{width}.png'),timeout=5000)
   except Exception as e:case['screenshotError']=str(e)
   context.close()
 # Saving is optional for play; blocked storage must still allow an explicit exit.
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=context.new_page();page.add_init_script(m.OBSERVER);page.add_init_script("const originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('paperoid.stark-rift.development.v1.'))throw new DOMException('Quota exceeded','QuotaExceededError');return originalSetItem.call(this,k,v);};")
 case={'case':'storage_unavailable','checks':{},'errors':[]};results.append(case)
 try:
  page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');page.get_by_role('button',name='새 테스트 시작',exact=True).click();page.wait_for_function('window.__qa.snapshot?.economy?.faction===\"terran\"');expect(page.get_by_text('브라우저 저장에 실패했습니다. 현재 창의 복구본은 유지됩니다.',exact=True)).to_be_visible();page.get_by_role('button',name='저장 없이 선택 화면',exact=True).click();expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible();case['checks']['can_play_and_explicitly_exit_after_save_failure']=True
 except Exception as e:case['failure']=str(e);traceback.print_exc()
 finally:context.close()
 context=browser.new_context(viewport={'width':844,'height':390},is_mobile=True,has_touch=True);page=context.new_page();page.add_init_script(m.OBSERVER);case={'case':'landscape_initial','checks':{},'errors':[]};results.append(case)
 try:
  page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();assert page.locator('.sr-portrait-content').evaluate('(e)=>e.inert');assert m.state(page)['live']==0;expect(page.get_by_text('PC에서는 브라우저 창의 폭을 높이보다 좁게 줄여 주세요.',exact=True)).to_be_visible();case['checks']['no_game_worker_before_portrait_start']=True
 except Exception as e:case['failure']=str(e);traceback.print_exc()
 finally:context.close()
 browser.close()
report={'scope':'Production route/Worker; Chromium mobile touch emulation / SwiftShader; not physical devices','url':args.url,'results':results};(args.output/'hosted-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True)
raise SystemExit(int(any('failure' in r for r in results)))
