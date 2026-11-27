import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const solar = await import(moduleUrl(await readFile(new URL('../src/model/solar.js', import.meta.url), 'utf8')));
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const threeSource = Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8');
const THREE = await import(moduleUrl(threeSource.replaceAll("'three/core'", `'${imports['three/core']}'`)));
for (const file of process.argv.includes('--source-only') ? [] : ['solar.js', 'solar-sky.js', 'map-layers.js', 'vegetation.js', 'view-ui.js', 'tree-realism.js', 'garden-plantings.js', 'surface-realism.js', 'figure-finishes.js', 'outdoor-equipment.js', 'static-detail-batches.js', 'cars.js', 'people-dogs.js', 'lawn-detail.js', 'daylight-finish.js']) {
  assert.ok(html.includes((await readFile(new URL('../src/model/'+file, import.meta.url), 'utf8')).replaceAll('export ', '')), file+' embedded source');
}
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
// USNO season instants converted to Europe/Warsaw civil dates, including leap-year changes.
// https://aa.usno.navy.mil/calculated/seasons?dst=false&tz=0.00&tz_label=false&tz_sign=-1&year=2026
const seasons = ['spring', 'summer', 'autumn', 'winter'];
for (const [year, dates] of [
  [2024, ['03-20', '06-20', '09-22', '12-21']],
  [2026, ['03-20', '06-21', '09-23', '12-21']],
  [2027, ['03-20', '06-21', '09-23', '12-22']],
  [2028, ['03-20', '06-20', '09-22', '12-21']],
]) {
  seasons.forEach((season, index) => assert.equal(solar.solarSeasonDate(year, season), `${year}-${dates[index]}`));
}
for (const args of [[1999, 'spring'], [2101, 'summer'], [2026.5, 'autumn'], [2026, 'unknown'], [2026, 'toString']]) {
  assert.throws(() => solar.solarSeasonDate(...args), RangeError);
}
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
const selected = controller.getState();
for (const strength of [0, .3, 1]) {
  const shadow = controller.setShadowStrength(strength);
  assert.equal(sun.shadow.intensity, strength, 'slider changes Three.js shadow intensity');
  assert.equal(shadow.shadowStrength, strength);
  assert.equal(shadow.instant, selected.instant, 'shadow strength preserves selected instant');
  assert.deepEqual(shadow.direction, selected.direction, 'shadow strength preserves astronomical direction');
  assert.equal(sun.intensity, 3.6, 'shadow strength does not dim direct light');
}
for (const value of [-.1, 1.1, NaN, '1']) assert.throws(() => controller.setShadowStrength(value), RangeError);
assert.equal(sun.shadow.intensity, 1, 'invalid strength preserves last valid shadow');
controller.setLocal('2028-02-29', '16:35');
assert.equal(controller.setPreset('summer').date, '2028-06-20', 'preset follows selected year');
assert.equal(controller.getState().time, '16:35', 'season preset retains local clock time');
assert.equal(controller.setPreset('winter').date, '2028-12-21');
const currentInstant = new Date('2026-10-25T01:30:00Z');
assert.equal(controller.setPreset('today', currentInstant).instant, currentInstant.toISOString(), 'today uses absolute current instant during repeated autumn hour');
assert.equal(controller.getState().time, '02:30');
assert.equal(controller.getState().year, 2026);
assert.throws(() => controller.setPreset('today', new Date('2101-01-01T12:00:00Z')), RangeError);
controller.setLocal('2026-07-20', '15:50');
assert.ok(draws >= 7);
const farRoad = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial());
farRoad.receiveShadow = true; scene.add(farRoad);
const neighborhoodBounds = { min: [-170, -210, -.35], max: [260, 230, 15] };
let viewRedraws = 0;
const bounded = solar.setupSolar({ THREE, scene, sun, renderer, requestDraw() { viewRedraws++; },
  shadowBounds: { min: [-50, -40, -.35], max: [60, 50, 15] }, neighborhoodShadowBounds: neighborhoodBounds });
