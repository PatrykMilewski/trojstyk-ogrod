const SOLAR_RAD = Math.PI / 180;
const solarWrap = (value, period = 360) => ((value % period) + period) % period;

export const SITE = Object.freeze({
  latitude: 54 + 25 / 60 + 55.4 / 3600,
  longitude: 18 + 26 / 60 + 26.5 / 3600,
  timeZone: 'Europe/Warsaw',
  // PROJ 9 / EPSG:2177, GRS80, central meridian 18°E, at the supplied site.
  gridConvergenceDeg: 0.3584748670196551,
});

const solarCivilFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: SITE.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function solarCivilKey(instant) {
  const parts = Object.fromEntries(solarCivilFormat.formatToParts(instant).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function warsawInstant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new RangeError('Podaj pełną datę i godzinę.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const civil = Date.UTC(year, month - 1, day, hour, minute);
  if (year < 2000 || year > 2100 || new Date(civil).toISOString().slice(0, 16) !== `${date}T${time}`) {
    throw new RangeError('Wybierz poprawną datę z lat 2000–2100 i godzinę 00:00–23:59.');
  }
  const candidates = [60, 120].map(offset => new Date(civil - offset * 60000))
    .filter(instant => solarCivilKey(instant) === `${date}T${time}`);
  if (!candidates.length) throw new RangeError('Ta godzina nie istnieje w Polsce przy zmianie na czas letni.');
  if (candidates.length > 1) throw new RangeError('Ta godzina występuje dwa razy przy zmianie czasu. Wybierz godzinę poza 02:00–02:59.');
  return candidates[0];
}

function solarOrbit(millis) {
  const t = (millis / 86400000 + 2440587.5 - 2451545) / 36525;
  const meanLongitude = solarWrap(280.46646 + t * (36000.76983 + t * .0003032));
  const anomaly = (357.52911 + t * (35999.05029 - .0001537 * t)) * SOLAR_RAD;
  const eccentricity = .016708634 - t * (.000042037 + .0000001267 * t);
  const centre = Math.sin(anomaly) * (1.914602 - t * (.004817 + .000014 * t))
    + Math.sin(2 * anomaly) * (.019993 - .000101 * t) + Math.sin(3 * anomaly) * .000289;
  const omega = (125.04 - 1934.136 * t) * SOLAR_RAD;
  const apparentLongitude = (meanLongitude + centre - .00569 - .00478 * Math.sin(omega)) * SOLAR_RAD;
  const obliquity = (23 + (26 + (21.448 - t * (46.815 + t * (.00059 - .001813 * t))) / 60) / 60
    + .00256 * Math.cos(omega)) * SOLAR_RAD;
  return { meanLongitude, anomaly, eccentricity, apparentLongitude, obliquity };
}

// NOAA/Meeus Julian-century equations, geometric solar centre (no refraction).
// https://gml.noaa.gov/grad/solcalc/calcdetails.html
export function solarPosition(instant, latitude = SITE.latitude, longitude = SITE.longitude) {
  const millis = instant instanceof Date ? instant.getTime() : NaN;
  if (!Number.isFinite(millis) || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError('Niepoprawny czas lub współrzędne.');
  const { meanLongitude, anomaly, eccentricity, apparentLongitude, obliquity } = solarOrbit(millis);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));
  const y = Math.tan(obliquity / 2) ** 2, l = meanLongitude * SOLAR_RAD;
  const equationOfTime = 4 / SOLAR_RAD * (y * Math.sin(2 * l) - 2 * eccentricity * Math.sin(anomaly)
    + 4 * eccentricity * y * Math.sin(anomaly) * Math.cos(2 * l)
    - .5 * y * y * Math.sin(4 * l) - 1.25 * eccentricity ** 2 * Math.sin(2 * anomaly));
  const minutes = instant.getUTCHours() * 60 + instant.getUTCMinutes() + (instant.getUTCSeconds() + instant.getUTCMilliseconds() / 1000) / 60;
  const hourAngle = (solarWrap(minutes + equationOfTime + 4 * longitude, 1440) / 4 - 180) * SOLAR_RAD;
  const lat = latitude * SOLAR_RAD;
  const east = -Math.cos(declination) * Math.sin(hourAngle);
  const north = Math.cos(lat) * Math.sin(declination) - Math.sin(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const up = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  return { azimuthDeg: solarWrap(Math.atan2(east, north) / SOLAR_RAD), elevationDeg: Math.asin(Math.max(-1, Math.min(1, up))) / SOLAR_RAD };
}

export function sunDirection(position) {
  // Grid bearing = true bearing − convergence; x = EPSG east, y = north, z = up.
  const azimuth = (position.azimuthDeg - SITE.gridConvergenceDeg) * SOLAR_RAD;
  const elevation = position.elevationDeg * SOLAR_RAD;
  return [Math.sin(azimuth) * Math.cos(elevation), Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation)];
}

function solarShadowBounds(THREE, scene) {
  const bounds = new THREE.Box3();
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (object.isMesh && (object.castShadow || object.receiveShadow)) bounds.expandByObject(object);
  });
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-80, -80, 0), new THREE.Vector3(80, 80, 15));
  return bounds.expandByScalar(2);
}

