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

// NOAA/Meeus Julian-century equations, geometric solar centre (no refraction).
// https://gml.noaa.gov/grad/solcalc/calcdetails.html
export function solarPosition(instant, latitude = SITE.latitude, longitude = SITE.longitude) {
  const millis = instant instanceof Date ? instant.getTime() : NaN;
  if (!Number.isFinite(millis) || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError('Niepoprawny czas lub współrzędne.');
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
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));
  const y = Math.tan(obliquity / 2) ** 2, l = meanLongitude * SOLAR_RAD;
  const equationOfTime = 4 / SOLAR_RAD * (y * Math.sin(2 * l) - 2 * eccentricity * Math.sin(anomaly)
    + 4 * eccentricity * y * Math.sin(anomaly) * Math.cos(2 * l)
    - .5 * y * y * Math.sin(4 * l) - 1.25 * eccentricity ** 2 * Math.sin(2 * anomaly));
  const minutes = instant.getUTCHours() * 60 + instant.getUTCMinutes() + instant.getUTCSeconds() / 60;
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

function solarControls(container, apply) {
  container.innerHTML = `<div class="solar-heading">Słońce i cień</div>
    <div class="solar-inputs"><label>Data<input id="solar-date" type="date" min="2000-01-01" max="2100-12-31" value="2026-07-20"></label>
    <label>Godzina<input id="solar-time" type="time" step="60" value="15:50"></label></div>
    <p class="solar-zone">Czas w Polsce · Europe/Warsaw (CET / CEST)</p>
    <output id="solar-status" aria-live="polite"></output>
    <p class="solar-note">Bezchmurne niebo · teren płaski · geometria poglądowa. Bez refrakcji i przeszkód spoza modelu. Nocą pozostaje światło podglądu.
    Obliczenia: <a href="https://gml.noaa.gov/grad/solcalc/calcdetails.html" target="_blank" rel="noopener">NOAA / Meeus</a>;
    kontrola: <a href="https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.solarposition.spa_python.html" target="_blank" rel="noopener">NREL SPA</a>.</p>`;
  const date = container.querySelector('#solar-date'), time = container.querySelector('#solar-time');
  const status = container.querySelector('#solar-status');
  const update = () => {
    try { apply(date.value, time.value); date.removeAttribute('aria-invalid'); time.removeAttribute('aria-invalid'); }
    catch (error) { status.textContent = `${error.message} Zachowano ostatnie poprawne oświetlenie.`; date.setAttribute('aria-invalid', 'true'); time.setAttribute('aria-invalid', 'true'); }
  };
  date.addEventListener('change', update); time.addEventListener('change', update);
  return { date, time, status, dispose() { date.removeEventListener('change', update); time.removeEventListener('change', update); } };
}

export function setupSolar({ THREE, scene, sun, renderer, requestDraw, container, shadowBounds }) {
  const bounds = shadowBounds
    ? new THREE.Box3(new THREE.Vector3(...shadowBounds.min), new THREE.Vector3(...shadowBounds.max)).expandByScalar(2)
    : solarShadowBounds(THREE, scene);
  const mapSize = Math.min(4096, renderer.capabilities?.maxTextureSize || 4096);
  sun.shadow.mapSize.set(mapSize, mapSize);
  const intensity = sun.intensity;
  let state, controls;
  function setLocal(date, time) {
    const instant = warsawInstant(date, time), position = solarPosition(instant);
    const direction = sunDirection(position), daylight = position.elevationDeg > 0;
    fitSolarShadow(THREE, sun, bounds, direction);
    sun.intensity = daylight ? intensity : 0;
    sun.castShadow = daylight;
    renderer.shadowMap.needsUpdate = true;
    sun.shadow.needsUpdate = true;
    state = { date, time, instant: instant.toISOString(), ...position, direction, daylight };
    if (controls) {
      controls.date.value = date; controls.time.value = time;
      const zone = new Intl.DateTimeFormat('pl-PL', { timeZone: SITE.timeZone, timeZoneName: 'short' })
        .formatToParts(instant).find(part => part.type === 'timeZoneName').value;
      controls.status.textContent = `${time} ${zone} · azymut ${position.azimuthDeg.toFixed(1)}° · wysokość ${position.elevationDeg.toFixed(1)}°`
        + (daylight ? (position.elevationDeg < 5 ? ' · niskie słońce: cień orientacyjny' : '') : ' · słońce pod horyzontem: brak bezpośredniego światła');
    }
    requestDraw();
    return state;
  }
  if (container) controls = solarControls(container, setLocal);
  setLocal('2026-07-20', '15:50');
  return { setLocal, getState: () => ({ ...state, direction: [...state.direction] }), dispose: () => controls?.dispose() };
}
