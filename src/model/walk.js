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
    footprints.push({ parcel: model.parcel, ring: model.footprint.coordinates[0].map(point => point.slice(0, 2)) });
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
  function pathBlocked(a, b) {
    return footprints.some(({ ring }) => walkInside(a, ring) || walkInside(b, ring) || ring.some((point, i) =>
      walkSegmentDistance(a, b, point, ring[(i + 1) % ring.length]) <= radius));
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

export function createWalkMotion(collision, navigation) {
  if (navigation) return createInteriorWalkMotion(collision, navigation);
  const eyeHeightM = 1.7, walkSpeedMps = 2.2, sprintMultiplier = 2.2, jumpHeightM = .6, gravityMps2 = 9.81;
  const launchSpeedMps = Math.sqrt(2 * gravityMps2 * jumpHeightM);
  let position = [0, 0, eyeHeightM], flightTime = null, sprinting = false;
  function reset(point) { position = [...point, eyeHeightM]; flightTime = null; sprinting = false; }
  function jump() {
    if (flightTime !== null) return false;
    flightTime = 0; return true;
  }
  function move(forward, right, dt, yaw = 0, sprint = false) {
    if (![forward, right, dt, yaw].every(Number.isFinite) || dt < 0) throw new TypeError('Nieprawidłowy krok spaceru.');
    sprinting = sprint && !!(forward || right);
    const distance = walkSpeedMps * (sprinting ? sprintMultiplier : 1) * dt / Math.max(1, Math.hypot(forward, right));
    const point = collision.move(position.slice(0, 2), [(Math.sin(yaw) * forward + Math.cos(yaw) * right) * distance,
      (Math.cos(yaw) * forward - Math.sin(yaw) * right) * distance]);
    if (flightTime !== null) {
      flightTime += dt;
      if (flightTime >= 2 * launchSpeedMps / gravityMps2) flightTime = null;
    }
    const height = flightTime === null ? 0 : launchSpeedMps * flightTime - gravityMps2 * flightTime * flightTime / 2;
    position = [...point, eyeHeightM + height]; return [...position];
  }
  return { reset, jump, move, setPosition: point => { position = [...point, position[2]]; }, clearSprint: () => { sprinting = false; },
    getState: () => ({ position: [...position], eyeHeightM, walkSpeedMps, sprintMultiplier, jumpHeightM, gravityMps2,
      floorHeightM: 0, jumpHeight: position[2] - eyeHeightM, grounded: flightTime === null, sprinting }) };
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
  return Math.max(0, ...floorHeights, ...rampHeights);
}

function walkCeilingMove(navigation, start, end, feet) {
  if (!navigation.ceilingHeight || navigation.ceilingHeight(end) >= feet + 1.7) return end;
  let low = 0, high = 1;
  for (let i = 0; i < 30; i++) {
    const t = (low + high) / 2, point = [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];
    if (navigation.ceilingHeight(point) >= feet + 1.7) low = t; else high = t;
  }
  return [start[0] + (end[0] - start[0]) * low, start[1] + (end[1] - start[1]) * low];
}

function walkSlabStepClear(wall, point, feet, navigation, radius) {
  if (wall.kind !== 'slab' || wall.maxZ - feet > .25 || wall.maxZ < feet - 1e-6) return false;
  return navigation.ramps.some(ramp => [[ramp.start, ramp.z0], [ramp.end, ramp.z1]].some(([end, z]) =>
    Math.abs(z - wall.maxZ) < 1e-6 && Math.hypot(point[0] - end[0], point[1] - end[1]) <= radius + .1));
}

function walkInteriorCollision(collision, navigation, minFeet, maxFeet, stepPoint) {
  const walls = navigation.obstacles.filter(wall => wall.minZ < maxFeet + 1.7 - 1e-6 && wall.maxZ > minFeet + 1e-6 &&
    !(stepPoint && walkSlabStepClear(wall, stepPoint, minFeet, navigation, collision.radius)));
  return createWalkCollision([...collision.footprints, ...walls], collision.radius);
}

function createInteriorWalkMotion(collision, navigation) {
  const eyeHeightM = 1.7, walkSpeedMps = 2.2, sprintMultiplier = 2.2, jumpHeightM = .6, gravityMps2 = 9.81;
  const launchSpeed = Math.sqrt(2 * gravityMps2 * jumpHeightM);
  let position = [0, 0, eyeHeightM], floorHeightM = 0, velocity = 0, grounded = true, sprinting = false;
  let landingCeiling = 0, connectedRamps = new Set();
  function airborneRamps() {
    return new Set(navigation.ramps.filter(ramp => Math.abs(ramp.z0 - floorHeightM) <= .12 ||
      Math.abs(ramp.z1 - floorHeightM) <= .12 || Math.abs((walkRampHeight(position, ramp) ?? Infinity) - floorHeightM) <= .12)
      .map(ramp => ramp.id));
  }
  function reset(point) {
    floorHeightM = walkSupport(point, navigation, point[2] ?? 0);
    position = [point[0], point[1], floorHeightM + eyeHeightM];
    velocity = 0; grounded = true; sprinting = false; landingCeiling = floorHeightM; connectedRamps = new Set();
  }
  function jump() {
    if (!grounded) return false;
    connectedRamps = airborneRamps(); grounded = false; velocity = launchSpeed; landingCeiling = floorHeightM; return true;
  }
  function step(delta, dt) {
    const feet = position[2] - eyeHeightM;
    let nextFeet = grounded ? feet : feet + velocity * dt - gravityMps2 * dt * dt / 2;
    const tentative = [position[0] + delta[0], position[1] + delta[1]];
    // Only a small connected rise may be stepped onto; a jump cannot select another storey.
    const support = walkSupport(tentative, navigation, grounded ? feet + .12 : landingCeiling + .12, grounded ? undefined : connectedRamps, grounded ? Infinity : Math.max(feet, nextFeet) + .12);
    if (grounded && support >= feet - .12) nextFeet = support;
    const walls = walkInteriorCollision(collision, navigation, Math.min(feet, nextFeet), Math.max(feet, nextFeet), grounded ? position : undefined);
    const point = walkCeilingMove(navigation, position, walls.move(position.slice(0, 2), delta), feet);
    const surface = walkSupport(point, navigation, grounded ? feet + .12 : landingCeiling + .12, grounded ? undefined : connectedRamps, grounded ? Infinity : Math.max(feet, nextFeet) + .12);
    if (grounded && surface >= feet - .12) { nextFeet = surface; floorHeightM = surface; landingCeiling = surface; }
    else {
      if (grounded) { connectedRamps = airborneRamps(); grounded = false; velocity = 0; landingCeiling = feet; }
      velocity -= gravityMps2 * dt;
      if (nextFeet <= surface && velocity <= 0) {
        nextFeet = surface; floorHeightM = surface; velocity = 0; grounded = true;
      }
    }
    const ceiling = navigation.obstacles.filter(wall => wall.minZ >= feet + eyeHeightM - 1e-6 &&
      walkInside(point, wall.ring)).reduce((height, wall) => Math.min(height, wall.minZ - eyeHeightM), navigation.ceilingHeight ? navigation.ceilingHeight(point) - eyeHeightM : Infinity);
    if (!grounded && nextFeet > ceiling) { nextFeet = ceiling; velocity = Math.min(0, velocity); }
    position = [...point, nextFeet + eyeHeightM];
  }
  function move(forward, right, dt, yaw = 0, sprint = false) {
    if (![forward, right, dt, yaw].every(Number.isFinite) || dt < 0) throw new TypeError('Nieprawidłowy krok spaceru.');
    sprinting = sprint && !!(forward || right);
    const speed = walkSpeedMps * (sprinting ? sprintMultiplier : 1) / Math.max(1, Math.hypot(forward, right));
    const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed;
    const dy = (Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed;
    const count = Math.max(1, Math.ceil(dt * Math.max(120, Math.hypot(dx, dy) / .025)));
    for (let i = 0; i < count; i++) step([dx * dt / count, dy * dt / count], dt / count);
    return [...position];
  }
  return { reset, jump, move, setPosition: point => { position = [point[0], point[1], position[2]]; },
    clearSprint: () => { sprinting = false; },
    getState: () => ({ position: [...position], eyeHeightM, walkSpeedMps, sprintMultiplier, jumpHeightM, gravityMps2,
      floorHeightM, jumpHeight: position[2] - eyeHeightM - floorHeightM, grounded, sprinting }) };
}

function walkMarkup(button) {
  button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-controls', 'walk-controls');
  const panel = document.createElement('section'); panel.id = 'walk-controls'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Sterowanie spacerem');
  panel.innerHTML = `<p id="walk-help">Wysokość oczu 1,70 m · WASD / strzałki: ruch · Shift: sprint · Spacja: skok · przeciągnij widok: rozglądanie · Esc: wyjście</p>
    <div class="walk-touch" aria-label="Ruch na ekranie dotykowym"><button type="button" data-walk="forward" aria-label="Przytrzymaj, aby iść do przodu">↑ Przód</button><button type="button" data-walk="back" aria-label="Przytrzymaj, aby iść do tyłu">↓ Tył</button></div>`;
  document.body.append(panel);
  return panel;
}

function walkKeyboard({ held, isActive, jump, exit, clear }) {
  const actions = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint',
    SprintSpace: 'sprint', SprintEnter: 'sprint' };
  const formControl = target => target instanceof Element && !!target.closest('input,select,textarea,button,a,summary,[contenteditable="true"]');
  window.addEventListener('keydown', event => {
    if (!isActive()) return;
    if (event.code === 'Escape') { event.preventDefault(); exit(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const control = event.target instanceof Element ? event.target.closest('[data-walk]')?.dataset.walk : null;
    if (['sprint', 'jump'].includes(control) && ['Space', 'Enter'].includes(event.code)) {
      event.preventDefault();
      if (control === 'sprint') held.add(`Sprint${event.code}`);
      else if (!event.repeat && !held.has(event.code)) jump();
      held.add(event.code); return;
    }
    if ((!actions[event.code] && event.code !== 'Space') || (formControl(event.target) && !(control && actions[event.code]))) return;
    event.preventDefault();
    if (event.code === 'Space' && !event.repeat && !held.has('Space')) jump();
    held.add(event.code);
  });
  window.addEventListener('keyup', event => { held.delete(event.code); held.delete(`Sprint${event.code}`); });
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  document.addEventListener('focusin', event => { if (formControl(event.target)) clear(); });
  return actions;
}

function walkPointers({ canvas, panel, pointers, isActive, look, jump }) {
  let drag = null;
  canvas.addEventListener('pointerdown', event => {
    if (!isActive() || event.button !== 0 || drag) return;
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', event => {
    if (!isActive() || drag?.id !== event.pointerId) return;
    look((event.clientX - drag.x) * .004, -(event.clientY - drag.y) * .004);
    drag.x = event.clientX; drag.y = event.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => { if (drag?.id === event.pointerId) drag = null; });
    panel.addEventListener(type, event => pointers.delete(event.pointerId));
  }
  panel.addEventListener('contextmenu', event => { if (event.target.closest('[data-walk]')) event.preventDefault(); });
  panel.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-walk]');
    if (!isActive() || !button) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    if (button.dataset.walk === 'jump') jump(); else pointers.set(event.pointerId, button.dataset.walk);
  });
  panel.addEventListener('click', event => {
    if (isActive() && event.detail === 0 && event.target.closest('[data-walk="jump"]')) jump();
  });
  return () => { drag = null; };
}

