import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const source = await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8');
const { createWalkCollision, createWalkMotion } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const navigation = {
  obstacles: [{ id: 'wall-left', ring: rect(-4, 2, -.5, 2.12), minZ: 0, maxZ: 3 },
    { id: 'wall-right', ring: rect(.5, 2, 4, 2.12), minZ: 0, maxZ: 3 }],
  floors: [{ id: 'landing', ring: rect(-.5, 4, 2.5, 5), z: 1.6 },
    { id: 'upper', ring: rect(1.5, -3, 5, 0), z: 3.2 }],
  ramps: [{ id: 'up', start: [0, 0], end: [0, 4], width: 1, z0: 0, z1: 1.6 },
    { id: 'return', start: [2, 4], end: [2, 0], width: 1, z0: 1.6, z1: 3.2 }],
};
const motionFor = nav => createWalkMotion(createWalkCollision([]), nav);
const moveTo = (motion, x, y) => {
  const [px, py] = motion.getState().position, dx = x - px, dy = y - py;
  motion.move(1, 0, Math.hypot(dx, dy) / 2.2, Math.atan2(dx, dy));
};

test('grounded idle skips physics until a move, jump or external relocation', () => {
  let ceilingQueries = 0;
  const motion = motionFor({ ...navigation, ceilingHeight: () => { ceilingQueries++; return Infinity; } });
  motion.reset([4, -2, 3.2]);
  motion.move(1, 0, .01, 0, true);
  const before = ceilingQueries, position = motion.getState().position;
  motion.setPosition(position);
  assert.deepEqual(motion.move(0, 0, .2, 0, true), position);
  assert.equal(motion.getState().sprinting, false);
  assert.equal(ceilingQueries, before);
  motion.setPosition([8, -2]);
  motion.move(0, 0, 2);
  assert.equal(motion.getState().floorHeightM, 0);
  assert.equal(motion.getState().position[2], 1.7);
});

test('a diagonal move past a wall slides along its face', () => {
  const collision = createWalkCollision([{ ring: rect(2, -5, 2.12, 5) }]);
  const [x, y] = collision.move([0, 0], [3, 3]);
  assert.ok(Math.abs(x - (2 - collision.radius)) < 1e-6);
  assert.ok(Math.abs(y - 3) < 1e-6);
});

test('door passage remains open while walls stop sprinting and jumping', () => {
  for (const sprint of [false, true]) {
    const motion = motionFor(navigation); motion.reset([1, 0]); motion.jump(); motion.move(1, 0, 2, 0, sprint);
    assert.ok(motion.getState().position[1] < 1.721);
  }
  const motion = motionFor({ ...navigation, ramps: [] }); motion.reset([0, 0]); motion.move(1, 0, 2, 0, true);
  assert.ok(motion.getState().position[1] > 9);
});

test('two stair flights ascend and descend through landings and the upper room', () => {
  const motion = motionFor({ ...navigation, obstacles: [] }); motion.reset([0, 0]);
  moveTo(motion, 0, 4.4); assert.ok(Math.abs(motion.getState().floorHeightM - 1.6) < 1e-6);
  moveTo(motion, 2, 4.4); moveTo(motion, 2, -.5);
  assert.ok(Math.abs(motion.getState().floorHeightM - 3.2) < 1e-6);
  moveTo(motion, 4, -2); assert.equal(motion.getState().floorHeightM, 3.2);
  moveTo(motion, 2, -.5); moveTo(motion, 2, 4.4); moveTo(motion, 0, 4.4); moveTo(motion, 0, -.5);
  assert.ok(Math.abs(motion.getState().floorHeightM) < 1e-6);
  assert.ok(Math.abs(motion.getState().position[2] - 1.7) < 1e-6);
});

test('upper-floor jump lands at the same elevation and the stair opening has no support', () => {
  const motion = motionFor({ ...navigation, obstacles: [] }); motion.reset([4, -2, 3.2]); motion.jump();
  motion.move(0, 0, .35); assert.ok(motion.getState().position[2] > 4.9);
  motion.move(0, 0, 1); assert.equal(motion.getState().floorHeightM, 3.2);
  assert.equal(motion.getState().position[2], 4.9); assert.equal(motion.getState().grounded, true);
  moveTo(motion, 1, -2); motion.move(0, 0, 2);
  assert.equal(motion.getState().floorHeightM, 0); assert.equal(motion.getState().position[2], 1.7);
});

test('airborne movement cannot jump onto another floor or bypass a thin wall', () => {
  const nav = { floors: [{ id: 'raised', ring: rect(-2, 1, 2, 5), z: .5 }], ramps: [], obstacles: [] };
  const motion = motionFor(nav); motion.reset([0, 0]); motion.jump(); motion.move(1, 0, .4, 0, true);
  motion.move(0, 0, 1); assert.equal(motion.getState().floorHeightM, 0);
  const wallMotion = motionFor({ floors: [], ramps: [], obstacles: [{ id: 'thin', ring: rect(-20, 2, 20, 2.001), minZ: 0, maxZ: 5 }] });
  wallMotion.reset([0, 0]); wallMotion.jump(); wallMotion.move(1, 0, 20, 0, true);
  assert.ok(wallMotion.getState().position[1] < 1.721);
});

