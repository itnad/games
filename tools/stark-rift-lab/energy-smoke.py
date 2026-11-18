"""Actual touch research, normal-time completion, capacity accounting and reload for both caster factions."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent;spec=importlib.util.spec_from_file_location('m',root/'browser-smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,required=True);a.add_argument('--race',choices=['terran','protoss']);a.add_argument('--width',type=int,choices=[360,390]);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[]
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 for race in ([args.race] if args.race else ['terran','protoss']):
  techs=['moebius-reactor','apollo-reactor'] if race=='terran' else ['khaydarin-core'];definitions=['terran-ghost','terran-wraith'] if race=='terran' else ['protoss-arbiter'];key='paperoid.stark-rift.development.v1.special.'+race
  for width,height in [(360,640),(390,844)]:
   if args.width and width!=args.width:continue
   context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=context.new_page();page.add_init_script(m.OBSERVER);page.set_default_timeout(20000);case={'race':race,'viewport':[width,height],'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
   def data():return page.evaluate('window.__qa.snapshot')
   def check(name):case['checks'].append(name);print(f'{race}/{width}: {name}',flush=True)
   def tap(locator):
    locator.evaluate('(e)=>e.scrollIntoView({block:"end",inline:"nearest"})');box=locator.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,(box,height);assert locator.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}');locator.tap()
   def save(label):
    m.save(page);raw=page.evaluate('(k)=>localStorage.getItem(k)',key);saved=json.loads(raw);assert saved['formatVersion']==25;(args.output/f'{race}-{width}-{label}-save.json').write_text(raw);return saved
   def reopen(saved):
    tap(page.get_by_role('button',name='저장하고 나가기',exact=True));page.reload(wait_until='networkidle');tap(page.locator('[data-faction="'+race+'"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('t=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===t',arg=saved['simulation']['tick'])
   try:
    page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');tap(page.locator('[data-faction="'+race+'"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='새 테스트 시작',exact=True));page.wait_for_function('window.__qa.ui?.phase==="running"&&window.__qa.snapshot?.combat?.scenario==="special-practice"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled();actors=[e['id'] for e in data()['entities'] if e['owner']==0 and e['definitionId'] in definitions];assert actors and all(e['maxEnergy']==200 for e in data()['entities'] if e['id'] in actors);assert not any(u['technologyId']in techs for u in data()['economy']['upgrades']);gas=data()['economy']['gas'];assert gas==650;check('labelled_practice_provides_facilities_and_costs_without_free_capacity_upgrades')
    for tech in techs:
     tap(page.locator('[data-energy-facility="'+tech+'"]'));tap(page.locator('[data-research="'+tech+'"]'));page.wait_for_function('id=>window.__qa.snapshot.economy.structures.some(b=>b.research?.technologyId===id)',arg=tech)
    assert data()['economy']['gas']==gas-(350 if race=='terran' else 150);check('real_touch_starts_paid_research_in_the_correct_facilities')
    tap(page.get_by_role('button',name='일시정지',exact=True));page.wait_for_function('window.__qa.ui.phase==="paused"');saved=save('research');jobs={b['research']['technologyId']:b['research'] for b in saved['simulation']['economy']['structures'] if b['research'] and b['research']['technologyId']in techs};assert len(jobs)==len(techs) and all(j['totalTicks']==1042 and 0<j['remainingTicks']<1042 for j in jobs.values());case['savedResearch']=jobs;reopen(saved)
    for b in data()['economy']['structures']:
     if b.get('research') and b['research']['technologyId']in jobs:assert b['research']['remainingTicks']==jobs[b['research']['technologyId']]['remainingTicks']
    assert all(e['maxEnergy']==200 for e in data()['entities'] if e['id'] in actors);check('pause_and_reload_preserve_exact_paid_research_progress_and_old_capacity');m.resume(page)
    page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.economy.upgrades.some(u=>u.technologyId===id))',arg=techs,timeout=100000);view=data();case['researchCompletedTick']=view['tick'];assert all(e['maxEnergy']==250 for e in view['entities'] if e['id']in actors)
    for e in view['entities']:
     if e['id']not in actors:continue
     r=next(r for r in saved['simulation']['energy'] if r['entityId']==e['id']);delta=view['tick']-saved['simulation']['tick']
     if race=='terran':expected=min(64000,r['amount']+((r['frameRemainder']+delta*6)//5)*8)
     else:
      remaining=jobs['khaydarin-core']['remainingTicks'];n=delta-remaining+1;rem=(r['frameRemainder']+(remaining-1)*6)%5;expected=min(64000,r['amount']+((rem+n*6)//5)*8)
     assert e['energy']==expected//256,(e,expected,saved['simulation']['tick'],jobs)
    check('normal_time_completion_raises_capacity_to250_without_gifting_current_energy')
    if race=='protoss':
     page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.energy>200))',arg=actors);tap(page.locator('[data-arbiter-select]'));expect(page.locator('[data-arbiter-energy]').first).to_contain_text('/ 250');check('existing_arbiters_regenerate_above_the_previous200_limit')
    else:
     tap(page.locator('[data-cloak-select="terran-ghost"]'));expect(page.locator('[data-energy-status]')).to_contain_text('/ 250');before=next(e for e in data()['entities'] if e['definitionId']=='terran-ghost' and e['owner']==0)['energy'];tap(page.locator('[data-state-ability="cloak"][data-enabled="true"]'));page.wait_for_function('window.__qa.snapshot.entities.some(e=>e.definitionId==="terran-ghost"&&e.owner===0&&e.cloaked)');post=data();after=next(e for e in post['entities'] if e['definitionId']=='terran-ghost' and e['owner']==0);command=page.evaluate('window.__qa.commands.filter(c=>c.kind==="toggleStateAbility"&&c.payload.abilityId==="cloak"&&c.payload.enabled).at(-1)');ack=page.evaluate('n=>window.__qa.events.find(e=>e.kind==="commandAck"&&e.payload.playerId===0&&e.payload.sequence===n).payload',command['sequence']);assert ack['accepted'];r=next(r for r in saved['simulation']['energy'] if r['entityId']==after['id']);frames=(r['frameRemainder']+(post['tick']-saved['simulation']['tick'])*6)//5;prior=(r['frameRemainder']+(ack['executeTick']-saved['simulation']['tick']-1)*6)//5;expected=r['amount']+frames*8-25*256-(frames-prior)*18;case['cloakAccounting']={'tick':post['tick'],'castTick':ack['executeTick'],'requestedTick':command['executeTick'],'expectedEnergy':expected//256,'observedEnergy':after['energy']};assert after['energy']==expected//256 and after['maxEnergy']==250;check('upgraded_ghost_still_pays_original25_energy_cloak_cost')
    page.screenshot(path=str(args.output/f'{race}-{width}-upgraded.png'));tap(page.get_by_role('button',name='일시정지',exact=True));page.wait_for_function('window.__qa.ui.phase==="paused"');finished=save('upgraded');reopen(finished)
    for r in finished['simulation']['energy']:
     e=next(e for e in data()['entities'] if e['id']==r['entityId']);assert e['energy']==r['amount']//256 and e['maxEnergy']==(250 if e['id'] in actors else 200)
    check('completed_research_current_energy_and_cloak_restore_at_the_exact_saved_tick');m.resume(page);page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});assert not case['errors'];assert not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('portrait_only_pause_and_no_runtime_errors')
   except Exception as e:
    case['failure']=str(e);traceback.print_exc()
    try:page.screenshot(path=str(args.output/f'{race}-{width}-failure.png'));case['snapshot']=data();case['commands']=page.evaluate('window.__qa.commands')
    except Exception:pass
   finally:context.close()
 browser.close()
report={'url':args.url,'scope':'Actual Worker/Pixi, native touch paid research, normal-time1042-tick completion and reload. No resource or game-state injection. Chromium SwiftShader; not physical Android/iOS or hardware GPU certification.','results':results};(args.output/'energy-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['snapshot','commands']} for r in results],ensure_ascii=False));raise SystemExit(int(any('failure'in r for r in results)))
