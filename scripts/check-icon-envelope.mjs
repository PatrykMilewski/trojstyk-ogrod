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
 .map(([id,z])=>({id,ring:source.variants[0][id].coordinates[0],z}));
const scene=new THREE.Scene();
for(const {id,ring,z} of paving){
 const deck=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(ring.map(p=>new THREE.Vector2(...p)))),new THREE.MeshStandardMaterial({side:THREE.DoubleSide}));
 deck.name='surface-'+id;deck.position.z=z;scene.add(deck);
}
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
   assert.equal(unique.length,1,`${f.id} ${u},${z}: ${JSON.stringify(unique)}`);assert.equal(unique[0].material,f.id==='facade-garden'&&z>=.30?'121314':'343b35',f.id);checked++;
  }
 }
 assert(checked>1000);
});
test('garden recess shares the exterior timber scan while its black glazing trim stays smooth',async()=>{
 const boards=object('garden-gable').material[1],frame=object('facade-garden').material[1];
 assert.equal(boards.userData.surfaceProfile,'facade');
 assert.equal(object('garden-gable-reveal-0').material,boards);
 assert.equal(frame.userData.surfaceProfile,'blackGlazing');
 for(const name of ['living-slider-head','garden-gable-opening-0-frame-1','facade-garden-opening-0-frame-1','garden-upper-triangle-mullion-3.1']){
  assert.equal(object(name).material,frame,name);
 }
 assert.equal(object('garden-window-transom').material[1],frame);
 const {applyRealisticSurfaces}=await load(await readFile(new URL('../src/model/surface-realism.js',import.meta.url),'utf8'));
 const group=new THREE.Group();group.name='icon-193-interior';
 const reveal=object('garden-gable-reveal-0').clone(),band=object('garden-window-transom').clone();
 group.add(reveal,band);
 const images=await Promise.all(['.webp','-relief.webp'].map(async suffix=>{
  const bytes=await readFile(new URL('../src/model/surface-scans/icon_charred_boards'+suffix,import.meta.url));
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  return 'data:image/webp;base64,'+bytes.toString('base64');
 }));
 class Loader{async loadAsync(url){assert(images.includes(url));return new THREE.Texture();}}
 await applyRealisticSurfaces({THREE:{...THREE,TextureLoader:Loader},scene:group,mats:{},
  renderer:{capabilities:{getMaxAnisotropy:()=>4}},scans:{iconCharredBoards:images}});
 assert.equal(reveal.material.name,'iconCharredBoards');
 assert(reveal.material.map && reveal.material.bumpMap && reveal.geometry.getAttribute('uv'));
 assert.equal(band.material[1],frame);
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
   assert.equal(wall.material[high[0].face.materialIndex].color.getHexString(),face.id==='facade-garden'?'121314':'343b35');
   assert.notEqual(low[0].face.materialIndex,high[0].face.materialIndex);
  }
 }
});

