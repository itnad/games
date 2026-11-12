"""Production Worker combat test through real touch controls; no state/clock injection."""
import argparse, importlib.util, json, os, sys, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('smoke',str(Path(__file__).with_name('browser-smoke.py')))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:4182');p.add_argument('--output',type=Path,default=Path('/workspace/library-files/stark-rift-combat'));args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 options={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):options['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**options)
 for width,height in [(390,844),(360,640)]:
  for race in ['terran','zerg','protoss']:
   context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
   page=context.new_page();page.set_default_timeout(15000);page.add_init_script(m.OBSERVER);cdp=context.new_cdp_session(page)
   case={'viewport':[width,height],'race':race,'checks':[],'errors':[]};results.append(case)
   page.on('pageerror',lambda e:case['errors'].append(str(e)))
   def check(name):case['checks'].append(name);print(f'{width} {race}: {name}',flush=True)
   def wait(js,timeout=30000):page.wait_for_function(js,timeout=timeout)
   def data():return page.evaluate('window.__qa.snapshot')
   try:
    page.goto(args.url+'/stark-rift-dev',wait_until='networkidle')
    # First preserve an actual economy save, then start an isolated combat scenario.
    page.locator('[data-faction="'+race+'"]').tap();page.get_by_role('button',name='새 테스트 시작',exact=True).tap();wait('window.__qa.snapshot?.economy?.faction==='+json.dumps(race))
    page.get_by_role('button',name='저장하고 나가기',exact=True).tap();expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible()
    economy_record=page.evaluate('(r)=>localStorage.getItem("paperoid.stark-rift.development.v1."+r)',race)
    page.get_by_role('button',name='전투 연습',exact=True).tap();page.get_by_role('button',name='새 테스트 시작',exact=True).tap()
    wait('window.__qa.snapshot?.combat?.scenario==="combat-practice"&&window.__qa.ui?.phase==="running"');page.locator('.sr-viewport canvas').wait_for(state='visible');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
    assert data()['combat']['targetsRemaining']==3;check('practice_ready_with_three_targets')
    # Select the army by the visible control-group button, then tap a real attack-move point.
    page.locator('[data-slot="0"]').tap();attack=page.get_by_role('button',name='공격 이동',exact=True)
    box=attack.bounding_box();assert box and box['y']+box['height']<=height,box
    page.screenshot(path=str(args.output/f'{race}-{width}-before.png'))
    attack.tap();expect(page.get_by_text('공격 이동할 위치를 터치하세요.',exact=True)).to_be_visible()
    point=m.world(page,{'x':23*256,'y':19*256});canvas=page.locator('.sr-viewport canvas').bounding_box();assert canvas['x']<=point['x']<=canvas['x']+canvas['width'] and canvas['y']<=point['y']<=canvas['y']+canvas['height'],(point,canvas)
    m.touch(cdp,page,point);wait('window.__qa.commands.some(c=>c.kind==="attackMove")');check('visible_touch_attack_move')
    wait('window.__qa.snapshot.combat.effects.length>0',20000);page.screenshot(path=str(args.output/f'{race}-{width}-combat.png'));check('actual_attack_effects')
    wait('window.__qa.snapshot.combat.targetsRemaining===0',30000);expect(page.get_by_text('목표 처치 완료',exact=False)).to_be_visible();check('all_targets_killed')
    assert data()['combat']['friendlyRemaining']>0;assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);assert not case['errors'],case['errors']
    page.get_by_role('button',name='저장하고 나가기',exact=True).tap();expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible()
    assert page.evaluate('(r)=>localStorage.getItem("paperoid.stark-rift.development.v1."+r)',race)==economy_record;check('economy_save_unchanged')
    page.reload(wait_until='networkidle');page.locator('[data-faction="'+race+'"]').tap();page.get_by_role('button',name='전투 연습',exact=True).tap();page.get_by_role('button',name='이어서 하기',exact=True).tap();wait('window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.combat?.targetsRemaining===0');check('practice_reload_restored')
    page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();assert page.locator('.sr-portrait-content').evaluate('(e)=>e.inert');page.set_viewport_size({'width':width,'height':height});expect(page.get_by_role('button',name='이어서 진행',exact=True)).to_be_visible();check('portrait_only_after_restore')
    page.screenshot(path=str(args.output/f'{race}-{width}-complete.png'))
   except Exception as e:
    case['failure']=str(e);traceback.print_exc()
    try:page.screenshot(path=str(args.output/f'{race}-{width}-failure.png'));case['lastSnapshot']=data();case['commands']=page.evaluate('window.__qa.commands')
    except Exception:pass
   finally:context.close()
 browser.close()
report={'scope':'Production Worker, touch emulation, Chromium SwiftShader; not physical Android/iOS or GPU certification','url':args.url,'results':results}
(args.output/'combat-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['lastSnapshot','commands']} for r in results],ensure_ascii=False),flush=True)
raise SystemExit(int(any('failure' in r for r in results)))
