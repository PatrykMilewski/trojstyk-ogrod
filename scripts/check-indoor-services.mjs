import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const html=await read('../trzy-domy-3d/index.html');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString().replaceAll("'three/core'","'"+imports['three/core']+"'"));
const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const {createIndoorServices,createEthernetOutlets,createSoilVentSurface}=await load(await read('../src/model/indoor-services.js'));
const model=createIndoorServices(THREE,null,data);
const at=name=>model.getObjectByName(name);
const nameOfFloor=item=>item.room.startsWith('1.')?'upper':'ground';
const inside=(x,y,rect)=>x>=rect[0]&&x<=rect[2]&&y>=rect[1]&&y<=rect[3];

test('services overlay starts hidden and exposes separate storeys and noninteractive systems',()=>{
 assert.equal(model.visible,false);
 assert.deepEqual(model.children.map(o=>o.name),['underfloor','heat-pump','water','sewer','power','ethernet']);
 for(const system of model.children)assert.deepEqual(system.children.map(o=>o.userData.level),['ground','upper']);
 model.traverse(o=>{
  if(!o.geometry)return;
  assert.equal(o.material.depthTest,false);
  assert.equal(o.material.depthWrite,false);
  assert.deepEqual(new THREE.Raycaster().intersectObject(o,false),[]);
  o.geometry.computeBoundingSphere();
  assert(Number.isFinite(o.geometry.boundingSphere.radius),o.name);
 });
});

function pipeCenterline(mesh) {
 const pos=mesh.geometry.getAttribute('position'),path=[];
 for(let i=0;i<pos.count;i+=8){
  const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+4);
  path.push(a.lerp(b,.5));
 }
 return path;
}

function pointSegmentDistance(x,y,[ax,ay],[bx,by]) {
 const dx=bx-ax,dy=by-ay;
 const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}

function heatingIndex(level) {
 const segments=new Map(),size=.40,halo=.20;
 for(const loop of at('underfloor-'+level).children.filter(o=>o.userData.kind==='heating-loop')){
  const path=pipeCenterline(loop).map(p=>p.toArray());
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i];
   for(let x=Math.floor((Math.min(a[0],b[0])-halo)/size);x<=Math.floor((Math.max(a[0],b[0])+halo)/size);x++){
    for(let y=Math.floor((Math.min(a[1],b[1])-halo)/size);y<=Math.floor((Math.max(a[1],b[1])+halo)/size);y++){
     const key=x+','+y;
     if(!segments.has(key))segments.set(key,[]);
     segments.get(key).push([a,b]);
    }
   }
  }
 }
 return (x,y,tolerance=halo)=>(segments.get(Math.floor(x/size)+','+Math.floor(y/size))||[])
  .some(([a,b])=>pointSegmentDistance(x,y,a,b)<=tolerance);
}

function inPolygon(x,y,poly) {
 let result=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [a,b]=poly[i],[c,d]=poly[j];
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)result=!result;
 }
 return result;
}

function uncoveredFloorSamples(level,covered) {
 const upper=level==='upper',exterior=data.exterior[level],missing=[];
 const partitions=data.walls.filter(w=>Boolean(w.level)===upper);
 for(let x=.39;x<14.6;x+=.09)for(let y=.39;y<17.1;y+=.09){
  if(!inPolygon(x,y,exterior))continue;
  if(exterior.some((a,i)=>pointSegmentDistance(x,y,a,exterior[(i+1)%exterior.length])<=(upper?.36:.50)+.04))continue;
  if(partitions.some(w=>pointSegmentDistance(x,y,w.a,w.b)<=w.thickness/2+.035))continue;
  if(upper&&(inside(x,y,data.void.box)||inside(x,y,data.stairs.box)))continue;
  // The 14 cm rear slab lip between the stair opening and the gable lining has no return bend.
  if(upper&&x<data.stairs.box[2]&&y>=data.stairs.box[3])continue;
  if(!covered(x,y))missing.push([+x.toFixed(2),+y.toFixed(2)]);
 }
 return missing;
}

