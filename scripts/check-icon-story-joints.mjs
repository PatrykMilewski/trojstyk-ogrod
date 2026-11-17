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
const interior = addIconInterior({ THREE, scene: new THREE.Scene(), house, data });
const group = interior.group;
const eligible = name => name.startsWith('facade-') || name.endsWith('-gable') || name === 'upper-structure' || /^upper-(main-side|front-wing|rear-wing|garage-side|terrace-side)$/.test(name);
function surfaces() {
 group.updateMatrixWorld(true);
 const inverse = group.matrixWorld.clone().invert(), result = [];
 group.traverse(mesh => {
  if (!mesh.isMesh || !eligible(mesh.name)) return;
  const geometry = mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index;
  const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
   const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(matrix));
   const material = geometry.groups.find(g => i >= g.start && i < g.start + g.count)?.materialIndex ?? 0;
   result.push({ name: mesh.name, material, points });
  }
 });
 return result;
}
const atStory = t => t.points.every(p => Math.abs(p.z - 2.8) < 1e-5);
function contains(t, x, y) {
 const [a, b, c] = t.points;
 const area = (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 if (Math.abs(area) < 1e-10) return false;
 const values = [[a,b],[b,c],[c,a]].map(([p,q]) => (q.x-p.x)*(y-p.y)-(q.y-p.y)*(x-p.x));
 return values.every(v => v >= -1e-9) || values.every(v => v <= 1e-9);
}
const owners = (triangles, x, y) => [...new Set(triangles.filter(t => contains(t,x,y)).map(t => t.name))];
const before = surfaces(), oldCaps = before.filter(atStory);
const nonCaps = triangles => triangles.filter(t => !atStory(t)).map(t => JSON.stringify([t.name,t.material,t.points.map(p=>p.toArray().map(v=>Math.round(v*1e5)/1e5))])).sort();
const transforms = group.children.filter(m=>m.isMesh).map(m=>[m,m.position.toArray(),m.quaternion.toArray(),m.scale.toArray()]);
const unrelated = group.children.filter(m => m.isMesh && !eligible(m.name)).map(m => [m,m.geometry]);
if (process.env.ICON_STORY_SKIP_JOIN !== '1') joinIconStorySurfaces(THREE, group);
const after = surfaces(), caps = after.filter(atStory);

test('buried facade tops and upper-storey bottoms have no coincident surfaces', () => {
 for (const [x,y] of [[14.5,6],[.1,5]]) {
  assert(oldCaps.some(t=>t.name.startsWith('facade-')&&contains(t,x,y)),`baseline lower cap ${x},${y}`);
  assert(oldCaps.some(t=>!t.name.startsWith('facade-')&&contains(t,x,y)),`baseline upper cap ${x},${y}`);
  assert.deepEqual(owners(caps,x,y),[],`buried interface ${x},${y}`);
 }
});
test('all actual cap-grid cells retain exactly the exposed union boundary', () => {
 const coordinates = axis => [...new Set(oldCaps.flatMap(t=>t.points.map(p=>Math.round(p[axis]*1e5)/1e5)))].sort((a,b)=>a-b);
 const xs=coordinates('x'),ys=coordinates('y');let occupied=0,buried=0,exposed=0;
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++) {
  // An off-diagonal sample avoids counting the shared triangulation edge twice.
  const x=xs[i-1]+(xs[i]-xs[i-1])*.431,y=ys[j-1]+(ys[j]-ys[j-1])*.537;
  const old=oldCaps.filter(t=>contains(t,x,y));
  const below=old.some(t=>t.name.startsWith('facade-')),above=old.some(t=>!t.name.startsWith('facade-'));
  const actual=caps.filter(t=>contains(t,x,y));
  assert.equal(actual.length,below!==above?1:0,`cap multiplicity ${x},${y}: ${actual.map(t=>t.name)}`);
  if(old.length)occupied++;
  if(below&&above)buried++;
  if(below!==above)exposed++;
 }
 assert(occupied>100&&buried>20&&exposed>20,`meaningful cell coverage ${occupied},${buried},${exposed}`);
});
test('upper soffits, exposed garden ledges and ceiling outside the walls survive', () => {
 for(const [x,y] of [[7.5,.1],[8.4,2]])assert.equal(owners(caps,x,y).length,1,`upper overhang ${x},${y}`);
 const exposed=oldCaps.filter(t=>t.name==='facade-garden');let retained=0;
 for(const t of exposed){const x=t.points.reduce((s,p)=>s+p.x,0)/3,y=t.points.reduce((s,p)=>s+p.y,0)/3;
  const old=oldCaps.filter(o=>contains(o,x,y));
  if(!old.some(o=>!o.name.startsWith('facade-'))){assert.equal(owners(caps,x,y).length,1,`garden ledge ${x},${y}`);retained++;}
 }
 assert(retained>0,'at least one exposed garden ledge is checked');
 assert(caps.some(t=>t.name==='upper-structure'),'ceiling boundary retained');
});
test('nonhorizontal geometry, material groups, mesh transforms and unrelated geometry stay unchanged', () => {
 assert.deepEqual(nonCaps(after),nonCaps(before));
 for(const [mesh,geometry] of unrelated)assert.equal(mesh.geometry,geometry,mesh.name);
 for(const [mesh,position,quaternion,scale] of transforms){assert.deepEqual(mesh.position.toArray(),position);assert.deepEqual(mesh.quaternion.toArray(),quaternion);assert.deepEqual(mesh.scale.toArray(),scale);}
 for(const t of caps){const mesh=group.getObjectByName(t.name);assert(t.material<(Array.isArray(mesh.material)?mesh.material.length:1));}
 group.traverse(mesh=>{if(mesh.isMesh&&eligible(mesh.name))for(const [name,attribute] of Object.entries(mesh.geometry.attributes))assert(Array.from(attribute.array).every(Number.isFinite),`${mesh.name} ${name} must be finite`);});
});


