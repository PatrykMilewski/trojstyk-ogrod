import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const core = Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8').replaceAll("'three/core'", `'${imports['three/core']}'`);
const THREE = await import(`data:text/javascript;base64,${Buffer.from(core).toString('base64')}`);
const source = await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8');
assert(html.includes(source.replaceAll('export ', '')), 'Walking source must match the published runtime');
const { createWalkGyroscope, createOrbitDepthGuard, createWalkCollision, createWalkMotion, walkHouseFootprints } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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


test('sprint uses 2.2 times walking speed with normalized diagonals and released controls', () => {
  const motion = createWalkMotion(createWalkCollision([]));
  motion.reset([0, 0]); motion.move(1, 0, 1);
  assert.equal(motion.getState().position[1], 2.2);
  motion.reset([0, 0]); motion.move(1, 0, 1, 0, true);
  assert.ok(Math.abs(motion.getState().position[1] - 4.84) < 1e-12);
  assert.equal(motion.getState().sprinting, true);
  motion.clearSprint(); assert.equal(motion.getState().sprinting, false);
  motion.reset([0, 0]); motion.move(1, 1, 1, 0, true);
  assert.ok(Math.abs(Math.hypot(...motion.getState().position.slice(0, 2)) - 4.84) < 1e-12);
  motion.move(0, 0, 1, 0, true); assert.equal(motion.getState().sprinting, false);
  assert.throws(() => motion.move(1, 0, -1), TypeError);
});

test('jump reaches 0.6 m, rejects air jumps, and lands exactly at the base eye height', () => {
  const motion = createWalkMotion(createWalkCollision([])), initial = motion.getState();
  const apexTime = Math.sqrt(2 * initial.jumpHeightM / initial.gravityMps2);
  assert.equal(motion.jump(), true); assert.equal(motion.jump(), false);
  motion.move(0, 0, apexTime);
  assert.ok(Math.abs(motion.getState().jumpHeight - .6) < 1e-12);
  assert.equal(motion.getState().grounded, false); assert.equal(motion.jump(), false);
  motion.move(0, 0, apexTime + .01);
  assert.equal(motion.getState().position[2], 1.7);
  assert.equal(motion.getState().jumpHeight, 0); assert.equal(motion.getState().grounded, true);
  motion.move(0, 0, 10); assert.equal(motion.getState().position[2], 1.7);
  assert.equal(motion.jump(), true); motion.reset([10, 20]);
  assert.deepEqual(motion.getState().position, [10, 20, 1.7]); assert.equal(motion.getState().grounded, true);
});

test('sprint and ballistic jump are independent of frame size in open ground', () => {
  function simulate(steps) {
    const motion = createWalkMotion(createWalkCollision([])); motion.reset([20, 20]); motion.jump();
    for (let i = 0; i < steps; i++) motion.move(1, 1, .45 / steps, .7, true);
    return motion.getState();
  }
  const one = simulate(1);
  for (const steps of [2, 30, 144]) {
    const sampled = simulate(steps);
    sampled.position.forEach((value, index) => assert.ok(Math.abs(value - one.position[index]) < 1e-10));
    assert.equal(sampled.grounded, false); assert.ok(sampled.jumpHeight > 0 && sampled.jumpHeight <= .6);
  }
});

test('jumping and sprinting never bypass any real house footprint', () => {
  for (const item of footprints) {
    const collision = createWalkCollision([item]), motion = createWalkMotion(collision);
    const xs = item.ring.map(point => point[0]), ys = item.ring.map(point => point[1]);
    const start = [Math.min(...xs) - 1, (Math.min(...ys) + Math.max(...ys)) / 2];
    motion.reset(start); motion.jump();
    const end = motion.move(1, 0, .35, Math.PI / 2, true);
    assert.ok(end[2] > 1.7); assert.equal(collision.blocked(end), false);
    assert.equal(collision.pathBlocked(start, end), false);
  }
});

