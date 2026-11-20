const iconKitchenFrontLabels = new Map([
  ['kitchen-pantry-left-front', 'robot'],
  ['kitchen-pantry-closed-leaf', 'drzwi spiżarni'],
  ['kitchen-back-front-2-0', 'pod zlewem'],
  ['kitchen-back-dishwasher-front', 'zmywarka'],
  ['kitchen-tall-fridge', 'lodówka'],
  ['kitchen-tall-freezer', 'zamrażarka'],
  ['kitchen-back-upper-2', 'górne fronty'],
  ['kitchen-island-oven-tray-drawer', 'piekarnik'],
]);

export function measureIconKitchen(THREE, group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const modelMatrix = new THREE.Matrix4();
  const base = [], upper = [], island = [];
  let wallTop, islandTop;
  function bounds(mesh) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    modelMatrix.multiplyMatrices(inverse, mesh.matrixWorld);
    return mesh.geometry.boundingBox.clone().applyMatrix4(modelMatrix);
  }
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const name = mesh.name;
    if (name === 'kitchen-back-top') wallTop = bounds(mesh);
    if (name === 'kitchen-island-top') islandTop = bounds(mesh);
    let row;
    if (/^kitchen-(?:pantry-(?:left-front|right-front|closed-leaf)|back-front-\d+-0|back-dishwasher-front|tall-(?:fridge|freezer))$/.test(name)) row = base;
    else if (/^kitchen-back-upper-\d+$/.test(name)) row = upper;
    else if (/^kitchen-island-(?:working-drawer-\d+-0|oven-tray-drawer)$/.test(name)) row = island;
    if (row) {
      const {min, max} = bounds(mesh);
      row.push({start: min.x, end: max.x, name, caption: iconKitchenFrontLabels.get(name) || ''});
    }
  });
  for (const row of [base, upper, island]) row.sort((a, b) => a.start - b.start);
  return {base, upper, island, wallTop, islandTop};
}

function iconKitchenDimensionBrush(ink, handedness, pixelsPerMetre) {
  const numberFont = '600 25px system-ui, sans-serif';
  function line(x, y, endX, endY) {
    ink.beginPath();
    ink.moveTo(x, y);
    ink.lineTo(endX, endY);
    ink.strokeStyle = 'rgba(255,250,231,.76)';
    ink.lineWidth = .010;
    ink.stroke();
    ink.strokeStyle = 'rgba(46,61,52,.85)';
    ink.lineWidth = .0045;
    ink.stroke();
  }
  function label(value, x, y, small = false) {
    ink.save();
    ink.translate(x, y);
    ink.scale(handedness / pixelsPerMetre, 1 / pixelsPerMetre);
    ink.font = small ? '500 16px system-ui, sans-serif' : numberFont;
    ink.lineWidth = small ? 1.6 : 2.6;
    ink.strokeStyle = 'rgba(255,250,231,.95)';
    ink.strokeText(value, 0, 0);
    ink.fillStyle = '#263b32';
    ink.fillText(value, 0, 0);
    ink.restore();
  }
  return {line, label, numberFont};
}

function iconKitchenDimensionPen(ink, handedness, pixelsPerMetre) {
  const {line, label, numberFont} = iconKitchenDimensionBrush(ink, handedness, pixelsPerMetre);
  const cm = metres => (Math.round(metres * 1000) / 10).toLocaleString('pl-PL') + ' cm';
  return function dimension(length, x, y, angle, caption) {
    ink.save();
    ink.translate(x, y);
    ink.rotate(angle);
    const half = length / 2, narrow = length < .24, value = cm(length);
    ink.font = numberFont;
    const gap = ink.measureText(value).width / (2 * pixelsPerMetre) + .014;
    if (narrow) {
      line(-half, 0, half, 0);
      line(0, 0, 0, .062);
      ink.save();
      ink.translate(0, .18);
      ink.rotate(-Math.PI / 2);
      label(value, 0, 0);
      ink.restore();
    } else {
      line(-half, 0, -gap, 0);
      line(gap, 0, half, 0);
      label(value, 0, 0);
      if (caption) label(caption, 0, .078, true);
    }
    for (const end of [-half, half]) line(end, -.034, end, .034);
    ink.restore();
  };
}

export function createIconKitchenFloorDimensions(THREE, group, visible) {
  const {base, upper, island, wallTop, islandTop} = measureIconKitchen(THREE, group);
  const wall = wallTop.max.y, near = islandTop.min.y, far = islandTop.max.y;
  const left = islandTop.min.x, right = islandTop.max.x;
  const aisleX = Math.max(base.at(-1).end, right) + .20, depthX = right + .21;
  const x0 = base[0].start - .02, x1 = aisleX + .19, y0 = wall - .02, y1 = far + .38;
  const width = x1 - x0, height = y1 - y0;
  const canvas = document.createElement('canvas');
  const pixelsPerMetre = 320;
  canvas.width = Math.ceil(width * pixelsPerMetre);
  canvas.height = Math.ceil(height * pixelsPerMetre);
  const ink = canvas.getContext('2d');
  ink.scale(canvas.width / width, canvas.height / height);
  ink.translate(-x0, -y0);
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.lineCap = ink.lineJoin = 'round';
  // In the mirrored house +x and +y correspond to screen right and down when facing the wall.
  const handedness = group.matrixWorld.determinant() < 0 ? 1 : -1;
  const dimension = iconKitchenDimensionPen(ink, handedness, pixelsPerMetre);
  function fronts(row, y, angle) {
    for (const {start, end, caption} of row) dimension(end - start, (start + end) / 2, y, angle, caption);
  }
  fronts(base, wall + .175, 0);
  fronts(upper, wall + .445, 0);
  fronts(island, near - .175, Math.PI);
  dimension(near - wall, aisleX, (wall + near) / 2, -Math.PI / 2, 'między blatami');
  dimension(far - near, depthX, (near + far) / 2, -Math.PI / 2, 'głębokość wyspy');
  dimension(right - left, (left + right) / 2, far + .19, 0, 'długość wyspy');
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({map, transparent: true, depthWrite: false, toneMapped: false});
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'kitchen-floor-dimensions';
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, .004);
  mesh.raycast = () => {};
  mesh.visible = visible;
  group.add(mesh);
  return mesh;
}
