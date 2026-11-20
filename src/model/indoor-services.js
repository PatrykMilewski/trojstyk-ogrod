const iconServiceColors = {
 floor:'#e57850', return:'#eba75a', collector:'#e6c282', pump:'#986edf', pumpReturn:'#6358ac',
 cable:'#51556e', cold:'#288bc9', hot:'#de5848', sewer:'#b27b36'
};

function serviceGroup(THREE,parent,name,level) {
 const group=new THREE.Group(); group.name=name;
 if(level)group.userData.level=level;
 parent.add(group); return group;
}

function servicePen(THREE) {
 const materials=new Map();
 return (parent,name,points,color,radius=.025,meta={})=>{
  const path=points.map(p=>new THREE.Vector3(...p)).filter((p,i,a)=>!i||p.distanceToSquared(a[i-1])>1e-10);
  if(path.length<2)return;
  const samples=serviceRoundedPath(THREE,path);
  const geometry=servicePipeGeometry(THREE,samples,radius);
  if(!materials.has(color))materials.set(color,new THREE.MeshBasicMaterial({
   color,transparent:true,opacity:.97,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide
  }));
  const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;
  mesh.userData={...meta,from:path[0].toArray(),to:path.at(-1).toArray()};
  mesh.renderOrder=parent.userData.level==='upper'?234:232;
  mesh.raycast=()=>{};parent.add(mesh);
  return mesh;
 };
}

function serviceRoundedPath(THREE,path) {
 const samples=[path[0]];
 for(let i=1;i<path.length-1;i++){
  const a=path[i-1],b=path[i],c=path[i+1];
  const trim=Math.min(.085,a.distanceTo(b)*.43,b.distanceTo(c)*.43);
  const entry=b.clone().addScaledVector(a.clone().sub(b).normalize(),trim);
  const exit=b.clone().addScaledVector(c.clone().sub(b).normalize(),trim);
  samples.push(entry,...new THREE.QuadraticBezierCurve3(entry,b,exit).getPoints(4).slice(1));
 }
 samples.push(path.at(-1));
 return samples;
}

function servicePipeGeometry(THREE,path,radius) {
 const positions=[],indices=[],sides=8;
 let normal;
 for(let i=0;i<path.length;i++){
  const tangent=path[Math.min(i+1,path.length-1)].clone().sub(path[Math.max(0,i-1)]).normalize();
  if(!normal)normal=Math.abs(tangent.z)>.85?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1);
  let cross=new THREE.Vector3().crossVectors(tangent,normal);
  if(cross.lengthSq()<1e-8)cross.crossVectors(tangent,new THREE.Vector3(0,1,0));
  cross.normalize();normal=new THREE.Vector3().crossVectors(cross,tangent).normalize();
  for(let n=0;n<sides;n++){
   const a=2*Math.PI*n/sides;
   positions.push(...path[i].clone().addScaledVector(normal,radius*Math.cos(a)).addScaledVector(cross,radius*Math.sin(a)).toArray());
   if(i){const p=(i-1)*sides+n,q=(i-1)*sides+(n+1)%sides;indices.push(p,q,p+sides,q,q+sides,p+sides);}
  }
 }
 const geom=new THREE.BufferGeometry();
 geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.setIndex(indices);
 return geom;
}

