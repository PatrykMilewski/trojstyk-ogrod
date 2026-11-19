import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8').replaceAll("'three/core'", `'${imports['three/core']}'`));
const marker = 'const [source,garden,house,neighbors]=';
const start = html.indexOf(marker) + marker.length;
const [source, , house] = JSON.parse(html.slice(start, html.indexOf(';\nconst landscaping=', start)));
const { addIconInterior } = await load(await readFile(new URL('../src/model/interior.js', import.meta.url), 'utf8'));
const { joinIconStorySurfaces } = await load(await readFile(new URL('../src/model/story-joints.js', import.meta.url), 'utf8'));
const data = JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json', import.meta.url), 'utf8'));
const paving = [['driveway',.045],['entry',.08],['terrace',.08]]
 .map(([id,z])=>({ring:source.variants[0][id].coordinates[0],z}));
const scene=new THREE.Scene();
for(const spec of house.meshes.filter(m=>/^garden-pier-\d+-wall-\d+$/.test(m.id))){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(spec.vertices.flat(),3));
 const wall=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#343b35',side:THREE.DoubleSide}));wall.name=spec.id;scene.add(wall);
}
const interior = addIconInterior({ THREE, scene, house, data, exteriorPaving:paving, joinStory: joinIconStorySurfaces });
interior.group.updateMatrixWorld(true);
const object = name => { const mesh = interior.group.getObjectByName(name); assert(mesh, name); return mesh; };
const close = (a, b, message) => assert(Math.abs(a - b) < 1e-5, `${message}: ${a} versus ${b}`);
function hits(mesh, origin, direction, far = 1) {
  const ray = new THREE.Raycaster(new THREE.Vector3(...origin).applyMatrix4(interior.group.matrix), new THREE.Vector3(...direction).transformDirection(interior.group.matrix), 0, far);
  return ray.intersectObject(mesh, false);
}
function bounds(mesh) { mesh.updateMatrix(); mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix); }
const contains = (p, ring) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };

const opaque=interior.group.children.filter(o=>o.isMesh&&!(Array.isArray(o.material)?o.material.every(m=>m.transparent):o.material.transparent));
const samples=[['wing floor',[14.64,8,3.05],[1,0,0]],['wing corner',[14.64,12.55,1.1],[1,0,0]],['west floor',[0,5,3.05],[-1,0,0]],['upper finish',[0,5,3.208],[-1,0,0]]];
for(const [name,p,n] of samples)test(name+' has one charred exterior surface',()=>{
 const origin=p.map((v,i)=>v+n[i]*.2),direction=n.map(v=>-v),hitsAll=opaque.flatMap(m=>hits(m,origin,direction,.205).map(h=>({name:m.name,distance:h.distance,material:Array.isArray(m.material)?m.material[h.face.materialIndex].color.getHexString():m.material.color.getHexString()})));
 const unique=[...new Map(hitsAll.map(h=>[h.name+'|'+h.material,h])).values()];assert.equal(unique.length,1);assert.equal(unique[0].material,'343b35');
});

