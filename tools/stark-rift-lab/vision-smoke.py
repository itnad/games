"""Production Worker fog, headquarters outcomes, finished saves and surrender through touch."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('smoke',str(Path(__file__).with_name('browser-smoke.py')));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4186');a.add_argument('--output',type=Path,default=Path('/workspace/library-files/stark-rift-fog/local'));a.add_argument('--race',choices=['terran','zerg','protoss']);a.add_argument('--width',type=int,choices=[390,360]);a.add_argument('--skip-memory',action='store_true');args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 def boot(width,height):
  c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);p=c.new_page();p.set_default_timeout(15000);p.add_init_script(m.OBSERVER);return c,p,c.new_cdp_session(p)
 def visible_tap(p,locator,height):
  b=locator.bounding_box();assert b and b['y']>=0 and b['y']+b['height']<=height,b;assert locator.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}');locator.tap()
 for width,height in [(390,844),(360,640)]:
  if args.width and args.width!=width:continue
  for race in ([args.race] if args.race else ['terran','zerg','protoss']):
   c,page,cdp=boot(width,height);case={'viewport':[width,height],'race':race,'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
   def check(name):case['checks'].append(name);print(f'{width} {race}: {name}',flush=True)
   try:
    page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');page.locator('[data-faction="'+race+'"]').tap();page.get_by_role('button',name='본부 공략',exact=True).tap();page.get_by_role('button',name='새 테스트 시작',exact=True).tap();page.wait_for_function('window.__qa.snapshot?.combat?.scenario==="siege-practice"&&window.__qa.ui?.phase==="running"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled()
    assert not page.evaluate('window.__qa.snapshot.entities.some(e=>e.owner===1&&e.kind==="building")');assert page.evaluate('window.__qa.snapshot.visibility.some(v=>v===0)');check('enemy_headquarters_hidden_before_scouting');page.screenshot(path=str(args.output/f'{race}-{width}-before.png'))
    visible_tap(page,page.get_by_role('button',name='정찰 출발',exact=True),height);page.wait_for_function('window.__qa.commands.some(c=>c.kind==="attackMove"&&c.target.y===29*256)');check('scout_button_sends_real_attack_move')
    page.wait_for_function('window.__qa.snapshot.entities.some(e=>e.owner===1&&e.kind==="building")',timeout=45000);check('headquarters_revealed_by_real_scouts')
    page.wait_for_function('window.__qa.ui.phase==="finished"&&window.__qa.ui.outcome?.winnerPlayerId===0',timeout=60000);expect(page.get_by_role('dialog',name='경기 결과')).to_be_visible();expect(page.get_by_text('승리',exact=True)).to_be_visible();check('headquarters_destroyed_and_victory_shown')
    assert page.evaluate('window.__qa.snapshot.scouting.exploredCells>=window.__qa.snapshot.scouting.visibleCells');page.screenshot(path=str(args.output/f'{race}-{width}-victory.png'))
    visible_tap(page,page.get_by_role('button',name='결과 저장하고 나가기',exact=True),height);expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible();key='paperoid.stark-rift.development.v1.siege.'+race;saved=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',key);assert saved['simulation']['phase']=='finished' and saved['simulation']['outcome']['winnerPlayerId']==0;check('finished_match_saved_separately')
    page.reload(wait_until='networkidle');page.locator('[data-faction="'+race+'"]').tap();page.get_by_role('button',name='본부 공략',exact=True).tap();page.get_by_role('button',name='결과 보기',exact=True).tap();expect(page.get_by_role('dialog',name='경기 결과')).to_be_visible();assert page.evaluate('window.__qa.ui.phase')=='finished';assert page.get_by_role('button',name='이어서 진행',exact=True).count()==0;check('finished_result_restores_without_resuming')
    page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();assert page.locator('.sr-portrait-content').evaluate('(e)=>e.inert');page.set_viewport_size({'width':width,'height':height});expect(page.get_by_text('승리',exact=True)).to_be_visible();check('portrait_only_and_result_unchanged')
    assert not case['errors'] and not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('no_runtime_errors')
   except Exception as e:
    case['failure']=str(e);traceback.print_exc()
    try:page.screenshot(path=str(args.output/f'{race}-{width}-failure.png'));case['lastSnapshot']=page.evaluate('window.__qa.snapshot');case['ui']=page.evaluate('window.__qa.ui')
    except Exception:pass
   finally:c.close()
 if not args.skip_memory:
  width,height=390,844;c,page,cdp=boot(width,height);case={'case':'memory_and_surrender','checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
  def check(name):case['checks'].append(name);print('memory: '+name,flush=True)
  try:
   page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');page.get_by_role('button',name='본부 공략',exact=True).tap();page.get_by_role('button',name='새 테스트 시작',exact=True).tap();page.wait_for_function('window.__qa.snapshot?.combat?.scenario==="siege-practice"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled();page.get_by_role('button',name='정찰 출발',exact=True).tap();page.wait_for_function('window.__qa.snapshot.entities.some(e=>e.owner===1&&e.kind==="building")',timeout=45000)
   enemy=page.evaluate('window.__qa.snapshot.entities.find(e=>e.owner===1&&e.kind==="building")');page.get_by_role('button',name='일시정지',exact=True).click();page.wait_for_function('window.__qa.ui.phase==="paused"');check('scout_reveals_before_retreat')
   mini=page.locator('.sr-minimap canvas').bounding_box();m.touch(cdp,page,{'x':mini['x']+mini['width']*14/96,'y':mini['y']+mini['height']*14/96});m.save(page);m.resume(page);m.touch(cdp,page,m.world(page,{'x':18*256,'y':18*256}));page.wait_for_function('window.__qa.snapshot.scouting.contacts.some(c=>c.kind==="building")',timeout=45000)
   contact=page.evaluate('window.__qa.snapshot.scouting.contacts.find(c=>c.kind==="building")');assert contact['x']==enemy['x'] and contact['y']==enemy['y'];assert not page.evaluate('(id)=>window.__qa.snapshot.entities.some(e=>e.id===id)',enemy['id']);assert page.evaluate('window.__qa.snapshot.visibility.some(v=>v===1)');check('fixed_memory_marker_and_explored_fog')
   mini=page.locator('.sr-minimap canvas').bounding_box();m.touch(cdp,page,{'x':mini['x']+mini['width']*22/96,'y':mini['y']+mini['height']*32/96});m.save(page);m.touch(cdp,page,m.world(page,contact));page.wait_for_function('window.__qa.commands.at(-1)?.kind==="move"');check('memory_is_not_a_focus_attack_target');page.screenshot(path=str(args.output/'memory-marker.png'))
   page.get_by_role('button',name='일시정지',exact=True).click();page.wait_for_function('window.__qa.ui.phase==="paused"');page.get_by_role('button',name='항복',exact=True).tap();page.wait_for_function('window.__qa.ui.phase==="finished"&&window.__qa.ui.outcome?.kind==="surrender"');expect(page.get_by_text('패배',exact=True)).to_be_visible();check('paused_surrender_finishes_and_shows_defeat');page.screenshot(path=str(args.output/'surrender.png'))
   assert not case['errors'] and not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('no_runtime_errors')
  except Exception as e:
   case['failure']=str(e);traceback.print_exc()
   try:page.screenshot(path=str(args.output/'memory-failure.png'));case['snapshot']=page.evaluate('window.__qa.snapshot');case['ui']=page.evaluate('window.__qa.ui')
   except Exception:pass
  finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Production Worker, real touch commands, Chromium SwiftShader emulation; not physical Android/iOS or real GPU certification','results':results};(args.output/'vision-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['lastSnapshot','snapshot']} for r in results],ensure_ascii=False),flush=True)
raise SystemExit(int(any('failure' in r for r in results)))
