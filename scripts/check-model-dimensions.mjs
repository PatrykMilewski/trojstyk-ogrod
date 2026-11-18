import assert from 'node:assert/strict';
import {checkWoodyPlanting} from './check-woody-beds.mjs';
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
  const woodyData = html.match(/^const woodyPlantings=(.+);$/m);
  assert.ok(woodyData, 'Missing woody planting geometry');
  return { woodyPlantings: JSON.parse(woodyData[1]), data: JSON.parse(inputs), inputsHash: hash(inputs), codeHash: hash(html.slice(end + 2, codeEnd)), runtimeHash: hash(html.split('<script type="module">')[1].split('</script>')[0]) };
}

function checkContext(neighbors, registry) {
  assert.deepEqual(neighbors.road, registry.road.geometryLocal, 'Full road133 geometry');
  assert.equal(registry.road.fullOfficialPolygon, true);
  assert.equal(registry.road.widened, false);
  for (const parcel of registry.contextParcels) {
    assert.deepEqual(neighbors.context.parcels[parcel.parcel], parcel.geometryLocal, parcel.id);
  }
  assert.equal(neighbors.context.buildings.length, registry.contextBuildings.length);
  for (const expected of registry.contextBuildings) {
    const actual = neighbors.context.buildings.find((b) => b.id === expected.id);
    assert.deepEqual(actual.footprint, expected.footprintLocal, expected.id);
    assert.deepEqual(actual.metadata.facadeToward191, expected.facadeToward191);
    const facade = actual.metadata.facadeToward191;
    const windows = actual.meshes.filter(mesh => mesh.id.startsWith(`41-window-${facade.edgeIndex}-`) && mesh.id.endsWith('-glass'));
    assert.equal(windows.length, 1, 'Only one window on facade toward /191');
    assert.equal(windows[0].id, `41-window-${facade.edgeIndex}-0-1-glass`);
    for (const key of ['officialHeightM', 'officialStoreys', 'assumedStoreys', 'assumedStoreyHeightM', 'wallHeightM', 'roofEdgeHeightM', 'chimneyTopM']) {
      assert.equal(actual.metadata[key], expected[key], `${expected.id}: ${key}`);
    }
    assert.equal(Math.max(...actual.meshes.flatMap((mesh) => mesh.vertices.map((v) => v[2]))), expected.chimneyTopM);
  }
  for (const house of neighbors.houses) {
    const pin = registry.placementPins[house.parcel];
    assert.deepEqual(house.placement.matrix, pin.matrix);
    assert.deepEqual(house.placement.translation, pin.translation);
    const [[a, b], [c, d]] = pin.matrix;
    const previous = pin.reflectionRelativeToModel.previousMatrix;
    const relative = [[a * previous[0][0] + b * previous[0][1], a * previous[1][0] + b * previous[1][1]],
      [c * previous[0][0] + d * previous[0][1], c * previous[1][0] + d * previous[1][1]]];
    assert.ok(relative.flat().every((value, i) => Math.abs(value - pin.reflectionRelativeToModel.relativeMatrix.flat()[i]) < 1e-10), 'Relative reflection matrix');
    assert.ok(Math.abs(relative[0][0] * relative[1][1] - relative[0][1] * relative[1][0] + 1) < 1e-10, `Reflection of previous model /${house.parcel}`);
    assert.ok(Math.abs(a * a + c * c - 1) < 1e-10 && Math.abs(b * b + d * d - 1) < 1e-10 && Math.abs(a * b + c * d) < 1e-10, 'Rigid scale');
  }
}

function checkVehicles(neighbors, registry) {
  assert.deepEqual(neighbors.vehicleTypes, registry.vehicleTypes);
  assert.deepEqual(neighbors.cars, registry.carPlacements);
  assert.equal(neighbors.cars.length, registry.cars.length);
  for (const parcel of ['190', '191', '193']) {
    assert.equal(neighbors.cars.filter(car => car.location === 'driveway-' + parcel).length, 1, 'One car per driveway /' + parcel);
  }
  for (const car of registry.cars) {
    assert.deepEqual(car.nominalDimensions, registry.vehicleTypes[car.kind], car.id);
    assert.ok(Math.abs(car.measuredLength - car.nominalDimensions.length) < .00001, car.id);
    assert.ok(Math.abs(car.measuredWidth - car.nominalDimensions.width) < .00001, car.id);
    assert.ok(Math.abs(car.measuredHeight - car.nominalDimensions.height) < .00001, car.id);
  }
  assert.ok(neighbors.setbackDimension191M >= registry.clearances.parcel191SoutheastM);
}

