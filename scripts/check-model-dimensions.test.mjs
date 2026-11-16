import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const original = readFileSync(join(root, 'trzy-domy-3d/index.html'), 'utf8');
const checker = join(root, 'scripts/check-model-dimensions.mjs');

function runCandidate(t, transform) {
  const directory = mkdtempSync(join(tmpdir(), 'model-dimensions-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'model.html');
  const candidate = transform(original);
  assert.notEqual(candidate, original, 'Fixture must actually change the artifact');
  writeFileSync(file, candidate);
  return spawnSync(process.execPath, [checker, file], { encoding: 'utf8' });
}

test('accepts the reviewed model', () => {
  execFileSync(process.execPath, [checker], { stdio: 'pipe' });
});

test('rejects a changed house dimension without updating the registry', (t) => {
  const result = runCandidate(t, (html) => html.replace('"width": 14.64', '"width": 15.64'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Model data changed/);
});

test('rejects a procedural sauna size change', (t) => {
  const result = runCandidate(t, (html) => html.replace('wallHeight=2,roofPitchDeg=45', 'wallHeight=2.3,roofPitchDeg=45'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Procedural geometry changed/);
});

test('accepts UI copy changes that leave geometry untouched', (t) => {
  const result = runCandidate(t, (html) => html.replace('Trzy domy + trójstyk', 'Trzy domy i wspólny ogród'));
  assert.equal(result.status, 0, result.stderr);
});
