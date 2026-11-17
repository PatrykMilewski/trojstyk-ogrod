import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const core = Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8').replaceAll("'three/core'", `'${imports['three/core']}'`);
const THREE = await load(core);
const marker = 'const [source,garden,house,neighbors]=';
const start = html.indexOf(marker) + marker.length;
const [, , house] = JSON.parse(html.slice(start, html.indexOf(';\nconst landscaping=', start)));
const interiorSource = await readFile(new URL('../src/model/interior.js', import.meta.url), 'utf8');
const sourceOnly = process.env.INTERIOR_SOURCE_ONLY === '1';
test('published interior renderer matches source', { skip: sourceOnly }, () => {
  assert(html.includes(interiorSource.replaceAll('export ', '')), 'Interior renderer must match the published runtime');
});
const { addIconInterior } = await load(interiorSource);
const { createWalkMotion, createWalkCollision } = await load(await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8'));
const data = JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json', import.meta.url), 'utf8'));
const embedded = html.match(/const interiorData=(.*);\nconst interior=addIconInterior/);
assert(embedded, 'Embedded interior dimensions');
test('published interior dimensions match source', { skip: sourceOnly }, () => {
  assert.deepEqual(JSON.parse(embedded[1]), data, 'Interior dimensions must match published runtime');
});
const { navigation, localToWorld } = addIconInterior({ THREE, scene: new THREE.Scene(), house, data });
const stairs = [[7.4, 8.8, 0], [8.39, 9.23, 0], [8.39, 11.31, 1.6], [8.39, 11.8, 1.6],
  [9.35, 11.8, 1.6], [9.35, 11.31, 1.6], [9.35, 9.23, 3.2], [8.7, 8.6, 3.2]];
const routes = {
  '0.1': [[7.4, 5.5], [5.5, 5.5]],
  '0.2': [[7.4, 5.5], [2.1, 5.5], [2.1, 7.5]],
  '0.3': [[7.4, 5.5], [5.1, 5.5], [5.1, 7.5]],
  '0.4': [[7.4, 8.8], [7.1, 9.75], [5, 9.75]],
  '0.5': [[7.4, 8.6]],
  '0.6': [[7.5, 6]],
  '0.7': [[7.4, 8.6], [9.81, 8.6], [9.81, 7.32]],
  '0.8': [[7.4, 8.8], [10.6, 8.8], [12, 8.8], [12, 7]],
  '0.9': [[7.4, 8.8], [10.3, 8.8], [10.3, 10.5], [10.16, 11.9]],
  '1.1': [[5.6, 8.6], [5.6, 4.5], [5.7, 2]],
  '1.2': [[5.6, 8.6], [5.6, 5.1], [3, 5.1]],
  '1.3': [[5.6, 8.6], [5.6, 7.39], [3.5, 7.39]],
  '1.4': [[5.6, 8.6]],
  '1.5': [[5.6, 8.6], [5.6, 6.6], [7.1, 6.6]],
  '1.6': [[9.2, 8.6], [10.25, 8.6], [10.25, 6.8]],
  '1.7': [[10.6, 8.6], [13, 8.6], [13, 6.8]],
  '1.8': [[10.6, 8.6], [11, 10]],
};
function motionAtEntry() {
  const motion = createWalkMotion(createWalkCollision([]), navigation);
  const spawn = createWalkCollision(navigation.obstacles.filter(item => item.minZ < 1.7 && item.maxZ > 0))
    .safeSpawn(navigation.entry.slice(0, 2));
  motion.reset([...spawn, navigation.entry[2]]); return motion;
}
function follow(motion, route, defaultZ = 0) {
  for (const [x, y, z = defaultZ] of route) {
    const target = localToWorld([x, y, z]), current = motion.getState().position;
    const dx = target[0] - current[0], dy = target[1] - current[1];
    motion.move(1, 0, Math.hypot(dx, dy) / 2.2, Math.atan2(dx, dy));
    const state = motion.getState();
    assert.ok(Math.hypot(state.position[0] - target[0], state.position[1] - target[1]) < 1e-5, `Blocked route at ${x},${y}`);
    assert.ok(Math.abs(state.floorHeightM - z) < 1e-5, `Wrong floor at ${x},${y}: ${state.floorHeightM}`);
  }
}
for (const [id, route] of Object.entries(routes)) test(`actual room ${id} is reachable from entry`, () => {
  const motion = motionAtEntry(), upper = id.startsWith('1.');
  if (upper) follow(motion, stairs);
  follow(motion, route, upper ? 3.2 : 0);
});
test('actual staircase descends to the ground and upper-floor jump lands on its floor', () => {
  const motion = motionAtEntry(); follow(motion, stairs); follow(motion, [[7.1, 8.6]], 3.2);
  motion.jump(); motion.move(0, 0, 1); assert.equal(motion.getState().floorHeightM, 3.2);
  assert.ok(motion.getState().grounded); follow(motion, [[8.7, 8.6]], 3.2);
  follow(motion, [...stairs].reverse()); assert.equal(motion.getState().floorHeightM, 0);
});
test('actual roof slope stops walking toward the low knee wall', () => {
  const motion = motionAtEntry(); follow(motion, stairs); follow(motion, routes['1.1'], 3.2);
  follow(motion, [[3, 3.1], [2, 3.1]], 3.2);
  const target = localToWorld([.5, 3.1]), current = motion.getState().position;
  const dx = target[0] - current[0], dy = target[1] - current[1];
  motion.move(1, 0, Math.hypot(dx, dy) / 2.2, Math.atan2(dx, dy));
  const state = motion.getState();
  assert.ok(Math.hypot(state.position[0] - target[0], state.position[1] - target[1]) > .2);
  assert.ok(state.position[2] <= navigation.ceilingHeight(state.position) + 1e-8);
  assert.equal(state.floorHeightM, 3.2);
});

test('main entrance and terrace slider allow crossing the external walls', () => {
  const motion = createWalkMotion(createWalkCollision([]), navigation);
  motion.reset(localToWorld([7.4, 3.4, 0]));
  follow(motion, [[7.4, 5.2, 0], [7.4, 3.4, 0]]);
  motion.reset(localToWorld([7.5, 15.9, 0]));
  follow(motion, [[9.2, 15.9, 0], [7.5, 15.9, 0]]);
});
