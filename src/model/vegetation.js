function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function insideRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) &&
        x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function cropPoints(data) {
  const random = seeded(413192), points = [];
  for (const field of data.fields) {
    const rings = field.geometry.coordinates;
    const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
    const spacing = data.crop.spacingM;
    for (let x = Math.min(...xs); x < Math.max(...xs); x += spacing) {
      for (let y = Math.min(...ys); y < Math.max(...ys); y += spacing) {
        const px = x + (random() - 0.5) * spacing * 0.55;
        const py = y + (random() - 0.5) * spacing * 0.55;
        if (!insideRing(px, py, rings[0]) || rings.slice(1).some(r => insideRing(px, py, r))) continue;
        points.push([px, py, 0.8 + random() * 0.2, random() * Math.PI * 2]);
      }
    }
  }
  return points;
}

function cropTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d'), random = seeded(173);
  ctx.fillStyle = '#73834d'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1800; i++) {
    ctx.strokeStyle = i % 3 ? '#647744' : '#8e9c62';
    const x = random() * 128, y = random() * 128;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y + 5); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addFieldBases(THREE, group, data) {
  const texture = cropTexture(THREE);
  const material = new THREE.MeshStandardMaterial({ color: 0xa2b17c, map: texture, roughness: 1 });
  for (const field of data.fields) {
    const rings = field.geometry.coordinates;
    const shape = new THREE.Shape(rings[0].map(p => new THREE.Vector2(...p)));
    for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(...p))));
    const geometry = new THREE.ShapeGeometry(shape);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 7, uv.getY(i) / 7);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = field.id; mesh.position.z = data.crop.baseZ;
    mesh.receiveShadow = true; group.add(mesh);
  }
}

function grainGeometry(THREE) {
  const vertices = [];
  const quad = (a,b,c,d) => vertices.push(...a,...b,...c,...a,...c,...d);
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.39996, x = Math.cos(angle) * 0.17, y = Math.sin(angle) * 0.17;
    const top = 0.78 + i * 0.035, w = 0.012;
    quad([x-w,y,0],[x+w,y,0],[x+0.07+w,y,top],[x+0.07-w,y,top]);
    quad([x,y-w,0],[x,y+w,0],[x+0.07,y+w,top],[x+0.07,y-w,top]);
    quad([x+0.04,y,top-0.03],[x+0.1,y,top-0.03],[x+0.085,y,1],[x+0.055,y,1]);
    quad([x+0.07,y-0.03,top-0.03],[x+0.07,y+0.03,top-0.03],[x+0.07,y+0.015,1],[x+0.07,y-0.015,1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}

function addGrain(THREE, group, data) {
  const points = cropPoints(data), dummy = new THREE.Object3D();
  const material = new THREE.MeshStandardMaterial({color: 0x899c58, roughness: 1, side: THREE.DoubleSide});
  const mesh = new THREE.InstancedMesh(grainGeometry(THREE), material, points.length);
  points.forEach(([x,y,h,angle],i) => {
    dummy.position.set(x,y,data.crop.baseZ); dummy.rotation.set(0,0,angle);
    dummy.scale.set(1,1,h); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.name = 'growing-grain-clumps'; mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); group.add(mesh);
  return points.length;
}

function addTreeInstances(THREE, group, trees) {
  const trunkGeometry = new THREE.CylinderGeometry(0.17,0.27,1,7);
  trunkGeometry.rotateX(Math.PI / 2);
  const trunk = new THREE.InstancedMesh(trunkGeometry,
    new THREE.MeshStandardMaterial({color: 0x675442, roughness: 1}), trees.length);
  const crownGeometry = new THREE.IcosahedronGeometry(1,2);
  crownGeometry.computeBoundingBox();
  const bounds = crownGeometry.boundingBox;
  crownGeometry.scale(1 / bounds.max.x,1 / bounds.max.y,1 / bounds.max.z);
  const crowns = new THREE.InstancedMesh(crownGeometry,
    new THREE.MeshStandardMaterial({color:0xffffff, roughness:1}), trees.length * 7);
  const dummy = new THREE.Object3D(), color = new THREE.Color(), random = seeded(41911);
  trees.forEach((tree,i) => {
    const [x,y] = tree.center, h = tree.height, r = tree.crownRadius;
    dummy.position.set(x,y,h * 0.25); dummy.rotation.set(0,0,0);
    dummy.scale.set(1,1,h * 0.5); dummy.updateMatrix(); trunk.setMatrixAt(i,dummy.matrix);
    for (let j = 0; j < 7; j++) {
      const angle = j * Math.PI / 3, offset = j === 0 ? 0 : r * 0.43;
      const radius = j === 0 ? r * 0.68 : r * 0.57;
      const zRadius = j === 0 ? h * 0.30 : h * (0.18 + random() * 0.04);
      const centerZ = j === 0 ? h - zRadius : h * (0.60 + random() * 0.08);
      dummy.position.set(x + Math.cos(angle)*offset,y + Math.sin(angle)*offset,centerZ);
      dummy.scale.set(radius,radius,zRadius); dummy.updateMatrix();
      crowns.setMatrixAt(i*7+j,dummy.matrix);
      color.setHSL(0.22 + random()*0.045,0.26 + random()*0.12,0.22 + random()*0.07);
      crowns.setColorAt(i*7+j,color);
    }
  });
  trunk.name='existing-41-trunks'; crowns.name='existing-41-deciduous-crowns';
  for (const mesh of [trunk,crowns]) {
    mesh.castShadow=true; mesh.receiveShadow=true; mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere(); group.add(mesh);
  }
}

export function addSurroundingVegetation({ THREE, scene, data }) {
  const group = new THREE.Group(), crops = new THREE.Group(), trees = new THREE.Group();
  group.name='surrounding-vegetation'; crops.name='surrounding-grain'; trees.name='existing-trees-41';
  addFieldBases(THREE,crops,data);
  const grainClumps = addGrain(THREE,crops,data);
  addTreeInstances(THREE,trees,data.trees);
  group.add(crops,trees); scene.add(group);
  const meta = {grainClumps, treeCount:data.trees.length, cropHeightRangeM:data.crop.heightRangeM,
    treeHeightRangeM:[Math.min(...data.trees.map(t=>t.height)),Math.max(...data.trees.map(t=>t.height))],
    positionsApproximate:true, heightsUserPrescribed:true};
  group.userData.dimensions = meta;
  return {group,crops,trees,meta,setCropsVisible:visible=>{crops.visible=visible;}};
}
