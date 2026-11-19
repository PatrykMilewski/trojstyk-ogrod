import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8').replaceAll("'three/core'", `'${imports['three/core']}'`));
const marker = 'const [source,garden,house,neighbors]=';
const start = html.indexOf(marker) + marker.length;
const [, , house] = JSON.parse(html.slice(start, html.indexOf(';\nconst landscaping=', start)));
const { addIconInterior } = await load(await readFile(new URL('../src/model/interior.js', import.meta.url), 'utf8'));
const { joinIconStorySurfaces } = await load(await readFile(new URL('../src/model/story-joints.js', import.meta.url), 'utf8'));
const data = JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json', import.meta.url), 'utf8'));
const interior = addIconInterior({ THREE, scene: new THREE.Scene(), house, data, joinStory: joinIconStorySurfaces });
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