test('all exterior faces and convex corners have one visible cladding layer',()=>{
 const facades=[...data.facades.map(f=>({...f,low:.1,high:2.7})),
  {id:'front-gable',a:[0,0],b:[8.5,0],low:2.81,high:3.5},
  {id:'garden-gable',a:[0,18.13],b:[8.5,18.13],low:2.81,high:3.5},
  {id:'wing-gable',a:[14.64,4.21],b:[14.64,12.71],low:2.81,high:3.5},
  {id:'upper-main-side',a:[0,0],b:[0,18.13],low:2.81,high:3.9},
  {id:'upper-front-wing',a:[8.5,4.21],b:[14.64,4.21],low:2.81,high:3.9},
  {id:'upper-rear-wing',a:[8.5,12.71],b:[14.64,12.71],low:2.81,high:3.9},
  {id:'upper-garage-side',a:[8.5,0],b:[8.5,4.21],low:2.81,high:3.9},
  {id:'upper-terrace-side',a:[8.5,12.71],b:[8.5,18.13],low:2.81,high:3.9}];
 let checked=0;
 for(const f of facades){const dx=f.b[0]-f.a[0],dy=f.b[1]-f.a[1],L=Math.hypot(dx,dy),n=dx===0?[f.a[0]===0?-1:1,0,0]:[0,f.a[1]<5?-1:1,0];
  for(let u=.071;u<L;u+=.173)for(const z of [f.low,(f.low+f.high)/2,f.high,3.05,3.208].filter(z=>z>=f.low&&z<=f.high)){
   const p=[f.a[0]+dx*u/L,f.a[1]+dy*u/L,z],origin=p.map((v,k)=>v+n[k]*.2),d=n.map(v=>-v);
   const own=hits(object(f.id),origin,d,.205);if(!own.length)continue;
   const all=opaque.flatMap(m=>hits(m,origin,d,.205).map(h=>({name:m.name,material:Array.isArray(m.material)?m.material[h.face.materialIndex].color.getHexString():m.material.color.getHexString()})));
   const unique=[...new Map(all.map(h=>[h.name+'|'+h.material,h])).values()];
   assert.equal(unique.length,1,`${f.id} ${u},${z}: ${JSON.stringify(unique)}`);assert.equal(unique[0].material,'343b35',f.id);checked++;
  }
 }
 assert(checked>1000);
});
test('living-room transom is flush with both windows with no shelf or front wall band',()=>{
 const band=object('garden-window-transom'),glass=bounds(object('garden-gable-glass-0'));
 for(const x of [.8,1.1,3,4.25,7.5,7.7])for(const z of [2.4,2.6,2.79,2.9,3.15]){
  const hitsAll=opaque.flatMap(m=>hits(m,[x,19,z],[0,-1,0],2.3).map(h=>({...h,name:m.name}))).sort((a,b)=>a.distance-b.distance);
  assert(hitsAll.length,`Missing transom ${x},${z}`);assert.equal(hitsAll[0].name,band.name,`Projecting wall ${x},${z}`);
  const local=hitsAll[0].point.clone().applyMatrix4(interior.group.matrix.clone().invert());close(local.y,glass.max.y,'flush opaque connector');
 }
 assert(!interior.group.getObjectByName('garden-window-sill-recess'));
});

test('entry wall junctions retain their exposed inner end caps',()=>{
 for(const [name,p,d] of [
  ['facade-garage-side',[6.65,4.4,1],[0,-1,0]],
  ['facade-front-wing',[6.7,4.46,2.6],[1,0,0]],
  ['upper-garage-side',[8.3,4.4,3.6],[0,-1,0]],
  ['upper-front-wing',[8.3,4.4,3.6],[1,0,0]],
 ])assert(hits(object(name),p,d,.3).length,`${name}: exposed inner corner must remain closed`);
});

test('terrace and wing walls meet at a single right angle behind the staircase on both levels',()=>{
 for(const [rear,side,x,y,z] of [['facade-wing-rear','facade-terrace',8,12.21,1],['upper-rear-wing','upper-terrace-side',8.14,12.35,3.5]]){
  for(const offset of [.005,.12,.28,.51,.78]){
   close(hits(object(rear),[x+offset,y-.08,z],[0,1,0],.2)[0]?.distance,.08,'Continuous rear face');
   close(hits(object(side),[x-.08,y+offset,z],[1,0,0],.2)[0]?.distance,.08,'Continuous terrace face');
  }
  const inside=interior.localToWorld([x+.08,y+.08]);
  assert(interior.navigation.obstacles.some(o=>o.minZ<z&&o.maxZ>z&&contains(inside,o.ring)));
 }
});

test('inner wall faces end at their inner corner rather than crossing the outer cladding',()=>{
 for(const [name,x,minY,maxY] of [['wing-gable',14.28,4.57,12.35],['facade-wing-end',14.16,4.69,12.23],['upper-main-side',.36,.36,17.77]]){
  const mesh=object(name),p=mesh.geometry.attributes.position,ys=[];
  for(const group of mesh.geometry.groups.filter(g=>g.materialIndex!==1))for(let i=group.start;i<group.start+group.count;i+=3){
   if([0,1,2].every(j=>Math.abs(p.getX(i+j)-x)<1e-5))for(let j=0;j<3;j++)ys.push(p.getY(i+j));
  }
  assert(ys.length,name);assert(Math.min(...ys)>=minY-1e-5,`${name} start crosses neighboring facade`);assert(Math.max(...ys)<=maxY+1e-5,`${name} end crosses neighboring facade`);
 }
});

