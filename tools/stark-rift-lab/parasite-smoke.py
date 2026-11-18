"""Native touch Parasite, borrowed enemy vision after friendly retreat, and exact save continuity."""
import argparse,importlib.util,json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parent;spec=importlib.util.spec_from_file_location('m',root/'browser-smoke.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:4189');a.add_argument('--output',type=Path,required=True);a.add_argument('--width',type=int,choices=[360,390]);args=a.parse_args();args.output.mkdir(parents=True,exist_ok=True);results=[];KEY='paperoid.stark-rift.development.v1.special.zerg'
sights={}
for p in (root.parents[1]/'app/stark-rift/data').glob('*.json'):
 d=json.loads(p.read_text())
 if isinstance(d,dict):
  for u in d.get('units',[]):
   if isinstance(u,dict) and 'name' in u and 'sightRangeTiles' in u:sights[u['name'].lower().replace('_','-')]=u['sightRangeTiles']
observer=m.OBSERVER.replace("if(m.kind==='renderSnapshot')window.__qa.snapshot=m.payload;", "if(m.kind==='renderSnapshot'){window.__qa.snapshot=m.payload;if(m.payload.parasiteEffects?.length)window.__qa.parasiteEffect=true;}")
with sync_playwright() as pw:
 opts={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if args.url.startswith('https:'):opts['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=pw.chromium.launch(**opts)
 for width,height in [(360,640),(390,844)]:
  if args.width and width!=args.width:continue
  c=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True);page=c.new_page();page.set_default_timeout(20000);page.add_init_script(observer);case={'viewport':[width,height],'checks':[],'errors':[]};results.append(case);page.on('pageerror',lambda e:case['errors'].append(str(e)))
  def data():return page.evaluate('window.__qa.snapshot')
  def check(name):case['checks'].append(name);print(f'{width}: {name}',flush=True)
  def tap(loc):
   loc.evaluate('(e)=>e.scrollIntoView({block:"end",inline:"nearest"})');box=loc.bounding_box();assert box and box['y']>=0 and box['y']+box['height']<=height,(box,height);assert loc.evaluate('(e)=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}');loc.tap()
  def save(label):
   m.save(page);raw=page.evaluate('(k)=>localStorage.getItem(k)',KEY);saved=json.loads(raw);assert saved['formatVersion']==26;(args.output/f'{width}-{label}-save.json').write_text(raw);return saved
  def reopen(saved):
   tap(page.get_by_role('button',name='저장하고 나가기',exact=True));page.reload(wait_until='networkidle');tap(page.locator('[data-faction="zerg"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='이어서 하기',exact=True));page.wait_for_function('t=>window.__qa.ui?.phase==="paused"&&window.__qa.snapshot?.tick===t',arg=saved['simulation']['tick'])
  def pause():
   loc=page.get_by_role('button',name='일시정지',exact=True);box=loc.bounding_box();assert box;page.mouse.click(**m.center(box));page.wait_for_function('window.__qa.ui.phase==="paused"')
  def ack_last():
   seq=page.evaluate('window.__qa.commands.at(-1).sequence');page.wait_for_function('n=>window.__qa.events.some(e=>e.kind==="commandAck"&&e.payload.sequence===n)',arg=seq);ack=page.evaluate('n=>window.__qa.events.find(e=>e.kind==="commandAck"&&e.payload.sequence===n).payload',seq);assert ack['accepted'],ack;return ack
  def point(x,y):
   m.save(page);pos=m.world(page,{'x':x*256,'y':y*256});box=page.locator('.sr-viewport canvas').bounding_box();assert box['x']<=pos['x']<=box['x']+box['width'] and box['y']<=pos['y']<=box['y']+box['height'],(pos,box);page.touchscreen.tap(**pos)
  def in_friendly_sight(saved,target):
   s=saved['simulation'];e=s['entities'];cargo={p for t in s.get('special',{}).get('transports',[]) for p in t['passengers']};out=[]
   for i,eid in enumerate(e['id']):
    if e['owner'][i]!=0 or e['health'][i]<=0 or eid in cargo:continue
    r=2 if any(b['entityId']==eid for b in s.get('medicSpells',{}).get('blind',[])) else sights[e['definitionId'][i]];dx=e['x'][i]//256-target['x']//256;dy=e['y'][i]//256-target['y']//256
    if dx*dx+dy*dy<=r*r:out.append(eid)
   return out
  try:
   page.goto(args.url+'/stark-rift-dev',wait_until='networkidle');tap(page.locator('[data-faction="zerg"]'));tap(page.get_by_role('button',name='특수 연습',exact=True));tap(page.get_by_role('button',name='새 테스트 시작',exact=True));page.wait_for_function('window.__qa.ui?.phase==="running"&&window.__qa.snapshot?.combat?.scenario==="special-practice"');expect(page.get_by_role('button',name='기본',exact=True)).to_be_enabled();tap(page.get_by_role('button',name='광역',exact=True));tap(page.locator('[data-slot="4"]'));actors=[e['id'] for e in data()['entities'] if e['owner']==0 and e['definitionId']=='zerg-queen'];caster=max(actors);assert len(actors)==2;expect(page.locator('[data-cast-ability="parasite"]')).to_be_disabled();assert not any(u['technologyId']=='parasite' for u in data()['economy']['upgrades']);check('built_in_parasite_requires_no_research_and_normal_energy_starts_below75');page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.energy>=75)',arg=caster,timeout=55000);expect(page.locator('[data-cast-ability="parasite"]')).to_be_enabled();check('native_ui_becomes_ready_through_natural_energy_regeneration_without_research_or_grants')
   target=next(e for e in data()['entities'] if e['owner']==1 and e['definitionId']=='protoss-probe' and e['x']==30*256);tid=target['id'];case['victim']={'id':tid,'x':target['x'],'y':target['y'],'health':target['health'],'shield':target['shield']};tap(page.locator('[data-cast-ability="parasite"]'));point(30,20);ack=ack_last();assert ack['executedEntityIds']==[caster];page.wait_for_function('id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.parasited)',arg=tid);pause();active=save('active');assert active['simulation']['parasites']['records']==[{'entityId':tid,'appliedTick':ack['executeTick'],'sourceMask':1}];assert page.evaluate('!!window.__qa.parasiteEffect');now=next(e for e in data()['entities'] if e['id']==tid);assert now['owner']==1 and now['health']==target['health'] and now['shield']==target['shield'];case['cast']={'executeTick':ack['executeTick'],'savedTick':active['simulation']['tick'],'cooldowns':active['simulation']['parasites']['cooldowns']};page.screenshot(path=str(args.output/f'{width}-infected.png'));check('native_enemy_target_cast_pays75energy_applies_permanent_status_and_does_not_change_hp_shields_or_owner')
   reopen(active);restored=save('active-restored');assert all(restored['simulation'].get(k)==active['simulation'].get(k) for k in ['parasites','queen','energy','movement','commandState','rngStreams']);tap(page.locator('[data-slot="4"]'));expect(page.locator('[data-cast-ability="parasite"]')).to_be_disabled();check('reload_preserves_exact_infection_cooldown_energy_orders_rng_and_paused_controls');m.resume(page)
   lurker=next(e['id'] for e in data()['entities'] if e['owner']==0 and e['definitionId']=='zerg-lurker');point(20,18);tap(page.locator('[data-transport="load"]'));tap(page.locator('[data-slot="2"]'));page.wait_for_function('id=>window.__qa.snapshot.economy.transports.some(t=>t.passengers.some(p=>p.id===id))',arg=lurker,timeout=40000);loaded=next(t['entityId'] for t in data()['economy']['transports'] if any(p['id']==lurker for p in t['passengers']));tap(page.get_by_role('button',name='지시 취소',exact=True));check('native_transport_load_removes_the_uninfected_lurker_scout_as_a_friendly_sight_source')
   tap(page.locator('[data-queen-select]'));point(16,24);move_queens=ack_last();assert sorted(move_queens['executedEntityIds'])==sorted(actors);page.wait_for_function('ids=>ids.every(id=>window.__qa.snapshot.entities.some(e=>e.id===id&&e.x<19*256))',arg=actors,timeout=30000);pause();tracked=save('tracked');contributors=in_friendly_sight(tracked,target);assert contributors==[],contributors;assert next(e for e in data()['entities'] if e['id']==tid)['parasited'];page.wait_for_function('t=>window.__qa.snapshot.visibility[Math.floor(t.y/256)*window.__qa.snapshot.widthTiles+Math.floor(t.x/256)]===2',arg=target);assert tracked['simulation']['entities']['owner'][tracked['simulation']['entities']['id'].index(tid)]==1;assert tracked['simulation']['parasites']['records'][0]['sourceMask']==1;case['borrowedSight']={'savedTick':tracked['simulation']['tick'],'friendlyContributors':contributors,'loadedScout':lurker,'retiredCarrier':loaded};page.screenshot(path=str(args.output/f'{width}-borrowed-sight.png'));check('infected_enemy_remains_visible_after_every_friendly_sight_source_leaves_confirmed_against_saved_positions_and_original_sight_radii')
   reopen(tracked);again=save('tracked-restored');assert all(again['simulation'].get(k)==tracked['simulation'].get(k) for k in ['parasites','energy','special','movement','commandState','rngStreams']);assert in_friendly_sight(again,target)==[];assert next(e for e in data()['entities'] if e['id']==tid)['parasited'];check('borrowed_enemy_sight_and_loaded_scout_roundtrip_without_adding_player_units_or_resources');m.resume(page);page.wait_for_function('t=>window.__qa.snapshot.tick>=t+40',arg=tracked['simulation']['tick']);assert next(e for e in data()['entities'] if e['id']==tid)['parasited'];pause();permanent=save('permanent');assert permanent['simulation']['parasites']['cooldowns']==[] and permanent['simulation']['parasites']['records'];check('infection_persists_after_the_shared_cooldown_and_visual_effect_expire')
   m.resume(page);page.set_viewport_size({'width':height,'height':width});expect(page.get_by_text('세로 화면으로 돌려 주세요',exact=True)).to_be_visible();page.wait_for_function('window.__qa.ui.phase==="paused"');page.set_viewport_size({'width':width,'height':height});assert page.evaluate('window.__qa.ui.phase')=='paused';assert not case['errors'] and not any(e['kind']=='fatalError' for e in m.state(page)['events']);check('portrait_only_rotation_pause_and_no_runtime_errors')
  except Exception as e:
   case['failure']=str(e);traceback.print_exc()
   try:save('failure');page.screenshot(path=str(args.output/f'{width}-failure.png'));case['snapshot']=data();case['commands']=page.evaluate('window.__qa.commands');case['events']=page.evaluate('window.__qa.events')
   except Exception:pass
  finally:c.close()
 browser.close()
report={'url':args.url,'scope':'Actual Worker/Pixi/native touch, no-research75energy Parasite on an enemy, exact active save/reload, load the Lurker scout and move Queens out of sight, verify borrowed enemy vision against saved friendly positions and original sight radii, exact tracked-state reload and permanence. No resource/state injection. Chromium SwiftShader does not certify physical Android/iOS or hardware GPU.','results':results};(args.output/'parasite-browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps([{k:v for k,v in r.items() if k not in ['snapshot','commands','events']} for r in results],ensure_ascii=False),flush=True);raise SystemExit(int(any('failure'in r for r in results)))