// Each band spans west to east and carries its own south and north floor edges.
function serviceHeatingBands(data,room) {
 const [w,s,e,n]=room.box,[sx,sy,ex,ey]=data.stairs.box;
 const box=(west,east,south,north)=>[west,east,south,north];
 const innerWest=.36,innerEast=data.exterior.upper[3][0]-.36;
 const wingFront=data.exterior.upper[2][1]+.36,mainEast=data.exterior.upper[1][0]-.36;
 const wingRear=data.exterior.upper[4][1]-.36,voidEdge=data.void.box[1];
 const roomBox=id=>data.rooms.find(r=>r.id===id).box;
 const hall=roomBox('0.5'),kitchenWallEnd=data.walls.find(wall=>wall.id==='kitchen-back').b[0];
 switch(room.id){
  case '0.4':return [box(w,kitchenWallEnd,s,n),box(kitchenWallEnd,e,hall[3],n)];
  case '0.5':return [box(kitchenWallEnd,e,s,n)];
  case '0.6':{
   const [,se,,corner,,nw]=room.outline;
   const partition=data.walls.find(wall=>wall.id==='bath-left');
   const left=partition.a[0]-partition.thickness/2,right=partition.a[0]+partition.thickness/2;
   return [box(nw[0],left,s,n),box(left,right,s,partition.a[1]),box(right,se[0],s,corner[1])];
  }
  case '0.9':return [box(sx,w,sy,ey),box(w,e,s,ey)];
  case '1.1':return [box(innerWest,mainEast,.36,n)];
  case '1.2':case '1.3':return [box(innerWest,e,s,n)];
  case '1.4':return [box(w,e,s,voidEdge),box(e,sx,roomBox('1.8')[1],voidEdge),box(sx,ex,roomBox('1.8')[1],sy)];
  case '1.5':return [box(w,mainEast,roomBox('1.4')[1],n),box(mainEast,e,wingFront,n)];
  case '1.6':return [box(w,e,wingFront,n)];
  case '1.7':return [box(w,innerEast,wingFront,n)];
  case '1.8':return [box(w,innerEast,s,wingRear)];
  default:return [box(w,e,s,n)];
 }
}

function serviceHeatingLegs(bands,pitch) {
 const inset=Math.min(.10,pitch/2),legs=[];
 for(const [left,right,south,north] of bands){
  const count=Math.max(1,Math.ceil((right-left)/pitch));
  const spacing=(right-left)/count;
  for(let i=0;i<count;i++)legs.push({x:left+(i+.5)*spacing,low:south+inset,high:north-inset,left});
 }
 return legs;
}

function serviceHeatingCoil(legs,base) {
 const path=[],z=base-.055;
 for(const [i,leg] of legs.entries()){
  const down=i%2===1,start=down?leg.high:leg.low,end=down?leg.low:leg.high;
  if(i&&path.at(-1)[1]!==start){
   const [x,y]=path.at(-1),longerOnLeft=down?y>start:y<start;
   const seam=(leg.left+(longerOnLeft?x:leg.x))/2;
   path.push([seam,y,z],[seam,start,z]);
  }
  path.push([leg.x,start,z],[leg.x,end,z]);
 }
 return path;
}

function serviceHeatingLeads(coil,port,base,tailXs=[]) {
 const [px,py,index]=port;
 return [coil[0],coil.at(-1)].map(([x,y,z],side)=>{
  const feedZ=base+(side?.38:.55),dropX=px+(side?1:-1)*iconHeatingPortSpacing/4;
  const dropY=py-.075,laneY=py-.22-(2*index+side)*.032,tailX=tailXs[side]??x;
  const fanZ=base-.135,crossZ=base-.172,tailZ=base-.10;
  return [[px,py,feedZ],[dropX,dropY,feedZ],[dropX,dropY,fanZ],[dropX,laneY,fanZ],
   [dropX,laneY,crossZ],[tailX,laneY,crossZ],[tailX,laneY,tailZ],[tailX,y,tailZ],...(tailX===x?[]:[[x,y,tailZ]]),[x,y,z]];
 });
}

const iconHeatingManifolds={
 ground:{x:5.235,y:8.35,capacity:9},
 upper:{x:6.35,y:8.06,capacity:8}
};
const iconHeatingPortSpacing=.051,iconHeatingBankSpacing=.52;

function serviceHeatingPort(level,index) {
 const {x,y,capacity}=iconHeatingManifolds[level],bank=Math.floor(index/capacity);
 return [x+bank*iconHeatingBankSpacing+(index%capacity+.5)*iconHeatingPortSpacing,y,index];
}