function fitSolarShadow(THREE, sun, bounds, direction) {
  const target = bounds.getCenter(new THREE.Vector3());
  const distance = bounds.getSize(new THREE.Vector3()).length() * 2;
  sun.target.position.copy(target);
  sun.position.copy(target).addScaledVector(new THREE.Vector3(...direction), distance);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const camera = sun.shadow.camera;
  camera.up.set(0, 0, 1);
  camera.position.copy(sun.position);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const projected = new THREE.Box3();
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
    for (const z of [bounds.min.z, bounds.max.z]) projected.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  }
  Object.assign(camera, { left: projected.min.x, right: projected.max.x, bottom: projected.min.y,
    top: projected.max.y, near: Math.max(.1, -projected.max.z - 2), far: -projected.min.z + 2 });
  camera.updateProjectionMatrix();
}

const solarZoneFormat = new Intl.DateTimeFormat('pl-PL', {
  timeZone: SITE.timeZone, timeZoneName: 'short',
});

export function solarCalendarFields(instant) {
  const [date, time] = solarCivilKey(instant).split('T');
  const year = Number(date.slice(0, 4));
  const yearStart = Date.UTC(year, 0, 1);
  return { date, time, year, minute: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
    day: 1 + (Date.parse(`${date}T00:00:00Z`) - yearStart) / 86400000,
    daysInYear: (Date.UTC(year + 1, 0, 1) - yearStart) / 86400000,
    seconds: String(instant.getUTCSeconds()).padStart(2, '0'),
    zone: solarZoneFormat.formatToParts(instant).find(part => part.type === 'timeZoneName').value };
}

const SOLAR_SEASONS = Object.freeze({ spring: [2, 0], summer: [5, 90], autumn: [8, 180], winter: [11, 270] });

// Solve apparent solar longitude = 0°, 90°, 180°, 270°; the low-precision NOAA model
// gives approximate season dates, converted to the site's civil time zone.
// https://promenade.imcce.fr/en/pages4/438.html
export function solarSeasonDate(year, season) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Object.hasOwn(SOLAR_SEASONS, season)) {
    throw new RangeError('Wybierz porę roku i rok z zakresu 2000–2100.');
  }
  const [month, longitude] = SOLAR_SEASONS[season];
  let start = Date.UTC(year, month, 18), end = Date.UTC(year, month, 26);
  while (end - start > 1000) {
    const middle = (start + end) / 2;
    const angle = solarWrap(solarOrbit(middle).apparentLongitude / SOLAR_RAD - longitude + 180) - 180;
    if (angle < 0) start = middle;
    else end = middle;
  }
  return solarCalendarFields(new Date((start + end) / 2)).date;
}

export function createSolarPlayback({ apply, onChange = () => {},
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id),
  now = () => globalThis.performance.now(), visibilityDocument = globalThis.document }) {
  let playing = false, disposed = false, frame = null, anchor = 0, origin = 0, lastRender = 0;
  let instant = 0, secondsPerHour = 3;
  function advance(timestamp, force = false) {
    if (!force && timestamp - lastRender < 50) return;
    instant = origin + Math.max(0, timestamp - anchor) * 3600 / secondsPerHour;
    const limited = Math.max(Date.parse('1999-12-31T23:00:00Z'),
      Math.min(Date.parse('2100-12-31T22:59:59.999Z'), instant));
    apply(new Date(limited));
    lastRender = timestamp;
    if (limited !== instant) { instant = limited; playing = false; onChange(); }
  }
  function tick(timestamp) {
    frame = null;
    if (!playing || disposed) return;
    advance(timestamp);
    if (playing) frame = requestFrame(tick);
  }
  function pause() {
    if (playing) advance(now(), true);
    playing = false;
    if (frame !== null) cancelFrame(frame);
    frame = null;
    onChange();
  }
  function play() {
    if (disposed || playing || visibilityDocument?.hidden) return;
    playing = true; anchor = now(); origin = instant; lastRender = anchor;
    frame = requestFrame(tick); onChange();
  }
  function setPlaybackSpeed(value) {
    if (!Number.isFinite(value) || value < 1 || value > 15) throw new RangeError('Tempo: od 1 do 15 sekund na godzinę.');
    if (playing) { advance(now(), true); origin = instant; anchor = now(); }
    secondsPerHour = value; onChange();
  }
  const visibility = () => { if (visibilityDocument.hidden) pause(); };
  visibilityDocument?.addEventListener('visibilitychange', visibility);
  return { play, pause, setPlaybackSpeed, setInstant(value) { pause(); instant = value.getTime(); },
    getState: () => ({ playing, secondsPerHour }),
    dispose() { pause(); disposed = true; visibilityDocument?.removeEventListener('visibilitychange', visibility); } };
}

