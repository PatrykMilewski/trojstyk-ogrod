import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import {iconPlanPoint} from '../src/model/roof-windows.js';

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
  const [start,end] = route.ends, chord = distance(start,end), arc = route.clockwiseArcCenter;
  const radius = arc && distance(start,arc);
  const length = arc ? 2*radius*Math.asin(chord/(2*radius)) : chord;
  function frame(station) {
    if (arc) {
      const angle = Math.atan2(start[1]-arc[1],start[0]-arc[0])-station/radius;
      const dx = Math.sin(angle), dy = -Math.cos(angle);
      return [arc[0]-radius*dy,arc[1]+radius*dx,dx,dy];
    }
    const dx = (end[0]-start[0])/length, dy = (end[1]-start[1])/length;
    return [start[0]+station*dx,start[1]+station*dy,dx,dy];
  }
  assert.equal(run.length, count);
  assert.equal(count % 2, 0);
  close(length, routeLength); close((length-2*route.firstCenterM)/(count-1), pitch);
  close(route.sameRowPitchM, sameRowPitch); close(route.stepM*2, sameRowPitch);
  assert(rowSpacing >= .31 && rowSpacing <= .34 && sameRowPitch >= .57 && sameRowPitch <= .63);
  assert(edgeDistance(start,run[0].ring) < .30 && edgeDistance(end,run.at(-1).ring) < .30);
  const gaps = [];
  for (const [i, stone] of run.entries()) {
    const left = i%2 === (route.id === 'wicket' ? 1 : 0);
    assert.equal(stone.row, left ? 'left' : 'right');
    const [mx,my,dx,dy] = frame(route.firstCenterM+i*route.stepM);
    const [x,y] = stone.center, relativeX = x-mx, relativeY = y-my;
    close(dx*relativeX + dy*relativeY,0);
    close(-dy*relativeX + dx*relativeY, (left ? .5 : -.5)*rowSpacing);
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
      const rowPitch = arc ? 2*(radius+(left ? .5 : -.5)*rowSpacing)*Math.sin(route.stepM/radius) : sameRowPitch;
      close(distance(stone.center, sameSide.center), rowPitch);
      assert(gap(stone.ring, sameSide.ring) >= .12);
      grassAtMidpoint(stone.center, sameSide.center, lawn, .025);
    }
    for (const other of run.slice(0,i)) assert.deepEqual(clipping.intersection([other.ring],[stone.ring]), []);
  }
  assert(Math.min(...gaps) > .01);
  close(Math.min(...gaps), shortestGap); close(Math.max(...gaps), longestGap);
  return i => frame(route.firstCenterM+i*route.stepM).slice(2);
}

function checkStreetEntry(garden, editor, world, controlPlan) {
  const streetWalk = garden.polygons.find(p => p.id === 'street-walk-193');
  const [a,b,c,d,e] = streetWalk.ring;
  const gate = garden.lines.find(p => p.kind === 'street_wicket');
  close(gate.height, 1.6);
  assert.deepEqual(gate.points,[a,b]);
  close(distance(a,b),1.2); close(distance(c,d),1.2);
  close(distance(b,c),.25); close(distance(d,e),1.45); close(distance(a,e),1.2);
  assert(controlPlan.includes('id="street-walk-193"') && controlPlan.includes('id="street-wicket-193"'));
  const drive = editor.driveways['193'].map(world); drive.push(drive[0]);
  for (const corner of [c,d]) close(edgeDistance(corner,drive),0);
  const fence = garden.lines.filter(l => l.kind === 'parcel_fence');
  for (const p of [a,b]) close(Math.min(...fence.map(l => edgeDistance(p,l.points))),0);
  for (let t=.05; t<1; t+=.05) {
    const p=[a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])];
    assert(fence.every(l => edgeDistance(p,l.points)>.05), 'No fixed fence across the entrance');
  }
}