// Keep the long room tails in separate lanes and inside the same strip of slab as their loop.
function serviceHeatingTailLanes(data,circuits) {
 const used=[];
 for(const circuit of circuits){
  const bands=serviceHeatingBands(data,data.rooms.find(r=>r.id===circuit.room));
  circuit.tailXs=[circuit.coil[0],circuit.coil.at(-1)].map(([x])=>{
   const [left,right]=bands.find(([w,e])=>x>=w&&x<=e);
   const candidates=[x];
   for(let i=1;i*.032<right-left;i++)candidates.push(x-.032*i,x+.032*i);
   const lane=candidates.find(v=>v>left+.022&&v<right-.022&&used.every(existing=>Math.abs(v-existing)>.026));
   if(lane===undefined)throw new Error('Brak miejsca na dojście pętli '+circuit.room);
   used.push(lane);return lane;
  });
 }
}

function serviceHeatingCircuits(data,level) {
 const circuits=[],base=data.levels[level];
 const length=path=>path.reduce((sum,p,i)=>i?sum+Math.hypot(...p.map((v,k)=>v-path[i-1][k])):sum,0);
 for(const room of data.rooms.filter(r=>r.id[0]===(level==='ground'?'0':'1'))){
  const pitch=room.id==='0.1'?.25:['0.7','1.2','1.6'].includes(room.id)?.12:.18;
  const legs=serviceHeatingLegs(serviceHeatingBands(data,room),pitch);
  const weights=[0];
  for(const leg of legs)weights.push(weights.at(-1)+leg.high-leg.low+pitch);
  for(let count=1;count<=legs.length;count++){
   let start=0;
   const proposed=[];
   for(let i=1;i<=count;i++){
    const target=weights.at(-1)*i/count;
    let end=start+1;
    while(end<legs.length-(count-i)&&Math.abs(weights[end+1]-target)<Math.abs(weights[end]-target))end++;
    const coil=serviceHeatingCoil(legs.slice(start,end),base);
    const port=serviceHeatingPort(level,circuits.length+proposed.length);
    const [supply,back]=serviceHeatingLeads(coil,port,base);
    if(length(coil)+length(supply)+length(back)>89.5)break;
    proposed.push({room:room.id,pitch,coil});start=end;
   }
   if(start===legs.length){circuits.push(...proposed);break;}
  }
 }
 serviceHeatingTailLanes(data,circuits);
 return circuits;
}

function serviceHeatingCircuit(THREE,group,pipe,circuit,index,port,bank) {
 const {room,pitch,coil}=circuit,base=coil[0][2]+.055;
 const [supply,back]=serviceHeatingLeads(coil,port,base,circuit.tailXs),branch='floor-'+room+'-'+index;
 const lengthOf=points=>serviceRoundedPath(THREE,points.map(p=>new THREE.Vector3(...p)))
  .reduce((length,p,i,path)=>length+(i?p.distanceTo(path[i-1]):0),0);
 const activeLength=lengthOf(coil),length=activeLength+lengthOf(supply)+lengthOf(back);
 pipe(group,branch+'-supply',supply,iconServiceColors.floor,.012);
 pipe(group,branch,coil,iconServiceColors.floor,.015,{kind:'heating-loop',room,pitch,bank,activeLength,length});
 pipe(group,branch+'-return',back,iconServiceColors.return,.012);
}

