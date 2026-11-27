function canopyNoise(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
}

function canopyLeaves(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const random = canopyNoise(79193);
  for (let stem = 0; stem < 7; stem++) {
    const tipX = 11 + random() * 105, tipY = 5 + random() * 70;
    const baseX = 52 + random() * 25, baseY = 100 + random() * 21;
    ctx.strokeStyle = '#a79569';
    ctx.lineWidth = .85;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX, tipY + 28, tipX, tipY);
    ctx.stroke();
    for (let i = 0; i < 22; i++) {
      const t = .12 + .86 * random(), side = i % 2 ? -1 : 1;
      const width = 4.5 + random() * 5.5;
      const x = baseX + (tipX - baseX) * t * t + side * (4 + 8 * random());
      const y = baseY * (1 - t) ** 2 + 2 * (tipY + 28) * (1 - t) * t + tipY * t * t;
      const tone = Math.round(175 + 80 * random());
      ctx.fillStyle = 'rgb(' + tone + ',' + tone + ',' + Math.round(tone * .90) + ')';
      ctx.beginPath();
      ctx.ellipse(x, y, width, width * .34, -Math.PI / 2 + side * (.4 + random() * .8), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function canopyStem(THREE, base, tip, radius) {
  const direction = tip.clone().sub(base);
  const axis = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion().setFromUnitVectors(axis, direction.clone().normalize());
  const center = base.clone().lerp(tip, .5);
  return new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(radius, direction.length(), radius));
}

function canopyBoundary(tree) {
  const ring = tree.canopyRing;
  const [originX, originY] = tree.measuredCenter;
  const sides = [];
  let midX = 0, midY = 0;
  for (let j = 1; j < ring.length; j++) {
    const [a,b] = [ring[j-1],ring[j]];
    const nx = b[1]-a[1], ny = a[0]-b[0];
    const x = a[0]-originX, y = a[1]-originY;
    const offset = nx*x + ny*y;
    if (Math.abs(offset) > .00001) sides.push([nx/offset,ny/offset]);
    midX += x; midY += y;
  }
  return {sides, midX: midX/(ring.length-1), midY: midY/(ring.length-1)};
}

function fitCanopySpray(matrix, tree, boundary, fraction) {
  const e = matrix.elements;
  const x = e[12] - tree.x + boundary.midX * fraction;
  const y = e[13] - tree.y + boundary.midY * fraction;
  let stretch = 1;
  for (const [nx,ny] of boundary.sides) {
    const halfWidth = .5 * Math.abs(nx*e[0] + ny*e[1]);
    const halfLength = .5 * Math.abs(nx*e[4] + ny*e[5]);
    stretch = Math.max(stretch, nx*x + ny*y + halfWidth + halfLength);
  }
  for (const index of [0,1,4,5,8,9]) e[index] /= stretch;
  e[12] = tree.x + x/stretch;
  e[13] = tree.y + y/stretch;
  return matrix;
}

function crownSprays(THREE, tree, random, foliage, bark) {
  const {x, y, radius, height} = tree;
  const shrub = tree.form === 'shrub';
  const bottom = height * (shrub ? .08 : .28);
  const center = new THREE.Vector3(x, y, 0);
  const fork = new THREE.Vector3(x, y, bottom);
  const trunkRadius = Math.min(radius * .09, height * .019);
  bark.push(canopyStem(THREE, center, fork, trunkRadius));
  const phase = random() * Math.PI * 2;
  for (let i = 0; i < 6; i++) {
    const angle = phase + i * Math.PI / 3;
    const tip = new THREE.Vector3(x + Math.cos(angle) * radius * .48,
      y + Math.sin(angle) * radius * .48, height * (.55 + .19 * random()));
    bark.push(canopyStem(THREE, fork, tip, trunkRadius * .47));
  }
  const angleOffset = random() * Math.PI * 2;
  const color = new THREE.Color(tree.tint);
  const boundary = canopyBoundary(tree);
  const major = Math.sqrt(tree.axisRatio || 1);
  const bearing = tree.bearing || 0;
  const shape = new THREE.Matrix4().makeTranslation(x, y, 0)
    .multiply(new THREE.Matrix4().makeRotationZ(bearing))
    .multiply(new THREE.Matrix4().makeScale(major, 1 / major, 1))
    .multiply(new THREE.Matrix4().makeRotationZ(-bearing))
    .multiply(new THREE.Matrix4().makeTranslation(-x, -y, 0));
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 180; i++) {
    const t = (i + .14 + .72 * random()) / 180;
    const angle = angleOffset + i * 2.39996 + (random() - .5) * .90;
    const breadth = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
    const lobe = .89 + .11 * Math.cos(3 * angle + 4 * t);
    const reach = radius * breadth * lobe * (.39 + random() * .42);
    const width = Math.min(radius * breadth * (.38 + random() * .47), (radius - reach) * 2);
    const length = Math.min((height - bottom) * (.18 + random() * .11),
      (height - bottom) * 2 * Math.min(t, 1 - t) + .08);
    dummy.position.set(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, bottom + t * (height - bottom));
    dummy.rotation.set(.58 + random() * .85, (random() - .5) * .72, angle + Math.PI * .5, 'ZXY');
    dummy.scale.set(width, length, 1);
    dummy.updateMatrix();
    const matrix = fitCanopySpray(dummy.matrix.clone().premultiply(shape), tree, boundary, breadth);
    foliage.push([matrix, color.clone().multiplyScalar(.77 + .28 * t + random() * .23)]);
  }
}

function measuredSupports(THREE, group, objects, terrain) {
  if (!objects.length) return;
  const parts = [];
  for (const obj of objects) {
    const {x, y, height, bearing, armLength} = obj;
    const base=terrain?.z(x,y)??0;
    const top = new THREE.Vector3(x, y, base + height - .24);
    const at = (span, z) => new THREE.Vector3(x + Math.cos(bearing) * span, y + Math.sin(bearing) * span, z + base);
    const add = (a, b, r, color) => parts.push([canopyStem(THREE, a, b, r), new THREE.Color(color)]);
    const feet = obj.form === 'double' ? [-.77, .77] : [0];
    for (const side of feet) add(at(side, 0), top, obj.form === 'single' ? .12 : .15, '#9c9b90');
    const armHeights = obj.form === 'crossarms' ? [height-.94,height-.24] : [height-.24];
    for (const z of armHeights) {
      add(at(-armLength/2,z), at(armLength/2,z), .065, '#716f69');
      for (const position of [-.44, 0, .44]) {
        add(at(position*armLength,z), at(position*armLength,z+.24), .085, '#827c6b');
      }
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.78, 1, 1, 7),
    new THREE.MeshStandardMaterial({roughness: .87}), parts.length);
  parts.forEach(([matrix,color],i) => {
    mesh.setMatrixAt(i,matrix);
    mesh.setColorAt(i,color);
  });
  mesh.name = 'measured-neighborhood-utility-supports';
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  group.add(mesh);
}

export function addNeighborhoodTrees(THREE, group, data, terrain) {
  measuredSupports(THREE, group, data.otherHighObjects || [], terrain);
  const trees = data.trees || [];
  if (!trees.length) return;
  const foliage = [], bark = [];
  for (const tree of trees) {
    const seed = Array.from(tree.id).reduce((hash, c) => Math.imul(31, hash) + c.charCodeAt(0) | 0, 17);
    const leafStart=foliage.length, barkStart=bark.length, base=terrain?.z(tree.x,tree.y)??0;
    crownSprays(THREE, tree, canopyNoise(seed), foliage, bark);
    for(let i=leafStart;i<foliage.length;i++) foliage[i][0].elements[14]+=base;
    for(let i=barkStart;i<bark.length;i++) bark[i].elements[14]+=base;
  }
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.60, 1, 1, 6),
    new THREE.MeshStandardMaterial({color: '#75685a', roughness: 1}), bark.length);
  bark.forEach((matrix, i) => stems.setMatrixAt(i, matrix));
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshLambertMaterial({map: canopyLeaves(THREE), alphaTest: .26, side: THREE.DoubleSide,
      emissive: '#18200c', emissiveIntensity: .34}), foliage.length);
  foliage.forEach(([matrix, color], i) => {
    leaves.setMatrixAt(i, matrix);
    leaves.setColorAt(i, color);
  });
  stems.name = 'measured-neighborhood-trunks';
  leaves.name = 'measured-neighborhood-crowns';
  for (const mesh of [stems, leaves]) {
    mesh.castShadow = true;
    mesh.receiveShadow = mesh === stems;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}
