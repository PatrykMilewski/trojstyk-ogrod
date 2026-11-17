import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const load=source=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html=await readFile(new URL('../trzy-domy-3d/index.html',import.meta.url),'utf8');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'",`'${imports['three/core']}'`));
const marker='const [source,garden,house,neighbors]=';
const start=html.indexOf(marker)+marker.length;
const [,,,neighbors]=JSON.parse(html.slice(start,html.indexOf(';\nconst landscaping=',start)));
const house=neighbors.houses.find(h=>String(h.parcel)==='190');
const source=await readFile(new URL('../src/model/floryda-interior.js',import.meta.url),'utf8');
const data=JSON.parse(await readFile(new URL('../trzy-domy-3d/floryda-interior-data.json',import.meta.url),'utf8'));
const {addFlorydaInterior}=await load(source);
const {createWalkCollision,createWalkMotion}=await load(await readFile(new URL('../src/model/walk.js',import.meta.url),'utf8'));
const {navigation,localToWorld,group}=addFlorydaInterior({THREE,scene:new THREE.Scene(),house,data});
const inside=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const xy=p=>localToWorld(p).slice(0,2);
const upper=data.metadata.levels.upper;
const collisions=[0,upper].map(z=>createWalkCollision(navigation.obstacles.filter(o=>o.minZ<z+1.7-1e-6&&o.maxZ>z+1e-6)));
const grid=.12;
function reachable(level,start) {
 const z=level?upper:0,collision=collisions[level],nodes=new Map(),queue=[];
 const valid=p=>inside(p,data.exterior[level?'upper':'ground'])&&!collision.blocked(xy(p))&&(!level||navigation.floors.some(f=>f.z===upper&&inside(xy(p),f.ring)));
 const key=p=>p.join(',');
 const seed=[Math.round(start[0]/grid),Math.round(start[1]/grid)];
 assert(valid(seed.map(n=>n*grid)),`Invalid level${level} start ${seed.map(n=>n*grid)}`);
 nodes.set(key(seed),null);queue.push(seed);
 for(let i=0;i<queue.length;i++) {
  const p=queue[i];
  for(const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
   const q=[p[0]+d[0],p[1]+d[1]],k=key(q),point=q.map(n=>n*grid);
   if(nodes.has(k)||!valid(point)||collision.pathBlocked(xy(p.map(n=>n*grid)),xy(point)))continue;
   nodes.set(k,p);queue.push(q);
  }
 }
 return {nodes,queue};
}
const graph=[reachable(0,data.entry.position),reachable(1,[7.44,8.28])];
function routeTo(room) {
 const {nodes,queue}=graph[room.level],b=room.box;
 const candidates=queue.filter(p=>{const [x,y]=p.map(n=>n*grid);return x>b[0]+.05&&x<b[2]-.05&&y>b[1]+.05&&y<b[3]-.05;});
 assert(candidates.length,`Room${room.id} ${room.name} unreachable; target ${room.target}`);
 candidates.sort((a,b)=>Math.hypot(a[0]*grid-room.target[0],a[1]*grid-room.target[1])-Math.hypot(b[0]*grid-room.target[0],b[1]*grid-room.target[1]));
 const route=[];let p=candidates[0];while(p){route.push(p.map(n=>n*grid));p=nodes.get(p.join(','));}return route.reverse();
}
function follow(motion,route,z=0) {
 for(const p of route) {
  const target=localToWorld([p[0],p[1],p[2]??z]),current=motion.getState().position,dx=target[0]-current[0],dy=target[1]-current[1];
  motion.move(1,0,Math.hypot(dx,dy)/2.2,Math.atan2(dx,dy));
  const state=motion.getState();
  assert(Math.hypot(state.position[0]-target[0],state.position[1]-target[1])<.015,`Blocked actual route at ${p}: feet${state.floorHeightM}`);
  assert(Math.abs(state.floorHeightM-(p[2]??z))<.015,`Wrong actual floor ${p}: ${state.floorHeightM}`);
 }
}
const stairRoute=[[7.44,7.14,0],[7.82,7.14,0],[9.98,7.14,upper/2],[10.5,7.14,upper/2],[10.5,8.31,upper/2],[9.98,8.31,upper/2],[7.82,8.31,upper],[7.44,8.31,upper]];
test('source levels and all twenty one source rooms are pinned',()=>{
 assert.equal(data.rooms.length,21);assert.equal(upper,3.35);assert.equal(data.metadata.levels.upperCeiling-upper,2.6999999999999997);
 assert(data.furniture.every(f=>f.source.pixels.length===4&&f.source.position&&f.room&&Number.isFinite(f.angle)));
 assert.equal(group.name,'floryda-190-interior');
});
test('canonical footprint registers to existing world mesh without an extra mirror',()=>{
 const mesh=house.meshes.find(m=>m.id==='ground-storey'),actual=mesh.vertices.filter(p=>p[2]===0);
 for(const p of data.exterior.ground)assert(actual.some(q=>Math.hypot(...xy(p).map((v,i)=>v-q[i]))<.0002),`Unregistered footprint ${p}`);
 assert.equal(navigation.ceilingHeight([10000,10000]),Infinity);
});
for(const room of data.rooms)test(`source room${room.id} ${room.name} reachable from entry with actual motion`,()=>{
 const route=routeTo(room),motion=createWalkMotion(createWalkCollision([]),navigation);
 motion.reset(navigation.entry);
 if(room.level) {
  const approach=routeTo({id:'stairs',name:'stair approach',level:0,box:[7.3,6.99,7.6,7.28],target:[7.44,7.14]});
  follow(motion,approach);follow(motion,stairRoute);
 }
 follow(motion,route,room.level?upper:0);
});
test('actual eighteen rise stairs ascend and descend with clear headroom',()=>{
 const motion=createWalkMotion(createWalkCollision([]),navigation);motion.reset(localToWorld(stairRoute[0]));
 follow(motion,stairRoute);follow(motion,[...stairRoute].reverse());
});
test('upper slab pieces leave the complete stairwell open and retain head collision',()=>{
 const slabs=navigation.obstacles.filter(o=>o.kind==='slab');assert(slabs.length>2);
 for(const ramp of navigation.ramps)for(let i=1;i<10;i++) {
  const t=i/10,p=ramp.start.map((v,j)=>v+(ramp.end[j]-v)*t);assert(!slabs.some(s=>inside(p,s.ring)));
 }
});
test('furniture never obstructs a source doorway or open terrace half',()=>{
 const furniture=navigation.obstacles.filter(o=>o.kind==='furniture');
 const check=(a,b,o,z)=>{
  if(!o.open)return;
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),start=o.kind==='slider'?(o.start+o.end)/2:o.start,t=(start+o.end)/2;
  const p=xy([a[0]+dx/L*t,a[1]+dy/L*t]),n=xy([a[0]+dx/L*t-dy/L*.55,a[1]+dy/L*t+dx/L*.55]);
  const far=[p[0]*2-n[0],p[1]*2-n[1]];
  const collision=createWalkCollision(furniture.filter(f=>f.maxZ>z&&f.minZ<z+1.7),.22);
  assert(!collision.pathBlocked(n,far),`Furniture obstructs ${o.id}`);
 };
 for(const w of data.walls)for(const o of w.openings)check(w.a,w.b,o,w.level?upper:0);
 for(const o of data.openings) {const r=data.exterior[o.level?'upper':'ground'];check(r[o.segment],r[(o.segment+1)%r.length],o,o.level?upper:0);}
});
test('tall furniture stays clear of glazing and source exterior',()=>{
 const glass=navigation.obstacles.filter(o=>o.kind==='glass');
 for(const f of data.furniture.filter(f=>f.height>1.5)) {
  const z=f.level?upper:0,b=f.bounds;
  for(const p of [[b[0]+.08,b[1]+.08],[b[2]-.08,b[1]+.08],[b[2]-.08,b[3]-.08],[b[0]+.08,b[3]-.08]])assert(inside(p,data.exterior[f.level?'upper':'ground']),`Tall item outside source envelope: ${f.id}`);
  const collision=createWalkCollision(glass.filter(o=>o.minZ<z+f.height&&o.maxZ>z),.03);
  for(const p of [[b[0]+.04,b[1]+.04],[b[2]-.04,b[1]+.04],[b[2]-.04,b[3]-.04],[b[0]+.04,b[3]-.04]])assert(!collision.blocked(xy(p)),`Tall furniture overlaps glazing: ${f.id}`);
 }
});
function polygonPenetration(a,b) {
 let penetration=Infinity;
 for(const p of [a,b])for(let i=0;i<p.length;i++) {
  const q=p[(i+1)%p.length],dx=q[0]-p[i][0],dy=q[1]-p[i][1],L=Math.hypot(dx,dy),axis=[-dy/L,dx/L];
  const aa=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),bb=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);
  const overlap=Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb));
  if(overlap<=0)return 0;penetration=Math.min(penetration,overlap);
 }
 return penetration;
}
test('all furniture clears partition bodies within declared raster tolerance',()=>{
 const walls=navigation.obstacles.filter(o=>o.kind==='wall');
 for(const item of navigation.obstacles.filter(o=>o.kind==='furniture'))for(const wall of walls) {
  if(item.minZ>=wall.maxZ||item.maxZ<=wall.minZ)continue;
  assert(polygonPenetration(item.ring,wall.ring)<=.10,`${item.id} penetrates ${wall.id}`);
 }
});
test('both storeys and source furniture remain within the catalogue envelope',()=>{
 for(const polygon of [data.exterior.ground,data.exterior.upper])for(const [x,y] of polygon)assert(x>=0&&x<=15.5&&y>=0&&y<=17.66);
 for(const f of data.furniture)assert(f.bounds[0]>=0&&f.bounds[1]>=0&&f.bounds[2]<=15.5&&f.bounds[3]<=17.66);
});
test('published runtime embeds the checked Floryda renderer and its exact source data',()=>{
 assert(html.includes(source.replaceAll('export ','')),'Floryda renderer must match published runtime; rebuild model');
 const embedded=html.match(/const florydaData=(.*);\n/);assert(embedded,'Embedded Floryda source dimensions');
 assert.deepEqual(JSON.parse(embedded[1]),data,'Floryda data must match published runtime');
});

