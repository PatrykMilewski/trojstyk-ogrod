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

function grainSprayTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = seeded(465018);
  const bladeColors = ['#738947','#80954f','#93a65c','#849f51','#9aad64'];
  const earColors = ['#a0af69','#aebe78','#9fae62','#b5bf76','#9ba962'];
  function blade(x,y,dx,dy,width) {
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x + dx*.3 - width, y + dy*.6, x+dx, y+dy);
    ctx.quadraticCurveTo(x + dx*.34 + width, y + dy*.55, x,y);
    ctx.fillStyle=bladeColors[Math.floor(random()*bladeColors.length)];
    ctx.fill();
  }
  function ear(x,y,angle,size) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle); ctx.scale(size,size);
    ctx.strokeStyle='#a1ae69'; ctx.lineWidth=1.9;
    ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(0,-58); ctx.stroke();
    for (let i=0; i<12; i++) {
      const side=i%2 ? -1 : 1, v=-4.35*i;
      const w=side*(5.8 + 2.5*Math.sin(i*.27));
      ctx.fillStyle=earColors[Math.floor(random()*earColors.length)];
      ctx.beginPath(); ctx.moveTo(0,v+3);
      ctx.quadraticCurveTo(w*1.15,v-2,w,v-12);
      ctx.quadraticCurveTo(w*.16,v-10,0,v+3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w,v-11); ctx.lineTo(w*1.5,v-22); ctx.lineWidth=1; ctx.stroke();
    }
    ctx.restore();
  }
  for (let panel=0; panel<3; panel++) {
    ctx.save(); ctx.translate(panel*256,0);
    ctx.beginPath(); ctx.rect(2,1,252,511); ctx.clip();
    for (let i=0; i<11; i++) {
      const x=32+random()*182, bend=(random()-.47)*55;
      const tipY= i===10 ? 81 : 105+random()*128;
      const tipX=x+bend;
      ctx.strokeStyle=bladeColors[Math.floor(random()*bladeColors.length)];
      ctx.lineWidth=1.8+random()*1.7;
      ctx.beginPath(); ctx.moveTo(x,514);
      ctx.quadraticCurveTo(x-bend*.16,285,tipX,tipY); ctx.stroke();
      for (let j=0; j<4; j++) {
        const t=.14+j*.18;
        const bx=x+bend*(t*t-.32*t*(1-t));
        const by=(1-t)**2*514+2*(1-t)*t*285+t*t*tipY;
        blade(bx,by,(j%2 ? 1 : -1)*(21+random()*36),-(42+random()*51),3.5+random()*3);
      }
      ear(tipX,tipY,Math.atan2(bend*1.16,285-tipY),.83+random()*.26);
    }
    ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function grainGeometry(THREE) {
  const vertices=[], uv=[], indices=[];
  for (let i=0; i<3; i++) {
    const a=i*Math.PI/3, dx=.32*Math.cos(a), dy=.32*Math.sin(a);
    const offset=vertices.length/3, left=(256*i+.5)/1024, right=(256*i+255.5)/1024;
    vertices.push(-dx,-dy,0,dx,dy,0,dx,dy,1,-dx,-dy,1);
    uv.push(left,0,right,0,right,1,left,1);
    indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addGrain(THREE,group,data) {
  const points=cropPoints(data), dummy=new THREE.Object3D();
  const material=new THREE.MeshStandardMaterial({
    map:grainSprayTexture(THREE),side:THREE.DoubleSide,alphaTest:.20,roughness:1
  });
  const mesh=new THREE.InstancedMesh(grainGeometry(THREE),material,points.length);
  points.forEach(([x,y,h,angle],i)=>{
    dummy.position.set(x,y,data.crop.baseZ); dummy.rotation.set(0,0,angle);
    dummy.scale.set(1,1,h); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.name='growing-grain-clumps'; mesh.castShadow=false; mesh.receiveShadow=true;
  mesh.instanceMatrix.needsUpdate=true; mesh.computeBoundingSphere(); group.add(mesh);
  return points.length;
}

export function addSurroundingVegetation({ THREE, scene, data }) {
  const group = new THREE.Group(), crops = new THREE.Group(), trees = new THREE.Group();
  group.name='surrounding-vegetation'; crops.name='surrounding-grain'; trees.name='existing-trees-41';
  addFieldBases(THREE,crops,data);
  const grainClumps = addGrain(THREE,crops,data);
  addRealisticTrees(THREE,trees,data.trees,'existing-41');
  group.add(crops,trees); scene.add(group);
  const meta = {grainClumps, treeCount:data.trees.length, cropHeightRangeM:data.crop.heightRangeM,
    treeHeightRangeM:[Math.min(...data.trees.map(t=>t.height)),Math.max(...data.trees.map(t=>t.height))],
    positionsApproximate:true, heightsUserPrescribed:true};
  group.userData.dimensions = meta;
  return {group,crops,trees,meta,setCropsVisible:visible=>{crops.visible=visible;}};
}
