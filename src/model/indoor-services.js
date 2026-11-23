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

// Split orthogonal room outlines at their returns so coils follow the usable floor.
function roomHeatingBands(outline){
 const edges=[...new Set(outline.map(p=>p[0]))].sort((a,b)=>a-b);
 return edges.slice(1).map((right,i)=>{
  const left=edges[i],mid=(left+right)/2;
  const hits=outline.flatMap(([x,y],j)=>{
   const [endX,endY]=outline[(j+1)%outline.length];
   return y===endY && mid>Math.min(x,endX) && mid<Math.max(x,endX)?[y]:[];
  });
  return [left,right,Math.min(...hits),Math.max(...hits)];
 });
}

// Each band spans west to east and carries its own south and north floor edges.
function serviceHeatingBands(data,room) {
 const [w,s,e,n]=room.box,[sx,sy,ex,ey]=data.stairs.box;
 const box=(west,east,south,north)=>[west,east,south,north];
 const innerWest=.36,innerEast=data.exterior.upper[3][0]-.36;
 const wingFront=data.exterior.upper[2][1]+.36,mainEast=data.exterior.upper[1][0]-.36;
 const wingRear=data.exterior.upper[4][1]-.36;
 const roomBox=id=>data.rooms.find(r=>r.id===id).box;
 const hall=roomBox('0.5'),kitchenWallEnd=data.walls.find(wall=>wall.id==='kitchen-back').b[0];
 switch(room.id){
  case '0.2':case '0.6':return roomHeatingBands(room.outline);
  case '0.4':{
   const pantry=roomBox('0.2'),alcoveEast=data.rooms.find(r=>r.id==='0.2').outline[3][0];
   return [box(w,alcoveEast,pantry[3],n),
    box(alcoveEast,kitchenWallEnd,s,n),
    box(kitchenWallEnd,sx,hall[3],n)];
  }
  case '0.5':return [box(kitchenWallEnd,e,s,n)];
  case '0.9':return [box(sx,w,sy,ey),box(w,e,s,ey)];
  case '1.1':return [box(innerWest,mainEast,.36,n)];
  case '1.2':case '1.3':return [box(innerWest,e,s,n)];
  case '1.4':return roomHeatingBands(room.outline);
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

function serviceHeatingCoil(legs,base,startHigh) {
 const path=[],z=base-.055;
 for(const [i,leg] of legs.entries()){
  const down=(i%2===1)!==startHigh,start=down?leg.high:leg.low,end=down?leg.low:leg.high;
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
 const [px,py,index,face,alongY,crossingY]=port;
 return [coil[0],coil.at(-1)].map(([x,y,z],side)=>{
  const feedZ=base+(side?.38:.55),dropX=px+(side?1:-1)*iconHeatingPortSpacing/4;
  const dropY=py+face*.075,laneY=py+face*(.22+(2*index+side)*.032),tailX=tailXs[side]??x;
  const fanZ=base-.135,crossZ=base-.172,tailZ=base-.10;
  if(alongY){
   const shaftY=py+(side?1:-1)*iconHeatingPortSpacing/4,shaftX=px+face*.075;
   const fanX=px+face*(.22+(2*index+side)*.032),busY=crossingY+(2*index+side)*.032;
   return [[px,py,feedZ],[px,py,feedZ-.042],[shaftX,shaftY,feedZ-.072],[shaftX,shaftY,fanZ],[fanX,shaftY,fanZ],
    [fanX,shaftY,crossZ],[fanX,busY,crossZ],[tailX,busY,crossZ],[tailX,busY,tailZ],
    [tailX,y,tailZ],...(tailX===x?[]:[[x,y,tailZ]]),[x,y,z]];
  }
  return [[px,py,feedZ],[px,py,feedZ-.042],[dropX,dropY,feedZ-.072],[dropX,dropY,fanZ],[dropX,laneY,fanZ],
   [dropX,laneY,crossZ],[tailX,laneY,crossZ],[tailX,laneY,tailZ],[tailX,y,tailZ],...(tailX===x?[]:[[x,y,tailZ]]),[x,y,z]];
 });
}

// Pairs of rails in accessible wall cabinets. Each room belongs to its nearest service zone.
const iconHeatingManifolds={
 ground:[
  {x:5.35,y:8.258,face:-1,location:'Kotłownia · pod rozdzielnicą',lining:[-0.122, 0.61, 0.85],finish:'#e9e3d7',rooms:['0.1','0.2','0.3','0.4']},
  {face:1,alongY:true,wardrobe:true,location:'Gabinet · w dwudrzwiowej szafie pod schodami',rooms:['0.5','0.6','0.7','0.8','0.9']}
 ],
 upper:[
  {x:6.374,y:5.72,face:1,alongY:true,crossingY:6.05,location:'Pralnia · przy wejściu od holu',lining:[-0.16, 0.435, 0.82],finish:'#e9e3d7',rooms:['1.1','1.2','1.3','1.4']},
  {x:12.79,y:4.64,face:1,location:'Garderoba · pod skosem między szafami',lining:[-0.49, 0.75, 0.79],finish:'#e9e3d7',rooms:['1.5','1.6','1.7','1.8']}
 ]
};
const iconHeatingPortSpacing=.051;

function serviceHeatingPort(manifold,index) {
 const offset=(index+.5)*iconHeatingPortSpacing;
 return [manifold.x+(manifold.alongY?0:offset),manifold.y+(manifold.alongY?offset:0),index,manifold.face,manifold.alongY,manifold.crossingY];
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

function serviceHeatingCircuits(data,level,manifolds) {
 const circuits=[],base=data.levels[level];
 const length=path=>path.reduce((sum,p,i)=>i?sum+Math.hypot(...p.map((v,k)=>v-path[i-1][k])):sum,0);
 for(const room of data.rooms.filter(r=>r.id[0]===(level==='ground'?'0':'1'))){
  const bank=manifolds.findIndex(m=>m.rooms.includes(room.id)),manifold=manifolds[bank];
  const firstPort=circuits.filter(c=>c.bank===bank).length;
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
    const port=serviceHeatingPort(manifold,firstPort+proposed.length);
    const turns=legs.slice(start,end);
    const options=[false,true].map(startHigh=>{
     const coil=serviceHeatingCoil(turns,base,startHigh);
     const [supply,back]=serviceHeatingLeads(coil,port,base);
     return {coil,length:length(coil)+length(supply)+length(back)};
    });
    const shortest=options[0].length<=options[1].length?options[0]:options[1];
    if(shortest.length>89.5)break;
    proposed.push({room:room.id,pitch,bank,port,coil:shortest.coil});start=end;
   }
   if(start===legs.length){circuits.push(...proposed);break;}
  }
 }
 serviceHeatingTailLanes(data,circuits);
 return circuits;
}

function serviceHeatingCircuit(THREE,group,pipe,circuit,index) {
 const {room,pitch,coil,port,bank}=circuit,base=coil[0][2]+.055;
 const [supply,back]=serviceHeatingLeads(coil,port,base,circuit.tailXs),branch='floor-'+room+'-'+index;
 const lengthOf=points=>serviceRoundedPath(THREE,points.map(p=>new THREE.Vector3(...p)))
  .reduce((length,p,i,path)=>length+(i?p.distanceTo(path[i-1]):0),0);
 const activeLength=lengthOf(coil),length=activeLength+lengthOf(supply)+lengthOf(back);
 const hue=(index*137.508+(group.userData.level==='upper'?71:0))%360;
 const loopColor=`hsl(${hue.toFixed(2)},${index%2?70:88}%,${index%3===0?70:58}%)`;
 pipe(group,branch+'-supply',supply,iconServiceColors.floor,.012,{loopColor,bank,room,rail:'supply'});
 pipe(group,branch,coil,iconServiceColors.floor,.015,{kind:'heating-loop',room,pitch,bank,loopColor,activeLength,length});
 pipe(group,branch+'-return',back,iconServiceColors.floor,.012,{loopColor,bank,room,rail:'return'});
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
  const manifolds=iconHeatingManifolds[level].map(config=>{
   if(!config.wardrobe)return config;
   const wardrobe=data.furniture.find(item=>item.heatingManifold)??data.furniture.find(item=>item.id==='office-under-stair-4');
   if(!wardrobe)throw new Error('Brak szafy pod schodami na rozdzielacz gabinetu.');
   const [,south,front,north]=wardrobe.box;
   return {...config,x:front-.25,y:(south+north)/2-6*iconHeatingPortSpacing/2,crossingY:south-.55};
  });
  const circuits=serviceHeatingCircuits(data,level,manifolds);
  group.userData.cabinets=manifolds;
  servicePlanOutline(THREE,group,data,level);
  serviceHeatingFurniture(THREE,group,data,level);
  for(const [side,color,barZ] of [[0,iconServiceColors.floor,.55],[1,iconServiceColors.return,.38]]){
   const sourceX=4.98+.13*side,feedY=8.12+.05*side,riserX=6.295+.055*side;
   const mainZ=base-.24-.06*side,header=[sourceX,feedY,mainZ];
   const source=[sourceX,8.25,.80],riser=[riserX,7.84,mainZ];
   if(upper){
    const underRiser=[riserX,7.84,data.levels.ground-.24-.06*side];
    const split=[riserX,7.84,data.levels.groundCeiling];
    pipe(levels.ground,'upper-heating-riser-'+barZ,[underRiser,split],color,.022);
    pipe(group,'upper-heating-riser-head-'+barZ,[split,riser],color,.022);
   }else{
    pipe(group,'heating-primary-'+barZ,[source,[sourceX,feedY,.73],header],color,.025);
    pipe(group,'upper-heating-feed-'+barZ,[header,[riserX,feedY,mainZ],riser],color,.022);
   }
   for(const [bank,{x,y,alongY,wardrobe}] of manifolds.entries()){
    const n=circuits.filter(c=>c.bank===bank).length,rail='manifold-'+bank+'-'+barZ;
    const z=base+barZ,start=upper?riser:header;
    const valveOffset=wardrobe ? .113-.055*side : .062+.024*side;
    const feedX=x-(alongY?0:valveOffset),feedY=y-(alongY?valveOffset:0);
    pipe(group,rail+'-feed',[start,[start[0],feedY,mainZ],[feedX,feedY,mainZ],[feedX,feedY,z],[x,y,z]],color,.022,{bank,rail:side?'primary-return':'primary-supply'});
    pipe(group,rail,[[x,y,z],[x+(alongY?0:n*iconHeatingPortSpacing),y+(alongY?n*iconHeatingPortSpacing:0),z]],color,.033,{ports:n,bank});
   }
  }
  circuits.forEach((c,i)=>serviceHeatingCircuit(THREE,group,pipe,c,i));
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

const iconSewerExit=[8.74235626,4.20878006,-.6798043083901801];

function soilVentRoofPosition193(levels) {
 const x=4.70,y=7.77,pitch=(levels.ridge-levels.eave)/4.25;
 return {x,y,pitch,z:levels.ridge-(x-4.25)*pitch,poeY:y+.155};
}

export function soilVentRoofCut193(metadata,project=iconPlanPoint) {
 const {x,y,poeY}=soilVentRoofPosition193(metadata.dimensions),r=.065;
 const ring=[[x-r,y-r],[x-r,poeY+.030],[x+r,poeY+.030],[x+r,y-r]].map(([u,v])=>project(metadata,u,v,0).slice(0,2));
 return {parcel:'193',ring};
}

export function createSoilVentSurface(THREE,house,interior) {
 const group=new THREE.Group();group.name='soil-vent-exterior-193';
 group.matrixAutoUpdate=false;group.matrix.copy(interior.group.matrix);
 const {x,y,z,pitch,poeY}=soilVentRoofPosition193(house.metadata.dimensions);
 const material=new THREE.MeshStandardMaterial({color:0x384143,metalness:.34,roughness:.55,side:THREE.DoubleSide});
 // Local rings follow the roofing below the boot and turn horizontal at the open DN110 outlet.
 function rings(name,sections,axisY=y){
  const vertices=[],indices=[],segments=40;
  for(const [radius,h,slope] of sections)for(let i=0;i<segments;i++){
   const angle=2*Math.PI*i/segments,dx=radius*Math.cos(angle);
   vertices.push(dx,radius*Math.sin(angle),h-dx*slope);
  }
  for(let j=1;j<sections.length;j++)for(let i=0;i<segments;i++){
   const a=(j-1)*segments+i,b=(j-1)*segments+(i+1)%segments;
   indices.push(a,b,b+segments,a,b+segments,a+segments);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,axisY,z);
  mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 const outline=[[-.185,-.17],[.185,-.17],[.185,poeY-y+.13],[-.185,poeY-y+.13]];
 const apron=new THREE.Shape(outline.map(([u,v])=>new THREE.Vector2(u,v)));
 for(const [v,r] of [[0,.060],[poeY-y,.020]]){
  const hole=new THREE.Path();hole.absarc(0,v,r,0,Math.PI*2,true);apron.holes.push(hole);
 }
 const flashing=new THREE.ExtrudeGeometry(apron,{depth:.006,bevelEnabled:false,curveSegments:24});
 const pos=flashing.getAttribute('position');
 for(let i=0;i<pos.count;i++)pos.setZ(i,pos.getZ(i)-pitch*pos.getX(i));
 flashing.computeVertexNormals();
 const base=new THREE.Mesh(flashing,material);base.name='soil-vent-weathering-boot';
 base.position.set(x,y,z+.004);base.receiveShadow=true;group.add(base);
 rings('soil-vent-collar',[[.100,.009,pitch],[.078,.027,pitch],[.062,.13,0]]);
 rings('soil-vent-open-pipe',[[.062,.115,0],[.062,.566,0],[.067,.572,0],[.067,.62,0],
  [.055,.62,0],[.055,-.18,0]]);
 rings('ethernet-roof-sealed-gland',[[.020,-.18,0],[.024,-.18,0],[.024,.009,pitch],
  [.040,.009,pitch],[.026,.040,0],[.026,.093,0],[.020,.105,0]],poeY);
 const enclosure=new THREE.Mesh(new THREE.BoxGeometry(.104,.120,.082),material);
 enclosure.name='ethernet-roof-sealed-box';enclosure.position.set(x,poeY,z+.14);
 enclosure.castShadow=true;enclosure.receiveShadow=true;group.add(enclosure);
 return group;
}

function serviceSewerVent(group,data,pipe) {
 const floor=data.levels.upper,headerZ=5.99,color=iconServiceColors.sewer;
 const {x:roofX,y:roofY,z:roofZ}=soilVentRoofPosition193(data.levels);
 const chases={family:[3.72,5.71],laundry:[6.30,7.96],suite:[8.84,6.45]};
 const header=x=>[x,roofY,headerZ-.015*Math.abs(roofX-x)];
 for(const {id,stack:[sx,sy]} of iconWetGroups.filter(c=>c.level==='upper')){
  const [x,y]=chases[id],tap=header(x),atChase=tap[2]-.015*Math.abs(roofY-y);
  pipe(group,id+'-soil-vent',[[sx,sy,floor-.26],[x,y,floor-.18],[x,y,atChase],tap],color,.05);
 }
 const stations=[roofX,...Object.values(chases).map(p=>p[0])].sort((a,b)=>a-b);
 for(let i=1;i<stations.length;i++)pipe(group,'soil-vent-header-'+i,[header(stations[i-1]),header(stations[i])],color,.055);
 pipe(group,'soil-vent-to-roof',[header(roofX),[roofX,roofY,roofZ+.62]],color,.055);
 pipe(group,'soil-vent-roof-flashing',[[roofX,roofY,roofZ-.07],[roofX,roofY,roofZ+.10]],'#805d44',.083);
 pipe(group,'soil-vent-open-outlet',[[roofX,roofY,roofZ+.57],[roofX,roofY,roofZ+.62]],color,.068);
}

function serviceSewer(levels,data,pipe) {
 serviceSewerVent(levels.upper,data,pipe);
 const slope=.022,[ex,ey,ez]=iconSewerExit,levelAtY=y=>ez+(y-ey)*slope;
 const taps=[...new Set(iconWetGroups.map(c=>c.stack[1]))].sort((a,b)=>b-a);
 pipe(levels.ground,'collector-to-exterior',[...taps.map(y=>[ex,y,levelAtY(y)]),iconSewerExit],iconServiceColors.sewer,.055);
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

function serviceDishwasher(groups,data,pipe,THREE,interior) {
 const sink=data.furniture.find(f=>f.id==='kitchen-sink'),counter=data.furniture.find(f=>f.id===sink.support);
 const center=(sink.box[0]+sink.box[2])/2,sinkRight=center+(sink.baseCabinetWidthM??.80)/2;
 const left=counter.box[0],right=(left+center-(sink.baseCabinetWidthM??.80)/2)/2;
 const [,wall]=counter.box,back=wall-.013,trapY=sink.box[1]+.204;
 const cold=iconServiceColors.cold,sewer=iconServiceColors.sewer,meta={fixture:'dishwasher'};
 const main=groups.water.ground.getObjectByName('kitchen-feed-cold').userData.to;
 const valve=[sinkRight-.15,wall+.046,.55],inlet=[left+.15,wall+.020,.16],outlet=[left+.21,wall+.020,.19];
 pipe(groups.water.ground,'dishwasher-stop-valve',[main,[valve[0],main[1],main[2]],[valve[0],back,.55],valve],cold,.012,meta);
 pipe(groups.water.ground,'dishwasher-inlet-hose',[valve,[valve[0]+.025,wall+.046,.48],[valve[0]+.025,back,.17],[inlet[0],back,.15],inlet],cold,.010,meta);
 const spigot=[center+.05,trapY,.645],trapOut=serviceFixture(sink,0).waste;
 pipe(groups.sewer.ground,'dishwasher-drain-hose',[outlet,[outlet[0],back,.21],[center-.24,back,.26],
  [center-.22,back,.77],[center+.05,back,.77],[center+.05,trapY,.69],spigot],sewer,.012,meta);
 pipe(groups.sewer.ground,'dishwasher-trap-connection',[spigot,[center,trapY,.60],[center,trapY,.413],
  [center,trapY-.033,.364],[center,trapY-.075,.375],[center,trapY-.101,.433],[center,trapY-.138,.451],trapOut],sewer,.018,meta);
 const plug=[right+.13,wall+.050,.55],inletPower=[left+.30,wall+.020,.18];
 pipe(groups.power.ground,'dishwasher-power-cord',[plug,[plug[0],wall+.066,.47],[plug[0],back,.16],
  [inletPower[0],back,.15],inletPower],iconServiceColors.cable,.006,meta);
 if(!interior?.group||interior.group.getObjectByName('dishwasher-connections'))return;
 const fixed=serviceGroup(THREE,interior.group,'dishwasher-connections');
 for(const [group,id,color] of [[groups.water.ground,'inlet-hose','#506e76'],[groups.sewer.ground,'drain-hose','#a8ada6'],[groups.power.ground,'power-cord','#272a29']]){
  const overlay=group.getObjectByName('dishwasher-'+id);
  const mesh=new THREE.Mesh(overlay.geometry,new THREE.MeshStandardMaterial({color,roughness:.76}));
  mesh.name='dishwasher-fitted-'+id;fixed.add(mesh);
 }
}

function serviceRobotCabinet(groups,data,pipe,THREE,interior) {
 const item=data.furniture.find(f=>f.robotCabinet);
 if(!item)return;
 const [west,back]=item.box;
 const cold=groups.water.ground,sewer=groups.sewer.ground;
 const tap=cold.getObjectByName('kitchen-feed-cold').userData.to;
 const stack=sewer.getObjectByName('kitchen-collector').userData.from;
 const meta={fixture:'kitchen-robot',provision:true};
 const fittings=[];
 // Keep the capped terminals on the open side of the dock and below the first shelf.
 const x=west+.10,y=back+.024;
 const valve=[x,y+.047,.60],drain=[x+.105,y+.043,.53];
 pipe(cold,'robot-cold-supply',[tap,[tap[0],tap[1],-.13],[x,tap[1],-.13],[x,y,-.13],[x,y,.60]],iconServiceColors.cold,.010,meta);
 fittings.push(pipe(cold,'robot-isolation-valve',[[x,y,.60],valve],iconServiceColors.cold,.018,meta));
 fittings.push(pipe(cold,'robot-valve-handle',[[x,y+.02,.606],[x,y+.02,.635]],'#377dad',.014,meta));
 fittings.push(pipe(sewer,'robot-capped-trap',[drain,[drain[0],y,.53],[drain[0],y,.425],
  [drain[0]+.048,y,.425],[drain[0]+.048,y,.475],[drain[0]+.082,y,.475]],iconServiceColors.sewer,.020,meta));
 serviceDrainBranch(sewer,pipe,'robot-drain',fittings.at(-1).userData.to,stack,.022,.025,'kitchen-robot');
 if(!interior?.group||interior.group.getObjectByName('robot-service-terminals'))return;
 const fixed=serviceGroup(THREE,interior.group,'robot-service-terminals');
 for(const fitting of fittings){
  const material=new THREE.MeshStandardMaterial({color:fitting.material.color,roughness:.64});
  fitting.geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(fitting.geometry,material);mesh.name=fitting.name+'-installed';fixed.add(mesh);
 }
 for(const [name,point,radius,color] of [['cold',valve,.018,0x8c9ea4],['waste',drain,.022,0x73695d]]){
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.010,16),new THREE.MeshStandardMaterial({color}));
  cap.name='robot-'+name+'-blanking-cap';cap.position.set(point[0],point[1]+.004,point[2]);fixed.add(cap);
 }
}

function serviceElectricalPort(item,name) {
 const [x0,y0,x1,y1]=item.box,[u,v,h]=item.ports[name],z=(item.elevation||0)+h;
 return [...({'-x':[x1-v,y0+u],'+x':[x0+v,y1-u],'-y':[x1-u,y1-v],'+y':[x0+u,y0+v]}[item.facing]),z];
}

function servicePower(group,data,pipe,THREE,interior) {
 const get=id=>data.furniture.find(f=>f.id===id);
 const board=get('utility-distribution-board'),inverter=get('utility-pv-inverter');
 const battery=get('utility-battery'),charger=get('garage-wallbox');
 const ac='#ffce68',plug=group.getObjectByName('dishwasher-power-cord').userData.from;
 for(const item of [board,inverter,battery,charger]){
  const [w,s,e,n]=item.box,z=(item.elevation||0)+item.height;
  const outline=[[w,s,z],[e,s,z],[e,n,z],[w,n,z],[w,s,z]];
  pipe(group,item.id+'-outline',outline,'#e3dbbd',.014,{device:item.id});
 }
 const leads=interior?.group&&!interior.group.getObjectByName('battery-to-inverter-harness')?serviceGroup(THREE,interior.group,'battery-to-inverter-harness'):null;
 const port=serviceElectricalPort;
 for(const [terminal,input,color,finish] of [
  ['positive','batteryPlus','#fa7865','#9b3931'],['negative','batteryMinus','#a8b1cb','#303535']
 ]){
  const start=port(battery,terminal),end=port(inverter,input),bend=start[2]+(terminal==='positive'?.11:.18);
  const mesh=pipe(group,'battery-dc-'+terminal,[start,[start[0],start[1],bend],[end[0],start[1],bend],
   [end[0],end[1],bend],end],color,.014,{circuit:'battery-dc',voltage:battery.nominalVoltageV});
  if(leads){
   const cable=new THREE.Mesh(mesh.geometry,new THREE.MeshStandardMaterial({color:finish,roughness:.80}));
   cable.name='fitted-battery-dc-'+terminal;leads.add(cable);
  }
 }
 const boardWall=data.walls.find(w=>w.id==='kitchen-back').a[1];
 const eastWall=data.walls.find(w=>w.id==='garage-hall').a[0];
 const inv=port(inverter,'ac'),feed=port(board,'inverter'),z=data.levels.groundCeiling-.25;
 pipe(group,'inverter-ac-to-board',[inv,[inv[0],inv[1],inv[2]-.055],[eastWall,inv[1],inv[2]-.055],
  [eastWall,inv[1],z],[eastWall,boardWall,z],[feed[0],boardWall,z],[feed[0],boardWall,feed[2]-.050],
  [feed[0],feed[1],feed[2]-.050],feed],ac,.019,{circuit:'inverter-ac'});
 const ev=port(board,'ev'),end=port(charger,'ac'),garageWall=data.walls.find(w=>w.id==='garage-back').a[1];
 const evWallX=eastWall+.028,evWallY=boardWall+.034,head=z+.064,sideWall=.34;
 pipe(group,'distribution-board-to-wallbox',[ev,[ev[0],ev[1],ev[2]-.095],[ev[0],evWallY,ev[2]-.095],
  [ev[0],evWallY,head],[evWallX,evWallY,head],[evWallX,garageWall,head],[sideWall,garageWall,head],
  [sideWall,end[1],head],[sideWall,end[1],end[2]-.070],[end[0],end[1],end[2]-.070],end],ac,.022,{circuit:'garage-ev',phases:charger.phases});
 const kitchen=port(board,'dishwasher'),lane=boardWall-.048;
 pipe(group,'distribution-board-to-dishwasher-socket',[kitchen,[kitchen[0],kitchen[1],kitchen[2]-.13],
  [kitchen[0],lane,kitchen[2]-.13],[kitchen[0],lane,.55],[plug[0],lane,.55],plug],ac,.016,{circuit:'dishwasher-ac'});
}

function serviceExteriorPower(THREE,group,data,pipe,interior,site) {
 const equipment=interior?.sitePower;
 if(!equipment)return;
 const board=data.furniture.find(f=>f.id==='utility-distribution-board');
 const color='#ffce68',wall=data.walls.find(w=>w.id==='kitchen-back').a[1];
 const draw=(id,route,source,device)=>pipe(group,id,route,color,.022,{circuit:source,device});
 function boardFeed(id,source,device,via,end,depth=-.54){
  const pin=serviceElectricalPort(board,source),back=[pin[0],wall,pin[2]-.08];
  draw(id,[pin,[pin[0],pin[1],back[2]],back,[back[0],back[1],depth],
   ...via.map(([x,y])=>[x,y,depth]),end],source,device);
 }
 const {gate,heatPump,controllerIn,controllerOut}=equipment;
 const wallEnd='utility-outdoor-unit-mains-gland';
 const [,py,pz]=heatPump;
 boardFeed('board-to-monobloc','monobloc',wallEnd,[[.23,wall],[.23,py]], [.23,py,pz]);
 draw('monobloc-mains-tail',[[.23,py,pz],heatPump],'monobloc',wallEnd);
 const [cx,cy]=controllerIn;
 boardFeed('board-to-biodisc-controller','biodisc','biodisc-controllerIn-gland',[[cx,wall],[cx,cy]],controllerIn,-.24);
 if(site.wastewater){
  const gland=site.wastewater.getObjectByName('biodisc-drive-gland');
  const inHouse=v=>interior.group.worldToLocal(v).toArray();
  const drive=inHouse(gland.getWorldPosition(new THREE.Vector3()));
  const entry=inHouse(site.wastewater.localToWorld(new THREE.Vector3(.79,-.63,-.28)));
  const [ox,oy]=controllerOut,buried=-.57;
  draw('controller-to-biodisc-drive',[controllerOut,[ox,oy,buried],[ox,1.65,buried],[entry[0],1.65,buried],
   [entry[0],entry[1],buried],entry,[drive[0],drive[1],entry[2]],drive],'biodisc',gland.name);
 }
 if(gate){
  const [gx,gy]=gate;
  boardFeed('board-to-drive-gate','gate','drive-gate-motor',[[gx,wall],[gx,gy]],gate,-.65);
 }
 const cable=site.irrigationCablePath;
 if(cable?.length){
  const [entry]=cable,wing=data.facades.find(f=>f.id==='facade-wing-end');
  const insideX=wing.a[0]-.21,exitY=wing.b[1]-.32;
  boardFeed('board-to-irrigation-entry','irrigation','rain-tank-cable-entry',
   [[insideX,wall],[insideX,exitY],[entry[0],exitY],[entry[0],entry[1]]],entry,-.99);
  draw('irrigation-pump-cable',cable,'irrigation','rain-irrigation-power-terminal');
 }
 serviceExteriorLighting(interior.exteriorLights.terminals,board,wall,draw,boardFeed);
}

function serviceExteriorLighting(lamps,board,wall,draw,boardFeed) {
 // Split to the two sides of the house at the first garage fitting. Each branch follows its facade.
 const fixtures=lamps.filter(f=>!f.pendant),depth=-.82;
 const tail=(f,via)=>draw('feed-'+f.id,via,'outdoorLights',f.id);
 // Approach the side fitting from outside the adjacent drainage pipe.
 const offsets={
  'icon-exterior-uplight-main-side-2.75':[-.20,0,.015]
 };
 const buried=f=>{
  const [dx,dy]=offsets[f.id]||[0,0];
  return [f.point[0]+dx,f.point[1]+dy,depth];
 };
 const lampDrop=f=>{
  const tee=buried(f),[x,y]=f.point,turnZ=offsets[f.id]?.[2]??-.19;
  tail(f,[tee,[tee[0],tee[1],turnZ],[x,y,turnZ],f.point]);
 };
 const byName=id=>fixtures.find(f=>f.id==='icon-exterior-uplight-'+id);
 const start=byName('garage-0.51');
 boardFeed('board-to-uplights','outdoorLights',start.id,[[.25,wall],[.25,start.point[1]],start.point],buried(start),depth);
 lampDrop(start);
 function branch(ids){
  let prev=start;
  for(const [id,corners] of ids){
   const fixture=byName(id);
   draw('branch-'+fixture.id,[buried(prev),...corners.map(p=>[...p,depth]),buried(fixture)],'outdoorLights',fixture.id);
   lampDrop(fixture);prev=fixture;
  }
 }
 branch([['main-side-2.75',[[-.34,-.34]]],['main-side-14.68',[]]]);
 branch([['garage-6.51',[]],['front-wing-1.3',[[7.24,-.34],[7.24,3.87]]],['front-wing-4.21',[]],
  ['wing-end-2.25',[[14.98,3.87]]]]);
 const [first,second]=lamps.filter(f=>f.pendant);
 const railZ=first.point[2]+.03,feed=serviceElectricalPort(board,'terraceLights');
 const riser=[feed[0],wall,railZ];
 draw('board-to-terrace-pendants',[feed,[feed[0],feed[1],feed[2]-.08],[feed[0],wall,feed[2]-.08],riser,
  [8.46,wall,railZ],[8.46,first.point[1],railZ],[first.point[0],first.point[1],railZ]],'terraceLights',first.id);
 const junction=[first.point[0],first.point[1],railZ];
 draw('feed-'+first.id,[junction,first.point],'terraceLights',first.id);
 draw('feed-'+second.id,[junction,[second.point[0],second.point[1],railZ],second.point],'terraceLights',second.id);
}

function serviceDrainBranch(group,pipe,name,waste,stack,slope,radius,fixture){
 const [x,y]=waste,[sx,sy,stackZ]=stack,midZ=stackZ+Math.abs(sy-y)*slope,branchZ=midZ+Math.abs(x-sx)*slope;
 pipe(group,name,[waste,[x,y,branchZ],[sx,y,midZ],stack],iconServiceColors.sewer,radius,{fixture});
}

// Wall coordinates are on the finished faces. The normal points into the room.
const iconLanOutlets=[
 {id:'salon-rtv',room:'0.4',face:[.50,14.48,.56],normal:[1,0]},
 {id:'bawialnia',room:'0.8',face:[11.34,4.91,.30],normal:[1,0]},
 {id:'gabinet',room:'0.9',face:[11.40,12.21,.48],normal:[0,-1]},
 {id:'pokoj-1',room:'1.1',face:[7.55,3.60,.32],normal:[0,-1]},
 {id:'pokoj-2',room:'1.3',face:[1.70,5.78,.32],normal:[0,1]},
 {id:'sypialnia',room:'1.8',face:[11.48,7.96,.32],normal:[0,1]},
 {id:'garaz',room:'0.1',port:8,face:[5.76,6.53,1.05],normal:[0,-1]}
];

export function createEthernetOutlets(THREE,data) {
 const group=new THREE.Group();group.name='ethernet-outlets-193';
 const face=new THREE.MeshStandardMaterial({color:0xe4dfd6,roughness:.58});
 const insert=new THREE.MeshStandardMaterial({color:0x282e30,roughness:.76});
 function box(parent,name,size,position,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.name=name;mesh.position.set(...position);parent.add(mesh);return mesh;
 }
 for(const [index,{id,room,port,face:[x,y,h],normal:[nx,ny]}] of iconLanOutlets.entries()){
  const outlet=new THREE.Group();outlet.name='rj45-'+id;outlet.userData={room,port:port??index+1};
  outlet.position.set(x,y,h+(room.startsWith('1.')?data.levels.upper:0));
  outlet.rotation.z=Math.atan2(-nx,ny);group.add(outlet);
  box(outlet,'ramka',[.080,.009,.080],[0,.0045,0],face);
  box(outlet,'gniazdo',[.015,.002,.013],[0,.010,-.003],insert);
  box(outlet,'zatrzask',[.007,.002,.004],[0,.010,-.011],insert);
 }
 return group;
}

function serviceIntercom(groups,interior,data,pipe) {
 const system=interior?.intercom;if(!system)return;
 const rack=data.furniture.find(f=>f.id==='utility-network-rack'),[west,south,,front]=rack.box;
 const rackY=front-.048,z=rack.elevation;
 for(const [index,id] of ['street','monitor'].entries()){
  const port=9+index,i=port-1,end=system.terminals[id],[x,y]=end;
  const panel=[west+.104+i*.034,rackY,z+.295],sw=[west+.104+i*.024,rackY,z+.211];
  const info={outlet:'intercom-'+id,port,poe:true},route=[panel,[panel[0],south+.06,panel[2]],[panel[0],south+.06,-.20]];
  if(id==='street')route.push([.64,south+.06,-.20],[.64,.25,-.20],[.64,.25,-.62],[.64,y,-.62],[x,y,-.62]);
  else route.push([6.51,south+.06,-.20],[6.51,y,-.20],[6.51,y,end[2]]);
  pipe(groups.ethernet.ground,'lan-intercom-'+id+'-patch',[sw,[sw[0],rackY+.026,sw[2]+.02],
   [panel[0],rackY+.026,panel[2]-.02],panel],'#78ace7',.009,info);
  pipe(groups.ethernet.ground,'lan-intercom-'+id+'-kabel',[...route,end],'#84e58c',.018,info);
 }
 const wall=data.walls.find(w=>w.id==='garage-hall'),socket=data.electrical.points.find(p=>p.room==='0.3'&&p.type==='socket');
 const [sx,sy,sz]=[wall.a[0]-wall.thickness/2,socket.alongM,socket.heightM];
 const inlet=[west+.418,south+.044,z+.206];
 pipe(groups.power.ground,'rack-switch-poe-mains',[[sx,sy,sz],[sx-.07,sy,sz],[sx-.07,sy,z-.025],
  [inlet[0],sy,z-.025],[inlet[0],inlet[1],z-.025],inlet],iconServiceColors.cable,.012,
  {device:'utility-network-rack-ethernet-switch',circuit:'rack-poe',voltage:230});
}

function serviceEthernet(THREE,levels,data,pipe) {
 const rack=data.furniture.find(f=>f.id==='utility-network-rack'),[west,,,front]=rack.box;
 const roof=soilVentRoofPosition193(data.levels);
 const runs=[...iconLanOutlets,{id:'dach-poe',port:7,face:[roof.x,roof.poeY,roof.z+.14]}];
 for(const level of ['ground','upper'])servicePlanOutline(THREE,levels[level],data,level);
 const rackY=front-.048;
 const sw=index=>[west+.104+index*.024,rackY,rack.elevation+.211];
 const uplink=sw(15),router=[west+.104,rackY,rack.elevation+.120];
 pipe(levels.ground,'lan-switch-router-uplink',[uplink,[uplink[0],rackY+.026,uplink[2]-.016],
  [router[0],rackY+.026,router[2]+.019],router],'#75bbdf',.009,{switchPort:16,routerPort:1});
 for(const [index,{id,room,port=index+1,face:[x,y,height]}] of runs.entries()){
  const i=port-1;
  const upper=!room||room.startsWith('1.'),color=room?'#84e58c':'#e8d15b',meta={port,room:room??'dach',outlet:id};
  const run=(group,part,points)=>pipe(group,'lan-'+id+'-'+part,points,color,part==='patch'?.009:.029,meta);
  const rackX=west+.104+i*.034,panel=[rackX,rackY,rack.elevation+.295];
  const switchPort=sw(i),shaftX=6.23+i*.020,shaftY=6.72;
  run(levels.ground,'patch',[switchPort,[switchPort[0],rackY+.026,switchPort[2]+.02],[rackX,rackY+.026,panel[2]-.02],panel]);
  const behind=[rackX,front-.26,panel[2]],z=(upper?data.levels.upper:0)-.205;
  const destination=[x,y,(room&&upper?data.levels.upper:0)+height];
  let route;
  if(upper){
   const split=[shaftX,shaftY,data.levels.groundCeiling];
   run(levels.ground,'pion',[panel,behind,[shaftX,behind[1],behind[2]],[shaftX,shaftY,behind[2]],split]);
   route=[split,[shaftX,shaftY,z],[shaftX,y,z]];
   if(!room){
    // Rise inside the solid partition beyond the bedroom doorway, then cross above the attic ceiling.
    const partition=data.walls.find(w=>w.id==='u-room2-hall'),chaseX=partition.a[0];
    const chaseY=Math.max(y,partition.a[1]+partition.doors.at(-1)[1]+.14),atticZ=data.levels.upperCeiling+.18;
    route.push([chaseX,y,z],[chaseX,chaseY,z],[chaseX,chaseY,atticZ],[chaseX,y,atticZ],[x,y,atticZ]);
   }else route.push([x,y,z]);
   route.push(destination);
  }else if(id==='garaz'){
   route=[panel,behind,[rackX,shaftY,panel[2]],[x,shaftY,panel[2]],[x,shaftY,height],destination];
  }else{
   const lane=7.52+.05*i;
   route=[panel,behind,[rackX,behind[1],z],[rackX,lane,z],[x,lane,z],[x,y,z],destination];
  }
  const level=upper?levels.upper:levels.ground;
  run(level,'kabel',route);
  pipe(level,'lan-'+id+'-punkt',[[x,y,destination[2]-.025],destination],color,.105,meta);
 }
}

export function createIndoorServices(THREE,interior,data,site={}) {
 const root=new THREE.Group();root.name='indoor-services-193';root.visible=false;
 const pipe=servicePen(THREE);
 const groups={};
 for(const name of ['underfloor','heat-pump','water','sewer','power','ethernet']){
  const group=serviceGroup(THREE,root,name);
  groups[name]={};
  for(const level of ['ground','upper'])groups[name][level]=serviceGroup(THREE,group,name+'-'+level,level);
 }
 serviceEthernet(THREE,groups.ethernet,data,pipe);
 serviceIntercom(groups,interior,data,pipe);
 serviceUnderfloor(THREE,groups.underfloor,data,pipe);
 servicePump(groups['heat-pump'].ground,data,pipe);
 serviceWater(groups.water,data,pipe);
 serviceSewer(groups.sewer,data,pipe);
 serviceDishwasher(groups,data,pipe,THREE,interior);
 serviceRobotCabinet(groups,data,pipe,THREE,interior);
 servicePower(groups.power.ground,data,pipe,THREE,interior);
 serviceExteriorPower(THREE,groups.power.ground,data,pipe,interior,site);
 return root;
}
