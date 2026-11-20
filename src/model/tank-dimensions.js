// Shortest plan distances use the surveyed parcel polygon in the same XY frame as the house.
function tankEdgeProjection(point,a,b) {
 const dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
 const t=length2?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length2)):0;
 return [a[0]+t*dx,a[1]+t*dy];
}

export function measureTankGaps(boundary,cover,radius,tankRing) {
 let lid,body;
 const project=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const considerBody=(a,b)=>{
  const length=project(a,b);
  if(!body||length<body.length)body={start:a,end:b,length};
 };
 for(let i=0;i<boundary.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length];
  const end=tankEdgeProjection(cover,a,b),distance=project(cover,end);
  if(!lid||distance-radius<lid.length){
   const start=cover.map((v,j)=>v+(end[j]-v)*radius/distance);
   lid={start,end,length:distance-radius};
  }
  for(let j=0;j<tankRing.length;j++){
   const corner=tankRing[j],next=tankRing[(j+1)%tankRing.length];
   considerBody(corner,tankEdgeProjection(corner,a,b));
   considerBody(tankEdgeProjection(a,corner,next),a);
  }
 }
 return [lid,body];
}

export function createTankDimensions193(THREE,boundary,footprint,cover,radius,tags) {
 const group=new THREE.Group();group.name='tank-boundary-dimensions-193';
 const measurements=measureTankGaps(boundary,cover,radius,footprint);
 const names=['BioDisc · pokrywa','Deszczówka · korpus'];
 for(const [i,{start,end,length}] of measurements.entries()){
  const z=.33,tick=.19,nx=-(end[1]-start[1])/length*tick,ny=(end[0]-start[0])/length*tick;
  const points=[[...start,z],[...end,z]];
  for(const [x,y] of [start,end])points.push([x-nx,y-ny,z],[x+nx,y+ny,z]);
  const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
  const rule=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x345b61,depthTest:false,depthWrite:false}));
  rule.renderOrder=241;group.add(rule);
  const el=document.createElement('a');
  el.className='tag tank-dimension';el.href='wymiary.html#odstepy-zbiornikow';el.target='_blank';el.rel='noopener';
  el.textContent=names[i]+' → granica '+length.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' m';
  el.title=i?'Odległość w modelu. Zobacz podstawę i warunki odprowadzania deszczówki.':'W koncepcji przyjęto minimum 2 m od pokrywy. Zobacz § 36 warunków technicznych.';
  el.hidden=true;document.body.append(el);
  tags.push({el,p:new THREE.Vector3((start[0]+end[0])/2,(start[1]+end[1])/2,z)});
 }
 return group;
}