test('active heating pipe covers each finished floor, including stairs below, joinery and all wet rooms',()=>{
 for(const level of ['ground','upper']){
  const covered=heatingIndex(level),missing=uncoveredFloorSamples(level,covered);
  assert.equal(missing.length,0,level+' uncovered samples '+JSON.stringify(missing.slice(0,20)));
  const plan=at('service-plan-'+level),furnishings=at('service-furnishings-'+level);
  const backdrop=at('service-floor-backdrop-'+level);
  assert.equal(backdrop.visible,false);
  assert.equal(backdrop.position.z,data.levels[level]);
  assert(backdrop.material.opacity>.85&&backdrop.material.opacity<1&&backdrop.renderOrder<plan.renderOrder);
  const positions=backdrop.geometry.attributes.position,indices=backdrop.geometry.index;
  for(let i=0;i<indices.count;i+=3){
   const triangle=[0,1,2].map(k=>new THREE.Vector2().fromBufferAttribute(positions,indices.getX(i+k)));
   const center=triangle[0].clone().add(triangle[1]).add(triangle[2]).divideScalar(3);
   assert(inPolygon(center.x,center.y,data.exterior[level]));
   if(level==='upper')assert(!inside(center.x,center.y,data.stairs.box)&&!inside(center.x,center.y,data.void.box));
  }
  assert(furnishings.geometry.attributes.position.count>80);
  assert(furnishings.material.opacity<plan.material.opacity);
  for(const room of data.rooms.filter(r=>['0.7','1.2','1.6'].includes(r.id)&&nameOfFloor({room:r.id})===level)){
   const [w,s,e,n]=room.box;
   for(let x=w+.02;x<e;x+=.07)for(let y=s+.02;y<n;y+=.07)assert(covered(x,y,.12),room.id+' '+x+','+y);
  }
  for(const item of data.furniture.filter(f=>nameOfFloor(f)===level)){
   const [w,s,e,n]=item.box;
   for(const u of [.18,.5,.82])for(const v of [.18,.5,.82]){
    assert(covered(w+(e-w)*u,s+(n-s)*v),item.id+' '+u+' '+v);
   }
  }
 }
});

test('radiant loops and leads stay on their storey, connect to a port and include both tails in their length',()=>{
 const measured=path=>path.reduce((sum,p,i)=>i?sum+p.distanceTo(path[i-1]):sum,0);
 const served=new Set();
 for(const level of ['ground','upper']){
  const group=at('underfloor-'+level),circuits=group.children.filter(o=>o.userData.kind==='heating-loop');
  for(const loop of circuits){
   const {bank,room,length,activeLength}=loop.userData;
   served.add(room);
   const feed=at(loop.name+'-supply'),back=at(loop.name+'-return');
   assert.deepEqual(feed.userData.to,loop.userData.from);
   assert.deepEqual(back.userData.to,loop.userData.to);
   const paths=[loop,feed,back].map(pipeCenterline);
   assert(Math.abs(measured(paths[0])-activeLength)<.002,loop.name);
   assert(Math.abs(paths.reduce((sum,path)=>sum+measured(path),0)-length)<.005,loop.name);
   assert(length>20&&length<=90,loop.name);
   for(const [i,lead] of [feed,back].entries()){
    const bar=group.getObjectByName('manifold-'+bank+'-'+(i===0?.55:.38));
    const [x,y,z]=lead.userData.from;
    assert(x>bar.userData.from[0]&&x<bar.userData.to[0]);
    assert(Math.abs(y-bar.userData.from[1])<1e-8&&Math.abs(z-bar.userData.from[2])<1e-8);
   }
   for(const path of paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],steps=Math.ceil(a.distanceTo(b)/.06);
    for(let k=0;k<=steps;k++){
     const p=a.clone().lerp(b,steps?k/steps:0);
     assert(inPolygon(p.x,p.y,data.exterior[level]),loop.name);
     if(level==='upper')assert(!inside(p.x,p.y,data.stairs.box)&&!inside(p.x,p.y,data.void.box),loop.name);
    }
   }
  }
  for(const bar of group.children.filter(o=>o.userData.ports)){
   const matching=circuits.filter(o=>o.userData.bank===bar.userData.bank);
   assert.equal(bar.userData.ports,matching.length);
   assert(bar.userData.ports>=4&&bar.userData.ports<=10);
  }
 }
 assert.deepEqual([...served].sort(),data.rooms.map(r=>r.id).sort());
});

