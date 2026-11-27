export function createOrbitDepthGuard({ THREE, scene, camera, controls }) {
  const bounds = new THREE.Box3().setFromObject(scene);
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
    for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
  }
  function fit() {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const depths = corners.map(point => point.clone().sub(camera.position).dot(forward));
    const retreat = Math.max(0, 2 - Math.min(...depths));
    // Orthographic framing depends on zoom, so retreating preserves the selected view.
    if (retreat) {
      camera.position.addScaledVector(forward, -retreat);
      controls.update();
    }
    camera.near = .1;
    camera.far = Math.max(100, Math.max(...depths) + retreat + 10);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return { near: camera.near, far: camera.far, minDepth: Math.min(...depths) + retreat,
      maxDepth: Math.max(...depths) + retreat, retreat };
  }
  return { fit, bounds, getState: fit };
}

export function walkHouseFootprints(house, neighbors) {
  const footprints = [{ parcel: '193', ring: house.meshes.filter(mesh => /^ground-wall-\d+$/.test(mesh.id))
    .map(mesh => mesh.vertices[0].slice(0, 2)) }];
  for (const model of neighbors.houses) {
    const ground = model.meshes.find(mesh => mesh.id === 'ground-storey');
    if (ground) {
      const z = Math.min(...ground.vertices.map(point => point[2]));
      footprints.push({ parcel: model.parcel, ring: ground.vertices.filter(point => point[2] === z).map(point => point.slice(0, 2)) });
    } else {
      for (const mesh of model.meshes.filter(mesh => mesh.kind === 'floor')) {
        footprints.push({ parcel: model.parcel, ring: mesh.vertices.map(point => point.slice(0, 2)) });
      }
    }
  }
  for (const model of neighbors.context.buildings) {
    footprints.push({ parcel: model.parcel, ring: model.footprint.coordinates[0].map(point => point.slice(0, 2)), enabled: model.enabled });
  }
  return footprints.filter(item => item.ring.length >= 3);
}

function walkInside(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function walkPointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

function walkSegmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(walkPointSegmentDistance(a, c, d), walkPointSegmentDistance(b, c, d),
    walkPointSegmentDistance(c, a, b), walkPointSegmentDistance(d, a, b));
}

export function createWalkCollision(footprints, radius = .28) {
  const bounds = footprints.map(({ring}) => {
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    return [Math.min(...xs)-radius, Math.min(...ys)-radius, Math.max(...xs)+radius, Math.max(...ys)+radius];
  });
  function pathBlocked(a, b) {
    const left = Math.min(a[0], b[0]), right = Math.max(a[0], b[0]);
    const bottom = Math.min(a[1], b[1]), top = Math.max(a[1], b[1]);
    return footprints.some(({ring, enabled}, i) => {
      const [west, south, east, north] = bounds[i];
      if (right < west || left > east || top < south || bottom > north || (enabled && !enabled())) return false;
      return walkInside(a, ring) || walkInside(b, ring) || ring.some((p, j) =>
        walkSegmentDistance(a, b, p, ring[(j+1) % ring.length]) <= radius);
    });
  }
  function advance(start, delta) {
    const end = [start[0] + delta[0], start[1] + delta[1]];
    if (!pathBlocked(start, end)) return end;
    let low = 0, high = 1;
    for (let i = 0; i < 35; i++) {
      const mid = (low + high) / 2, point = [start[0] + delta[0] * mid, start[1] + delta[1] * mid];
      if (pathBlocked(start, point)) high = mid; else low = mid;
    }
    return [start[0] + delta[0] * low, start[1] + delta[1] * low];
  }
  function move(start, delta) {
    if (![...start, ...delta].every(Number.isFinite)) throw new TypeError('Pozycja spaceru musi być skończona.');
    const hit = advance(start, delta);
    if (hit[0] === start[0] + delta[0] && hit[1] === start[1] + delta[1]) return hit;
    const slideX = advance(hit, [start[0] + delta[0] - hit[0], 0]);
    return advance(slideX, [0, start[1] + delta[1] - slideX[1]]);
  }
  function safeSpawn(preferred) {
    if (!pathBlocked(preferred, preferred)) return [...preferred];
    for (let radius = .5; radius <= 100; radius += .5) for (let step = 0; step < 48; step++) {
      const angle = step * Math.PI / 24;
      const point = [preferred[0] + Math.sin(angle) * radius, preferred[1] + Math.cos(angle) * radius];
      if (!pathBlocked(point, point)) return point;
    }
    throw new RangeError('Nie znaleziono wolnego miejsca na spacer.');
  }
  return { radius, footprints, move, safeSpawn, blocked: point => pathBlocked(point, point), pathBlocked };
}