function servicePlanOutline(THREE,group,data,level) {
 const outline=serviceOutlineLines(THREE,group,data.levels[level]);
 for(const {a,b,doors,level:story} of data.walls){
  if(Boolean(story)!==(level==='upper'))continue;
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const at=u=>[a[0]+dx*u/length,a[1]+dy*u/length];
  let start=0;
  for(const [left,right] of [...doors,[length,length]]){if(left>start)outline.segment(at(start),at(left));start=right;}
 }
 const [sx,sy,ex,ey]=data.stairs.box;
 const ring=level==='ground'?data.exterior.ground:[
  ...data.exterior.upper.slice(0,6),[8.5,ey],[ex,ey],[ex,sy],[sx,sy],[sx,data.void.box[1]],[0,data.void.box[1]]
 ];
 const shape=new THREE.Shape(ring.map(([x,y])=>new THREE.Vector2(x,y)));
 const backdrop=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({
  color:'#25292c',opacity:.92,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide
 }));
 backdrop.name='service-floor-backdrop-'+level;backdrop.position.z=data.levels[level];
 backdrop.renderOrder=230;backdrop.visible=false;backdrop.raycast=()=>{};group.add(backdrop);
 ring.forEach((p,i)=>outline.segment(p,ring[(i+1)%ring.length]));
 outline.finish();
}

function serviceHeatingFurniture(THREE,group,data,level) {
 const outlines=serviceOutlineLines(THREE,group,data.levels[level],'service-furnishings',.36);
 const types=new Set(['counter','concealed-door','cabinet','sofa','bed','table','sink','basin','shower','toilet',
  'tub','laundry-stack','bror-shelving','bror-workbench','dhw-cylinder','hydrobox','ventilation-unit']);
 const rectangle=([w,s,e,n])=>{
  const corners=[[w,s],[e,s],[e,n],[w,n]];
  corners.forEach((p,i)=>outlines.segment(p,corners[(i+1)%4]));
 };
 for(const item of data.furniture){
  if(item.room[0]===(level==='ground'?'0':'1')&&types.has(item.type))rectangle(item.box);
 }
 if(level==='ground'){
  const {box,tread,rises,width}=data.stairs,[w,s,e]=box;
  rectangle(box);
  const landing=s+(rises/2-1)*tread;
  outlines.segment([w+width,s],[w+width,landing]);
  for(let i=1;i<rises/2;i++)outlines.segment([w,s+i*tread],[e,s+i*tread]);
 }
 outlines.finish();
}

function serviceOutlineLines(THREE,group,base,name='service-plan',opacity=.68) {
 const points=[];
 return {
  segment(a,b){points.push(...a,base,...b,base);},
  finish(){
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
   const material=new THREE.LineBasicMaterial({color:'#f4e9ce',transparent:true,opacity,depthTest:false,depthWrite:false,toneMapped:false});
   const lines=new THREE.LineSegments(geometry,material);
   lines.name=name+'-'+group.userData.level;
   lines.renderOrder=231;lines.raycast=()=>{};group.add(lines);
  }
 };
}

function serviceUnderfloor(THREE,levels,data,pipe) {
 for(const level of ['ground','upper']){
  const upper=level==='upper',base=data.levels[level],group=levels[level];
  const {x,y,capacity}=iconHeatingManifolds[level],spacing=iconHeatingPortSpacing;
  const circuits=serviceHeatingCircuits(data,level);
  servicePlanOutline(THREE,group,data,level);
  serviceHeatingFurniture(THREE,group,data,level);
  for(let i=0;i<circuits.length;i+=capacity){
   const bank=i/capacity,n=Math.min(capacity,circuits.length-i);
   const cx=x+bank*iconHeatingBankSpacing;
   for(const [color,barZ] of [[iconServiceColors.floor,.55],[iconServiceColors.return,.38]]){
    const z=base+barZ,rail='manifold-'+bank+'-'+barZ;
    pipe(group,rail,[[cx,y,z],[cx+n*spacing,y,z]],color,.033,{ports:n,bank});
    const fromX=5.11-(barZ===.55?.13:0),feedY=8.17-(barZ===.55?.05:0);
    const pump=[[fromX,8.25,.8],[fromX,feedY,.73]];
    const riserX=6.35-(barZ===.55?.055:0);
    if(bank){
     pipe(group,rail+'-feed',[[cx-iconHeatingBankSpacing+capacity*spacing,y,z],[cx,y,z]],color,.022);
    }else if(upper){
     pipe(levels.ground,'upper-heating-riser-'+barZ,[...pump,[riserX,feedY,.73],[riserX,7.84,.73],[riserX,7.84,2.8]],color,.022);
     pipe(group,rail+'-feed',[[riserX,7.84,2.8],[riserX,7.84,z],[cx,7.84,z],[cx,y,z]],color,.022);
    }else pipe(group,rail+'-feed',[...pump,[cx,feedY,z],[cx,y,z]],color,.022);
   }
   for(let k=0;k<n;k++)serviceHeatingCircuit(THREE,group,pipe,circuits[i+k],i+k,serviceHeatingPort(level,i+k),bank);
  }
 }
}

