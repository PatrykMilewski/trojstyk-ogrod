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

test('living-room upper glazing remains transparent across its full opening', () => {
 const wall=object('garden-gable');
 for(const x of [1.1,2,3,4.25,5.5,6.5,7.4]) {
  const top=x<4.25?3.95+(x-.9)*3.4/3.35:7.35-(x-4.25)*3.4/3.35;
  for(let z=3.3;z<top-.08;z+=.23) assert.equal(hits(wall,[x,17,z],[0,1,0],2).length,0,`Opaque wall blocks window at ${x},${z}`);
 }
});
test('upper living-room glass has exactly the same recess as lower glass', () => {
 const upper=bounds(object('garden-gable-glass-0'));
 const lower=interior.group.children.filter(m=>m.name.startsWith('facade-')&&m.name.includes('-glass-')).map(bounds).find(b=>b.min.y>16);
 assert(lower,'lower garden glazing exists');close(upper.min.y,lower.min.y,'upper/lower glass plane');
});

test('recess keeps the full glass polygon and does not cover it with reveal surfaces', () => {
 const glass=object('garden-gable-glass-0'),outline=bounds(glass);
 close(outline.min.x,.9,'glazing left');close(outline.max.x,7.6,'glazing right');close(outline.min.z,3.2,'glazing sill');close(outline.max.z,7.35,'glazing apex');
 assert(glass.material.transparent);assert.equal(glass.castShadow,false);
 assert(!interior.group.getObjectByName('garden-gable-mullion-0'),'No extra floating half-height mullion between the two original full dividers');
 const reveal=object('garden-gable-reveal-0'),sill=object('garden-window-transom');
 for(const x of [1.1,2,3,4.25,5.5,6.5,7.4]) {
  const top=x<4.25?3.95+(x-.9)*3.4/3.35:7.35-(x-4.25)*3.4/3.35;
  for(let z=3.3;z<top-.08;z+=.23) {
   for(const opaque of [object('garden-gable'),reveal,sill])assert.equal(hits(opaque,[x,16,z],[0,1,0],3).length,0,`${opaque.name} blocks recessed glazing`);
   assert(hits(glass,[x,16,z],[0,1,0],3).length,'Upper glass remains present');
  }
 }
 close(bounds(object('garden-gable')).max.y,18.13,'original gable face preserved');
 for(const x of [3.1,5.4])close(bounds(object('garden-upper-triangle-mullion-'+x)).min.y,outline.min.y-.025,'mullion follows glass');
 close(bounds(sill).max.y,outline.min.y,'transom flush with glazing');close(bounds(sill).min.y,outline.min.y-.12,'transom lies behind glass plane');
 assert.equal(hits(reveal,[4,17.3,3.5],[0,0,-1],.4).length,0,'No duplicate plane atop sill box');
 assert.equal(hits(sill,[4,17.3,3.5],[0,0,-1],.4).length,0,'No projecting shelf in front of glazing');
});
