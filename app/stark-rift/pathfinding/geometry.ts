type Point={x:number;y:number};
/** Strict overlap: tangency is allowed, and all products remain exact integers. */
export function segmentNearCircle(a:Point,b:Point,center:Point,radius:number):boolean{
  const dx=b.x-a.x,dy=b.y-a.y,px=center.x-a.x,py=center.y-a.y,length=dx*dx+dy*dy,dot=px*dx+py*dy;
  if(!length||dot<=0)return px*px+py*py<radius*radius;
  if(dot>=length)return (center.x-b.x)**2+(center.y-b.y)**2<radius*radius;
  const cross=BigInt(px)*BigInt(dy)-BigInt(py)*BigInt(dx);
  return cross*cross<BigInt(radius)*BigInt(radius)*BigInt(length);
}
export function segmentNearTile(a:Point,b:Point,left:number,top:number,radius:number):boolean{
  const right=left+256,bottom=top+256;
  const corners=[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
  const inside=(p:Point)=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom;
  const cross=(p:Point,q:Point,r:Point)=>BigInt(q.x-p.x)*BigInt(r.y-p.y)-BigInt(q.y-p.y)*BigInt(r.x-p.x);
  const intersects=(c:Point,d:Point)=>{
    if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))return false;
    const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
    return ((abC<=BigInt(0)&&abD>=BigInt(0))||(abC>=BigInt(0)&&abD<=BigInt(0)))&&((cdA<=BigInt(0)&&cdB>=BigInt(0))||(cdA>=BigInt(0)&&cdB<=BigInt(0)));
  };
  if(inside(a)||inside(b)||corners.some((c,i)=>intersects(c,corners[(i+1)%4])))return true;
  if(corners.some(c=>segmentNearCircle(a,b,c,radius)))return true;
  return [a,b].some(p=>(p.x-Math.max(left,Math.min(right,p.x)))**2+(p.y-Math.max(top,Math.min(bottom,p.y)))**2<radius*radius);
}
