import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {PortraitOnly} from '../../app/stark-rift/ui/portrait-only';
import {isPortraitViewport} from '../../app/stark-rift/input/portrait-mode';
import {InteractiveBattle} from '../../app/stark-rift/ui/interactive-battle';
import {CheckpointStore} from '../../app/stark-rift/ui/checkpoints';
import {SimulationClient} from '../../app/stark-rift/worker/client';
import type {WorkerToMainMessage} from '../../app/stark-rift/worker/messages';
import type {RenderSnapshot} from '../../app/stark-rift/worker/render-snapshot';
import type {GameCommand} from '../../app/stark-rift/core/commands';
import {distribution,type TimingWindow} from '../../app/stark-rift/diagnostics/profiler';
import {STARK_RIFT_ENGINE_VERSION} from '../../app/stark-rift/core/versions';
import {SCENARIOS,createScenario,queueScenarioMovement,scenarioEnvelope,type ScenarioId} from './scenarios';
import './lab.css';
type UiState=Extract<WorkerToMainMessage,{kind:'uiState'}>['payload'];
type Metrics=ReturnType<TimingWindow['read']>;
const CHECKS=['개별·그룹 선택과 일꾼 작업반','슬롯 가로 선택·위쪽 공격이동·두 번 터치','빈 땅 이동·카메라 드래그·두 손가락 확대','세 가지 대열·정지·사수·순찰','50기 통로 전원 도착·겹침 없음','저장·복원 후 선택과 명령 유지','백그라운드 복귀·이어서 진행','10분 이동 중 메모리·프레임 관찰'];
function download(value:unknown){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`stark-rift-lab-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Lab({id,header}:{id:ScenarioId;header:ReactNode}){
  const fixture=useMemo(()=>createScenario(id),[id]),session=useRef(structuredClone(fixture.session));
  const client=useRef<SimulationClient|null>(null),checkpoint=useRef(new CheckpointStore()),sequence=useRef(0);
  const [snapshot,setSnapshot]=useState<RenderSnapshot|null>(null),[ui,setUi]=useState<UiState|null>(null),[phase,setPhase]=useState('setup');
  const [metrics,setMetrics]=useState<Metrics|null>(null),[frames,setFrames]=useState(()=>distribution([])),[heap,setHeap]=useState<number|null>(null);
  const [notice,setNotice]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState(false),[generation,setGeneration]=useState(0);
  const [checks,setChecks]=useState<Record<string,string>>({}),[notes,setNotes]=useState('');
  const latestMetrics=useRef<Metrics|null>(null),history=useRef<unknown[]>([]),peaks=useRef({tickMs:0,frameGapMs:0});
  const currentPhase=useRef(phase);currentPhase.current=phase;
  const events=useRef<{time:string;kind:string;tick?:number}[]>([]),hiddenGaps=useRef(0);
  const record=(kind:string,tick?:number)=>{events.current.push({time:new Date().toISOString(),kind,tick});if(events.current.length>200)events.current.shift();};
  useEffect(()=>{
    let active=true,loaded=false;
    const worker=new Worker(new URL('./lab.worker.ts',import.meta.url),{type:'module'}),channel=new MessageChannel();
    channel.port1.onmessage=event=>{if(active){const value=event.data as Metrics;latestMetrics.current=value;peaks.current.tickMs=Math.max(peaks.current.tickMs,value.ticks.max);setMetrics(value);}};
    worker.postMessage({kind:'connectLabMetrics',port:channel.port2},[channel.port2]);
    // Enemy orders are fixture-only AI commands. Production Worker has no lab initializer.
    queueScenarioMovement(fixture,false);
    const instance=new SimulationClient(worker,message=>{
      if(!active)return;
      if(message.kind==='ready')instance.send('loadSnapshot',{snapshot:scenarioEnvelope(fixture)});
      if(message.kind==='snapshotLoaded'){loaded=true;setGeneration(value=>value+1);record('loaded',message.payload.tick);}
      if(message.kind==='renderSnapshot'&&loaded)setSnapshot(message.payload);
      if(message.kind==='uiState'&&loaded){setUi(message.payload);sequence.current=Math.max(sequence.current,message.payload.lastAcceptedSequence);}
      if(message.kind==='phaseChanged')setPhase(message.payload.phase);
      if(message.kind==='commandAck'){record(message.payload.accepted?'commandAccepted':'commandRejected');setNotice(message.payload.accepted?null:'명령을 실행하지 못했습니다. 선택과 목적지를 확인해 주세요.');}
      if(message.kind==='saveSnapshotReady'){
        setSaved(checkpoint.current.save(message.payload.snapshot));record('saved',message.payload.snapshot.simulation.tick);
      }
      if(message.kind==='fatalError'){setError(`실행 중 오류: ${message.payload.code}`);record(message.payload.code);}
    });client.current=instance;
    instance.send('init',{seed:42,mapId:fixture.map.id,dataVersion:fixture.dataVersion,players:[{id:0,faction:'terran',controller:'human'},{id:1,faction:'terran',controller:'ai'}]});
    const visibility=()=>{instance.suspendHealthCheck();if(document.hidden){hiddenGaps.current++;instance.send('pause',{reason:'background'});record('background');}};
    document.addEventListener('visibilitychange',visibility);
    const timer=setInterval(()=>{
      if(!document.hidden)instance.checkHealth();
      // React development UserTiming retains component details. Lab measurements use
      // performance.now() and bounded windows, so release this separate debug buffer.
      if(import.meta.env.DEV){performance.clearMeasures();performance.clearMarks();}
    },1000);
    return ()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);channel.port1.close();instance.dispose();client.current=null;};
  },[fixture]);
  useEffect(()=>{
    let frame=0,previous=0,lastUpdate=0,lastHistory=0;const started=performance.now(),intervals:number[]=[];
    const render=(now:number)=>{
      if(document.hidden)previous=0;
      else {
        if(previous){intervals.push(now-previous);if(intervals.length>600)intervals.shift();}previous=now;
        if(now-lastUpdate>=1000){
          lastUpdate=now;const frameSummary=distribution(intervals);setFrames(frameSummary);peaks.current.frameGapMs=Math.max(peaks.current.frameGapMs,frameSummary.max);
          const memory=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory;setHeap(memory?.usedJSHeapSize??null);
          if(now-lastHistory>=5000){lastHistory=now;history.current.push({elapsedMs:now-started,phase:currentPhase.current,frameIntervals:frameSummary,jsHeapBytes:memory?.usedJSHeapSize??null,worker:latestMetrics.current});if(history.current.length>720)history.current.shift();}
        }
      }
      frame=requestAnimationFrame(render);
    };
    const reset=()=>{previous=0;intervals.length=0;};document.addEventListener('visibilitychange',reset);frame=requestAnimationFrame(render);
    return ()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',reset);};
  },[]);
  const send=(command:GameCommand)=>{
    if(!isPortraitViewport())return;
    const normalized={...command,sequence:Math.max(command.sequence,sequence.current+1)};sequence.current=normalized.sequence;
    client.current?.send('commandBatch',{commands:[normalized],lastSeenTick:normalized.issuedTick});
  };
  const autoMove=()=>{
    if(!ui||!snapshot||error||!isPortraitViewport())return;
    client.current?.send('resume',{reason:'lab'});const tick=Math.max(snapshot.tick,ui.tick);
    send({kind:'move',entityIds:fixture.ids,target:{kind:'point',...fixture.goal},sequence:sequence.current+1,issuedTick:tick,executeTick:tick+1,playerId:0,source:'player'});record('scenarioMove',tick);
  };
  const exportReport=()=>download({format:'stark-rift-lab-v1',recordedAt:new Date().toISOString(),engine:STARK_RIFT_ENGINE_VERSION,source:__LAB_SOURCE__,scenario:id,fixture:'synthetic units; full visibility; no combat/economy',environment:{userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency},worker:metrics,frameIntervals:frames,jsHeapBytes:heap,sessionPeaks:peaks.current,historyEveryFiveSeconds:history.current,backgroundTransitions:hiddenGaps.current,manualChecks:CHECKS.map(label=>({label,result:checks[label]??'pending'})),notes,events:events.current,limits:['rAF intervals are not GPU render durations','JS heap excludes GPU/Worker memory','Manual checks are self-reported, not automated passes']});
  const ms=(value:number|undefined)=>value===undefined?'—':value.toFixed(2);
  return <PortraitOnly onBlocked={()=>client.current?.send('pause',{reason:'orientation'})}><main className="lab">{header}
    <div className="lab-actions">
      <button disabled={!ui||!!error} onClick={autoMove}>시나리오 이동</button>
      <button disabled={!ui||!!error} onClick={()=>client.current?.send(phase==='paused'?'resume':'pause',{reason:'lab'})}>{phase==='paused'?'이어서 진행':'일시정지'}</button>
      <button disabled={!ui||!!error} onClick={()=>client.current?.send('saveSnapshot',{requestId:Date.now(),session:session.current})}>저장</button>
      <button disabled={!saved||!!error} onClick={()=>{const value=checkpoint.current.read();if(value){session.current=value.session;client.current?.send('loadSnapshot',{snapshot:value});}}}>복원</button>
      <details className="lab-details"><summary>측정·확인</summary><div className="lab-panel">
        <p>테스트용 개체·전맵 가시성. 전투·경제가 없는 내부 검증 화면입니다.</p>
        <p>상태 {phase} · 틱 {snapshot?.tick??0} · 개체 {snapshot?.entities.length??0}</p>
        <table><thead><tr><th>측정 항목</th><th>평균 ms</th><th>p95 ms</th><th>최대 ms</th></tr></thead><tbody>
          <tr><td>전체 틱</td><td>{ms(metrics?.ticks.mean)}</td><td>{ms(metrics?.ticks.p95)}</td><td>{ms(metrics?.ticks.max)}</td></tr>
          <tr><td>상태 복사</td><td>{ms(metrics?.phases.checkpoint?.mean)}</td><td>{ms(metrics?.phases.checkpoint?.p95)}</td><td>{ms(metrics?.phases.checkpoint?.max)}</td></tr>
          <tr><td>최종 검증</td><td>{ms(metrics?.phases.validation?.mean)}</td><td>{ms(metrics?.phases.validation?.p95)}</td><td>{ms(metrics?.phases.validation?.max)}</td></tr>
          <tr><td>경로 탐색</td><td>{ms(metrics?.systems.pathfinding?.mean)}</td><td>{ms(metrics?.systems.pathfinding?.p95)}</td><td>{ms(metrics?.systems.pathfinding?.max)}</td></tr>
          <tr><td>이동</td><td>{ms(metrics?.systems.movement?.mean)}</td><td>{ms(metrics?.systems.movement?.p95)}</td><td>{ms(metrics?.systems.movement?.max)}</td></tr>
          <tr><td>rAF 간격</td><td>{ms(frames.mean)}</td><td>{ms(frames.p95)}</td><td>{ms(frames.max)}</td></tr>
        </tbody></table>
        <p>틱 표본 {metrics?.ticks.count??0} · 탐색 대기 {metrics?.latest?.queue??0} · 확장 {metrics?.latest?.expanded??0} · 재사용 {metrics?.latest?.reused??0}</p>
        <p>메인 JS 힙 {heap===null?'측정 미지원':`${(heap/1048576).toFixed(1)} MB`} · GPU·Worker 메모리는 별도 측정이 필요합니다.</p>
        <p>rAF 간격은 화면 갱신의 지연 지표이며 GPU 렌더 시간은 아닙니다. 숨긴 탭의 간격은 제외합니다.</p>
        {CHECKS.map(label=><label className="lab-check" key={label}>{label}<select value={checks[label]??'pending'} onChange={event=>setChecks({...checks,[label]:event.target.value})}><option value="pending">미확인</option><option value="pass">직접 확인 통과</option><option value="fail">실패</option></select></label>)}
        <label>기기·브라우저·재현 메모<textarea value={notes} onChange={event=>setNotes(event.target.value)}/></label>
        <button onClick={exportReport}>검증 기록 JSON 저장</button>
        <p>처음에는 모든 항목이 미확인입니다. 실제 기기에서 확인한 결과만 기록하세요.</p>
      </div></details>
    </div>
    {error&&<p role="alert" className="lab-error">{error} · 시나리오를 다시 열어 재시작할 수 있습니다.</p>}
    <div className="lab-battle">{snapshot&&ui?<InteractiveBattle key={generation} map={fixture.map} snapshot={snapshot} ui={ui} send={send} initialSession={session.current} onSessionChange={value=>{session.current=value;}} onPause={()=>client.current?.send('pause',{reason:'menu'})} onRenderFailure={()=>{client.current?.send('pause',{reason:'renderer'});setError('전장 화면 연결이 끊겼습니다.');}} notice={notice}/>:<p role="status">검증 전장을 준비하고 있습니다.</p>}</div>
  </main></PortraitOnly>;
}
function App(){
  const [id,setId]=useState<ScenarioId>('controls'),[revision,setRevision]=useState(0);
  return <Lab key={`${id}:${revision}`} id={id} header={<header className="lab-header"><strong>Stark Rift 내부 검증</strong><select aria-label="검증 시나리오" value={id} onChange={event=>setId(event.target.value as ScenarioId)}>{Object.entries(SCENARIOS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button onClick={()=>setRevision(value=>value+1)}>초기화</button></header>}/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