function walkInput({ canvas, panel, isActive, move, look, jump, exit, clearSprint }) {
  const held = new Set(), pointers = new Map();
  function clear() { held.clear(); pointers.clear(); clearDrag(); clearSprint(); }
  const actions = walkKeyboard({ held, isActive, jump, exit, clear });
  const clearDrag = walkPointers({ canvas, panel, pointers, isActive, look, jump });
  return { clear, tick(dt) {
    const active = new Set([...held].map(code => actions[code]).concat([...pointers.values()]));
    move(Number(active.has('forward')) - Number(active.has('back')), Number(active.has('right')) - Number(active.has('left')), dt, active.has('sprint'));
  } };
}

function walkButtons(button, isActive, enter, exit) {
  button.addEventListener('click', () => isActive() ? exit() : enter());
  document.addEventListener('click', event => {
    if (event.target.closest('#reset,#top,#in,#out,[id^="focus-"],#map-focus')) exit();
  }, true);
}

function createWalkView(THREE, requestDraw) {
  const perspective = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, .06, 5000);
  perspective.up.set(0, 0, 1);
  let yaw = 0, pitch = 0;
  function updateLook() {
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch));
    perspective.lookAt(perspective.position.clone().add(direction)); perspective.updateMatrixWorld(true); requestDraw();
  }
  function look(dx, dy) { yaw += dx; pitch = THREE.MathUtils.clamp(pitch + dy, -Math.PI * .46, Math.PI * .46); updateLook(); }
  return { camera: perspective, look, updateLook, getState: () => ({ yaw, pitch }),
    face: direction => { yaw = Math.atan2(direction.x, direction.y); pitch = 0; } };
}

