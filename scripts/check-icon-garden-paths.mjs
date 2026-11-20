import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00051, `${actual} vs ${expected}`);

function interval(ring, dx, dy) {
  const values = ring.map(([x, y]) => x*dx + y*dy);
  return Math.max(...values) - Math.min(...values);
}

function edgeDistance([x, y], ring) {
  return Math.min(...ring.slice(1).map(([bx, by], i) => {
    const [ax, ay] = ring[i], dx = bx-ax, dy = by-ay;
    const t = Math.max(0, Math.min(1, ((x-ax)*dx + (y-ay)*dy)/(dx*dx + dy*dy)));
    return Math.hypot(x-ax - t*dx, y-ay - t*dy);
  }));
}

function gap(a, b) {
  return Math.min(...a.map(p => edgeDistance(p,b)), ...b.map(p => edgeDistance(p,a)));
}

function grassAtMidpoint(a, b, lawn, radius) {
  const cx = (a[0]+b[0])/2, cy = (a[1]+b[1])/2;
  const joint = [[[cx-radius,cy-radius],[cx+radius,cy-radius],[cx+radius,cy+radius],[cx-radius,cy+radius]]];
  assert.deepEqual(clipping.difference(joint, lawn), [], 'Grass separates adjacent stones');
}

function checkFootfalls(route, run, row, lawn) {
  const [count, routeLength, pitch, shortestGap, longestGap, rowSpacing, stride, sameRowPitch] = row;
  const [start, end] = route.ends, length = distance(start, end);
  const dx = (end[0]-start[0])/length, dy = (end[1]-start[1])/length;
  assert.equal(run.length, count);
  assert.equal(count % 2, 0);
  close(length, routeLength); close((length-2*route.firstCenterM)/(count-1), pitch);
  close(route.sameRowPitchM, sameRowPitch); close(route.stepM*2, sameRowPitch);
  assert(rowSpacing >= .31 && rowSpacing <= .34 && sameRowPitch >= .57 && sameRowPitch <= .63);
  assert(edgeDistance(start,run[0].ring) < .30 && edgeDistance(end,run.at(-1).ring) < .30);
  const gaps = [];
  for (const [i, stone] of run.entries()) {
    assert.equal(stone.row, i%2 === 0 ? 'left' : 'right');
    const [x,y] = stone.center, relativeX = x-start[0], relativeY = y-start[1];
    close(dx*relativeX + dy*relativeY, route.firstCenterM+i*route.stepM);
    close(-dy*relativeX + dx*relativeY, (i%2 === 0 ? .5 : -.5)*rowSpacing);
    const sole = [[-.055,-.14],[.055,-.14],[.055,.14],[-.055,.14]].map(([u,v]) => [x-dy*u+dx*v,y+dx*u+dy*v]);
    assert.deepEqual(clipping.difference([sole], [stone.ring]), [], 'Foot lands fully on ' + stone.id);
    if (i) {
      const previous = run[i-1];
      close(distance(stone.center, previous.center), stride);
      gaps.push(gap(previous.ring, stone.ring));
      const front = Math.max(...previous.ring.map(([a,b]) => a*dx+b*dy));
      const back = Math.min(...stone.ring.map(([a,b]) => a*dx+b*dy));
      assert(front-back >= .06, 'Neighboring rows visibly overlap along the route');
      grassAtMidpoint(stone.center, previous.center, lawn, .005);
    }
    if (i >= 2) {
      const sameSide = run[i-2];
      close(distance(stone.center, sameSide.center), sameRowPitch);
      assert(gap(stone.ring, sameSide.ring) >= .12);
      grassAtMidpoint(stone.center, sameSide.center, lawn, .025);
    }
    for (const other of run.slice(0,i)) assert.deepEqual(clipping.intersection([other.ring],[stone.ring]), []);
  }
  assert(Math.min(...gaps) > .01);
  close(Math.min(...gaps), shortestGap); close(Math.max(...gaps), longestGap);
  return [dx,dy];
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
    const run = stones.filter(s => s.route === route.id);
    const [dx,dy] = checkFootfalls(route, run, published(`flagstones-193-${route.id}`), lawn);
    for (const stone of run) {
      assert.equal(stone.height, .035);
      assert(stone.ring.length >= 6);
      assert(controlPlan.includes(`id="${stone.id}"`));
      const planRing = editor.garden193.surfaces.find(p => p.id === stone.id).ring;
      assert.equal(planRing.length, stone.ring.length - 1);
      planRing.forEach((q,i) => close(distance(world(q),stone.ring[i]), 0));
      widths.push(interval(stone.ring, -dy, dx));
      lengths.push(interval(stone.ring, dx, dy));
      assert.deepEqual(clipping.intersection([stone.ring], lawn), []);
    }
  }
  const dimensions = published('flagstones-193');
  [Math.min(...widths), Math.max(...widths), Math.min(...lengths), Math.max(...lengths),
    stones[0].height, garden.metadata.areasM2.privatePaths].forEach((v,i) => close(v, dimensions[i]));
}
