import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');
const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const html=await read('../trzy-domy-3d/index.html');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString().replaceAll("'three/core'","'"+imports['three/core']+"'"));
const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const {createIndoorServices}=await load(await read('../src/model/indoor-services.js'));
const model=createIndoorServices(THREE,null,data);
const at=name=>model.getObjectByName(name);
const nameOfFloor=item=>item.room.startsWith('1.')?'upper':'ground';
const inside=(x,y,rect)=>x>=rect[0]&&x<=rect[2]&&y>=rect[1]&&y<=rect[3];

test('services overlay starts hidden and exposes separate storeys and noninteractive systems',()=>{
 assert.equal(model.visible,false);
 assert.deepEqual(model.children.map(o=>o.name),['underfloor','heat-pump','water','sewer']);
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

test('radiant patches lie in heated spaces clear of fixed kitchen units, the stairwell and upper void',()=>{
 const circuits=[];
 model.traverse(o=>{if(o.userData.kind==='heating-loop')circuits.push(o);});
 assert(circuits.length>20);
 const island=data.furniture.find(o=>o.id==='kitchen-island').box;
 for(const loop of circuits){
  const {room,patch,length}=loop.userData,level=loop.parent.userData.level;
  const box=data.rooms.find(r=>r.id===room).box;
  assert(length>0&&length<95,loop.name);
  for(const x of [patch[0],patch[2]])for(const y of [patch[1],patch[3]]){
   assert(inside(x,y,box)||room==='1.4'&&inside(x,y,[6.16,8.03,9.8,9.23]),loop.name);
   assert(!inside(x,y,data.stairs.box),loop.name);
   if(level==='upper')assert(!inside(x,y,data.void.box),loop.name);
   if(room==='0.4')assert(!inside(x,y,island),loop.name);
  }
  assert.deepEqual(at(loop.name+'-supply').userData.to,loop.userData.from);
  assert.deepEqual(at(loop.name+'-return').userData.to,loop.userData.to);
 }
});

test('all sanitary fixtures connect to gravity drainage and the appropriate water supplies',()=>{
 const wet=data.furniture.filter(o=>['sink','basin','toilet','tub','shower','laundry-stack'].includes(o.type));
 assert(wet.length>=14);
 for(const item of wet){
  const cold=at(item.id+'-cold'),hot=at(item.id+'-hot'),drain=at(item.id+'-drain');
  assert(cold&&drain,item.id);
  assert.equal(cold.parent.userData.level,nameOfFloor(item));
  assert.equal(Boolean(hot),!['toilet','laundry-stack'].includes(item.type),item.id);
  assert(cold.userData.to[0]>=item.box[0]&&cold.userData.to[0]<=item.box[2],item.id);
  assert(drain.userData.from[2]>drain.userData.to[2],item.id);
 }
 assert.deepEqual(at('collector-to-exterior').userData.to,[8.74235626,4.20878006,-.72]);
 for(const name of ['monobloc-flow','monobloc-return','monobloc-control-cable']){
  const {from,to}=at(name).userData;
  assert(inside(...from.slice(0,2),data.outdoorHeatPump.box));
  assert(inside(...to.slice(0,2),data.furniture.find(f=>f.type==='hydrobox').box));
 }
});
