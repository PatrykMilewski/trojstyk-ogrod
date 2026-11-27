// All dimensions and roof planes are evaluated in the house's local metre coordinates.
const integralTolerance=1e-7;
const integralValue=([a,b,c],[x,y])=>a*x+b*y+c;

function integralGrid(rectangles) {
  const xs=[...new Set(rectangles.flatMap(r=>[r[0],r[2]]))].sort((a,b)=>a-b);
  const ys=[...new Set(rectangles.flatMap(r=>[r[1],r[3]]))].sort((a,b)=>a-b);
  const inside=([x,y])=>rectangles.some(([a,b,c,d])=>x>a && x<c && y>b && y<d);
  const cells=[],edges=[];
  for(let i=1;i<xs.length;i++) for(let j=1;j<ys.length;j++) {
    const l=xs[i-1],r=xs[i],b=ys[j-1],t=ys[j],x=(l+r)/2,y=(b+t)/2;
    if(!inside([x,y]))continue;
    const corners=[[l,b],[r,b],[r,t],[l,t]];
    cells.push(corners);
    const eps=.00001;
    for(const [index,point] of [[0,[x,b-eps]],[1,[r+eps,y]],[2,[x,t+eps]],[3,[l-eps,y]]]) {
      if(!inside(point))edges.push([corners[index],corners[(index+1)%4]]);
    }
  }
  return {cells,edges};
}

function integralClip(ring,line,side) {
  const result=[];
  for(let i=0;i<ring.length;i++) {
    const a=ring[i], b=ring[(i+1)%ring.length];
    const p=side*integralValue(line,a), q=side*integralValue(line,b);
    if(p>=-integralTolerance)result.push(a);
    if((p>integralTolerance && q < -integralTolerance)||(p < -integralTolerance && q>integralTolerance)) {
      const f=p/(p-q);
      result.push([a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]);
    }
  }
  return result;
}

function integralPartition(cells,lines) {
  let result=cells;
  for(const line of lines) result=result.flatMap(ring=>{
    const values=ring.map(p=>integralValue(line,p));
    if(Math.min(...values)>=-integralTolerance||Math.max(...values)<=integralTolerance)return [ring];
    return [integralClip(ring,line,1),integralClip(ring,line,-1)];
  });
  return result;
}

function integralEdgeSections(a,b,lines) {
  const cuts=[0,1];
  for(const line of lines) {
    const p=integralValue(line,a),q=integralValue(line,b);
    if(p*q<0)cuts.push(p/(p-q));
  }
  cuts.sort((x,y)=>x-y);
  return cuts.filter((t,i)=>!i||t-cuts[i-1]>integralTolerance).map(t=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
}

function integralRoofPlanes(spec,garage,hip) {
  const {width:w,depth:d,eaveHeightM:e}=spec, [x,y]=garage.localCenter;
  const side=Math.sign(x), pitch=Math.tan(spec.roofPitchDeg*Math.PI/180);
  const ridge=e+d/2*pitch, end=Math.abs(x)+garage.width/2;
  const planes=[[0,pitch,ridge],[0,-pitch,ridge],[-side*pitch,0,e+end*pitch],
    [-side*pitch,0,e+.35+w/2*pitch],[0,-pitch,e+.35+(y+garage.depth/2)*pitch]];
  if(hip) planes.push([side*pitch,0,e+w/2*pitch]);
  // The concave return generates a valley between the tall dwelling and the shorter garage.
  const height=p=>{
    const h=planes.map(plane=>integralValue(plane,p));
    return Math.min(h[0],h[1],h[2],Math.max(h[3],h[4]),hip?h[5]:Infinity);
  };
  const lines=[];
  for(let i=1;i<planes.length;i++) for(let j=0;j<i;j++) {
    const line=planes[i].map((v,k)=>v-planes[j][k]);
    if(Math.abs(line[0])+Math.abs(line[1])>integralTolerance)lines.push(line);
  }
  return {lines,height};
}

function integralBodyRects(spec,wing) {
  const x=spec.width/2, y=spec.depth/2, recess=spec.recess;
  if(!recess)return [[-x,-y,x,y],wing];
  const half=recess.width/2, front=recess.side==='front'?recess.depth:0, back=recess.side==='back'?recess.depth:0;
  return [[-x,-y,-half,y],[-half,-y+front,half,y-back],[half,-y,x,y],wing];
}

function integralCladding(g,ring,height,spec) {
  const center=ring.reduce((p,q)=>[p[0]+q[0]/ring.length,p[1]+q[1]/ring.length],[0,0]);
  const dzX=height([center[0]+.0001,center[1]])-height(center);
  const dzY=height([center[0],center[1]+.0001])-height(center);
  const tile=spec.roof==='#945945'||spec.roof==='#6f6b63',across=Math.abs(dzX)>Math.abs(dzY);
  const axis=(tile?across:!across)?0:1,step=tile?.35:.58,half=tile?.010:.012;
  const values=ring.map(p=>p[axis]),min=Math.min(...values),max=Math.max(...values);
  const tone=spec.roof==='#945945'?'#865341':spec.roof==='#6f6b63'?'#64625a':'#656960';
  for(let t=Math.ceil(min/step)*step;t<max;t+=step) {
    const normal=axis===0?[1,0]:[0,1];
    const stripe=integralClip(integralClip(ring,[...normal,-t+half],1),[...normal,-t-half],-1);
    if(stripe.length<3)continue;
    const origin=stripe[0];
    for(let j=1;j<stripe.length-1;j++){
      const a=stripe[j],b=stripe[j+1];
      if(Math.abs((a[0]-origin[0])*(b[1]-origin[1])-(a[1]-origin[1])*(b[0]-origin[0]))>.000001) {
        g.face([origin,a,b].map(p=>[...p,height(p)+.009]),tone);
      }
    }
  }
}

function integralRoofFinish(g,field,grid,spec,flat) {
  const {height,lines}=field;
  const lift=(p,d=0)=>[...p,height(p)+d];
  const cells=integralPartition(grid.cells,lines), seen=new Set();
  for(const ring of cells) {
    g.face(ring.map(p=>lift(p)),spec.roof);
    if(flat)continue;
    integralCladding(g,ring,height,spec);
    for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(len<.025)continue;
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],nx=-dy*.003/len,ny=dx*.003/len;
      const fold=height([mid[0]+nx,mid[1]+ny])+height([mid[0]-nx,mid[1]-ny])-2*height(mid);
      if(Math.abs(fold)<.00018)continue;
      const key=[a,b].map(p=>p.map(v=>v.toFixed(4)).join(',')).sort().join('/');
      if(!seen.has(key)){g.beam(lift(a,.018),lift(b,.018),.095,.065,spec.trim);seen.add(key);}
    }
  }
  for(const [a,b] of grid.edges) {
    const sections=integralEdgeSections(a,b,lines);
    for(let j=1;j<sections.length;j++) {
      if(Math.hypot(sections[j][0]-sections[j-1][0],sections[j][1]-sections[j-1][1])<.006)continue;
      g.beam(lift(sections[j-1],flat?-.07:-.01),lift(sections[j],flat?-.07:-.01),.085,flat?.18:.11,spec.trim);
    }
  }
}

