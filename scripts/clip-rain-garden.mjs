import { readFileSync } from 'node:fs';
import clipping from 'polygon-clipping';
import { rainGardenFootprint193, rainGardenSpillFootprint193 } from '../src/model/rain-services.js';
import { iconPlanPoint } from '../src/model/roof-windows.js';

const { house, surfaces, beds } = JSON.parse(readFileSync(0, 'utf8'));
const basin = clipping.union(...[rainGardenFootprint193, rainGardenSpillFootprint193]
  .map(footprint => [footprint(house, iconPlanPoint).ring]));

// Clip partial overlaps at build time, leaving the surveyed outlines intact in the editor.
function cutSurfaces(items) {
  const changes = {};
  for (const [index, item] of items.entries()) {
    const polygon = [item.ring, ...(item.holes ?? [])];
    if (clipping.intersection(polygon, basin).length) {
      changes[index] = clipping.difference(polygon, basin).map(([ring, ...holes]) => ({ring, holes}));
    }
  }
  return changes;
}

process.stdout.write(JSON.stringify({rings: basin.map(polygon => polygon[0]), surfaces: cutSurfaces(surfaces), beds: cutSurfaces(beds)}));