const walkPostures = {
  standing: { eyeHeightM: 1.7, walkSpeedMps: 2.2, label: 'Pozycja stojąca' },
  crouching: { eyeHeightM: 1.05, walkSpeedMps: 1.1, label: 'Kucanie' },
  crawling: { eyeHeightM: .38, walkSpeedMps: .55, label: 'Czołganie' },
};
const sprintMultiplier = 2.2, jumpHeightM = .6, gravityMps2 = 9.81;
const walkLaunchSpeed = Math.sqrt(2 * gravityMps2 * jumpHeightM);

export function createWalkMotion(collision, navigation) {
  const body = navigation ? createInteriorWalkMotion(collision, navigation) : createOutdoorWalkMotion(collision);
  let posture = 'standing', sprinting = false;
  function eyePosition() {
    const [x, y, feet] = body.position;
    return [x, y, feet + walkPostures[posture].eyeHeightM];
  }
  function togglePosture(requested) {
    if (requested !== 'crouching' && requested !== 'crawling') return false;
    const next = posture === requested ? 'standing' : requested;
    const height = walkPostures[next].eyeHeightM;
    if (height > walkPostures[posture].eyeHeightM && body.canRise && !body.canRise(height)) return false;
    posture = next; sprinting = false;
    return true;
  }
  function move(forward, right, dt, yaw = 0, sprint = false) {
    if (![forward, right, dt, yaw].every(Number.isFinite) || dt < 0) throw new TypeError('Nieprawidłowy krok spaceru.');
    sprinting = posture === 'standing' && sprint && !!(forward || right);
    const { eyeHeightM, walkSpeedMps } = walkPostures[posture];
    const speed = walkSpeedMps * (sprinting ? sprintMultiplier : 1) / Math.max(1, Math.hypot(forward, right));
    body.move((Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed,
      (Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed, dt, eyeHeightM);
    return eyePosition();
  }
  function getState() {
    const { eyeHeightM, walkSpeedMps } = walkPostures[posture];
    return { ...body.state(), position: eyePosition(), posture, eyeHeightM, walkSpeedMps, sprintMultiplier,
      jumpHeightM, gravityMps2, sprinting };
  }
  return { reset(point) { posture = 'standing'; sprinting = false; body.reset(point); },
    jump: body.jump, setPosition: body.setPosition, clearSprint: () => { sprinting = false; }, togglePosture, move, getState };
}

function createOutdoorWalkMotion(collision) {
  let position = [0, 0, 0], flightTime = null;
  return {
    get position() { return position; },
    reset(point) { position = [point[0], point[1], 0]; flightTime = null; },
    setPosition(point) { position = [point[0], point[1], position[2]]; },
    jump() {
      if (flightTime !== null) return false;
      flightTime = 0; return true;
    },
    move(dx, dy, dt) {
      const point = collision.move(position.slice(0, 2), [dx * dt, dy * dt]);
      if (flightTime !== null) {
        flightTime += dt;
        if (flightTime >= 2 * walkLaunchSpeed / gravityMps2) flightTime = null;
      }
      const feet = flightTime === null ? 0 : walkLaunchSpeed * flightTime - gravityMps2 * flightTime * flightTime / 2;
      position = [...point, feet];
    },
    state: () => ({ floorHeightM: 0, jumpHeight: position[2], grounded: flightTime === null }),
  };
}

function walkRampHeight(point, ramp) {
  const dx = ramp.end[0] - ramp.start[0], dy = ramp.end[1] - ramp.start[1], length = Math.hypot(dx, dy);
  if (!length) return null;
  const along = ((point[0] - ramp.start[0]) * dx + (point[1] - ramp.start[1]) * dy) / length;
  const across = Math.abs((point[0] - ramp.start[0]) * dy - (point[1] - ramp.start[1]) * dx) / length;
  if (along < -1e-7 || along > length + 1e-7 || across > ramp.width / 2) return null;
  return ramp.z0 + Math.max(0, Math.min(1, along / length)) * (ramp.z1 - ramp.z0);
}

function walkSupport(point, navigation, ceiling, connectedRamps = new Set(), airborneCeiling = Infinity) {
  const ramps = navigation.ramps.filter(ramp => connectedRamps.has(ramp.id));
  const connectedHeights = ramps.flatMap(ramp => [ramp.z0, ramp.z1]);
  const floorHeights = navigation.floors.filter(floor => walkInside(point, floor.ring) &&
    (floor.z <= ceiling + 1e-7 || connectedHeights.some(z => Math.abs(z - floor.z) < 1e-7)))
    .map(floor => floor.z).filter(z => z <= airborneCeiling);
  const rampHeights = navigation.ramps.map(ramp => ({ ramp, z: walkRampHeight(point, ramp) }))
    .filter(({ ramp, z }) => z !== null && z <= airborneCeiling &&
      (z <= ceiling + 1e-7 || connectedRamps.has(ramp.id))).map(({ z }) => z);
  return Math.max(navigation.terrainHeight?.(point) ?? 0, ...floorHeights, ...rampHeights);
}

function walkCeilingMove(navigation, start, end, head) {
  if (!navigation.ceilingHeight || navigation.ceilingHeight(end) >= head) return end;
  let low = 0, high = 1;
  for (let i = 0; i < 30; i++) {
    const t = (low + high) / 2, point = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
    if (navigation.ceilingHeight(point) >= head) low = t; else high = t;
  }
  return [start[0] + (end[0] - start[0]) * low, start[1] + (end[1] - start[1]) * low];
}

function walkSlabStepClear(wall, point, feet, navigation, radius) {
  if (wall.kind !== 'slab' || wall.maxZ - feet > .25 || wall.maxZ < feet - 1e-6) return false;
  return navigation.ramps.some(ramp => [[ramp.start, ramp.z0], [ramp.end, ramp.z1]].some(([end, z]) =>
    Math.abs(z - wall.maxZ) < 1e-6 && Math.hypot(point[0] - end[0], point[1] - end[1]) <= radius + .1));
}

function walkAboveCover(point, feet, { ramp, landing }) {
  const height = walkRampHeight(point, ramp) ?? (walkInside(point, landing.ring) ? landing.z : Infinity);
  return feet >= height - 1e-6;
}

function walkInteriorCollision(collision, navigation, feet, nextFeet, point, grounded = false, height = walkPostures.standing.eyeHeightM) {
  const minFeet = Math.min(feet, nextFeet), maxFeet = Math.max(feet, nextFeet);
  const walls = navigation.obstacles.filter(wall => wall.minZ < maxFeet + height - 1e-6 && wall.maxZ > minFeet + 1e-6 &&
    !(point && wall.cover && walkAboveCover(point, feet, wall.cover)) &&
    !(grounded && walkSlabStepClear(wall, point, minFeet, navigation, collision.radius)));
  return createWalkCollision([...collision.footprints, ...walls], collision.radius);
}

function walkJumpCeiling(navigation, point, feet, head, nextHead, radius) {
  let limit = navigation.ceilingHeight?.(point) ?? Infinity;
  for (const wall of navigation.obstacles) {
    if (wall.minZ < head - 1e-6 || wall.minZ > nextHead || wall.minZ >= limit) continue;
    if (wall.cover && walkAboveCover(point, feet, wall.cover)) continue;
    const ring = wall.ring;
    if (walkInside(point, ring) || ring.some((a, i) =>
      walkPointSegmentDistance(point, a, ring[(i + 1) % ring.length]) <= radius)) limit = wall.minZ;
  }
  return limit;
}

function createInteriorWalkMotion(collision, navigation) {
  let position = [0, 0, 0], floorHeightM = 0, velocity = 0, grounded = true;
  let landingCeiling = 0, connectedRamps = new Set();
  let needsSupportCheck = true;
  function airborneRamps() {
    return new Set(navigation.ramps.filter(ramp => Math.abs(ramp.z0 - floorHeightM) <= .12 ||
      Math.abs(ramp.z1 - floorHeightM) <= .12 || Math.abs((walkRampHeight(position, ramp) ?? Infinity) - floorHeightM) <= .12)
      .map(ramp => ramp.id));
  }
  function reset(point) {
    floorHeightM = walkSupport(point, navigation, point[2] ?? 0);
    position = [point[0], point[1], floorHeightM];
    velocity = 0; grounded = true; landingCeiling = floorHeightM; connectedRamps = new Set();
    needsSupportCheck = false;
  }
  function jump() {
    if (!grounded) return false;
    connectedRamps = airborneRamps(); grounded = false; velocity = walkLaunchSpeed; landingCeiling = floorHeightM; return true;
  }
  function canRise(height) {
    const feet = position[2];
    if ((navigation.ceilingHeight?.(position) ?? Infinity) < feet + height) return false;
    return !walkInteriorCollision(collision, navigation, feet, feet, position, grounded, height).blocked(position);
  }
  function step(delta, dt, eyeHeightM) {
    const feet = position[2];
    let nextFeet = grounded ? feet : feet + velocity * dt - gravityMps2 * dt * dt / 2;
    const tentative = [position[0] + delta[0], position[1] + delta[1]];
    // Only a small connected rise may be stepped onto; a jump cannot select another storey.
    const support = walkSupport(tentative, navigation, grounded ? feet + .12 : landingCeiling + .12, grounded ? undefined : connectedRamps, grounded ? Infinity : Math.max(feet, nextFeet) + .12);
    if (grounded && support >= feet - .12) nextFeet = support;
    const walls = walkInteriorCollision(collision, navigation, feet, nextFeet, position, grounded, eyeHeightM);
    const point = walkCeilingMove(navigation, position, walls.move(position.slice(0, 2), delta), feet + eyeHeightM);
    const surface = walkSupport(point, navigation, grounded ? feet + .12 : landingCeiling + .12, grounded ? undefined : connectedRamps, grounded ? Infinity : Math.max(feet, nextFeet) + .12);
    if (grounded && surface >= feet - .12) { nextFeet = surface; floorHeightM = surface; landingCeiling = surface; }
    else {
      if (grounded) { connectedRamps = airborneRamps(); grounded = false; velocity = 0; landingCeiling = feet; }
      velocity -= gravityMps2 * dt;
      if (nextFeet <= surface && velocity <= 0) {
        nextFeet = surface; floorHeightM = surface; velocity = 0; grounded = true;
      }
    }
    if (!grounded && nextFeet > feet) {
      const ceiling = walkJumpCeiling(navigation, point, feet, feet + eyeHeightM, nextFeet + eyeHeightM, collision.radius);
      if (nextFeet + eyeHeightM > ceiling) { nextFeet = ceiling - eyeHeightM; velocity = 0; }
    }
    position = [...point, nextFeet];
  }
  function move(dx, dy, dt, eyeHeightM) {
    if (grounded && !dx && !dy && !needsSupportCheck) return;
    const count = Math.max(1, Math.ceil(dt * Math.max(120, Math.hypot(dx, dy) / .025)));
    for (let i = 0; i < count; i++) step([dx * dt / count, dy * dt / count], dt / count, eyeHeightM);
    needsSupportCheck = false;
  }
  function setPosition(point) {
    if (point[0] === position[0] && point[1] === position[1]) return;
    position = [point[0], point[1], position[2]];
    needsSupportCheck = true;
  }
  return { reset, jump, move, setPosition, canRise, get position() { return position; },
    state: () => ({ floorHeightM, jumpHeight: position[2] - floorHeightM, grounded }) };
}

function walkMarkup(button) {
  button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-controls', 'walk-controls');
  const panel = document.createElement('section'); panel.id = 'walk-controls'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Sterowanie spacerem');
  panel.innerHTML = `<p id="walk-help"><span id="walk-posture" aria-live="polite"></span> · WASD / strzałki: ruch · C: kucanie · X: czołganie · ponownie: wstań · Shift: sprint · Spacja: skok · przeciągnij widok: rozglądanie · Esc: wyjście</p>
    <div class="walk-touch"><div id="walk-joystick" class="walk-stick" tabindex="0" role="group" aria-label="Drążek ruchu" aria-description="Przesuń drążek lub użyj klawiszy WASD albo strzałek.">
      <span class="walk-stick-thumb" aria-hidden="true"></span>
    </div><button type="button" id="walk-gyro" aria-pressed="false" data-state="off" hidden>rozglądanie się</button></div>`;
  document.body.append(panel);
  return panel;
}

function walkKeyboard({ held, isActive, jump, togglePosture, exit, clear }) {
  const actions = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint' };
  const postureKeys = { KeyC: 'crouching', KeyX: 'crawling' };
  const formControl = target => target instanceof Element && (target.isContentEditable || !!target.closest('input,select,textarea,button,a,summary'));
  window.addEventListener('keydown', event => {
    if (!isActive()) return;
    if (event.code === 'Escape') { event.preventDefault(); exit(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ((!actions[event.code] && !postureKeys[event.code] && event.code !== 'Space') || formControl(event.target)) return;
    event.preventDefault();
    if (!event.repeat && !held.has(event.code)) {
      if (event.code === 'Space') jump();
      if (postureKeys[event.code]) togglePosture(postureKeys[event.code]);
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', event => { held.delete(event.code); });
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  document.addEventListener('focusin', event => { if (formControl(event.target)) clear(); });
  return actions;
}

function walkJoystick({ pad, isActive }) {
  const thumb = pad.querySelector('.walk-stick-thumb');
  let pointer = null, right = 0, forward = 0;
  function update(event) {
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    const distance = Math.hypot(dx, dy), fraction = Math.min(1, distance / pointer.radius);
    const unitX = distance ? dx / distance : 0, unitY = distance ? dy / distance : 0;
    const speed = Math.max(0, (fraction - .1) / .9);
    right = unitX * speed; forward = -unitY * speed;
    thumb.style.transform = `translate(${unitX * fraction * pointer.radius}px, ${unitY * fraction * pointer.radius}px)`;
  }
  function clear() {
    if (!pointer) return;
    const id = pointer.id;
    pointer = null; right = 0; forward = 0; thumb.style.transform = '';
    if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
  }
  pad.addEventListener('pointerdown', event => {
    if (!isActive() || pointer || event.button !== 0) return;
    event.preventDefault();
    const bounds = pad.getBoundingClientRect();
    pointer = { id: event.pointerId, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2,
      radius: Math.max(1, (Math.min(bounds.width, bounds.height) - thumb.offsetWidth) / 2) };
    pad.setPointerCapture(event.pointerId); update(event);
  });
  pad.addEventListener('pointermove', event => { if (pointer?.id === event.pointerId) update(event); });
  for (const type of ['pointerup', 'pointercancel']) {
    pad.addEventListener(type, event => { if (pointer?.id === event.pointerId) clear(); });
  }
  pad.addEventListener('lostpointercapture', event => { if (event.target === pad && pointer?.id === event.pointerId) clear(); });
  pad.addEventListener('contextmenu', event => event.preventDefault());
  return { clear, get right() { return right; }, get forward() { return forward; } };
}

function walkPointers({ canvas, isActive, look, widen }) {
  const contacts = new Map();
  const trackpad = walkTrackpad(canvas, isActive, widen, () => contacts.values().next().value?.type === 'touch');
  canvas.addEventListener('pointerdown', event => {
    if (!isActive() || event.button !== 0) return;
    if (contacts.size && (event.pointerType !== 'touch' || contacts.values().next().value.type !== 'touch')) return;
    if (!contacts.size) canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    contacts.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
  });
  canvas.addEventListener('pointermove', event => {
    const point = contacts.get(event.pointerId);
    if (!isActive() || !point) return;
    if (contacts.size === 1) look((event.clientX - point.x) * .004, -(event.clientY - point.y) * .004);
    if (contacts.size === 2) {
      const [first, second] = contacts.values(), other = point === first ? second : first;
      const before = Math.max(8, Math.hypot(point.x - other.x, point.y - other.y));
      const after = Math.max(8, Math.hypot(event.clientX - other.x, event.clientY - other.y));
      widen(18 * Math.log(before / after));
    }
    point.x = event.clientX; point.y = event.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => contacts.delete(event.pointerId));
  }
  return () => {
    for (const id of contacts.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    contacts.clear(); trackpad.clear();
  };
}

function walkTrackpad(canvas, isActive, widen, touchingCanvas) {
  let nativeGesture = null;
  canvas.addEventListener('gesturestart', event => {
    if (!isActive()) return;
    event.preventDefault();
    nativeGesture = { scale: 1, touchscreen: touchingCanvas() };
  }, { passive: false });
  canvas.addEventListener('gesturechange', event => {
    if (!isActive() || !nativeGesture) return;
    event.preventDefault();
    nativeGesture.touchscreen ||= touchingCanvas();
    if (nativeGesture.touchscreen || !Number.isFinite(event.scale) || event.scale <= 0) return;
    widen(18 * Math.log(nativeGesture.scale / event.scale));
    nativeGesture.scale = event.scale;
  }, { passive: false });
  canvas.addEventListener('gestureend', event => {
    if (isActive() && nativeGesture) event.preventDefault();
    nativeGesture = null;
  }, { passive: false });
  canvas.addEventListener('wheel', event => {
    if (!isActive() || !event.ctrlKey) return;
    event.preventDefault();
    if (nativeGesture || touchingCanvas()) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    widen(event.deltaY * unit * .18);
  }, { passive: false });
  return { clear() { nativeGesture = null; } };
}

function walkInput({ canvas, panel, isActive, move, look, widen, jump, togglePosture, exit, clearSprint }) {
  const held = new Set();
  const joystick = walkJoystick({ pad: panel.querySelector('#walk-joystick'), isActive });
  function clear() { held.clear(); clearDrag(); joystick.clear(); clearSprint(); }
  const actions = walkKeyboard({ held, isActive, jump, togglePosture, exit, clear });
  const clearDrag = walkPointers({ canvas, isActive, look, widen });
  return { clear, tick(dt) {
    const active = new Set([...held].map(code => actions[code]));
    move(joystick.forward + Number(active.has('forward')) - Number(active.has('back')),
      joystick.right + Number(active.has('right')) - Number(active.has('left')), dt, active.has('sprint'));
  } };
}

function walkButtons(button, isActive, enter, exit) {
  button.addEventListener('click', () => isActive() ? exit() : enter());
  document.addEventListener('click', event => {
    if (event.target.closest('#reset,#top,#in,#out,[id^="focus-"],#map-focus')) exit();
  }, true);
}

export function createWalkDepthGuard(THREE, camera, scene) {
  const bounds = scene ? new THREE.Box3().setFromObject(scene) : null;
  const corners = [];
  if (bounds && !bounds.isEmpty()) {
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  return () => {
    camera.near = .12;
    camera.far = corners.length ? Math.max(50, ...corners.map(point => point.distanceTo(camera.position) + 5)) : 1000;
    camera.updateProjectionMatrix();
  };
}

function createWalkView(THREE, requestDraw, scene) {
  const perspective = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, .12, 1000);
  perspective.up.set(0, 0, 1);
  const fitDepth = createWalkDepthGuard(THREE, perspective, scene);
  let yaw = 0, pitch = 0;
  function updateLook() {
    fitDepth();
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch));
    perspective.lookAt(perspective.position.clone().add(direction)); perspective.updateMatrixWorld(true); requestDraw();
  }
  function look(dx, dy) { yaw += dx; pitch = THREE.MathUtils.clamp(pitch + dy, -Math.PI * .46, Math.PI * .46); updateLook(); }
  function widen(delta) {
    const next = THREE.MathUtils.clamp(perspective.fov + delta, 55, 80);
    if (next === perspective.fov) return;
    perspective.fov = next; perspective.updateProjectionMatrix(); requestDraw();
  }
  return { camera: perspective, look, widen, updateLook, getState: () => ({ yaw, pitch, fov: perspective.fov }),
    face: direction => { yaw = Math.atan2(direction.x, direction.y); pitch = 0; } };
}

function walkOrientationDelta(THREE, look) {
  const radians = Math.PI / 180, euler = new THREE.Euler(), pose = new THREE.Quaternion();
  const localAim = new THREE.Vector3(), aim = new THREE.Vector3();
  let previous = null;
  function sample({ alpha, beta, gamma }, screenAngle) {
    if (![alpha, beta, gamma].every(Number.isFinite)) return false;
    pose.setFromEuler(euler.set(beta * radians, gamma * radians, alpha * radians, 'ZXY'));
    if (!previous || previous.screenAngle !== screenAngle) {
      // Use the screen's horizontal axis to calibrate even when the phone starts on a table.
      const angle = screenAngle * radians;
      aim.set(Math.cos(angle), -Math.sin(angle), 0).applyQuaternion(pose);
      if (Math.hypot(aim.x, aim.y) < .02) return false;
      localAim.set(-aim.y, aim.x, 0).normalize().applyQuaternion(pose.clone().invert());
      previous = null;
    }
    aim.copy(localAim).applyQuaternion(pose);
    const yaw = Math.atan2(aim.x, aim.y), pitch = Math.atan2(aim.z, Math.hypot(aim.x, aim.y));
    if (previous) {
      let dx = Math.atan2(Math.sin(yaw - previous.yaw), Math.cos(yaw - previous.yaw));
      // Heading is undefined when looking straight up or down.
      if (Math.abs(pitch) > 1.48 || Math.abs(previous.pitch) > 1.48 ||
          (Math.abs(pitch) > 1.2 && Math.abs(previous.pitch) > 1.2 && Math.abs(dx) > Math.PI * .75)) dx = 0;
      const dy = pitch - previous.pitch;
      if (Math.abs(dx) + Math.abs(dy) > 1e-8) look(dx, dy);
    }
    previous = { yaw, pitch, screenAngle };
    return true;
  }
  return { sample, reset() { previous = null; } };
}

export function createWalkGyroscope(THREE, button, look, host = window) {
  const sensor = host.DeviceOrientationEvent, doc = host.document;
  const supported = Boolean(sensor && host.isSecureContext &&
    (host.navigator.maxTouchPoints > 0 || host.matchMedia('(any-pointer: coarse)').matches));
  button.hidden = !supported;
  if (!supported) return { enter() {}, exit() {} };
  const tracker = walkOrientationDelta(THREE, look);
  let wanted = true, active = false, attached = false, samples = false, generation = 0, permission;
  function label(state, description) {
    button.setAttribute('data-state', state);
    button.setAttribute('aria-pressed', String(state === 'on' || state === 'waiting'));
    button.setAttribute('aria-description', description); button.title = description;
  }
  function sample(event) {
    if (doc.hidden) return;
    const angle = host.screen.orientation?.angle ?? host.orientation ?? 0;
    if (tracker.sample(event, angle) && !samples) {
      samples = true; label('on', 'Rozglądanie ruchem telefonu jest włączone.');
    }
  }
  function stop() {
    generation++; tracker.reset(); samples = false;
    if (!attached) return;
    host.removeEventListener('deviceorientation', sample);
    doc.removeEventListener('visibilitychange', tracker.reset);
    host.removeEventListener('pageshow', tracker.reset);
    attached = false;
  }
  async function start() {
    stop(); const current = generation;
    label('waiting', 'Oczekiwanie na odczyt z czujnika ruchu telefonu.');
    try {
      if (sensor.requestPermission) {
        // Calling this before the first await preserves the walk button's transient activation on iOS.
        permission ??= sensor.requestPermission();
        if (await permission !== 'granted') throw new Error('Permission denied');
      }
    } catch {
      permission = undefined;
      if (current !== generation) return;
      wanted = false; label('denied', 'Brak dostępu do czujnika. Przeciągnij widok palcem, aby się rozejrzeć.'); return;
    }
    if (current !== generation) return;
    host.addEventListener('deviceorientation', sample);
    doc.addEventListener('visibilitychange', tracker.reset);
    host.addEventListener('pageshow', tracker.reset); attached = true;
  }
  button.addEventListener('click', () => {
    if (!active) return;
    wanted = !wanted;
    if (wanted) start(); else { stop(); label('off', 'Rozglądanie ruchem telefonu jest wyłączone.'); }
  });
  return {
    enter() { active = true; if (wanted) start(); },
    exit() { active = false; stop(); },
  };
}

export function mergeInteriorNavigation(interiors) {
  const sources = interiors.filter(item => item.navigation);
  if (!sources.length) return undefined;
  const merge = kind => sources.flatMap(({ parcel, navigation }) => navigation[kind].map(item =>
    item.dynamicHeight ? { ...item, id: `${parcel}:${item.id}`, get minZ(){ return item.minZ; }, get maxZ(){ return item.maxZ; } } :
    { ...item, id: `${parcel}:${item.id}` }));
  return { obstacles: merge('obstacles'), floors: merge('floors'), ramps: merge('ramps'),
    ceilingHeight: point => Math.min(Infinity, ...sources.map(({ navigation }) => navigation.ceilingHeight?.(point) ?? Infinity)) };
}

function walkTerrainSampler(THREE, meshes, groundHeight) {
  const surfaces = meshes.map(mesh => {
    mesh.updateWorldMatrix(true, false);
    return {mesh, bounds: new THREE.Box3().setFromObject(mesh)};
  });
  const ray = new THREE.Raycaster(undefined, new THREE.Vector3(0, 0, -1));
  return ([x, y]) => {
    for (const {mesh, bounds} of surfaces) {
      if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y) continue;
      ray.ray.origin.set(x, y, bounds.max.z + 1);
      const [hit] = ray.intersectObject(mesh, false);
      if (hit) return hit.point.z;
    }
    return groundHeight?.(x,y) ?? 0;
  };
}

export function setupWalk({ THREE, scene, house, neighbors, camera, controls, renderer, requestDraw, onCameraChange, button, shortcutButton, interior, interiors, startView, terrainMeshes = [], groundHeight }) {
  const view = createWalkView(THREE, requestDraw, scene), perspective = view.camera;
  const sources = interiors ?? [{ parcel: '193', navigation: interior?.navigation }];
  const navigation = mergeInteriorNavigation(sources);
  if (navigation && (terrainMeshes.length || groundHeight)) navigation.terrainHeight = walkTerrainSampler(THREE, terrainMeshes, groundHeight);
  const navigableParcels = new Set(sources.filter(item => item.navigation).map(item => item.parcel));
  const footprints = walkHouseFootprints(house, neighbors).filter(item => !navigableParcels.has(item.parcel));
  const collision = createWalkCollision(footprints), motion = createWalkMotion(collision, navigation);
  const panel = walkMarkup(button), canvas = renderer.domElement;
  const gyro = createWalkGyroscope(THREE, panel.querySelector('#walk-gyro'), view.look);
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Interaktywny model 3D');
  let active = false, frame = null, last = 0;
  function move(forward, right, dt, sprint = false) {
    if (!active) return;
    motion.setPosition([perspective.position.x, perspective.position.y]);
    const previous = perspective.position.toArray(), point = motion.move(forward, right, dt, view.getState().yaw, sprint);
    if (point.every((value, index) => value === previous[index])) return;
    perspective.position.set(...point); view.updateLook();
  }
  const jump = () => active && motion.jump();
  const postureStatus = panel.querySelector('#walk-posture');
  function showPosture(blocked = false) {
    const { posture, eyeHeightM } = motion.getState();
    const height = eyeHeightM.toLocaleString('pl-PL', { minimumFractionDigits: 2 });
    postureStatus.textContent = `${walkPostures[posture].label} · wysokość oczu ${height} m${blocked ? ' · za mało miejsca, żeby się podnieść' : ''}`;
  }
  function togglePosture(requested) {
    const changed = motion.togglePosture(requested);
    showPosture(!changed);
    if (changed) { perspective.position.set(...motion.getState().position); view.updateLook(); }
  }
  const input = walkInput({ canvas, panel, isActive: () => active, move, look: view.look, widen: view.widen,
    jump, togglePosture, clearSprint: motion.clearSprint, exit: () => exit() });
  function tick(now) {
    frame = null; if (!active) return;
    input.tick(Math.min(.1, Math.max(0, (now - last) / 1000))); last = now; frame = requestAnimationFrame(tick);
  }
  function enter(preferred, direction) {
    if (active && !preferred) return;
    const initial = !preferred && (typeof startView === 'function' ? startView() : startView);
    const point = preferred ?? initial?.position ?? [controls.target.x, controls.target.y];
    const spawnCollision = navigation ? walkInteriorCollision(collision, navigation, point[2] ?? 0, point[2] ?? 0) : collision;
    const spawn = [...spawnCollision.safeSpawn(point.slice(0, 2)), point[2] ?? 0];
    const facing = direction ?? (initial ? [initial.target[0] - point[0], initial.target[1] - point[1]] : null);
    view.face(facing ? new THREE.Vector3(facing[0], facing[1], 0) : camera.getWorldDirection(new THREE.Vector3()));
    if (frame !== null) cancelAnimationFrame(frame);
    motion.reset(navigation ? spawn : spawn.slice(0, 2)); perspective.position.set(...motion.getState().position); active = true; controls.enabled = false;
    showPosture(); input.clear(); gyro.enter(); panel.hidden = false; document.body.classList.add('walk-mode');
    button.setAttribute('aria-pressed', 'true'); button.textContent = 'Wyjdź ze spaceru';
    shortcutButton?.setAttribute('aria-pressed', 'true');
    resize(); view.look(0, initial?.pitch ?? 0); onCameraChange(perspective); canvas.focus({ preventScroll: true });
    last = performance.now(); frame = requestAnimationFrame(tick);
  }
  function exit() {
    if (!active) return;
    active = false; gyro.exit(); input.clear(); motion.reset(perspective.position.toArray().slice(0, 2));
    perspective.position.set(...motion.getState().position); cancelAnimationFrame(frame); frame = null;
    controls.enabled = true; panel.hidden = true; document.body.classList.remove('walk-mode');
    button.setAttribute('aria-pressed', 'false'); button.textContent = 'Spacer · 1,7 m';
    shortcutButton?.setAttribute('aria-pressed', 'false');
    onCameraChange(camera); controls.update(); requestDraw();
  }
  function resize() { perspective.aspect = innerWidth / innerHeight; perspective.updateProjectionMatrix(); }
  walkButtons(button, () => active, enter, exit);
  shortcutButton?.addEventListener('click', () => button.click());
  return { enter, exit, resize, move, look: view.look, jump, camera: perspective, collision, clearInput: input.clear,
    getState: () => ({ ...motion.getState(), ...view.getState(), active, position: perspective.position.toArray(),
      collisionRadiusM: collision.radius, footprintParcels: [...new Set(collision.footprints.map(item => item.parcel))] }) };
}
