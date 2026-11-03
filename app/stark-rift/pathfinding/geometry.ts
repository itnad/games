type Point={x:number;y:number};
/** Strict overlap: tangency is allowed, and all products remain exact integers. */
export function segmentNearCircle(a:Point,b:Point,center:Point,radius:number):boolean{
  const dx=b.x-a.x,dy=b.y-a.y,px=center.x-a.x,py=center.y-a.y,length=dx*dx+dy*dy,dot=px*dx+py*dy;
  if(!length||dot<=0)return px*px+py*py<radius*radius;
  if(dot>=length)return (center.x-b.x)**2+(center.y-b.y)**2<radius*radius;
  const first=px*dy,second=py*dx,numberCross=first-second,rhs=radius*radius*length;
  if(Number.isSafeInteger(first)&&Number.isSafeInteger(second)&&Number.isSafeInteger(numberCross)&&Number.isSafeInteger(radius*radius)&&Number.isSafeInteger(rhs)){
    const lhs=numberCross*numberCross;
    // An integer square above MAX_SAFE_INTEGER cannot be smaller than a safe RHS.
    return Number.isSafeInteger(lhs)&&lhs<rhs;
  }
  const cross=BigInt(px)*BigInt(dy)-BigInt(py)*BigInt(dx);
  return cross*cross<BigInt(radius)*BigInt(radius)*BigInt(length);
}
export function segmentNearTile(a:Point,b:Point,left:number,top:number,radius:number):boolean{
  const right=left+256,bottom=top+256;
  // Reject rectangles separated from the infinite supporting line before allocating corners.
  // A segment is a subset of that line, so this cannot remove a real capsule collision.
  const dx=b.x-a.x,dy=b.y-a.y,first=(left-a.x)*dy,second=(top-a.y)*dx,base=first-second;
  const values=[base,base+256*dy,base-256*dx,base+256*dy-256*dx];
  const low=Math.min(...values),high=Math.max(...values),lineCross=low>0?low:high<0?-high:0;
  const squared=lineCross*lineCross,limit=radius*radius*(dx*dx+dy*dy);
  if(lineCross>0&&Number.isSafeInteger(first)&&Number.isSafeInteger(second)&&values.every(Number.isSafeInteger)&&Number.isSafeInteger(limit)&&(!Number.isSafeInteger(squared)||squared>=limit))return false;
  const corners=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
  const inside=(p:Point)=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom;
  const cross=(p:Point,q:Point,r:Point)=>{
    const first=(q.x-p.x)*(r.y-p.y),second=(q.y-p.y)*(r.x-p.x),value=first-second;
    if(Number.isSafeInteger(first)&&Number.isSafeInteger(second)&&Number.isSafeInteger(value))return Math.sign(value);
    const exact=BigInt(q.x-p.x)*BigInt(r.y-p.y)-BigInt(q.y-p.y)*BigInt(r.x-p.x);
    return exact<BigInt(0)?-1:exact>BigInt(0)?1:0;
  };
  const intersects=(c:Point,d:Point)=>{
    if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))return false;
    const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
    return abC*abD<=0&&cdA*cdB<=0;
  };
  if(inside(a)||inside(b)||corners.some((c,i)=>intersects(c,corners[(i+1)%4])))return true;
  if(corners.some(c=>segmentNearCircle(a,b,c,radius)))return true;
  return [a,b].some(p=>(p.x-Math.max(left,Math.min(right,p.x)))**2+(p.y-Math.max(top,Math.min(bottom,p.y)))**2<radius*radius);
}
