export function addFlorydaInterior(options) {
 const c=florydaInteriorContext(options);
 florydaInteriorStructure(c);
 florydaInteriorStaircase(c);
 florydaInteriorFurniture(c);
 florydaInteriorLights(c);
 return {group:c.group,navigation:c.navigation,rooms:c.data.rooms,metadata:c.data.metadata,localToWorld:c.world};
}

function florydaInteriorInside(p,ring) {
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
  const a=ring[i],b=ring[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}

function florydaInteriorContext({THREE,scene,house,data}) {
 const group=new THREE.Group();group.name='floryda-190-interior';
 const {matrix:M,translation:t}=house.placement,{rotation:R,translation:s}=data.registration;
 const A=R.map(row=>[row[0]*M[0][0]+row[1]*M[1][0],row[0]*M[0][1]+row[1]*M[1][1]]);
 const T=R.map((row,i)=>row[0]*t[0]+row[1]*t[1]+s[i]);
 const world=p=>[A[0][0]*p[0]+A[0][1]*p[1]+T[0],A[1][0]*p[0]+A[1][1]*p[1]+T[1],p[2]||0];
 group.matrixAutoUpdate=false;
 group.matrix.set(A[0][0],A[0][1],0,T[0],A[1][0],A[1][1],0,T[1],0,0,1,0,0,0,0,1);scene.add(group);
 const inverse=group.matrix.clone().invert();
 const navigation={obstacles:[],floors:[],ramps:[],entry:world([...data.entry.position,0]),entryDirection:[A[0][0]*data.entry.direction[0]+A[0][1]*data.entry.direction[1],A[1][0]*data.entry.direction[0]+A[1][1]*data.entry.direction[1]],ceilingHeight:p=>{
  const q=new THREE.Vector3(p[0],p[1],0).applyMatrix4(inverse);
  return florydaInteriorInside([q.x,q.y],data.exterior.upper)?data.metadata.levels.upperCeiling:Infinity;
 }};
 const material=(color,more={})=>new THREE.MeshStandardMaterial({color,roughness:.78,side:THREE.DoubleSide,...more});
 const mats={wall:material('#e9e4d9'),stone:material('#b4b0a6'),oak:material('#b9956c'),tile:material('#c2bdb1'),wood:material('#8c6b4c'),linen:material('#e0d7c5'),sofa:material('#b0b4a4'),white:material('#f3eee5'),dark:material('#303937'),metal:material('#454c48',{metalness:.5,roughness:.3}),glass:material('#b5d5d4',{transparent:true,opacity:.16,depthWrite:false,roughness:.12}),water:material('#8caeaf',{transparent:true,opacity:.4}),lamp:material('#fff1d4',{emissive:'#ffdf9d',emissiveIntensity:.5})};
 const mesh=(id,geometry,mat)=>{const m=new THREE.Mesh(geometry,mat);m.name=id;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const ring=b=>[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]];
 const box=(id,b,z,h,mat=mats.wood)=>{const m=mesh(id,new THREE.BoxGeometry(b[2]-b[0],b[3]-b[1],h),mat);m.position.set((b[0]+b[2])/2,(b[1]+b[3])/2,z+h/2);return m;};
 const obstacle=(id,polygon,minZ,maxZ,kind)=>navigation.obstacles.push({id,ring:polygon.map(p=>world(p).slice(0,2)),minZ,maxZ,...(kind?{kind}:{})});
 const floor=(id,polygon,z)=>navigation.floors.push({id,ring:polygon.map(p=>world(p).slice(0,2)),z});
 const slab=(id,polygon,z,depth,mat)=>{const shape=new THREE.Shape(polygon.map(p=>new THREE.Vector2(...p))),m=mesh(id,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat);m.position.z=z;return m;};
 const beam=(id,a,b,r=.022,mat=mats.dark)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=mesh(id,new THREE.CylinderGeometry(r,r,d.length(),8),mat);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;};
 return {THREE,scene,house,data,group,world,navigation,mats,mesh,box,ring,obstacle,floor,slab,beam};
}