function servicePump(group,data,pipe) {
 const [,,wallX]=data.outdoorHeatPump.box,wallY=data.outdoorHeatPump.box[1]+1.017;
 const hydrobox=data.furniture.find(f=>f.id==='heat-pump-module');
 const [,,moduleRight,moduleBack]=hydrobox.box;
 for(const [i,color,z] of [[0,iconServiceColors.pump,.671],[1,iconServiceColors.pumpReturn,.910],[2,iconServiceColors.cable,.79]]){
  const chaseX=wallX+.15+.09*i,techY=moduleBack-.055-.085*i,portX=moduleRight-[.13,.24,.56][i];
  const portZ=hydrobox.elevation+(i===2?.67:.40);
  const runZ=data.levels.ground-[.135,.135,.08][i],startY=wallY+(i===2?.095:0);
  const route=[[wallX-.556,startY,z],[chaseX,startY,z],[chaseX,startY,runZ],[chaseX,techY,runZ],
   [portX,techY,runZ],[portX,moduleBack-.14,runZ],[portX,moduleBack-.14,portZ]];
  pipe(group,['monobloc-flow','monobloc-return','monobloc-control-cable'][i],route,color,i===2?.014:.027);
 }
}

const iconWetGroups=[
 {id:'kitchen',level:'ground',stack:[4.12,8.49],returnAt:'kitchen-sink',items:['kitchen-sink']},
 {id:'bath',level:'ground',stack:[8.58,6.45],returnAt:'ground-bath',items:['ground-bath','ground-wc','ground-shower']},
 {id:'family',level:'upper',stack:[3.72,6.74],returnAt:'bath-tub',items:['upper-bath','upper-wc','bath-tub','upper-shower']},
 {id:'laundry',level:'upper',stack:[6.39,7.80],returnAt:'laundry-sink',items:['laundry-sink','laundry-stack']},
 {id:'suite',level:'upper',stack:[8.58,6.45],returnAt:'private-sink-two',items:['private-shower','private-wc','private-sink-one','private-sink-two']},
];

function serviceFixture(item,base) {
 const [x0,y0,x1,y1]=item.box,mx=(x0+x1)/2,my=(y0+y1)/2;
 if(item.id==='kitchen-sink')return {water:[mx,y0+.043,.90],waste:[mx,y0-.062,.451]};
 const center=[mx,my],edge={'+y':[mx,y0+.06],'-y':[mx,y1-.06],'+x':[x0+.06,my],'-x':[x1-.06,my]}[item.facing];
 const toilet=item.type==='toilet',wet=item.type==='shower'||item.type==='tub';
 const wash=item.type==='laundry-stack';
 return {water:[...edge,base+(toilet?.33:wash?.73:wet?.97:.55)],
  waste:[...(wet?center:edge),base+(wet?.03:toilet?.18:wash?.46:.45)],coldOnly:toilet||wash};
}

const iconDhwReturnColor='#d6508b';
const iconDhwReturnRiser=[6.56,7.56];
const iconDhwReturnHeader=[5.02,7.78,-.15];