export function setupWalk({ THREE, house, neighbors, camera, controls, renderer, requestDraw, onCameraChange, button, interior }) {
  const view = createWalkView(THREE, requestDraw), perspective = view.camera;
  const navigation = interior?.navigation;
  const footprints = walkHouseFootprints(house, neighbors).filter(item => !navigation || item.parcel !== '193');
  const collision = createWalkCollision(footprints), motion = createWalkMotion(collision, navigation);
  const panel = walkMarkup(button), canvas = renderer.domElement;
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
  const input = walkInput({ canvas, panel, isActive: () => active, move, look: view.look, jump, clearSprint: motion.clearSprint, exit: () => exit() });
  function tick(now) {
    frame = null; if (!active) return;
    input.tick(Math.min(.1, Math.max(0, (now - last) / 1000))); last = now; frame = requestAnimationFrame(tick);
  }
  function enter(preferred, direction) {
    if (active && !preferred) return;
    const point = preferred ?? [controls.target.x, controls.target.y];
    const spawnCollision = navigation ? walkInteriorCollision(collision, navigation, point[2] ?? 0, point[2] ?? 0) : collision;
    const spawn = [...spawnCollision.safeSpawn(point.slice(0, 2)), point[2] ?? 0];
    view.face(direction ? new THREE.Vector3(direction[0], direction[1], 0) : camera.getWorldDirection(new THREE.Vector3()));
    if (frame !== null) cancelAnimationFrame(frame);
    motion.reset(navigation ? spawn : spawn.slice(0, 2)); perspective.position.set(...motion.getState().position); active = true; controls.enabled = false;
    input.clear(); panel.hidden = false; document.body.classList.add('walk-mode');
    button.setAttribute('aria-pressed', 'true'); button.textContent = 'Wyjdź ze spaceru';
    resize(); view.updateLook(); onCameraChange(perspective); canvas.focus({ preventScroll: true });
    last = performance.now(); frame = requestAnimationFrame(tick);
  }
  function exit() {
    if (!active) return;
    active = false; input.clear(); motion.reset(perspective.position.toArray().slice(0, 2));
    perspective.position.set(...motion.getState().position); cancelAnimationFrame(frame); frame = null;
    controls.enabled = true; panel.hidden = true; document.body.classList.remove('walk-mode');
    button.setAttribute('aria-pressed', 'false'); button.textContent = 'Spacer · 1,7 m';
    onCameraChange(camera); controls.update(); requestDraw();
  }
  function resize() { perspective.aspect = innerWidth / innerHeight; perspective.updateProjectionMatrix(); }
  walkButtons(button, () => active, enter, exit);
  return { enter, exit, resize, move, look: view.look, jump, camera: perspective, collision, clearInput: input.clear,
    getState: () => ({ ...motion.getState(), ...view.getState(), active, position: perspective.position.toArray(),
      collisionRadiusM: collision.radius, footprintParcels: [...new Set(collision.footprints.map(item => item.parcel))] }) };
}
