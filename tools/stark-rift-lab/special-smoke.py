"""Production touch/Worker transport, private cargo, saved recovery and real cloak detection."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('m',str(Path(__file__).with_name('browser-smoke.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,default=Path('/workspace/library-files/stark-rift-special/local'));a.add_argument('--width',type=int,choices=[360,390]);a.add_argument('--race',choices=['terran','zerg','protoss']);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[]
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 for width,height in [(360,640),(390,844)]:
  if args.width and args.width!=width:continue
  for race in ([args.race] if args.race else ['terran','zerg','protoss']):
   c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(15000);page.add_init_script(m.OBSERVER);cdp=c.new_cdp_session(page);case={'viewport':[width,height],'race':race,'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
   def check(name):case['checks'].append(name);print(f'{race} {width}: {name}',flush=True)
   def data():return page.evaluate('window.__qa.snapshot')
   def tap(locator):
    locator.evaluate('(e)=>e.scrollIntoView({block:"end",inline:"nearest"})');box=locator.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,box
    assert locator.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}'),'covered touch target';locator.tap()
   try:
    page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');page.locator('[data-faction="'+race+'"]').tap();page.get_by_role('button',name='특수 연습',exact=True).tap();start=page.get_by_role('button',name='새 테스트 시작',exact=True);box=start.bounding_box();assert box and box['y']+box['height']<=height;tap(start);page.wait_for_function('window.__qa.snapshot?.combat?.scenario==="special-practice"&&window.__qa.ui?.phase==="running"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled();check('practice_starts_and_carriers_selected');m.save(page)
    assert data()['economy']['transports'];assert all(t['capacity']==8 for t in data()['economy']['transports']);groups=page.evaluate('window.__qa.ui.controlGroups');troops=groups[0]['entityIds'];assert len(troops)==2;ships=[t['entityId'] for t in data()['economy']['transports']];base_supply=data()['economy']['supplyUsedHalf'];check('original_eight_slots_and_practice_research')
    tap(page.locator('[data-transport="load"]'));tap(page.locator('[data-slot="0"]'));page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.economy.transports.some(t=>t.passengers.some(p=>p.id===id)))',arg=troops,timeout=35000);assert not any(e['id'] in troops for e in data()['entities']);assert data()['economy']['supplyUsedHalf']==base_supply;assert page.evaluate('(ids)=>ids.every(id=>window.__qa.ui.controlGroups[0].entityIds.includes(id))',troops);check('group_boards_without_losing_slots_or_supply');page.screenshot(path=str(args.output/f'{race}-{width}-cargo.png'))
    # Leave load mode before selecting the transported group; the group must remain selected and highlight its carriers.
    tap(page.get_by_role('button',name='지시 취소',exact=True));tap(page.locator('[data-slot="0"]'));expect(page.get_by_role('button',name='수송선 선택',exact=True)).to_be_visible();tap(page.get_by_role('button',name='수송선 선택',exact=True));check('loaded_group_resolves_to_its_carriers')
    # A long portrait touch only opens details. A normal touch queues a single real unload.
    portrait=page.locator('[data-passenger]').first;pid=int(portrait.get_attribute('data-passenger'));portrait.evaluate('(e)=>e.scrollIntoView({block:"end"})');box=portrait.bounding_box();m.touch(cdp,page,m.center(box),hold=650);page.wait_for_timeout(150);assert any(p['id']==pid for t in data()['economy']['transports'] for p in t['passengers']);check('portrait_long_press_does_not_unload')
    tap(page.locator('[data-passenger="'+str(pid)+'"]'));page.wait_for_function('id=>!window.__qa.snapshot.economy.transports.some(t=>t.passengers.some(p=>p.id===id))',arg=pid);check('individual_portrait_unloads_one_passenger')
    # Save another passenger aboard, close the Worker, reload and restore the exact cargo manifest.
    remaining=[p['id'] for t in data()['economy']['transports'] for p in t['passengers']];assert remaining;tap(page.get_by_role('button',name='저장하고 나가기',exact=True));expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible();key='paperoid.stark-rift.development.v1.special.'+race;raw=page.evaluate('(k)=>localStorage.getItem(k)',key);saved=json.loads(raw);assert saved['formatVersion']==16 and saved['simulation']['special']['transports'];(args.output/f'{race}-{width}-cargo-save.json').write_text(raw);check('private_cargo_saved_under_separate_key')
    page.reload(wait_until='networkidle');page.locator('[data-faction="'+race+'"]').tap();page.get_by_role('button',name='특수 연습',exact=True).tap();tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('({tick,ids})=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===tick&&ids.every(id=>window.__qa.snapshot.economy.transports.some(t=>t.passengers.some(p=>p.id===id)))',arg={"tick":saved["simulation"]["tick"],"ids":remaining});m.resume(page);check('cargo_and_groups_restore_after_reload')
    tap(page.locator('[data-transport="unload"]'));mini=page.locator('.sr-minimap canvas').bounding_box();target={'x':mini['x']+mini['width']*24/96,'y':mini['y']+mini['height']*21/96};page.touchscreen.tap(**target);page.wait_for_function('window.__qa.commands.at(-1)?.kind==="unloadTransport"');page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id))',arg=remaining,timeout=45000);check('minimap_order_flies_and_unloads_at_valid_ground');page.screenshot(path=str(args.output/f'{race}-{width}-landed.png'))
    if race=='protoss':
     # Enemy DT is concealed until the actual Observer moves into both sight and detection range.
     observer=next(e for e in data()['entities'] if e['definitionId']=='protoss-observer' and e['owner']==0);assert not any(e['owner']==1 and e['definitionId']=='protoss-dark-templar' for e in data()['entities']);m.save(page);page.touchscreen.tap(**m.world(page,observer));page.wait_for_function('window.__qa.session!==null');m.save(page);page.touchscreen.tap(**m.world(page,{'x':25*256,'y':20*256}));page.wait_for_function('window.__qa.snapshot.entities.some(e=>e.owner===1&&e.definitionId==="protoss-dark-templar"&&e.cloaked)',timeout=30000);check('observer_reveals_real_permanently_cloaked_enemy');page.screenshot(path=str(args.output/f'protoss-{width}-detected.png'))
    page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});check('portrait_only_pause_preserves_cargo');assert not case['errors'];assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('no_runtime_errors')
   except Exception as e:
    case['failure']=str(e);traceback.print_exc()
    try:page.screenshot(path=str(args.output/f'{race}-{width}-failure.png'));case['snapshot']=data();case['ui']=page.evaluate('window.__qa.ui');case['commands']=page.evaluate('window.__qa.commands')
    except Exception:pass
   finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Production Worker/Pixi and real touch; no injected resources or clock acceleration; Chromium SwiftShader emulation, not physical Android/iOS or hardware GPU certification','results':results};(args.output/'special-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['snapshot','commands']} for r in results],ensure_ascii=False),flush=True);raise SystemExit(int(any('failure' in r for r in results)))
