import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8');
const { createWalkCollision, createWalkMotion, mergeInteriorNavigation, setupWalk } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const interiorFor = (parcel, x, height) => ({ parcel, navigation: {
  obstacles: [{ id: 'wall', ring: rect(x + 2, -3, x + 2.1, 8), minZ: 0, maxZ: height }],
  floors: [{ id: 'ground', ring: rect(x - 3, -3, x + 3, 8), z: 0 },
    { id: 'upper', ring: rect(x - 2, 4, x + 2, 8), z: height }],
  ramps: [{ id: 'stairs', start: [x, 0], end: [x, 4], width: 1, z0: 0, z1: height }],
  ceilingHeight: point => point[0] >= x - 3 && point[0] <= x + 3 && point[1] >= -3 && point[1] <= 8
    ? height + 2.2 : Infinity,
} });
const interiors = [interiorFor('193', 0, 3.2), interiorFor('190', 20, 2.8)];

test('merged interiors namespace every navigation ID without changing source geometry', () => {
  const navigation = mergeInteriorNavigation(interiors);
  for (const kind of ['obstacles', 'floors', 'ramps']) {
    assert.equal(new Set(navigation[kind].map(item => item.id)).size, navigation[kind].length);
    for (const { parcel, navigation: original } of interiors) {
      for (const item of original[kind]) {
        assert.deepEqual(navigation[kind].find(merged => merged.id === `${parcel}:${item.id}`),
          { ...item, id: `${parcel}:${item.id}` });
        assert.ok(!item.id.includes(':'));
      }
    }
  }
  assert.equal(mergeInteriorNavigation([]), undefined);
  assert.equal(mergeInteriorNavigation([{ parcel: '190' }]), undefined);
});

test('both separated staircases reach their own floor and keep jumps on that floor', () => {
  const navigation = mergeInteriorNavigation(interiors);
  const motion = createWalkMotion(createWalkCollision([]), navigation);
  for (const [x, height] of [[0, 3.2], [20, 2.8]]) {
    motion.reset([x, 0]);
    motion.move(1, 0, 4.5 / 2.2);
    assert.ok(Math.abs(motion.getState().floorHeightM - height) < 1e-8);
    motion.jump(); motion.move(0, 0, 1);
    assert.equal(motion.getState().floorHeightM, height);
    assert.ok(motion.getState().grounded);
    assert.ok(Math.abs(motion.getState().position[2] - height - 1.7) < 1e-8);
  }
});

test('ceiling callbacks apply only to their house and choose the lower overlapping ceiling', () => {
  const navigation = mergeInteriorNavigation(interiors);
  assert.equal(navigation.ceilingHeight([0, 6]), 5.4);
  assert.equal(navigation.ceilingHeight([20, 6]), 5);
  assert.equal(navigation.ceilingHeight([10, 6]), Infinity);
  const overlap = mergeInteriorNavigation([...interiors, { parcel: 'extra', navigation: {
    obstacles: [], floors: [], ramps: [], ceilingHeight: () => 4,
  } }]);
  assert.equal(overlap.ceilingHeight([0, 6]), 4);
  const noCeiling = mergeInteriorNavigation([{ parcel: '193', navigation: { obstacles: [], floors: [], ramps: [] } }]);
  assert.equal(noCeiling.ceilingHeight([0, 6]), Infinity);
});

const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const core = Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8')
  .replaceAll("'three/core'", `'${imports['three/core']}'`);
const THREE = await import(`data:text/javascript;base64,${Buffer.from(core).toString('base64')}`);
const element = () => ({ querySelector: () => element(), setAttribute() {}, addEventListener() {}, focus() {} });
globalThis.window = { addEventListener() {} };
globalThis.document = { createElement: element, addEventListener() {},
  body: { append() {}, classList: { add() {}, remove() {} } } };
globalThis.innerWidth = 800; globalThis.innerHeight = 600;
globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
const ground = (x, y) => rect(x - 3, y - 3, x + 3, y + 8).map(point => [...point, 0]);
const house = { meshes: ground(0, 0).map((point, i) => ({ id: `ground-wall-${i}`, vertices: [point] })) };
const neighbors = { houses: [
  { parcel: '190', meshes: [{ id: 'ground-storey', vertices: ground(20, 0) }] },
  { parcel: '191', meshes: [{ kind: 'floor', vertices: ground(40, 0) }] },
], context: { buildings: [{ parcel: '41', footprint: { coordinates: [rect(57, -3, 63, 8)] } }] } };
const setup = options => setupWalk({ THREE, house, neighbors, camera: new THREE.PerspectiveCamera(),
  controls: { target: new THREE.Vector3(), update() {} }, renderer: { domElement: element() },
  requestDraw() {}, onCameraChange() {}, button: element(), ...options });

test('only explicitly navigable parcels lose their solid building collider', () => {
  const both = setup({ interiors });
  assert.deepEqual(both.getState().footprintParcels.sort(), ['191', '41']);
  for (const x of [0, 20]) assert.equal(both.collision.blocked([x, 0]), false);
  for (const x of [40, 60]) {
    assert.equal(both.collision.blocked([x, 0]), true);
    assert.ok(both.collision.move([x - 5, 0], [10, 0])[0] < x - 3);
  }
  assert.deepEqual(setup({ interiors: [interiors[1]] }).getState().footprintParcels.sort(), ['191', '193', '41']);
  assert.deepEqual(setup({ interior: { navigation: interiors[0].navigation } }).getState().footprintParcels.sort(), ['190', '191', '41']);
  assert.deepEqual(setup({ interior: { navigation: interiors[0].navigation }, interiors: [] })
    .getState().footprintParcels.sort(), ['190', '191', '193', '41']);
});

test('walk enters either house and travels between both houses through the open outside', () => {
  const walk = setup({ interiors });
  for (const [x, height] of [[0, 3.2], [20, 2.8]]) {
    walk.enter([x, 0], [0, 1]); walk.move(1, 0, 4.5 / 2.2);
    assert.ok(Math.abs(walk.getState().floorHeightM - height) < 1e-8);
  }
  walk.enter([0, 0], [0, 1]); walk.move(-1, 0, 5 / 2.2);
  walk.move(0, 1, 20 / 2.2); walk.move(1, 0, 5 / 2.2);
  assert.ok(Math.abs(walk.getState().position[0] - 20) < 1e-8);
  assert.ok(Math.abs(walk.getState().position[1]) < 1e-8);
  assert.equal(walk.getState().floorHeightM, 0);
  assert.ok(walk.getState().grounded);
  walk.exit();
});

test('default walking view returns to its configured position and heading after visiting another house', () => {
  const startView = { position: [-1, 2, 0], target: [-3, 4, 0] };
  const walk = setup({ interiors, startView });
  for (let visit = 0; visit < 2; visit++) {
    walk.enter();
    assert.deepEqual(walk.getState().position, [-1, 2, 1.7]);
    assert.ok(Math.abs(walk.getState().yaw + Math.PI / 4) < 1e-6);
    walk.enter([20, 1, 0], [1, 0]);
    assert.deepEqual(walk.getState().position, [20, 1, 1.7]);
    walk.exit();
  }
});