function florydaInteriorWall(c,w) {
 const {data,box,obstacle,mats,mesh,THREE}=c;
 const dx=w.b[0]-w.a[0],dy=w.b[1]-w.a[1],L=Math.hypot(dx,dy),u=[dx/L,dy/L];
 const n=[-u[1],u[0]],a=w.external?[w.a[0]+n[0]*w.inset,w.a[1]+n[1]*w.inset]:w.a;
 const z=w.level?data.metadata.levels.upper:0,top=z+w.height;
 const point=(t,zValue)=>[a[0]+u[0]*t,a[1]+u[1]*t,zValue];
 const segment=(id,start,end,bottom,upper)=>{
  if(upper-bottom<.001||end-start<.001)return;
  const middle=point((start+end)/2,bottom),m=box(id,[-(end-start)/2,-w.thickness/2,(end-start)/2,w.thickness/2],bottom,upper-bottom,w.level&&w.external?mats.stone:mats.wall);
  m.position.x=middle[0];m.position.y=middle[1];m.rotation.z=Math.atan2(u[1],u[0]);
  const p=point(start,0),q=point(end,0),d=w.thickness/2;
  obstacle(id,[[p[0]+n[0]*d,p[1]+n[1]*d],[q[0]+n[0]*d,q[1]+n[1]*d],[q[0]-n[0]*d,q[1]-n[1]*d],[p[0]-n[0]*d,p[1]-n[1]*d]],bottom,upper,'wall');
 };
 const cuts=[...new Set([0,L,...w.openings.flatMap(o=>[o.start,o.end])])].sort((a,b)=>a-b);
 for(let i=1;i<cuts.length;i++) {
  const lo=cuts[i-1],hi=cuts[i],o=w.openings.find(o=>(lo+hi)/2>o.start&&(lo+hi)/2<o.end);
  if(!o)segment(w.id+'-'+i,lo,hi,z,top);
  else {segment(w.id+'-sill-'+i,lo,hi,z,z+o.bottom);segment(w.id+'-lintel-'+i,lo,hi,z+o.top,top);}
 }
 for(const o of w.openings) {
  const frame=.045,depth=.07;
  const framePart=(id,start,end,bottom,upper)=>{
   const center=point((start+end)/2,0),m=box(o.id+'-frame-'+id,[-(end-start)/2,-depth/2,(end-start)/2,depth/2],bottom,upper-bottom,mats.dark);
   m.position.x=center[0];m.position.y=center[1];m.rotation.z=Math.atan2(u[1],u[0]);
  };
  const low=z+o.bottom,high=z+o.top,door=o.kind==='door';
  framePart('left',o.start,o.start+frame,low,high-frame);
  framePart('right',o.end-frame,o.end,low,high-frame);
  framePart('top',o.start,o.end,high-frame,high);
  if(!door)framePart('bottom',o.start+frame,o.end-frame,low,low+frame);
  if(door)continue;
  const end=o.open?(o.start+o.end)/2:o.end-frame,start=o.start+frame,bottom=low+frame,top=high-frame;
  const vertices=[point(start,bottom),point(end,bottom),point(end,top),point(start,top)];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  mesh(o.id+'-glass',g,mats.glass).castShadow=false;
  const p=point(o.start,0),q=point(end,0),d=.025;
  obstacle(o.id+'-pane',[[p[0]+n[0]*d,p[1]+n[1]*d],[q[0]+n[0]*d,q[1]+n[1]*d],[q[0]-n[0]*d,q[1]-n[1]*d],[p[0]-n[0]*d,p[1]-n[1]*d]],low,high,'glass');
 }
}