assert.ok(sun.shadow.camera.right - sun.shadow.camera.left < 160, 'bounded core ignores distant road and map extents');
assert.equal(sun.shadow.mapSize.x, 4096);
const coreProjection = sun.shadow.camera.projectionMatrix.clone();
const initialSolar = bounded.getState();
bounded.setNeighborhoodView(true);
assert.deepEqual(bounded.getState(), initialSolar, 'view switch preserves the solar clock and activation');
const afterViewSwitch = viewRedraws;
renderer.shadowMap.needsUpdate = false; sun.shadow.needsUpdate = false;
bounded.setNeighborhoodView(true);
assert.equal(viewRedraws, afterViewSwitch, 'repeated neighborhood camera frames do not enqueue redraws');
assert.ok(!renderer.shadowMap.needsUpdate && !sun.shadow.needsUpdate);
for (const time of ['15:50', '06:00']) {
  bounded.setLocal('2026-07-20', time);
  for (const x of [-170, 260]) for (const y of [-210, 230]) for (const z of [-.35, 15]) {
    const ndc = new THREE.Vector3(x, y, z).project(sun.shadow.camera);
    assert.ok(ndc.toArray().every(component => Math.abs(component) < 1), 'all neighborhood corners fit at both sun angles');
  }
}
bounded.setLocal('2026-07-20', '15:50');
renderer.shadowMap.needsUpdate = false; sun.shadow.needsUpdate = false;
bounded.setNeighborhoodView(false);
assert.ok(sun.shadow.camera.projectionMatrix.equals(coreProjection), 'returning to the core restores its shadow resolution');
assert.ok(renderer.shadowMap.needsUpdate && sun.shadow.needsUpdate, 'view transition invalidates frozen shadow maps');
bounded.dispose();
function fakeClock() {
  let timestamp = 0, nextId = 0;
  const frames = new Map(), listeners = new Map();
  const visibilityDocument = { hidden: false,
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: event => listeners.delete(event) };
  return { options: { now: () => timestamp, visibilityDocument,
    requestFrame: callback => { frames.set(++nextId, callback); return nextId; },
    cancelFrame: id => frames.delete(id) },
    step(milliseconds) {
      timestamp += milliseconds;
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(callback => callback(timestamp));
    },
    hide() { visibilityDocument.hidden = true; listeners.get('visibilitychange')?.(); },
    show() { visibilityDocument.hidden = false; listeners.get('visibilitychange')?.(); },
    pending: () => frames.size, listenerCount: () => listeners.size };
}

const clock = fakeClock();
let activations = 0;
const animated = solar.setupSolar({ THREE, scene, sun, renderer, requestDraw() {},
  onActivate: () => activations++, playbackClock: clock.options });
assert.equal(activations, 0, 'initial setup preserves parent backdrop');
assert.equal(animated.getState().active, false);
assert.equal(animated.getState().secondsPerHour, 3);
animated.activate();
assert.equal(activations, 1);
assert.equal(animated.getState().active, true);
animated.setLocal('2026-07-20', '23:30');
animated.play(); animated.play();
assert.equal(clock.pending(), 1, 'repeated play cannot create duplicate animation loops');
clock.step(1500);
assert.equal(animated.getState().instant, '2026-07-20T22:00:00.000Z', 'default playback advances half hour in 1.5 seconds');
assert.equal(animated.getState().date, '2026-07-21', 'playback crosses local midnight');
assert.equal(animated.getState().time, '00:00');
clock.step(50);
assert.equal(animated.getState().seconds, '00');
assert.equal(animated.getState().time, '00:01', 'minute-level continuous progression');
clock.step(50);
assert.equal(animated.getState().time, '00:02');
animated.pause();
const paused = animated.getState().instant;
clock.step(5000);
assert.equal(animated.getState().instant, paused);
assert.equal(clock.pending(), 0);
animated.setPlaybackSpeed(6);
animated.play(); clock.step(3000);
assert.equal(new Date(animated.getState().instant) - new Date(paused), 1800000, 'adjusted speed advances half hour in 3 seconds');
animated.setShadowStrength(.4);
assert.equal(animated.getState().playing, true, 'shadow slider keeps playback running');
assert.equal(animated.getState().shadowStrength, .4);
animated.setPlaybackSpeed(1);
const faster = animated.getState().instant;
clock.step(500);
assert.equal(new Date(animated.getState().instant) - new Date(faster), 1800000, 'speed can change while playing without discontinuity');
assert.throws(() => animated.setPlaybackSpeed(0), RangeError);
assert.throws(() => animated.setPlaybackSpeed(NaN), RangeError);
assert.throws(() => animated.setPlaybackSpeed(16), RangeError);
clock.hide();
assert.equal(animated.getState().playing, false, 'hidden document pauses playback');
const hidden = animated.getState().instant;
clock.step(100000); clock.show();
assert.equal(animated.getState().instant, hidden, 'hidden time never jumps simulation forward');
assert.equal(clock.pending(), 0);
animated.setPlaybackSpeed(3);
animated.setLocal('2026-03-29', '01:30');
animated.play(); clock.step(3000);
assert.equal(animated.getState().time, '03:30', 'spring DST skips missing civil hour');
assert.equal(animated.getState().instant, '2026-03-29T01:30:00.000Z');
animated.setLocal('2026-10-25', '01:30');
animated.play(); clock.step(3000);
assert.equal(animated.getState().time, '02:30');
const firstAutumn = animated.getState().instant;
clock.step(3000);
assert.equal(animated.getState().time, '02:30', 'autumn repeated hour remains valid during absolute playback');
assert.equal(new Date(animated.getState().instant) - new Date(firstAutumn), 3600000);
animated.setLocal('2026-12-31', '23:30');
animated.play(); clock.step(3000);
assert.equal(animated.getState().date, '2027-01-01', 'year rollover is synchronized');
assert.equal(animated.getState().day, 1);
animated.setLocal('2028-02-29', '12:00');
assert.equal(animated.getState().day, 60);
assert.equal(animated.getState().daysInYear, 366);
animated.setLocal('2026-02-28', '12:00');
assert.equal(animated.getState().daysInYear, 365);
animated.play();
const beforeCap = animated.getState().instant;
clock.step(10);
assert.equal(animated.getState().instant, beforeCap, 'lighting render capped at 20 fps');
clock.step(40);
assert.equal(new Date(animated.getState().instant) - new Date(beforeCap), 60000);
animated.pause();
animated.setPlaybackSpeed(15); animated.play(); clock.step(50);
assert.equal(animated.getState().seconds, '12', 'playback preserves sub-minute time');
animated.deactivate();
assert.equal(animated.getState().playing, false);
assert.equal(animated.getState().active, false);
animated.play();
assert.equal(animated.getState().active, true);
assert.ok(clock.pending() > 0);
animated.dispose();
assert.equal(clock.pending(), 0, 'dispose cancels outstanding RAF');
assert.equal(clock.listenerCount(), 0, 'dispose removes visibility listener');
animated.play();
assert.equal(clock.pending(), 0, 'disposed playback cannot restart');
function fakeControls() {
  const elements = new Map();
  return { querySelector(selector) {
    if (!elements.has(selector)) {
      const callbacks = new Map(), attributes = new Map();
      elements.set(selector, { value: '', textContent: '',
        addEventListener: (name, callback) => callbacks.set(name, callback),
        removeEventListener: name => callbacks.delete(name),
        setAttribute: (name, value) => attributes.set(name, value),
        removeAttribute: name => attributes.delete(name),
        getAttribute: name => attributes.get(name),
        emit: name => callbacks.get(name)?.() });
    }
    return elements.get(selector);
  } };
}
const ui = fakeControls(), uiClock = fakeClock();
let uiActivations = 0;
const uiController = solar.setupSolar({ THREE, scene, sun, renderer, container: ui,
  requestDraw() {}, onActivate: () => uiActivations++, playbackClock: uiClock.options });
