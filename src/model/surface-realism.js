const surfaceUnit = value => value - Math.floor(value);
const surfaceClamp = value => Math.max(0, Math.min(1, value));
const surfaceMix = (a, b, t) => a + (b - a) * t;

function surfaceHash(x, y, seed = 0) {
  let n = Math.imul(x + seed, 0x7feb352d) ^ Math.imul(y - seed, 0x846ca68b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function surfaceNoise(u, v, columns, rows, seed) {
  const x = surfaceUnit(u) * columns, y = surfaceUnit(v) * rows;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = (x0 + 1) % columns, y1 = (y0 + 1) % rows;
  const a = x - x0, b = y - y0;
  const tx = a * a * (3 - 2 * a), ty = b * b * (3 - 2 * b);
  return surfaceMix(
    surfaceMix(surfaceHash(x0, y0, seed), surfaceHash(x1, y0, seed), tx),
    surfaceMix(surfaceHash(x0, y1, seed), surfaceHash(x1, y1, seed), tx), ty);
}

function surfaceWood(u, v, noise, grit, {courses, joints, charred = false}) {
  const board = Math.floor(u * courses);
  const offset = surfaceHash(board, 1, 76);
  const across = surfaceUnit(u * courses);
  const length = surfaceUnit(v * joints + offset);
  const seam = (courses > 1 && Math.min(across, 1 - across) < (charred ? .026 : .014))
    || (joints && Math.min(length, 1 - length) < .007);
  const grainDrift = .008 * noise(9, 6, 45) + .0016 * Math.sin(v * Math.PI * 4);
  const grain = surfaceNoise(u + grainDrift, v, 184, 11, 18);
  const wideGrain = surfaceNoise(u + grainDrift, v, 57, 4, 93);
  const pores = surfaceNoise(u, v, 126, 39, 26);
  const fissure = charred && grain < .26 && pores < .40 ? .16 : 0;
  const boardShade = charred ? .25 : .16;
  const shade = .55 + offset * boardShade + grain * .12 + wideGrain * .15 + grit * .06 - fissure;
  return [seam ? shade * .69 : shade, seam ? .25 : .51 + grain * .22 + pores * .11 - fissure];
}

function surfaceMasonry(u, v, noise, grit, {columns, rows, stagger, joint}) {
  const row = Math.floor(v * rows), offset = stagger && row % 2 ? .5 : 0;
  const x = surfaceUnit(u * columns + offset), y = surfaceUnit(v * rows);
  const column = Math.floor(u * columns + offset) % columns;
  const edge = Math.min(x, 1 - x, y, 1 - y);
  const tile = surfaceHash(column, row, 65);
  const aggregate = noise(71, 80, 3) * .15 + grit * .07;
  const shade = .62 + tile * .14 + aggregate + noise(5, 5, 53) * .09;
  if (edge < joint) return [shade * .70, .16 + grit * .08];
  if (edge < joint * 1.6) return [shade * 1.04, .63 + aggregate];
  return [shade, .73 + aggregate];
}

function surfaceGrass(u, v, noise, grit) {
  const patches = noise(5, 6, 19) * .51 + noise(11, 13, 81) * .30 + noise(27, 23, 5) * .19;
  const thatch = noise(121, 135, 56);
  const blade = noise(253, 127, 27);
  const shade = .44 + patches * .43 + thatch * .08 + blade * .09 + grit * .09;
  const dried = Math.max(0, thatch - .60) * (1 - patches);
  return [shade, .46 + blade * .26 + thatch * .15,
    [1.01 + dried * .35, 1.02, .91 + (1 - patches) * .13]];
}

function surfaceAggregate(noise, grit, strength) {
  const patch = noise(9, 7, 68);
  const chips = noise(109, 94, 9), dust = noise(221, 241, 12);
  const fleck = chips > .72 ? .12 : chips < .24 ? -.12 : 0;
  const shade = .77 + (patch - .4) * .10 + (dust - .38) * .18 + (grit - .4) * .12 + fleck * strength;
  return [shade, .32 + chips * .36 + dust * .23 + (grit - .5) * .10];
}

function surfaceRoof(u, v, noise, grit, panels = 0) {
  const band = surfaceNoise(u, v, 27, 4, 76);
  const patina = noise(18, 15, 54);
  const ridge = surfaceUnit(u * panels);
  const standingSeam = panels && ridge < .03;
  const panel = panels ? surfaceHash(Math.floor(u * panels), 2, 35) : band;
  const shade = .62 + band * .13 + panel * .13 + patina * .11 + grit * .04;
  return [standingSeam ? shade * .77 : shade, standingSeam ? .95 : .31 + band * .13 + patina * .10];
}

function surfaceRoofTile(u, v, noise, grit) {
  const columns = 8, rows = 10;
  const row = Math.floor(v * rows), column = Math.floor(u * columns);
  const across = surfaceUnit(u * columns), down = surfaceUnit(v * rows);
  const tileTone = surfaceHash(column, row, 77);
  const lip = down < .035, join = Math.min(across, 1 - across) < .023;
  const patina = noise(61, 62, 92), clay = noise(124, 129, 13);
  const shade = .67 + tileTone * .095 + patina * .09 + grit * .04 + down * .045;
  if (lip || join) return [shade * .76, .24 + clay * .12];
  return [down < .06 ? shade * 1.06 : shade, .59 + clay * .11 - down * .19];
}

function surfaceGarage(u, v, noise, grit) {
  const course = surfaceUnit(v * 5);
  const paint = noise(17, 15, 83);
  const shade = .73 + paint * .09 + grit * .03;
  if (course < .023) return [shade * .70, .23];
  return [course < .039 ? shade * 1.06 : shade, .55 + paint * .12];
}

function surfaceWoven(u, v, noise, grit) {
  const weave = (Math.sin(u * 206 * Math.PI) * Math.cos(v * 206 * Math.PI) + 1) * .5;
  const thread = noise(173, 107, 42);
  return [.67 + weave * .12 + thread * .11 + grit * .05, .31 + weave * .38 + thread * .18];
}

function surfaceWater(u, v, noise) {
  const flow = noise(9, 7, 89);
  const ripple = Math.sin((u * 7 + v * 4 + flow * .48) * 2 * Math.PI);
  const second = Math.sin((v * 9 - u * 3 + flow * .3) * 2 * Math.PI);
  return [.85 + second * .07 + ripple * .06, .5 + ripple * .21 + second * .18];
}

const surfaceProfiles = {
  grass: {tile: [10, 10], size: 512, gain: 1.02, bump: .045, roughness: .97, sample: surfaceGrass},
  soil: {tile: [2.5, 2.5], gain: .99, bump: .028, roughness: .98, sample: (u, v, n, g) => surfaceAggregate(n, g, 1)},
  planting: {tile: [2.0, 2.0], gain: .79, bump: .035, roughness: .99, sample: (u, v, n, g) => surfaceAggregate(n, g, 1)},
  asphalt: {tile: [7.5, 7.5], gain: 1, bump: .021, roughness: .96, color: 0x777a73,
    sample: (u, v, n, g) => surfaceAggregate(n, g, .85)},
  gravel: {tile: [2.5, 2.5], gain: 1.09, bump: .035, roughness: .95, sample: (u, v, n, g) => surfaceAggregate(n, g, 1.2)},
  sand: {tile: [1.5, 1.5], gain: 1.04, bump: .012, roughness: .94, sample: (u, v, n, g) => surfaceAggregate(n, g, .39)},
  pavers: {tile: [2.4, 2.4], gain: 1.09, bump: .023, roughness: .91, sample: (u, v, n, g) =>
    surfaceMasonry(u, v, n, g, {columns: 8, rows: 12, stagger: true, joint: .030})},
  tile: {tile: [2.4, 2.4], gain: 1.14, bump: .012, roughness: .69, sample: (u, v, n, g) =>
    surfaceMasonry(u, v, n, g, {columns: 4, rows: 4, stagger: false, joint: .014})},
  terrace: {tile: [1.28, 3.6], gain: 1.15, bump: .028, roughness: .86, sample: (u, v, n, g) =>
    surfaceWood(u, v, n, g, {courses: 8, joints: 2})},
  oak: {tile: [1.44, 3.6], gain: 1.13, bump: .014, roughness: .64, sample: (u, v, n, g) =>
    surfaceWood(u, v, n, g, {courses: 8, joints: 3})},
  wood: {tile: [.78, 2.2], gain: 1.16, bump: .019, roughness: .73, sample: (u, v, n, g) =>
    surfaceWood(u, v, n, g, {courses: 1, joints: 0})},
  facade: {tile: [1.44, 4.4], gain: .94, bump: .03, roughness: .88, sample: (u, v, n, g) =>
    surfaceWood(u, v, n, g, {courses: 8, joints: 0, charred: true})},
  charred: {tile: [.61, 2.0], gain: 1.0, bump: .025, roughness: .88, sample: (u, v, n, g) =>
    surfaceWood(u, v, n, g, {courses: 1, joints: 0, charred: true})},
  redWood: {tile: [1.36, 3.6], gain: 1.09, bump: .022, roughness: .83, sample: (u, v, n, g) =>
    surfaceWood(u, v, n, g, {courses: 8, joints: 0})},
  metalRoof: {tile: [2.5, 4.5], gain: 1.10, bump: .012, roughness: .48, sample: surfaceRoof},
  paneledRoof: {tile: [2.6, 4.5], gain: 1.08, bump: .022, roughness: .52, sample: (u, v, n, g) =>
    surfaceRoof(u, v, n, g, 5)},
  ceramicRoof: {tile: [2.4, 3.4], size: 512, gain: 1.10, bump: .023, roughness: .79, sample: surfaceRoofTile},
  garage: {tile: [2.5, 2.25], gain: 1.09, bump: .015, roughness: .50, sample: surfaceGarage},
  membrane: {tile: [2.1, 2.1], gain: .92, bump: .012, roughness: .93, sample: (u, v, n, g) => surfaceAggregate(n, g, .57)},
  plaster: {tile: [2.5, 2.5], gain: 1.16, bump: .008, roughness: .92, sample: (u, v, n, g) => surfaceAggregate(n, g, .34)},
  stone: {tile: [2.35, 2.35], gain: 1.09, bump: .017, roughness: .83, sample: (u, v, n, g) => surfaceAggregate(n, g, .77)},
  textile: {tile: [.75, .75], gain: 1.14, bump: .013, roughness: .94, sample: surfaceWoven},
  rubber: {tile: [1.0, 1.0], gain: .95, bump: .01, roughness: .91, sample: surfaceWoven},
  water: {tile: [1.65, 1.65], gain: 1, bump: .024, roughness: .19, sample: surfaceWater},
};

function surfaceTexturePair(THREE, name, profile, anisotropy) {
  const size = profile.size || 256;
  const albedo = new Uint8Array(size * size * 4), height = new Uint8Array(albedo.length);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + .5) / size, v = (y + .5) / size;
      const noise = (columns, rows, seed) => surfaceNoise(u, v, columns, rows, seed);
      const [shade, relief, tint] = profile.sample(u, v, noise, surfaceHash(x, y, 101));
      for (let channel = 0; channel < 3; channel++) {
        albedo[offset + channel] = Math.round(255 * surfaceClamp(shade * (tint?.[channel] ?? 1)));
        height[offset + channel] = Math.round(255 * surfaceClamp(relief));
      }
      albedo[offset + 3] = height[offset + 3] = 255;
      offset += 4;
    }
  }
  const makeTexture = (data, suffix) => {
    const texture = new THREE.DataTexture(data, size, size);
    texture.name = name + suffix;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
  };
  return {map: makeTexture(albedo, '-albedo'), bumpMap: makeTexture(height, '-relief')};
}

