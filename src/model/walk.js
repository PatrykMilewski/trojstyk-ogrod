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

function walkMarkup(button) {
  button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-controls', 'walk-controls');
  const panel = document.createElement('section'); panel.id = 'walk-controls'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Sterowanie spacerem');
  panel.innerHTML = `<p id="walk-help">Wysokość oczu 1,70 m · WASD / strzałki: ruch · przeciągnij widok: rozglądanie · Esc: wyjście</p>
    <div class="walk-pad"><button type="button" data-walk="forward" aria-label="Idź do przodu">↑</button>
    <button type="button" data-walk="left" aria-label="Idź w lewo">←</button>
    <button type="button" data-walk="back" aria-label="Idź do tyłu">↓</button>
    <button type="button" data-walk="right" aria-label="Idź w prawo">→</button></div>
    <button type="button" id="walk-exit">Zakończ spacer</button>`;
  document.body.append(panel);
  return panel;
}

function walkInput({ canvas, panel, isActive, move, look, exit }) {
  const held = new Set(), pointers = new Map(); let drag = null;
  const actions = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  const formControl = target => target instanceof Element && !!target.closest('input,select,textarea,button,a,summary,[contenteditable="true"]');
  function clear() { held.clear(); pointers.clear(); drag = null; }
  window.addEventListener('keydown', event => {
    if (!isActive()) return;
    if (event.code === 'Escape') { event.preventDefault(); exit(); return; }
    if (!actions[event.code] || formControl(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault(); held.add(event.code);
  });
  window.addEventListener('keyup', event => held.delete(event.code));
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  document.addEventListener('focusin', event => { if (formControl(event.target)) clear(); });
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
  panel.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-walk]');
    if (!isActive() || !button) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); pointers.set(event.pointerId, button.dataset.walk);
  });
  return { clear, tick(dt) {
    const active = new Set([...held].map(code => actions[code]).concat([...pointers.values()]));
    move(Number(active.has('forward')) - Number(active.has('back')), Number(active.has('right')) - Number(active.has('left')), dt);
  } };
}

function walkButtons(button, panel, isActive, enter, exit) {
  button.addEventListener('click', () => isActive() ? exit() : enter());
  panel.querySelector('#walk-exit').addEventListener('click', () => { exit(); button.focus(); });
  document.addEventListener('click', event => {
    if (event.target.closest('#reset,#top,#in,#out,[id^="focus-"],#map-focus')) exit();
  }, true);
}

export function setupWalk({ THREE, house, neighbors, camera, controls, renderer, requestDraw, onCameraChange, button }) {
  const perspective = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, .06, 5000);
  perspective.up.set(0, 0, 1);
  const collision = createWalkCollision(walkHouseFootprints(house, neighbors));
  const panel = walkMarkup(button), canvas = renderer.domElement;
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Interaktywny model 3D');
  let active = false, yaw = 0, pitch = 0, frame = null, last = 0;
  function updateLook() {
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch));
    perspective.lookAt(perspective.position.clone().add(direction)); perspective.updateMatrixWorld(true); requestDraw();
  }
  function look(dx, dy) { yaw += dx; pitch = THREE.MathUtils.clamp(pitch + dy, -Math.PI * .46, Math.PI * .46); updateLook(); }
  function move(forward, right, dt) {
    if (!active || (!forward && !right)) return;
    const speed = 2.2 * Math.max(0, Math.min(.1, dt)) / Math.max(1, Math.hypot(forward, right));
    const point = collision.move([perspective.position.x, perspective.position.y],
      [(Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed, (Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed]);
    perspective.position.set(...point, 1.7); updateLook();
  }
  const input = walkInput({ canvas, panel, isActive: () => active, move, look, exit: () => exit() });
  function tick(now) {
    frame = null; if (!active) return;
    input.tick((now - last) / 1000); last = now; frame = requestAnimationFrame(tick);
  }
  function enter() {
    if (active) return;
    const spawn = collision.safeSpawn([controls.target.x, controls.target.y]);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    yaw = Math.atan2(direction.x, direction.y); pitch = 0;
    perspective.position.set(...spawn, 1.7); active = true; controls.enabled = false;
    input.clear(); panel.hidden = false; document.body.classList.add('walk-mode');
    button.setAttribute('aria-pressed', 'true'); button.textContent = 'Wyjdź ze spaceru';
    resize(); updateLook(); onCameraChange(perspective); canvas.focus({ preventScroll: true });
    last = performance.now(); frame = requestAnimationFrame(tick);
  }
  function exit() {
    if (!active) return;
    active = false; input.clear(); cancelAnimationFrame(frame); frame = null;
    controls.enabled = true; panel.hidden = true; document.body.classList.remove('walk-mode');
    button.setAttribute('aria-pressed', 'false'); button.textContent = 'Spacer · 1,7 m';
    onCameraChange(camera); controls.update(); requestDraw();
  }
  function resize() { perspective.aspect = innerWidth / innerHeight; perspective.updateProjectionMatrix(); }
  walkButtons(button, panel, () => active, enter, exit);
  return { enter, exit, resize, move, look, camera: perspective, collision, clearInput: input.clear,
    getState: () => ({ active, eyeHeightM: 1.7, position: perspective.position.toArray(), yaw, pitch,
      collisionRadiusM: collision.radius, footprintParcels: [...new Set(collision.footprints.map(item => item.parcel))] }) };
}