test('translated meshes preserve upper soffit normals, material assignments and idempotence', () => {
 const fixture = new THREE.Group();
 fixture.position.set(12,-4,9);fixture.rotation.set(.2,.3,.4);fixture.scale.setScalar(1.3);
 const material = [new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial()];
 const add = (name,z,height,shift=0) => {
  const geometry = new THREE.BoxGeometry(2,2,height);
  geometry.clearGroups();geometry.addGroup(0,geometry.index.count,1);
  const mesh = new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(shift,0,z);fixture.add(mesh);return mesh;
 };
 const lower=add('facade-fixture',1.4,2.8);
 const upper=add('upper-structure',3,.4,1);
 joinIconStorySurfaces(THREE,fixture);
 function capsOf(mesh) {
  mesh.updateMatrix();const attribute=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal'),caps=[];
  for(let i=0;i<attribute.count;i+=3){
   const points=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(attribute,i+k).applyMatrix4(mesh.matrix));
   if(points.every(p=>Math.abs(p.z-2.8)<1e-5))caps.push({points,normal:new THREE.Vector3().fromBufferAttribute(normal,i)});
  }
  return caps;
 }
 const lowerCaps=capsOf(lower),upperCaps=capsOf(upper);
 assert(lowerCaps.length&&upperCaps.length);
 for(const t of lowerCaps){assert(t.points.every(p=>p.x<=1e-5));assert.equal(t.normal.z,1);}
 for(const t of upperCaps){assert(t.points.every(p=>p.x>=1-1e-5));assert.equal(t.normal.z,-1);}
 for(const mesh of [lower,upper])assert(mesh.geometry.groups.every(g=>g.materialIndex===1));
 const first=[lower,upper].map(m=>Array.from(m.geometry.getAttribute('position').array));
 joinIconStorySurfaces(THREE,fixture);
 assert.deepEqual([lower,upper].map(m=>Array.from(m.geometry.getAttribute('position').array)),first);
});


test('generated HTML embeds the current story-joint helper and activates it', async () => {
 const moduleSource = await readFile(new URL('../src/model/story-joints.js', import.meta.url), 'utf8');
 assert(html.includes(moduleSource.replaceAll('export ','')),'generated HTML must embed the current helper source');
 assert(html.includes('joinStory:joinIconStorySurfaces'),'generated interior must activate the cap union');
});
