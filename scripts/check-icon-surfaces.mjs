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

test('open interior doorways match their rendered openings and collision bands', () => {
  for (const wall of data.walls.filter(wall => wall.finish !== 'clear-glass')) {
    const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length, base = wall.level ? 3.2 : 0;
    for (let i = 1; i < 80; i++) for (const h of [.04, 1.1, 2.08, 2.2]) {
      const u = length * i / 80; if (wall.doors.some(door => door.some(edge => Math.abs(edge - u) < 1e-6))) continue; const expected = !wall.doors.some(([lo, hi]) => u > lo && u < hi && h < 2.1);
      const x = wall.a[0] + ux * u, y = wall.a[1] + uy * u;
      if (wall.level && base + h >= interior.navigation.ceilingHeight(interior.localToWorld([x, y])) - .1) continue;
      const visible = hits(object(wall.id), [x + uy * .4, y - ux * .4, base + h], [-uy, ux, 0], .8).length > 0;
      assert.equal(visible, expected, `${wall.id}, u=${u}, h=${h}: visual opening`);
      const p = interior.localToWorld([x, y]);
      const collision = interior.navigation.obstacles.some(o => o.id.startsWith(wall.id + '-') && base + h > o.minZ && base + h < o.maxZ && contains(p, o.ring));
      assert.equal(collision, visible, `${wall.id}: collision agrees with rendered aperture`);
    }
  }
});

test('upper partitions reach the actual roof lining on both faces, including ridges and valleys', () => {
  for (const wall of data.walls.filter(w => w.level)) {
    const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
    for (let i = 1; i < 100; i++) for (const side of [-1, 1]) {
      const u = length * i / 100, d = side * wall.thickness / 2, x = wall.a[0] + ux * u - uy * d, y = wall.a[1] + uy * u + ux * d;
      const roof = interior.navigation.ceilingHeight(interior.localToWorld([x, y]));
      assert(hits(object(wall.id), [x - uy * side * .01, y + ux * side * .01, roof - .002], [uy * side, -ux * side, 0], .02).length, `${wall.id} has ceiling gap at ${x},${y}`);
    }
  }
});

test('single upper floor has no holes or extra surfaces across the declared walkable floor', () => {
  const top = object('upper-oak-finish'), base = object('upper-structure');
  for (let x = .11; x < 14.64; x += .21) for (let y = .11; y < 18.13; y += .213) {
    const world = interior.localToWorld([x, y]);
    const expected = interior.navigation.floors.some(f => f.z === 3.2 && contains(world, f.ring));
    const finishHits = hits(top, [x, y, 3.5], [0, 0, -1], .29);
    const edgeDistance=Math.min(...data.exterior.upper.map((a,i)=>{const b=data.exterior.upper[(i+1)%data.exterior.upper.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}));
    if(expected&&edgeDistance<.18)continue;
    assert.equal(finishHits.length > 0, expected, `Accessible floor/nav mismatch at ${x},${y}`);
    if (expected) { close(finishHits[0].point.z, 3.215, 'Oak floor top'); const insideLowerWall=interior.navigation.obstacles.some(o=>o.id.startsWith('facade-')&&o.minZ<2.8&&o.maxZ>=2.8&&contains(world,o.ring));
      if(!insideLowerWall)assert(hits(base, [x, y, 2.7], [0, 0, 1], .11).length, 'Exposed ground ceiling remains continuous'); }
  }
  assert(!interior.group.children.some(mesh => /^upper-(slab|finish)-\d/.test(mesh.name)), 'No coincident per-cell floor surfaces');
});

test('counter tops have no overlapping exposed body faces and exterior walls have one surface', () => {
  for (const item of data.furniture.filter(f => f.type === 'counter')) {
    const body = bounds(object(item.id + '-body')), top = bounds(object(item.id + '-top'));
    close(body.max.z, top.min.z, item.id + ' adjoining solids');
    assert(body.max.z < top.max.z - .049, item.id + ' body is below visible counter surface');
  }
  assert(!interior.group.children.some(mesh => mesh.name.endsWith('-charred-exterior')), 'No extra nearly coplanar exterior shell');
  for (const mesh of interior.group.children.filter(m => m.isMesh)) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) assert(!material.polygonOffset, 'No depth offset masking');
});

