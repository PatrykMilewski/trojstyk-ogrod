function lawnRegion(rings, z=0) {
  const xs=rings[0].map(p=>p[0]), ys=rings[0].map(p=>p[1]);
  return {rings,z,minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys)};
}
function lawnRingDistance(ring,x,y) {
  let inside=false, min=Infinity;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [ax,ay]=ring[j], [bx,by]=ring[i], dx=bx-ax,dy=by-ay;
    if ((ay>y)!==(by>y)&&x<ax+dx*(y-ay)/dy) inside=!inside;
    const t=Math.min(1,Math.max(0,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
    min=Math.min(min,(ax+t*dx-x)**2+(ay+t*dy-y)**2);
  }
  return (inside?1:-1)*Math.sqrt(min);
}
function lawnContains(p,x,y,margin) {
  if (x<p.minX+margin||x>p.maxX-margin||y<p.minY+margin||y>p.maxY-margin) return false;
  return lawnRingDistance(p.rings[0],x,y)>=margin&&p.rings.slice(1).every(h=>lawnRingDistance(h,x,y)<=-margin);
}
function lawnTuft(THREE) {
  const positions=[],colors=[];
  for (let i=0;i<12;i++) {
    const angle=i*2.39996, r=.035*Math.sqrt(i/12), x=r*Math.cos(angle),y=r*Math.sin(angle);
    const a=angle*1.8,dx=Math.cos(a),dy=Math.sin(a),w=.0023+(i%3)*.0006;
    const height=.026+.017*(i%5)/4, lean=.008+(i%4)*.002;
    positions.push(x-dy*w,y+dx*w,0,x+dy*w,y-dx*w,0,x+lean*dx,y+lean*dy,height);
    const bottom=new THREE.Color(i%3?'#86975d':'#7b8f56'),tip=new THREE.Color(i%3?'#a4b777':'#aab881');
    colors.push(...bottom.toArray(),...bottom.toArray(),...tip.toArray());
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}
export function createLawnDetail(THREE,landscaping,neighbors,plot,interiorRings) {
  const group=new THREE.Group();
  group.name='lawn-blade-detail';
  const regions=geometry=>(geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates).filter(r=>r[0]?.length>=3).map(r=>lawnRegion(r));
  const blocked=interiorRings.map(p=>lawnRegion([p.ring]));
  const overlays=[];
  for (const p of landscaping.polygons) {
    const region=lawnRegion([p.ring,...(p.holes||[])],p.z+.01);
    if (['lawn','shared_boundary'].includes(p.kind)) overlays.push(region);
    else blocked.push(region);
  }
  for (const p of landscaping.objects) if (p.ring) blocked.push(lawnRegion([p.ring]));
  for (const p of landscaping.lines) if (p.kind==='safety') blocked.push(lawnRegion([p.points]));
  const footprints=[plot.house,plot.terrace,plot.entry,plot.driveway,neighbors.road,
    ...neighbors.surfaces.map(p=>p.geometry),...Object.values(neighbors.layouts).flatMap(p=>[p.reservation,p.terrace,p.driveway])];
  for (const footprint of footprints) if (footprint) blocked.push(...regions(footprint));
  const geometry=lawnTuft(THREE);
  const material=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const object=new THREE.Object3D();
  let seed=18673;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for (const [id,polygon] of Object.entries(neighbors.parcels)) {
    for (const parcel of regions(polygon)) {
      const samples=[];
      // Jittered 24 cm cells give each short specimen an independent root and orientation.
      for (let y=parcel.minY;y<parcel.maxY;y+=.24) for (let x=parcel.minX;x<parcel.maxX;x+=.24) {
        const px=x+rand()*.24,py=y+rand()*.24,scale=.78+rand()*.36,clearance=.061;
        if (rand()>.76+.13*Math.sin(px*1.3+Math.sin(py))+.08*Math.sin(py*1.7)) continue;
        if (!lawnContains(parcel,px,py,clearance)||blocked.some(p=>lawnContains(p,px,py,-clearance))) continue;
        if (landscaping.circles.some(p=>Math.hypot(px-p.center[0],py-p.center[1])<p.radius+clearance)) continue;
        let z=.001;
        for (const overlay of overlays) if (lawnContains(overlay,px,py,0)) z=Math.max(z,overlay.z+.001);
        samples.push([px,py,z,scale,rand()*Math.PI*2]);
      }
      if (!samples.length) continue;
      const mesh=new THREE.InstancedMesh(geometry,material,samples.length);
      mesh.name='lawn-tufts-'+id;
      samples.forEach(([x,y,z,scale,angle],i)=>{
        object.position.set(x,y,z);object.rotation.z=angle;object.scale.setScalar(scale);object.updateMatrix();
        mesh.setMatrixAt(i,object.matrix);
      });
      mesh.computeBoundingSphere();
      mesh.receiveShadow=true;
      group.add(mesh);
    }
  }
  return group;
}
