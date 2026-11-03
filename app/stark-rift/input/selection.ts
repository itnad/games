import type { RenderEntity, RenderSnapshot } from "../worker/render-snapshot";
import type { Point } from "../pathfinding/navigation";
export const GROUP_RADIUS = 4 * 256;
export function hitTest(snapshot:RenderSnapshot,point:Point,tolerance=64):RenderEntity|null{
  return snapshot.entities.filter(entity=>(entity.x-point.x)**2+(entity.y-point.y)**2<=(entity.radius+tolerance)**2)
    .sort((a,b)=>(a.x-point.x)**2+(a.y-point.y)**2-(b.x-point.x)**2-(b.y-point.y)**2||a.id-b.id)[0]??null;
}
export function selectNearby(snapshot:RenderSnapshot,anchorId:number,existing:number[]=[]):number[]{
  const anchor=snapshot.entities.find(e=>e.id===anchorId);if(!anchor||anchor.owner!==snapshot.viewerPlayerId)return [];
  const nearby=snapshot.entities.filter(e=>e.owner===anchor.owner&&e.definitionId===anchor.definitionId&&e.kind===anchor.kind&&(e.x-anchor.x)**2+(e.y-anchor.y)**2<=GROUP_RADIUS**2)
    .sort((a,b)=>(a.x-anchor.x)**2+(a.y-anchor.y)**2-(b.x-anchor.x)**2-(b.y-anchor.y)**2||a.id-b.id).map(e=>e.id);
  const retained=existing.filter(id=>snapshot.entities.some(e=>e.id===id&&e.definitionId===anchor.definitionId&&e.owner===anchor.owner));
  return [...new Set([...retained,...nearby])].slice(0,10);
}
