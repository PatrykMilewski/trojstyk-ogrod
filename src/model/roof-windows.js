const roofWindowEpsilon = 1e-8;
const roofWindowCross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const roofWindowMix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Centres in unmirrored catalogue metres, digitised from the mirrored attic plan.
const iconRoofWindowSchedule = [
  ['1.1', 'right', 7.15, 1.78],
  ['1.2', 'left', 1.04, 4.72],
  ['1.3', 'left', 1.04, 7.10],
  ['1.3', 'left', 1.04, 8.02],
  ['1.3', 'left', 1.04, 8.94],
  ['1.5', 'cross', 8.25, 5.66],
  ['1.6', 'cross', 10.47, 5.66],
  ['1.7', 'cross', 12.89, 5.66],
];

export function iconPlanPoint({matrix, translation, dimensions}, x, y, z) {
  const u = dimensions.width - x;
  return [
    translation[0] + matrix[0][0] * u + matrix[0][1] * y,
    translation[1] + matrix[1][0] * u + matrix[1][1] * y,
    z,
  ];
}

function iconRoofWindows(metadata) {
  const [[ux, vx], [uy, vy]] = metadata.matrix;
  const reverseFace = ux * vy - uy * vx > 0;
  const slope = (8.3 - 4.07) / 4.25;
  const widthM = .72, heightM = 1.48;
  const halfRun = heightM / Math.hypot(1, slope) / 2;
  return iconRoofWindowSchedule.map(([roomId, face, x, y], i) => {
    const vertices = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([along, across]) => {
      const u = x + (face === 'cross' ? along * widthM / 2 : across * halfRun);
      const v = y + (face === 'cross' ? across * halfRun : along * widthM / 2);
      const run = face === 'cross' ? v - 4.21 : face === 'left' ? u : 8.5 - u;
      return iconPlanPoint(metadata, u, v, 4.07 + run * slope + .045);
    });
    const number = i - iconRoofWindowSchedule.findIndex(([id]) => id === roomId) + 1;
    return {id: `icon-rooflight-${roomId}-${number}`, parcel: '193', roomId,
      localCenter: [x,y], widthM, heightM, vertices: reverseFace ? [vertices[0], ...vertices.slice(1).reverse()] : vertices};
  });
}

export function roofWindowOpenings(house, neighbors) {
  const openings = neighbors.houses.flatMap(model => model.meshes
    .filter(part => /rooflight/.test(part.id) && part.material === 'glass')
    .map(part => ({id: part.id, parcel: model.parcel, vertices: part.vertices.map(p => [...p])})));
  openings.push(...iconRoofWindows(house.metadata));
  return openings.map(opening => {
    const ring = opening.vertices.map(p => p.slice(0,2));
    const area = ring.reduce((sum,a,i) => {const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
    if (area < 0) ring.reverse();
    const lengths = opening.vertices.map((a,i) => Math.hypot(...a.map((v,k) => v-opening.vertices[(i+1)%4][k])));
    return {...opening,ring,center:opening.vertices[0].map((_,k)=>opening.vertices.reduce((sum,p)=>sum+p[k],0)/4),
      widthM:opening.widthM || Math.min(...lengths),heightM:opening.heightM || Math.max(...lengths)};
  });
}

function roofWindowHalfPlane(polygon, a, b, inside) {
  const result=[];
  for(let i=0;i<polygon.length;i++) {
    const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=roofWindowCross(a,b,p),dq=roofWindowCross(a,b,q);
    const pin=inside?dp>=-roofWindowEpsilon:dp<=roofWindowEpsilon;
    const qin=inside?dq>=-roofWindowEpsilon:dq<=roofWindowEpsilon;
    if(pin)result.push(p);
    if(pin!==qin)result.push(roofWindowMix(p,q,dp/(dp-dq)));
  }
  return result;
}

function roofWindowSubtract(polygon, ring) {
  let remainder=polygon;const outside=[];
  for(let i=0;i<ring.length&&remainder.length>=3;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],piece=roofWindowHalfPlane(remainder,a,b,false);
    if(piece.length>=3)outside.push(piece);
    remainder=roofWindowHalfPlane(remainder,a,b,true);
  }
  return outside;
}

export function cutRoofGeometry(THREE, geometry, openings, localToWorld) {
  const positions=geometry.attributes.position,index=geometry.index,triangles=[];
  const count=index?index.count:positions.count;
  for(let i=0;i<count;i+=3) {
    const triangle=[];
    for(let j=0;j<3;j++) {
      const point=new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j);
      if(localToWorld)point.applyMatrix4(localToWorld);
      triangle.push(point.toArray());
    }
    let pieces=[triangle];
    for(const opening of openings)pieces=pieces.flatMap(piece=>roofWindowSubtract(piece,opening.ring));
    for(const piece of pieces)for(let j=1;j<piece.length-1;j++)triangles.push(piece[0],piece[j],piece[j+1]);
  }
  const inverse=localToWorld?.clone().invert();
  const vertices=triangles.flatMap(p=>inverse?new THREE.Vector3(...p).applyMatrix4(inverse).toArray():p);
  const cut=new THREE.BufferGeometry();cut.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  cut.computeVertexNormals();return cut;
}

export function clipRoofSeam(points, openings) {
  const segments=[];
  for(let i=1;i<points.length;i++) {
    let pieces=[[points[i-1],points[i]]];
    for(const {ring} of openings)pieces=pieces.flatMap(([a,b])=>{
      let lo=0,hi=1;
      for(let j=0;j<ring.length;j++) {
        const da=roofWindowCross(ring[j],ring[(j+1)%ring.length],a),db=roofWindowCross(ring[j],ring[(j+1)%ring.length],b);
        if(da<0&&db<0)return [[a,b]];
        if(da<0)lo=Math.max(lo,da/(da-db));
        if(db<0)hi=Math.min(hi,da/(da-db));
      }
      if(lo>=hi)return [[a,b]];
      return [...(lo>0?[[a,roofWindowMix(a,b,lo)]]:[]),...(hi<1?[[roofWindowMix(a,b,hi),b]]:[])];
    });
    segments.push(...pieces);
  }
  return segments;
}

export function createRoofWindowGlazing(THREE, opening) {
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(opening.vertices.flat(),3));
  geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:'#92b4bf',transparent:true,opacity:.2,roughness:.12,metalness:0,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=opening.id;mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.userData={kind:'roof-window',parcel:opening.parcel,widthM:opening.widthM,heightM:opening.heightM,transmitsDirectSun:true};
  return mesh;
}
