import {neighborhoodDetails,streetRoofHeight} from './neighborhood-details.js';

function streetWalls(building) {
  const {vertices, boundaryEdges} = building.roof;
  if (building.design.type === 'pavilion' || building.volumeType === 'attached-cover') {
    return boundaryEdges.map(([i,j]) => [vertices[i],vertices[j],vertices[i][2]-.16,vertices[j][2]-.16]);
  }
  if (!building.roofPolygons) return boundaryEdges.map(([i,j]) => [vertices[i],vertices[j],0,0]);
  const strips = [];
  for (const rings of building.polygons) for (const ring of rings) {
    for (let i=1;i<ring.length;i++) {
      const a=ring[i-1], b=ring[i], dx=b[0]-a[0], dy=b[1]-a[1];
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.45));
      let prev=[...a,streetRoofHeight(building,a)];
      for (let n=1;n<=steps;n++) {
        const point=[a[0]+dx*n/steps,a[1]+dy*n/steps];
        const next=[...point,streetRoofHeight(building,point)];
        strips.push([prev,next,0,0]);
        prev=next;
      }
    }
  }
  return strips;
}

function neighborhoodSolid(THREE, building, materials) {
  const { vertices, triangles } = building.roof;
  const positions = [], colors = [], uvs = [];
  const [us, uo, vs, vo] = building.roofUV;
  const roof = new THREE.Color(0xffffff), wall = new THREE.Color(building.wallColor);
  function triangle(a, b, c, color) {
    positions.push(...a, ...b, ...c);
    for (const [x, y] of [a, b, c]) {
      colors.push(color.r, color.g, color.b);
      uvs.push(x * us + uo, y * vs + vo);
    }
  }
  for (const [a, b, c] of triangles) triangle(vertices[a], vertices[b], vertices[c], roof);
  const walls = streetWalls(building);
  for (const [a, b, lowA, lowB] of walls) {
    const baseA = [a[0], a[1], lowA], baseB = [b[0], b[1], lowB];
    triangle(a, baseA, baseB, wall);
    triangle(a, baseB, b, wall);
  }
  for (const [a,b,c,d] of building.roof.risers) {
    triangle(vertices[a],vertices[b],vertices[c],wall);
    triangle(vertices[a],vertices[c],vertices[d],wall);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.addGroup(0, triangles.length * 3, 0);
  geometry.addGroup(triangles.length * 3, (walls.length + building.roof.risers.length) * 6, 1);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = building.id;
  mesh.userData.parcel = building.parcel;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function addNeighborhood(THREE, scene, data, roofMap) {
  const group = new THREE.Group();
  group.name = 'Otoczenie trójstyku';
  const positions = [];
  for (const parcel of data.parcels) {
    if (parcel.existing) continue;
    for (const polygon of parcel.polygons) for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) positions.push(...ring[i - 1], .085, ...ring[i], .085);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: '#ebe4ce'}));
  lines.name = 'Granice działek EGiB';
  group.add(lines);
  const surface = {vertexColors: true, side: THREE.DoubleSide, roughness: .92};
  const materials = [new THREE.MeshStandardMaterial({...surface, map: roofMap}), new THREE.MeshStandardMaterial(surface)];
  const buildings = data.buildings.map(building => neighborhoodSolid(THREE, building, materials));
  group.add(...buildings);
  const openings = neighborhoodDetails(THREE, group, data);
  scene.add(group);
  return {group, buildings, data, openings, setBackground(background) {
    lines.material.color.set(background === 'ortho' ? '#ebe4ce' : '#806d57');
  }};
}

export function frameNeighborhood(THREE, camera, controls, bounds) {
  const [west, south, east, north] = bounds;
  const x = (west + east) / 2, y = (south + north) / 2;
  controls.target.set(x, y, 4);
  camera.position.set(x, y - 250, 400);
  controls.update();
  camera.updateMatrixWorld();
  let halfWidth = 0, halfHeight = 0;
  for (const px of [west, east]) for (const py of [south, north]) for (const z of [0, 15]) {
    const point = camera.worldToLocal(new THREE.Vector3(px, py, z));
    halfWidth = Math.max(halfWidth, Math.abs(point.x));
    halfHeight = Math.max(halfHeight, Math.abs(point.y));
  }
  camera.zoom = Math.min((camera.right - camera.left) / (2.12 * halfWidth),
    (camera.top - camera.bottom) / (2.12 * halfHeight));
  camera.updateProjectionMatrix();
}

export function focusNeighbor(camera, controls, building) {
  const points = (building.roofPolygons ?? building.polygons).flatMap(([ring]) => ring);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const width = Math.max(...xs)-Math.min(...xs), depth = Math.max(...ys)-Math.min(...ys);
  const x = Math.min(...xs)+width/2, y = Math.min(...ys)+depth/2;
  const bearing = (building.design.frontAz + 25) * Math.PI / 180;
  const distance = Math.max(18, Math.hypot(width, depth)*1.6);
  controls.target.set(x,y,2.4);
  camera.position.set(x+distance*Math.sin(bearing), y+distance*Math.cos(bearing), 2.4+distance*.37);
  camera.zoom = Math.min((camera.right-camera.left)/(Math.hypot(width,depth)+9), (camera.top-camera.bottom)/Math.max(20, 2*Math.max(...building.roof.vertices.map(v=>v[2])) + 2));
  camera.updateProjectionMatrix();
  controls.update();
}