test('parallel manifold drops, supply and return tails keep at least the rendered pipe diameter apart',()=>{
 for(const level of ['ground','upper']){
  const segments=[];
  for(const mesh of at('underfloor-'+level).children.filter(o=>o.name.startsWith('floor-')&&/-(supply|return)$/.test(o.name))){
   const path=pipeCenterline(mesh);
   for(let i=1;i<path.length;i++){
    const a=path[i-1].toArray(),b=path[i].toArray();
    const axis=a.findIndex((v,k)=>Math.abs(v-b[k])>.06);
    if(axis<0||a.some((v,k)=>k!==axis&&Math.abs(v-b[k])>1e-5))continue;
    const lo=Math.min(a[axis],b[axis]),hi=Math.max(a[axis],b[axis]);
    const cross=a.filter((v,k)=>k!==axis);
    for(const s of segments){
     if(s.axis!==axis||s.name===mesh.name||Math.min(hi,s.hi)-Math.max(lo,s.lo)<.06)continue;
     const distance=Math.hypot(cross[0]-s.cross[0],cross[1]-s.cross[1]);
     assert(distance>=.024-1e-5,mesh.name+' overlaps '+s.name+' along axis '+axis+' gap '+distance);
    }
    segments.push({axis,lo,hi,cross,name:mesh.name});
   }
  }
  assert(segments.length>100);
 }
});

test('all sanitary fixtures connect to gravity drainage and the appropriate water supplies',()=>{
 const wet=data.furniture.filter(o=>['sink','basin','toilet','tub','shower','laundry-stack'].includes(o.type));
 assert(wet.length>=14);
 for(const item of wet){
  const cold=at(item.id+'-cold'),hot=at(item.id+'-hot'),drain=at(item.type==='laundry-stack'?'washer-drain':item.id+'-drain');
  assert(cold&&drain,item.id);
  assert.equal(cold.parent.userData.level,nameOfFloor(item));
  assert.equal(Boolean(hot),!['toilet','laundry-stack'].includes(item.type),item.id);
  assert(cold.userData.to[0]>=item.box[0]&&cold.userData.to[0]<=item.box[2],item.id);
  assert(drain.userData.from[2]>drain.userData.to[2],item.id);
 }
 const header=at('collector-to-exterior').userData;
 assert.deepEqual(header.to,[8.74235626,4.20878006,-.716596133]);
 assert(Math.abs((header.from[2]-header.to[2])/(header.from[1]-header.to[1])-.022)<1e-6);
});

function endpointNetwork(layer,include){
 const nodes=new Map(),key=p=>p.map(n=>n.toFixed(5)).join(',');
 layer.traverse(o=>{
  if(!o.userData.from||!include(o.name))return;
  const a=key(o.userData.from),b=key(o.userData.to);
  for(const [p,q] of [[a,b],[b,a]]){
   if(!nodes.has(p))nodes.set(p,new Set());
   nodes.get(p).add(q);
  }
 });
 return (from,to)=>{
  const reached=new Set([key(from)]);
  for(const p of reached)for(const q of nodes.get(p)||[])reached.add(q);
  return reached.has(key(to));
 };
}

test('monobloc connections descend at the exterior wall and cross the house below finished floor',()=>{
 const module=data.furniture.find(f=>f.type==='hydrobox'),[,,right,back]=module.box;
 for(const [i,name] of ['monobloc-flow','monobloc-return','monobloc-control-cable'].entries()){
  const mesh=at(name),{from,to}=mesh.userData,positions=mesh.geometry.attributes.position;
  assert(inside(...from.slice(0,2),data.outdoorHeatPump.box),name);
  assert.deepEqual(to,[right-[.13,.24,.56][i],back-.14,module.elevation+(i===2?.67:.40)]);
  assert.equal(from[2],[.671,.910,.79][i]);
  let checked=0,previous;
  for(let n=0;n<positions.count;n+=8){
   const row=new THREE.Vector3();
   for(let i=n;i<n+8;i++)row.add(new THREE.Vector3().fromBufferAttribute(positions,i));
   row.divideScalar(8);
   assert(row.z<=Math.max(from[2],to[2])+.001,name);
   if(previous){
    const midpoint=row.clone().lerp(previous,.5);
    if((midpoint.x>.6&&midpoint.x<4.4)||(midpoint.y>6.25&&midpoint.y<7.9)){assert(midpoint.z<0,name);checked++;}
   }
   previous=row;
  }
  assert(checked>0,name);
 }
});

