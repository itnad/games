import type { Point } from "./navigation";
export type Formation = "line"|"column"|"spread";
export function formationOffsets(count:number,spacing:number,formation:Formation):Point[]{
  const columns=formation==="column"?1:formation==="line"?count:Math.ceil(Math.sqrt(count));
  const rows=Math.ceil(count/columns),step=formation==="spread"?spacing*2:spacing;
  return Array.from({length:count},(_,i)=>({x:Math.round((i%columns-(columns-1)/2)*step),y:Math.round((Math.floor(i/columns)-(rows-1)/2)*step)}));
}
/** Integer square root for movement normalization; no floating-point rule distances. */
export function integerSqrt(value:number):number{
  if(!Number.isSafeInteger(value)||value<0)throw new RangeError("Invalid squared distance.");
  let lo=0,hi=Math.min(value,94906265),result=0;
  while(lo<=hi){const mid=Math.floor((lo+hi)/2);if(mid*mid<=value){result=mid;lo=mid+1;}else hi=mid-1;}return result;
}