const surfaceGroundProfiles = {
  road: 'asphalt', terrace: 'terrace', entry: 'pavers', driveway: 'pavers', entryPaving: 'pavers',
  conceptCanopyDeck: 'terrace', shared_boundary: 'grass', shared_path: 'pavers',
  sand: 'sand', podest: 'terrace', baza: 'terrace', gravel: 'gravel',
  paving: 'pavers', path: 'pavers', planting: 'planting', lawn: 'grass',
};

const surfaceGroundColors = {
  c8ccc5: 'asphalt', c4c5b8: 'pavers', cfc6b2: 'pavers', c6b59a: 'terrace',
  b5a38d: 'terrace', bbb9aa: 'pavers', b9bbae: 'pavers', a5b58c: 'grass',
  dbd6c7: 'pavers', e4d2a5: 'sand', a89173: 'terrace', d4c5a9: 'gravel',
  bcbdb1: 'pavers', d5d1c1: 'pavers', '6f7758': 'planting', '9db286': 'grass',
};

const surfaceInteriorColors = {
  e9e3d7: 'plaster', ede8de: 'plaster', e9e4d9: 'plaster', f1ede5: 'plaster', f3eee5: 'plaster',
  b4936e: 'oak', b9956c: 'oak', bfb9ac: 'tile', c2bdb1: 'tile',
  '8a684b': 'wood', '8c6b4c': 'wood',
  d9d0bd: 'textile', c2bda9: 'textile', a99e86: 'textile', e0d7c5: 'textile', b0b4a4: 'textile',
  d1c8b7: 'stone', b4b0a6: 'stone',
};

