"""Test all ranged weapons on the production Worker via touch; no state or clock injection."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('smoke',str(Path(__file__).with_name('browser-smoke.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4184');a.add_argument('--output',type=Path,default=Path('/workspace/library-files/stark-rift-projectiles/local'));a.add_argument("--race",choices=["terran","zerg","protoss"]);a.add_argument("--width",type=int,choices=[390,360]);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True)
observe=m.OBSERVER+'''\nwindow.__ranged={weapons:[],flying:false};const ObservedWorker=window.Worker;
window.Worker=class extends ObservedWorker{constructor(...args){super(...args);this.addEventListener('message',({data:m})=>{if(m.kind==='renderSnapshot'){for(const e of m.payload.combat?.effects??[])if(e.weaponId&&!window.__ranged.weapons.includes(e.weaponId))window.__ranged.weapons.push(e.weaponId);if(m.payload.combat?.projectiles.length)window.__ranged.flying=true;}});}};'''
results=[]
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 for width,height in [(390,844),(360,640)]:
  if args.width and args.width!=width:continue
  for race in ([args.race] if args.race else ['terran','zerg','protoss']):
   c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(15000);page.add_init_script(observe);cdp=c.new_cdp_session(page)
   case={'viewport':[width,height],'race':race,'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
   def check(name):case['checks'].append(name);print(f'{width} {race}: {name}',flush=True)
   def wait(js,timeout=30000):page.wait_for_function(js,timeout=timeout)
   def tap_visible(locator):
    box=locator.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,box
    assert locator.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}')
    locator.tap()
   try:
    page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');page.locator('[data-faction="'+race+'"]').tap()
    # Keep a real base-economy save while playing the separate ranged mode.
    page.get_by_role('button',name='새 테스트 시작',exact=True).tap();wait('window.__qa.snapshot?.economy?.faction==='+json.dumps(race));page.get_by_role('button',name='저장하고 나가기',exact=True).tap();expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible()
    economy=page.evaluate('(r)=>localStorage.getItem("paperoid.stark-rift.development.v1."+r)',race)
    page.get_by_role('button',name='원거리 연습',exact=True).tap();page.get_by_role('button',name='새 테스트 시작',exact=True).tap();wait('window.__qa.snapshot?.combat?.scenario==="ranged-practice"&&window.__qa.ui?.phase==="running"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
    assert page.evaluate('window.__qa.snapshot.combat.targetsRemaining')==3;assert not page.evaluate('window.__ranged.weapons.length');check('new_army_and_three_targets_ready')
    page.screenshot(path=str(args.output/f'{race}-{width}-before.png'))
    for slot in ([None] if race=='terran' else [0]):
     if slot is not None:tap_visible(page.locator('[data-slot="'+str(slot)+'"]'))
     tap_visible(page.get_by_role('button',name='공격 이동',exact=True))
     point=m.world(page,{'x':23*256,'y':19*256});box=page.locator('.sr-viewport canvas').bounding_box();assert box['x']<=point['x']<=box['x']+box['width'] and box['y']<=point['y']<=box['y']+box['height'];m.touch(cdp,page,point)
    wait('window.__qa.commands.some(c=>c.kind==="attackMove")');check('visible_touch_attack_move')
    if race!='zerg':wait('window.__ranged.flying',20000);check('actual_flying_projectiles')
    wait('window.__qa.snapshot.combat.targetsRemaining===0',30000);check('all_ground_and_air_targets_cleared')
    expected=['Fragmentation_Grenade','Arclite_Cannon'] if race=='terran' else ['Needle_Spines'] if race=='zerg' else ['Phase_Disruptor']
    observed=page.evaluate('window.__ranged.weapons');assert all(w in observed for w in expected),(expected,observed);check('every_expected_weapon_fired')
    page.screenshot(path=str(args.output/f'{race}-{width}-complete.png'));page.get_by_role('button',name='저장하고 나가기',exact=True).tap();expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible()
    assert page.evaluate('(r)=>localStorage.getItem("paperoid.stark-rift.development.v1."+r)',race)==economy;check('economy_save_unchanged')
    page.reload(wait_until='networkidle');page.locator('[data-faction="'+race+'"]').tap();page.get_by_role('button',name='원거리 연습',exact=True).tap();page.get_by_role('button',name='이어서 하기',exact=True).tap();wait('window.__qa.snapshot?.combat?.scenario==="ranged-practice"&&window.__qa.snapshot.combat.targetsRemaining===0&&window.__qa.ui?.phase==="paused"');check('ranged_save_reload_restored')
    page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();assert page.locator('.sr-portrait-content').evaluate('(e)=>e.inert');page.set_viewport_size({'width':width,'height':height});expect(page.get_by_role('button',name='이어서 진행',exact=True)).to_be_visible();check('portrait_only')
    assert not case['errors'] and not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('no_runtime_errors')
   except Exception as e:
    case['failure']=str(e);traceback.print_exc();print(json.dumps(page.evaluate('window.__ranged')),flush=True)
    try:page.screenshot(path=str(args.output/f'{race}-{width}-failure.png'));case['lastSnapshot']=page.evaluate('window.__qa.snapshot');case['weapons']=page.evaluate('window.__ranged.weapons')
    except Exception:pass
   finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Production Worker touch emulation / Chromium SwiftShader; not physical Android/iOS or real GPU certification','results':results};(args.output/'ranged-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k!='lastSnapshot'} for r in results],ensure_ascii=False),flush=True)
raise SystemExit(int(any('failure' in r for r in results)))
