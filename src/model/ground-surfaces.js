export function interiorGroundRings(house, neighbors) {
  const icon = house.meshes.filter(mesh => /^ground-wall-\d+$/.test(mesh.id))
    .map(mesh => mesh.vertices[0].slice(0, 2));
  const floryda = neighbors.houses.find(model => model.parcel === '190')
    ?.meshes.find(mesh => mesh.id === 'ground-storey');
  const minimum = floryda ? Math.min(...floryda.vertices.map(point => point[2])) : 0;
  return [{parcel: '193', ring: icon}, ...(floryda ? [{parcel: '190', ring: floryda.vertices
    .filter(point => Math.abs(point[2] - minimum) < 1e-6).map(point => point.slice(0, 2))}] : [])];
}

function groundRingContains(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function groundSurfaceGeometry(THREE, {ring, holes = [], exclusions = []}) {
  const shape = new THREE.Shape(ring.map(point => new THREE.Vector2(...point)));
  const interiorHoles = exclusions.filter(hole => hole.length >= 3 && hole.every(point => groundRingContains(point, ring)));
  shape.holes = [...holes, ...interiorHoles].map(hole => new THREE.Path(hole.map(point => new THREE.Vector2(...point))));
  return new THREE.ShapeGeometry(shape);
}

export function mapGroundGeometry(THREE, bounds, exclusions = []) {
  const [left, bottom, right, top] = bounds;
  const geometry = groundSurfaceGeometry(THREE, {ring: [[left,bottom],[right,bottom],[right,top],[left,top]], exclusions});
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) uv.setXY(i,
    (positions.getX(i) - left) / (right - left), (positions.getY(i) - bottom) / (top - bottom));
  return geometry;
}