function serviceCylinderPorts(group,data,pipe) {
 const [x0,y0,x1,y1]=data.furniture.find(f=>f.id==='dhw-cylinder').box;
 const x=(x0+x1)/2,y=(y0+y1)/2,ports={};
 // Three domestic-water connections on the cylinder jacket, clear of the two coil connections on top.
 for(const [kind,z,color] of [['hot',1.38,iconServiceColors.hot],['cold',.20,iconServiceColors.cold],['return',.84,iconDhwReturnColor]]){
  const surface=[x+.294*Math.SQRT1_2,y-.294*Math.SQRT1_2,z],union=[x+.365*Math.SQRT1_2,y-.365*Math.SQRT1_2,z];
  pipe(group,'cylinder-'+kind+'-union',[surface,union],color,.033);
  ports[kind]=union;
 }
 return ports;
}

function serviceDhwReturn(levels,data,pipe,port) {
 const color=iconDhwReturnColor,riser=iconDhwReturnRiser,split=[...riser,data.levels.groundCeiling];
 const upper=[...riser,data.levels.upper-.15],header=iconDhwReturnHeader;
 pipe(levels.upper,'dhw-return-riser-upper',[upper,split],color,.02);
 pipe(levels.ground,'dhw-return-riser-lower',[split,[...riser,header[2]],[header[0],riser[1],header[2]]],color,.02);
 for(const [level,hub] of [['upper',upper],['ground',header]]){
  const taps=iconWetGroups.filter(c=>c.level===level).map(c=>c.stack[1]-.20);
  taps.push(hub[1]);
  if(level==='ground')taps.push(riser[1]);
  const sorted=[...new Set(taps)].sort((a,b)=>a-b);
  for(let i=1;i<sorted.length;i++){
   pipe(levels[level],'dhw-return-header-'+level+'-'+i,[[hub[0],sorted[i-1],hub[2]],[hub[0],sorted[i],hub[2]]],color,.02);
  }
 }
 const inlet=[4.92,header[1],port[2]],outlet=[4.74,header[1],port[2]];
 pipe(levels.ground,'dhw-return-pump-inlet',[header,[header[0],header[1],port[2]],inlet],color,.021);
 pipe(levels.ground,'dhw-circulation-pump',[inlet,outlet],color,.065);
 pipe(levels.ground,'dhw-pump-drive',[[4.83,header[1],port[2]],[4.83,header[1],port[2]+.095]],'#91355e',.050);
 pipe(levels.ground,'dhw-return-to-cylinder',[outlet,[port[0],outlet[1],port[2]],port],color,.021);
}

function serviceDhwReturnBranch(group,cluster,tee,base,pipe) {
 const headerX=cluster.level==='upper'?iconDhwReturnRiser[0]:iconDhwReturnHeader[0];
 const z=base-.15,x=tee[0]+.115,y=cluster.stack[1]-.20;
 pipe(group,cluster.id+'-dhw-return',[tee,[x,tee[1],tee[2]],[x,tee[1],z],[x,y,z],
  [headerX,y,z]],iconDhwReturnColor,.018);
}

