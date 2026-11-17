import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8')
  .replaceAll("'three/core'", `'${imports['three/core']}'`));
const { solarAppearance, setupSolarSky, setupSolarAtmosphere } = await load(await readFile(
  new URL('../src/model/solar-sky.js', import.meta.url), 'utf8'));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const channel = (hex, shift) => (hex >> shift) & 255;
function captureSky() {
  const calls = [];
  const renderer = { autoClear: true, shadowMap: { needsUpdate: true },
    render(scene, camera) {
      calls.push({ scene, camera, autoClear: this.autoClear });
      this.shadowMap.needsUpdate = false;
    } };
  return { sky: setupSolarSky({ THREE }), renderer, calls };
}
const selected = { active: true, elevationDeg: 4, direction: [1, 0, Math.tan(4 * Math.PI / 180)] };
function worldRay(uniforms, x = 0, y = 0) {
  const point = new THREE.Vector4(x, y, 1, 1).applyMatrix4(uniforms.inverseProjection.value);
  const ray = uniforms.orthographic.value ? new THREE.Vector3(0, 0, -1)
    : new THREE.Vector3(point.x / point.w, point.y / point.w, point.z / point.w).normalize();
  return ray.applyMatrix3(uniforms.cameraRotation.value).normalize();
}

test('low sun is red-orange, daytime sun is pale, twilight fades continuously', () => {
  const horizon = solarAppearance(0), day = solarAppearance(45), night = solarAppearance(-15);
  assert.ok(channel(horizon.sunColor, 8) < channel(day.sunColor, 8));
  assert.ok(channel(horizon.sunColor, 0) < channel(day.sunColor, 0));
  assert.ok(channel(horizon.horizonColor, 16) > channel(horizon.horizonColor, 0));
  assert.ok(channel(day.zenithColor, 0) > channel(night.zenithColor, 0));
  assert.equal(horizon.diskVisibility, 1);
  assert.equal(night.diskVisibility, 0);
  assert.ok(solarAppearance(-.1).diskVisibility > 0 && solarAppearance(-.1).diskVisibility < 1);
  assert.ok(horizon.sunIntensityFactor < day.sunIntensityFactor);
  for (const elevation of [NaN, Infinity, '0']) assert.throws(() => solarAppearance(elevation), RangeError);
});

test('walking sky aims at astronomical sun independently of camera translation and clip planes', () => {
  const { sky, renderer, calls } = captureSky();
  const camera = new THREE.PerspectiveCamera(65, 1.7, .04, 250);
  camera.up.set(0, 0, 1);
  camera.position.set(15, -30, 1.7);
  const direction = new THREE.Vector3(...selected.direction).normalize();
  camera.lookAt(camera.position.clone().add(direction));
  sky.render(renderer, camera, selected);
  const uniforms = calls[0].scene.children[0].material.uniforms;
  near(worldRay(uniforms).dot(direction), 1);
  near(uniforms.sunDirection.value.dot(direction), 1);
  near(uniforms.diskRadius.value * 360 / Math.PI, 1.06);
  const before = worldRay(uniforms, .4, -.2);
  camera.position.add(new THREE.Vector3(1500, -800, 45));
  camera.near = .001; camera.far = 9000; camera.updateProjectionMatrix();
  sky.render(renderer, camera, selected);
  near(worldRay(uniforms, .4, -.2).distanceTo(before), 0);
  sky.dispose();
});

test('orthographic rays stay parallel and sky never enters the model bounds or depth buffer', () => {
  const { sky, renderer, calls } = captureSky();
  const world = new THREE.Scene();
  const building = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 8), new THREE.MeshBasicMaterial());
  world.add(building);
  const bounds = new THREE.Box3().setFromObject(world);
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, .1, 200);
  camera.up.set(0, 0, 1); camera.position.set(25, -25, 30); camera.lookAt(0, 0, 0);
  sky.render(renderer, camera, selected);
  const { scene, autoClear } = calls[0], quad = scene.children[0];
  assert.notEqual(scene, world);
  assert.deepEqual(new THREE.Box3().setFromObject(world), bounds);
  assert.equal(quad.material.depthWrite, false);
  assert.equal(quad.material.depthTest, false);
  assert.equal(quad.frustumCulled, false);
  assert.equal(autoClear, false);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.shadowMap.needsUpdate, true, 'background pass preserves pending world shadow update');
  near(worldRay(quad.material.uniforms, -1, 1).distanceTo(worldRay(quad.material.uniforms, 1, -1)), 0);
  sky.dispose();
});

test('sky renders before controls are activated; disposal and failures preserve renderer state', () => {
  const { sky, renderer, calls } = captureSky();
  const camera = new THREE.PerspectiveCamera();
  assert.equal(sky.render(renderer, camera, { ...selected, active: false }), true);
  assert.equal(calls.length, 1);
  renderer.render = () => { renderer.shadowMap.needsUpdate = false; throw new Error('context lost'); };
  assert.throws(() => sky.render(renderer, camera, selected), /context lost/);
  assert.equal(renderer.autoClear, true);
  assert.equal(renderer.shadowMap.needsUpdate, true);
  sky.dispose();
  assert.equal(sky.render(renderer, camera, selected), false);
});


test('atmosphere is independent of controls activation and keeps nighttime sun off', () => {
  const sun = new THREE.DirectionalLight(0xf8f0dd, 3.6);
  const hemi = new THREE.HemisphereLight(0xaabbcc, 0x556644, 2.4);
  const baseline = { hemi: hemi.color.clone(), ground: hemi.groundColor.clone() };
  const atmosphere = setupSolarAtmosphere({ sun, hemi });
  const active = { ...selected, daylight: true };
  atmosphere.update(active);
  const warmColor = sun.color.clone(), intensity = sun.intensity, ambient = hemi.intensity;
  atmosphere.update(active);
  assert.deepEqual(sun.color, warmColor);
  assert.equal(sun.intensity, intensity);
  assert.equal(hemi.intensity, ambient);
  assert.ok(intensity < 3.6);
  atmosphere.update({ ...active, active: false });
  assert.deepEqual(sun.color, warmColor);
  assert.equal(sun.intensity, intensity);
  assert.deepEqual(hemi.color, baseline.hemi);
  assert.deepEqual(hemi.groundColor, baseline.ground);
  assert.equal(hemi.intensity, ambient);
  atmosphere.update({ ...active, daylight: false, elevationDeg: -15 });
  assert.equal(sun.intensity, 0);
  assert.ok(hemi.intensity < 2.4);
  const nightAmbient = hemi.intensity;
  atmosphere.update({ ...active, active: false, daylight: false, elevationDeg: -15 });
  assert.equal(sun.intensity, 0);
  assert.equal(hemi.intensity, nightAmbient);
});