test('bathroom vanities have colliders and opposing dining chairs expose opposing backs',()=>{
 for(const id of ['ground-sink','master-vanity','shared-sink'])assert(navigation.obstacles.some(o=>o.id==='floryda-furniture-'+id));
 const left=data.furniture.find(f=>f.id==='dining-chair-0-500'),right=data.furniture.find(f=>f.id==='dining-chair-0-559');
 assert.equal(left.back,'yMax');assert.equal(right.back,'yMin');
 for(const f of [left,right]) {const back=group.getObjectByName('floryda-'+f.id+'-back');assert(back);assert.equal(back.position.y,f.back==='yMax'?f.bounds[3]-.035:f.bounds[1]+.035);}
});

test('retained tower cap is supported above the ceiling and room floor stays exposed',()=>{
 const t=data.towerAboveCeiling;assert.equal(t.bottom,data.metadata.levels.upperCeiling);assert.equal(t.top,6.98);
 for(let i=0;i<4;i++){const panel=group.getObjectByName('floryda-tower-above-ceiling-'+i);assert(panel);assert.equal(panel.position.z+panel.geometry.parameters.depth/2,t.top);}
 assert(data.metadata.excludedExistingMeshes.includes('ground-plinth'));assert(group.getObjectByName('floryda-plinth-0'));
});
