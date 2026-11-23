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
const { createWalkMotion, createWalkCollision, mergeInteriorNavigation } = await load(await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8'));
const data = JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json', import.meta.url), 'utf8'));
test('room dimensions agree with the basic Icon product card and enclose the finished floor outlines', () => {
  const areas = [35.87, 6.37, 4.32, 61.31, 5.39, 10.35, 3.37, 12.63, 13.14,
    16.93, 5.95, 14.23, 16.02, 6.47, 5.52, 5.12, 13.57];
  assert.deepEqual(data.rooms.map(room => room.area), areas);
  const spansMm = [[5950, 6030], [3110, 2460], [2700, 1600], [8400, 8040], [4490, 1200],
    [4610, 3260], [2570, 1430], [2800, 4510], [5100, 2790], [7500, 3100], [4270, 1900],
    [4270, 4400], [4890, 6580], [2470, 4080], [2640, 3110], [2450, 3110], [4200, 4250]];
  for (const [i, room] of data.rooms.entries()) {
    const [left, front, right, back] = room.box;
    assert.deepEqual([right - left, back - front].map(m => Math.round(m * 1000)), spansMm[i], room.id);
    if (!room.outline) continue;
    const x = room.outline.map(point => point[0]);
    const y = room.outline.map(point => point[1]);
    assert.deepEqual(room.box, [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)], room.id);
  }
});
const embedded = html.match(/const interiorData=(.*);\nconst interior=addIconInterior/);
assert(embedded, 'Embedded interior dimensions');
test('published interior dimensions match source', { skip: sourceOnly }, () => {
  assert.deepEqual(JSON.parse(embedded[1]), data, 'Interior dimensions must match published runtime');
});
const { navigation, localToWorld } = addIconInterior({ THREE, scene: new THREE.Scene(), house, data });
const stairs = [[7.4, 8.8, 0], [8.39, 9.23, 0], [8.39, 11.31, 1.6], [8.39, 11.8, 1.6],
  [9.35, 11.8, 1.6], [9.35, 11.31, 1.6], [9.35, 9.23, 3.2], [9.35, 8.6, 3.2], [8.7, 8.6, 3.2]];
const routes = {
  '0.1': [[7.4, 5.5], [5.5, 5.5]],
  '0.2': [[7.4, 5.5], [1.60, 5.5], [1.60, 7.5]],
  '0.3': [[7.4, 5.5], [5.1, 5.5], [5.1, 7.5]],
  '0.4': [[7.4, 8.8], [7.1, 9.75], [5, 9.75]],
  '0.5': [[7.4, 8.6]],
  '0.6': [[7.5, 6]],
  '0.7': [[7.4, 8.6], [9.81, 8.6], [9.81, 7.32]],
  '0.8': [[7.4, 8.8], [10.6, 8.62], [12, 8.62], [12, 7]],
  '0.9': [[7.4, 8.8], [10.70, 8.8], [10.70, 10.12], [10.3, 10.5], [10.16, 11.9]],
  '1.1': [[5.6, 8.6], [5.6, 4.5], [5.7, 2]],
  '1.2': [[5.6, 8.6], [5.6, 5.1], [3, 5.1]],
  '1.3': [[5.6, 8.6], [5.6, 7.39], [3.5, 7.39]],
  '1.4': [[5.6, 8.6]],
  '1.5': [[5.6, 8.6], [5.6, 6.6], [7.1, 6.6]],
  '1.6': [[9.2, 8.6], [10.45, 8.6], [10.45, 6.8]],
  '1.7': [[10.6, 8.6], [13, 8.6], [13, 6.8]],
  '1.8': [[10.6, 8.6], [10.27, 9.60]],
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
function descendInFrames(route, fps) {
  const combined = mergeInteriorNavigation([{ parcel: '193', navigation }]);
  const motion = createWalkMotion(createWalkCollision([]), combined);
  let start = localToWorld(route[0]);
  motion.reset(start);
  for (const local of route.slice(1)) {
    const end = localToWorld(local), dx = end[0] - start[0], dy = end[1] - start[1];
    const duration = Math.hypot(dx, dy) / 2.2, frames = Math.ceil(duration * fps);
    for (let frame = 1; frame <= frames; frame++) {
      motion.move(1, 0, duration / frames, Math.atan2(dx, dy));
      const { position, floorHeightM, grounded } = motion.getState(), t = frame / frames;
      assert.ok(Math.hypot(position[0] - start[0] - dx * t, position[1] - start[1] - dy * t) < 1e-6,
        `Interrupted descent toward ${local} at frame ${frame}/${frames}`);
      assert.ok(grounded && Math.abs(floorHeightM - (start[2] + (end[2] - start[2]) * t)) < 1e-6);
      assert.ok(Math.abs(position[2] - floorHeightM - 1.7) < 1e-6);
    }
    start = end;
  }
}

test('descent stays continuous across both flight widths and around the landing', () => {
  const [sx, sy, ex, ey] = data.stairs.box;
  const turnY = ey - data.stairs.landingDepth, half = data.stairs.floorHeight / 2;
  for (const [upper, lower, fps] of [[9.2, 8.56, 30], [9.29, 8.5, 60], [9.35, 8.39, 60], [9.50, sx+.31, 120]]) {
    const upperAtTurn = upper + ((ex - data.stairs.width / 2) - upper) * .3;
    const center = (upperAtTurn + lower) / 2, radius = (upperAtTurn - lower) / 2;
    const turn = Array.from({ length: 13 }, (_, i) => {
      const angle = i * Math.PI / 12;
      return [center + radius * Math.cos(angle), turnY + radius * Math.sin(angle), half];
    });
    const foot = lower + ((sx + data.stairs.width / 2) - lower) * .3;
    descendInFrames([[upper - .05, sy - .50, half * 2], [upper, sy, half * 2], ...turn,
      [foot, sy, 0], [foot + .07, sy - .43, 0]], fps);
  }
});

test('the fitted cabinets below the upper flight remain solid from the office', () => {
  const motion = createWalkMotion(createWalkCollision([]), navigation);
  const start = localToWorld([10.45, 10.4, 0]), end = localToWorld([9.12, 10.4, 0]);
  motion.reset(start);
  motion.move(1, 0, 1, Math.atan2(end[0] - start[0], end[1] - start[1]));
  const { position, floorHeightM } = motion.getState();
  const cabinet = data.furniture.find(item => item.id === 'office-under-stair-2');
  const contact = localToWorld([cabinet.box[2] + .28, 10.4, 0]);
  assert.ok(Math.hypot(position[0] - contact[0], position[1] - contact[1]) < 1e-6);
  assert.equal(floorHeightM, 0);
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
