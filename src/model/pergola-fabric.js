const pergolaShade193 = {
  wallX: 8.68, travel: 6, parked: .78, frontY: 12.89, rearY: 16.89,
  eaveZ: 3.17, fall: Math.tan(1.5 * Math.PI / 180), bays: 12,
  get wallZ() { return this.eaveZ + this.travel * this.fall; },
};

function pergolaFrameParts193(THREE, group) {
  const cube = new THREE.BoxGeometry();
  const aluminium = new THREE.MeshStandardMaterial({name: 'Black powder-coated aluminium', color: '#202123', metalness: .43, roughness: .49});
  function box(name, x, y, z, width, depth, height, parent = group, material = aluminium) {
    const mesh = new THREE.Mesh(cube, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(width, depth, height);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const {wallX, wallZ, travel, fall, frontY, rearY} = pergolaShade193;
  for (const y of [frontY - .09, rearY + .09]) {
    const z = x => wallZ - fall * (x - wallX) - .024;
    const rail = box('pergola-fabric-guide', wallX + travel / 2, y, z(wallX + travel / 2),
      Math.hypot(travel, travel * fall) + .06, .071, .075);
    rail.rotation.y = Math.atan(fall);
    for (const x of [wallX, wallX + travel / 2, wallX + travel]) {
      const top = z(x) - .035;
      box('pergola-guide-bracket', x, y, (3.04 + top) / 2, .060, .060, top - 3.04);
    }
  }
  // Tie the retained off-centre post head to the side and rear perimeter beams.
  box('pergola-post-head-plate', 14.60, 16.89, 2.963, .37, .31, .026);
  return {box, aluminium};
}

function pergolaWallFlashings193(THREE, group, aluminium) {
  const metal = aluminium.clone(); metal.side = THREE.DoubleSide;
  function fold(name, ends) {
    const positions = ends.flat(2), count = ends[0].length, faces = [];
    for (let i = 0; i < count - 1; i++) faces.push(i, i + count, i + 1, i + 1, i + count, i + count + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(faces); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, metal);
    mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  }
  const {wallX, wallZ, fall, rearY} = pergolaShade193;
  fold('pergola-side-wall-flashing', [8.505, 14.64].map(x => {
    const z = wallZ - (x - wallX) * fall;
    return [[x, 12.711, z + .15], [x, 12.714, z + .091], [x, 12.945, z + .042], [x, 12.945, z + .025]];
  }));
  // The head flashing laps over the side flashing at the inside corner.
  fold('pergola-slider-head-flashing', [12.711, rearY].map(y => [
    [8.501, y, wallZ + .24], [8.504, y, wallZ + .174], [8.75, y, wallZ + .12], [8.75, y, wallZ + .10],
  ]));
}

function pergolaDrain193(THREE, group, box, aluminium) {
  const inner = 14.53, outer = 14.75, start = 12.82, end = 16.98;
  const x = 14.605, y = 16.645, radius = .035, bottom = 3.052;
  const floorZ = (across, along) => bottom + Math.abs(across - x) * .01 + Math.abs(along - y) * .005;
  // Each quarter has a planar fall toward both outlet axes and an open circular throat.
  const vertices = [];
  for (const edgeX of [inner, outer]) for (const edgeY of [start, end]) {
    const signX = Math.sign(edgeX - x), signY = Math.sign(edgeY - y);
    const quarter = new THREE.Shape();
    quarter.moveTo(edgeX, y); quarter.lineTo(edgeX, edgeY);
    quarter.lineTo(x, edgeY);
    for (let step = 0; step <= 8; step++) {
      const angle = (8 - step) * Math.PI / 16;
      quarter.lineTo(x + signX * radius * Math.cos(angle), y + signY * radius * Math.sin(angle));
    }
    quarter.closePath();
    const sector = new THREE.ShapeGeometry(quarter).toNonIndexed();
    const points = sector.getAttribute('position');
    for (let i = 0; i < points.count; i++) {
      const px = points.getX(i), py = points.getY(i);
      vertices.push(px, py, floorZ(px, py));
    }
    sector.dispose();
  }
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); base.computeVertexNormals();
  const gutter = new THREE.Mesh(base, aluminium);
  gutter.name = 'pergola-gutter-outlet'; gutter.receiveShadow = true; group.add(gutter);
  for (const edge of [inner, outer]) {
    for (const [a, b] of [[start, y], [y, end]]) {
      const lip = box('pergola-gutter-lip', edge, (a + b) / 2, (floorZ(edge, a) + floorZ(edge, b)) / 2 + .027,
        .009, Math.hypot(b - a, floorZ(edge, b) - floorZ(edge, a)), .054);
      lip.rotation.x = Math.atan2(floorZ(edge, b) - floorZ(edge, a), b - a);
    }
  }
  for (const edge of [start, end]) box('pergola-gutter-end', (inner + outer) / 2, edge, floorZ(x, edge) + .027, outer - inner, .009, .054);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, bottom + .20, 32, 1, true), aluminium);
  pipe.name = 'pergola-post-downpipe'; pipe.position.set(x, y, (bottom - .20) / 2);
  pipe.rotation.x = Math.PI / 2; pipe.castShadow = true; group.add(pipe);
  const collar = new THREE.Mesh(new THREE.RingGeometry(radius, .054, 20), aluminium);
  collar.name = 'pergola-deck-pipe-collar'; collar.position.set(x, y, .082); group.add(collar);
  for (const z of [.49, 2.47]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius + .0025, .002, 8, 32), aluminium);
    band.name = 'pergola-pipe-band'; band.position.set(x, y, z); group.add(band);
    box('pergola-pipe-clip', x, y + .048, z, .036, .022, .024);
  }
}