function florydaInteriorStructure(c) {
 const {data,slab,mats,box}=c;
 florydaInteriorFloor(c,0);
 florydaInteriorFloor(c,1);
 florydaInteriorPlinth(c);
 florydaInteriorTower(c);
 const upper=data.exterior.upper;
 slab('floryda-upper-ceiling',upper,data.metadata.levels.upperCeiling,.14,mats.wall);
 for(const w of data.walls)florydaInteriorWall(c,w);
 for(const [level,key] of [[0,'ground'],[1,'upper']]) {
  const polygon=data.exterior[key],area=polygon.reduce((sum,a,i)=>{const b=polygon[(i+1)%polygon.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
  for(let i=0;i<polygon.length;i++)florydaInteriorWall(c,{id:'floryda-facade-'+level+'-'+i,a:polygon[i],b:polygon[(i+1)%polygon.length],level,height:level?2.7:3,thickness:.32,external:true,inset:area>0?.16:-.16,openings:data.openings.filter(o=>o.level===level&&o.segment===i)});
 }
 for(const i of data.replacementCornice.segments) {
  const p=data.exterior.upper,a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
  const cornice=data.replacementCornice,d=cornice.width/2;
  const m=box('floryda-replacement-cornice-'+i,[-L/2,-d,L/2,d],cornice.bottom,cornice.height,mats.white);
  m.position.x=(a[0]+b[0])/2-dy/L*d;m.position.y=(a[1]+b[1])/2+dx/L*d;m.rotation.z=Math.atan2(dy,dx);
 }
}

function florydaInteriorFloor(c,level) {
 const {THREE,data,mesh,mats,floor,ring,obstacle}=c,polygon=data.exterior[level?'upper':'ground'];
 const z=level?data.metadata.levels.upper:0,tiles=data.rooms.filter(r=>r.level===level&&r.finish==='tile');
 const shape=holes=>{
  const outline=new THREE.Shape(polygon.map(p=>new THREE.Vector2(...p)));
  for(const hole of holes)outline.holes.push(new THREE.Path(hole.map(p=>new THREE.Vector2(...p))));
  return outline;
 };
 const stairHoles=level?[data.stairs.opening]:[];
 const depth=level?z-3:.12,geometry=new THREE.ExtrudeGeometry(shape(stairHoles),{depth,bevelEnabled:false}),positions=geometry.attributes.position,vertices=[];
 for(let i=0;i<positions.count;i+=3) {
  if([0,1,2].every(j=>Math.abs(positions.getZ(i+j)-depth)<.000001))continue;
  for(let j=0;j<3;j++)vertices.push(positions.getX(i+j),positions.getY(i+j),positions.getZ(i+j));
 }
 const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));shell.computeVertexNormals();
 const base=mesh('floryda-'+(level?'upper':'ground')+'-floor',shell,mats.wall);
 base.position.z=level?3:-.12;
 const oak=mesh('floryda-'+(level?'upper':'ground')+'-finish',new THREE.ShapeGeometry(shape([...stairHoles,...tiles.map(r=>r.finishPolygon??ring(r.box))])),mats.oak);oak.position.z=z;
 for(const room of tiles) {
  const finish=mesh('floryda-tile-'+room.id,new THREE.ShapeGeometry(new THREE.Shape((room.finishPolygon??ring(room.box)).map(p=>new THREE.Vector2(...p)))),mats.tile);finish.position.z=z;
 }
 if(!level){floor('floryda-ground',polygon,z);return;}
 const opening=data.stairs.opening,xs=[...new Set([...polygon.map(p=>p[0]),...opening.map(p=>p[0])])].sort((a,b)=>a-b),ys=[...new Set([...polygon.map(p=>p[1]),...opening.map(p=>p[1])])].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++) {
  const b=[xs[i-1],ys[j-1],xs[i],ys[j]],p=[(b[0]+b[2])/2,(b[1]+b[3])/2];
  if(!florydaInteriorInside(p,polygon)||florydaInteriorInside(p,opening))continue;
  floor('floryda-upper-'+i+'-'+j,ring(b),z);obstacle('floryda-slab-'+i+'-'+j,ring(b),3,z,'slab');
 }
}

function florydaInteriorTower({data,box,mats}) {
 const t=data.towerAboveCeiling,[x0,y0,x1,y1]=t.bounds,d=t.thickness;
 const strips=[[x0,y0,x1,y0+d],[x0,y1-d,x1,y1],[x0,y0+d,x0+d,y1-d],[x1-d,y0+d,x1,y1-d]];
 for(const [i,b] of strips.entries())box('floryda-tower-above-ceiling-'+i,b,t.bottom,t.top-t.bottom,mats.stone);
}