function checkOtherGardens(additions, editor, world, controlPlan) {
  assert(!additions.polygons.some(p => ['shared_path','path'].includes(p.kind)), 'Only individual footfalls pave garden routes');
  const mapped = new Map(editor.gardenStones.map(p => [p.id,p]));
  for (const parcel of ['190','191','shared']) {
    const stones = additions.polygons.filter(p => p.parcel === parcel && p.kind === 'flagstone');
    assert(stones.length > 20, 'Missing garden path on ' + parcel);
    for (const [i,stone] of stones.entries()) {
      assert.equal(stone.height, .035);
      assert(controlPlan.includes(`id="${stone.id}"`));
      if (parcel !== 'shared') {
        const ring = mapped.get(stone.id).ring;
        assert.equal(ring.length, stone.ring.length-1);
        ring.forEach((point,k) => close(distance(world(point),stone.ring[k]), 0));
      }
      for (const previous of stones.slice(0,i)) {
        assert.deepEqual(clipping.intersection([stone.ring],[previous.ring]), [], stone.id + ' overlaps ' + previous.id);
      }
    }
  }
}

function checkTerraceWicket(garden, editor, world, house, interior, additions) {
  const facade = interior.facades.find(f => f.id === 'facade-terrace');
  const door = facade.openings.find(o => !o.glass);
  const threshold = iconPlanPoint(house.metadata, facade.a[0]-facade.thickness/2-.055, facade.a[1]+(door.start+door.end)/2, 0);
  const [a,b] = garden.lines.find(l => l.id === 'brama-193-0').points;
  const center = a.map((v,i) => (v+b[i])/2);
  const {ends:[start,end],clockwiseArcCenter:arc} = garden.metadata.flagstoneRoutes.find(r => r.id === 'wicket');
  close(distance(center,end),0);
  close(distance(arc,start),distance(arc,end));
  const radius = distance(arc,start), deckRun = distance(threshold,start);
  const tangent = [(start[1]-arc[1])/radius,(arc[0]-start[0])/radius];
  tangent.forEach((v,i) => close(v,(start[i]-threshold[i])/deckRun));
  const deck = editor.terraces['193'].map(world);
  close(edgeDistance(start,[...deck,deck[0]]),0);
  assert(distance(threshold,start)>1 && distance(start,end)>1);
  const fences = garden.lines.filter(l => ['shared_fence','parcel_fence'].includes(l.kind));
  const run = garden.polygons.filter(p => p.route === 'wicket');
  for (const stone of run) {
    assert(fences.every(f => Math.min(...stone.ring.map(p => edgeDistance(p,f.points))) > .20));
  }
  const shared = additions.polygons.filter(p => p.parcel === 'shared' && p.kind === 'flagstone');
  assert(Math.min(...shared.map(p => gap(run.at(-1).ring,p.ring))) < .50, 'Reach the shared garden path through the gate');
}

export function checkIconGardenPaths(garden, editor, registry, controlPlan, additions, house, interior) {
  assert(!garden.objects.some(o => o.kind === 'grill'));
  assert(!garden.polygons.some(p => ['path','shared_path'].includes(p.kind) || p.id === 'kitchen-pad'));
  assert.equal(garden.metadata.areasM2.kitchenPaving, 0);
  const {sharedRotation: [[a,b],[c,d]], sharedTranslation: [tx,ty]} = garden.metadata;
  const world = ([x,y]) => [a*x + b*y + tx, c*x + d*y + ty];
  const lawn = garden.polygons.filter(p => p.kind === 'lawn').map(p => [p.ring, ...p.holes]);
  checkStreetEntry(garden, editor, world, controlPlan);
  checkOtherGardens(additions, editor, world, controlPlan);
  checkTerraceWicket(garden, editor, world, house, interior, additions);
  const stones = garden.polygons.filter(p => p.kind === 'flagstone');
  const published = id => registry.details.find(row => row.id === id).values;
  const widths = [], lengths = [];
  for (const route of garden.metadata.flagstoneRoutes) {
    const run = stones.filter(s => s.route === route.id);
    const directionAt = checkFootfalls(route, run, published(`flagstones-193-${route.id}`), lawn);
    for (const [i,stone] of run.entries()) {
      const [dx,dy] = directionAt(i);
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