const surfaceTurfColors = {
  a6b78e: 0x759650, aab993: 0x7d9a5a, b6c398: 0x8c9e63, b0bd98: 0x859961,
  a5b58c: 0x799654, '9db286': 0x719452,
};

function surfaceProfileFor(object, material, key, index, hasVinylTexture) {
  const {name, parent, geometry} = object;
  if (!material.isMeshStandardMaterial || material.map || material.transparent) return null;
  const color = material.color.getHexString();
  if (/^(parcel|context)-grass-/.test(name)) return 'grass';
  if (/^(parcel|context)-soil-/.test(name)) return 'soil';
  if (name.startsWith('surface-')) return surfaceGroundProfiles[name.slice(8)];
  if ((!name || name.startsWith('ground-')) && geometry.type === 'ShapeGeometry' && parent.type === 'Scene')
    return surfaceGroundColors[color];

  if (name === 'hot-tub-blue-water') return 'water';
  if (name === 'in-ground-trampoline-mat') return 'rubber';
  if (name === 'boundary-fence-boards' || (key === 'timber' && parent.name.startsWith('shared-wicket-'))) return 'charred';
  if (parent.name === 'shared-red-sauna') return name === 'sauna-roof-no-eaves' ? 'paneledRoof' : 'redWood';
  if (key === 'garage' || name === 'garage-sectional-door') return 'garage';
  const movingDoor = parent.userData.kind === 'walk-door' || parent.parent?.userData.kind === 'walk-door';
  if (movingDoor || object.userData.kind === 'hall-partition') return surfaceInteriorColors[color];
  if (hasVinylTexture && parent.name === 'icon-193-interior'
    && (name === 'ground-floor' || name === 'upper-oak-finish')) return 'virginOakVinyl';
  if (parent.name === 'icon-193-interior' || parent.name === 'floryda-190-interior') {
    if (Array.isArray(object.material) && index === 1) return 'facade';
    if (surfaceInteriorColors[color] === 'oak' && /stair/.test(name)) return 'wood';
    return surfaceInteriorColors[color];
  }
  if (parent.userData.kind === 'car') return color === '282d2e' ? 'rubber' : null;
  if (key === 'timber') return 'facade';
  if (key === 'roof') return parent.name === 'house-191' ? 'ceramicRoof' : 'metalRoof';
  if (/flat-roof|terrace-cover|entrance-canopy/.test(name)) return 'membrane';
  if (key === 'concrete' || key === 'stone' || /plinth|balcony-\d+-slab|chimney/.test(name)) return 'stone';
  if (key === 'plaster' || key === 'white' || name === '41-walls') return 'plaster';
  if (key === 'wood') return 'wood';
  return null;
}

