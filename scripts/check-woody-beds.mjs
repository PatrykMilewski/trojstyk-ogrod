import assert from 'node:assert/strict';
import polygonClipping from 'polygon-clipping';

function ringArea(ring) {
  let twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    const [nextX, nextY] = ring[(i + 1) % ring.length];
    twiceArea += x * nextY - y * nextX;
  }
  return Math.abs(twiceArea) / 2;
}

function area(polygons) {
  return polygons.reduce((sum, [outline, ...holes]) =>
    sum + ringArea(outline) - holes.reduce((total, hole) => total + ringArea(hole), 0), 0);
}

export function checkWoodyPlanting(plan, model, register) {
  const [source, garden, , neighbors] = model;
  assert.deepEqual(plan.parcels.map(p => p.id).sort(), ['190', '191', '193']);
  assert.equal(register.minimumPercent, 30);
  const [icon] = source.variants;
  const hardscape = [icon.house, icon.entry, icon.terrace, icon.driveway,
    ...Object.values(neighbors.layouts).map(layout => layout.reservation),
    ...neighbors.surfaces.map(surface => surface.geometry)]
    .filter(geo => geo?.coordinates.length).map(geo => geo.coordinates);
  const excludedBeds = [...garden.polygons, ...neighbors.gardenAdditions.polygons]
    .filter(p => ['shared_boundary', 'gravel', 'paving', 'path', 'flagstone'].includes(p.kind))
    .map(p => [p.ring, ...(p.holes || [])]);
  for (const plot of plan.parcels) {
    const boundary = neighbors.parcels[plot.id].coordinates;
    const beds = [...plot.beds, ...(plot.rainGardenCanopies || [])].map(b => [b.ring, ...(b.holes || [])]);
    assert.ok(beds.length > 0, 'Missing planted area on /' + plot.id);
    const planted = polygonClipping.union(...beds);
    const plantedArea = area(planted), plotArea = area([boundary]);
    const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.006,
      'Area mismatch on /' + plot.id + ': ' + actual + ' vs ' + expected);
    close(area(polygonClipping.difference(planted, boundary)), 0);
    close(area(beds), plantedArea);
    for (const exclusion of [...hardscape, ...excludedBeds]) {
      close(area(polygonClipping.intersection(planted, exclusion)), 0);
    }
    close(plotArea, plot.areaM2);
    close(plantedArea, plot.plantedAreaM2);
    assert.ok(100 * plantedArea >= register.minimumPercent * plotArea, 'Below 30% on /' + plot.id);
  }
}