function checkDriveway193(source, garden, icon, neighbors, registry) {
  const [plot] = source.variants;
  assert.deepEqual(source.variants.map(v => v.id), ['aktualny']);
  const gate = garden.lines.find(line => line.id === 'drive-gate-0' && line.kind === 'drive_gate').points;
  const door = plot.gate;
  const midpoint = ([a, b]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const street = midpoint(gate), garage = midpoint(door);
  const [width, doorWidth, setback, pavedArea] = registry.details.find(d => d.id === 'driveway-193').values;
  const near = (a, b, name) => assert.ok(Math.abs(a - b) < 0.00001, name);
  near(distance(...gate), width, 'Street gate width /193');
  near(distance(...door), doorWidth, 'Garage door width /193');
  near(distance(street, garage), setback, 'Distance from street gate to garage /193');
  assert.equal(+plot.areas.drivewayExtra.toFixed(3), pavedArea);
  assert.deepEqual(icon.metadata.matrix, registry.placementPins['193'].matrix);
  assert.deepEqual(icon.metadata.translation, registry.placementPins['193'].translation);
  const road = source.edges.find(edge => edge.road && gate.every(([x,y]) =>
    Math.abs(edge.n[0] * x + edge.n[1] * y - edge.c) < 0.00001 &&
    distance(edge.a, [x,y]) + distance([x,y], edge.b) < edge.length + 0.00001));
  assert.ok(road, 'Gate lies on the road frontage of /193');
  const car = neighbors.cars.find(c => c.location === 'driveway-193');
  for (const p of [street, car.position]) {
    const lateral = ((door[1][0] - door[0][0]) * (p[0] - garage[0]) +
      (door[1][1] - door[0][1]) * (p[1] - garage[1])) / doorWidth;
    near(lateral, 0, 'Street gate and car line up with garage door /193');
  }
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
  const [source, garden, icon, neighbors] = model.data;
  checkDriveway193(source, garden, icon, neighbors, registry);
  const woodyFile = readFileSync(resolve(root, 'trzy-domy-3d', registry.woodyPlanting.dataFile));
  const woodyData = JSON.parse(woodyFile);
  const planSvg = readFileSync(resolve(root, 'trzy-domy-3d/plan-kontrolny.svg'), 'utf8');
  assert.ok(planSvg.includes(`data-woodland-sha256="${hash(woodyFile)}"`), '2D plan must use the current planting geometry');
  assert.deepEqual(model.woodyPlantings, woodyData, 'Published planting plan and rendered beds differ');
  checkWoodyPlanting(woodyData, model.data, registry.woodyPlanting);
  assert.equal(hash(readFileSync(resolve(root, registry.sharedLayout.sourceFile))), registry.sharedLayout.sha256, '2D default changed without synchronizing 3D');
  assert.deepEqual(JSON.parse(readFileSync(resolve(root, registry.sharedLayout.sourceFile), 'utf8')), registry.sharedLayout.state);
  assert.equal(garden.metadata.areasM2.shared, registry.sharedAreaM2);
  assert.deepEqual(garden.metadata.sourceMetrics, registry.sharedLayout.sourceMetrics);
  checkContext(neighbors, registry);
  checkVehicles(neighbors, registry);
  assert.equal(model.runtimeHash, registry.integrity.runtimeSha256, 'Simulation or map runtime changed without review');
  for (const interior of [registry.interior, registry.florydaInterior].filter(Boolean)) {
    assert.equal(hash(readFileSync(resolve(root, 'trzy-domy-3d', interior.dataFile))), interior.dataSha256, `Interior dimensions changed without review: ${interior.dataFile}`);
  }
  assert.equal(hash(readFileSync(resolve(root, 'trzy-domy-3d', registry.mapLayers.metadataFile))), registry.mapLayers.metadataSha256, 'Map provenance changed');
  const vegetation = JSON.parse(readFileSync(resolve(root, 'trzy-domy-3d', registry.surroundingVegetation.dataFile), 'utf8'));
  assert.equal(hash(readFileSync(resolve(root, 'trzy-domy-3d', registry.surroundingVegetation.dataFile))), registry.surroundingVegetation.dataSha256, 'Vegetation data changed');
  assert.deepEqual(vegetation.trees, registry.surroundingVegetation.trees);
  assert.deepEqual(vegetation.crop, registry.surroundingVegetation.crop);
  assert.equal(registry.mapLayers.utilityRadiusM, 150);
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
assert.equal(hash(readFileSync(`${root}/trzy-domy-3d/plan-kontrolny.svg`)), registry.integrity.planSha256, 'Control plan changed');
console.log(`Model dimensions OK: ${registry.houses.length} houses, ${registry.objects.length} objects; version ${registry.modelVersion}`);
