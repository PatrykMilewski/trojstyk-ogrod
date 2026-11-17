// Plant specimens are built once in metre units and instanced throughout the beds.
function specimen(THREE, species) {
  const points = [], indices = [], colors = [];
  const tint = new THREE.Color();
  function face(vertices, triangles, color) {
    const start = points.length / 3;
    tint.set(color);
    for (const vertex of vertices) {
      points.push(...vertex);
      colors.push(tint.r, tint.g, tint.b);
    }
    for (const index of triangles) indices.push(start + index);
  }
  function leaf(base, angle, reach, rise, tipHeight, width, color) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const at = (t, w, h) => [base[0]+dx*t-dy*w, base[1]+dy*t+dx*w, base[2]+h];
    face([base, at(reach*.42, width, rise), at(reach*.42, 0, rise+.018),
      at(reach*.42, -width, rise), at(reach, 0, tipHeight)],
      [0,1,2, 0,2,3, 1,4,2, 2,4,3], color);
  }
  function spike(x, y, z, radius, height, color) {
    const vertices = [[x,y,z], [x+.009,y,z+height]];
    const faces = [];
    for (let k=0; k<5; k++) {
      const a = k*Math.PI*2/5;
      vertices.push([x+radius*Math.cos(a),y+radius*Math.sin(a),z+height*.42]);
      faces.push(0,2+k,2+(k+1)%5, 1,2+(k+1)%5,2+k);
    }
    face(vertices,faces,color);
  }
  function stem(x,y,h) {
    face([[x-.006,y,0],[x+.006,y,0],[x+.004,y,h],[x-.004,y,h],
      [x,y-.006,0],[x,y+.006,0],[x,y+.004,h],[x,y-.004,h]],
      [0,1,2,0,2,3,4,5,6,4,6,7], '#798151');
  }
  const golden = 2.39996;
  if (species==='grass') {
    for (let i=0; i<34; i++) {
      const t = ((i*13)%34)/34;
      leaf([0,0,0],i*golden,.10+.32*t,.38+.18*(1-t),.82-.59*t,.009+.007*t,
        ['#708043','#889755','#a4a966','#65773e'][i%4]);
    }
    for (let i=0; i<9; i++) {
      const x=.16*Math.cos(i*golden), y=.16*Math.sin(i*golden), h=.78+.17*Math.sin(i*7);
      stem(x,y,h);
      for (let k=0; k<13; k++) {
        const a=k*golden, extent=.05*(1-k/15);
        leaf([x,y,h+k*.012],a,extent,.037,.085,.009,['#b6a170','#cdba85','#daca9a'][k%3]);
      }
    }
  } else if (species==='shrub') {
    for (let i=0; i<29; i++) {
      const a=i*golden, r=.15*Math.sqrt(i/29);
      leaf([r*Math.cos(a),r*Math.sin(a),.045],a,.12+.065*(i%4)/3,.10,.045,.035,
        ['#48683d','#627d48','#6f854f'][i%3]);
    }
    for (let i=0; i<19; i++) {
      const a=i*golden, r=.26*Math.sqrt(i/19), x=r*Math.cos(a), y=r*Math.sin(a), h=.52-r*.86+.043*Math.sin(7*i);
      stem(x,y,h);
      for (let k=0; k<11; k++) {
        leaf([x,y,h-.26+k*.024],a+k*golden,.08+.04*Math.sin(k*2+i),.045+.02*Math.sin(i+k),.038,.033,
          ['#526c42','#678452','#809461','#597851'][((i+k)%4)]);
      }
    }
  } else {
    for (let i=0; i<16; i++) {
      leaf([0,0,.015],i*golden,.23+.045*Math.sin(i),.12,.11+.09*Math.cos(i),.032,
        ['#597b55','#75915e','#80946e'][i%3]);
    }
    for (let i=0; i<7; i++) {
      const a=i*golden, x=.16*Math.cos(a), y=.16*Math.sin(a), h=.45+.09*Math.cos(i*4);
      stem(x,y,h);
      for (let k=0; k<3; k++) leaf([x,y,.12+k*.08],a+k*golden,.115,.038,.06,.02,'#6c895b');
      if (species==='salvia') {
        for (let k=0;k<7;k++) spike(x,y,h+k*.025,.027-k*.002,.048,['#675079','#87689e','#b395bd'][k%3]);
      } else {
        for (let k=0;k<10;k++) leaf([x,y,h],k*Math.PI/5,.081,.013,-.026,.018,
          species==='achillea'?'#eadfbd':['#c98d98','#c67e91','#df9fad'][k%3]);
        spike(x,y,h-.008,.029,.043,species==='achillea'?'#cfa451':'#965d35');
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Signed clearance against every edge keeps the full crown within the intended surface.
function clearance(x,y,ring) {
  let within=false, nearest=Infinity;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [ax,ay]=ring[j], [bx,by]=ring[i], dx=bx-ax, dy=by-ay;
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) within=!within;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy || 1)));
    nearest=Math.min(nearest,(x-ax-t*dx)**2+(y-ay-t*dy)**2);
  }
  return (within?1:-1)*Math.sqrt(nearest);
}
function surfaceClearance(x,y,{ring,holes=[]}) {
  let gap=clearance(x,y,ring);
  for (const hole of holes) gap=Math.min(gap,-clearance(x,y,hole));
  return gap;
}
export function createGardenPlantings(THREE, landscaping, interiorRings, hardscapes) {
  const group=new THREE.Group();
  group.name='garden-plantings';
  const obstacles=[
    ...interiorRings,...landscaping.objects.filter(o=>o.ring),
    ...landscaping.polygons.filter(p=>!['planting','shared_boundary','lawn'].includes(p.kind)),
    ...landscaping.lines.filter(l=>l.kind==='safety').map(l=>({ring:l.points})),
  ];
  for (const geometry of hardscapes) {
    for (const [ring,...holes] of geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates)
      obstacles.push({ring,holes});
  }
  const species=['grass','salvia','shrub','coneflower','achillea'];
  const locations=Object.fromEntries(species.map(name=>[name,[]]));
  let seed=1771;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for (const bed of landscaping.polygons.filter(p=>p.kind==='planting')) {
    const xs=bed.ring.map(p=>p[0]), ys=bed.ring.map(p=>p[1]);
    const maxX=Math.max(...xs), maxY=Math.max(...ys), phase=random()*6.28;
    for (let row=Math.min(...ys)+.24;row<maxY;row+=.72) {
      for (let col=Math.min(...xs)+.22;col<maxX;col+=.74) {
        const x=col+(random()-.5)*.25, y=row+(random()-.5)*.25;
        const drift=Math.sin(x*1.1+phase)+Math.sin(y*.84-phase)+.32*(random()-.5);
        const name=drift<-.95?'shrub':drift<-.37?'coneflower':drift<.15?'salvia':drift<.5?'achillea':'grass';
        const radius=name==='grass'?.43:name==='shrub'?.39:.28;
        const scale=Math.min(.88+random()*.24,(surfaceClearance(x,y,bed)-.02)/radius);
        if (scale<.58 || obstacles.some(p=>surfaceClearance(x,y,p)>-radius*scale-.03)) continue;
        if (landscaping.circles.some(p=>Math.hypot(x-p.center[0],y-p.center[1])<p.radius+radius*scale)) continue;
        locations[name].push([x,y,bed.z+.012,scale,random()*Math.PI*2]);
      }
    }
  }
  const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.92});
  const transform=new THREE.Object3D();
  for (const name of species) {
    const placements=locations[name];
    if (!placements.length) continue;
    const mesh=new THREE.InstancedMesh(specimen(THREE,name),material,placements.length);
    mesh.name='garden-'+name;
    placements.forEach(([x,y,z,scale,angle],index)=>{
      transform.position.set(x,y,z);
      transform.rotation.z=angle;
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index,transform.matrix);
    });
    mesh.computeBoundingSphere();
    mesh.receiveShadow=true;
    mesh.castShadow=true;
    group.add(mesh);
  }
  return group;
}