function serviceWater(levels,data,pipe) {
 const meter=[3.939,7.33,.805],soft=[3.939,7.112,.893],hub=[4.55,8.16];
 const ports=serviceCylinderPorts(levels.ground,data,pipe),tank=ports.hot;
 const colors=iconServiceColors;
 pipe(levels.ground,'meter-to-softener',[meter,[meter[0],soft[1],meter[2]],soft],colors.cold,.021);
 pipe(levels.ground,'softener-to-distributor',[soft,[soft[0],soft[1],.34],[soft[0],hub[1],.34],[...hub,.34]],colors.cold,.021);
 pipe(levels.ground,'cold-feed-to-cylinder',[[...hub,.34],[hub[0],ports.cold[1],.34],[hub[0],ports.cold[1],ports.cold[2]],ports.cold],colors.cold,.021);
 pipe(levels.ground,'cylinder-to-hot-distributor',[tank,[hub[0],tank[1],tank[2]],[hub[0],hub[1]-.055,tank[2]],[hub[0],hub[1]-.055,.42]],colors.hot,.021);
 serviceDhwReturn(levels,data,pipe,ports.return);
 for(const cluster of iconWetGroups){
  const {level,stack:[sx,sy]}=cluster,group=levels[level],base=data.levels[level];
  for(const [kind,color,off] of [['cold',colors.cold,0],['hot',colors.hot,-.055]]){
   const z=base+.34+(off?.08:0),gy=hub[1]+off,node=[sx,sy+off,z];
   const start=[hub[0],gy,z-base],riser=[6.39,7.80+off];
   const from=level==='upper'?[...riser,z]:start;
   const runZ=base-.115+(off?.045:0);
   if(level==='upper'&&cluster.id==='laundry'){
    pipe(levels.ground,'supply-to-riser-'+kind,[start,[riser[0],gy,start[2]],[...riser,start[2]],[...riser,2.8]],color,.024);
    pipe(group,'supply-riser-'+kind,[[...riser,2.8],from],color,.024);
   }
   if(from[0]!==node[0]||from[1]!==node[1]){
    pipe(group,cluster.id+'-feed-'+kind,[from,[from[0],from[1],runZ],[sx,from[1],runZ],[sx,sy+off,runZ],node],color,.023);
   }
   for(const id of cluster.items){
    const fixture=serviceFixture(data.furniture.find(f=>f.id===id),base);
    if(kind==='hot'&&fixture.coldOnly)continue;
    const [x,y,h]=fixture.water,p=[x+off,y,h];
    const tee=kind==='hot'&&id===cluster.returnAt?[p[0],y,h-.10]:null;
    const end=tee||p;
    pipe(group,id+'-'+kind,[node,[sx,sy+off,runZ],[p[0],sy+off,runZ],[p[0],y,runZ],end],color,.018,{fixture:id});
    if(tee){
     pipe(group,id+'-hot-tap',[tee,p],color,.018,{fixture:id});
     serviceDhwReturnBranch(group,cluster,tee,base,pipe);
    }
   }
  }
 }
}

const iconSewerExit=[8.74235626,4.20878006,-.72];

function serviceSewerVent(group,data,pipe) {
 const floor=data.levels.upper,roofX=4.70,roofY=7.77,headerZ=5.99,color=iconServiceColors.sewer;
 const chases={family:[3.72,5.71],laundry:[6.30,7.96],suite:[8.84,6.45]};
 const header=x=>[x,roofY,headerZ-.015*Math.abs(roofX-x)];
 for(const {id,stack:[sx,sy]} of iconWetGroups.filter(c=>c.level==='upper')){
  const [x,y]=chases[id],tap=header(x),atChase=tap[2]-.015*Math.abs(roofY-y);
  pipe(group,id+'-soil-vent',[[sx,sy,floor-.26],[x,y,floor-.18],[x,y,atChase],tap],color,.05);
 }
 const stations=[roofX,...Object.values(chases).map(p=>p[0])].sort((a,b)=>a-b);
 for(let i=1;i<stations.length;i++)pipe(group,'soil-vent-header-'+i,[header(stations[i-1]),header(stations[i])],color,.055);
 const roofZ=data.levels.ridge-(roofX-4.25)*(data.levels.ridge-data.levels.eave)/4.25;
 pipe(group,'soil-vent-to-roof',[header(roofX),[roofX,roofY,roofZ+.62]],color,.055);
 pipe(group,'soil-vent-roof-flashing',[[roofX,roofY,roofZ-.07],[roofX,roofY,roofZ+.10]],'#805d44',.083);
 pipe(group,'soil-vent-open-outlet',[[roofX,roofY,roofZ+.57],[roofX,roofY,roofZ+.62]],color,.068);
}