test('the exterior wall changes finish at exactly 300 mm and preserves every full-height opening',()=>{
 for(const face of data.facades){
  const wall=object(face.id),vertical=face.a[0]===face.b[0],normal=vertical?[face.a[0]===0?-1:1,0,0]:[0,face.a[1]<5?-1:1,0];
  const sample=(u,z)=>hits(wall,[face.a[0]+(vertical?0:u)+normal[0]*.15,face.a[1]+(vertical?u:0)+normal[1]*.15,z],normal.map(v=>-v),.151);
  for(let u=.073;u<Math.hypot(face.b[0]-face.a[0],face.b[1]-face.a[1]);u+=.143){
   const low=sample(u,.299),high=sample(u,.301);
   if(face.openings.some(o=>o.bottom===0&&u>o.start&&u<o.end)){assert.equal(low.length,0);continue;}
   assert.equal(wall.material[low[0].face.materialIndex].name,'Black porcelain plinth');
   assert.equal(wall.material[high[0].face.materialIndex].color.getHexString(),'343b35');
   assert.notEqual(low[0].face.materialIndex,high[0].face.materialIndex);
  }
 }
});

test('a single metric basalt bed wraps both re-entrant corners and meets the existing hard surfaces',()=>{
 const apron=object('icon-basalt-apron');
 assert.deepEqual(apron.material.userData.gradingMm,[16,30]);
 assert.equal(apron.material.userData.textureExtentM,.48);
 const sample=(x,y)=>hits(apron,[x,y,1],[0,0,-1],1);
 for(const [x,y,dx,dy] of [[2,0,0,-1],[6.9,2,1,0],[11,4.21,0,-1],[14.64,10,1,0],[11,12.71,0,1],[8.5,14.5,1,0],[5,17.09,0,1],[0,3,-1,0]]){
  assert.equal(sample(x-dx*.001,y-dy*.001).length,0);
  assert(sample(x+dx*.599,y+dy*.599).length);
  assert.equal(sample(x+dx*.601,y+dy*.601).length,0);
 }
 for(const [x,y,z] of [[3,-.26,.047],[7.20,4.02,.082],[10.7,13,.082],[-.25,8,.071],[8.85,13.04,.082]]){
  const hit=sample(x,y)[0];assert(hit);close(hit.point.z,z,'apron surface');
 }
 for(const [x,y] of [[.32,18.729],[8.08,18.729],[1.339,17.96],[7.161,17.96]])assert(sample(x,y).length,`rear pier at ${x},${y}`);
 for(const [x,y] of [[.32,18.731],[8.08,18.731],[.32,17.55],[8.08,17.55],[1.341,17.96],[7.159,17.96]])assert.equal(sample(x,y).length,0);
 for(const id of [0,1]){
  const wall=scene.getObjectByName('garden-pier-'+id+'-wall-1'),x=id===0?.32:8.08;
  for(const [z,expected] of [[.299,0],[.301,1]]){
   const intersect=hits(wall,[x,18.33,z],[0,-1,0],.201);
   assert.equal(intersect[0].face.materialIndex,expected);
   assert.equal(wall.material[0].name,'Black porcelain plinth');
  }
 }
 assert(!interior.navigation.obstacles.some(o=>o.id.includes('apron')));
});

