const iconStoryElevation=2.8,iconStoryEpsilon=1e-5;

function iconStoryCollectStoryMeshes(THREE,group){
 const records=[],xs=new Set(),ys=new Set();
 const eligible=name=>name.startsWith('facade-')||name.endsWith('-gable')||name==='upper-structure'||/^upper-(main-side|front-wing|rear-wing|garage-side|terrace-side)$/.test(name);
 group.updateMatrixWorld(true);
 const groupInverse=group.matrixWorld.clone().invert();
 group.traverse(mesh=>{
  if(!mesh.isMesh||!eligible(mesh.name))return;
  const geometry=mesh.geometry,position=geometry.getAttribute('position'),index=geometry.index;
  const matrix=new THREE.Matrix4().multiplyMatrices(groupInverse,mesh.matrixWorld);
  const record={mesh,geometry,matrix,inverse:matrix.clone().invert(),kept:[],caps:[],output:[],groups:[]};
  const count=index?index.count:position.count;
  for(let offset=0;offset<count;offset+=3){
   const indices=[0,1,2].map(i=>index?index.getX(offset+i):offset+i);
   const points=indices.map(i=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix));
   const material=geometry.groups.find(g=>offset>=g.start&&offset<g.start+g.count)?.materialIndex??0;
   const triangle={indices,points,material,record};
   if(points.every(p=>Math.abs(p.z-iconStoryElevation)<iconStoryEpsilon)){
    triangle.side=mesh.name.startsWith('facade-')?'below':'above';
    record.caps.push(triangle);
    for(const p of points){xs.add(Math.round(p.x/iconStoryEpsilon)*iconStoryEpsilon);ys.add(Math.round(p.y/iconStoryEpsilon)*iconStoryEpsilon);}
   }else record.kept.push(triangle);
  }
  if(record.caps.length)records.push(record);
 });
 return {records,xs,ys};
}

const iconStoryContains=(triangle,x,y)=>{
  const [a,b,c]=triangle.points;
  if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<1e-10)return false;
  const cross=(p,q)=>(q.x-p.x)*(y-p.y)-(q.y-p.y)*(x-p.x);
  const values=[cross(a,b),cross(b,c),cross(c,a)];
  return values.every(v=>v>=-1e-9)||values.every(v=>v<=1e-9);
 };
 const iconStoryBarycentric=(p,[a,b,c])=>{
  const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/denominator;
  const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/denominator;
  return [u,v,1-u-v];
 };
 const iconStoryEmit=(record,triangle,points)=>{
  const start=record.output.length;
  record.output.push(...points.map(point=>({point,triangle})));
  const last=record.groups.at(-1);
  if(last&&last.materialIndex===triangle.material)last.count+=3;
  else record.groups.push({start,count:3,materialIndex:triangle.material});
 };
 function iconStoryEmitBoundaryCells(THREE,records,xs,ys){
 const triangles=records.flatMap(r=>r.caps);
 for(const record of records)for(const triangle of record.kept)iconStoryEmit(record,triangle,triangle.points);
 const sortedX=[...xs].sort((a,b)=>a-b),sortedY=[...ys].sort((a,b)=>a-b);
 for(let i=1;i<sortedX.length;i++)for(let j=1;j<sortedY.length;j++){
  const x0=sortedX[i-1],x1=sortedX[i],y0=sortedY[j-1],y1=sortedY[j];
  const covering=triangles.filter(t=>iconStoryContains(t,(x0+x1)/2,(y0+y1)/2));
  const below=covering.find(t=>t.side==='below'),above=covering.find(t=>t.side==='above');
  if(Boolean(below)===Boolean(above))continue;
  const owner=below??above;
  const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>new THREE.Vector3(x,y,iconStoryElevation));
  const indices=below?[0,1,2,0,2,3]:[0,2,1,0,3,2];
  for(let k=0;k<6;k+=3)iconStoryEmit(owner.record,owner,indices.slice(k,k+3).map(n=>corners[n]));
 }
}

function iconStoryRebuildStoryMesh(THREE,record){
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(record.geometry.attributes)){
   const values=[];
   for(const {point,triangle} of record.output){
    const weights=iconStoryBarycentric(point,triangle.points);
    if(name==='position')values.push(...point.clone().applyMatrix4(record.inverse).toArray());
    else if(name==='normal'&&triangle.side){
     const normal=new THREE.Vector3(0,0,triangle.side==='below'?1:-1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(record.inverse)).normalize();
     values.push(...normal.toArray());
    }else{
     // Original vertices retain their attributes, including vertical triangles.
     const original=triangle.points.findIndex(p=>p.distanceToSquared(point)<1e-16);
     for(let component=0;component<attribute.itemSize;component++){
      const read=i=>attribute.getComponent(i,component);
      values.push(original>=0?read(triangle.indices[original]):weights.reduce((sum,w,k)=>sum+w*read(triangle.indices[k]),0));
     }
    }
   }
   geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize,attribute.normalized));
  }
  for(const g of record.groups)geometry.addGroup(g.start,g.count,g.materialIndex);
  record.mesh.geometry=geometry;
  record.geometry.dispose();
}

/** Remove buried storey interfaces while retaining exposed wall ledges and soffits. */
export function joinIconStorySurfaces(THREE,group){
 const {records,xs,ys}=iconStoryCollectStoryMeshes(THREE,group);
 iconStoryEmitBoundaryCells(THREE,records,xs,ys);
 for(const record of records)iconStoryRebuildStoryMesh(THREE,record);
 return group;
}
