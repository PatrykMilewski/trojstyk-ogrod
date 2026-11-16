import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const solar = await import(moduleUrl(await readFile(new URL('../src/model/solar.js', import.meta.url), 'utf8')));
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const threeSource = Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8');
const THREE = await import(moduleUrl(threeSource.replaceAll("'three/core'", `'${imports['three/core']}'`)));
assert.ok(html.includes((await readFile(new URL('../src/model/solar.js', import.meta.url), 'utf8')).replaceAll('export ', '')));
assert.ok(html.includes(await readFile(new URL('../src/model/map-layers.js', import.meta.url), 'utf8')));
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

// Independent reference: pvlib 0.16.1 spa_python (NREL SPA), pressure=0, altitude=0.
// https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.solarposition.spa_python.html
// Generated at SITE coordinates; geometric elevation, no refraction, UTC instants.
const reference = [
  ['2026-07-20T13:50:00Z', 242.5313199282, 42.4886295403],
  ['2026-06-21T04:00:00Z', 66.7019806658, 12.2740577837],
  ['2026-06-21T18:00:00Z', 297.877380586, 9.1385877826],
  ['2026-12-21T11:00:00Z', 183.6865266333, 12.0551991061],
  ['2026-03-20T11:00:00Z', 181.9388504222, 35.4885119049],
  ['2026-07-20T22:00:00Z', 347.287330561, -14.2019515461],
];
for (const [instant, azimuth, elevation] of reference) {
  const position = solar.solarPosition(new Date(instant));
  near(position.azimuthDeg, azimuth, .02, `${instant} azimuth`);
  near(position.elevationDeg, elevation, .02, `${instant} elevation`);
}
assert.equal(solar.warsawInstant('2026-07-20', '15:50').toISOString(), '2026-07-20T13:50:00.000Z');
assert.equal(solar.warsawInstant('2026-01-20', '15:50').toISOString(), '2026-01-20T14:50:00.000Z');
assert.equal(solar.warsawInstant('2026-03-29', '01:30').toISOString(), '2026-03-29T00:30:00.000Z');
assert.equal(solar.warsawInstant('2026-03-29', '03:30').toISOString(), '2026-03-29T01:30:00.000Z');
for (const [date, time] of [['2026-03-29', '02:30'], ['2026-10-25', '02:30'], ['2026-02-30', '12:00'], ['2026-02-20', '24:00'], ['', ''], ['1999-12-01', '12:00']]) {
  assert.throws(() => solar.warsawInstant(date, time), RangeError);
}
assert.throws(() => solar.solarPosition(new Date('invalid')), RangeError);
const trueNorth = solar.sunDirection({ azimuthDeg: 0, elevationDeg: 0 });
assert.ok(trueNorth[0] < 0 && trueNorth[1] > 0, 'true north points west of grid north east of central meridian');
const east = solar.sunDirection({ azimuthDeg: 90 + solar.SITE.gridConvergenceDeg, elevationDeg: 0 });
near(east[0], 1, 1e-12, 'east x'); near(east[1], 0, 1e-12, 'east y');

const scene = new THREE.Scene();
const house = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 12), new THREE.MeshBasicMaterial());
house.position.set(20, 15, 6); house.castShadow = true; scene.add(house);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 180), new THREE.MeshBasicMaterial());
ground.receiveShadow = true; scene.add(ground);
const sun = new THREE.DirectionalLight(0xffffff, 3.6); scene.add(sun, sun.target);
const renderer = { shadowMap: { needsUpdate: false, autoUpdate: false } };
let draws = 0;
const controller = solar.setupSolar({ THREE, scene, sun, renderer, requestDraw: () => draws++ });
assert.equal(controller.getState().instant, '2026-07-20T13:50:00.000Z');
for (const [date, time] of [['2026-07-20', '15:50'], ['2026-06-21', '06:00'], ['2026-06-21', '20:00'], ['2026-12-21', '12:00']]) {
  renderer.shadowMap.needsUpdate = false; sun.shadow.needsUpdate = false;
  const state = controller.setLocal(date, time);
  assert.ok(renderer.shadowMap.needsUpdate && sun.shadow.needsUpdate, 'frozen shadow map invalidated on every selection');
  const delta = sun.position.clone().sub(sun.target.position).normalize();
  state.direction.forEach((value, i) => near(delta.toArray()[i], value, 1e-12, 'directional light aims from sun'));
  const bounds = new THREE.Box3().setFromObject(ground).union(new THREE.Box3().setFromObject(house));
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(sun.shadow.camera);
    assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && Math.abs(p.z) < 1, 'all caster and receiver bounds within shadow frustum');
  }
}
const previous = controller.getState();
assert.throws(() => controller.setLocal('2026-02-30', '12:00'), RangeError);
assert.deepEqual(controller.getState(), previous, 'invalid selection preserves lighting');
controller.setLocal('2026-07-21', '00:00');
assert.equal(sun.intensity, 0); assert.equal(sun.castShadow, false);
controller.setLocal('2026-07-20', '15:50');
assert.equal(sun.intensity, 3.6); assert.equal(sun.castShadow, true);
assert.ok(draws >= 7);
const farRoad = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial());
farRoad.receiveShadow = true; scene.add(farRoad);
const bounded = solar.setupSolar({ THREE, scene, sun, renderer, requestDraw() {},
  shadowBounds: { min: [-50, -40, -.35], max: [60, 50, 15] } });
assert.ok(sun.shadow.camera.right - sun.shadow.camera.left < 160, 'bounded core ignores distant road and map extents');
assert.equal(sun.shadow.mapSize.x, 4096);
bounded.dispose();
console.log('Solar checks passed: 6 independent NREL SPA cases, Warsaw DST/validation, grid direction, day/night, shadow coverage and invalidation.');
