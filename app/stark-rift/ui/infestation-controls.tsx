import type {RenderSnapshot} from "../worker/render-snapshot";
import {INFESTED_CENTER,INFESTED_TERRAN} from "../abilities/infestation-state";
export function InfestationControls({snapshot,selected,running,begin,suicide,select}:{snapshot:RenderSnapshot;selected:number[];running:boolean;begin?:(id:number)=>void;suicide?:(ids:number[])=>void;select?:(ids:number[])=>void}){
 const own=snapshot.entities.filter(e=>e.owner===snapshot.viewerPlayerId),queen=own.find(e=>e.definitionId==="zerg-queen"&&selected.includes(e.id)&&!e.stasisTicks),centers=own.filter(e=>e.definitionId===INFESTED_CENTER),infested=own.filter(e=>e.definitionId===INFESTED_TERRAN),actors=infested.filter(e=>selected.includes(e.id)&&!e.burrowed&&!e.stasisTicks),practice=snapshot.combat?.scenario==="infestation-practice";
 if(!queen&&!centers.length&&!infested.length&&!practice)return null;
 return <div className="sr-infestation-controls">
 {practice&&<div className="sr-action-row"><button data-infestation-queen-select onClick={()=>select?.(own.filter(e=>e.definitionId==="zerg-queen").map(e=>e.id).slice(0,1))}>감염 퀸 선택</button><button data-infested-center-select disabled={!centers.length} onClick={()=>select?.(centers.map(e=>e.id).slice(0,1))}>감염된 센터 선택</button><button data-infested-terran-select disabled={!infested.length} onClick={()=>select?.(infested.map(e=>e.id).slice(0,10))}>감염된 테란 선택</button></div>}
 {queen&&<><button data-cast-ability="infestation" disabled={!running} onClick={()=>begin?.(queen.id)}>커맨드 센터 감염 · 에너지0</button><p className="sr-help">연구 없이 사용하는 퀸 기본 능력입니다. 완성된 적 커맨드 센터의 체력이 절반 미만이어야 합니다. 건물 몸체에서1타일 이내로 접근한 뒤 버튼 → 건물 터치. 즉시 아군 감염된 커맨드 센터로 바뀌고 체력이1500으로 회복됩니다. 사거리 밖은 이동 후 다시 지정하세요.</p></>}
 {centers.some(e=>selected.includes(e.id))&&<p className="sr-help" data-infested-center-status>감염된 커맨드 센터 · 감염된 테란 생산100미네랄·50가스·12.5초 · 본부·자원 반납·보급 기능은 없습니다.</p>}
 {actors.length>0&&<><button data-cast-ability="suicide" disabled={!running} onClick={()=>suicide?.(actors.map(e=>e.id))}>선택한 감염된 테란 자폭</button><p className="sr-help">가까운 지상 적을 공격하면 자동으로 자폭합니다. 수동 자폭은 현재 위치에서 즉시 폭발합니다. 기본 피해500·폭발형·최대60px 범위·거리별 절반/4분의1 피해이며 아군도 다칩니다. 공중·탑승·스테이시스는 제외합니다. 버로우 중에는 자폭할 수 없습니다.</p></>}
 {practice&&<p className="sr-help">감염 연습: 퀸(1번 부대)·체력600의 추가 적 커맨드 센터·추가 미네랄500/가스200. 오른쪽 건물에 한 타일 더 접근해 감염하고, 감염된 센터에서 생산 비용을 직접 지불하세요. 적 본진은 별도로 남아 연습을 계속할 수 있습니다. 기록도 별도로 저장됩니다.</p>}
 </div>;
}
