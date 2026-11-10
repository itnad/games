import type { Graphics } from "pixi.js";

// Geometry stays attached to each marker. Position interpolation must not rebuild GPU buffers.
const appearances=new WeakMap<Graphics,string>();
export function updateUnitMarker(marker:Graphics,color:number,wide:boolean,ring:number|null,radius:number):void {
  const key=`unit:${color}:${wide}:${ring}:${radius}`;
  if(appearances.get(marker)===key)return;
  appearances.set(marker,key);marker.clear();
  if(wide)marker.rect(-.22,-.22,.44,.44).fill(color);
  else marker.circle(0,0,.32).fill(color);
  if(ring!==null)marker.circle(0,0,Math.max(.4,radius/256+.1)).stroke({width:.06,color:ring});
}
export function updateMinimapMarker(marker:Graphics,color:number):void {
  const key=`mini:${color}`;
  if(appearances.get(marker)===key)return;
  appearances.set(marker,key);marker.clear().circle(0,0,.65).fill(color);
}
