"""Real portrait touch / production Worker burrow research and saved-state recovery; no resource injection."""
import argparse, importlib.util, json, os, sys, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('smoke', str(Path(__file__).with_name('browser-smoke.py')))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
a = argparse.ArgumentParser(); a.add_argument('--url', default='http://127.0.0.1:4188'); a.add_argument('--output', type=Path, default=Path('/workspace/library-files/stark-rift-burrow/local')); a.add_argument('--width', type=int, choices=[360,390]); args = a.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as pw:
    opts = {'executable_path': '/usr/bin/chromium', 'headless': True, 'args': ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
    if args.url.startswith('https:'): opts['proxy'] = {'server': os.environ['HTTPS_PROXY']}
    browser = pw.chromium.launch(**opts)
    for width, height in [(360,640),(390,844)]:
        if args.width and args.width != width: continue
        c = browser.new_context(viewport={'width':width,'height':height}, is_mobile=True, has_touch=True)
        page = c.new_page(); page.set_default_timeout(15000); page.add_init_script(m.OBSERVER); page.add_init_script('window.__touchLog=[];for(const type of ["pointerdown","pointerup","pointercancel"]){window.addEventListener(type,e=>window.__touchLog.push({type,t:performance.now(),x:e.clientX,y:e.clientY,target:e.target.tagName}),true);} '); cdp = c.new_cdp_session(page)
        case = {'viewport':[width,height], 'checks':[], 'errors':[]}; results.append(case)
        page.on('pageerror', lambda e: case['errors'].append(str(e)))
        def check(name): case['checks'].append(name); print(f'{width}: {name}', flush=True)
        def wait(js, timeout=30000): page.wait_for_function(js, timeout=timeout)
        def data(): return page.evaluate('window.__qa.snapshot')
        def tap(locator):
            locator.evaluate('(e)=>e.scrollIntoView({block:"end",inline:"nearest"})'); box = locator.bounding_box()
            assert box and box['y'] >= 0 and box['y']+box['height'] <= height, ('offscreen',box)
            assert locator.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}'), 'covered touch target'
            locator.tap()
        try:
            page.goto(args.url+'/stark-rift-dev', wait_until='networkidle'); page.locator('[data-faction="zerg"]').tap()
            start = page.get_by_role('button',name='새 테스트 시작',exact=True); box = start.bounding_box(); assert box['y']+box['height']<=height; tap(start)
            wait('window.__qa.snapshot?.economy?.faction==="zerg"&&window.__qa.ui?.phase==="running"'); expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled(); m.save(page)
            tap(page.get_by_role('button',name='일꾼 선택',exact=True)); expect(page.get_by_role('button',name='버로우',exact=True)).to_be_disabled(); check('research_required_before_toggle')
            tap(page.get_by_role('button',name='건설',exact=True)); tap(page.locator('[data-build="zerg-extractor"]')); m.touch(cdp,page,m.world(page,{'x':19*256+128,'y':10*256+128})); expect(page.get_by_role('button',name='건설 확정',exact=True)).to_be_enabled(); tap(page.get_by_role('button',name='건설 확정',exact=True))
            wait('window.__qa.snapshot.economy.structures.some(b=>b.completed&&window.__qa.snapshot.entities.find(e=>e.id===b.entityId)?.definitionId==="zerg-extractor")',45000); check('extractor_constructed_with_real_resources')
            tap(page.get_by_role('button',name='일꾼 선택',exact=True)); expect(page.locator(".sr-selection-title strong")).to_have_text("드론"); m.save(page); (args.output/f"pre-gas-{width}.json").write_text(page.evaluate('localStorage.getItem("paperoid.stark-rift.development.v1.zerg")')); page.touchscreen.tap(**m.world(page,{'x':19*256+128,'y':10*256+128})); wait('window.__qa.commands.some(c=>c.kind==="gather"&&c.payload.resourceId==="main-0-8")')
            wait('window.__qa.snapshot.economy.gas>=100&&window.__qa.snapshot.economy.minerals>=150',120000); check('mined_research_cost_without_injection')
            # The worker remains selected: touch the headquarters body, then use its real research control.
            m.touch(cdp,page,m.world(page,{'x':14*256,'y':14*256+128})); research = page.get_by_role('button',name='버로우 연구',exact=False); expect(research).to_be_enabled(); tap(research)
            wait('window.__qa.snapshot.economy.structures.some(b=>b.research?.technologyId==="burrowing")'); before = len(data()['economy']['workers']); tap(page.locator('[data-produce="zerg-drone"]')); wait('window.__qa.snapshot.economy.structures.some(b=>b.queue.some(q=>q.definitionId==="zerg-drone"))'); check('research_and_larva_production_run_together')
            wait('window.__qa.snapshot.economy.upgrades.some(u=>u.technologyId==="burrowing")',40000)
            assert len(data()['economy']['workers']) > before; check('research_and_worker_production_completed')
            tap(page.get_by_role('button',name='일꾼 선택',exact=True)); m.save(page); actor = page.evaluate('window.__qa.session.selection.entityIds[0]'); tap(page.get_by_role('button',name='버로우',exact=True))
            page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.burrowed)',arg=actor); check('manual_burrow_changes_visible_state'); page.screenshot(path=str(args.output/f'burrow-{width}.png'))
            ent = next(e for e in data()['entities'] if e['id']==actor); point = {'x':17*256,'y':19*256}; m.touch(cdp,page,m.world(page,point)); page.wait_for_function('window.__qa.events.some(e=>e.kind==="commandAck"&&!e.payload.accepted&&e.payload.code==="invalid_state")'); after = next(e for e in data()['entities'] if e['id']==actor); assert after['burrowed'] and (after['x'],after['y'])==(ent['x'],ent['y']); check('ground_touch_does_not_implicitly_unburrow')
            tap(page.get_by_role('button',name='저장하고 나가기',exact=True)); expect(page.get_by_role('heading',name='스타크 리프트',exact=True)).to_be_visible(); key = 'paperoid.stark-rift.development.v1.zerg'; raw = page.evaluate('(k)=>localStorage.getItem(k)',key); saved = json.loads(raw); assert saved['formatVersion']==10; assert {'entityId':actor,'kind':'burrow'} in saved['simulation']['vision']['concealed']; cargo = next(w for w in saved['simulation']['economy']['workers'] if w['entityId']==actor); case['savedTick']=saved['simulation']['tick']; check('burrow_and_research_saved')
            page.reload(wait_until='networkidle'); page.locator('[data-faction="zerg"]').tap(); tap(page.get_by_role('button',name='이어서 하기',exact=True)); wait('window.__qa.ui?.phase==="paused"'); expect(page.get_by_role('button',name='잠복 해제',exact=True)).to_be_disabled(); m.resume(page)
            page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.burrowed)',arg=actor); check('reload_restores_research_and_burrow')
            tap(page.get_by_role('button',name='잠복 해제',exact=True)); page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&!e.burrowed)',arg=actor); check('manual_unburrow_after_reload')
            tap(page.get_by_role('button',name='자동 채취',exact=True)); wait('window.__qa.commands.at(-1)?.kind==="autoGather"'); check('work_resumes_only_after_manual_action')
            page.set_viewport_size({'width':height,'height':width}); expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible(); wait('window.__qa.ui.phase==="paused"'); page.set_viewport_size({'width':width,'height':height}); check('landscape_remains_blocked_and_paused')
            assert not case['errors']; assert not any(e['kind']=='fatalError' for e in m.state(page)['events']); check('no_worker_or_js_errors')
            (args.output/f'zerg-{width}-save.json').write_text(raw)
        except Exception as e:
            case['failure']=str(e); traceback.print_exc()
            try: page.screenshot(path=str(args.output/f'failure-{width}.png')); case['snapshot']=data(); case['ui']=page.evaluate('window.__qa.ui'); case['commands']=page.evaluate('window.__qa.commands'); case['session']=page.evaluate('window.__qa.session'); case['touchLog']=page.evaluate('window.__touchLog')
            except Exception: pass
        finally: c.close()
    browser.close()
report={'url':args.url,'scope':'Production Worker and real touch commands; Chromium/SwiftShader portrait emulation, not physical Android/iOS or GPU acceptance','results':results}
(args.output/'burrow-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)); print(json.dumps([{k:v for k,v in r.items() if k!='snapshot'} for r in results],ensure_ascii=False),flush=True)
raise SystemExit(int(any('failure' in r for r in results)))