function florydaInteriorPlinth({data,box,mats}) {
 const polygon=data.exterior.ground,area=polygon.reduce((sum,a,i)=>{const b=polygon[(i+1)%polygon.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
 const skirt=data.plinth,d=skirt.width/2,sign=area>0?1:-1;
 for(let i=0;i<polygon.length;i++) {
  const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
  const m=box('floryda-plinth-'+i,[-L/2,-d,L/2,d],skirt.bottom,skirt.height,mats.stone);
  m.position.x=(a[0]+b[0])/2-dy/L*d*sign;m.position.y=(a[1]+b[1])/2+dx/L*d*sign;m.rotation.z=Math.atan2(dy,dx);
 }
}

function florydaInteriorStaircase(c) {
 const {data,box,mats,ring,floor,navigation,world,obstacle}=c,s=data.stairs;
 const [x0,y0,x1,y1]=s.box,end=s.landingStart,landing=s.landingHeight;
 florydaInteriorFlight(c,'lower',x0,end,y0,s.width,0,landing,s.lowerRises);
 florydaInteriorFlight(c,'upper',end,s.upperStart,y1-s.width,s.width,landing,s.floorHeight,s.upperRises);
 box('floryda-stair-landing',[end,y0,x1,y1],landing-.20,.20,mats.oak);floor('floryda-stair-landing',ring([end,y0,x1,y1]),landing);
 navigation.ramps.push({id:'floryda-stair-lower',start:world([x0,y0+s.width/2]).slice(0,2),end:world([end,y0+s.width/2]).slice(0,2),width:s.width,z0:0,z1:landing},{id:'floryda-stair-upper',start:world([end,y1-s.width/2]).slice(0,2),end:world([s.upperStart,y1-s.width/2]).slice(0,2),width:s.width,z0:landing,z1:s.floorHeight});
 florydaInteriorStairRails(c);
 obstacle('floryda-stair-divider',ring([x0,y0+s.width,end,y1-s.width]),0,s.floorHeight,'rail');
 obstacle('floryda-landing-rail',ring([x1-.025,y0,x1+.025,y1]),landing,landing+1.05,'rail');
}

function florydaInteriorFlight(c,id,start,end,y,width,bottom,top,rises) {
 const {THREE,mesh,mats}=c,step=(top-bottom)/rises,tread=(end-start)/(rises-1),points=[[start,bottom+step]];
 for(let i=1;i<rises;i++){points.push([start+i*tread,bottom+i*step]);if(i<rises-1)points.push([start+i*tread,bottom+(i+1)*step]);}
 points.push([end,top-step-.16],[start,bottom-.16]);
 const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p))),geometry=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false});geometry.rotateX(Math.PI/2);
 const flight=mesh('floryda-stair-'+id+'-flight',geometry,mats.oak);flight.position.y=y+width;flight.userData.stair={rises,treads:rises-1,bottom,top};
}