test('door headers limit jump height without blocking ordinary passage', () => {
  const nav = { floors: [], ramps: [], obstacles: [{ id: 'header', ring: rect(-1, -1, 1, 1), minZ: 2, maxZ: 3 }] };
  const motion = motionFor(nav); motion.reset([0, 0]); motion.jump(); motion.move(0, 0, .35);
  assert.ok(motion.getState().position[2] <= 2); motion.move(0, 0, 1);
  assert.equal(motion.getState().position[2], 1.7);
});

test('a moving jump lands on its connected uphill staircase', () => {
  const nav = { ...navigation, obstacles: [] };
  const motion = motionFor(nav); motion.reset([0, .5, .2]); motion.jump();
  for (let i = 0; i < 90; i++) motion.move(1, 0, 1 / 120);
  const state = motion.getState();
  const expectedHeight = state.position[1] / 4 * 1.6;
  assert.ok(state.grounded); assert.ok(Math.abs(state.position[2] - 1.7 - expectedHeight) < 1e-8);
  assert.ok(Math.abs(state.floorHeightM - expectedHeight) < 1e-8);
});

test('an uphill jump crosses the ramp endpoint and lands on its connected landing', () => {
  const motion = motionFor({ ...navigation, obstacles: [] }); motion.reset([0, 3, 1.2]); motion.jump();
  for (let i = 0; i < 90; i++) motion.move(1, 0, 1 / 120);
  assert.ok(motion.getState().grounded); assert.equal(motion.getState().floorHeightM, 1.6);
  assert.ok(Math.abs(motion.getState().position[2] - 3.3) < 1e-8);
});

test('a sloped upper roof blocks low headroom and limits jumps', () => {
  const nav = { obstacles: [], floors: [{ id: 'upper', ring: rect(-10, -10, 10, 10), z: 3.2 }], ramps: [],
    ceilingHeight: point => 4.2 + point[0] };
  const motion = motionFor(nav); motion.reset([2, 0, 3.2]); motion.move(0, -1, 1);
  assert.ok(motion.getState().position[0] >= .699999);
  assert.ok(motion.getState().position[2] <= nav.ceilingHeight(motion.getState().position) + 1e-6);
  motion.reset([1, 0, 3.2]); motion.jump(); motion.move(0, 0, .35);
  assert.ok(motion.getState().position[2] <= 5.2); motion.move(0, 0, 1);
  assert.equal(motion.getState().floorHeightM, 3.2); assert.ok(motion.getState().grounded);
});

test('low postures can pass under a header and require full body clearance before rising', () => {
  const nav = { floors: [], ramps: [], obstacles: [{ ring: rect(-1, 1, 1, 2), minZ: .85, maxZ: 2 }] };
  const motion = motionFor(nav);
  motion.reset([0, 0]); motion.togglePosture('crouching');
  motion.move(1, 0, 2);
  assert.ok(Math.abs(motion.getState().position[1] - .72) < 1e-6);
  motion.togglePosture('crawling'); motion.move(1, 0, 2);
  assert.ok(motion.getState().position[1] > 1);
  assert.equal(motion.togglePosture('crouching'), false);
  assert.equal(motion.togglePosture('crawling'), false);
  motion.move(1, 0, .7);
  assert.ok(motion.getState().position[1] > 2);
  assert.equal(motion.togglePosture('crawling'), false);
  motion.move(1, 0, .4);
  assert.equal(motion.togglePosture('crawling'), true);
  assert.equal(motion.getState().position[2], 1.7);
});

test('posture clearance follows upper-floor roof height and preserves airborne feet position', () => {
  const nav = { floors: [{ ring: rect(-10, -10, 10, 10), z: 3.2 }], ramps: [], obstacles: [],
    ceilingHeight: point => 4.2 + point[0] };
  const motion = motionFor(nav);
  motion.reset([2, 0, 3.2]); motion.togglePosture('crawling'); motion.move(0, -1, 6);
  assert.ok(Math.abs(motion.getState().position[0] + .62) < 1e-6);
  assert.equal(motion.togglePosture('crawling'), false);
  assert.equal(motion.togglePosture('crouching'), false);
  motion.move(0, 1, 1.4); assert.equal(motion.togglePosture('crouching'), true);
  assert.equal(motion.togglePosture('crouching'), false);
  motion.move(0, 1, 2);
  motion.jump(); motion.move(0, 0, .15);
  const jumpHeight = motion.getState().jumpHeight;
  assert.ok(jumpHeight > .2);
  assert.equal(motion.togglePosture('crouching'), true);
  assert.equal(motion.getState().jumpHeight, jumpHeight);
  motion.move(0, 0, 1); assert.equal(motion.getState().position[2], 4.9);
});

test('jumping near an overhang observes the same body radius as rising from a crawl', () => {
  const nav = { floors: [], ramps: [], obstacles: [{ ring: rect(-1, 1, 1, 2), minZ: .85, maxZ: 2 }] };
  const motion = motionFor(nav);
  for (const [y, blocked] of [[.891, true], [.70, false]]) {
    motion.reset([0, 0]); motion.togglePosture('crawling'); motion.move(1, 0, y / .55);
    assert.equal(motion.getState().posture, 'crawling');
    if (blocked) assert.equal(motion.togglePosture('crawling'), false);
    motion.jump();
    let apex = 0;
    for (let i = 0; i < 100; i++) apex = Math.max(apex, motion.move(0, 0, .01)[2]);
    assert.ok(Math.abs(apex - (blocked ? .85 : .98)) < .001);
    assert.equal(motion.getState().grounded, true);
  }
});
