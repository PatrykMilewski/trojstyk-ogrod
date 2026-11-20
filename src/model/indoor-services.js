// Patches show the heated parts of the Icon screed, clear of built-ins, stairs and the double-height void.
const iconHeatingPatches = [
 ['0.1',.70,.75,3.33,6.29,.25], ['0.1',3.55,.75,6.24,6.29,.25],
 ['0.3',4.57,6.95,6.06,7.79], ['0.4',.71,9.49,5.91,10.12],
 ['0.4',.71,10.33,1.88,11.55], ['0.4',6.15,9.47,7.77,11.55],
 ['0.4',.72,11.76,3.00,16.36], ['0.4',3.22,11.76,5.37,16.36], ['0.4',5.59,11.76,7.76,16.36],
 ['0.5',6.92,8.49,10.99,9.02], ['0.6',6.81,4.91,10.35,5.48], ['0.6',6.81,5.70,7.94,7.66],
 ['0.7',9.52,7.10,10.32,7.66,.12], ['0.8',11.88,4.94,13.09,8.99],
 ['0.8',13.30,7.38,13.91,8.99], ['0.9',10.02,9.89,13.93,12.03],
 ['1.1',.72,.72,4.05,3.38], ['1.1',4.27,1.30,7.78,3.38],
 ['1.2',1.59,4.80,4.56,5.45,.12], ['1.3',.74,6.57,3.94,9.37],
 ['1.3',4.15,6.00,4.56,7.88], ['1.4',5.13,3.98,5.94,9.96],
 ['1.4',6.19,8.20,9.58,9.00], ['1.5',6.52,5.76,8.54,7.00],
 ['1.6',9.14,6.61,10.85,7.66,.12], ['1.7',12.51,5.34,13.33,7.66],
 ['1.8',10.16,8.28,13.92,12.00],
];

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

function serviceHeatingCircuit({pipe,group,base},patch,index,port) {
 const [room,x0,y0,x1,y1,pitch=.18]=patch;
 const legCount=Math.max(2,2*Math.round(((x1-x0)/pitch+1)/2));
 const z=base-.055,coil=[];
 for(let leg=0;leg<legCount;leg++){
  const x=leg===legCount-1?x1:x0+leg*(x1-x0)/(legCount-1);
  coil.push([x,leg%2?y1:y0,z],[x,leg%2?y0:y1,z]);
 }
 const [px,py]=port, branch='floor-'+room+'-'+index;
 const upper=room[0]==='1', originY=upper?7.13:8.14;
 // Leads run in an insulated bundle below the active loops; the east wing passes south of the stairwell.
 const lane=originY-.016*index;
 function lead(x,side,barZ){
  const ly=y0-.09-side*.035, tx=px+.017*side, level=base-.10-.024*side;
  const route=[[px,py,barZ],[tx,py+.06,level],[tx,lane,level],[x,lane,level],[x,ly,level],[x,y0,z]];
  return route;
 }
 pipe(group,branch+'-supply',lead(x0,0,base+.55),iconServiceColors.floor,.012);
 const length=coil.reduce((sum,p,i)=>sum+(i?Math.hypot(p[0]-coil[i-1][0],p[1]-coil[i-1][1]):0),0);
 pipe(group,branch,coil,iconServiceColors.floor,.015,{kind:'heating-loop',room,length,patch:[x0,y0,x1,y1]});
 pipe(group,branch+'-return',lead(x1,1,base+.38),iconServiceColors.return,.012);
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
 ring.forEach((p,i)=>outline.segment(p,ring[(i+1)%ring.length]));
 outline.finish();
}

function serviceOutlineLines(THREE,group,base) {
 const points=[];
 return {
  segment(a,b){points.push(...a,base,...b,base);},
  finish(){
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
   const material=new THREE.LineBasicMaterial({color:'#f4e9ce',transparent:true,opacity:.68,depthTest:false,depthWrite:false,toneMapped:false});
   const lines=new THREE.LineSegments(geometry,material);
   lines.name='service-plan-'+group.userData.level;
   lines.renderOrder=231;lines.raycast=()=>{};group.add(lines);
  }
 };
}

function serviceUnderfloor(THREE,levels,data,pipe) {
 for(const [level,roomPrefix] of [['ground','0'],['upper','1']]){
  const base=data.levels[level],group=levels[level],patches=iconHeatingPatches.filter(p=>p[0][0]===roomPrefix);
  servicePlanOutline(THREE,group,data,level);
  const [x,y]=level==='upper'?[6.31,8.00]:[5.30,8.28];
  const count=level==='upper'?patches.length:8;
  for(let i=0;i<patches.length;i+=count){
   const bank=Math.floor(i/count),cx=x+bank*.50,n=Math.min(patches.length-i,count),spacing=.051;
   for(const [color,barZ] of [[iconServiceColors.floor,.55],[iconServiceColors.return,.38]]){
    pipe(group,'manifold-'+bank+'-'+barZ,[[cx,y,base+barZ],[cx+n*spacing,y,base+barZ]],color,.033);
    const fromX=5.11-(barZ===.55?.13:0),feedY=8.17-(barZ===.55?.05:0);
    const pump=[[fromX,8.25,.8],[fromX,feedY,.73]];
    const riserX=6.35-(barZ===.55?.055:0);
    if(level==='upper'){
     pipe(levels.ground,'upper-heating-riser-'+barZ,[...pump,[riserX,feedY,.73],[riserX,7.84,.73],[riserX,7.84,2.8]],color,.022);
     pipe(group,'upper-heating-collector-'+barZ,[[riserX,7.84,2.8],[riserX,7.84,base+barZ],[cx,7.84,base+barZ],[cx,y,base+barZ]],color,.022);
    } else pipe(group,'manifold-feed-'+bank+'-'+barZ,[...pump,[cx,feedY,base+barZ],[cx,y,base+barZ]],color,.022);
   }
   for(let k=0;k<n;k++)serviceHeatingCircuit({pipe,group,base},patches[i+k],i+k,[cx+(k+.5)*spacing,y]);
  }
 }
}

