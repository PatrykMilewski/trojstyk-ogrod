import assert from 'node:assert/strict';

const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const length = v => Math.hypot(...v);
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const near = (x, y, message) => assert.ok(Math.abs(x - y) < 1e-5, message);

function sameRing(actual, expected) {
  for (const point of actual) {
    assert.ok(expected.some(q => length(subtract(point, q)) < 1e-5), '2D vertex differs from 3D');
  }
  for (const point of expected) {
    assert.ok(actual.some(q => length(subtract(point, q)) < 1e-5), '3D vertex missing from 2D');
  }
}

export function checkFlorydaSiting(neighbors, registration, editor, registry) {
  const house = neighbors.houses.find(h => h.parcel === '190');
  const pin = registry.placementPins['190'];
  const {rotation, translation} = registration;
  const world = point => rotation.map((row, i) => dot(row, point) + translation[i]);
  const walls = house.meshes.find(m => m.id === 'ground-storey').vertices.filter(p => p[2] === 0);
  sameRing(editor.houses['190'].map(world), walls);
  for (const [key, kind] of [['terraces','conceptCanopyDeck'], ['entries','entryPaving'], ['driveways','driveway']]) {
    const surface = neighbors.surfaces.find(s => s.parcel === '190' && s.kind === kind);
    sameRing(editor[key]['190'].map(world), surface.geometry.coordinates[0]);
  }
  const old = pin.reflectionRelativeToModel;
  assert.equal(old.baseline, '2026-11-19.18');
  assert.deepEqual(pin.matrix, old.previousMatrix.map(([x, y]) => [x === 0 ? 0 : -x, y]));
  const halfWidth = house.metadata.dimensions.width / 2;
  for (let i = 0; i < 2; i++) {
    near(pin.translation[i] + pin.matrix[i][0] * halfWidth,
      old.previousTranslation[i] + old.previousMatrix[i][0] * halfWidth, 'Reflection centre moved');
  }

  const reserve = neighbors.layouts['190'].reservation.coordinates[0];
  const boundary = neighbors.parcels['190'].coordinates[0];
  const distances = pin.northeastPlacement;
  let blocked = false;
  for (let i = 0; i < boundary.length - 1; i++) {
    const a = boundary[i], edge = subtract(boundary[i+1], a);
    const normal = [edge[1] / length(edge), -edge[0] / length(edge)];
    const clearance = ring => dot(normal, a) - Math.max(...ring.map(p => dot(normal, p)));
    near(clearance(reserve), distances.reserveEdgeDistancesM[i], 'Reservation clearance');
    near(clearance(walls), distances.actualWallEdgeDistancesM[i], 'Wall clearance');
    if (distances.activeSetbacks.some(s => s.edge === i)) {
      near(clearance(reserve), 5, 'Active road setback');
      if (normal.every(axis => axis > 0)) blocked = true;
    }
  }
  assert.ok(blocked, 'An active setback must block every positive east-and-north translation');
  near(distances.maximumTranslationM, 0, 'Northeast clearance');

  const door = house.meshes.find(m => m.id === 'garage-door').vertices.slice(0,2);
  const street = neighbors.vehicleGates.find(g => g.parcel === '190').points;
  const doorAxis = subtract(door[1], door[0]);
  near(length(doorAxis), 5.06, 'Garage opening');
  near(dot(subtract(midpoint(...door), midpoint(...street)), doorAxis), 0, 'Gate alignment');
  const car = neighbors.cars.find(c => c.location === 'driveway-190');
  near(dot(subtract(car.position, midpoint(...door)), doorAxis), 0, 'SUV alignment');
  sameRing(door, distances.garageDoorWorld);
  sameRing(street, distances.streetGateWorld);
}
