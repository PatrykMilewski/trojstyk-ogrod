import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00051, `${actual} vs ${expected}`);

function interval(ring, dx, dy) {
  const values = ring.map(([x, y]) => x*dx + y*dy);
  return Math.max(...values) - Math.min(...values);
}

export function checkIconGardenPaths(garden, editor, registry, controlPlan) {
  assert(!garden.objects.some(o => o.kind === 'grill'));
  assert(!garden.polygons.some(p => p.kind === 'path' || p.id === 'kitchen-pad'));
  assert.equal(garden.metadata.areasM2.kitchenPaving, 0);
  const {sharedRotation: [[a,b],[c,d]], sharedTranslation: [tx,ty]} = garden.metadata;
  const world = ([x,y]) => [a*x + b*y + tx, c*x + d*y + ty];
  const lawn = garden.polygons.filter(p => p.kind === 'lawn').map(p => [p.ring, ...p.holes]);
  const stones = garden.polygons.filter(p => p.kind === 'flagstone');
  const published = id => registry.details.find(row => row.id === id).values;
  const widths = [], lengths = [];
  for (const route of garden.metadata.flagstoneRoutes) {
    const [start, end] = route.ends;
    const run = stones.filter(s => s.route === route.id);
    const length = distance(start, end), dx = (end[0]-start[0])/length, dy = (end[1]-start[1])/length;
    const [count, routeLength, pitch, shortestGap, longestGap] = published(`flagstones-193-${route.id}`);
    assert.equal(run.length, count);
    close(length, routeLength);
    close(length/count, pitch);
    close(route.minGapM, shortestGap);
    close(route.maxGapM, longestGap);
    for (const [index, stone] of run.entries()) {
      assert.equal(stone.height, .035);
      assert(stone.ring.length >= 6);
      assert(controlPlan.includes(`id="${stone.id}"`));
      const planRing = editor.garden193.surfaces.find(p => p.id === stone.id).ring;
      assert.equal(planRing.length, stone.ring.length - 1);
      planRing.forEach((q,i) => close(distance(world(q),stone.ring[i]), 0));
      widths.push(interval(stone.ring, -dy, dx));
      lengths.push(interval(stone.ring, dx, dy));
      assert.deepEqual(clipping.intersection([stone.ring], lawn), []);
      if (index) {
        const u = index/count, x = start[0]+u*(end[0]-start[0]), y = start[1]+u*(end[1]-start[1]);
        const gap = [[[x-.02,y-.02],[x+.02,y-.02],[x+.02,y+.02],[x-.02,y+.02],[x-.02,y-.02]]];
        assert.deepEqual(clipping.difference(gap, lawn), [], 'Grass separates each pair of stones');
      }
    }
  }
  const dimensions = published('flagstones-193');
  [Math.min(...widths), Math.max(...widths), Math.min(...lengths), Math.max(...lengths),
    stones[0].height, garden.metadata.areasM2.privatePaths].forEach((v,i) => close(v, dimensions[i]));
}
