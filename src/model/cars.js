function createCarContext(THREE) {
  const materials = new Map();
  const material = (color, metalness = 0) => {
    const key = `${color}:${metalness}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? 0.34 : 0.78 }));
    return materials.get(key);
  };
  const addMesh = (group, geometry, color, position = [0, 0, 0], metalness = 0) => {
    const mesh = new THREE.Mesh(geometry, material(color, metalness));
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const box = (group, size, position, color, metalness = 0) =>
    addMesh(group, new THREE.BoxGeometry(...size), color, position, metalness);
  const rod = (group, start, end, radius, color, metalness) => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const center = a.addScaledVector(direction, 0.5);
    const detail = addMesh(group, new THREE.CylinderGeometry(radius, radius, direction.length(), 6),
      color, center.toArray(), metalness);
    detail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return detail;
  };
  return { THREE, addMesh, box, material, rod };
}

// Each section describes x, half-width at the bottom/top, and bottom/top z.
function carShell(context, group, sections, color, metalness = 0) {
  const { THREE, addMesh } = context;
  const rings = sections.map(([x, bottomWidth, topWidth, bottomZ, topZ]) => {
    const rise = topZ - bottomZ;
    const side = [[bottomWidth * 0.85, bottomZ], [bottomWidth * 0.97, bottomZ + rise * 0.06],
      [bottomWidth, bottomZ + rise * 0.22], [bottomWidth * 0.36 + topWidth * 0.64, bottomZ + rise * 0.74],
      [topWidth, topZ - rise * 0.09], [topWidth * 0.91, topZ - rise * 0.025], [topWidth * 0.76, topZ]];
    return [...side, ...side.slice().reverse().map(([y, z]) => [-y, z])].map(([y, z]) => [x, y, z]);
  });
  const count = rings[0].length;
  const indices = [];
  for (let j = 1; j < count - 1; j++) indices.push(0, j + 1, j);
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < count; j++) {
      const a = i * count + j, b = i * count + (j + 1) % count;
      indices.push(a, b, b + count, a, b + count, a + count);
    }
  }
  const last = (rings.length - 1) * count;
  for (let j = 1; j < count - 1; j++) indices.push(last, last + j, last + j + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(rings.flat(2), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return addMesh(group, geometry, color, [0, 0, 0], metalness);
}

function addCarWheels(context, group, length, width, suv) {
  const { THREE, addMesh } = context;
  const radius = suv ? 0.36 : 0.32, tireWidth = 0.22;
  for (const x of [-length * 0.31, length * 0.31]) {
    for (const side of [-1, 1]) {
      const y = side * (width / 2 - tireWidth / 2 - 0.015);
      addMesh(group, new THREE.CylinderGeometry(radius, radius, tireWidth, 20), '#282d2e', [x, y, radius]);
      const hubY = side * (width / 2 - 0.018);
      addMesh(group, new THREE.CylinderGeometry(radius * 0.63, radius * 0.63, 0.018, 10), '#c2c7c7', [x, hubY, radius], 0.65);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.67, 0.016, 4, 20), context.material('#a9b4b9', 0.72));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, hubY, radius);
      group.add(rim);
      addMesh(group, new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, 0.024, 10), '#56636a', [x, hubY, radius], 0.5);
    }
  }
}

function addCarCabin(context, group, length, width, height, belt, paint, suv) {
  const { box } = context;
  const rear = -length * (suv ? 0.36 : 0.29), front = length * 0.22;
  const roofRear = -length * (suv ? 0.27 : 0.17), roofFront = length * 0.075;
  const half = width * 0.42, roofHalf = width * 0.345;
  carShell(context, group, [[rear, half, half, belt, belt + 0.025],
    [(rear + roofRear) / 2, half, (half + roofHalf) / 2, belt, (belt + height) / 2 + 0.055],
    [roofRear, half, roofHalf, belt, height - 0.045],
    [roofFront, half, roofHalf, belt, height - 0.045],
    [front, half, half, belt, belt + 0.025]], '#263c49', 0.28);
  carShell(context, group, [[roofRear - 0.015, roofHalf, roofHalf, height - 0.055, height],
    [roofFront + 0.015, roofHalf, roofHalf, height - 0.055, height]], paint, 0.32);
  for (const side of [-1, 1]) {
    const topY = side * roofHalf * 0.97, sillY = side * half * 0.98;
    for (const [sill, roof] of [[front, roofFront], [rear, roofRear]]) {
      context.rod(group, [sill, sillY, belt + 0.018], [roof, topY, height - 0.04], 0.023, paint, 0.38);
    }
    context.rod(group, [rear, sillY, belt + 0.016], [front, sillY, belt + 0.016], 0.012, '#a9b4b8', 0.6);
    const pillar = box(group, [0.075, 0.055, height - belt - 0.055],
      [-length * 0.06, side * (half + roofHalf) / 2, (belt + height - 0.055) / 2], paint, 0.3);
    pillar.rotation.x = side * Math.atan2(half - roofHalf, height - belt);
    box(group, [length * 0.77, 0.035, 0.035], [0, side * width * 0.443, belt - 0.035], '#68777c', 0.5);
    for (const x of [-length * 0.17, length * 0.1]) {
      box(group, [0.15, 0.025, 0.035], [x, side * width * 0.459, belt - 0.13], '#c1c6c4', 0.6);
    }
    box(group, [0.17, 0.11, 0.085], [length * 0.175, side * width * 0.454, belt + 0.06], paint, 0.25);
  }
}

function addCarBody(context, group, length, width, height, paint, suv) {
  const { box } = context;
  const belt = suv ? 1.04 : 0.89;
  const radius = suv ? 0.36 : 0.32;
  const station = (f, widthFactor, z0, z1) => [length * f, width * widthFactor, width * (widthFactor - 0.025), z0, z1];
  const arches = axle => Array.from({ length: 9 }, (_, index) => {
    const a = Math.PI - index * Math.PI / 8;
    return station(axle + (radius + 0.05) * Math.cos(a) / length, 0.5,
      radius + (radius + 0.05) * Math.sin(a), belt - 0.012);
  });
  carShell(context, group, [station(-0.5, 0.365, 0.42, belt - 0.16), station(-0.486, 0.442, 0.36, belt - 0.1),
    station(-0.455, 0.483, 0.34, belt - 0.048), ...arches(-0.31),
    station(-0.10, 0.495, 0.29, belt), station(0.11, 0.495, 0.29, belt), ...arches(0.31),
    station(0.455, 0.483, 0.34, belt - 0.065), station(0.486, 0.442, 0.36, belt - 0.125),
    station(0.5, 0.37, 0.42, belt - 0.165)], paint, 0.32);
  box(group, [length * 0.82, width * 0.70, 0.115], [0, 0, 0.34], '#293238');
  addCarCabin(context, group, length, width, height, belt, paint, suv);
  addCarWheels(context, group, length, width, suv);
  for (const end of [-1, 1]) {
    box(group, [0.065, width * 0.78, 0.10], [end * (length / 2 - 0.033), 0, 0.47], '#58646a');
    box(group, [0.025, 0.43, 0.11], [end * (length / 2 - 0.018), 0, 0.58], '#e6e8de');
    for (const side of [-1, 1]) {
      box(group, [0.038, width * 0.22, 0.13],
        [end * (length / 2 - 0.021), side * width * 0.29, belt - 0.22], end === 1 ? '#fff1c3' : '#ad463b');
    }
  }
  box(group, [0.03, width * 0.29, 0.13], [length / 2 - 0.019, 0, belt - 0.22], '#26333a');
  for (let row = 0; row < 3; row++) {
    box(group, [0.009, width * 0.26, 0.009], [length / 2 - 0.005, 0, belt - 0.26 + row * 0.032], '#91a0a3', 0.55);
  }
  for (const side of [-1, 1]) {
    box(group, [0.014, width * 0.20, 0.025], [length / 2 - 0.01, side * width * 0.29, belt - 0.18], '#fffcef');
    const trim = box(group, [length * 0.37, 0.023, 0.035], [0, side * width * 0.475, 0.345], '#74848b', 0.45);
    trim.rotation.x = side * 0.12;
    if (suv) box(group, [length * 0.29, 0.038, 0.037], [-length * 0.095, side * width * 0.32, height - 0.023], '#586771', 0.5);
  }
}

export function addCars({ THREE, scene, placements = [], dimensionsByKind = {} }) {
  const paints = ['#6e8f96', '#d4d7ce', '#a87355', '#465f77', '#c7b287'];
  const context = createCarContext(THREE);
  return placements.map((placement, index) => {
    const { id, kind, position, angleRad = 0, location } = placement;
    if (!id || !['sedan', 'suv'].includes(kind) || position?.length !== 3 ||
      !position.every(Number.isFinite) || !Number.isFinite(angleRad)) throw new Error(`Invalid car placement: ${id}`);
    const suv = kind === 'suv';
    const dimensions = dimensionsByKind[kind] || { length: suv ? 4.8 : 4.6, width: suv ? 1.95 : 1.85, height: suv ? 1.70 : 1.48 };
    const group = new THREE.Group();
    group.name = id;
    addCarBody(context, group, dimensions.length, dimensions.width, dimensions.height, paints[index % paints.length], suv);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group, true);
    const size = bounds.getSize(new THREE.Vector3());
    for (const [axis, value] of [['x', dimensions.length], ['y', dimensions.width], ['z', dimensions.height]]) {
      if (Math.abs(size[axis] - value) > 0.01) throw new Error(`Car dimensions mismatch: ${id} ${axis}`);
    }
    const localBounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
    group.position.set(...position);
    group.rotation.z = angleRad;
    group.userData = { kind: 'car', vehicleKind: kind, location, dimensionsM: dimensions, localBounds };
    scene.add(group);
    return { id, kind, location, sceneObjectName: group.name, nominalDimensions: dimensions,
      measuredLocalBounds: localBounds, measuredLength: size.x, measuredWidth: size.y, measuredHeight: size.z,
      groundPosition: [...position], angleRad, units: 'metres', upAxis: 'z', lengthAxis: 'x' };
  });
}
