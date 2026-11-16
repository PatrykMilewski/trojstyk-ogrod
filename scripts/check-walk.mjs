import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const core = Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8').replaceAll("'three/core'", `'${imports['three/core']}'`);
const THREE = await import(`data:text/javascript;base64,${Buffer.from(core).toString('base64')}`);
const source = await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8');
assert(html.includes(source.replaceAll('export ', '')), 'Walking source must match the published runtime');
const { createOrbitDepthGuard, createWalkCollision, walkHouseFootprints } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const marker = 'const [source,garden,house,neighbors]=';
const start = html.indexOf(marker) + marker.length;
const [, , house, neighbors] = JSON.parse(html.slice(start, html.indexOf(';\nconst landscaping=', start)));
const footprints = walkHouseFootprints(house, neighbors);

test('house collision uses ground geometry and the EGiB /41 outline', () => {
  assert.deepEqual([...new Set(footprints.map(item => item.parcel))].sort(), ['190', '191', '193', '41']);
  const icon = footprints.find(item => item.parcel === '193');
  assert.deepEqual(icon.ring, house.meshes.filter(mesh => /^ground-wall-\d+$/.test(mesh.id)).map(mesh => mesh.vertices[0].slice(0, 2)));
  const floryda = neighbors.houses.find(item => item.parcel === '190').meshes.find(mesh => mesh.id === 'ground-storey');
  assert.equal(footprints.find(item => item.parcel === '190').ring.length, floryda.vertices.length / 2);
  assert.deepEqual(footprints.find(item => item.parcel === '41').ring, neighbors.context.buildings[0].footprint.coordinates[0]);
  assert.equal(footprints.filter(item => item.parcel === '191').length,
    neighbors.houses.find(item => item.parcel === '191').meshes.filter(mesh => mesh.kind === 'floor').length);
});

test('a swept body stops before a thin wall even with a huge displacement', () => {
  const collision = createWalkCollision([{ parcel: 'test', ring: [[0, 0], [.05, 0], [.05, 10], [0, 10]] }]);
  for (const delta of [[20, 0], [20000, 0], [20, .01]]) {
    const end = collision.move([-10, 5], delta);
    assert.ok(end[0] < -.279999, end.toString());
    assert.equal(collision.blocked(end), false);
  }
  assert.deepEqual(collision.move([-10, -10], [40, 0]), [30, -10]);
  assert.throws(() => collision.move([NaN, 0], [1, 0]), TypeError);
});

test('concave footprint recesses remain walkable and corner clearance is respected', () => {
  const collision = createWalkCollision([{ parcel: 'test', ring: [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]] }]);
  assert.equal(collision.blocked([2, 2]), false);
  assert.equal(collision.blocked([.5, 2]), true);
  assert.equal(collision.blocked([1.1, 2]), true);
  assert.equal(collision.pathBlocked([-1, -1], [.1, .1]), true);
  assert.deepEqual(collision.move([2, 2], [4, 0]), [6, 2]);
});

test('spawn is safe for all house interiors and ordinary focus targets', () => {
  const collision = createWalkCollision(footprints);
  for (const { ring } of footprints) {
    const preferred = ring.reduce((sum, point) => [sum[0] + point[0] / ring.length, sum[1] + point[1] / ring.length], [0, 0]);
    const spawn = collision.safeSpawn(preferred);
    assert.equal(collision.blocked(spawn), false);
  }
  for (const preferred of Object.values(neighbors.focus)) assert.equal(collision.blocked(collision.safeSpawn(preferred)), false);
});

test('all real house footprints resist crossing along multiple axes', () => {
  for (const item of footprints) {
    const collision = createWalkCollision([item]);
    const xs = item.ring.map(point => point[0]), ys = item.ring.map(point => point[1]);
    for (const fraction of [.25, .5, .75]) {
      const y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * fraction;
      const start = [Math.min(...xs) - 10, y], end = collision.move(start, [Math.max(...xs) - start[0] + 10, 0]);
      assert.equal(collision.blocked(end), false);
      assert.equal(collision.pathBlocked(start, end), false);
    }
  }
});

test('depth guard fixes Mops clipping without changing orthographic framing', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  const vertices = [house, ...neighbors.houses, ...neighbors.context.buildings].flatMap(model => model.meshes.flatMap(mesh => mesh.vertices));
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const camera = new THREE.OrthographicCamera(-42, 42, 30, -30, .1, 1000); camera.up.set(0, 0, 1);
  const target = new THREE.Vector3(0, 0, .7);
  const controls = { update() { camera.lookAt(target); camera.updateMatrixWorld(true); } };
  const guard = createOrbitDepthGuard({ THREE, scene, camera, controls });
  for (const zoom of [.15, 1, 80]) for (const polar of [.001, .7, 1.5]) for (const pan of [-500, 0, 500]) {
    target.set(pan, pan, .7);
    const offset = new THREE.Vector3(6, -10, 9).setFromSphericalCoords(15, polar, .7);
    // The model is Z-up; rotate the conventional spherical result into its ground plane.
    offset.set(offset.x, offset.z, offset.y);
    camera.position.copy(target).add(offset); camera.zoom = zoom; camera.updateProjectionMatrix(); controls.update();
    const sample = new THREE.Vector3(...vertices[0]);
    const before = sample.clone().project(camera), state = guard.fit(), after = sample.clone().project(camera);
    assert.ok(Math.abs(before.x - after.x) < 1e-7 && Math.abs(before.y - after.y) < 1e-7);
    assert.ok(state.minDepth >= 1.999999 && state.maxDepth < state.far);
    assert.ok(camera.near > 0);
    for (const point of vertices) {
      const projected = new THREE.Vector3(...point).project(camera);
      assert.ok(projected.z > -1 && projected.z < 1);
    }
  }
});