test('each remote hot-water takeoff connects through a return header and the pump to the cylinder',()=>{
 const water=at('water'),supply=endpointNetwork(water,n=>n.includes('hot'));
 const returns=endpointNetwork(water,n=>n.includes('dhw-return-')||n.endsWith('-dhw-return')||n==='dhw-circulation-pump');
 const withoutPump=endpointNetwork(water,n=>n.includes('dhw-return-')||n.endsWith('-dhw-return'));
 const tankHot=at('cylinder-hot-union').userData.from,tankReturn=at('cylinder-return-union').userData.to;
 for(const [id,cluster] of [['kitchen-sink','kitchen'],['ground-bath','bath'],['bath-tub','family'],['laundry-sink','laundry'],['private-sink-two','suite']]){
  const takeoff=at(id+'-hot').userData.to,branch=at(cluster+'-dhw-return');
  assert.deepEqual(at(id+'-hot-tap').userData.from,takeoff);
  assert.deepEqual(branch.userData.from,takeoff);
  assert.equal(branch.parent.userData.level,nameOfFloor(data.furniture.find(f=>f.id===id)));
  assert(supply(tankHot,takeoff),id+' hot feed');
  assert(returns(takeoff,tankReturn),id+' return');
  assert(!withoutPump(takeoff,tankReturn),id+' bypass');
 }
 assert.deepEqual(at('cold-feed-to-cylinder').userData.to,at('cylinder-cold-union').userData.to);
 assert(at('cylinder-cold-union').userData.from[2]<tankReturn[2]&&tankReturn[2]<tankHot[2]);
});

test('washer and dryer condensate have separate appliance outlets, a common drain and no domestic hot feed',()=>{
 const washer=at('washer-drain'),dryer=at('dryer-condensate-drain'),stack=data.furniture.find(f=>f.id==='laundry-stack');
 for(const appliance of [washer,dryer]){
  const {from,to}=appliance.userData;
  assert(inside(from[0],from[1],stack.box));
  assert(from[2]>to[2]);
  assert.deepEqual(to,at('laundry-appliances-drain').userData.from);
 }
 assert(dryer.userData.from[2]>data.levels.upper+stack.height/2);
 assert(washer.userData.from[2]<data.levels.upper+stack.height/2);
 assert.deepEqual(at('laundry-appliances-drain').userData.to,at('laundry-stack-upper').userData.from);
 assert(at('laundry-stack-cold')&&!at('laundry-stack-hot'));
});

test('all foul-water stacks vent through a common open outlet above the actual roof triangle',()=>{
 const vents=endpointNetwork(at('sewer'),n=>n.includes('soil-vent')||n.includes('-stack-'));
 const top=at('soil-vent-to-roof').userData.to;
 for(const drain of ['kitchen-sink','ground-bath','bath-tub','laundry-appliances','private-sink-two']){
  assert(vents(at(drain+'-drain').userData.to,top),drain);
 }
 const marker='const [source,garden,house,neighbors]=',start=html.indexOf(marker)+marker.length;
 const [,,house]=JSON.parse(html.slice(start,html.indexOf(';\nconst landscaping=',start)));
 const {dimensions,matrix,translation}=house.metadata,u=dimensions.width-top[0];
 const point=matrix.map(([a,b],i)=>a*u+b*top[1]+translation[i]);
 const ray=new THREE.Ray(new THREE.Vector3(...point,20),new THREE.Vector3(0,0,-1)),hits=[];
 for(const face of house.meshes.filter(m=>m.kind==='roof'))for(const tri of face.faces){
  const vertices=tri.map(i=>new THREE.Vector3(...face.vertices[i]));
  const hit=ray.intersectTriangle(...vertices,false,new THREE.Vector3());
  if(hit)hits.push(hit.z);
 }
 assert(hits.length);
 const clearance=top[2]-Math.max(...hits);
 assert(clearance>.55&&clearance<.70,'roof clearance '+clearance);
 assert.deepEqual(at('soil-vent-open-outlet').userData.to,top);
});