function solarControlMarkup() {
  return `<div class="solar-heading">Słońce i cień</div>
    <div class="solar-inputs"><label>Data<input id="solar-date" type="date" min="2000-01-01" max="2100-12-31"></label>
    <label>Godzina<input id="solar-time" type="time" step="60"></label></div>
    <label>Dni charakterystyczne <output id="solar-preset-year"></output><select id="solar-preset" aria-label="Wybierz charakterystyczny dzień">
    <option value="">Wybierz dzień…</option><option value="summer">Najdłuższy dzień · przesilenie letnie</option>
    <option value="winter">Najkrótszy dzień · przesilenie zimowe</option><option value="spring">Równonoc wiosenna</option>
    <option value="autumn">Równonoc jesienna</option><option value="today">Dzisiaj · aktualny czas</option></select></label>
    <p class="solar-zone">Pory roku: daty przybliżone dla wybranego roku, godzina bez zmian.</p>
    <label>Dzień roku <output id="solar-day-label"></output><input id="solar-day" aria-label="Dzień roku" type="range" min="1" max="365" step="1"></label>
    <label>Godzina <output id="solar-minute-label"></output><input id="solar-minute" aria-label="Godzina dnia" type="range" min="0" max="1439" step="1"></label>
    <label>Ciemność cienia <output id="solar-shadow-label"></output><input id="solar-shadow" aria-label="Ciemność cienia od jasnego do ciemnego" type="range" min="0" max="100" step="1"></label>
    <div class="solar-inputs"><button id="solar-play" type="button" aria-pressed="false">▶ Odtwórz</button>
    <label>Tempo <output id="solar-speed-label"></output><input id="solar-speed" aria-label="Sekundy na godzinę symulacji" type="range" min="1" max="15" step="0.5" value="3"></label></div>
    <p class="solar-zone">Czas w Polsce · Europe/Warsaw (CET / CEST)</p>
    <output id="solar-status" aria-live="off"></output>
    <p class="solar-note">Bezchmurne niebo · teren płaski · geometria poglądowa. Bez refrakcji i przeszkód spoza modelu. Nocą pozostaje światło podglądu.
    Obliczenia: <a href="https://gml.noaa.gov/grad/solcalc/calcdetails.html" target="_blank" rel="noopener">NOAA / Meeus</a>;
    kontrola: <a href="https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.solarposition.spa_python.html" target="_blank" rel="noopener">NREL SPA</a>.</p>`;
}

function solarControls(container, actions) {
  container.innerHTML = solarControlMarkup();
  const elements = Object.fromEntries(['date', 'time', 'day', 'minute', 'play', 'speed', 'status', 'preset', 'shadow',
    'day-label', 'minute-label', 'speed-label', 'preset-year', 'shadow-label'].map(name => [name, container.querySelector(`#solar-${name}`)]));
  const listeners = [];
  function listen(name, event, callback) {
    elements[name].addEventListener(event, callback);
    listeners.push(() => elements[name].removeEventListener(event, callback));
  }
  const update = () => updateSolarSelection(elements, actions, (date, time) => actions.setLocal(date, time));
  listen('date', 'change', update); listen('time', 'change', update);
  listen('preset', 'change', () => {
    const preset = elements.preset.value;
    if (preset) updateSolarSelection(elements, actions, () => actions.setPreset(preset));
    elements.preset.value = '';
  });
  listen('day', 'input', () => {
    const year = Number(elements.date.value.slice(0, 4)) || actions.getState().year;
    elements.date.value = new Date(Date.UTC(year, 0, Number(elements.day.value))).toISOString().slice(0, 10);
    update();
  });
  listen('minute', 'input', () => {
    const minute = Number(elements.minute.value);
    elements.time.value = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    update();
  });
  listen('play', 'click', () => actions.getState().playing ? actions.pause() : actions.play());
  listen('speed', 'input', () => { actions.activate(); actions.setPlaybackSpeed(Number(elements.speed.value)); });
  listen('shadow', 'input', () => actions.setShadowStrength(Number(elements.shadow.value) / 100));
  return { ...elements, dispose: () => listeners.forEach(remove => remove()) };
}