function surfaceWriteProjection(points, count, normal, tile, angle, output, offset) {
  const horizontal = Math.hypot(normal.x, normal.y);
  let ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux, vz = 0;
  if (horizontal > 1e-6 && Math.abs(normal.z) < .99) {
    ux = -normal.y / horizontal;
    uy = normal.x / horizontal;
    if (ux < -1e-6 || (Math.abs(ux) < 1e-6 && uy < 0)) {
      ux = -ux;
      uy = -uy;
    }
    vx = -normal.x / horizontal * Math.abs(normal.z);
    vy = -normal.y / horizontal * Math.abs(normal.z);
    if (normal.z < 0) {
      vx = -vx;
      vy = -vy;
    }
    vz = horizontal;
  }
  for (let i = 0; i < count; i++) {
    const point = points[i];
    output[offset++] = (ux * point.x + uy * point.y) / tile[0];
    output[offset++] = (vx * point.x + vy * point.y + vz * point.z) / tile[1];
  }
}

function surfaceProjectGeometry(THREE, object, tile, angle) {
  const source = object.geometry, isBox = source.type === 'BoxGeometry', isPlanar = source.type === 'ShapeGeometry';
  const geometry = source.index && !isBox && !isPlanar ? source.toNonIndexed() : source.clone();
  const positions = geometry.getAttribute('position'), existing = geometry.getAttribute('uv');
  const uv = new Float32Array(positions.count * 2);
  if (source.type === 'TorusGeometry' || (source.type === 'CylinderGeometry' && object.name !== 'hot-tub-blue-water')) {
    const {height = tile[1], radius = 0, radiusTop = radius, radiusBottom = radiusTop} = source.parameters;
    const circumference = 2 * Math.PI * (radiusTop + radiusBottom) / 2;
    const repeatsU = Math.max(1, Math.round(circumference / tile[0]));
    for (let i = 0; i < positions.count; i++) {
      uv[2 * i] = existing.getX(i) * repeatsU;
      uv[2 * i + 1] = existing.getY(i) * height / tile[1];
    }
  } else {
    surfaceProjectFaces(THREE, object, geometry, tile, angle, uv, isBox || isPlanar);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function surfaceProjectFaces(THREE, object, geometry, tile, angle, uv, splitVertices) {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const edge = new THREE.Vector3(), normal = new THREE.Vector3();
  // Closed flush leaves share the wall's architectural coordinates for plaster grain.
  let doorPose;
  if (object.parent.userData.kind === 'walk-door') {
    object.parent.updateMatrix();
    object.updateMatrix();
    doorPose = new THREE.Matrix4().multiplyMatrices(object.parent.matrix, object.matrix);
  }
  const step = splitVertices ? 1 : 3;
  for (let i = 0; i < positions.count; i += step) {
    for (let j = 0; j < step; j++) {
      points[j].fromBufferAttribute(positions, i + j);
      if (doorPose) points[j].applyMatrix4(doorPose);
      if (object.name === 'hot-tub-blue-water') {
        const vertical = points[j].y;
        points[j].y = points[j].z;
        points[j].z = vertical;
      }
    }
    if (splitVertices) {
      normal.fromBufferAttribute(normals, i);
      if (doorPose) normal.transformDirection(doorPose);
    }
    else normal.subVectors(points[1], points[0]).cross(edge.subVectors(points[2], points[0])).normalize();
    surfaceWriteProjection(points, step, normal, tile, angle, uv, i * 2);
  }
}

function surfaceTintFence(THREE, object) {
  const transform = new THREE.Matrix4(), tint = new THREE.Color();
  const position = new THREE.Vector3();
  for (let i = 0; i < object.count; i++) {
    object.getMatrixAt(i, transform);
    position.setFromMatrixPosition(transform);
    const tone = surfaceHash(Math.round(position.x * 300), Math.round(position.y * 300), 95);
    tint.setRGB(.78 + tone * .22, .80 + tone * .20, .80 + tone * .18);
    object.setColorAt(i, tint);
  }
  if (object.instanceColor) object.instanceColor.needsUpdate = true;
}

function surfaceFenceUvs(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      #ifdef USE_INSTANCING
        vec3 boardSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec2 boardScale = vec2(abs(normal.x) > 0.5 ? boardSize.y : boardSize.x,
                               abs(normal.z) > 0.5 ? boardSize.y : boardSize.z);
        vec2 boardCenter = instanceMatrix[3].xy;
        vec2 grainOffset = fract(vec2(dot(boardCenter, vec2(1.83, 2.43)), dot(boardCenter, vec2(2.15, 1.31))));
        vec2 grainUv = uv * boardScale + grainOffset;
        vMapUv = (mapTransform * vec3(grainUv, 1.0)).xy;
        vBumpMapUv = (bumpMapTransform * vec3(grainUv, 1.0)).xy;
      #endif
    `);
  };
}

function applyBarkScan(material, textures) {
  Object.assign(material, textures, {bumpScale: .014});
  material.color.setHex(0xd9d1bd);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      vec2 barkSize = vec2(6.28318 * length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
      vec2 barkUv = uv * barkSize + fract(instanceMatrix[3].xy);
      vMapUv = barkUv;
      vBumpMapUv = barkUv;
    `);
  };
}