function florydaInteriorStairRails(c) {
 const {data,beam,obstacle,ring}=c,s=data.stairs,[x0,y0,x1,y1]=s.box,end=s.landingStart,landing=s.landingHeight;
 const posts=new Set();
 const rail=(id,a,b,baseAt)=>{
  const topA=[a[0],a[1],a[2]+1],topB=[b[0],b[1],b[2]+1];
  const handrail=beam('floryda-handrail-'+id,topA,topB,.028);handrail.userData.rail={a:topA,b:topB};
  const count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.12);
  for(let i=0;i<=count;i++) {
   const t=i/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,bottom=baseAt(t,x,y),top=a[2]+(b[2]-a[2])*t+1;
   const key=[x,y,bottom,top].map(v=>v.toFixed(6)).join(',');if(posts.has(key))continue;posts.add(key);
   const post=beam('floryda-rail-'+id+'-post-'+i,[x,y,bottom],[x,y,top],i%4===0||i===count?.025:.012);
   post.userData.railAnchor={position:[x,y,bottom],top:[x,y,top],support:id};
  }
 };
 const lowerAt=(t,x)=>t===1?landing:(Math.floor((x-x0)/s.tread)+1)*landing/s.lowerRises;
 const upperAt=(t,x)=>x<s.upperStart+.00001?s.floorHeight:t===1?landing:landing+(Math.floor((end-x)/s.tread)+1)*(s.floorHeight-landing)/s.upperRises;
 for(const [id,y] of [['lower-outer',y0+.045],['lower-inner',y0+s.width-.045]])rail(id,[x0+.035,y,0],[end,y,landing],lowerAt);
 for(const [id,y] of [['upper-outer',y1-.045],['upper-inner',y1-s.width+.045]])rail(id,[s.upperStart-.035,y,s.floorHeight],[end,y,landing],upperAt);
 const lo=y0+.045,hi=y1-.045,far=x1-.045;
 rail('landing-low',[end,lo,landing],[far,lo,landing],()=>landing);
 rail('landing-end',[far,lo,landing],[far,hi,landing],()=>landing);
 rail('landing-high',[far,hi,landing],[end,hi,landing],()=>landing);
 rail('turn',[end,y0+s.width-.045,landing],[end,y1-s.width+.045,landing],()=>landing);
 rail('upper-floor-edge',[x0-.035,y0,s.floorHeight],[x0-.035,y1-s.width+.045,s.floorHeight],()=>s.floorHeight);
 rail('upper-floor-return',[x0-.035,y1-s.width+.045,s.floorHeight],[s.upperStart-.035,y1-s.width+.045,s.floorHeight],()=>s.floorHeight);
 obstacle('floryda-upper-floor-guard',ring([x0-.06,y0,x0-.01,y1-s.width]),s.floorHeight,s.floorHeight+1.03,'rail');
 obstacle('floryda-upper-floor-return',ring([x0,y1-s.width+.01,s.upperStart,y1-s.width+.06]),s.floorHeight,s.floorHeight+1.03,'rail');
}

function florydaInteriorFurniture(c) {
 const {data,box,mats,obstacle,ring}=c;
 for(const f of data.furniture) {
  const diagonal=f.kind==='chair'&&Math.abs(f.angle)%90!==0,center=[(f.bounds[0]+f.bounds[2])/2,(f.bounds[1]+f.bounds[3])/2];
  const b=diagonal?f.bounds.map((v,i)=>center[i%2]+(v-center[i%2])/Math.SQRT2):f.bounds,[x0,y0,x1,y1]=b,z=f.level?data.metadata.levels.upper:0,h=f.height,dx=x1-x0,dy=y1-y0;
  const part=(name,r,a,height,mat)=>{
   const m=box('floryda-'+f.id+'-'+name,r,z+a,height,mat);
   if(diagonal){const angle=f.angle*Math.PI/180,dx=m.position.x-center[0],dy=m.position.y-center[1];m.position.x=center[0]+Math.cos(angle)*dx-Math.sin(angle)*dy;m.position.y=center[1]+Math.sin(angle)*dx+Math.cos(angle)*dy;m.rotation.z=angle;}
   return m;
  };
  const inset=(v=.04)=>[x0+v,y0+v,x1-v,y1-v];
  const edge=(side,depth)=>side==='xMin'?[x0,y0,x0+depth,y1]:side==='xMax'?[x1-depth,y0,x1,y1]:side==='yMax'?[x0,y1-depth,x1,y1]:[x0,y0,x1,y0+depth];
  const legs=height=>{for(const x of [x0+.07,x1-.07])for(const y of [y0+.07,y1-.07])part('leg-'+x+'-'+y,[x-.025,y-.025,x+.025,y+.025],0,height,mats.dark);};
  const item={f,b,x0,y0,x1,y1,z,h,dx,dy,part,inset,edge,legs,mats,c};
  if(['table','desk','island','counter','bench','bed','sofa','chair'].includes(f.kind))florydaInteriorSeating(item);
  else if(['sink','toilet','shower','tub'].includes(f.kind))florydaInteriorSanitary(item);
  else florydaInteriorStorage(item);
  if(f.kind!=='hob'&&f.collision!==false)obstacle('floryda-furniture-'+f.id,ring(f.bounds),z,z+h,'furniture');
 }
}