test('stairs have continuous flight-to-landing handrails, supported posts and connected stringers', () => {
  const s = data.stairs, [sx, sy, ex, ey] = s.box, run = 8 * s.tread, half = s.floorHeight / 2;
  for (const [flight, x, front] of [['lower', sx, 0], ['upper', ex, 3.2]]) {
    const rail = bounds(object('stair-handrail-' + flight)), side = bounds(object('landing-' + flight + '-top'));
    close(side.min.y, sy + run, 'Landing rail joins flight');
    close(side.max.y, ey, 'Landing rail reaches back guard');
    assert(rail.max.z >= half + 1.05 && rail.min.z <= half + 1.05, 'Rail reaches landing height');
    for (let i = 0; i < 8; i++) {
      const post = bounds(object(`stair-${flight}-baluster-${i}`));
      const expected = flight === 'lower' ? Math.min(half, (i + 1) * half / 9) : half + Math.min(half, (9 - i) * half / 9);
      close(post.min.z, expected, 'Baluster rests on stair tread');
      close(post.max.z, front + (half - front) * i / 8 + 1.05, 'Baluster meets handrail');
    }
    assert(!interior.group.getObjectByName(`stair-${flight}-baluster-8`), 'Shared endpoint uses one full landing post');
    const shared = bounds(object(`landing-${flight}-post-0`));
    close(shared.min.z, half, 'Shared post bears on landing');
    close(shared.max.z, half + 1.05, 'Shared post joins both rail segments');
    for (const index of [0, 1]) {
      const stringer = bounds(object(`stair-stringer-${flight}-${index}`));
      assert(stringer.min.y <= sy && stringer.max.y >= sy + run && stringer.min.z < half && stringer.max.z > half - .15, 'Stringer connects all treads and landing: '+flight+JSON.stringify(stringer));
    }
  }
  for (const [guard, rim] of [['upper-void-edge', 'upper-void-rim'], ['upper-stair-edge', 'upper-stair-rim']]) {
    const support = bounds(object(rim)); close(support.max.z, 3.2, 'Rim supports upper guard');
    for (let i = 0; ; i++) { const post = interior.group.getObjectByName(`${guard}-post-${i}`); if (!post) break; const b = bounds(post); assert(b.min.x >= support.min.x - .02 && b.max.x <= support.max.x + .02 && b.min.y >= support.min.y - .02 && b.max.y <= support.max.y + .02); close(b.min.z, support.max.z, 'Guard post bears on rim'); }
  }
  assert(bounds(object('upper-stair-rim-anchor')).max.x >= 9.87 - 1e-5, 'Rim is anchored to upper suite floor');
});

test('roof joins are checked against actual lining triangles, and exterior inner faces reach them', () => {
  const roof = interior.group.children.filter(m => m.name.startsWith('interior-roof-lining-'));
  for (const wall of data.walls.filter(w => w.level)) {
    const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1];
    for (const t of [.07, .23, .51, .78, .94]) {
      const x = wall.a[0] + dx * t, y = wall.a[1] + dy * t;
      const intersections = roof.flatMap(mesh => hits(mesh, [x, y, 9], [0, 0, -1], 6)).sort((a, b) => a.distance - b.distance);
      assert(intersections.length, 'Roof lining above ' + wall.id);
      close(intersections[0].point.z, interior.navigation.ceilingHeight(interior.localToWorld([x, y])), wall.id + ' roof matches source mesh');
    }
  }
  for (const [name, x, y, direction] of [['upper-main-side', .36, 2, [-1, 0, 0]], ['upper-front-wing', 12, 4.57, [0, -1, 0]], ['upper-rear-wing', 12, 12.35, [0, 1, 0]], ['upper-garage-side', 8.14, 2, [1, 0, 0]], ['upper-terrace-side', 8.14, 15, [1, 0, 0]]]) {
    const ceiling = interior.navigation.ceilingHeight(interior.localToWorld([x, y]));
    assert(hits(object(name), [x - direction[0] * .01, y - direction[1] * .01, ceiling - .002], direction, .02).length, name + ' closes wedge under sloped roof');
  }
});

test('shared glazing edges and guardrail junctions have one exposed cylinder each', () => {
  const seen = new Map();
  for (const mesh of interior.group.children.filter(m => m.geometry?.type === 'CylinderGeometry')) {
    const b = bounds(mesh), key = [...b.min.toArray(), ...b.max.toArray()].map(n => n.toFixed(5)).join(',');
    assert(!seen.has(key), `${mesh.name} duplicates ${seen.get(key)}`); seen.set(key, mesh.name);
  }
  for (const item of data.furniture.filter(f => ['counter', 'cabinet', 'appliance'].includes(f.type))) {
    const body = bounds(object(item.id + '-body'));
    for (const handle of interior.group.children.filter(m => m.name.startsWith(item.id + '-handle-'))) {
      const h = bounds(handle);
      assert(h.max.x > body.max.x + .02 || h.min.x < body.min.x - .02 || h.max.y > body.max.y + .02 || h.min.y < body.min.y - .02, item.id + ' handle projects beyond cabinet face');
    }
  }
});

