"""Real browser economy flow; no resource injection or clock acceleration. Chromium emulation only."""
import argparse,importlib.util,json,time,sys,traceback
sys.dont_write_bytecode=True
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('smoke',str(Path(__file__).with_name('browser-smoke.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4174');parser.add_argument('--out',default='/workspace/library-files/stark-rift-stage4');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.add_init_script(m.OBSERVER);cdp=c.new_cdp_session(page);checks={};started=time.monotonic()
 def data():return page.evaluate('window.__qa.snapshot')
 def wait(js,timeout=60000):page.wait_for_function(js,timeout=timeout)
 def tap_entity(entity):m.touch(cdp,page,m.world(page,entity))
 def click(selector):page.locator(selector).evaluate('(e)=>{e.scrollIntoView({block:"nearest"});e.click();}')
 def place(id,x,y):
  click('[data-build="'+id+'"]');m.touch(cdp,page,m.world(page,{'x':x*256,'y':y*256}));expect(page.get_by_role('button',name='건설 확정',exact=True)).to_be_enabled();page.get_by_role('button',name='건설 확정',exact=True).click();
  wait('window.__qa.snapshot.economy.structures.some(b=>!b.completed)');checks[id+'_accepted']=True
 try:
  page.goto(args.url+'?scenario=economy-terran',wait_until='networkidle');wait("window.__qa.ui?.phase==='paused'&&window.__qa.snapshot?.economy");expect(page.locator('[data-balance="minerals"]')).to_have_text('50');page.screenshot(path=str(out/'terran-start.png'));checks['starting_base']=True;print('starting base',flush=True)
  m.resume(page);page.locator('[data-produce="terran-scv"]').click();wait('window.__qa.snapshot.economy.structures[0].queue.length===1');wait('window.__qa.snapshot.economy.workers.length===5',15000);checks['worker_production']=True;print('worker produced',flush=True)
  wait('window.__qa.snapshot.economy.minerals>=100',30000);page.get_by_role('button',name='일시정지',exact=True).first.click();wait("window.__qa.ui.phase==='paused'");worker=next(e for e in data()['entities'] if e['kind']=='worker');tap_entity(worker);m.resume(page);place('terran-supply-depot',18,17)
  wait('window.__qa.snapshot.economy.structures.some(b=>b.completed&&window.__qa.snapshot.entities.find(e=>e.id===b.entityId)?.definitionId==="terran-supply-depot")',35000);checks['supply_completion']=True;print('supply completed',flush=True)
  wait('window.__qa.snapshot.economy.minerals>=150',35000);worker=next(e for e in data()['entities'] if e['kind']=='worker');tap_entity(worker);place('terran-barracks',19,20)
  wait('window.__qa.snapshot.economy.structures.some(b=>b.completed&&window.__qa.snapshot.entities.find(e=>e.id===b.entityId)?.definitionId==="terran-barracks")',50000);checks['barracks_completion']=True;print('barracks completed',flush=True)
  barracks=next(e for e in data()['entities'] if e['definitionId']=='terran-barracks');tap_entity(barracks);click('[data-produce="terran-marine"]');wait('window.__qa.snapshot.entities.some(e=>e.definitionId==="terran-marine")',15000);checks['marine_production']=True;print('marine produced',flush=True)
  page.get_by_role('button',name='집결지 지정',exact=True).evaluate('(e)=>{e.scrollIntoView({block:"nearest"});e.click();}');m.touch(cdp,page,m.world(page,{'x':20*256,'y':18*256}));wait('window.__qa.snapshot.economy.structures.some(b=>b.rally!==null)');checks['rally_command']=True
  page.get_by_role('button',name='일시정지',exact=True).first.click();wait("window.__qa.ui.phase==='paused'");m.save(page);before=data()['tick'];page.get_by_role('button',name='복원',exact=True).click();wait("window.__qa.events.filter(e=>e.kind==='snapshotLoaded').length===2");assert data()['tick']==before;checks['economy_save_restore']=True
  page.screenshot(path=str(out/'terran-production.png'));page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(300);assert page.locator('.sr-portrait-content').evaluate('(e)=>e.inert');checks['landscape_blocked']=True;page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300)
  for faction in ['zerg','protoss']:
   page.get_by_role('combobox',name='검증 시나리오').select_option('economy-'+faction);wait('window.__qa.snapshot?.economy?.faction==="'+faction+'"');page.locator('.sr-viewport canvas').wait_for(state='visible');expect(page.get_by_role('button',name='근접',exact=True)).to_be_enabled();page.wait_for_timeout(300);page.screenshot(path=str(out/(faction+'-start.png')));assert data()['economy']['supplyUsedHalf']==8 and data()['economy']['supplyCapHalf']==18;checks[faction+'_start']=True
  assert not errors,errors;assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);checks['no_js_worker_errors']=True
 except Exception as error:
  errors.append(str(error));traceback.print_exc()
 finally:
  report={'checks':checks,'errors':errors,'elapsedSeconds':time.monotonic()-started,'scope':'Chromium touch emulation / SwiftShader; not physical Android, iOS or GPU','lastState':m.state(page)};(out/'browser-economy.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='lastState'},ensure_ascii=False),flush=True);b.close()
 if errors:raise SystemExit(1)
