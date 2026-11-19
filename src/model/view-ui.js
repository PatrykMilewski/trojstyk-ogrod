export function bindModelTap(canvas, onTap) {
  const contacts = new Set();
  let start;
  canvas.addEventListener('pointerdown', event => {
    contacts.add(event.pointerId);
    start = contacts.size === 1 && event.button === 0
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  function moved(event) {
    return Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6;
  }
  canvas.addEventListener('pointermove', event => {
    if (start?.id === event.pointerId && moved(event)) start = null;
  });
  function release(event) {
    contacts.delete(event.pointerId);
    if (start?.id === event.pointerId) start = null;
  }
  canvas.addEventListener('pointerup', event => {
    const tap = start?.id === event.pointerId && !moved(event);
    release(event);
    if (!tap) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width, y = (event.clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onTap({ x: 2*x - 1, y: 1 - 2*y });
  });
  for (const name of ['pointercancel', 'lostpointercapture', 'pointerleave']) canvas.addEventListener(name, release);
}

function bindViewMenu({ menu, toggle, tools, toolsToggle, solar, requestDraw, canvas, positionPanels }) {
  const closeMenu = () => { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };
  const closeTools = () => { tools.hidden = true; toolsToggle.setAttribute('aria-expanded', 'false'); };
  toggle.addEventListener('click', () => {
    const open = menu.hidden; closeTools(); menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open)); positionPanels();
    if (open) menu.querySelector('button').focus();
  });
  toolsToggle.addEventListener('click', () => {
    const open = tools.hidden; closeMenu(); tools.hidden = !open;
    toolsToggle.setAttribute('aria-expanded', String(open));
    if (open) solar.activate(); positionPanels(); requestDraw();
  });
  menu.addEventListener('click', event => {
    if (!event.target.closest('button')) return;
    closeMenu(); canvas.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.code !== 'Escape') return;
    if (!menu.hidden) { closeMenu(); toggle.focus(); }
    else if (!tools.hidden) { closeTools(); toolsToggle.focus(); }
  });
  return closeMenu;
}

function positionViewPanels({ tools, menu, clock, info }) {
  const top = document.querySelector('.panel').getBoundingClientRect().bottom + 10;
  const walk = document.getElementById('walk-controls');
  const halfClock = (clock.offsetWidth || 230) / 2;
  const overlapsClock = rect => rect.left < innerWidth / 2 + halfClock && rect.right > innerWidth / 2 - halfClock;
  const walkHeight = walk && !walk.hidden ? walk.getBoundingClientRect().height + 32 : 0;
  const infoRect = info.getBoundingClientRect();
  const infoHeight = overlapsClock(infoRect) && infoRect.height ? infoRect.height + 26 : 0;
  const bottom = Math.max(20, walkHeight, infoHeight);
  clock.style.bottom = bottom + 'px';
  for (const panel of [tools, menu]) {
    const reserved = !clock.hidden && overlapsClock(panel.getBoundingClientRect()) ? bottom + clock.offsetHeight + 12 : 16;
    panel.style.top = top + 'px';
    panel.style.maxHeight = Math.max(80, innerHeight - top - reserved) + 'px';
  }
}

export function setupViewUI({ solar, requestDraw, canvas }) {
  const menu = document.getElementById('view-menu'), toggle = document.getElementById('views-toggle');
  const tools = document.getElementById('environment-tools'), toolsToggle = document.getElementById('tools-toggle');
  const clock = document.getElementById('simulation-clock'), time = document.getElementById('simulation-time');
  const play = document.getElementById('simulation-play');
  const date = document.getElementById('simulation-date'), info = document.getElementById('model-info');
  const positionPanels = () => positionViewPanels({ tools, menu, clock, info });
  const closeMenu = bindViewMenu({ menu, toggle, tools, toolsToggle, solar, requestDraw, canvas, positionPanels });
  play.addEventListener('click', event => {
    if (solar.getState().playing) solar.pause();
    else solar.play();
    syncClock(solar.getState()); requestDraw();
    if (event.detail > 0) canvas.focus({ preventScroll: true });
  });
  function syncClock(state) {
    clock.hidden = !state.active; document.body.classList.toggle('solar-mode', state.active);
    time.textContent = `${state.time}:${state.seconds}`;
    date.textContent = state.date.split('-').reverse().join('.') + ' · czas w Polsce';
    play.textContent = state.playing ? '❚❚' : '▶';
    play.setAttribute('aria-pressed', String(state.playing));
    play.setAttribute('aria-label', state.playing ? 'Wstrzymaj symulację słońca' : 'Odtwórz symulację słońca');
    play.title = play.getAttribute('aria-label');
  }
  const observer = new ResizeObserver(positionPanels);
  observer.observe(document.querySelector('.panel')); observer.observe(info); observer.observe(clock);
  const walkPanel = document.getElementById('walk-controls'); if (walkPanel) observer.observe(walkPanel);
  info.addEventListener('toggle', positionPanels);
  return { syncClock, positionPanels, closeMenu };
}