function servicePump(group,data,pipe) {
 const [,,wallX]=data.outdoorHeatPump.box,wallY=data.outdoorHeatPump.box[1]+1.017;
 const [,,moduleRight,moduleBack]=data.furniture.find(f=>f.id==='heat-pump-module').box;
 for(const [i,color,z] of [[0,iconServiceColors.pump,.671],[1,iconServiceColors.pumpReturn,.910],[2,iconServiceColors.cable,.79]]){
  const y=wallY+.05*i,techY=moduleBack-.05-.062*i,portX=moduleRight-[.13,.24,.47][i];
  const route=[[wallX-.556,wallY,z],[wallX,wallY,z],[.23,y,z],[.23,y,2.51+.035*i],
   [.23,techY,2.51+.035*i],[portX,techY,2.51+.035*i],[portX,techY,.80],[portX,moduleBack-.14,.80]];
  pipe(group,['monobloc-flow','monobloc-return','monobloc-control-cable'][i],route,color,i===2?.014:.027);
 }
}

const iconWetGroups=[
 {id:'kitchen',level:'ground',stack:[4.12,8.49],items:['kitchen-sink']},
 {id:'bath',level:'ground',stack:[8.58,6.45],items:['ground-bath','ground-wc','ground-shower']},
 {id:'family',level:'upper',stack:[3.72,6.74],items:['upper-bath','upper-wc','bath-tub','upper-shower']},
 {id:'laundry',level:'upper',stack:[6.39,7.80],items:['laundry-sink','laundry-stack']},
 {id:'suite',level:'upper',stack:[8.58,6.45],items:['private-shower','private-wc','private-sink-one','private-sink-two']},
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

function serviceWater(levels,data,pipe) {
 const meter=[3.939,7.33,.805],soft=[3.939,7.112,.893],tank=[4.14,8.06,1.57],hub=[4.55,8.16];
 const colors=iconServiceColors;
 pipe(levels.ground,'meter-to-softener',[meter,[meter[0],soft[1],meter[2]],soft],colors.cold,.021);
 pipe(levels.ground,'softener-to-distributor',[soft,[soft[0],soft[1],.34],[soft[0],hub[1],.34],[...hub,.34]],colors.cold,.021);
 pipe(levels.ground,'cold-feed-to-cylinder',[[...hub,.34],[4.34,hub[1],.34],[4.34,8.06,.34],[4.34,8.06,1.57]],colors.cold,.021);
 pipe(levels.ground,'cylinder-to-hot-distributor',[tank,[tank[0],hub[1]-.055,tank[2]],[hub[0],hub[1]-.055,tank[2]],[hub[0],hub[1]-.055,.42]],colors.hot,.021);
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
    pipe(group,id+'-'+kind,[node,[sx,sy+off,runZ],[p[0],sy+off,runZ],[p[0],y,runZ],p],color,.018,{fixture:id});
   }
  }
 }
}

const iconSewerExit=[8.74235626,4.20878006,-.72];

function serviceSewerVent(group,data,pipe) {
 const z=data.levels.upper-.26, junctionY=7.77, bottom=5.33;
 for(const {id,stack:[x,y]} of iconWetGroups.filter(c=>c.level==='upper')){
  const join=bottom+.015*Math.abs(junctionY-y)+.012*Math.abs(4.25-x);
  pipe(group,id+'-soil-vent',[[x,y,z],[x,y,bottom],[x,junctionY,join-.012*Math.abs(4.25-x)],[4.25,junctionY,join]],iconServiceColors.sewer,.045);
 }
 pipe(group,'soil-vent-to-roof',[[4.25,junctionY,bottom],[4.25,junctionY,data.levels.ridge+.45]],iconServiceColors.sewer,.055);
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
  if(level==='upper'){
   pipe(levels.ground,cluster.id+'-stack-lower',[[sx,sy,2.8],[sx,sy,joinZ]],iconServiceColors.sewer,.055);
   pipe(levels.upper,cluster.id+'-stack-upper',[[sx,sy,stackZ],[sx,sy,2.8]],iconServiceColors.sewer,.055);
  }
  for(const id of cluster.items){
   const item=data.furniture.find(f=>f.id===id),{waste}=serviceFixture(item,base);
   const [x,y]=waste,midZ=stackZ+Math.abs(sy-y)*slope,branchZ=midZ+Math.abs(x-sx)*slope;
   pipe(levels[level],id+'-drain',[waste,[x,y,branchZ],[sx,y,midZ],[sx,sy,stackZ]],iconServiceColors.sewer,item.type==='toilet'?.052:.032,{fixture:id});
  }
 }
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