function updateSolarSelection(elements, actions, select) {
  const date = elements.date.value, time = elements.time.value;
  actions.pause();
  try {
    select(date, time);
    elements.date.removeAttribute('aria-invalid'); elements.time.removeAttribute('aria-invalid');
    elements.status.removeAttribute('role');
  } catch (error) {
    elements.date.value = date; elements.time.value = time;
    elements.status.textContent = `${error.message} Zachowano ostatnie poprawne oświetlenie.`;
    elements.status.setAttribute('role', 'alert');
    elements.date.setAttribute('aria-invalid', 'true'); elements.time.setAttribute('aria-invalid', 'true');
  }
}

function syncSolarControls(controls, state) {
  if (!controls) return;
  controls.date.value = state.date; controls.time.value = state.time;
  controls.day.max = String(state.daysInYear); controls.day.value = String(state.day);
  controls.minute.value = String(state.minute);
  controls['day-label'].textContent = `${state.day} / ${state.daysInYear}`;
  controls['minute-label'].textContent = `${state.time}:${state.seconds}`;
  controls['preset-year'].textContent = String(state.year);
  controls.shadow.value = String(Math.round(state.shadowStrength * 100));
  controls['shadow-label'].textContent = `${Math.round(state.shadowStrength * 100)}%`;
  controls.speed.value = String(state.secondsPerHour);
  controls['speed-label'].textContent = `1 h / ${state.secondsPerHour} s`;
  controls.play.textContent = state.playing ? '❚❚ Pauza' : '▶ Odtwórz';
  controls.play.setAttribute('aria-pressed', String(state.playing));
  controls.status.textContent = state.daylight ? 'Słońce nad horyzontem' : 'Słońce pod horyzontem';
}

function applySolarLight({ THREE, sun, bounds, renderer, intensity }, instant) {
  const position = solarPosition(instant), direction = sunDirection(position);
  const daylight = position.elevationDeg > 0;
  fitSolarShadow(THREE, sun, bounds, direction);
  sun.intensity = daylight ? intensity : 0;
  sun.castShadow = daylight;
  renderer.shadowMap.needsUpdate = true;
  sun.shadow.needsUpdate = true;
  return { ...solarCalendarFields(instant), instant: instant.toISOString(), ...position, direction, daylight };
}

export function setupSolar({ THREE, scene, sun, renderer, requestDraw, container, shadowBounds,
  onActivate = () => {}, playbackClock = {} }) {
  const bounds = shadowBounds
    ? new THREE.Box3(new THREE.Vector3(...shadowBounds.min), new THREE.Vector3(...shadowBounds.max)).expandByScalar(2)
    : solarShadowBounds(THREE, scene);
  sun.shadow.mapSize.set(Math.min(4096, renderer.capabilities?.maxTextureSize || 4096),
    Math.min(4096, renderer.capabilities?.maxTextureSize || 4096));
  const lighting = { THREE, sun, bounds, renderer, intensity: sun.intensity };
  let state, controls, playback, active = false;
  const getState = () => ({ ...state, active, shadowStrength: sun.shadow.intensity,
    ...playback.getState(), direction: [...state.direction] });
  const sync = () => { if (state && playback) syncSolarControls(controls, getState()); };
  function apply(instant) {
    state = applySolarLight(lighting, instant);
    sync(); requestDraw();
    return getState();
  }
  function activate() { active = true; onActivate(); requestDraw(); return getState(); }
  function setLocal(date, time) {
    activate();
    const instant = warsawInstant(date, time);
    playback.setInstant(instant);
    return apply(instant);
  }
  function setPreset(preset, now = new Date()) {
    if (preset !== 'today') return setLocal(solarSeasonDate(state.year, preset), state.time);
    const fields = solarCalendarFields(now);
    if (fields.year < 2000 || fields.year > 2100) throw new RangeError('Wybierz datę z lat 2000–2100.');
    activate(); playback.setInstant(now);
    return apply(now);
  }
  function setShadowStrength(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Ciemność cienia: od 0 do 1.');
    activate(); sun.shadow.intensity = value;
    sync(); requestDraw();
    return getState();
  }
  playback = createSolarPlayback({ ...playbackClock, apply, onChange() { sync(); requestDraw(); } });
  const api = { activate, setLocal, setPreset, setShadowStrength, getState, pause: playback.pause,
    play() { activate(); playback.play(); }, setPlaybackSpeed: playback.setPlaybackSpeed,
    deactivate() { playback.pause(); active = false; requestDraw(); },
    dispose() { playback.dispose(); controls?.dispose(); } };
  if (container) controls = solarControls(container, api);
  const initial = warsawInstant('2026-07-20', '15:50');
  playback.setInstant(initial); apply(initial);
  return api;
}
