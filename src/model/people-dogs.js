export function addPeopleAndDogs({ THREE, scene, placements = {} }) {
  const materials = new Map();
  const material = (color) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
    return materials.get(color);
  };
  const bodySphere = new THREE.SphereGeometry(1, 16, 10);
  const headSphere = new THREE.SphereGeometry(1, 12, 8);
  const detailSphere = new THREE.SphereGeometry(1, 8, 4);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const taper = new THREE.CylinderGeometry(0.78, 1, 1, 10);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const mesh = (group, geometry, color, position, scale) => {
    const result = new THREE.Mesh(geometry, material(color));
    result.position.set(...position);
    result.scale.set(...scale);
    result.castShadow = true;
    result.receiveShadow = true;
    group.add(result);
    return result;
  };
  const ellipsoid = (group, color, position, scale) => {
    const radius = Math.max(...scale);
    const sphere = radius >= 0.25 ? bodySphere : radius >= 0.092 ? headSphere : detailSphere;
    return mesh(group, sphere, color, position, scale);
  };
  const segment = (group, color, start, end, radius, endRadius = radius) => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const result = mesh(group, endRadius === radius ? cylinder : taper, color,
      a.clone().add(b).multiplyScalar(0.5).toArray(), [radius, direction.length(), radius]);
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return result;
  };
  const bodyProfile = (group, color, rings, height, sides = 12) => {
    const points = [], uvs = [], triangles = [];
    for (const [i, [z, rx, ry, offsetY, offsetX = 0]] of rings.entries()) {
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2;
        points.push(height * (offsetX + rx * Math.cos(a)), height * (offsetY + ry * Math.sin(a)), height * z);
        uvs.push(j / sides, i / (rings.length - 1));
        if (i && j) {
          const d = i * (sides + 1) + j, a = d - sides - 2;
          triangles.push(a, a + 1, d, a, d, d - 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(triangles);
    geometry.computeVertexNormals();
    return mesh(group, geometry, color, [0, 0, 0], [1, 1, 1]);
  };
  const commonToWorld = ([x, y, z = 0.035]) => [
    0.7326670089036766 * x + 0.680587286146413 * y + 17.83214945811778,
    -0.6805872861464128 * x + 0.7326670089036768 * y + 1.5048668971285242,
    z,
  ];
  const locate = (group, id, defaultPosition, angle = 0, common = false) => {
    const override = placements[id];
    const position = override?.position || (common ? commonToWorld(defaultPosition) : defaultPosition);
    if (position.length !== 3 || !position.every(Number.isFinite)) throw new Error(`Invalid position: ${id}`);
    group.position.set(...position);
    group.rotation.z = override?.rotation ?? angle;
    group.name = id;
    scene.add(group);
  };
  const measure = (group) => {
    group.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(group);
    const size = bounds.getSize(new THREE.Vector3());
    const values = [...bounds.min.toArray(), ...bounds.max.toArray()];
    if (!values.every(Number.isFinite)) throw new Error(`Non-finite geometry: ${group.name}`);
    return { groundPosition: group.position.toArray(), bodyBounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, measuredHeight: size.z };
  };
  const makePerson = (spec) => {
    const g = new THREE.Group();
    const { height: h, skin, hair, shirt, trousers } = spec;
    const p = (x, y, z) => [x * h, y * h, z * h];
    const limb = (color, a, b, r) => segment(g, color, p(...a), p(...b), r * h);
    const ball = (color, a, s) => ellipsoid(g, color, p(...a), s.map(v => v * h));
    for (const side of [-1, 1]) {
      const stride = spec.walk ? side * 0.035 : 0;
      limb(trousers, [side * 0.056, 0, 0.53], [side * 0.063, stride, 0.295], 0.045);
      limb(trousers, [side * 0.063, stride, 0.295], [side * 0.067, stride * 2, 0.065], 0.035);
      ball(trousers, [side * 0.059, stride * 0.45, 0.425], [0.048, 0.053, 0.124]);
      ball(trousers, [side * 0.065, stride * 1.42, 0.205], [0.037, 0.041, 0.092]);
      ball('#e8e4da', [side * 0.067, stride * 2 - 0.026, 0.029], [0.041, 0.070, 0.027]);
      ball('#d0cdc2', [side * 0.067, stride * 2 - 0.004, 0.043], [0.036, 0.043, 0.024]);
      mesh(g, cube, '#424742', p(side * 0.067, stride * 2 - 0.025, 0.006), [0.084 * h, 0.145 * h, 0.012 * h]);
    }
    bodyProfile(g, trousers, [[0.47,0.075,0.054,0.002],[0.49,0.103,0.068,0.002],
      [0.545,0.115,0.071,0.001],[0.58,0.103,0.066,0],[0.59,0.076,0.048,0]], h);
    const torso = bodyProfile(g, shirt, [[0.545,0.112,0.071,0.001],[0.56,0.118,0.071,0.002],
      [0.615,0.108,0.066,0],[0.70,0.115,0.073,0],[0.751,0.126,0.075,0],
      [0.79,0.136,0.064,0],[0.814,0.119,0.054,0],[0.832,0.075,0.044,0],[0.839,0.036,0.034,0]], h);
    torso.userData.garment = 'shirt';
    ball(shirt, [0,0,0.836], [0.047,0.041,0.010]);
    limb(skin, [0, 0, 0.81], [0, 0, 0.87], 0.037);
    ball(skin, [0, -0.008, 0.919], [0.063, 0.062, 0.077]);
    ball(hair, [0, 0.004, 0.949], [0.065, 0.063, 0.051]);
    if (spec.longHair) ball(hair, [0, 0.045, 0.902], [0.071, 0.035, 0.09]);
    ball(skin, [0, -0.069, 0.914], [0.014, 0.016, 0.018]);
    for (const side of [-1, 1]) {
      ball(skin, [side * 0.057, -0.001, 0.917], [0.010, 0.014, 0.019]);
      ball(hair, [side * 0.025, -0.060, 0.939], [0.013, 0.004, 0.003]);
      ball('#34322d', [side * 0.025, -0.062, 0.932], [0.005, 0.005, 0.005]);
      const gesture = spec.gesture && side === 1;
      const shoulder = [side * 0.124, 0, 0.785];
      const elbow = gesture ? [side * 0.19, -0.045, 0.68] : [side * 0.155, 0.01, 0.64];
      const hand = gesture ? [side * 0.24, -0.10, 0.78] : [side * 0.15, -0.025, 0.515];
      ball(shirt, shoulder, [0.033,0.041,0.035]);
      limb(shirt, shoulder, elbow, 0.034);
      ball(shirt, elbow, [0.025,0.023,0.022]);
      limb(skin, elbow, hand, 0.025);
      ball(skin, hand, [0.026, 0.026, 0.035]);
    }
    g.userData = { kind: 'person', heightM: h, child: !!spec.child };
    locate(g, spec.id, spec.position, spec.angle, spec.common);
    const measured = measure(g);
    if (Math.abs(measured.measuredHeight - h) > 0.003) throw new Error(`Person height mismatch: ${spec.id}`);
    return { id: spec.id, height: h, ...measured };
  };
  const people = [
    { id: 'person-garden-1', height: 1.78, position: [2, -7, 0.035], angle: -0.4, skin: '#d7aa88', hair: '#4b332b', shirt: '#457b82', trousers: '#334554', walk: true },
    { id: 'person-garden-2', height: 1.66, position: [3.2, -6.5, 0.035], angle: 1.5, skin: '#e5bd9f', hair: '#9b663d', shirt: '#be704c', trousers: '#e6d7bb', longHair: true, gesture: true },
    { id: 'person-garden-child', height: 1.2, position: [6, -6, 0.035], angle: -1.7, skin: '#dab18c', hair: '#715033', shirt: '#e2b246', trousers: '#567c98', child: true, walk: true },
    { id: 'person-shared-1', height: 1.83, position: [1, 2.5, 0.045], common: true, angle: -0.7, skin: '#986b51', hair: '#2d2928', shirt: '#e9dfcb', trousers: '#52675d', gesture: true },
    { id: 'person-shared-2', height: 1.69, position: [2, 3, 0.045], common: true, angle: 2.5, skin: '#bd8d6e', hair: '#352c28', shirt: '#8e637b', trousers: '#313e4b', longHair: true },
    { id: 'person-190-path', height: 1.75, position: [4.5, 34.3, 0.06], angle: -2.4, skin: '#e5bb99', hair: '#aaa99e', shirt: '#5e8075', trousers: '#ab9c85', walk: true },
    { id: 'person-190-garden', height: 1.71, position: [-7.2, 17.6, 0.04], common: true, angle: 1.2, skin: '#d6a881', hair: '#69452e', shirt: '#b96456', trousers: '#cfc5aa', gesture: true },
    { id: 'person-191-garden', height: 1.79, position: [27, 13.6, 0.04], common: true, angle: -1.6, skin: '#d9ad8e', hair: '#584334', shirt: '#6c8ba3', trousers: '#394f43', walk: true },
    { id: 'person-191-front', height: 1.72, position: [43.8, 17, 0.055], angle: 0.8, skin: '#ce9c7a', hair: '#5f4739', shirt: '#b68f61', trousers: '#4f6070', walk: true },
  ].map(makePerson);
  const makeDog = (isPug) => {
    const g = new THREE.Group();
    const coat = isPug ? '#fff9e9' : '#dcb976';
    const light = isPug ? '#fffdf4' : '#eed3a1';
    const ear = isPug ? '#d9c9b4' : '#be935b';
    const length = isPug ? 0.42 : 0.9;
    const shoulderHeight = isPug ? 0.28 : 0.56;
    const rx = length / 2, ry = isPug ? 0.105 : 0.16, rz = isPug ? 0.085 : 0.145;
    const z = shoulderHeight - rz;
    ellipsoid(g, coat, [0, 0, z], [rx, ry, rz]);
    const legRadius = isPug ? 0.032 : 0.045;
    for (const x of [-rx * 0.65, rx * 0.65]) for (const y of [-ry * 0.67, ry * 0.67]) {
      const kneeZ = isPug ? 0.095 : 0.20;
      const rear = x < 0, r = legRadius;
      if (!isPug) {
        const thigh = segment(g, coat, [x,y,z], [x-0.025,y,kneeZ], r*1.15);
        const contour = [[0,-0.5],[0.55,-0.44],[0.93,-0.25],[1,0],[0.85,0.25],[0.52,0.43],[0,0.5]];
        thigh.geometry = new THREE.LatheGeometry(contour.map(([radius, y]) => new THREE.Vector2(radius, y)), 10);
      }
      bodyProfile(g, coat, [[0.019,r*0.50,r*0.56,y,x+0.017],[0.038,r*0.76,r*0.68,y,x+0.005],
        [kneeZ*0.78,r*0.64,r*0.67,y,x-(rear?0.027:0.007)],
        [kneeZ,r*0.78,r*0.76,y,x-(rear?0.038:0.009)],
        [kneeZ+(z-kneeZ)*0.38,r*1.04,r*0.85,y,x+(rear?0.009:0)],
        [kneeZ+(z-kneeZ)*0.67,r*(rear?1.65:1.19),r*1.02,y*0.95,x+0.007],
        [z,r*(rear?1.45:1.16),r*1.03,y*0.90,x],[z*1.10,r*0.72,r*0.65,y*0.84,x]],1,8);
      ellipsoid(g, light, [x + 0.025, y, 0.028], [legRadius * 1.35, legRadius, 0.028]);
    }
    const headX = isPug ? 0.23 : 0.44, headZ = isPug ? 0.325 : 0.665;
    const neckRadius = isPug ? 0.083 : 0.117;
    bodyProfile(g, coat, [[z*0.73,neckRadius,ry*0.72,0,rx*0.54],
      [z,neckRadius*1.43,ry*0.83,0,rx*0.63],[z+(headZ-z)*0.37,neckRadius*1.22,ry*0.76,0,rx*0.80],
      [headZ-0.045,neckRadius*0.91,ry*0.66,0,headX-0.035],[headZ,neckRadius*0.70,ry*0.60,0,headX-0.017]],1);
    ellipsoid(g, light, [headX, 0, headZ], isPug ? [0.105, 0.105, 0.105] : [0.125, 0.102, 0.11]);
    for (const side of [-1, 1]) {
      const e = ellipsoid(g, ear, [headX - 0.025, side * (isPug ? 0.083 : 0.09), headZ - (isPug ? -0.033 : 0.045)], isPug ? [0.045, 0.03, 0.043] : [0.075, 0.037, 0.125]);
      if (isPug) e.geometry = headSphere;
      e.rotation.x = side * 0.2;
      ellipsoid(g, '#302b25', [headX + 0.091, side * (isPug ? 0.052 : 0.055), headZ + 0.026], isPug ? [0.017,0.019,0.018] : [0.012,0.014,0.014]);
      ellipsoid(g, '#fffdf1', [headX + (isPug ? 0.106 : 0.101), side * (isPug ? 0.052 : 0.055), headZ + 0.03], [0.003, 0.004, 0.004]);
    }
    const muzzleX = headX + (isPug ? 0.091 : 0.13);
    ellipsoid(g, isPug ? '#b3a295' : light, [muzzleX, 0, headZ - 0.028], isPug ? [0.037, 0.061, 0.037] : [0.105, 0.065, 0.053]);
    ellipsoid(g, '#3a302b', [muzzleX + (isPug ? 0.031 : 0.091), 0, headZ - 0.014], isPug ? [0.012, 0.026, 0.016] : [0.022, 0.031, 0.021]);
    if (isPug) {
      const root = ellipsoid(g, coat, [-0.161,0.014,0.26], [0.042,0.032,0.058]);
      root.rotation.y = -0.55;
      ellipsoid(g, light, [-0.191,0.017,0.295], [0.035,0.025,0.030]);
      const points = Array.from({ length: 20 }, (_, i) => {
        const a = i / 19 * Math.PI * 2.05;
        return new THREE.Vector3(-0.19 - Math.sin(a) * 0.055, 0.018, 0.285 + (1 - Math.cos(a)) * 0.047);
      });
      mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, 0.018, 7, false), coat, [0, 0, 0], [1, 1, 1]);
    } else {
      const points = [[-0.35, 0, 0.45], [-0.58, 0.01, 0.5], [-0.77, 0.04, 0.59], [-0.9, 0.07, 0.64]].map(p => new THREE.Vector3(...p));
      mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 15, 0.044, 8, false), coat, [0, 0, 0], [1, 1, 1]);
      for (let i = 0; i < 5; i++) ellipsoid(g, light, [-0.5 - i * 0.065, 0.02, 0.44 + i * 0.027], [0.065, 0.041, 0.085 - i * 0.008]);
      ellipsoid(g, light, [0.28, 0, 0.41], [0.1, 0.148, 0.17]);
    }
    for (const side of [-1, 1]) {
      const flank = side * ry;
      for (const x of [-rx * 0.65, rx * 0.65]) {
        for (let toe = -1; toe <= 1; toe++) {
          ellipsoid(g, light, [x + legRadius * 1.05, flank * 0.67 + toe * legRadius * 0.46, 0.017],
            [legRadius * 0.57, legRadius * 0.35, 0.014]);
        }
      }
      if (isPug) {
        ellipsoid(g, '#c7b9aa', [headX + 0.081, side * 0.047, headZ + 0.023], [0.012,0.026,0.023]);
        ellipsoid(g, '#82736b', [headX + 0.105, side * 0.025, headZ - 0.030], [0.021,0.025,0.022]);
        const fold = ellipsoid(g, '#cfc3b5', [headX + 0.083, side * 0.028, headZ + 0.048], [0.009,0.026,0.006]);
        fold.rotation.x = side * -0.25;
      } else {
        ellipsoid(g, '#bd945f', [headX + 0.149, side * 0.042, headZ - 0.050], [0.067,0.020,0.015]);
        for (let feather = 0; feather < 5; feather++) {
          const lock = ellipsoid(g, feather % 2 ? coat : light,
            [0.32 - feather * 0.034, side * (0.075 + feather * 0.008), 0.444 - feather * 0.011],
            [0.031,0.020,0.093 - feather * 0.004]);
          lock.rotation.y = 0.37 + feather * 0.045;
        }
      }
    }
    const breed = isPug ? 'white pug' : 'golden retriever';
    g.userData = { kind: 'dog', breed, shoulderHeightM: shoulderHeight, bodyLengthM: length };
    locate(g, isPug ? 'whitepug' : 'goldenretriever', isPug ? [7, -6, 0.035] : commonToWorld([-7,18.2,.04]), isPug ? -2.5 : 0.65);
    g.userData.parcel=isPug?'193':'190';
    return { id: g.name, breed, parcel:g.userData.parcel, shoulderHeight, length, coatColor: coat, ...measure(g) };
  };
  return { people, dogs: [makeDog(false), makeDog(true)], units: 'metres', upAxis: 'z' };
}