test('the 60 cm basalt bed has a 55 mm charcoal curb only along exposed garden edges',()=>{
 const apron=object('icon-basalt-apron'),curb=object('icon-basalt-curb');
 assert.deepEqual(apron.material.userData.gradingMm,[16,30]);
 assert.equal(apron.material.userData.textureExtentM,.48);
 close(curb.userData.widthM,.055,'edging width');
 const sample=(mesh,x,y)=>hits(mesh,[x,y,1],[0,0,-1],1);
 for(const [x,y,dx,dy] of [[0,3,-1,0],[.1,0,0,-1],[11,4.21,0,-1],[14.64,6,1,0],[0,17.9,-1,0]]){
  const at=(mesh,r)=>sample(mesh,x+dx*r,y+dy*r);
  assert.equal(at(apron,-.001).length,0);
  close(at(apron,.599)[0]?.point.z,.071,'pebble edge');
  assert.equal(at(apron,.601).length,0);assert.equal(at(curb,.599).length,0);
  for(const d of [.601,.654])close(at(curb,d)[0]?.point.z,.080,'curb cap');
  assert.equal(at(curb,.656).length,0);
 }
 const crossed=[[3,0,0,-1],[6.9,2,1,0],[7.4,4.21,0,-1],[14.64,9,1,0],
  [11,12.71,0,1],[8.5,15.4,1,0],[5,17.09,0,1],[.32,18.13,0,1],[8.08,18.13,0,1]];
 for(const [x,y,dx,dy] of crossed)for(const r of [.001,.26,.599,.601,.654])
  for(const mesh of [apron,curb])assert.equal(sample(mesh,x+dx*r,y+dy*r).length,0,`${mesh.name} at ${x},${y} + ${r}`);
 for(const [x,y] of [[8.85,13.04],[1.3,17.96],[7.2,17.96],[.75,17.11],[7.75,17.11]])
  for(const mesh of [apron,curb])assert.equal(sample(mesh,x,y).length,0,'clear terrace corner');
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

test('the rear deck stays level between the piers and its threshold discharges into a continuous slot',()=>{
 const deck=scene.children.find(mesh=>mesh.userData.kind==='icon-garden-threshold');
 const drain=scene.getObjectByName('icon-garden-slot-drain'),sill=scene.getObjectByName('icon-garden-sill');
 const at=(mesh,x,y)=>hits(mesh,[x,y,1],[0,0,-1],1);
 for(const x of [.742,1.01,3.7,7.49,7.758])for(const y of [17.091,17.45,17.99,18.129])
  close(at(deck,x,y)[0]?.point.z,.080,`level pier-to-pier deck ${x},${y}`);
 for(const x of [1.0002,1.8,4.25,7.4998]){
  const line=(mesh,y)=>at(mesh,x,y)[0]?.point.z;
  close(line(deck,17.089),.080-.066*.001/.192,'outer end of reveal');
  close(line(deck,16.899),.014+.066*.001/.192,'deck drains to slot');
  close(line(drain,16.896),.014,'outer lip');
  close(line(drain,16.886),.003,'open slot floor');
  close(line(drain,16.877),.014,'inner lip');
  close(line(sill,16.851),.018-.004*.001/.024,'sill falls outward to drain');
  for(const y of [16.876,16.886,16.894])assert.equal(at(deck,x,y).length,0,'boards leave the drain unobstructed');
 }
 for(const x of [3.22,4.25,5.27])close(at(sill,x,16.804)[0]?.point.z,.018,'sill clears the sliding shoe');
 for(const [x,y] of [[4.25,16.78],[1.4,16.84],[4.25,18.132],[.738,17.6],[7.762,17.6],[.95,16.99]])
  for(const mesh of [deck,sill,drain])assert.equal(at(mesh,x,y).length,0,`clear frame, pier, wall and adjoining deck at ${x},${y}`);
});

test('all seven flush uplights follow the finished grade and share dusk, dawn and tap controls after batching',async()=>{
 const {batchStaticInteriorDetails,batchStaticDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
 const circuit=interior.exteriorLights,apron=object('icon-basalt-apron');
 circuit.prepare();batchStaticInteriorDetails(THREE,interior.group);
 const fixtures=interior.group.children.filter(o=>o.name.startsWith('icon-exterior-uplight-'));
 assert.equal(fixtures.length,7);
 for(const id of ['wing-rear-4.24','terrace-0.61'])assert(!interior.group.getObjectByName('icon-exterior-uplight-'+id));
 assert(!interior.group.children.some(o=>o.name.includes('exterior-sconce')));
 batchStaticDetails(THREE,fixtures);
 const pendants=interior.group.children.filter(o=>o.name.startsWith('icon-terrace-pendant-'));
 assert.equal(pendants.length,2);
 const mats=[...fixtures.map(root=>root.getObjectByName('uplight-aperture').material),...pendants.map(root=>root.getObjectByName('pendant-diffuser').material)];
 const receivers=object('facade-garage').material.filter(m=>m.lightMap);
 assert.equal(receivers.length,2);
 for(const ground of [apron,...scene.children.filter(o=>o.name.startsWith('surface-'))])
  assert.equal(ground.material.lightMap,null,ground.name+' receives no downward beam');
 assert(receivers.every(m=>m.lightMap.channel===1));
 const camera=new THREE.PerspectiveCamera(48,1,.04,80);camera.up.set(0,0,1);
 const viewport={clientWidth:400,clientHeight:400};
 const verify=on=>{
  assert.equal(circuit.isOn,on);
  assert(pendants.every(root=>root.getObjectByName('terrace-downlight').visible===on));
  for(const surface of receivers)assert.equal(surface.lightMapIntensity,on?24:0);
  for(const diffuser of mats)assert.equal(diffuser.emissiveIntensity>0,on);
 };
 circuit.update(32);verify(false);circuit.update(-8);verify(true);
 for(const root of fixtures){
  const {x,y,z}=root.position;
  const surfaceHits=[apron,...scene.children.filter(o=>o.name.startsWith('surface-'))]
   .flatMap(m=>hits(m,[x,y,1],[0,0,-1],1)).sort((a,b)=>a.distance-b.distance);
  close(z,surfaceHits[0]?.point.z,root.name+' installed at finish');
  const shell=root.children.find(m=>m.name!=='uplight-aperture'),shellBounds=bounds(shell);
  assert(shellBounds.min.z<0&&shellBounds.max.z<=.004,root.name+' embedded trim');
  const aperture=root.getObjectByName('uplight-aperture');
  assert(aperture.position.z>shellBounds.max.z&&aperture.position.z<=.006);
  const outward=root.name.includes('main-side')?[-1,0]:root.name.includes('wing-end')||root.name.includes('terrace')?[1,0]:
   root.name.includes('wing-rear')?[0,1]:[0,-1];
  camera.position.copy(root.localToWorld(new THREE.Vector3(outward[0]*1.8,outward[1]*1.8,1.55)));
  camera.lookAt(aperture.getWorldPosition(new THREE.Vector3()));camera.updateProjectionMatrix();
  const wasOn=circuit.isOn;
  assert(circuit.toggleAt(new THREE.Vector2(0,0),camera),root.name);verify(!wasOn);
  circuit.update(-12);verify(!wasOn);
  assert(circuit.toggleAt(new THREE.Vector2(.06,0),camera,viewport),root.name+' near tap at 12 CSS pixels');verify(wasOn);
 }
 const rail=bounds(object('terrace-pendant-rail'));
 for(const root of pendants){
  const point=root.position;
  assert(rail.distanceToPoint(point)<.001);
  assert(point.z-.50>2.2 && point.x>10.20 && point.x<12.70 && point.y===15);
  const diffuser=root.getObjectByName('pendant-diffuser');
  camera.position.copy(root.localToWorld(new THREE.Vector3(0,-1.2,-1.15)));
  camera.lookAt(diffuser.getWorldPosition(new THREE.Vector3()));camera.updateProjectionMatrix();
  const before=circuit.isOn;
  assert(circuit.toggleAt(new THREE.Vector2(0,0),camera,viewport));verify(!before);
 }
 circuit.update(14);verify(false);
 assert.equal(circuit.toggleAt(new THREE.Vector2(0,0),camera,viewport),false);verify(false);
 circuit.update(16);verify(false);circuit.update(-11);verify(true);
 camera.position.copy(interior.group.localToWorld(new THREE.Vector3(.51,1,1.6)));
 camera.lookAt(object('icon-exterior-uplight-garage-0.51').getObjectByName('uplight-aperture').getWorldPosition(new THREE.Vector3()));
 assert.equal(circuit.toggleAt(new THREE.Vector2(.05,0),camera,viewport),false,'wall occludes both exact and expanded pick target');verify(true);
});

test('grazing light crosses the storey joint on each aligned timber plane and fades above the lamps',()=>{
 if(!object('facade-garage').material[1].lightMap)interior.exteriorLights.prepare();
 function irradianceAt(name,x,y,z,nx,ny){
  const wall=object(name),hit=hits(wall,[x+.12*nx,y+.12*ny,z],[-nx,-ny,0],.125)[0];
  assert(hit,name);
  const map=wall.material[hit.face.materialIndex].lightMap,{width,height,data}=map.image;
  const tx=hit.uv1.x*width-.5,ty=hit.uv1.y*height-.5,i=Math.floor(tx),j=Math.floor(ty);
  const sample=(dx,dy)=>data[4*((j+dy)*width+i+dx)];
  const lerp=(a,b,t)=>a+(b-a)*t;
  return lerp(lerp(sample(0,0),sample(1,0),tx-i),lerp(sample(0,1),sample(1,1),tx-i),ty-j);
 }
 for(const [lower,upper,x,y,nx,ny] of [
  ['facade-garage','front-gable',6.51,0,0,-1],['facade-front-wing','upper-front-wing',11.11,4.21,0,-1],
  ['facade-wing-end','wing-gable',14.64,6.46,1,0],['facade-main-side','upper-main-side',0,2.75,-1,0]
 ]){
  const at=z=>irradianceAt(lower,x,y,z,nx,ny);
  assert(at(.09)<3&&at(.72)>at(1.89)&&at(1.89)>at(2.4),lower+' has a single ground-originating beam');
  const below=irradianceAt(lower,x,y,2.799,nx,ny),above=irradianceAt(upper,x,y,2.801,nx,ny);
  const shoulder=irradianceAt(upper,x,y,3.08,nx,ny),tail=irradianceAt(upper,x,y,3.56,nx,ny);
  assert(below>7&&Math.abs(below-above)<.2,upper+' must continue its ground-floor light field');
  assert(above>shoulder&&shoulder>tail&&tail>0,upper+' fades gradually');
  assert(!object(upper).material[0].lightMap,'inside face remains unlit');
 }
 for(const [id,x,y,nx,ny] of [['facade-wing-rear',12.74,12.71,0,1],['facade-terrace',8.5,13.32,1,0]])
  assert.equal(irradianceAt(id,x,y,.72,nx,ny),0,'No baked uplight beside the terrace table');
 for(const id of ['front-gable-glass-0','wing-gable-glass-0','garden-gable-glass-0'])
  assert.equal(object(id).material.lightMap,null,'transparent glazing receives no facade bake');
 for(const id of ['garden-gable','upper-garage-side'])
  assert.equal(object(id).material[1].lightMap,null,'projected upper facade is outside the lower plane');
});