test('every installed exterior sconce can switch the same lightmaps after batching, with automatic dusk and dawn',async()=>{
 const {batchStaticInteriorDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
 const circuit=interior.exteriorLights,apron=object('icon-basalt-apron');
 circuit.prepare();batchStaticInteriorDetails(THREE,interior.group);
 const fixtures=interior.group.children.filter(o=>o.name.startsWith('icon-exterior-sconce-'));
 assert.equal(fixtures.length,9);
 const mats=fixtures.map(root=>root.children.at(-1).material);
 const receivers=[apron.material,...object('facade-garage').material.filter(m=>m.lightMap)];
 assert.equal(receivers.length,3);
 for(const material of receivers){
  const map=material.lightMap;assert.equal(map.channel,1);
  assert(map.image.data.some((v,i)=>i%4===0&&v>35),'irradiance reaches the surface');
 }
 const camera=new THREE.PerspectiveCamera(48,1,.04,80);camera.up.set(0,0,1);
 const verify=on=>{
  assert.equal(circuit.isOn,on);
  for(const surface of receivers)assert.equal(surface.lightMapIntensity,on?24:0);
  for(const diffuser of mats)assert.equal(diffuser.emissiveIntensity>0,on);
 };
 circuit.update(32);verify(false);circuit.update(-8);verify(true);
 for(const root of fixtures){
  camera.position.copy(root.localToWorld(new THREE.Vector3(0,.82,0)));
  camera.lookAt(root.localToWorld(new THREE.Vector3(0,.115,0)));camera.updateProjectionMatrix();
  const wasOn=circuit.isOn;
  assert(circuit.toggleAt(new THREE.Vector2(0,0),camera),root.name);verify(!wasOn);
  circuit.update(-12);verify(!wasOn);
 }
 circuit.update(14);verify(false);
 assert.equal(circuit.toggleAt(new THREE.Vector2(0,0),camera),false);verify(false);
 circuit.update(16);verify(false);circuit.update(-11);verify(true);
 camera.position.copy(interior.group.localToWorld(new THREE.Vector3(1,.85,1.89)));
 camera.lookAt(object('icon-exterior-sconce-garage-0.51').localToWorld(new THREE.Vector3(0,.115,0)));
 assert.equal(circuit.toggleAt(new THREE.Vector2(0,0),camera),false,'opaque wall occludes the exterior control');verify(true);
});

test('grazing light crosses the storey joint on each aligned timber plane and fades above the lamps',()=>{
 if(!object('icon-basalt-apron').material.lightMap)interior.exteriorLights.prepare();
 function irradianceAt(name,x,y,z,nx,ny){
  const wall=object(name),hit=hits(wall,[x+.12*nx,y+.12*ny,z],[-nx,-ny,0],.125)[0];
  assert(hit,name);assert.equal(hit.face.materialIndex,1);
  const map=wall.material[1].lightMap,{width,height,data}=map.image;
  const tx=hit.uv1.x*width-.5,ty=hit.uv1.y*height-.5,i=Math.floor(tx),j=Math.floor(ty);
  const sample=(dx,dy)=>data[4*((j+dy)*width+i+dx)];
  const lerp=(a,b,t)=>a+(b-a)*t;
  return lerp(lerp(sample(0,0),sample(1,0),tx-i),lerp(sample(0,1),sample(1,1),tx-i),ty-j);
 }
 for(const [lower,upper,x,y,nx,ny] of [
  ['facade-garage','front-gable',6.51,0,0,-1],['facade-front-wing','upper-front-wing',11.11,4.21,0,-1],
  ['facade-wing-end','wing-gable',14.64,6.46,1,0],['facade-main-side','upper-main-side',0,2.75,-1,0],
  ['facade-wing-rear','upper-rear-wing',12.74,12.71,0,1],['facade-terrace','upper-terrace-side',8.5,13.32,1,0]
 ]){
  const below=irradianceAt(lower,x,y,2.799,nx,ny),above=irradianceAt(upper,x,y,2.801,nx,ny);
  const shoulder=irradianceAt(upper,x,y,3.08,nx,ny),tail=irradianceAt(upper,x,y,3.56,nx,ny);
  assert(below>7&&Math.abs(below-above)<.2,upper+' must continue its ground-floor light field');
  assert(above>shoulder&&shoulder>tail&&tail>0,upper+' fades gradually');
  assert(!object(upper).material[0].lightMap,'inside face remains unlit');
 }
 for(const id of ['front-gable-glass-0','wing-gable-glass-0','garden-gable-glass-0'])
  assert.equal(object(id).material.lightMap,null,'transparent glazing receives no facade bake');
 for(const id of ['garden-gable','upper-garage-side'])
  assert.equal(object(id).material[1].lightMap,null,'projected upper facade is outside the lower plane');
});