function serviceSewer(levels,data,pipe) {
 serviceSewerVent(levels.upper,data,pipe);
 const slope=.022, [ex,ey,ez]=iconSewerExit,headerY=8.49,levelAtY=y=>ez+(y-ey)*slope;
 const taps=[...new Set(iconWetGroups.map(c=>c.stack[1]))].sort((a,b)=>b-a);
 pipe(levels.ground,'collector-to-exterior',[[ex,headerY,levelAtY(headerY)],...taps.filter(y=>y<headerY).map(y=>[ex,y,levelAtY(y)]),iconSewerExit],iconServiceColors.sewer,.059);
 const done=new Set();
 for(const cluster of iconWetGroups){
  const {level,stack:[sx,sy]}=cluster,base=data.levels[level],joinZ=levelAtY(sy)+Math.abs(ex-sx)*slope;
  if(!done.has(sx+','+sy)){
   pipe(levels.ground,cluster.id+'-collector',[[sx,sy,joinZ],[ex,sy,levelAtY(sy)]],iconServiceColors.sewer,.055);
   done.add(sx+','+sy);
  }
  const stackZ=level==='upper'?base-.26:joinZ;
  if(cluster.id==='kitchen'){
   const [vx,vy]=iconWetGroups.find(c=>c.id==='family').stack;
   pipe(levels.ground,'kitchen-soil-vent',[[sx,sy,stackZ],[sx,sy,2.63],[vx,sy,2.65],
    [vx,vy,2.70],[vx,vy,data.levels.groundCeiling]],iconServiceColors.sewer,.045);
  }
  if(level==='upper'){
   pipe(levels.ground,cluster.id+'-stack-lower',[[sx,sy,2.8],[sx,sy,joinZ]],iconServiceColors.sewer,.055);
   pipe(levels.upper,cluster.id+'-stack-upper',[[sx,sy,stackZ],[sx,sy,2.8]],iconServiceColors.sewer,.055);
  }
  for(const id of cluster.items){
   const item=data.furniture.find(f=>f.id===id),{waste}=serviceFixture(item,base);
   if(item.type==='laundry-stack'){
    const [x,y]=waste,washer=[x-.10,y,base+.46],dryer=[x+.10,y,base+(item.height+.03)/2+.28];
    const common=[x,y+.035,base+.35];
    pipe(levels[level],'washer-drain',[washer,[washer[0],common[1],common[2]+.025],common],iconServiceColors.sewer,.022,{fixture:id});
    pipe(levels[level],'dryer-condensate-drain',[dryer,[dryer[0],common[1],common[2]+.035],common],iconServiceColors.sewer,.012,{fixture:id});
    serviceDrainBranch(levels[level],pipe,'laundry-appliances-drain',common,[sx,sy,stackZ],slope,.032,id);
   }else serviceDrainBranch(levels[level],pipe,id+'-drain',waste,[sx,sy,stackZ],slope,item.type==='toilet'?.052:.032,id);
  }
 }
}

function serviceDrainBranch(group,pipe,name,waste,stack,slope,radius,fixture){
 const [x,y]=waste,[sx,sy,stackZ]=stack,midZ=stackZ+Math.abs(sy-y)*slope,branchZ=midZ+Math.abs(x-sx)*slope;
 pipe(group,name,[waste,[x,y,branchZ],[sx,y,midZ],stack],iconServiceColors.sewer,radius,{fixture});
}

export function createIndoorServices(THREE,interior,data) {
 const root=new THREE.Group();root.name='indoor-services-193';root.visible=false;
 const pipe=servicePen(THREE);
 const groups={};
 for(const name of ['underfloor','heat-pump','water','sewer']){
  const group=serviceGroup(THREE,root,name);
  groups[name]={};
  for(const level of ['ground','upper'])groups[name][level]=serviceGroup(THREE,group,name+'-'+level,level);
 }
 serviceUnderfloor(THREE,groups.underfloor,data,pipe);
 servicePump(groups['heat-pump'].ground,data,pipe);
 serviceWater(groups.water,data,pipe);
 serviceSewer(groups.sewer,data,pipe);
 return root;
}