test('eight Ethernet home runs connect physical rack ports to six rooms, the roof and the garage',async()=>{
 const outlets=createEthernetOutlets(THREE,data);
 const marker='const [source,garden,house,neighbors]=',start=html.indexOf(marker)+marker.length;
 const [,,house]=JSON.parse(html.slice(start,html.indexOf(';\nconst landscaping=',start)));
 const {addIconInterior}=await load(await read('../src/model/interior.js'));
 const interior=addIconInterior({THREE,scene:new THREE.Scene(),house,data});
 const roof=createSoilVentSurface(THREE,house,interior);
 const cables=at('ethernet').children.flatMap(o=>o.children).filter(o=>o.name.endsWith('-kabel')).sort((a,b)=>a.userData.port-b.userData.port);
 assert.deepEqual(cables.map(o=>o.userData.port),[1,2,3,4,5,6,7,8]);
 assert.deepEqual(cables.map(o=>o.userData.room),['0.4','0.8','0.9','1.1','1.3','1.8','dach','0.1']);
 const inPort=(device,port,p)=>{
  const mesh=interior.group.getObjectByName('utility-network-rack-rj45-'+device+'-'+(port-1));
  mesh.geometry.computeBoundingBox();mesh.updateMatrix();
  const socket=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix).expandByScalar(.00001);
  assert(socket.containsPoint(new THREE.Vector3(...p)),device+' port '+port+' vs '+p);
 };
 for(const cable of cables){
  const {outlet:id,port,from,to}=cable.userData;
  const patch=at('lan-'+id+'-patch'),riser=at('lan-'+id+'-pion');
  inPort(1,port,patch.userData.from);inPort(2,port,patch.userData.to);
  if(riser){
   assert.deepEqual(riser.userData.from,patch.userData.to);
   assert.deepEqual(riser.userData.to,from);
   assert(Math.abs(from[1]-6.66)<.13,'riser inside technical-room partition');
  }else assert.deepEqual(from,patch.userData.to);
  const socket=id==='dach-poe'?roof.getObjectByName('ethernet-roof-sealed-box'):outlets.getObjectByName('rj45-'+id);
  assert.deepEqual(to,socket.position.toArray());
 }
 const uplink=at('lan-switch-router-uplink').userData;
 inPort(1,16,uplink.from);inPort(0,1,uplink.to);
 const play=outlets.getObjectByName('rj45-bawialnia').position;
 assert(!inside(play.x,play.y,data.furniture.find(f=>f.id==='guest-wardrobe').box));
 assert(outlets.getObjectByName('rj45-pokoj-1').position.x-7.37>.081,'separate data and power faceplates');
 const point=outlets.getObjectByName('rj45-garaz').position,wall=data.walls.find(w=>w.id==='garage-back');
 assert.equal(point.y,wall.a[1]-wall.thickness/2);
 interior.group.add(outlets);interior.group.updateMatrixWorld(true);
 const outward=new THREE.Vector3(0,-1,0).transformDirection(interior.group.matrixWorld);
 const startAt=point.clone().applyMatrix4(interior.group.matrixWorld).addScaledVector(outward,.60);
 const ray=new THREE.Raycaster(startAt,outward.negate(),0,.64);
 const hits=ray.intersectObject(interior.group,true);
 assert.equal(hits[0]?.object.parent.name,'rj45-garaz','socket is visible from the garage');
 const backing=hits.find(h=>h.object.parent.name!=='rj45-garaz');
 assert(backing&&Math.abs(backing.distance-.60)<.004,'socket contacts finished garage wall');
 assert(wall.doors.every(([lo,hi])=>point.x+.04<wall.a[0]+lo||point.x-.04>wall.a[0]+hi));
 assert(point.x-.04>data.garageFitout.workbench.footprint[2]);
 for(const item of data.furniture.filter(f=>f.room==='0.1')){
  assert(point.x+.04<item.box[0]||point.x-.04>item.box[2]||point.z+.04<item.elevation||
   point.z-.04>item.elevation+item.height||point.y-item.box[3]>.60,'access clear of '+item.id);
 }
 const power=data.electrical.points.find(o=>o.room==='0.1'&&o.type==='socket');
 assert.equal(point.z,power.heightM);assert(Math.abs(point.x-power.alongM)>.085);
 const lan=pipeCenterline(at('lan-dach-poe-kabel')),wallUp=data.walls.find(w=>w.id==='u-room2-hall');
 const halfway=(data.levels.upper+data.levels.upperCeiling)/2;
 const i=lan.findIndex(p=>p.z>=halfway),rise=lan[i-1].clone().lerp(lan[i],(halfway-lan[i-1].z)/(lan[i].z-lan[i-1].z));
 assert(Math.abs(rise.x-wallUp.a[0])<.01&&wallUp.doors.every(([a,b])=>rise.y-wallUp.a[1]<a||rise.y-wallUp.a[1]>b));
});

