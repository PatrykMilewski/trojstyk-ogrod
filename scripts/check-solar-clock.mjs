import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../src/model/view-ui.js', import.meta.url), 'utf8');
const { setupViewUI } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function element() {
  const handlers = new Map(), attributes = new Map();
  return { hidden: true, textContent: '', style: {}, offsetWidth: 280, offsetHeight: 90,
    addEventListener: (name, callback) => handlers.set(name, callback),
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: name => attributes.get(name),
    click(detail = 1) { handlers.get('click')?.({ detail }); },
    getBoundingClientRect: () => ({ left: 0, right: 10, height: 0, bottom: 30 }) };
}

test('floating clock toggles the same solar playback and reflects external pause/play', () => {
  const ids = new Map(), node = id => { if (!ids.has(id)) ids.set(id, element()); return ids.get(id); };
  const oldDocument = globalThis.document, oldObserver = globalThis.ResizeObserver;
  globalThis.document = { getElementById: node, querySelector: node, addEventListener() {},
    body: { classList: { toggle() {} } } };
  globalThis.ResizeObserver = class { observe() {} };
  const state = { active: false, playing: false, date: '2026-07-20', time: '20:50', seconds: '02' };
  const solar = { getState: () => ({ ...state }), play() { state.active = true; state.playing = true; },
    pause() { state.playing = false; } };
  let draws = 0, canvasFocus = 0;
  try {
    const ui = setupViewUI({ solar, requestDraw: () => draws++, canvas: { focus() { canvasFocus++; } } });
    ui.syncClock(state);
    assert.equal(node('simulation-clock').hidden, true);
    state.active = true; ui.syncClock(state);
    assert.equal(node('simulation-clock').hidden, false);
    assert.equal(node('simulation-time').textContent, '20:50:02');
    assert.equal(node('simulation-date').textContent, '20.07.2026 · czas w Polsce');
    const play = node('simulation-play');
    play.click(); assert.equal(state.playing, true);
    assert.equal(play.getAttribute('aria-pressed'), 'true');
    assert.equal(play.getAttribute('aria-label'), 'Wstrzymaj symulację słońca');
    assert.equal(canvasFocus, 1, 'pointer activation returns focus to walking canvas');
    play.click(0); assert.equal(state.playing, false);
    assert.equal(canvasFocus, 1, 'keyboard activation retains button focus');
    assert.equal(play.getAttribute('aria-label'), 'Odtwórz symulację słońca');
    solar.play(); ui.syncClock(state); assert.equal(play.getAttribute('aria-pressed'), 'true');
    solar.pause(); ui.syncClock(state); assert.equal(play.getAttribute('aria-pressed'), 'false');
    assert.equal(draws, 2);
  } finally { globalThis.document = oldDocument; globalThis.ResizeObserver = oldObserver; }
});