test('collinear cylinders never contain even a partial duplicate span', () => {
  const cylinders = interior.group.children.filter(m => m.geometry?.type === 'CylinderGeometry').map(mesh => {
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);
    return { mesh, axis, center: mesh.position, height: mesh.geometry.parameters.height, radius: mesh.geometry.parameters.radiusTop };
  });
  for (let i = 0; i < cylinders.length; i++) for (let j = i + 1; j < cylinders.length; j++) {
    const a = cylinders[i], b = cylinders[j];
    if (Math.abs(a.radius - b.radius) > 1e-7 || Math.abs(a.axis.dot(b.axis)) < 1 - 1e-7) continue;
    const delta = b.center.clone().sub(a.center), projection = delta.dot(a.axis);
    if (delta.clone().addScaledVector(a.axis, -projection).length() > 1e-5) continue;
    const overlap = Math.min(a.height / 2, projection + b.height / 2) - Math.max(-a.height / 2, projection - b.height / 2);
    assert(overlap <= 1e-5, `${a.mesh.name} partially overlaps ${b.mesh.name} by ${overlap}m`);
  }
});

test('furniture boxes have no duplicate exposed coplanar faces, including beds, chairs and sinks', () => {
  for (const item of data.furniture) {
    const boxes = interior.group.children.filter(m => m.userData.furnitureId === item.id && m.geometry?.type === 'BoxGeometry');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = bounds(boxes[i]), b = bounds(boxes[j]);
      for (const axis of ['x', 'y', 'z']) for (const side of ['min', 'max']) {
        if (Math.abs(a[side][axis] - b[side][axis]) > 1e-5) continue;
        const overlap = ['x', 'y', 'z'].filter(v => v !== axis).every(v => Math.min(a.max[v], b.max[v]) - Math.max(a.min[v], b.min[v]) > 1e-5);
        assert(!overlap, `${boxes[i].name} and ${boxes[j].name} duplicate exposed ${side}.${axis} faces`);
      }
    }
  }
});

test('rectangular stringers stay below every tread and bear inside landing and floor slabs', () => {
  const s = data.stairs, [sx, sy, ex] = s.box, run = 8 * s.tread, half = s.floorHeight / 2;
  for (const flight of ['lower', 'upper']) for (const index of [0, 1]) {
    const stringer = object(`stair-stringer-${flight}-${index}`), x = bounds(stringer).getCenter(new THREE.Vector3()).x;
    assert.equal(stringer.geometry.type, 'ExtrudeGeometry', 'Rectangular stringer, no round radius above treads');
    for (let i = 0; i < 8; i++) {
      const tread = bounds(object(`stair-${flight}-tread-${i}`));
      for (const y of [tread.min.y + .0001, (tread.min.y + tread.max.y) / 2, tread.max.y - .0001]) {
        const cast = hits(stringer, [x, y, tread.max.z + .05], [0, 0, -1], 1);
        assert(cast.length, 'Stringer runs continuously beneath tread');
        assert(cast[0].point.z <= tread.max.z - .059, `${flight} stringer protrudes through tread ${i}`);
      }
    }
    const landingY = sy + run + (flight === 'lower' ? .25 : .02);
    const landingHit = hits(stringer, [x, landingY, 2], [0, 0, -1], 1)[0];
    assert(landingHit && landingHit.point.z >= half - .15 && landingHit.point.z <= half, 'Stringer tail bears inside landing slab');
    const floorY = sy - .02, floorZ = flight === 'lower' ? .2 : 3.4;
    const floorHit = hits(stringer, [x, floorY, floorZ], [0, 0, -1], .6)[0];
    assert(floorHit && (flight === 'lower' ? floorHit.point.z >= -.12 && floorHit.point.z <= 0 : floorHit.point.z >= 2.8 && floorHit.point.z <= 3.2), 'Stringer nose bears inside floor slab');
  }
});

test('room fixtures are suspended from the slab or the actual sloped lining, with walking headroom', () => {
 const names=['hall','guest','office','upper-hall','upper-one','upper-two','upper-master'];
 for(const id of names){
  const name='light-fixture-'+id+'-',shade=object(name+'shade'),canopy=object(name+'canopy');
  assert.equal(shade.geometry.type,'LatheGeometry');
  const up=new THREE.Vector3(0,1,0).applyQuaternion(canopy.quaternion);
  const anchor=canopy.position.clone().addScaledVector(up,.0125);
  const upper=id.startsWith('upper-');
  const roof=upper?interior.navigation.ceilingHeight(interior.localToWorld([anchor.x,anchor.y])):data.levels.groundCeiling;
  close(anchor.z,roof,id+' mounting height');
  const cord=bounds(object(name+'drop')),collar=bounds(object(name+'collar'));
  assert(cord.min.z<=collar.max.z && cord.max.z>=roof-.011,id+' connected drop');
  assert(bounds(shade).min.z-(upper?data.levels.upper:0)>2.30,id+' clear height');
 }
 assert.equal(interior.group.children.filter(child=>child.isPointLight).length,9);
});

test('play mat rests on the floor and the train track rests on the mat', () => {
  close(bounds(object('play-mat-woven-edge')).min.z, data.levels.ground, 'mat base');
  close(bounds(object('play-train-beech-track')).min.z, bounds(object('play-mat-woven-face')).max.z, 'track base');
});