function integralFacade(g,field,edges,garage,color,maxZ) {
  const {height,lines}=field, [dx,dy]=garage.doorLocal, half=garage.doorWidth/2;
  const doorLines=[[1,0,-dx-half],[1,0,-dx+half]];
  for(const [a,b] of edges) {
    const front=Math.abs(a[1]-dy)<.001 && Math.abs(b[1]-dy)<.001;
    const sections=integralEdgeSections(a,b,front?[...lines,...doorLines]:lines);
    for(let j=1;j<sections.length;j++) {
      const p=sections[j-1],q=sections[j], mid=(p[0]+q[0])/2;
      const base=front && Math.abs(mid-dx)<half ? 2.30:0;
      const zp=Math.min(maxZ,height(p)),zq=Math.min(maxZ,height(q));
      if(Math.min(zp,zq)<=base)continue;
      g.face([[...p,base],[...q,base],[...q,zq],[...p,zp]],color);
    }
  }
}

export function createFutureIntegralShell(spec,garage,type) {
  const flat=type==='villa',side=Math.sign(garage.localCenter[0]),x=spec.width/2,y=spec.depth/2;
  const [cx,cy]=garage.localCenter, outer=cx+side*garage.width/2,seam=side*x;
  const gFront=cy-garage.depth/2,gBack=cy+garage.depth/2;
  // The recorded 1 cm wall overlap is an assembly tolerance. Both shells meet at one shared plane.
  const wing=[Math.min(seam,outer),gFront,Math.max(seam,outer),gBack];
  const field=flat?{height:()=>3.405,lines:[]}:integralRoofPlanes(spec,garage,type==='bungalow');
  const body=integralGrid(integralBodyRects(spec,wing)),over=.16;
  const roof=integralGrid([[-x-over,-y-over,x+over,y+over],
    [wing[0]-over,gFront-over,wing[2]+over,gBack+over]]);
  return {
    height:(x,y)=>field.height([x,y]),
    excludesWindow:(facade,u,w)=>facade===(side>0?'right':'left')&&u+w/2>gFront&&u-w/2<gBack,
    walls:g=>integralFacade(g,field,body.edges,garage,spec.wall,flat?3.405:Infinity),
    roof:g=>integralRoofFinish(g,field,roof,spec,flat),
    flat
  };
}