const control = name => ui.querySelector(`#solar-${name}`);
assert.equal(uiActivations, 0);
assert.equal(control('minute').value, '950');
assert.equal(control('shadow').value, '40', 'shadow slider initializes from light shadow intensity');
control('shadow').value = '70'; control('shadow').emit('input');
assert.equal(sun.shadow.intensity, .7);
assert.equal(control('shadow-label').textContent, '70%');
assert.equal(control('preset-year').textContent, '2026');
control('date').value = '2028-01-01'; control('date').emit('change');
assert.equal(control('day').max, '366', 'date year updates leap-year slider maximum');
assert.equal(control('preset-year').textContent, '2028');
control('preset').value = 'summer'; control('preset').emit('change');
assert.equal(control('date').value, '2028-06-20');
assert.equal(control('time').value, '15:50');
assert.equal(control('preset').value, '', 'preset stays usable after a manual date change');
control('day').value = '60'; control('day').emit('input');
assert.equal(control('date').value, '2028-02-29', 'day slider updates date');
control('minute').value = '1439'; control('minute').emit('input');
assert.equal(control('time').value, '23:59', 'time slider updates minute input');
control('speed').value = '6'; control('speed').emit('input');
assert.equal(uiController.getState().secondsPerHour, 6);
control('play').emit('click');
assert.equal(control('play').getAttribute('aria-pressed'), 'true');
uiClock.step(1000);
assert.equal(control('date').value, '2028-03-01', 'playback synchronizes date input across midnight');
control('play').emit('click');
assert.equal(control('play').getAttribute('aria-pressed'), 'false');
control('date').value = '2026-03-29'; control('time').value = '02:30'; control('date').emit('change');
assert.equal(control('time').getAttribute('aria-invalid'), 'true');
assert.match(control('status').textContent, /nie istnieje/);
control('time').value = '03:30'; control('time').emit('change');
assert.equal(control('time').getAttribute('aria-invalid'), undefined);
assert.ok(uiActivations >= 7, 'user solar interactions activate parent solar mode');
uiController.dispose();
control('play').emit('click');
control('shadow').value = '15'; control('shadow').emit('input');
control('preset').value = 'winter'; control('preset').emit('change');
assert.equal(sun.shadow.intensity, .7, 'disposed controls remove shadow handler');
assert.equal(control('date').value, '2026-03-29', 'disposed controls remove preset handler');
assert.equal(uiClock.pending(), 0, 'disposed controls remove handlers');
controller.dispose();
console.log('Solar checks passed: 6 NREL SPA cases; 16 USNO season dates; shadow darkness; preset/year/time; DST/validation; deterministic playback, speed, rollover, frame cap, hidden pause and disposal.'
  + (process.argv.includes('--source-only') ? ' Source-only mode: generated HTML embedding not checked.' : ' Generated HTML embedding checked.'));