test('battery DC and dedicated AC circuits reach the physical terminals and dishwasher plug',()=>{
 const equipment=id=>data.furniture.find(f=>f.id===id);
 const battery=equipment('utility-battery'),board=equipment('utility-distribution-board');
 const inverter=equipment('utility-pv-inverter'),charger=equipment('garage-wallbox');
 const pin=(item,id)=>{
  const [u,v,h]=item.ports[id],[,,e,n]=item.box;
  return [...(item.facing==='-x'?[e-v,item.box[1]+u]:[e-u,n-v]),(item.elevation||0)+h];
 };
 const cord=at('dishwasher-power-cord');
 for(const [id,from,to] of [
  ['battery-dc-positive',pin(battery,'positive'),pin(inverter,'batteryPlus')],
  ['battery-dc-negative',pin(battery,'negative'),pin(inverter,'batteryMinus')],
  ['inverter-ac-to-board',pin(inverter,'ac'),pin(board,'inverter')],
  ['distribution-board-to-wallbox',pin(board,'ev'),pin(charger,'ac')],
  ['distribution-board-to-dishwasher-socket',pin(board,'dishwasher'),cord.userData.from]
 ]){
  const mesh=at(id),path=pipeCenterline(mesh);
  assert.equal(mesh.parent,at('power-ground'));
  assert.deepEqual(mesh.userData.from,from);assert.deepEqual(mesh.userData.to,to);
  assert(path[0].distanceTo(new THREE.Vector3(...from))<1e-5);
  assert(path.at(-1).distanceTo(new THREE.Vector3(...to))<1e-5);
 }
 assert.equal(at('distribution-board-to-wallbox').userData.phases,3);
 assert.equal(at('battery-dc-positive').userData.voltage,51.2);
 const garageDoor=data.walls.find(w=>w.id==='garage-back');
 const bay=data.garageFitout.parkingBays[1],radius=.022;
 for(const p of pipeCenterline(at('distribution-board-to-wallbox'))){
  assert(p.y-radius>bay[3],'EV supply stays outside the parking bay');
  for(const [s,e] of garageDoor.doors){
   if(Math.abs(p.y-garageDoor.a[1])<garageDoor.thickness/2+radius && p.z<2.1)
    assert(p.x<garageDoor.a[0]+s-radius||p.x>garageDoor.a[0]+e+radius,'wire avoids door opening');
  }
 }
});

test('robot cabinet has a capped cold-water takeoff and a trapped drain returning to the kitchen collector',()=>{
 const cabinet=data.furniture.find(f=>f.robotCabinet),[west,back]=cabinet.box;
 const interior={group:new THREE.Group()};
 const network=createIndoorServices(THREE,interior,data),find=id=>network.getObjectByName(id);
 const valve=find('robot-isolation-valve'),trap=find('robot-capped-trap'),branch=find('robot-drain');
 assert.deepEqual(find('robot-cold-supply').userData.from,find('kitchen-feed-cold').userData.to);
 assert.deepEqual(find('robot-cold-supply').userData.to,valve.userData.from);
 assert.deepEqual(trap.userData.to,branch.userData.from);
 assert.deepEqual(branch.userData.to,find('kitchen-collector').userData.from);
 const path=pipeCenterline(branch);
 assert(path.every((p,i)=>!i||p.z<=path[i-1].z+.00001));
 for(const [id,point] of [['cold',valve.userData.to],['waste',trap.userData.from]]){
  const cap=interior.group.getObjectByName('robot-'+id+'-blanking-cap');
  assert(cap&&cap.position.distanceTo(new THREE.Vector3(...point))<.006);
  assert(point[0]>west+.02&&point[0]<west+.45&&point[1]>back+.018);
  assert(point[2]>.45&&point[2]<cabinet.robotCabinet.shelfHeightsM[0]);
 }
 const oldData={...data,furniture:data.furniture.map(f=>f===cabinet?{...f,robotCabinet:null}:f)};
 assert.equal(createIndoorServices(THREE,null,oldData).getObjectByName('robot-drain'),undefined);
});