function pergolaCloth193(THREE, group) {
  const weave = new Uint8Array(8 * 8 * 4);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const horizontal = (x >> 2) === (y >> 2);
    const level = [101, 167, 177, 117][(horizontal ? y : x) % 4];
    weave.set([level, level, level, 255], (y * 8 + x) * 4);
  }
  const bump = new THREE.DataTexture(weave, 8, 8);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(940, 630); bump.generateMipmaps = true;
  bump.magFilter = THREE.LinearFilter; bump.minFilter = THREE.LinearMipmapLinearFilter; bump.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({name: 'Black coated woven canopy', color: '#202020',
    roughness: .91, side: THREE.DoubleSide, bumpMap: bump, bumpScale: .0006, vertexColors: true});
  const {bays} = pergolaShade193, rows = 3 * bays + 1, positions = new Float32Array(rows * 2 * 3);
  const indices = [], uvs = [], colors = [];
  for (let row = 0; row < rows; row++) {
    const t = (Math.floor(row / 3) + [0, .44, .56][row % 3]) / bays, i = row * 2;
    uvs.push(t, 0, t, 1);
    const shade = row % 3 === 0 ? 1 : .97;
    colors.push(shade, shade, shade, shade, shade, shade);
    if (row < rows - 1) indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const cloth = new THREE.Mesh(geometry, material);
  cloth.name = 'pergola-sliding-waterproof-fabric'; cloth.castShadow = cloth.receiveShadow = true;
  group.add(cloth); return cloth;
}

function positionPergolaCloth193(cloth, bars, extension) {
  const {wallX, wallZ, travel, parked, frontY, rearY, fall, bays} = pergolaShade193;
  const slopeLength = Math.hypot(1, fall), pitch = (parked + extension * (travel - parked)) / bays;
  const bayLength = travel / bays * slopeLength, along = pitch * slopeLength;
  // The flat bottom and two equal legs retain the cloth length as the carriers gather.
  const sag = .5 * Math.sqrt(Math.max(0, (bayLength - along) * (bayLength + .76 * along)));
  const geometry = cloth.geometry, positions = geometry.getAttribute('position');
  for (let row = 0; row < positions.count / 2; row++) {
    const phase = row % 3, bay = Math.floor(row / 3);
    const run = pitch * (bay + [0, .44, .56][phase]), drop = phase ? sag / slopeLength : 0;
    const x = wallX + run - fall * drop, z = wallZ - fall * run - drop;
    positions.setXYZ(row * 2, x, frontY, z); positions.setXYZ(row * 2 + 1, x, rearY, z);
    if (!phase) bars[bay].position.set(x, (frontY + rearY) / 2, z - .023);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
}

export function createPergolaFabric193(THREE, parent, makePicker) {
  const group = new THREE.Group();
  group.name = 'pergola-fabric-193'; parent.add(group);
  const {box, aluminium} = pergolaFrameParts193(THREE, group);
  pergolaWallFlashings193(THREE, group, aluminium);
  pergolaDrain193(THREE, group, box, aluminium);
  const assembly = new THREE.Group();
  assembly.name = 'pergola-removable-canopy'; group.add(assembly);
  const cloth = pergolaCloth193(THREE, assembly), {bays, frontY, rearY} = pergolaShade193;
  const bars = Array.from({length: bays + 1}, () => box('pergola-moving-crossbar', 0, 0, 0, .040, rearY - frontY + .14, .043, assembly));
  const handle = new THREE.Group();
  handle.name = 'pergola-manual-pull'; assembly.add(handle);
  box('pergola-pull-bracket', -.14, 0, -.012, .28, .03, .018, handle);
  box('pergola-pull-strap', -.27, 0, -.66, .012, .034, 1.30, handle);
  box('pergola-pull-grip', -.27, 0, -1.32, .043, .15, .045, handle);
  const pick = makePicker([handle, cloth, ...bars]);
  let extension = 1, target = 1, last = 0;
  function setPosition(value) {
    extension = value;
    positionPergolaCloth193(cloth, bars, value);
    handle.position.copy(bars.at(-1).position); handle.position.y = rearY - .58;
  }
  setPosition(1);
  return {
    group, get deployed() { return assembly.visible && target === 1; },
    get installed() { return assembly.visible; },
    setInstalled(value) {
      if (value === assembly.visible) return;
      assembly.visible = value;
      target = 0; setPosition(0);
    },
    setDeployed(value) {
      if (!assembly.visible) return;
      target = value ? 1 : 0; setPosition(target);
    },
    toggleAt(ndc, camera) {
      if (!assembly.visible || !pick(ndc, camera)) return false;
      target = 1 - target; last = performance.now(); return true;
    },
    update(now) {
      if (extension === target) return false;
      const step = Math.max(0, now - last) / 1200;
      last = now;
      setPosition(extension < target ? Math.min(target, extension + step) : Math.max(target, extension - step));
      return true;
    },
  };
}