function florydaInteriorSeating(item) {
 const {f,b,x0,y0,x1,y1,h,dx,dy,part,inset,edge,legs,mats,c}=item;
  if(['table','desk','island','counter','bench'].includes(f.kind)) {
   if(['island','counter','bench'].includes(f.kind))part('base',inset(),0,h-.05,mats.wood);else legs(h-.06);
   const cutouts=c.data.furniture.filter(o=>o.kind==='sink'&&o.level===f.level&&o.collision===false&&o.bounds[0]>x0&&o.bounds[2]<x1&&o.bounds[1]>y0&&o.bounds[3]<y1);
   if(cutouts.length) {
    const shape=new c.THREE.Shape(c.ring(b).map(p=>new c.THREE.Vector2(...p)));
    for(const sink of cutouts)shape.holes.push(new c.THREE.Path(c.ring(sink.bounds).map(p=>new c.THREE.Vector2(...p))));
    const top=c.mesh('floryda-'+f.id+'-top',new c.THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false}),mats.wood);top.position.z=item.z+h-.06;
   } else part('top',b,h-.06,.06,mats.wood);
   if(f.kind==='desk')part('monitor',f.front?.startsWith('x')?[x0+dx*.35,y0+dy*.35,x0+dx*.4,y0+dy*.65]:[x0+dx*.35,y0+dy*.35,x0+dx*.65,y0+dy*.4],h,.35,mats.dark);
  } else if(f.kind==='bed') {
   const rotated=f.angle===90;
   part('frame',rotated?[x0+.07,y0,x1,y1]:[x0,y0+.07,x1,y1],.12,.22,mats.wood);part('mattress',rotated?[x0+.075,y0+.04,x1-.04,y1-.04]:[x0+.04,y0+.075,x1-.04,y1-.04],.34,.22,mats.white);part('duvet',[x0+.04,y0+dy*.3,x1-.04,y1-.04],.56,.08,mats.linen);
   part('headboard',rotated?[x0,y0,x0+.07,y1]:[x0,y0,x1,y0+.07],.12,.85,mats.wood);
   part('pillows',rotated?[x0+.08,y0+.08,x0+dx*.24,y1-.08]:[x0+.08,y0+.08,x1-.08,y0+dy*.24],.57,.1,mats.white);
  } else if(f.kind==='sofa') {
   part('base',b,.08,.34,mats.sofa);part('cushions',inset(.03),.42,.14,mats.linen);
   part('back',edge(f.back,.16),.42,h-.42,mats.sofa);
  } else if(f.kind==='chair') {
   legs(Math.min(.45,h-.15));part('seat',b,Math.min(.45,h-.15),.07,mats.linen);
   part('back',edge(f.back,.07),.52,Math.max(.1,h-.52),mats.wood);
  }
}

