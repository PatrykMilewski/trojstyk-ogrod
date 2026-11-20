const slabOutline = [
  [-.5, -.22], [-.33, -.48], [.22, -.5], [.49, -.27],
  [.48, .24], [.28, .48], [-.26, .5], [-.49, .29],
];
const stoneColors = ['#dfdacb', '#d5cfc0', '#e4dfd2', '#dbd5c6', '#d2cdbf'];
const stoneDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function gardenCenterline(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i-1] + stoneDistance(points[i], points[i-1]));
  }
  const total = lengths.at(-1);
  function at(distance) {
    const d = Math.max(0, Math.min(total, distance));
    let i = 1;
    while (i < points.length - 1 && lengths[i] < d) i++;
    const t = (d - lengths[i-1]) / (lengths[i] - lengths[i-1] || 1);
    return points[i-1].map((v, k) => v + (points[i][k] - v) * t);
  }
  return {total, at};
}

export function gardenSteppingStones(points, seed = 1, width = .67, junction = false) {
  const {total, at} = gardenCenterline(points);
  if (total < .26) return [];
  const first = Math.min(total / 2, junction ? .55 : .26);
  const last = Math.max(first, total - .26);
  const count = 1 + Math.round((last - first) / .30);
  const scale = Math.min(1, width / .67);
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  return Array.from({length: count}, (_, i) => {
    const d = first + (last - first) * i / Math.max(1, count - 1);
    const point = at(d), before = at(d - .09), after = at(d + .09);
    const span = stoneDistance(before, after) || 1;
    const dx = (after[0] - before[0]) / span, dy = (after[1] - before[1]) / span;
    const side = (i % 2 ? -.17 : .17) * scale;
    const center = [point[0] - dy * side, point[1] + dx * side];
    const across = (.285 + random() * .032) * scale;
    const along = Math.min(total - .01, .386 + random() * .042);
    const ring = slabOutline.map(([u, v]) => {
      const lateral = (u + (random() - .5) * .049) * across;
      const forward = (v + (random() - .5) * .045) * along;
      return [center[0]+dx*forward-dy*lateral, center[1]+dy*forward+dx*lateral];
    });
    return {center, ring, color: stoneColors[Math.floor(random()*stoneColors.length)]};
  });
}

function curvedGardenBranch({start, control, end}) {
  const hullLength = stoneDistance(start, control) + stoneDistance(control, end);
  const steps = Math.max(12, Math.min(240, Math.ceil(hullLength / .15)));
  return Array.from({length: steps + 1}, (_, i) => {
    const t = i / steps;
    return start.map((v, k) => (1-t)**2*v + 2*(1-t)*t*control[k] + t*t*end[k]);
  });
}

export function sharedGardenStones(branches, width) {
  if (!branches.length) return [];
  const [x, y] = branches[0].start;
  const radius = Math.min(.28, width * .45);
  const ring = Array.from({length: 8}, (_, i) => [
    x + radius * Math.cos(i*Math.PI/4), y + radius * Math.sin(i*Math.PI/4),
  ]);
  const stones = [{center: [x,y], ring, color: '#d5cfc0'}];
  for (const [i, branch] of branches.entries()) {
    const line = curvedGardenBranch(branch);
    for (const stone of gardenSteppingStones(line, 190+i, width, true)) {
      if (stones.every(other => stoneDistance(other.center, stone.center) > .38)) {
        stones.push(stone);
      }
    }
  }
  return stones;
}