const scannedSurfaces = {
  grass: {metres: 2, tint: 0xa0e4a1},
  planting: {metres: 1.3, tint: 0xd3bba3},
  gravel: {metres: 2.25, tint: 0xeee3cf},
  terrace: {metres: 1.5, tint: 0xffefda},
  // The square repeat spans 16 diagonal grid steps of a 592 × 148 mm English herringbone.
  virginOakVinyl: {metres: 16 * Math.SQRT2 * .148, tint: 0xffffff, roughness: .60, bump: .00065, gain: 1},
};

async function loadSurfaceScans(THREE, scans, anisotropy) {
  const textures = new Map(), loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(scans).map(async ([type, images]) => {
    const [map, bumpMap] = await Promise.all(images.map(url => loader.loadAsync(url)));
    for (const texture of [map, bumpMap]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = anisotropy;
    }
    map.colorSpace = THREE.SRGBColorSpace;
    textures.set(type, {map, bumpMap});
  }));
  return textures;
}

export async function applyRealisticSurfaces({THREE, scene, mats, renderer, scans = {}, siteRotation = 0}) {
  const keys = new Map(Object.entries(mats).map(([key, material]) => [material, key]));
  const materials = new Map();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textures = await loadSurfaceScans(THREE, scans, anisotropy);
  const hasVinylTexture = textures.has('virginOakVinyl');
  scene.traverse(object => {
    if (!object.isMesh || !object.geometry?.getAttribute('position')) return;
    if (object.isInstancedMesh && object.name.endsWith('-trunks') && textures.has('bark')) {
      applyBarkScan(object.material, textures.get('bark'));
      return;
    }
    const originals = Array.isArray(object.material) ? object.material : [object.material];
    const types = originals.map((material, i) => surfaceProfileFor(object, material, keys.get(material), i, hasVinylTexture));
    const type = types.find(Boolean);
    if (!type) return;
    const angle = /^surface-(driveway|entry|terrace)$/.test(object.name) ? siteRotation : 0;
    const projectionType = types.includes('facade') ? 'facade' : type;
    const metres = scans[projectionType] && scannedSurfaces[projectionType].metres;
    const tile = metres ? [metres, metres] : surfaceProfiles[projectionType].tile;
    object.geometry = surfaceProjectGeometry(THREE, object, tile, angle);
    const replacements = originals.map((material, i) => {
      const type = types[i];
      if (!type) return material;
      const profile = surfaceProfiles[type] ?? scannedSurfaces[type], key = material.uuid + ':' + type;
      if (!textures.has(type)) textures.set(type, surfaceTexturePair(THREE, type, profile, anisotropy));
      if (!materials.has(key)) {
        const finish = material.clone();
        finish.name = type;
        Object.assign(finish, textures.get(type), {roughness: profile.roughness, bumpScale: profile.bump});
        const color = scans[type] ? scannedSurfaces[type].tint : type === 'grass' ? surfaceTurfColors[material.color.getHexString()] : profile.color;
        if (color !== undefined) finish.color.setHex(color);
        if (type === 'ceramicRoof') finish.metalness = 0;
        if (type === 'charred') surfaceFenceUvs(finish);
        finish.color.multiplyScalar(profile.gain);
        materials.set(key, finish);
      }
      return materials.get(key);
    });
    object.material = replacements.length > 1 ? replacements : replacements[0];
    if (object.name === 'boundary-fence-boards') surfaceTintFence(THREE, object);
  });
  return {textureCount: textures.size * 2, materialCount: materials.size};
}