function florydaInteriorSanitary(item) {
 const {f,b,x0,y0,x1,y1,h,dx,dy,part,inset,edge,mats}=item;
  if(f.kind==='sink') {
   const bottom=h-.15,count=f.basins??1;
   if(f.collision!==false)part('vanity',b,0,bottom,mats.wood);
   for(let i=0;i<count;i++) {
    const bounds=[...b],axis=dx>dy?0:1;bounds[axis]=b[axis]+(b[axis+2]-b[axis])*i/count;bounds[axis+2]=b[axis]+(b[axis+2]-b[axis])*(i+1)/count;
    const [left,front,right,back]=bounds,d=Math.min(right-left,back-front)*.13;
    part('basin-'+i+'-bottom',[left+d,front+d,right-d,back-d],bottom,.025,mats.white);
    part('basin-'+i+'-left',[left,front,left+d,back],bottom,h-bottom,mats.white);
    part('basin-'+i+'-right',[right-d,front,right,back],bottom,h-bottom,mats.white);
    part('basin-'+i+'-front',[left+d,front,right-d,front+d],bottom,h-bottom,mats.white);
    part('basin-'+i+'-back',[left+d,back-d,right-d,back],bottom,h-bottom,mats.white);
    part('water-'+i,[left+d+.005,front+d+.005,right-d-.005,back-d-.005],bottom+.035,.007,mats.water);
   }
  } else if(f.kind==='toilet') {
   part('pedestal',inset(.03),0,.38,mats.white);part('seat',b,.38,.06,mats.white);
   if(h>.6)part('cistern',edge(f.back,Math.min(dx,dy)*.25),.44,h-.44,mats.white);
  } else if(f.kind==='shower') {
   part('tray',b,0,.04,mats.white);part('screen',[x1-.015,y0,x1,y1],.04,h-.04,mats.glass).castShadow=false;
  } else if(f.kind==='tub') {
   const d=.09;
   part('bottom',inset(d),0,.08,mats.white);
   part('left',[x0,y0,x0+d,y1],0,h,mats.white);part('right',[x1-d,y0,x1,y1],0,h,mats.white);
   part('front',[x0+d,y0,x1-d,y0+d],0,h,mats.white);part('back',[x0+d,y1-d,x1-d,y1],0,h,mats.white);
   part('water',inset(d+.005),h-.09,.01,mats.water);
  }
}

function florydaInteriorStorage(item) {
 const {f,b,x0,y0,x1,y1,h,dx,dy,part,inset,edge,mats}=item;
  if(f.kind==='tv') {
   part('console',b,0,.45,mats.wood);part('screen',inset(.01),.65,h-.65,mats.dark);
  } else if(f.kind==='hob') {
   part('glass',b,h,.025,mats.dark);
   for(const x of [.28,.72])for(const y of [.28,.72])part('burner-'+x+'-'+y,[x0+dx*x-.04,y0+dy*y-.04,x0+dx*x+.04,y0+dy*y+.04],h+.026,.005,mats.metal);
  } else {
   part('body',b,0,h,f.kind==='cabinet'?mats.wood:f.kind==='fireplace'?mats.dark:mats.white);
   if(f.kind==='cabinet') {
    const alongX=f.front.startsWith('y'),length=alongX?dx:dy,count=Math.max(1,Math.round(length/.6));
    for(let i=0;i<count;i++) {
     const t=(i+.5)/count,panel=florydaExteriorPanel(edge(f.front,.025),f.front),position=(alongX?x0:y0)+length*t;
     if(alongX){panel[0]=position-.012;panel[2]=position+.012;}else{panel[1]=position-.012;panel[3]=position+.012;}
     part('handle-'+i,panel,h*.45,.22,mats.dark);
    }
   }
   if(f.kind==='laundry') {
    const panel=florydaExteriorPanel(edge(f.front,.025),f.front);
    if(f.front.startsWith('y')){panel[0]+=dx*.2;panel[2]-=dx*.2;}else{panel[1]+=dy*.2;panel[3]-=dy*.2;}
    part('door',panel,.25,.4,mats.dark);
   }
  }
}

function florydaExteriorPanel(b,front) {
 const axis=front.startsWith('x')?0:1,sign=front.endsWith('Min')?-1:1,offset=sign*.03;
 return b.map((v,i)=>i%2===axis?v+offset:v);
}

function florydaInteriorLights({THREE,group,data,box,mats}) {
 for(const light of data.lights) {
  const p=light.position,lamp=new THREE.PointLight('#fff2dc',10,5,2);lamp.position.set(...p);group.add(lamp);
  box('floryda-light-'+light.id,[p[0]-.1,p[1]-.1,p[0]+.1,p[1]+.1],p[2]+.03,.035,mats.lamp);
 }
 group.userData={kind:'walkable-interior',parcel:'190',rooms:data.rooms.length,furniture:data.furniture.length,source:data.metadata};
}
