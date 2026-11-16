import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (value) => createHash('sha256').update(value).digest('hex');

function extractModel(html) {
  const marker = 'const [source,garden,house,neighbors]=';
  const start = html.indexOf(marker);
  const end = html.indexOf(';\nconst landscaping=', start);
  const codeEnd = html.indexOf('\nlet descriptions=', end);
  assert.ok(start >= 0 && end > start && codeEnd > end, 'Missing model geometry markers');
  const inputs = html.slice(start + marker.length, end);
  return { data: JSON.parse(inputs), inputsHash: hash(inputs), codeHash: hash(html.slice(end + 2, codeEnd)) };
}

function checkDimensions(model, registry) {
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.units.length, 'm');
  for (const detail of registry.details) {
    assert.equal(detail.values.length, detail.labels.length, detail.id);
    assert.ok(detail.values.every((value) => Number.isFinite(value) && value > 0), detail.id);
  }
  assert.equal(model.inputsHash, registry.integrity.inputsSha256, 'Model data changed: review dimensions and placements before updating the registry');
  assert.equal(model.codeHash, registry.integrity.proceduralCodeSha256, 'Procedural geometry changed: measure and review before updating the registry');
  const [, garden, icon, neighbors] = model.data;
  const houses = [{ ...icon, parcel: '193' }, ...neighbors.houses];
  for (const expected of registry.houses) {
    const actual = houses.find((house) => house.parcel === expected.parcel);
    assert.ok(actual, `Missing house /${expected.parcel}`);
    assert.equal(actual.metadata.dimensions.width, expected.catalogueEnvelopeM.width);
    assert.equal(actual.metadata.dimensions.depth, expected.catalogueEnvelopeM.depth);
    assert.equal(Math.max(...actual.meshes.flatMap((mesh) => mesh.vertices.map((p) => p[2]))), expected.modelMaxZM);
  }
  const objects = [...garden.objects, ...neighbors.gardenAdditions.objects];
  assert.equal(objects.length, registry.objects.length, 'Object inventory changed');
  for (const expected of registry.objects) {
    const actual = objects.find((object) => object.id === expected.id);
    assert.ok(actual, `Missing object ${expected.id}`);
    assert.deepEqual([actual.w, actual.d], expected.planFootprintM, expected.id);
    assert.ok(expected.boundsLocalM.size.every((n) => Number.isFinite(n) && n > 0), expected.id);
  }
}

const htmlPath = resolve(process.argv[2] || `${root}/trzy-domy-3d/index.html`);
const registryPath = resolve(process.argv[3] || `${root}/trzy-domy-3d/model-dimensions.json`);
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
checkDimensions(extractModel(readFileSync(htmlPath, 'utf8')), registry);
console.log(`Model dimensions OK: ${registry.houses.length} houses, ${registry.objects.length} objects; version ${registry.modelVersion}`);
