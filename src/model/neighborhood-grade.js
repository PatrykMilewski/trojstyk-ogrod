// Placement batches in this layer use the same east/north metre coordinates as the parcel survey.
function gradeInstances(mesh,terrain,followFence) {
  const transforms=mesh.instanceMatrix.array;
  for(let i=0;i<mesh.count;i++) {
    const k=i*16, x=transforms[k+12], y=transforms[k+13];
    transforms[k+14]+=terrain.z(x,y);
    if(followFence && Math.hypot(transforms[k],transforms[k+1])>.45) {
      const dx=transforms[k]/2,dy=transforms[k+1]/2;
      const a=terrain.z(x-dx,y-dy),b=terrain.z(x+dx,y+dy);
      transforms[k+2]+=b-a;
      transforms[k+14]+=(a+b)/2-terrain.z(x,y);
    }
  }
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
}

function gradeVertices(mesh,terrain) {
  const pos=mesh.geometry.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setZ(i,pos.getZ(i)+terrain.z(pos.getX(i),pos.getY(i)));
  pos.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
}

function gradeGround(mesh,terrain) {
  const original=mesh.geometry;
  mesh.geometry=terrain.drape(original);
  if(mesh.geometry!==original) original.dispose();
}

function gradeLine(THREE,line,terrain) {
  const pos=line.geometry.attributes.position, points=[];
  const stride=line.isLineSegments?2:1;
  for(let i=0;i<pos.count-1;i+=stride) {
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),j=i+1;
    const dx=pos.getX(j)-x,dy=pos.getY(j)-y,dz=pos.getZ(j)-z;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/1.5));
    for(let s=0;s<=steps;s++) {
      if(!line.isLineSegments && s===0 && i>0) continue;
      const f=s/steps,px=x+f*dx,py=y+f*dy;
      const point=new THREE.Vector3(px,py,z+f*dz+terrain.z(px,py));
      points.push(point);
      if(line.isLineSegments && s>0 && s<steps) points.push(point);
    }
  }
  const original=line.geometry;
  line.geometry=new THREE.BufferGeometry().setFromPoints(points);
  if(line.material.isLineDashedMaterial) line.computeLineDistances();
  original.dispose();
}

function gradeCrops(group,terrain) {
  group.traverse(mesh=>{
    if(mesh.isInstancedMesh) gradeInstances(mesh,terrain,false);
    else if(mesh.isMesh) gradeGround(mesh,terrain);
  });
}

function gradeSurvey(THREE,neighborhood,terrain) {
  for(const mesh of neighborhood.group.children) {
    if(mesh.isLine) gradeLine(THREE,mesh,terrain);
    else if(mesh.userData.parcel) mesh.position.z+=terrain.padZ(mesh.name);
    else if(mesh.isInstancedMesh) gradeInstances(mesh,terrain,mesh.name.endsWith('płoty'));
    else if(mesh.isMesh) gradeVertices(mesh,terrain);
  }
}

function gradeFutureGroup(future,terrain) {
  const fences=future.group.getObjectByName('Projektowane ogrodzenia');
  fences.traverse(mesh=>{
    if(mesh.isInstancedMesh) gradeInstances(mesh,terrain,true);
    else if(mesh.isMesh) gradeVertices(mesh,terrain);
  });
  for(const branch of future.group.children) {
    if(branch===fences) continue;
    branch.traverse(mesh=>{
      if(mesh.isInstancedMesh) gradeInstances(mesh,terrain,false);
      else if(mesh.isMesh) gradeGround(mesh,terrain);
    });
  }
}

export function gradeNeighborhood({THREE,scene,terrain,future,neighborhood,surroundings,futureCrops}) {
  gradeSurvey(THREE,neighborhood,terrain);
  gradeFutureGroup(future,terrain);
  gradeCrops(surroundings.crops,terrain);
  gradeCrops(futureCrops,terrain);
  for(const name of ['context-grass-41','context-soil-41','surface-road']) {
    const mesh=scene.getObjectByName(name);
    if(mesh) gradeGround(mesh,terrain);
  }
  const existing=scene.getObjectByName('context-building-41');
  if(existing) {
    const center=new THREE.Box3().setFromObject(existing).getCenter(new THREE.Vector3());
    existing.position.z+=terrain.z(center.x,center.y);
  }
  for(const obj of scene.children) {
    if(obj.isLine && !obj.name && obj.geometry.attributes.position) {
      const pos=obj.geometry.attributes.position;
      if(Array.from({length:pos.count},(_,i)=>terrain.z(pos.getX(i),pos.getY(i))).some(z=>z!==0))
        gradeLine(THREE,obj,terrain);
    }
    if(obj.name.startsWith('car-road-')) obj.position.z+=terrain.z(obj.position.x,obj.position.y);
  }
}

export function gradeFocus(camera,controls,terrain) {
  const offset=terrain.z(controls.target.x,controls.target.y);
  controls.target.z+=offset;camera.position.z+=offset;controls.update();
}