function gyroHarness(requestPermission, touch = true) {
  const host = new EventTarget(), screen = { orientation: { angle: 0 } }, doc = new EventTarget();
  Object.assign(host, { DeviceOrientationEvent: { requestPermission }, navigator: { maxTouchPoints: Number(touch) },
    document: doc, screen, isSecureContext: true, matchMedia: () => ({ matches: false }) });
  const button = new EventTarget(); button.setAttribute = (key, value) => { button[key] = value; };
  const view = { yaw: .31, pitch: -.15 };
  const gyro = createWalkGyroscope(THREE, button, (dx, dy) => { view.yaw += dx; view.pitch += dy; }, host);
  const radians = Math.PI/180;
  function pose(yaw, pitch, roll = screen.orientation.angle) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch*radians,0,-yaw*radians,'ZXY'));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),roll*radians));
    const angles = new THREE.Euler().setFromQuaternion(q, 'ZXY');
    host.dispatchEvent(Object.assign(new Event('deviceorientation'), {alpha:angles.z/radians,beta:angles.x/radians,gamma:angles.y/radians}));
  }
  return { gyro, view, host, doc, screen, button, pose };
}

const nearAngle = (actual, expected) => assert(Math.abs(actual-expected)<1e-5, `${actual} vs ${expected}`);

test('walk gyro calibrates in portrait, both landscapes, and flat, then composes with drag and heading wrap', () => {
  for (const angle of [0,90,270]) for (const tilt of [0,55,90]) {
    const {gyro, view, pose, screen} = gyroHarness(); screen.orientation.angle = angle; gyro.enter();
    pose(358,tilt); nearAngle(view.yaw,.31); nearAngle(view.pitch,-.15);
    view.yaw += .6; view.pitch += .3;
    pose(8,tilt+12); nearAngle(view.yaw,.91+10*Math.PI/180); nearAngle(view.pitch,.15+12*Math.PI/180);
    pose(358,tilt); nearAngle(view.yaw,.91); nearAngle(view.pitch,.15);
    gyro.exit(); pose(88,45); nearAngle(view.yaw,.91); nearAngle(view.pitch,.15);
  }
});

test('walk gyro rebases after screen rotation, hidden tabs and re-entry and retains an explicit opt-out', () => {
  const {gyro,view,screen,doc,host,button,pose} = gyroHarness(); gyro.enter(); pose(0,65); pose(10,65);
  const before = {...view}; screen.orientation.angle=90; pose(174,45); assert.deepEqual(view,before);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));pose(82,42);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));pose(221,18);assert.deepEqual(view,before);
  host.dispatchEvent(new Event('pageshow'));pose(66,22);assert.deepEqual(view,before);
  button.dispatchEvent(new Event('click'));assert.equal(button['aria-pressed'],'false');
  gyro.exit();gyro.enter();pose(66,25);pose(77,49);assert.deepEqual(view,before);
  button.dispatchEvent(new Event('click'));pose(88,52);assert.deepEqual(view,before);
  pose(98,52);nearAngle(view.yaw,before.yaw+10*Math.PI/180);
});

test('iOS requests permission within entry gesture and discards responses after exit; denial and unsupported desktops keep touch look', async () => {
  let calls=0,resolve;
  const {gyro,view,button,host,pose}=gyroHarness(()=>{calls++;return new Promise(r=>{resolve=r;});});
  gyro.enter();assert.equal(calls,1);gyro.exit();resolve('granted');await Promise.resolve();
  pose(0,80);pose(50,100);nearAngle(view.yaw,.31);
  gyro.enter();await Promise.resolve();assert.equal(calls,1);
  host.dispatchEvent(Object.assign(new Event('deviceorientation'),{alpha:null,beta:null,gamma:null}));
  assert.equal(button.textContent,'Żyroskop · oczekiwanie');pose(87,66);pose(97,66);nearAngle(view.yaw,.31+10*Math.PI/180);
  const denied=gyroHarness(()=>Promise.resolve('denied'));denied.gyro.enter();await Promise.resolve();
  assert.equal(denied.button['aria-pressed'],'false');denied.pose(90,75);denied.pose(0,32);nearAngle(denied.view.yaw,.31);
  const desktop=gyroHarness(()=>{throw new Error('unexpected');},false);desktop.gyro.enter();assert(desktop.button.hidden);
});
