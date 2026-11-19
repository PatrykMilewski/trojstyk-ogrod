export function addIconInterior(options) {
 const context = iconInteriorSetup(options);
 iconInteriorFloorsAndPartitions(context);
 iconInteriorFacades(context);
 iconInteriorCurtains(context);
 iconInteriorStairs(context);
 iconInteriorOfficeBacking(context);
 iconInteriorFurnishings(context);
 options.fitGarage?.(context);
 const projector=iconLivingProjector(context);
 const appliances=iconApplianceControls(context);
 iconLivingWallSconce(context);
 iconLivingMediaAccessories(context);
 iconInteriorLightingAndRoof(context);
 iconMoodEntryBathFinishes(context);
 if(context.data.electrical)iconLoftElectrical(context);
 options.joinStory?.(options.THREE,context.group);
 const updateHallDoors=iconHallDoorMotion(context);
 const {group,navigation,data,world} = context;
 return {group,navigation,rooms:data.rooms,metadata:data.metadata,localToWorld:world,updateHallDoors,projector,appliances};
}

const iconInteriorContains = (p,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};

const iconGroundFacadeDepth=facade=>facade?.thickness??.48;

function iconInteriorSetup({THREE,scene,house,data,cutRoof=geometry=>geometry}) {
 const group = new THREE.Group(); group.name = 'icon-193-interior';
 const md = house.metadata, M = md.matrix, t = md.translation;
 group.matrixAutoUpdate = false;
 group.matrix.set(-M[0][0],M[0][1],0,M[0][0]*14.64+t[0],-M[1][0],M[1][1],0,M[1][0]*14.64+t[1],0,0,1,0,0,0,0,1);
 scene.add(group);
 const world = p => [M[0][0]*(14.64-p[0])+M[0][1]*p[1]+t[0],M[1][0]*(14.64-p[0])+M[1][1]*p[1]+t[1],p[2]||0];
 const ring = b => [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]];
 const navigation = {obstacles:[],floors:[],ramps:[],entry:world([data.entry.position[0],data.entry.position[1]+.59,0]),entryDirection:[M[0][1],M[1][1]]};
 const material = (color,extra={}) => new THREE.MeshStandardMaterial({color,roughness:.78,side:THREE.DoubleSide,...extra});
 const mats = {wall:material('#e9e3d7'),ceiling:material('#ede8de'),oak:material('#b4936e'),tile:material('#bfb9ac'),dark:material('#343b35'),wood:material('#8a684b'),linen:material('#d9d0bd'),sofa:material('#c2bda9'),counter:material('#d1c8b7'),white:material('#f1ede5'),metal:material('#2f3534',{metalness:.45,roughness:.35}),glass:material('#b9d1ce',{transparent:true,opacity:.16,depthWrite:false,roughness:.08}),rug:material('#a99e86'),lamp:material('#fff0cd',{emissive:'#ffdf99',emissiveIntensity:.7})};
 mats.coral=material('#c77d59',{name:'Hall terracotta mineral paint',roughness:.93});
 mats.pantry=material('#e7d4a8',{name:'Pantry pale straw mineral paint',roughness:.92});
 mats.garage=material('#abb8a6',{name:'Garage sage mineral paint',roughness:.92});
 mats.garageCeiling=material('#d3dbcd',{name:'Garage pale sage ceiling',roughness:.92});
 for(const paint of [mats.pantry,mats.garage,mats.garageCeiling])paint.userData.surfaceProfile='plaster';
 const mesh = (geometry,mat,name) => {const m=new THREE.Mesh(geometry,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const box = (name,b,z,h,mat=mats.wood) => {const m=mesh(new THREE.BoxGeometry(b[2]-b[0],b[3]-b[1],h),mat,name);m.position.set((b[0]+b[2])/2,(b[1]+b[3])/2,z+h/2);return m;};
 const obstacle = (id,b,minZ,maxZ,cover) => navigation.obstacles.push({id,ring:ring(b).map(p=>world(p).slice(0,2)),minZ,maxZ,cover});
 const floor = (id,b,z) => navigation.floors.push({id,ring:ring(b).map(p=>world(p).slice(0,2)),z});
 const path = points => new THREE.Path(points.map(p=>new THREE.Vector2(...p)));
 const slab = (id,outline,holes,z,depth,mat) => {const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));shape.holes=holes.map(path);const m=mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat,id);m.position.z=z;return m;};
 const beamInstances=new Map();
 const beam = (id,a,b,r=.025,mat=mats.metal) => {const key=[a.map(n=>n.toFixed(6)).join(','),b.map(n=>n.toFixed(6)).join(',')].sort().join('|')+'|'+r+'|'+mat.uuid;if(beamInstances.has(key))return beamInstances.get(key);const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat,id);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());beamInstances.set(key,m);return m;};
 const rail = (id,a,b,z,frame,endPost=true) => {
  beam(id+'-top',[...a,z+1.05],[...b,z+1.05],.025,frame);
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(length/1.15));
  const point=i=>a.map((v,k)=>v+(b[k]-v)*i/count);
  for(let i=0;i<=count;i++){
   const p=point(i);
   if(i<count||endPost)beam(id+'-post-'+i,[...p,z],[...p,z+1.05],.017,frame);
   if(i<count){
    const end=point(i+1);
    const bounds=[0,1].map(k=>Math.min(p[k],end[k])+(p[k]===end[k]?-.005:.021))
     .concat([0,1].map(k=>Math.max(p[k],end[k])+(p[k]===end[k]?.005:-.021)));
    box(id+'-glass-'+i,bounds,z+.018,1.005,mats.glass).castShadow=false;
   }
  }
  const pad=(p,k)=>a[k]===b[k]?.025:p===b&&!endPost?0:.017;
  const min=a.map((v,k)=>Math.min(v-pad(a,k),b[k]-pad(b,k)));
  const max=a.map((v,k)=>Math.max(v+pad(a,k),b[k]+pad(b,k)));
  obstacle(id,[...min,...max],z,z+1.075);
 };
 const ceilingAt = (x,y) => {const slope=(8.3-4.07)/4.25;return Math.max(x<=8.5?8.3-slope*Math.abs(x-4.25):-Infinity,x>=4.25&&y>=4.21&&y<=12.71?8.3-slope*Math.abs(y-8.46):-Infinity)-.045;};
 const wall = (id,a,b,z0,z1,thickness,openings=[],profile=null,hallFace=null) => {
  const external=id.startsWith('facade-')||id.startsWith('upper-')||id.endsWith('-gable');
  const corners=external?[a,b].map(p=>{
   const turn=iconInteriorCorner(p,z0===0?data.exterior.ground:data.exterior.upper);
   if(!turn||z0!==0)return turn;
   const adjacent=data.facades.find(f=>f.id!==id&&[f.a,f.b].some(q=>q[0]===p[0]&&q[1]===p[1]));
   return turn*iconGroundFacadeDepth(adjacent)/thickness;
  }):[0,0];
  let nx=0,ny=0;if(external){if(Math.abs(a[0]-b[0])<.01)nx=a[0]<.1?-1:1;else ny=a[1]<5?-1:1;a=[a[0]-nx*thickness/2,a[1]-ny*thickness/2];b=[b[0]-nx*thickness/2,b[1]-ny*thickness/2];}
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const outer=profile||[[0,z0],[L,z0],[L,z1],[0,z1]],holes=openings.map(o=>o.wallPoly||o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]]);
  const paintedFrom=id==='facade-main-side'?data.rooms.find(r=>r.id==='0.4').box[1]:
   id==='upper-main-side'?data.void.box[1]:undefined;
  const finishes=external?[mats.wall,mats.dark]:hallFace?[mats.wall,mats.coral]:[mats.wall];
  if(paintedFrom!==undefined){
   mats.projectionPaint??=material('#ffffff',{roughness:1,name:'Matte white projection paint'});
   finishes.push(mats.projectionPaint);
  }
  const paintZones=iconServiceWallPaint(data,id,L).map(([side,from,to,room])=>{
   const index=finishes.push(mats[room])-1;
   return {side,from,to,index};
  });
  const geometry=iconInteriorWallGeometry(THREE,{a,ux,uy,L,z0,z1,thickness,outer,holes,ceilingAt,sloped:id.startsWith('u-'),external,nx,ny,corners,paintedFrom,hallFace,paintZones,flushDoors:openings.filter(o=>o.flush&&hallFace&&o.start>=hallFace.from&&o.end<=hallFace.to)});
  const wallMesh=mesh(geometry,finishes.length===1?finishes[0]:finishes,id);
  if(hallFace)wallMesh.userData.kind='hall-partition';
  const cuts=[0,L,...openings.flatMap(o=>[o.start,o.end])].sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){const start=cuts[i-1],end=cuts[i];if(end-start<.001)continue;const opening=openings.find(o=>(start+end)/2>o.start&&(start+end)/2<o.end);const ax=a[0]+ux*start,ay=a[1]+uy*start,bx=a[0]+ux*end,by=a[1]+uy*end,bounds=[Math.min(ax,bx)-Math.abs(uy)*thickness/2,Math.min(ay,by)-Math.abs(ux)*thickness/2,Math.max(ax,bx)+Math.abs(uy)*thickness/2,Math.max(ay,by)+Math.abs(ux)*thickness/2];
   if(!opening)obstacle(id+'-'+i,bounds,z0,z1);else{if(opening.bottom>z0+.01)obstacle(id+'-sill-'+i,bounds,z0,opening.bottom);if(opening.top<z1-.01)obstacle(id+'-header-'+i,bounds,opening.top,z1);}
  }
  for(const [i,o] of openings.entries()){
   const points=o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]],recess=o.recess||0,to3=p=>[a[0]+ux*p[0]-nx*recess,a[1]+uy*p[0]-ny*recess,p[1]];
   if(recess>thickness/2)iconInteriorWindowReveal({THREE,mesh,mats,id:id+'-reveal-'+i,points:o.wallPoly||points,to3,normal:[nx,ny],depth:recess-thickness/2});
   if(!o.flush)for(let j=0;j<points.length;j++)beam(id+'-opening-'+i+'-frame-'+j,to3(points[j]),to3(points[(j+1)%points.length]),.025,mats.dark);
   if(o.glass){
    const panes=o.panels??1;
    for(let pane=0;pane<panes;pane++){
     const left=o.start+(o.end-o.start)*pane/panes,right=o.start+(o.end-o.start)*(pane+1)/panes;
     const outline=panes===1?points:[[left,o.bottom],[right,o.bottom],[right,o.top],[left,o.top]];
     const glass=iconGlassGeometry(THREE,outline,to3);
     mesh(glass,mats.glass,id+'-glass-'+i+(panes===1?'':'-pane-'+pane)).castShadow=false;
     if(pane>0)beam(id+'-mullion-'+i+'-'+pane,to3([left,o.bottom]),to3([left,o.top]),.025,mats.dark);
    }
    const dividers=o.dividers??(panes===1&&o.end-o.start>2?[(o.start+o.end)/2]:[]);
    for(const u of dividers){
     const height=iconGlassHeadAt(points,u);
     const name=o.dividers?'garden-upper-triangle-mullion-'+u:id+'-mullion-'+i;
     beam(name,to3([u,o.bottom]),to3([u,height]),.025,mats.dark);
    }
    obstacle(id+'-glass-barrier-'+i,[Math.min(to3([o.start,0])[0],to3([o.end,0])[0])-.035,Math.min(to3([o.start,0])[1],to3([o.end,0])[1])-.035,Math.max(to3([o.start,0])[0],to3([o.end,0])[0])+.035,Math.max(to3([o.start,0])[1],to3([o.end,0])[1])+.035],o.bottom,o.top);
   }
  }
 };
 const opening = (start,end,bottom=0,top=2.35,glass=true) => ({start,end,bottom,top,glass});
 const contains = iconInteriorContains;
 return {THREE, scene, house, data, group, world, ring, navigation, mats, material, mesh, box, obstacle, floor, slab, beam, rail, wall, opening, contains, ceilingAt, cutRoof};
}

function iconGlassHeadAt(outline,u) {
 let head=-Infinity;
 for(let i=0;i<outline.length;i++){
  const [x,z]=outline[i],[nextX,nextZ]=outline[(i+1)%outline.length];
  if(x!==nextX&&u>=Math.min(x,nextX)&&u<=Math.max(x,nextX))
   head=Math.max(head,z+(nextZ-z)*(u-x)/(nextX-x));
 }
 return head;
}

function iconGlassGeometry(THREE,outline,to3) {
 const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
 const geometry=new THREE.ShapeGeometry(shape),positions=geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++)positions.setXYZ(i,...to3([positions.getX(i),positions.getY(i)]));
 geometry.computeVertexNormals();
 return geometry;
}

function iconInteriorCorner(point,ring) {
 const i=ring.findIndex(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<1e-7);
 if(i<0)return 0;
 const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];
 const turn=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
 // The entry has a separate jamb return. The stair-side terrace corner joins both wall faces directly.
 return turn>0?1:turn<0&&b[0]===8.5&&b[1]===12.71?-1:0;
}

function iconInteriorWindowReveal({THREE,mesh,mats,id,points,to3,normal,depth}) {
 const vertices=[];
 for(let i=0;i<points.length;i++) {
  const a=to3(points[i]),b=to3(points[(i+1)%points.length]);
  if(a[2]===points[0][1]&&b[2]===points[0][1])continue;
  const outside=p=>[p[0]+normal[0]*depth,p[1]+normal[1]*depth,p[2]];
  vertices.push(...a,...outside(a),...outside(b),...a,...outside(b),...b);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();mesh(geometry,mats.wall,id);
}

function iconServiceWallPaint(data,id,length) {
 const back=data.walls.find(w=>w.id==='garage-back');
 const divider=data.walls.find(w=>w.id==='pantry-technical');
 const kitchen=data.walls.find(w=>w.id==='kitchen-back');
 const pantryEnd=divider.a[0]-back.a[0],garageEnd=back.a[1];
 switch(id){
  case 'facade-garage':case 'facade-garage-side':return [[1,0,length,'garage']];
  case 'facade-main-side':return [[-1,0,garageEnd,'garage'],[-1,garageEnd,kitchen.a[1],'pantry']];
  case 'garage-hall':return [[1,0,garageEnd-data.walls.find(w=>w.id===id).a[1],'garage']];
  case 'garage-back':return [[-1,0,length,'garage'],[1,0,pantryEnd,'pantry']];
  case 'pantry-technical':return [[1,0,length,'pantry']];
  case 'kitchen-back':return [[-1,0,divider.a[0]-kitchen.a[0],'pantry']];
  default:return [];
 }
}

function iconInteriorWallGeometry(THREE,options) {
 const {a,ux,uy,L,z0,z1,thickness,outer,holes,ceilingAt,sloped,external,nx,ny,corners,paintedFrom=Infinity,hallFace,paintZones=[],flushDoors=[]}=options;
 const facesByMaterial=[],cuts=[0,L,...outer.map(p=>p[0]),...holes.flatMap(p=>p.map(v=>v[0]))];
 for(const zone of paintZones)cuts.push(zone.from,zone.to);
 if(paintedFrom<L)cuts.push(paintedFrom);
 if(hallFace)cuts.push(hallFace.from,hallFace.to);
 const point=(u,d,h)=>{
  const inset=external?thickness/2-(-uy*d*nx+ux*d*ny):0;
  const along=u<1e-8?corners[0]*inset:u>L-1e-8?L-corners[1]*inset:
   Math.max(Math.max(0,corners[0])*inset,Math.min(L-Math.max(0,corners[1])*inset,u));
  return [a[0]+ux*along-uy*d,a[1]+uy*along+ux*d,h];
 };
 const height=(u,d,h)=>{const roof=ceilingAt(...point(u,d,0).slice(0,2));if(sloped)return Math.min(h,roof);const inner=external&&z0===2.8&&(-uy*d*nx+ux*d*ny)<0,top=bounds(outer,u,Math.max(1e-7,Math.min(L-1e-7,u)))?.[1];return inner&&Math.abs(h-top)<1e-6?roof:h;};
 if(sloped||external&&z0===2.8)for(const d of [-thickness/2,thickness/2]){
  const [x,y]=point(0,d,0);
  for(const [offset,rate] of [[x-4.25,ux],[x-8.5,ux],[y-4.21,uy],[y-8.46,uy],[y-12.71,uy],[x-y+4.21,ux-uy],[x+y-12.71,ux+uy]])if(Math.abs(rate)>1e-9)cuts.push(-offset/rate);
 }
 const xs=[...new Set(cuts.filter(u=>u>=0&&u<=L))].sort((x,y)=>x-y);
 const bounds=(polygon,u,mid)=>{
  const edges=polygon.flatMap((p,i)=>{const q=polygon[(i+1)%polygon.length];if(p[0]!==q[0]&&mid>=Math.min(p[0],q[0])&&mid<=Math.max(p[0],q[0]))return [[p,q]];return [];});
  const heights=edges.map(([p,q])=>p[1]+(q[1]-p[1])*(u-p[0])/(q[0]-p[0]));return heights.length?[Math.min(...heights),Math.max(...heights)]:null;
 };
 const bands=(u,mid)=>{const base=bounds(outer,u,mid);if(!base)return [];const openings=holes.map(p=>bounds(p,u,mid)).filter(Boolean).sort((x,y)=>x[0]-y[0]);let bottom=base[0];const result=[];for(const o of openings){if(o[0]>bottom+1e-8)result.push([bottom,o[0]]);bottom=Math.max(bottom,o[1]);}if(base[1]>bottom+1e-8)result.push([bottom,base[1]]);return result;};
 const quad=(p,q,r,t,material=0)=>{(facesByMaterial[material]??=[]).push(...p,...q,...r,...p,...r,...t);};
 for(let i=1;i<xs.length;i++){
  const start=xs[i-1],end=xs[i];if(end-start<1e-8)continue;const mid=(start+end)/2,lo=bands(start,mid),hi=bands(end,mid);
  const interiorMaterial=mid>=paintedFrom?2:0;
  for(let j=0;j<lo.length;j++){
   for(const d of [-thickness/2,thickness/2]){
    const side=Math.sign(d),outside=external&&(-uy*d*nx+ux*d*ny)>0;
    const coral=hallFace&&side===hallFace.side&&mid>=hallFace.from&&mid<=hallFace.to;
    const zone=paintZones.find(p=>p.side===side&&mid>=p.from&&mid<=p.to);
    const finish=outside||coral?1:zone?.index??interiorMaterial;
    quad(point(start,d,height(start,d,lo[j][0])),point(end,d,height(end,d,hi[j][0])),point(end,d,height(end,d,hi[j][1])),point(start,d,height(start,d,lo[j][1])),finish);
   }
   for(const edge of [0,1]){const h0=lo[j][edge],h1=hi[j][edge];if(sloped&&edge===1&&h0===z1&&h1===z1)continue;quad(point(start,-thickness/2,height(start,-thickness/2,h0)),point(end,-thickness/2,height(end,-thickness/2,h1)),point(end,thickness/2,height(end,thickness/2,h1)),point(start,thickness/2,height(start,thickness/2,h0)),flushDoors.some(o=>mid>=o.start&&mid<=o.end&&h0===o.top)?1:interiorMaterial);}
  }
 }
 for(let i=0;i<xs.length;i++){
  if(i===0&&corners[0]||i===xs.length-1&&corners[1])continue;
  const u=xs[i],left=i?bands(u,(xs[i-1]+u)/2):[],right=i<xs.length-1?bands(u,(u+xs[i+1])/2):[],heights=[...new Set([...left.flat(),...right.flat()])].sort((x,y)=>x-y);
  for(let j=1;j<heights.length;j++){const bottom=heights[j-1],top=heights[j],mid=(bottom+top)/2,solid=band=>band.some(([lo,hi])=>mid>lo&&mid<hi);if(solid(left)===solid(right))continue;quad(point(u,-thickness/2,height(u,-thickness/2,bottom)),point(u,thickness/2,height(u,thickness/2,bottom)),point(u,thickness/2,height(u,thickness/2,top)),point(u,-thickness/2,height(u,-thickness/2,top)),flushDoors.some(o=>(u===o.start||u===o.end)&&mid<=o.top)?1:0);}
 }
 const geometry=new THREE.BufferGeometry(),vertices=[];
 facesByMaterial.forEach((faces,material)=>{
  geometry.addGroup(vertices.length/3,faces.length/3,material);
  vertices.push(...faces);
 });
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 return geometry;
}

function iconInteriorInsetSlab(outline,exterior,distance) {
 const onEdge=(p,a,b)=>Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-7&&p.every((v,k)=>v>=Math.min(a[k],b[k])-1e-7&&v<=Math.max(a[k],b[k])+1e-7);
 const edges=outline.map((a,i)=>{
  const b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const exteriorEdge=exterior.some((p,j)=>onEdge(a,p,exterior[(j+1)%exterior.length])&&onEdge(b,p,exterior[(j+1)%exterior.length]));
  const offset=exteriorEdge?[-dy/length*distance,dx/length*distance]:[0,0];
  return {a:a.map((v,k)=>v+offset[k]),direction:[dx,dy]};
 });
 return edges.map((edge,i)=>{
  const previous=edges[(i+edges.length-1)%edges.length],a=previous.a,b=edge.a,u=previous.direction,v=edge.direction,cross=u[0]*v[1]-u[1]*v[0];
  if(Math.abs(cross)<1e-8)return b;
  const t=((b[0]-a[0])*v[1]-(b[1]-a[1])*v[0])/cross;
  return [a[0]+t*u[0],a[1]+t*u[1]];
 });
}

function iconInteriorFloorsAndPartitions(context) {
 const {data, navigation, ring, world, floor, slab, mats, obstacle, wall, opening, contains} = context;
 slab('ground-floor',data.exterior.ground,[],-.12,.12,mats.oak);
 const stairHole=ring(data.stairs.box),livingHole=ring(data.void.box);
 const [west,,east,north]=data.rooms.find(room=>room.id==='0.5').box;
 const office=data.walls.find(w=>w.id==='guest-office'),screen=data.walls.find(w=>w.id==='vestibule-screen');
 const hall=data.walls.find(w=>w.id==='hall-front'),garage=data.walls.find(w=>w.id==='garage-hall');
 const screenY=screen.a[1]+screen.thickness/2,hallY=hall.a[1]+hall.thickness/2;
 const cornerX=screen.b[0],westX=garage.a[0]+garage.thickness/2,officeY=office.a[1]-office.thickness/2;
 const ceilingPlan=[[westX,screenY],[cornerX,screenY],[cornerX,hallY],[east,hallY],
  [east,officeY],[data.stairs.box[2],officeY],[data.stairs.box[2],north],
  [west,north],[west,garage.b[1]],[westX,garage.b[1]]];
 meshPaintedCeiling(context,'hall-terracotta-ceiling',ceilingPlan,mats.coral);
 const cabinetWall=data.walls.find(w=>w.id==='kitchen-back');
 const kitchenStart=cabinetWall.a[1]+cabinetWall.thickness/2;
 const kitchenWest=cabinetWall.a[0],voidStart=data.void.box[1],stairEdge=data.stairs.box[0];
 meshPaintedCeiling(context,'kitchen-terracotta-ceiling',[[kitchenWest,kitchenStart],[west,kitchenStart],[west,north],
  [stairEdge,north],[stairEdge,voidStart],[kitchenWest,voidStart]],mats.coral);
 const perimeterX=iconGroundFacadeDepth(data.facades.find(f=>f.id==='facade-main-side'));
 const garageSide=data.facades.find(f=>f.id==='facade-garage-side');
 const garageEast=garageSide.a[0]-iconGroundFacadeDepth(garageSide),jambEnd=garage.a[1];
 const dividerX=garage.a[0]-garage.thickness/2;
 const garageRoom=data.rooms.find(r=>r.id==='0.1'),pantry=data.rooms.find(r=>r.id==='0.2');
 const garageFront=iconGroundFacadeDepth(data.facades.find(f=>f.id==='facade-garage'));
 meshPaintedCeiling(context,'garage-painted-ceiling',[[perimeterX,garageFront],[garageEast,garageFront],
  [garageEast,jambEnd],[dividerX,jambEnd],[dividerX,garageRoom.box[3]],[perimeterX,garageRoom.box[3]]],mats.garageCeiling);
 meshPaintedCeiling(context,'pantry-painted-ceiling',ring([perimeterX,pantry.box[1],pantry.box[2],pantry.box[3]]),mats.pantry);

 navigation.floors.push({id:'ground',ring:data.exterior.ground.map(p=>world(p).slice(0,2)),z:0});
 const [sx,sy,ex,ey]=data.stairs.box;
 const upperOutline=[[0,0],[8.5,0],[8.5,4.21],[14.64,4.21],[14.64,12.71],[8.5,12.71],[8.5,ey],[ex,ey],[ex,sy],[sx,sy],[sx,voidStart],[0,voidStart]];
 const structureOutline=iconInteriorInsetSlab(upperOutline,data.exterior.upper,.18);
 slab('upper-structure',structureOutline,[],2.8,.4,mats.ceiling);
 slab('upper-oak-finish',structureOutline,[],3.2,.015,mats.oak);
 const xs=[...new Set([0,.5,sx,8.5,ex,14.64])].sort((a,b)=>a-b),ys=[0,4.21,sy,voidStart,ey,12.71,17.63,18.13];
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){const b=[xs[i-1],ys[j-1],xs[i],ys[j]],p=[(b[0]+b[2])/2,(b[1]+b[3])/2];if(contains(p,data.exterior.upper)&&!contains(p,stairHole)&&!contains(p,livingHole)){floor('upper-'+i+'-'+j,b,3.2);obstacle('upper-slab-'+i+'-'+j,b,2.8,3.2);navigation.obstacles[navigation.obstacles.length-1].kind='slab';}}
 for(const room of data.rooms){const z=room.id.startsWith('1.')?3.215:0;if(room.finish==='tile')slab('finish-'+room.id,room.outline||ring(room.box),[],z,.008,mats.tile);}
 for(const w of data.walls){
  if(w.finish==='clear-glass'||w.finish==='reeded-glass'){iconVestibuleScreen(context,w);continue;}
  const z=w.level?3.2:0,top=w.level?8.3:data.levels.groundCeiling;
  const hallFace=iconHallWallFinish(data,w);
  const doors=w.doors.map(([start,end],i)=>({...opening(start,end,z,z+2.1,false),flush:Boolean(w.doorLeaves?.[i])}));
  wall(w.id,w.a,w.b,z,top,w.thickness,doors,null,hallFace);
  w.doorLeaves?.forEach((spec,i)=>iconFlushDoor(context,w,doors[i],spec));
 }
}

function meshPaintedCeiling({THREE,data,mesh},name,outline,paint) {
 const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));
 const ceiling=mesh(new THREE.ShapeGeometry(shape),paint,name);
 ceiling.position.z=data.levels.groundCeiling-.002;ceiling.castShadow=false;
}

function iconHallWallFinish(data,wall) {
 const [,south,east]=data.rooms.find(r=>r.id==='0.5').box;
 const startOffice=data.stairs.box[2];
 switch(wall.id){
  case 'guest-inner': return {side:1,from:south-wall.a[1],to:wall.b[1]-wall.a[1]};
  case 'guest-office': return {side:-1,from:startOffice-wall.a[0],to:east-wall.a[0]};
  case 'hall-front': return {side:1,from:0,to:east-wall.a[0]};
  case 'garage-hall': {
   const screen=data.walls.find(w=>w.id==='vestibule-screen');
   return {side:-1,from:screen.a[1]+screen.thickness/2-wall.a[1],to:wall.b[1]-wall.a[1]};
  }
  default: return null;
 }
}

function iconDoorPivot({THREE,group},name,x,y,z,yaw,width,swing,slide=0) {
 const pivot=new THREE.Group();
 pivot.name=name;pivot.position.set(x,y,z);pivot.rotation.z=yaw;
 pivot.userData={kind:'walk-door',closedYaw:yaw,x,y,width,swing,slide,ux:Math.cos(yaw),uy:Math.sin(yaw)};
 group.add(pivot);
 return pivot;
}

function iconDoorPaint(context,finish) {
 const {mats,material}=context;
 if(finish==='familyBath')return iconUpperBathPalette(context).familyWall;
 if(finish==='privateBath')return iconUpperBathPalette(context).privateWall;
 if(finish==='oat')return iconBedroomOfficePalette(context).lacquer;
 if(finish==='linen')return iconBedroomOfficePalette(context).laminate;
 if(finish==='garage')return mats.garageDoor??=material('#505b57',{name:'Graphite green powder-coated steel',roughness:.61,metalness:.26});
 if(finish==='groundBath')return mats.groundBathPlaster??=material('#81462f',{name:'Burnished terracotta plaster',roughness:.94});
 return mats[finish];
}

function iconDoorHardware({THREE,mats},pivot,width,depth,faceY,sliding) {
 const height=1.035,u=sliding?.080:width-.080;
 for(const face of [-1,1]){
  const y=faceY+face*depth/2;
  if(sliding){
   const cup=new THREE.Mesh(new THREE.BoxGeometry(.032,.002,.105),mats.metal);
   cup.name=pivot.name+'-pull-'+face;cup.position.set(u,y+face*.001,height);pivot.add(cup);
   const inset=new THREE.Mesh(new THREE.BoxGeometry(.019,.001,.078),mats.dark);
   inset.position.set(u,y+face*.0025,height);pivot.add(inset);continue;
  }
  const spindle=new THREE.Mesh(new THREE.CylinderGeometry(.017,.017,.037,12),mats.metal);
  spindle.name=pivot.name+'-spindle-'+face;spindle.position.set(u,y+face*.0185,height);pivot.add(spindle);
  const lever=new THREE.Mesh(new THREE.BoxGeometry(.103,.014,.014),mats.metal);
  lever.name=pivot.name+'-lever-'+face;lever.position.set(u-.044,y+face*.039,height);pivot.add(lever);
 }
}

function iconFlushDoor(context,wall,opening,spec) {
 const {THREE}=context,gap=.0035,slide=spec.slide?1:0,depth=slide?.034:.044;
 const sign=side=>side==='left'?1:-1;
 const dx=wall.b[0]-wall.a[0],dy=wall.b[1]-wall.a[1],length=Math.hypot(dx,dy);
 const ux=dx/length,uy=dy/length,width=opening.end-opening.start-2*gap;
 const reversed=spec.hinge==='end'||spec.slide==='start',hand=reversed?-1:1;
 const offset=reversed?opening.end-gap:opening.start+gap;
 const side=sign(spec.flushFace),opens=sign(spec.opensTo);
 // Place the hinge on the swing-side skin so the thickness clears the hinge jamb.
 const lateral=slide?(reversed?-.023:.023):side*wall.thickness/2+(opens-side)*depth/2;
 const yaw=Math.atan2(uy*hand,ux*hand),swing=slide?0:opens*hand;
 const pivot=iconDoorPivot(context,'hall-flush-'+spec.id,wall.a[0]+ux*offset-uy*lateral,
  wall.a[1]+uy*offset+ux*lateral,opening.bottom,yaw,width,swing,slide);
 pivot.userData.side=side*hand;
 const clear=wall.level?.032:.020,height=opening.top-opening.bottom-clear-gap;
 const faceY=-swing*depth/2;
 const left=iconDoorPaint(context,spec.leftFinish),right=iconDoorPaint(context,spec.rightFinish);
 const paint=Array(6).fill(side===1?left:right);
 paint[hand===1?2:3]=left;paint[hand===1?3:2]=right;
 const leaf=new THREE.Mesh(new THREE.BoxGeometry(width,depth,height),paint);
 leaf.name=pivot.name+'-leaf';leaf.position.set(width/2,faceY,clear+height/2);
 leaf.castShadow=true;leaf.receiveShadow=true;pivot.add(leaf);
 iconDoorHardware(context,pivot,width,depth,faceY,Boolean(slide));
}

function iconMovingAssembly(context,name,parts,x,y,yaw,width,swing,slide=0) {
 // Keep construction-space coordinates of the bespoke glazing, pulls and cabinet front.
 const pivot=iconDoorPivot(context,name,x,y,0,yaw,width,swing,slide);
 pivot.updateMatrix();
 const mount=new context.THREE.Group();mount.matrixAutoUpdate=false;
 mount.matrix.copy(pivot.matrix).invert();pivot.add(mount);
 mount.add(...parts);
}

function iconBespokeWalkDoors(context) {
 const {group,data}=context;
 const screen=data.walls.find(w=>w.id==='vestibule-screen'),[left,right]=screen.doors[0];
 const screenParts=group.children.filter(o=>o.name.startsWith('vestibule-screen-leaf-')||o.name.startsWith('vestibule-leaf-'));
 iconMovingAssembly(context,'vestibule-glass-door',screenParts,screen.a[0]+left,screen.a[1],0,right-left,1);
 const front=data.facades.find(f=>f.id==='facade-front-wing'),entry=front.openings[0];
 const entryParts=group.children.filter(o=>o.name==='entry-main-door-leaf'||o.name.startsWith('entry-main-pull-'));
 iconMovingAssembly(context,'front-entry-door',entryParts,front.a[0]+entry.start+.006,front.a[1]+.24-.027,0,entry.end-entry.start-.012,-1);
 const pantry=group.getObjectByName('kitchen-pantry-closed-leaf'),pull=group.getObjectByName('kitchen-pantry-leaf-pull');
 if(pantry){
  const {width,height:thickness}=pantry.geometry.parameters;
  iconMovingAssembly(context,'concealed-pantry-door',pull?[pantry,pull]:[pantry],
   pantry.position.x-width/2,pantry.position.y+thickness/2,0,width,1);
 }
}

function iconHallDoorMotion(context) {
 iconBespokeWalkDoors(context);
 const {THREE,group}=context;
 const doors=group.children.filter(child=>child.userData.kind==='walk-door');
 const inverse=group.matrix.clone().invert(),eye=new THREE.Vector3(),last=new THREE.Vector3(Infinity,Infinity,Infinity);
 return cameraPosition=>{
  if(cameraPosition)eye.copy(cameraPosition).applyMatrix4(inverse);
  else eye.set(Infinity,Infinity,Infinity);
  if(eye.equals(last))return;
  last.copy(eye);
  for(const door of doors){
   const {closedYaw,x,y,ux,uy,width,swing,slide}=door.userData;
   let open=0;
   if(eye.z>door.position.z&&eye.z<door.position.z+2.75){
    const dx=eye.x-x,dy=eye.y-y,u=dx*ux+dy*uy,v=-dx*uy+dy*ux;
    let distance;
    if(slide)distance=Math.hypot(u-THREE.MathUtils.clamp(u,0,width),v);
    else{
     const inward=swing*v,roomU=Math.max(0,u),roomV=Math.max(0,inward);
     // Nearest point in the swept quadrant keeps the leaf open throughout the crossing.
     const scale=Math.min(1,width/(Math.hypot(roomU,roomV)||1));
     distance=Math.hypot(u-roomU*scale,inward-roomV*scale);
    }
    open=1-THREE.MathUtils.smoothstep(distance,.42,1.12);
   }
   if(slide){const travel=(width+.006)*slide*open;door.position.x=x+ux*travel;door.position.y=y+uy*travel;}
   else door.rotation.z=closedYaw+swing*Math.PI*.5*open;
  }
 };
}

function iconVestibuleScreen({THREE,data,mesh,box,beam,mats,obstacle},screen) {
 const [x0,y]=screen.a,x1=screen.b[0],top=data.levels.groundCeiling,depth=screen.thickness/2;
 const [left,right]=screen.doors[0].map(offset=>x0+offset),stile=.026;
 const finish=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.04,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide});
 for(const [id,a,b] of [['left',x0,left],['leaf',left,right],['right',right,x1]]){
  const prefix=screen.id+'-'+id;
  for(const [side,x] of [['jamb',a],['closing-stile',b-stile]])box(prefix+'-'+side,[x,y-depth,x+stile,y+depth],0,top,mats.metal);
  for(const [side,z] of [['shoe',0],['head',top-stile]])box(prefix+'-'+side,[a+stile,y-depth,b-stile,y+depth],z,stile,mats.metal);
  const outline=[[a+stile,stile],[b-stile,stile],[b-stile,top-stile],[a+stile,top-stile]];
  const glass=iconGlassGeometry(THREE,outline,([x,z])=>[x,y,z]);
  mesh(glass,finish,prefix+'-clear-glass').castShadow=false;
  if(id!=='leaf')obstacle(prefix,[a,y-depth,b,y+depth],0,top);
 }
 const pull=right-.095;
 for(const sign of [-1,1]){
  const face=y+sign*(depth+.055);
  beam('vestibule-leaf-pull-'+sign,[pull,face,.88],[pull,face,1.28],.012,mats.metal);
  for(const h of [.90,1.26])beam('vestibule-leaf-mount-'+sign+'-'+h,[pull,y+sign*depth,h],[pull,face,h],.009,mats.metal);
 }
}

function iconEntryReturn(context) {
 const {THREE,data,mesh,box,obstacle,mats,beam}=context;
 const facade=data.facades.find(w=>w.id==='facade-front-wing'),door=facade.openings[0];
 const [cornerX,cornerY]=facade.a,divider=data.walls.find(w=>w.id==='garage-hall'),top=data.levels.groundCeiling;
 const wallDepth=.48,innerX=cornerX-wallDepth,backY=divider.a[1],insideY=cornerY+wallDepth;
 const vertices=[];
 function face(a,b,bottom,head){
  vertices.push(...a,bottom,...b,bottom,...b,head,...a,bottom,...b,head,...a,head);
 }
 face([innerX,cornerY],[innerX,backY],0,top);
 face([cornerX,cornerY],[cornerX,insideY],0,door.top);
 face([cornerX,insideY],[cornerX,backY],0,top);
 face([innerX,backY],[divider.a[0]-divider.thickness/2,backY],0,top);
 face([divider.a[0]+divider.thickness/2,backY],[cornerX,backY],0,top);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 for(const [start,count,finish] of [[0,6,1],[6,12,0],[18,6,1],[24,6,0]])geometry.addGroup(start,count,finish);
 mesh(geometry,[mats.wall,mats.garage],'entry-garage-jamb-return');
 obstacle('entry-garage-jamb-return',[innerX,cornerY,cornerX,backY],0,top);
 const x0=cornerX+door.start,x1=cornerX+door.end,y=cornerY+wallDepth/2,finish=iconLivingPalette(context);
 box('entry-main-door-leaf',[x0+.006,y-.027,x1-.006,y+.027],.008,door.top-.014,finish.espresso);
 for(const sign of [-1,1]){
  const face=y+sign*.085,pull=x1-.14;
  for(const z of [.78,1.29])beam('entry-main-pull-mount-'+sign+'-'+z,[pull,y+sign*.027,z],[pull,face,z],.012,mats.metal);
  beam('entry-main-pull-'+sign,[pull,face,.756],[pull,face,1.314],.016,mats.metal);
 }
}

function iconTerraceSlider(context) {
 const {box,mats,data}=context,wall=data.facades.find(f=>f.id==='facade-terrace');
 const opening=wall.openings.find(o=>!o.glass),left=wall.a[1]+opening.start,right=wall.a[1]+opening.end;
 const x=wall.a[0]-iconGroundFacadeDepth(wall)/2-.055,stile=.033,top=opening.top-.015,bottom=.021;
 const parts=[];
 for(const [id,y] of [['leading',right-stile],['trailing',left]])
  parts.push(box('terrace-slider-'+id,[x-.017,y,x+.017,y+stile],bottom,top-bottom,mats.metal));
 for(const [id,z] of [['shoe',bottom],['head',top-stile]])
  parts.push(box('terrace-slider-'+id,[x-.017,left+stile,x+.017,right-stile],z,stile,mats.metal));
 const pane=box('terrace-slider-glass',[x-.004,left+stile,x+.004,right-stile],bottom+stile,top-bottom-2*stile,mats.glass);
 pane.castShadow=false;parts.push(pane);
 parts.push(box('terrace-slider-pull',[x-.038,right-.077,x-.017,right-.051],.95,.17,mats.metal));
 iconMovingAssembly(context,'garden-terrace-slider',parts,x,right,-Math.PI/2,right-left,0,1);
}

function iconInteriorFacades(context) {
 const {data, wall, box, obstacle, mats, beam, opening} = context;
 for(const facade of data.facades){
  const openings=facade.id==='facade-garden'?facade.openings.map(o=>({...o,wallPoly:[[o.start,0],[o.end,0],[o.end,o.top],[7.76,o.top],[7.76,2.8],[.74,2.8],[.74,o.top],[o.start,o.top]]})):facade.openings;
  wall(facade.id,facade.a,facade.b,0,2.8,iconGroundFacadeDepth(facade),openings);
 }
 const rear=data.facades.find(f=>f.id==='facade-wing-rear'),[cx,cy]=rear.a;
 for(const [id,depth,base,top] of [['ground',iconGroundFacadeDepth(rear),0,2.8],['upper',.36,2.8,4.07]])
  obstacle('terrace-inner-corner-'+id,[cx-depth,cy-depth,cx,cy],base,top);
 iconEntryReturn(context);
 iconTerraceSlider(context);
 box('garage-sectional-door',[1.08,-.05,6.04,.05],0,2.32,mats.dark);obstacle('garage-door',[1.06,-.1,6.06,.1],0,2.35);
 // These three walls include the upper gable and its asymmetrical glazing.
 wall('front-gable',[0,0],[8.5,0],2.8,8.3,.36,[{...opening(.9,4.25,3.2,7.25),poly:[[.9,3.2],[4.25,3.2],[4.25,7.25],[.9,3.9]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 const gardenGlassY=data.facades.find(f=>f.id==='facade-garden').a[1]-.24;
 wall('garden-gable',[0,18.13],[8.5,18.13],2.8,8.3,.36,[{...opening(.9,7.6,3.2,7.35),dividers:[3.1,5.4],recess:18.13-.18-gardenGlassY,wallPoly:[[.74,2.8],[7.76,2.8],[7.76,3.2],[7.6,3.2],[7.6,3.95],[4.25,7.35],[.9,3.95],[.9,3.2],[.74,3.2]],poly:[[.9,3.2],[7.6,3.2],[7.6,3.95],[4.25,7.35],[.9,3.95]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 const transom=box('garden-window-transom',[.74,gardenGlassY-.12,7.76,gardenGlassY],2.35,.85,[mats.wall,mats.dark]);
 for(const [face,group] of transom.geometry.groups.entries())group.materialIndex=face===3?0:1;
 wall('wing-gable',[14.64,4.21],[14.64,12.71],2.8,8.3,.36,[{...opening(4.25,7.39,3.2,7.3),poly:[[4.25,3.2],[7.39,3.2],[7.39,4.15],[4.25,7.3]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 for(const [id,a,b] of [['upper-main-side',[0,0],[0,18.13]],['upper-front-wing',[8.5,4.21],[14.64,4.21]],['upper-rear-wing',[8.5,12.71],[14.64,12.71]],['upper-garage-side',[8.5,0],[8.5,4.21]],['upper-terrace-side',[8.5,12.71],[8.5,18.13]]])wall(id,a,b,2.8,4.07,.36);
}

const iconStairSheet=.009,iconLandingPlate=.022;

function iconPerforatedGuardMaterial(THREE,steel) {
 const width=32,height=64,pixels=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=((x+.5+(y>=width?width/2:0))%width)/width-.5,v=((y+.5)%width)/width-.5;
  const coverage=THREE.MathUtils.clamp((Math.hypot(u,v)-.4375)*width+.5,0,1);
  const i=4*(y*width+x);pixels.fill(Math.round(255*coverage),i,i+3);pixels[i+3]=255;
 }
 const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.anisotropy=4;texture.needsUpdate=true;
 const screen=steel.clone();screen.name='Indigo microperforated steel';
 screen.alphaMap=texture;screen.transparent=true;screen.alphaTest=.025;screen.depthWrite=false;screen.forceSinglePass=true;
 return screen;
}

function iconFoldedStairFlight({THREE,mesh},id,x,width,y,dir,base,steps,tread,rise,steel) {
 const profile=[[0,base]],run=steps*tread;
 for(let i=0;i<=steps;i++){
  const height=base+(i+1)*rise;
  profile.push([i===steps?run-iconStairSheet:i*tread,height]);
  if(i<steps)profile.push([i===steps-1?run-iconStairSheet:(i+1)*tread,height]);
 }
 const underside=profile.map(([u,z],i)=>[u+iconStairSheet,z-(i===0||i===profile.length-1?0:iconStairSheet)]);
 const outline=profile.concat(underside.reverse());
 const shape=new THREE.Shape(outline.map(v=>new THREE.Vector2(...v)));
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false});
 const positions=geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++)positions.setXYZ(i,x+positions.getZ(i),y+dir*positions.getX(i),positions.getY(i));
 geometry.computeVertexNormals();mesh(geometry,steel,'stair-'+id+'-folded-flight');
 return profile;
}

function iconStairGuard({THREE,mesh,beam},id,a,b,baseProfile,topA,topB,steel,screen,omitEnd=false,startPostBase=baseProfile[0][1]) {
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dy=(b[1]-a[1])/length;
 const point=(u,z)=>[a[0]+u*dx,a[1]+u*dy,z];
 const top=u=>topA+(topB-topA)*u/length;
 const boundary=baseProfile.concat([[length,topB],[0,topA]]);
 const geometry=new THREE.ShapeGeometry(new THREE.Shape(boundary.map(p=>new THREE.Vector2(...p))));
 const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
 for(let i=0;i<positions.count;i++){
  const u=positions.getX(i),z=positions.getY(i);
  positions.setXYZ(i,...point(u,z));uv.setXY(i,u/.010,z/.020);
 }
 geometry.computeVertexNormals();mesh(geometry,screen,id+'-perforated-infill').castShadow=false;
 beam(id+'-top',point(0,topA),point(length,topB),.017,steel);
 const bays=Math.ceil(length/1.07);
 for(let i=0;i<=bays;i++){
  if(i===bays&&omitEnd)continue;
  const u=length*i/bays;
  const beneath=i===0?startPostBase:baseProfile.filter(([d])=>d<=u+1e-8).at(-1)[1];
  beam(id+'-post-'+i,point(u,beneath),point(u,top(u)),.012,steel);
 }
}

function iconInteriorStairs(context) {
 const {THREE,data,box,floor,navigation,world,rail,obstacle}=context;
 const s=data.stairs,[sx,sy,ex,ey]=s.box,steps=s.rises/2-1,run=steps*s.tread,half=s.floorHeight/2;
 const rise=s.floorHeight/s.rises,turn=sy+run,guardHeight=1.12;
 const steel=new THREE.MeshStandardMaterial({name:'Indigo powder-coated folded steel',color:'#414a89',roughness:.53,metalness:.32,side:THREE.DoubleSide});
 const screen=iconPerforatedGuardMaterial(THREE,steel);
 for(const [flight,x,y,dir,base] of [['lower',sx,sy,1,0],['upper',ex-s.width,turn,-1,half]]){
  const profile=iconFoldedStairFlight(context,flight,x,s.width,y,dir,base,steps,s.tread,rise,steel);
  // In the mirrored house the minimum-x edge is the lower flight's right side and the upper flight's open side.
  const id='stair-'+flight+'-left',lower=flight==='lower',approach=lower?s.tread*.65:0;
  const guardBase=profile.slice(1,-1).concat([[run,base+half]]);
  const infill=lower?[[0,base+rise],...guardBase.filter(([u])=>u>approach).map(([u,z])=>[u-approach,z])]:guardBase;
  iconStairGuard(context,id,[x,y+dir*approach],[x,y+dir*run],infill,base+guardHeight+half*approach/run,
   base+half+guardHeight,steel,screen,lower,lower?base+rise:base);
  for(let i=0;i<steps;i++){
   const lo=y+dir*Math.max(approach,i*s.tread),hi=y+dir*(i+1)*s.tread;
   obstacle(id+'-'+i,[x-.012,Math.min(lo,hi),x+.012,Math.max(lo,hi)],base+i*rise,base+(i+1)*half/steps+guardHeight);
  }
  navigation.ramps.push({id:'stair-'+flight,start:world([x+s.width/2,y]).slice(0,2),
   end:world([x+s.width/2,y+dir*run]).slice(0,2),width:s.width,z0:base,z1:base+half});
 }
 box('stair-landing',[sx,turn,ex,ey],half-iconLandingPlate,iconLandingPlate,steel);floor('stair-landing',[sx,turn,ex,ey],half);
 iconStairGuard(context,'landing-lower',[sx,turn],[sx,ey],[[0,half],[ey-turn,half]],half+guardHeight,half+guardHeight,steel,screen);
 obstacle('landing-lower',[sx-.025,turn,sx+.025,ey],half,half+guardHeight);
 for(const guard of data.rails)rail(guard.id,guard.a,guard.b,guard.level?s.floorHeight:0,steel);
 const railCorner=data.rails.find(r=>r.id==='upper-void-edge').b;
 rail('upper-stair-hall-side',railCorner,[railCorner[0],sy],s.floorHeight,steel);
 rail('upper-stair-hall-front',[railCorner[0],sy],[sx+s.width,sy],s.floorHeight,steel,false);
}

function iconInteriorOfficeBacking(context) {
 const {data,box,obstacle,mats,navigation}=context;
 const cabinets=data.furniture.filter(item=>item.id.startsWith('office-under-stair-'));
 if(!cabinets.length)return;
 const backX=cabinets[0].box[0];
 const stairs=data.stairs,[sx,frontY,,rearY]=stairs.box,half=stairs.floorHeight/2;
 const cover={ramp:navigation.ramps.find(r=>r.id==='stair-upper'),landing:navigation.floors.find(f=>f.id==='stair-landing')};
 const segment=(name,from,to,height,above)=>{
  const bounds=[sx+stairs.width,Math.max(from,frontY),backX,Math.min(to,rearY)];
  if(bounds[3]<=bounds[1])return;
  const backing=box(name,bounds,0,height,mats.wall);
  // The +X face is buried inside the fitted enclosure and meets the folds edge-on.
  const buriedFace=backing.geometry.groups[0];
  backing.geometry.setDrawRange(buriedFace.count,backing.geometry.index.count-buriedFace.count);
  obstacle(name,bounds,0,height,above);
 };
 const steps=stairs.rises/2-1,turn=frontY+steps*stairs.tread;
 // Set the plaster 2 mm behind the steel underside on horizontal and vertical folds.
 const setback=iconStairSheet+.002;
 for(let i=0;i<steps;i++){
  const y=turn-i*stairs.tread-setback,height=half+(i+1)*stairs.floorHeight/stairs.rises-setback;
  segment('office-backing-flight-'+i,y-stairs.tread,y,height,cover);
 }
 segment('office-backing-landing',turn-setback,rearY,half-iconLandingPlate,cover);
 iconInteriorOfficePartition(context,cabinets,frontY,steps*stairs.tread);
}

function iconOfficeVeneer(context) {
 if(context.officeVeneer)return context.officeVeneer;
 const {THREE,data}=context,swatch=data.officeVeneer;
 if(!swatch)return context.mats.wood;
 const samples=atob(swatch.pixels);
 const veneer=iconFinishTexture(THREE,'Bookmatched ivory and ink figured veneer',swatch.width,swatch.height,.47,(u,v)=>{
  const index=Math.floor(v*swatch.height)*swatch.width+Math.floor(u*swatch.width);
  const packed=samples.charCodeAt(index>>1),grain=index%2?packed&15:packed>>4;
  const tone=42+grain*12;
  return [tone+4,tone+2,tone-2];
 });
 veneer.map.wrapS=THREE.MirroredRepeatWrapping;
 veneer.userData.source=swatch.source;
 context.officeVeneer=veneer;
 return veneer;
}

function iconOfficeMatchedFace(face) {
 const {position,normal,uv}=face.geometry.attributes;
 for(let i=0;i<position.count;i++){
  const y=position.getY(i)+face.position.y,z=position.getZ(i)+face.position.z;
  const x=position.getX(i)+face.position.x;
  uv.setXY(i,(Math.abs(normal.getY(i))>.5?x:y)/1.78,(Math.abs(normal.getZ(i))>.5?x:z)/2.84);
 }
}

function iconOfficeFittedCabinet(context,frame) {
 const {item,part,width,depth,line}=frame,h=item.height,veneer=iconOfficeVeneer(context);
 const {graphite,silver}=iconBedroomOfficePalette(context),leaf=width/item.doors;
 part('plinth',[.014,0,width-.014,depth-.077],0,.072,graphite);
 part('body',[0,0,width,depth-.045],.072,h-.072,graphite);
 for(let i=0;i<item.doors;i++){
  const front=part('door-'+i,[i*leaf+.0025,depth-.045,(i+1)*leaf-.0025,depth-.024],.074,h-.078,veneer);
  iconOfficeMatchedFace(front);
  const pull=i*leaf+(i===0?leaf-.069:.069);
  line('knob-neck-'+i,[pull,depth-.024,.94],[pull,depth-.008,.94],.010,graphite);
  line('handle-'+i,[pull,depth-.008,.94],[pull,depth,.94],.021,silver);
 }
}

function iconInteriorOfficePartition(context,cabinets,frontY,run) {
 const {THREE,data,mesh,obstacle,mats}=context;
 const frontX=cabinets[0].box[2],startY=cabinets[0].box[1],endY=cabinets.at(-1).box[3];
 const ceiling=data.levels.groundCeiling,half=data.stairs.floorHeight/2,landingY=frontY+run;
 const underside=y=>Math.min(ceiling,half-.15+Math.max(0,landingY-y)*half/run);
 const ceilingY=landingY-(ceiling-half+.15)*run/half;
 const profile=(from,to)=>[from,...[ceilingY,landingY].filter(y=>y>from&&y<to),to].map(y=>[y,underside(y)]);
 const panel=(id,x,depth,outline,mat)=>{
  const shape=new THREE.Shape(outline.map(([y,z])=>new THREE.Vector2(y,z)));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)positions.setXYZ(i,x+positions.getZ(i),positions.getX(i),positions.getY(i));
  geometry.computeVertexNormals();
  return mesh(geometry,mat,id);
 };
 const begin=Math.max(startY,ceilingY),edge=profile(begin,endY);
 panel('office-stair-partition',frontX,.055,[...edge,[endY,ceiling]],mats.wall);
 for(const cabinet of cabinets){
  const [,y0,,y1]=cabinet.box;
  const fascia=panel(cabinet.id+'-filler',frontX-.045,.021,[[y0,cabinet.height],[y1,cabinet.height],...profile(y0,y1).reverse()],iconOfficeVeneer(context));
  iconOfficeMatchedFace(fascia);
  obstacle(cabinet.id+'-upper-enclosure',[frontX,y0,frontX+.055,y1],cabinet.height,ceiling);
 }
}

function iconInteriorFurnitureFrame(context, item) {
 const {box, beam, mats} = context, [x0,y0,x1,y1] = item.box;
 const alongX = item.facing.endsWith('x'), width = alongX ? y1-y0 : x1-x0, depth = alongX ? x1-x0 : y1-y0;
 const z = (item.room.startsWith('1.') ? 3.2 : 0) + (item.elevation || 0);
 const point = (u,v,h=0) => ({'+y':[x0+u,y0+v,z+h],'-y':[x1-u,y1-v,z+h],'+x':[x0+v,y1-u,z+h],'-x':[x1-v,y0+u,z+h]}[item.facing]);
 const part = (name,b,h,t,mat=mats.wood) => {
  const a=point(b[0],b[1]),c=point(b[2],b[3]);
  return box(item.id+'-'+name,[Math.min(a[0],c[0]),Math.min(a[1],c[1]),Math.max(a[0],c[0]),Math.max(a[1],c[1])],z+h,t,mat);
 };
 const line = (name,a,b,r=.025,mat=mats.metal) => beam(item.id+'-'+name,point(...a),point(...b),r,mat);
 return {item,width,depth,z,part,line,point,mats};
}

function iconInteriorFurnitureBed(frame) {
 const {width:w,depth:d,part,mats}=frame;
 part('frame',[0,.06,w,d],.15,.23);
 part('mattress',[.04,.08,w-.04,d-.02],.38,.21,mats.white);
 part('duvet',[.04,Math.min(.55,d*.3),w-.04,d-.02],.59,.09,mats.linen);
 for(const u of [.08,w/2+.03])part('pillow',[u,.12,u+w/2-.12,.48],.6,.09,mats.white);
 part('headboard',[0,0,w,.06],0,.95);
}

function iconInteriorFurnitureSeating(frame) {
 const {item,width:w,depth:d,part,mats}=frame;
 if(item.type==='ottoman'){part('cushion',[0,0,w,d],.1,.38,mats.sofa);return;}
 const sofa=item.type==='sofa',seat=item.type==='stool'?.68:.43,backDepth=sofa?.18:.07;
 part('seat',[0,0,w,d],sofa?.1:seat,sofa?.35:.07,sofa?mats.sofa:mats.linen);
 part('back',[0,0,w,backDepth],sofa?.45:seat+.07,sofa?.45:.42,mats.wood);
 if(sofa){
  const count=Math.max(1,Math.round(w/.85));
  for(let i=0;i<count;i++)part('cushion-'+i,[i*w/count+.015,backDepth,(i+1)*w/count-.015,d-.02],.45,.15,mats.linen);
 }else for(const u of [.05,w-.05])for(const v of [.05,d-.05])part('leg-'+u+'-'+v,[u-.025,v-.025,u+.025,v+.025],0,seat,mats.dark);
}

function iconInteriorFurnitureStorage(frame) {
 const {item,width:w,depth:d,part,mats}=frame,h=item.height||2.2;
 part('body',[0,0,w,d-.035],0,item.type==='counter'?h-.05:h,item.type==='appliance'?mats.white:mats.wood);
 for(let i=0;i<(item.doors||0);i++){
  const leaf=(w-(item.blindCornerWidth||0))/item.doors;
  part('door-'+i,[i*leaf+.004,d-.035,(i+1)*leaf-.004,d-.014],.04,h-.06);
  const u=(i+.5)*leaf;
  part('handle-'+i,[u-.0125,d-.014,u+.0125,d],Math.min(1,h*.55),Math.min(.3,h*.25),mats.dark);
 }
 if(item.type==='counter')part('top',[0,0,w,d],h-.05,.05,mats.counter);
 if(!item.doors)for(let u=.15;u<w;u+=.6)part('handle-'+u,[u,d-.035,Math.min(u+.025,w),d],Math.min(1,h*.55),Math.min(.3,h*.25),mats.dark);
}

function iconInteriorFurnitureTable(frame) {
 const {item,width:w,depth:d,part,mats}=frame,h=item.height||.73;
 part('top',[0,0,w,d],h,.06);
 for(const u of [.12,w-.12])for(const v of [.12,d-.12])part('leg-'+u+'-'+v,[u-.04,v-.04,u+.04,v+.04],0,h,mats.dark);
}

function iconInteriorFurnitureSanitary(frame) {
 const {item,width:w,depth:d,part,line,mats}=frame;
 if(item.type==='sink'||item.type==='basin'){
  const h=item.type==='sink'?.8:0;
  if(h)part('vanity',[0,0,w,d],0,h);
  part('bowl',[w*.1,d*.08,w*.9,d*.88],h,.1,mats.white);
  line('tap',[w/2,d*.15,h+.1],[w/2,d*.15,h+.3]);
 }else if(item.type==='toilet'){
  part('base',[0,0,w,d],0,.42,mats.white);
  part('cistern',[0,0,w,Math.min(.18,d*.3)],.42,.4,mats.white);
 }else if(item.type==='tub'){
  part('shell',[0,0,w,d],0,.55,mats.white);
  part('water',[.09,.09,w-.09,d-.09],.48,.025,mats.glass).castShadow=false;
 }else{
  part('tray',[0,0,w,d],0,.05,mats.white);
  part('screen',[w-.02,0,w,d],.05,1.95,mats.glass).castShadow=false;
  line('head',[w*.2,.1,1.95],[w*.65,.1,1.95],.035);
 }
}

function iconInteriorLaundryStack(context, frame) {
 const {THREE,mesh}=context,{item,width:w,depth:d,part,point,mats}=frame;
 const h=(item.height-.03)/2;
 const finish=(color,metalness,roughness,extra={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
 const enamel=finish('#eeefed',.16,.27),chrome=finish('#ced6d8',.62,.26),steel=finish('#84949b',.47,.31);
 const gasket=finish('#40474a',.08,.63),screen=finish('#223238',.15,.25),digits=finish('#a9e5dc',.05,.35,{emissive:'#7fc7bb',emissiveIntensity:.4});
 const glass=finish('#91adbc',.18,.15,{transparent:true,opacity:.37,depthWrite:false});
 const outward=new THREE.Vector3(...point(0,1)).sub(new THREE.Vector3(...point(0,0)));
 const face=(id,geometry,material,u,v,z)=>{
  const m=mesh(geometry,material,item.id+'-'+id);
  m.position.set(...point(u,v,z));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),outward);return m;
 };
 part('stacking-kit',[.015,.015,w-.015,d-.035],h,.03,gasket);
 for(const [name,z] of [['washer',0],['dryer',h+.03]]){
  const mid=z+h*.48,panel=z+h-.13;
  part(name+'-body',[0,0,w,d-.04],z,h,enamel);
  face(name+'-drum',new THREE.CircleGeometry(.18,40),steel,w/2,d-.038,mid);
  for(let i=0;i<3;i++){
   const angle=i*Math.PI*2/3+.22;
   const rib=face(name+'-lifter-'+i,new THREE.CapsuleGeometry(.012,.06,3,8),chrome,w/2+.096*Math.cos(angle),d-.027,mid+.096*Math.sin(angle));
   rib.scale.z=.25;
   rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...point(Math.cos(angle),0,Math.sin(angle))).sub(new THREE.Vector3(...point(0,0))).normalize());
  }
  face(name+'-gasket',new THREE.TorusGeometry(.164,.013,10,48),gasket,w/2,d-.020,mid);
  face(name+'-door',new THREE.TorusGeometry(.191,.018,12,48),chrome,w/2,d-.020,mid);
  const lens=new THREE.SphereGeometry(.155,32,18);lens.scale(1,1,.08);
  face(name+'-glass',lens,glass,w/2,d-.015,mid).castShadow=false;
  const dial=new THREE.CylinderGeometry(.027,.027,.014,24);dial.rotateX(Math.PI/2);
  face(name+'-dial',dial,chrome,w*.49,d-.031,panel+.054);
  part(name+'-display',[w*.65,d-.04,w*.94,d-.034],panel+.039,.045,screen);
  for(let i=0;i<3;i++)part(name+'-indicator-'+i,[w*.69+i*.029,d-.034,w*.69+i*.029+.017,d-.033],panel+.056,.007,digits);
  for(let i=0;i<2;i++)part(name+'-button-'+i,[w*.69+i*.064,d-.04,w*.69+i*.064+.037,d-.031],panel+.01,.012,chrome);
  if(name==='washer'){
   part('detergent-drawer',[.025,d-.04,w*.36,d-.031],panel+.018,.075,enamel);
   part('drawer-recess',[.05,d-.031,w*.33,d-.029],panel+.029,.012,gasket);
  }else{
   for(let i=0;i<4;i++)part('dryer-vent-'+i,[.032,d-.04,w*.62,d-.038],z+.055+i*.014,.006,steel);
  }
 }
}

function iconInteriorIroningBoard(context,frame) {
 const {THREE,mesh}=context,{item,width:w,depth:d,point,line,mats}=frame,h=item.height;
 const outline=new THREE.Shape();
 outline.moveTo(.04,.015);outline.lineTo(w*.7,.015);
 outline.bezierCurveTo(w*.84,.015,w-.015,d*.23,w-.015,d*.5);
 outline.bezierCurveTo(w-.015,d*.77,w*.84,d-.015,w*.7,d-.015);
 outline.lineTo(.04,d-.015);outline.quadraticCurveTo(.015,d-.015,.015,d-.04);
 outline.lineTo(.015,.04);outline.quadraticCurveTo(.015,.015,.04,.015);
 const geometry=new THREE.ExtrudeGeometry(outline,{depth:.035,bevelEnabled:false}),pos=geometry.getAttribute('position');
 for(let i=0;i<pos.count;i++)pos.setXYZ(i,...point(pos.getX(i),pos.getY(i),h-.035+pos.getZ(i)));
 geometry.computeVertexNormals();mesh(geometry,mats.linen,item.id+'-padded-top');
 for(const [i,v] of [.10,d-.10].entries()){
  line('leg-a-'+i,[.2,v,.03],[w-.28,v,h-.035],.015);
  line('leg-b-'+i,[w-.28,v+.025,.03],[.2,v+.025,h-.035],.015);
 }
 for(const [i,u] of [.2,w-.28].entries())line('foot-'+i,[u,.025,.025],[u,d-.025,.025],.021);
}

function iconInteriorNightstand(context,frame) {
 const s=iconLivingShapes(context,frame),p=iconBedroomOfficePalette(context);
 const {width:w,depth:d,item,part,line,mats}=frame,h=item.height;
 part('shelf',[0,0,w,d],.055,.025,p.laminate);
 for(const [i,u] of [0,w-.025].entries())part('side-'+i,[u,0,u+.025,d],.08,h-.08,p.lacquer);
 part('drawer',[.025,.01,w-.025,d-.018],h-.18,.14,p.lacquer);
 part('pull',[w*.36,d-.018,w*.64,d],h-.125,.018,p.silver);
 part('top',[.025,0,w-.025,d],h-.04,.04,p.laminate);
 const x=w*.5,y=d*.43;
 s.disc('reading-light-base',x,y,h,.076,.076,.019,p.stone);
 line('reading-light-stem',[x,y,h+.019],[x,y,h+.183],.011,p.silver);
 s.disc('reading-light-diffuser',x,y,h+.177,.093,.093,.012,mats.lamp);
 iconUpperCeramic(s,context.THREE,'reading-light-shade',x,y,h+.184,.099,.099,
  [[.96,0],[1,.003],[.98,.034],[.91,.056],[.78,.075],[.58,.088],[.31,.095],[0,.098]],p.stone);
}

function iconLoungeFabric(THREE,name,color,accent,stripes=0) {
 const linen=iconFinishTexture(THREE,name,128,128,.87,(u,v)=>{
  const x=Math.floor(u*128),y=Math.floor(v*128),phase=u*stripes%1;
  const rgb=stripes && phase>=.5?accent:color;
  const grain=(Math.imul(x*557+y*7919,1597334677)>>>26)/11-2.8;
  const nap=grain+2.0*Math.sin(2*Math.PI*(u*7+v*2))+
   1.3*Math.cos(2*Math.PI*(v*13-u*3))+((x&1)===(y&1)?1:-1);
  return rgb.map(channel=>channel+nap);
 },[1,1]);
 return linen;
}

function iconPersianRug(THREE,swatch) {
 // The supplied photograph ends within the lower border. Reflect a quadrant about the medallion.
 const {width,height,palette,pixels:encodedPixels}=swatch;
 const colors=atob(palette),pixels=atob(encodedPixels);
 const rgba=new Uint8Array(width*height*16);
 for(let y=0;y<height*2;y++)for(let x=0;x<width*2;x++){
  const i=(y*width*2+x)*4,sourceX=Math.min(x,width*2-1-x),sourceY=Math.min(y,height*2-1-y);
  const c=3*pixels.charCodeAt(sourceY*width+sourceX);
  rgba[i]=colors.charCodeAt(c);rgba[i+1]=colors.charCodeAt(c+1);rgba[i+2]=colors.charCodeAt(c+2);rgba[i+3]=255;
 }
 const name='Carmine Persian floral wool, black and cream palmette border';
 const map=new THREE.DataTexture(rgba,width*2,height*2);
 map.name=name;map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;
 map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;
 return new THREE.MeshStandardMaterial({map,roughness:.97,name});
}

function iconLivingAccentMaterials({THREE,data}) {
 const mix=(color,tone)=>[color[0]+tone,color[1]+tone*.88,color[2]+tone*.70];
 const walnut=iconFinishTexture(THREE,'Oiled walnut veneer',256,256,.46,(u0,v0)=>{
  const x=u0*256-.5,y=v0*256-.5;
  const u=(x-128)/128,v=y/128;
  const grain=13*Math.abs(u)+2.35*Math.cos(v*2.15)+.22*Math.cos(v*6.1+u*3);
  const ring=Math.sin(grain*4.3+.55*Math.sin(grain*1.8));
  const pore=Math.max(0,Math.cos(grain*11.2+.08*Math.cos(y*.4)))**10;
  return mix([122,76,52],10*ring-12*pore+5*Math.sin(grain*.84));
 });
 const fabric=(name,color,accent,stripes)=>iconLoungeFabric(THREE,name,color,accent,stripes);
 const velvet=(name,color,sheenColor)=>{
  const {map}=fabric(name,color);
  return new THREE.MeshPhysicalMaterial({name,map,roughness:.87,sheen:.47,sheenColor,sheenRoughness:.82});
 };
 const pugStripe=fabric('Tomato and periwinkle alternating sewn panels',[201,61,41],[148,165,192],1);
 pugStripe.map.repeat.x=12;
 return {accentWalnut:walnut,persian:iconPersianRug(THREE,data.textiles.persianRug),
  powder:velvet('Powder blue velvet',[154,166,188],'#abb8cc'),barrelBlue:velvet('Slate blue velvet',[135,149,174],'#a1acc3'),
  burgundyStripe:fabric('Burgundy and ivory striped linen',[225,205,173],[104,44,37],4),
  oliveVelvet:velvet('Olive velvet',[103,100,65],'#958d69'),pugStripe,tomatoCloth:fabric('Tomato woven cotton',[201,61,41])};
}

function iconLivingPalette(context) {
 if(context.livingPalette)return context.livingPalette;
 const {THREE}=context;
 const paint=(color,roughness=.78,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const finish=(color,kind)=>{
  const m=paint(color,kind==='stone'?.51:.87),n=128,bytes=new Uint8Array(n*n*4);
  for(let i=0;i<n*n;i++){
   const x=i%n,y=Math.floor(i/n),u=x*2*Math.PI/n,v=y*2*Math.PI/n;
   const grain=Math.sin(21*u+.7*Math.sin(2*v)+.8*Math.sin(3*u+v)),vein=Math.abs(Math.sin(u+v+.48*Math.sin(v*3)+.09*Math.sin(9*u)));
   const noise=Math.sin(i*41.347+3.1)*43758.5453;
   const tone=kind==='wood'?218+14*grain+7*Math.cos(6*u+Math.sin(v)):kind==='stone'?238-32*Math.exp(-vein*28)-8*Math.cos(2*v+u):231+7*Math.sin(32*u)*Math.cos(32*v);
   const light=tone+7*(noise-Math.floor(noise)-.5);
   bytes.set([light,light,light,255],i*4);
  }
  const map=new THREE.DataTexture(bytes,n,n);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;m.map=map;
  return m;
 };
 return context.livingPalette={...iconLivingAccentMaterials(context),
  putty:paint('#c7b9a7',.89),chalk:paint('#e7dcc9',.90),clay:paint('#a17360',.83),
  cocoa:paint('#655246',.82),shadow:paint('#544a41',.87),plaster:paint('#c7b9a7',.94),
  silver:paint('#bfc0b9',.32,.78),indigo:paint('#49526c',.79),
  walnut:finish('#604638','wood'),espresso:finish('#483b32','wood'),ash:finish('#ad8662','wood'),slate:finish('#343637','wood'),stone:finish('#d3c6b2','stone'),ivory:paint('#efe8da'),black:paint('#252625',.48,.32),screen:paint('#202c33',.24,.25),sage:finish('#aaa998','cloth'),olive:finish('#959984','cloth'),linen:finish('#ded8c8','cloth'),rug:finish('#bcae96','cloth'),brass:paint('#ab8454',.34,.55),lens:paint('#315877',.16,.46)};
}

function iconLivingShapes(context,frame,segments=8) {
 const {THREE,mesh}=context,{item,point}=frame,rotation={'+y':0,'-y':Math.PI,'+x':-Math.PI/2,'-x':Math.PI/2}[item.facing];
 const add=(name,geometry,mat,u,v,z)=>{
  const object=mesh(geometry,mat,item.id+'-'+name);object.position.set(...point(u,v,z));object.rotation.z=rotation;return object;
 };
 function cushion(name,u,v,z,w,d,h,r,mat,tilt=0){
  const g=new THREE.BoxGeometry(w,d,h,segments,segments,Math.min(segments,6)),p=g.attributes.position,radius=Math.min(r,w*.49,d*.49,h*.49);
  for(let i=0;i<p.count;i++){
   const vtx=new THREE.Vector3().fromBufferAttribute(p,i),core=vtx.clone().clamp(new THREE.Vector3(-w/2+radius,-d/2+radius,-h/2+radius),new THREE.Vector3(w/2-radius,d/2-radius,h/2-radius));
   const normal=vtx.clone().sub(core).normalize();core.addScaledVector(normal,radius);
   p.setXYZ(i,core.x,core.y,core.z);g.attributes.normal.setXYZ(i,normal.x,normal.y,normal.z);
  }
  const obj=add(name,g,mat,u,v,z);obj.rotateX(tilt);return obj;
 }
 function disc(name,u,v,z,rx,ry,h,mat){
  const g=new THREE.CylinderGeometry(1,1,h,Math.max(12,segments*5));g.rotateX(Math.PI/2);g.scale(rx,ry,1);return add(name,g,mat,u,v,z+h/2);
 }
 function tube(name,pts,r,mat){
  const path=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
  return add(name,new THREE.TubeGeometry(path,Math.max(8,pts.length*Math.min(4,segments)),r,Math.min(8,segments+2),false),mat,0,0,0);
 }
 return {add,cushion,disc,tube};
}

function iconVelvetBlock(THREE,s,name,u,v,z,w,d,h,material,tilt=0,exponent=.51) {
 const shape=new THREE.SphereGeometry(1,36,24),{position,normal,uv}=shape.attributes;
 const power=(value,k)=>Math.sign(value)*Math.abs(value)**k,direction=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),a=position.getZ(i);
  const px=power(x,exponent),py=power(y,exponent),pz=power(a,exponent);
  position.setXYZ(i,w*px/2,d*py/2,h*pz/2);
  direction.set(power(x,2-exponent)/w,power(y,2-exponent)/d,power(a,2-exponent)/h).normalize();
  normal.setXYZ(i,direction.x,direction.y,direction.z);
  uv.setXY(i,.5+px*.5,.5+pz*.47+py*.03);
 }
 const piece=s.add(name,shape,material,u,v,z);piece.rotateX(tilt);return piece;
}

function iconVelvetSectional(THREE,frame,s,p) {
 const {item,width:w,depth:d}=frame;
 const cover=(name,u,v,z,width,depth,height,tilt=0)=>iconVelvetBlock(THREE,s,name,u,v,z,width,depth,height,p.powder,tilt);
 s.cushion('recessed-foot',w/2,d/2,.013,w-.38,d-.35,.026,.012,p.shadow);
 s.cushion('upholstered-deck',w/2,d/2,.120,w-.070,d-.094,.215,.074,p.powder);
 if(item.type==='ottoman'){
  cover('loose-cushion',w/2,d/2,.252,w,d,.431);
  return;
 }
 s.cushion('upholstered-backing',w/2,.17,.427,w-.128,.196,.412,.084,p.powder);
 const divisions=[.264,(w-1+.264)/2,w-1,w];
 for(let i=0;i<3;i++){
  const left=divisions[i]+(i?.003:0),right=divisions[i+1]-(i===2?0:.003);
  const center=(left+right)/2,width=right-left;
  cover(i===1?'seat':'seat-'+i,center,(d+.11)/2,.252,width,d-.11,.431);
  cover(i===1?'back':'back-'+i,center,.205,.482,width,.355,.678,.075);
 }
 cover('arm',.143,d*.51,.337,.286,d*.98,.588);
 iconVelvetBlock(THREE,s,'scatter-striped',w*.63,.444,.603,.60,.175,.306,p.burgundyStripe,.22,.65).rotateY(-.07);
 const round=new THREE.SphereGeometry(1,40,28),{position,normal}=round.attributes;
 const tangent=new THREE.Vector3();
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),r=Math.hypot(x,z),theta=Math.atan2(z,x);
  const gather=.006*(1-Math.cos(42*theta))*r**9,thickness=.088*(1-.09*Math.abs(y)**8);
  position.setXYZ(i,x*(.220-gather),y*thickness,z*(.216-gather));
  tangent.set(x/.220,y/thickness,z/.216).normalize();normal.setXYZ(i,tangent.x,tangent.y,tangent.z);
 }
 const pillow=s.add('scatter-round-olive',round,p.oliveVelvet,w*.781,.433,.644);
 pillow.rotateX(.22);pillow.rotateY(.08);
}

function iconHorseshoeChair(THREE,frame,s,p) {
 const {width:w,depth:d}=frame,cx=w/2,cy=d*.51,rx=w*.377,ry=d*.381,r=.113;
 const start=Math.PI*.76,arc=Math.PI*1.48;
 const location=t=>{
  const angle=start+arc*t;
  return [cx+rx*Math.cos(angle),cy+ry*Math.sin(angle),.618-.048*Math.sin(angle)];
 };
 const hoop=new THREE.TorusGeometry(1,r,20,96,arc),{position,uv}=hoop.attributes;
 for(let i=0;i<position.count;i++){
  const t=uv.getX(i),v=uv.getY(i)*2*Math.PI,a=start+arc*t,[x,y,z]=location(t);
  const seam=Math.exp(-((Math.sin(Math.PI*t*4)/.08)**2));
  const radius=r-.0032*seam,side=radius*Math.cos(v);
  position.setXYZ(i,x+Math.cos(a)*side,y+Math.sin(a)*side,z+radius*Math.sin(v));
 }
 hoop.computeVertexNormals();s.add('horseshoe-back',hoop,p.barrelBlue,0,0,0);
 for(const [i,t] of [0,.5,1].entries()){
  const [x,y,z]=location(t);
  iconVelvetBlock(THREE,s,'wrapped-support-'+i,x,y,z/2+.008,r*1.88,r*1.90,z+.016,p.barrelBlue,0,.52);
  if(t!==.5)iconVelvetBlock(THREE,s,'rounded-end-'+i,x,y,z,r*2,r*2,r*2,p.barrelBlue,0,1);
 }
 iconVelvetBlock(THREE,s,'seat',cx,cy+.024,.324,w*.81,d*.775,.266,p.barrelBlue,0,.73);
}

function iconLivingRug(THREE,frame,s,p) {
 const {width:w,depth:d}=frame,field=d-.072;
 const body=s.cushion('woven',w/2,d/2,.0075,w,field,.015,.007,p.persian);
 const {position,uv}=body.geometry.attributes;
 for(let i=0;i<uv.count;i++)uv.setXY(i,position.getX(i)/w+.5,position.getY(i)/field+.5);
 const fibers=[],indices=[],tex=[];
 for(const side of [-1,1])for(let k=0;k<98;k++){
  const x=(k+.5)*w/98,y=side*field/2;
  const length=.025+.009*(.5+.5*Math.sin(k*38.1+side)),drift=.003*Math.sin(k*19.2);
  for(let strand=0;strand<2;strand++){
   const start=x+(strand-.5)*.005,end=start+drift+(strand-.5)*.011,idx=fibers.length/3;
   fibers.push(start-.004,y-side*.002,.006,start+.004,y-side*.002,.006,
    end+.0025,y+side*length,.003,end-.0025,y+side*length,.003);
   tex.push(0,0,1,0,1,1,0,1);
   if(side>0)indices.push(idx,idx+1,idx+2,idx,idx+2,idx+3);
   else indices.push(idx,idx+2,idx+1,idx,idx+3,idx+2);
  }
 }
 const fringe=new THREE.BufferGeometry();
 fringe.setAttribute('position',new THREE.Float32BufferAttribute(fibers,3));
 fringe.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));fringe.setIndex(indices);fringe.computeVertexNormals();
 s.add('knotted-fringe',fringe,p.linen,0,d/2,0);
}

function iconDiningCane(THREE) {
 const size=64,pixels=new Uint8Array(size*size*4);
 const strand=(t,period,width)=>Math.abs(t-period*Math.round(t/period))<width;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const warp=strand(x-3,16,2)||strand(x+3,16,2),weft=strand(y-3,16,2)||strand(y+3,16,2);
  const diagonal=strand(x+y,32,2)||strand(x-y,32,2),shade=warp?5:weft?-6:0;
  pixels.set([192+shade,153+shade,104+shade,warp||weft||diagonal?255:0],4*(y*size+x));
 }
 const map=new THREE.DataTexture(pixels,size,size);map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(6,3);map.magFilter=THREE.LinearFilter;
 map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.needsUpdate=true;
 return new THREE.MeshStandardMaterial({name:'Open handwoven cane',map,alphaTest:.4,roughness:.83,side:THREE.DoubleSide});
}

function iconDiningOval(THREE,s,w,wood,cane) {
 const pos=(x,z)=>[w/2+.192*x,.064+.047*x*x-.022*z,.724+.111*z];
 const panel=new THREE.RingGeometry(.00001,1,48,7),vertices=panel.attributes.position;
 for(let i=0;i<vertices.count;i++)vertices.setXYZ(i,...pos(vertices.getX(i),vertices.getY(i)));
 panel.computeVertexNormals();s.add('cane-panel',panel,cane,0,0,0);
 const frame=Array.from({length:33},(_,i)=>pos(Math.cos(i*Math.PI/16),Math.sin(i*Math.PI/16)));
 s.tube('back',frame,.017,wood);
}

function iconDiningChairBack(THREE,frame,s,p,wood) {
 const {item,width:w,line}=frame,c=w/2,style=item.chairStyle;
 const post=(id,x,top,y=.075)=>line('back-post-'+id,[x,.104,.422],[x,y,top],.014,wood);
 const bow=(id,z,r,drop=.035)=>s.tube(id,[[.025,.143,z-drop],[.064,.082,z-.008],[c,.046,z],[w-.064,.082,z-.008],[w-.025,.143,z-drop]],r,wood);
 if(style==='wishbone'){
  bow('back',.792,.019,.066);
  for(const x of [.035,w-.035])line('side-stay-'+x,[x,.118,.425],[x,.131,.73],.016,wood);
  for(const side of [-1,1])s.tube('fork-'+side,[[c,.080,.444],[c+side*.012,.069,.576],[c+side*.043,.061,.680],[c+side*.127,.065,.778]],.013,wood);
 }else if(style==='windsor'){
  bow('back',.851,.019,.046);
  for(let i=-3;i<=3;i++){
   const offset=i/3;line('fan-spindle-'+i,[c+offset*.135,.095,.438],[c+offset*.193,.046+.072*offset*offset,.846-.030*offset*offset],i%3?.008:.012,wood);
  }
 }else if(style==='cane'){
  for(const side of [-1,1])post(side,c+side*.147,.657,.109);
  iconDiningOval(THREE,s,w,wood,iconDiningCane(THREE));
 }else if(style==='ladder'){
  for(const x of [.044,w-.044])post(x,x,.801,.089);
  for(const [id,z] of [['lower-slat',.633],['back',.777]]){
   const board=iconVelvetBlock(THREE,s,id,c,.051,z,w-.074,.028,.067,wood,0,.40);
   const vertices=board.geometry.attributes.position;
   for(let i=0;i<vertices.count;i++)vertices.setY(i,vertices.getY(i)+.040*(vertices.getX(i)/(c-.037))**2);
   board.geometry.computeVertexNormals();
  }
 }else if(style==='upholstered'){
  for(const side of [-1,1])post(side,c+side*.121,.704,.077);
  iconVelvetBlock(THREE,s,'back',c,.068,.719,w-.032,.080,.226,p.sage,.10,.69);
 }else if(style==='bentwood'){
  s.tube('back',[[.053,.109,.437],[.038,.099,.635],[.072,.069,.778],[c,.039,.838],[w-.072,.069,.778],[w-.038,.099,.635],[w-.053,.109,.437]],.018,wood);
  s.tube('inner-loop',[[c-.102,.088,.449],[c-.121,.081,.570],[c-.086,.061,.649],[c,.054,.673],[c+.086,.061,.649],[c+.121,.081,.570],[c+.102,.088,.449]],.012,wood);
 }
}

function iconDiningChair(THREE,frame,s,p) {
 const {item,width:w,depth:d,line}=frame,style=item.chairStyle;
 const wood={wishbone:p.ash,windsor:p.espresso,cane:p.walnut,ladder:p.ash,upholstered:p.walnut,bentwood:p.espresso}[style];
 const seat=style==='upholstered'?p.sage:p.linen;
 for(const [i,left] of [true,false].entries())for(const [j,front] of [false,true].entries()){
  const footX=left?.033:w-.033,footY=front?d-.039:.045,hipX=left?.062:w-.062,hipY=front?d-.080:.101;
  const leg=new THREE.CylinderGeometry(.020,.011,.419,12);leg.rotateX(Math.PI/2);leg.translate(0,0,.419/2);
  const vertices=leg.attributes.position;
  for(let k=0;k<vertices.count;k++){
   const t=vertices.getZ(k)/.419;
   vertices.setXY(k,vertices.getX(k)+footX+(hipX-footX)*t,vertices.getY(k)+footY+(hipY-footY)*t);
  }
  leg.computeVertexNormals();s.add('tapered-leg-'+i+'-'+j,leg,wood,0,0,0);
 }
 for(const x of [.062,w-.062])line('seat-rail-'+x,[x,.101,.404],[x,d-.080,.404],.018,wood);
 for(const y of [.101,d-.080])line('seat-rail-end-'+y,[.062,y,.404],[w-.062,y,.404],.018,wood);
 const center=d*.540;
 iconVelvetBlock(THREE,s,'seat-shell',w/2,center,.425,w-.032,d*.906,.040,wood,0,.52);
 iconVelvetBlock(THREE,s,'seat',w/2,center,.452,w-.045,d*.883,.051,seat,0,.54);
 iconDiningChairBack(THREE,frame,s,p,wood);
}

function iconMadoxTable(THREE,frame,s,p) {
 const {width:w,depth:d,item,part}=frame,top=item.height,wood=iconLongGrainOak(THREE,'Beliani MADOX lacquered dark walnut',[100,65,48]);
 const radius=.044,edge=.004,shape=new THREE.Shape(),r=radius-edge;
 shape.absarc(radius,radius,r,Math.PI,1.5*Math.PI,false);
 shape.absarc(w-radius,radius,r,1.5*Math.PI,2*Math.PI,false);
 shape.absarc(w-radius,d-radius,r,0,.5*Math.PI,false);
 shape.absarc(radius,d-radius,r,.5*Math.PI,Math.PI,false);shape.closePath();
 const slab=new THREE.ExtrudeGeometry(shape,{depth:.020-2*edge,curveSegments:12,bevelSegments:3,bevelSize:edge,bevelThickness:edge});
 s.add('solid-top',slab,wood,0,0,top-.020+edge);
 part('butterfly-joint',[edge,d/2-.0007,w-edge,d/2+.0007],top,.00025,p.espresso);
 const apronBase=.64,apronHeight=top-.020-apronBase;
 const cornerX=w/2-.315,cornerY=d/2-.48,halfJoint=.025;
 for(const u of [cornerX,w-cornerX])part('long-apron-'+u,[u-.012,cornerY+halfJoint,u+.012,d-cornerY-halfJoint],apronBase,apronHeight,wood);
 for(const v of [cornerY,d-cornerY])part('end-apron-'+v,[cornerX+halfJoint,v-.012,w-cornerX-halfJoint,v+.012],apronBase,apronHeight,wood);
 for(const sx of [-1,1])for(const sy of [-1,1]){
  const shoulderX=w/2+sx*.315,shoulderY=d/2+sy*.48;
  part('corner-joint-'+sx+'-'+sy,[shoulderX-halfJoint,shoulderY-halfJoint,shoulderX+halfJoint,shoulderY+halfJoint],apronBase,apronHeight,wood);
  const leg=new THREE.BoxGeometry(1,1,1),pos=leg.attributes.position;
  for(let i=0;i<pos.count;i++){
   const t=pos.getZ(i)+.5,thickness=.032+.018*t;
   const x=w/2+sx*.344+(shoulderX-w/2-sx*.344)*t;
   const y=d/2+sy*.529+(shoulderY-d/2-sy*.529)*t;
   pos.setXYZ(i,x+thickness*pos.getX(i),y+thickness*pos.getY(i),apronBase*t);
  }
  leg.computeVertexNormals();s.add('splayed-leg-'+sx+'-'+sy,leg,wood,0,0,0);
 }
 const profile=[[0,0],[.055,0],[.059,.009],[.121,.038],[.125,.044],[.119,.046],[.091,.032],[.047,.014],[0,.012]];
 s.add('pottery-bowl',new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),40).rotateX(Math.PI/2),p.stone,w/2,d/2,top+.00025);
}

function iconLongGrainOak(THREE,name,base) {
 const tau=2*Math.PI;
 return iconFinishTexture(THREE,name,384,256,.52,(u,v)=>{
  const bend=.034*Math.sin(tau*v)+.009*Math.sin(tau*(v*2+u));
  const cut=u+bend,ring=tau*(cut*17+.27*Math.sin(cut*4*tau));
  const latewood=Math.max(0,Math.cos(ring))**7,pores=Math.max(0,Math.cos(4*ring+.9*Math.sin(tau*(u*6+v))))**10;
  const tone=4.3*Math.cos(2*tau*cut)+4*Math.sin(ring)-10*latewood-5*pores+1.6*Math.sin(73*tau*u+.6*Math.cos(tau*v));
  return base.map((c,i)=>c+tone*[1,.83,.65][i]);
 },[1,1]);
}

function iconKitchenFinishes({THREE}) {
 const lacquer=(name,color)=>new THREE.MeshStandardMaterial({name,color,roughness:.60});
 return {
  yellow:lacquer('Matte butter-yellow lacquer','#e5c368'),
  recess:lacquer('Umber cabinet shadow line','#55413a'),
  bronze:new THREE.MeshStandardMaterial({name:'Champagne bronze edge grip',color:'#977a59',roughness:.38,metalness:.58})
 };
}

function iconKitchenPanel(frame,id,l,r,b,t,face,panel,reverse=false) {
 const back=face+(reverse?.021:-.021);
 return frame.part(id,[l,Math.min(face,back),r,Math.max(face,back)],b,t-b,panel);
}

function iconKitchenGrip(frame,id,u,face,z,length,vertical,mat,reverse=false) {
 const overhang=reverse?-.021:.021,depth=[face,face+overhang].sort((a,b)=>a-b);
 if(vertical)frame.part(id,[u,depth[0],u+.008,depth[1]],z-length/2,length,mat);
 else frame.part(id,[u-length/2,depth[0],u+length/2,depth[1]],z-.005,.005,mat);
}

function iconKitchenPantry(context,frame,k) {
 const {item,width:w,depth:d,part}=frame,[x0,y0,,y1]=item.box,top=item.height,front=d-.039;
 const wall=context.data.walls.find(wall=>wall.id===item.passageWall);
 const [a,b]=wall.doors[0].map(offset=>wall.a[0]+offset-x0),head=2.1;
 part('left-carcass',[0,0,a,front-.021],.008,top-.008,k.recess);
 part('right-filler',[b,0,w,front-.021],.008,top-.008,k.recess);
 part('bridge',[a,0,b,front-.021],head,top-head,k.recess);
 for(const [i,l,r] of [[0,0,a],[1,a,b],[2,b,w]]){
  const leaf=i===1,id=leaf?'closed-leaf':i===0?'left-front':'right-front';
  iconKitchenPanel(frame,id,l+.003,r-.003,.008,head-.003,front,k.yellow);
  iconKitchenPanel(frame,'crown-'+i,l+.003,r-.003,head+.002,top,front,k.yellow);
  if(!leaf)context.obstacle('furniture-'+item.id+'-'+(i===0?'left':'right'),[x0+l,y0,x0+r,y1],0,top);
 }
 iconKitchenGrip(frame,'leaf-pull',b-.017,front,1.025,.20,true,k.bronze);
 context.obstacle('furniture-'+item.id,[x0+a,y0,x0+b,y1],head,top);
}

function iconKitchenMosaic(context,frame,left,right,bottom,top) {
 const {THREE,mesh}=context,vertices=[],colors=[],cols=24,rows=15;
 const glaze=['#eaddc7','#e4d4b8','#f0e6d2','#885644','#68515a'].map(c=>new THREE.Color(c));
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const edge=Math.min(row,rows-1-row,col,cols-1-col);
  const speck=col%5===4&&row%5===2,pattern=edge===0?3:edge===1?4:speck?3:(row*7+col*13)%3;
  const tone=glaze[pattern],dx=(right-left)/cols,dz=(top-bottom)/rows;
  const x=left+col*dx+.0009,z=bottom+row*dz+.0009;
  const r=x+dx-.0018,t=z+dz-.0018;
  for(const [u,h] of [[x,z],[x,t],[r,t],[x,z],[r,t],[r,z]]){
   vertices.push(...frame.point(u,.036,h));colors.push(tone.r,tone.g,tone.b);
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
 mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.34}),frame.item.id+'-glazed-tiles');
}

function iconKitchenEspresso(frame,s,p,x,z) {
 const {part}=frame;
 s.cushion('espresso-body',x,.164,z+.17,.22,.188,.33,.036,p.clay);
 s.cushion('espresso-hood',x,.265,z+.29,.225,.186,.10,.032,p.clay);
 s.cushion('espresso-tray',x,.301,z+.022,.210,.139,.038,.012,p.silver);
 s.disc('espresso-group',x,.32,z+.219,.036,.036,.023,p.silver);
 s.tube('portafilter',[[x,.32,z+.225],[x+.032,.331,z+.221],[x+.087,.351,z+.216]],.009,p.shadow);
 s.disc('espresso-cup-foot',x,.32,z+.041,.021,.021,.004,p.chalk);
 s.disc('espresso-cup',x,.32,z+.045,.033,.033,.044,p.chalk);
 s.disc('espresso-crema',x,.32,z+.089,.029,.029,.001,p.cocoa);
 s.tube('cup-ear',[[x+.028,.32,z+.079],[x+.046,.32,z+.077],[x+.045,.32,z+.061],[x+.029,.32,z+.059]],.004,p.chalk);
 part('brew-switch',[x-.065,.355,x-.044,.36],z+.287,.014,p.silver);
}

function iconKitchenNiche(context,frame,s,p,k) {
 const {width:w,depth:d,part}=frame,top=context.data.levels.groundCeiling;
 const counter=frame.item.height,upper=1.58,crown=2.1,front=d-.065,bay=w/5;
 part('slab-backsplash',[0,0,w,.029],counter,upper-counter,p.chalk);
 const left=.056,right=bay*1.69;
 part('mosaic-grout',[left,.029,right,.035],counter+.013,upper-counter-.028,p.putty);
 iconKitchenMosaic(context,frame,left,right,counter+.013,upper-.015);
 iconKitchenEspresso(frame,s,p,(left+right)/2,counter);
 part('niche-end-trim',[.010,.029,.028,.393],counter,upper-counter,p.accentWalnut);
 part('upper-carcass',[0,0,w,.423],upper,crown-upper,k.recess);
 part('crown-carcass',[0,0,w,front-.021],crown,top-crown,k.recess);
 for(let i=0;i<5;i++){
  const l=bay*i+.0025,r=bay*(i+1)-.0025;
  iconKitchenPanel(frame,'upper-'+i,l,r,upper,crown-.003,.445,k.yellow);
  iconKitchenPanel(frame,'crown-'+i,l,r,crown+.002,top,front,k.yellow);
 }
 part('niche-light',[.036,.38,w-.036,.39],upper-.008,.008,frame.mats.lamp);
}

function iconIslandOven(context,frame,s,p,k,x,face) {
 const {THREE}=context,{part,line}=frame,w=.595,h=.595,top=.889,bottom=top-h;
 const left=x-w/2,right=x+w/2,back=face+.515,sill=bottom+.060,lintel=top-.161;
 const box=(id,l,a,r,b,z,height,material)=>part('oven-'+id,[l,a,r,b],z,height,material);
 const steel=new THREE.MeshStandardMaterial({name:'Oven satin stainless steel',color:'#a6a7a3',roughness:.38,metalness:.66});
 const enamel=new THREE.MeshStandardMaterial({name:'Oven cavity enamel',color:'#414644',roughness:.38,metalness:.25});
 const glass=new THREE.MeshStandardMaterial({name:'Smoked oven door glass',color:'#41504e',roughness:.13,metalness:.12,transparent:true,opacity:.49,depthWrite:false});
 box('enamel-back',left+.025,back,right-.025,back+.012,sill,lintel-sill,enamel);
 box('enamel-floor',left+.025,face+.027,right-.025,back+.012,sill-.009,.009,enamel);
 box('enamel-ceiling',left+.025,face+.027,right-.025,back+.012,lintel,.009,enamel);
 for(const u of [left,right-.025])box('jamb-'+u,u,face,u+.025,back+.012,bottom,h,p.black);
 box('lower-trim',left+.025,face,right-.025,face+.027,bottom,sill-bottom,p.black);
 box('door-rail',left+.025,face,right-.025,face+.027,lintel,.071,p.black);
 box('fascia',left+.025,face+.001,right-.025,face+.030,lintel+.076,top-lintel-.076,p.black);
 box('vent-baffle',left,face+.020,right,face+.030,top,frame.item.height-.05-top,p.black);
 for(const z of [top+.005,top+.012])box('vent-lip-'+z,left+.015,face+.012,right-.015,face+.020,z,.002,enamel);
 box('window',left+.025,face+.003,right-.025,face+.009,sill,lintel-sill,glass).castShadow=false;
 for(const [i,z] of [sill+.088,sill+.194].entries()){
  for(const y of [face+.065,back-.04])line('oven-rack-bar-'+i+'-'+y,[left+.035,y,z],[right-.035,y,z],.004,steel);
  for(let j=0;j<12;j++){
   const u=left+.039+j*(w-.078)/11;
   line('oven-rack-wire-'+i+'-'+j,[u,face+.065,z+.004],[u,back-.04,z+.004],.0023,steel);
  }
 }
 const fan=new THREE.TorusGeometry(.067,.004,8,32);fan.rotateX(Math.PI/2);
 s.add('oven-fan-ring',fan,steel,x,back-.006,(sill+lintel)/2);
 for(let i=0;i<6;i++){
  const blade=new THREE.CircleGeometry(.024,12);blade.scale(1,.42,1);blade.translate(.032,0,0);
  blade.rotateZ(i*Math.PI/3);blade.rotateX(Math.PI/2);
  s.add('oven-fan-blade-'+i,blade,steel,x,back-.008,(sill+lintel)/2);
 }
 for(const u of [left+.072,right-.072]){
  box('handle-foot-'+u,u-.013,face-.034,u+.013,face,lintel+.030,.023,steel);
  s.add('oven-selector-'+u,new THREE.CylinderGeometry(.022,.022,.018,24),steel,u,face-.008,top-.044);
  box('index-'+u,u-.0014,face-.0178,u+.0014,face-.0172,top-.035,.009,p.black);
 }
 box('handle',left+.053,face-.041,right-.053,face-.034,lintel+.025,.033,steel);
 box('clock',x-.070,face-.002,x+.070,face+.001,top-.067,.045,p.screen);
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=32;
  const ink=canvas.getContext('2d');ink.fillStyle='#e8e4d0';ink.font='22px monospace';ink.textAlign='center';ink.fillText('12:00',64,24);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const dial=s.add('oven-clock-digits',iconLabelPlane(context,.107,.027).rotateZ(Math.PI),
   new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false}),x,face-.0025,top-.045);
  dial.castShadow=dial.receiveShadow=false;
 }
 iconKitchenPanel(frame,'oven-tray-drawer',left,right,.122,bottom-.005,face,k.yellow,true);
 iconKitchenGrip(frame,'oven-tray-pull',x,face,bottom-.005,.145,false,k.bronze,true);
}

function iconSamsungFinishes({THREE}) {
 const finish=(name,color,roughness,extra={})=>new THREE.MeshStandardMaterial({name,color,roughness,...extra});
 const steel=iconFinishTexture(THREE,'Samsung Metal Cooling brushed aluminium',64,256,.42,(u,v)=>{
  const grain=1.2*Math.sin(2*Math.PI*(123*v+.25*Math.sin(2*Math.PI*u)))+1.6*Math.sin(2*Math.PI*59*v);
  return [179+grain,183+grain,185+grain];
 });
 steel.metalness=.24;
 return {steel,white:finish('Snow White moulded liner','#f1f2ef',.32),trim:finish('Porcelain shelf trim','#d1d6d7',.39),
  gasket:finish('Door bellows','#adb5b7',.78),slot:finish('Cold-air outlet','#424b51',.64),
  glass:finish('Tempered shelf glass','#c3e1df',.13,{transparent:true,opacity:.31,depthWrite:false}),
  smoke:finish('Clear smoked storage bin','#a4adb0',.21,{transparent:true,opacity:.55,depthWrite:false}),
  rim:finish('Smoked polycarbonate rim','#80909a',.24),lamp:finish('Ceiling LED diffuser','#f6ffff',.35,{emissive:'#e1f5ff',emissiveIntensity:.6})};
}

function iconLabelPlane({THREE,group},width,height) {
 const face=new THREE.PlaneGeometry(width,height).rotateX(Math.PI/2).rotateZ(Math.PI);
 // The mirrored floor plan reverses printed artwork when viewed from the aisle.
 if(group.matrix.determinant()<0){
  const uv=face.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
 }
 return face;
}

function iconSamsungMark(context,frame,tag,label,x,y,z,width,height) {
 const {THREE}=context;
 if(typeof document==='undefined')return;
 const flake=label==='❄',canvas=document.createElement('canvas');canvas.width=flake?64:256;canvas.height=64;
 const ink=canvas.getContext('2d');if(!ink)return;
 if(flake){
  ink.translate(32,32);ink.strokeStyle='#d5dcdd';ink.lineWidth=3;
  for(let arm=0;arm<6;arm++){
   ink.beginPath();ink.moveTo(0,0);ink.lineTo(0,29);ink.moveTo(-6,22);ink.lineTo(0,15);ink.lineTo(6,22);
   ink.stroke();ink.rotate(Math.PI/3);
  }
 }else{
  ink.textAlign='center';ink.textBaseline='middle';ink.font='600 36px Arial,sans-serif';
  ink.fillStyle='#536067';ink.fillText(label,128,32,248);
 }
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});
 const geometry=iconLabelPlane(context,width,height);
 const mesh=iconLivingShapes(context,frame).add(tag+'-print',geometry,mat,x,y,z);
 mesh.castShadow=mesh.receiveShadow=false;mesh.renderOrder=2;
}

function iconSamsungDrawers(context,frame,id,x,front,base,heights,m) {
 let bottom=base+.06;
 for(const [i,height] of heights.entries()){
  const name=id+'-drawer-'+i,back=front-.407,top=bottom+height;
  const bin=(tag,l,r,y0,y1,b,t,mat)=>frame.part(name+'-'+tag,[x+l,y0,x+r,y1],b,t-b,mat);
  bin('floor',-.221,.221,back,front,bottom,bottom+.008,m.trim);
  bin('rear',-.221,.221,back,back+.009,bottom+.008,top-.024,m.trim);
  for(const side of [-.221,.214])bin('side-'+side,side,side+.007,back+.009,front-.008,bottom+.008,top-.011,m.smoke);
  bin('front',-.221,.221,front-.008,front,bottom+.008,top-.019,m.smoke);
  bin('grip',-.219,.219,front-.016,front+.002,top-.019,top,m.rim);
  if(i===0&&id==='fridge')bin('recessed-pull',-.186,.186,front,front+.004,top-.088,top-.049,m.rim);
  const label=id==='freezer'?'❄':['Fresh Box','Optimal Fresh+','Humidity Fresh+'][i];
  iconSamsungMark(context,frame,name,label,x+(id==='freezer'?.157:0),front+.003,bottom+height*.40,id==='freezer'?.062:.206,id==='freezer'?.062:.036);
  bottom=top+.009;
 }
}

function iconSamsungCavity(context,frame,id,x,face,base,m) {
 // The 510 mm carcass ends behind a 40 mm appliance door and a separate 21 mm joinery front.
 const nose=face-.061,rear=nose-.510,inner=rear+.042,top=base+1.775;
 const plate=(tag,l,r,a,b,z0,z1,mat)=>frame.part(id+'-'+tag,[x+l,a,x+r,b],z0,z1-z0,mat);
 plate('back',-.270,.270,rear,inner,base,top,m.white);
 plate('metal-duct',-.199,.199,inner,inner+.007,base+.064,top-.118,m.steel);
 for(const side of [-.270,.233])plate('jamb-'+side,side,side+.037,inner,nose,base,top,m.white);
 plate('sill',-.233,.233,inner,nose,base,base+.057,m.white);
 plate('lintel',-.233,.233,inner,nose-.004,top-.074,top,m.white);
 plate('led',-.108,.108,rear+.157,nose-.067,top-.079,top-.074,m.lamp);
 plate('control-strip',-.125,.125,nose-.004,nose-.002,top-.049,top-.012,m.trim);
 iconSamsungMark(context,frame,id+'-header','SAMSUNG',x-.192,nose-.003,top-.032,.105,.025);
 iconSamsungMark(context,frame,id+'-display',id==='fridge'?'03°':'−18°',x,nose-.001,top-.032,.082,.028);
 for(const [i,h] of [1.575,1.427,1.282].entries()){
  const width=i?.049:.147;
  for(const offset of i?[-.061,.061]:[0])plate('vent-'+i+'-'+offset,offset-width/2,offset+width/2,inner+.007,inner+.009,base+h,base+h+.007,m.slot);
 }
 iconSamsungMark(context,frame,id+'-duct','Metal Cooling',x,inner+.010,base+1.503,.207,.040);
 const fridge=id==='fridge',shelfFront=nose-(fridge?.121:.028);
 for(const [i,h] of (fridge?[.85,1.051,1.261,1.477]:[1.252,1.454]).entries()){
  const z=base+h;
  plate('shelf-'+i,-.231,.231,inner+.009,shelfFront,z,z+.006,m.glass);
  plate('shelf-nose-'+i,-.232,.232,shelfFront-.004,shelfFront+.006,z-.003,z+.009,m.trim);
  for(const side of [-.233,.222])plate('shelf-rail-'+i+'-'+side,side,side+.011,inner+.011,shelfFront,z-.013,z,m.white);
 }
 if(fridge)plate('humidity-slider',-.030,.030,shelfFront-.002,shelfFront+.008,base+.855,base+.862,m.rim);
 iconSamsungDrawers(context,frame,id,x,nose-.024,base,fridge?[.396,.174,.189]:[.254,.251,.252,.174,.170],m);
}

function iconSamsungDoor(context,frame,id,x,face,base,left,right,head,m,k) {
 const top=base+1.775,nose=face-.021,inner=nose-.040,swing=id==='fridge'?1:-1;
 const plate=(tag,l,r,a,b,z0,z1,mat)=>frame.part(id+'-door-'+tag,[x+l,a,x+r,b],z0,z1-z0,mat);
 iconKitchenPanel(frame,id,left+.003,right-.003,base-.012,head-.003,face,k.yellow);
 const pullX=swing>0?right-.026:left+.018;
 iconKitchenGrip(frame,id+'-pull',pullX,face,1.03,.275,true,k.bronze);
 plate('white-skin',-.27,.27,inner+.006,nose,base,top,m.white);
 plate('bellows',-.257,.257,inner+.002,inner+.006,base+.020,top-.021,m.gasket);
 plate('lining',-.248,.248,inner,inner+.002,base+.030,top-.034,m.white);
 plate('metal',-.216,.216,inner-.002,inner,base+.059,top-.059,m.steel);
 if(id==='fridge'){
  for(const [i,h] of [.887,1.267,1.425,1.580].entries()){
   const z=base+h,depth=i?.095:.109,height=i?.057:.092;
   plate('bin-'+i+'-floor',-.209,.209,inner-depth,inner-.002,z,z+.006,m.trim);
   plate('bin-'+i+'-front',-.209,.209,inner-depth,inner-depth+.006,z+.006,z+height-.005,m.smoke);
   for(const side of [-.209,.203])plate('bin-'+i+'-side-'+side,side,side+.006,inner-depth+.006,inner-.002,z+.006,z+height-.005,m.smoke);
   plate('bin-'+i+'-lip',-.210,.210,inner-depth-.001,inner-depth+.007,z+height-.005,z+height,m.rim);
  }
 }
}

function iconSamsungTower(context,frame,k,face) {
 const {width:w,part,item}=frame,base=.133,top=base+1.775,head=2.1,m=iconSamsungFinishes(context);
 const shelfFinish=iconLivingPalette(context).ash;
 // The right end cheek also carries the existing kitchen/hall light switch.
 part('body',[w-.018,0,w,face-.021],.118,item.height-.118,k.yellow);
 part('left-cheek',[0,0,.018,face-.021],.118,item.height-.118,k.yellow);
 part('centre-divider',[w/2-.009,0,w/2+.009,face-.021],base,head-base,k.recess);
 part('support-shelf',[.018,0,w-.018,face-.022],.115,base-.115,k.recess);
 part('bridge',[.018,0,w-.018,face-.022],head,item.height-head,k.recess);
 for(const [i,id] of ['fridge','freezer'].entries()){
  const left=w*i/2,right=w*(i+1)/2,x=(left+right)/2;
  part(id+'-toe-vent',[x-.206,face-.064,x+.206,face-.062],.037,.064,m.slot);
  for(let rib=0;rib<4;rib++)part(id+'-grille-'+rib,[x-.203,face-.062,x+.203,face-.060],.043+rib*.016,.004,m.rim);
  iconKitchenPanel(frame,'crown-'+i,left+.003,right-.003,head+.002,item.height,face,k.yellow);
  // Fill the strips outside the 540 mm appliance; the food compartment itself is hollow.
  for(const [j,a,b] of [[0,left+.018,x-.270],[1,x+.270,right-.018]])
   part(id+'-filler-'+j,[a,0,b,face-.023],base,1.775,m.white);
  const bodyStart=context.group.children.length;
  const l=left+(i?.009:.018),r=right-(i?.018:.009),floor=top+.012,back=.052,edge=face-.025;
  part(id+'-dry-shelf',[l,back,r,edge],floor,.018,shelfFinish);
  part(id+'-dry-back',[l,back,r,back+.009],floor+.018,head-floor-.027,shelfFinish);
  part(id+'-dry-ceiling',[l,back,r,edge],head-.009,.009,shelfFinish);
  iconSamsungCavity(context,frame,id,x,face,base,m);
  const doorStart=context.group.children.length;
  iconSamsungDoor(context,frame,id,x,face,base,left,right,head,m,k);
  const hinge=frame.point(i?right-.003:left+.003,face);
  (frame.appliances??=[]).push({id,hinge,body:context.group.children.slice(bodyStart,doorStart),door:context.group.children.slice(doorStart)});
 }
}

function iconMountSamsung(context,{id,hinge,body,door}) {
 const {THREE,group}=context,model=id==='fridge'?'BRR29703EWW/EF':'BRZ22700EWW/EF';
 const fixed=new THREE.Group(),pivot=new THREE.Group(),mount=new THREE.Group();
 fixed.name='kitchen-'+id+'-body';fixed.userData={kind:'appliance-body',appliance:id,model};
 pivot.name='kitchen-'+id+'-door';pivot.position.set(...hinge);
 pivot.userData={kind:'appliance-door',appliance:id,model,dynamic:true,closedYaw:0,openYaw:(id==='fridge'?1:-1)*Math.PI/2};
 // Compensate for the pivot while keeping each part's original furniture coordinates.
 mount.position.copy(pivot.position).multiplyScalar(-1);
 for(const mesh of [...body,...door])if(mesh.material.transparent)mesh.castShadow=false;
 for(const mesh of door)mesh.userData.dynamic=true;
 group.add(fixed,pivot);fixed.add(...body);pivot.add(mount);mount.add(...door);
}

function iconKitchenDrawers(frame,k,start,end,count,face,reverse=false,first=0) {
 const w=(end-start)/count,panel=k.yellow,top=frame.item.height-.055;
 for(let i=0;i<count;i++){
  const l=start+w*i+.0025,r=start+w*(i+1)-.0025,x=(l+r)/2;
  const rows=reverse?[[.122,.490],[.497,top]]:i===2?[[.122,top]]:[[.122,.634],[.641,top]];
  for(const [j,[b,t]] of rows.entries()){
   iconKitchenPanel(frame,(reverse?'working-drawer-':'front-')+(first+i)+'-'+j,l,r,b,t,face,panel,reverse);
   iconKitchenGrip(frame,(reverse?'working-pull-':'drawer-pull-')+(first+i)+'-'+j,x,face,t,.145,false,k.bronze,reverse);
  }
 }
}

function iconPaletZigZag(THREE) {
 const pitch=.151,tiles=4,period=pitch*tiles,green=[55,84,75],ivory=[247,243,220];
 // The two Zig Zag Half stencils alternate by course, each with three soft-edged pairs.
 const material=iconFinishTexture(THREE,'Palet Zig Zag Half 173 / 334',512,512,.32,(u,v)=>{
  const x=u*tiles,y=v*tiles,col=Math.floor(x),row=Math.floor(y),a=x-col,b=y-row;
  const edge=Math.min(a,1-a,b,1-b)*pitch;
  if(edge<.001)return [174,172,151];
  const phase=a*3,cosine=Math.sin(phase*2*Math.PI),offset=.052*Math.sin(phase*2*Math.PI);
  const seam=Math.tanh((b-.5+offset)*34),run=(row%2?-1:1)*cosine*seam;
  const stipple=Math.sin(3521*u+1703*v)*Math.cos(2239*u-2737*v);
  const amount=Math.min(1,Math.max(0,.5+run*4.8+stipple*.10));
  const kiln=1.8*Math.sin((col+row*5)*5.31)+stipple*2.6;
  return green.map((channel,i)=>channel+(ivory[i]-channel)*amount+kiln);
 },[1/period,1/period]);
 material.userData.source='https://palet.shop/shop?color-1=173&color-2=334&design=zig-zag-half';
 return material;
}

function iconIslandWorktop({THREE},frame,s,p) {
 const {width:w,depth:d,item}=frame,{height,socket}=item;
 if(!socket)return frame.part('top',[0,0,w,d],height-.05,.05,p.stone);
 const [cx,cy]=socket.center,[sw,sd]=socket.size;
 const rectangle=(shape,x,y,width,depth)=>{
  shape.moveTo(x,y);shape.lineTo(x+width,y);shape.lineTo(x+width,y+depth);shape.lineTo(x,y+depth);shape.closePath();return shape;
 };
 const plate=(name,outline,hole,z,thickness,material)=>{
  const shape=rectangle(new THREE.Shape(),...outline);
  if(hole)shape.holes.push(rectangle(new THREE.Path(),...hole));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});
  return s.add(name,geometry,material,0,0,z);
 };
 const opening=[cx-sw/2,cy-sd/2,sw,sd],bevelX=sw<sd?.010:.019,bevelY=sw<sd?.019:.010;
 const reveal=[opening[0]+bevelX,opening[1]+bevelY,sw-2*bevelX,sd-2*bevelY];
 const lid=[reveal[0]+.0017,reveal[1]+.0017,reveal[2]-.0034,reveal[3]-.0034];
 const aluminium=iconFinishTexture(THREE,'White brushed aluminium socket cover',32,256,.41,(_u,v)=>{
  const hairline=1.7*Math.sin(2*Math.PI*93*v)+1.2*Math.cos(2*Math.PI*47*v);
  return [235+hairline,235+hairline,232+hairline];
 },[1,6]);aluminium.metalness=.27;
 const slab=plate('top',[0,0,w,d],opening,height-.05,.05,p.stone);
 const uv=slab.geometry.attributes.uv,normal=slab.geometry.attributes.normal;
 for(let i=0;i<uv.count;i++)if(Math.abs(normal.getZ(i))>.9)uv.setXY(i,uv.getX(i)/w,uv.getY(i)/d);
 plate('socket-housing',opening,null,height-.060,.057,p.black);
 plate('socket-bezel',opening,reveal,height-.003,.003,aluminium);
 plate('socket-lid',lid,null,height-.0029,.0026,aluminium);
}

function iconKitchenIslandTiles({THREE,mesh},frame,back) {
 const {width:w,depth:d,item,point,part}=frame;
 const inset=.018,y0=back,y1=d-inset,x0=inset,x1=w-inset;
 const bottom=.018,top=item.height-.05,thick=.024;
 const grout=new THREE.MeshStandardMaterial({name:'Island tile backing',color:'#68635c',roughness:.85});
 for(const [id,box] of [['left',[x0+.001,y0,x0+thick,y1-.001]],
                        ['right',[x1-thick,y0,x1-.001,y1-.001]],
                        ['salon',[x0+thick,y1-thick,x1-thick,y1-.001]]])
  part('tile-backing-'+id,box,bottom,top-bottom,grout);
 const points=[[x0,y0],[x0,y1],[x1,y1],[x1,y0]],vertices=[],uv=[],indices=[];
 let run=0;
 for(let i=0;i<3;i++){
  const a=points[i],b=points[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),idx=i*4;
  vertices.push(...point(...a,bottom),...point(...a,top),...point(...b,top),...point(...b,bottom));
  uv.push(run,0,run,top-bottom,run+len,top-bottom,run+len,0);
  indices.push(idx,idx+1,idx+2,idx,idx+2,idx+3);
  run+=len;
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 mesh(g,iconPaletZigZag(THREE),item.id+'-palet-zigzag-cladding');
}

function iconLivingKitchen(context,frame,s,p) {
 const {item,width:w,depth:d,part}=frame;
 if(item.id==='kitchen-sink'){
  part('rim',[0,0,w,d],.002,.012,p.black);part('basin',[.035,.025,w-.035,d-.025],.014,.003,p.shadow);
  s.tube('arched-spout',[[w*.5,.035,.014],[w*.5,.035,.21],[w*.5,.062,.30],[w*.5,.15,.31],[w*.5,.19,.26],[w*.5,.19,.22]],.012,p.brass);return;
 }
 if(item.id==='hob'){
  part('glass',[0,0,w,d],0,.012,p.black);
  for(const x of [.17,w-.17])for(const y of [.16,d-.16])s.disc('induction-zone-'+x+'-'+y,x,y,.012,.105,.105,.001,p.screen);
  return;
 }
 const k=context.kitchenFinishes??=iconKitchenFinishes(context);
 if(item.id==='kitchen-pantry'){iconKitchenPantry(context,frame,k);return;}
 const island=item.id==='kitchen-island',tall=item.id==='kitchen-tall',height=item.height;
 const face=island?d-.15:d-.065,end=island?.053:0,back=island?.045:0;
 part('recessed-plinth',[.064,back+.049,w-.064,(tall?d-.035:face)-.064],.014,.105,p.shadow);
 if(tall){iconSamsungTower(context,frame,k,d-.035);return;}
 if(island){
  const hob=context.data.furniture.find(unit=>unit.id==='hob');
  const center=hob?(hob.box[0]+hob.box[2])/2-item.box[0]:w/2,left=center-.30,right=center+.30;
  const carcass=new context.THREE.Shape(),near=back+.021,far=face-.021,nicheBack=back+.56;
  carcass.moveTo(end,near);carcass.lineTo(left,near);carcass.lineTo(left,nicheBack);carcass.lineTo(right,nicheBack);
  carcass.lineTo(right,near);carcass.lineTo(w-end,near);carcass.lineTo(w-end,far);carcass.lineTo(end,far);carcass.closePath();
  s.add('body',new context.THREE.ExtrudeGeometry(carcass,{depth:height-.168,bevelEnabled:false}),k.yellow,0,0,.118);
  iconIslandWorktop(context,frame,s,p);
  iconKitchenIslandTiles(context,frame,back);
  iconKitchenDrawers(frame,k,end,left,3,back,true);
  iconKitchenDrawers(frame,k,right,w-end,3,back,true,3);
  iconIslandOven(context,frame,s,p,k,center,back);
 }else{
  part('body',[0,0,w,face-.021],.118,height-.168,k.yellow);
  part('top',[0,0,w,d],height-.05,.05,p.stone);
  iconKitchenDrawers(frame,k,0,w,5,face);
  iconKitchenNiche(context,frame,s,p,k);
 }
}

function iconYoffersTambour(THREE,w,d,bottom,top) {
 const r=d/2-.006,left=d/2,right=w-left,arc=Math.PI*r,straight=right-left;
 const length=arc*2+straight,n=Math.round(length/.027/2)*2;
 const positions=[],uv=[],colors=[],indices=[];
 // Develop the two sliding fronts around both radiused ends to the straight rear panel.
 function at(s){
  if(s<arc){
   const a=-Math.PI/2-s/r;
   return [left,d/2,Math.cos(a),Math.sin(a)];
  }
  if(s>arc+straight){
   const a=Math.PI/2-(s-arc-straight)/r;
   return [right,d/2,Math.cos(a),Math.sin(a)];
  }
  return [left+s-arc,d/2,0,1];
 }
 for(let i=0;i<=n*8;i++){
  const s=length*i/(n*8),phase=(i%8)/8,profile=Math.abs(Math.sin(Math.PI*phase));
  const [cx,cy,nx,ny]=at(s),radius=r-.005*(1-profile)**2-(i===n*4?.0015:0);
  const shade=.84+.16*profile;
  for(const z of [bottom,top]){
   positions.push(cx+radius*nx,cy+radius*ny,z);
   uv.push(s/.58,z/1.15);colors.push(shade,shade,shade);
  }
  if(i){
   const a=2*(i-1);
   indices.push(a,a+1,a+2,a+1,a+3,a+2);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 g.setIndex(indices);g.computeVertexNormals();return g;
}

function iconLivingYoffers({THREE},frame,s) {
 const {width:w,depth:d,item,part}=frame,r=d/2,base=.193,rim=.017,top=item.height;
 const oak=iconLongGrainOak(THREE,'Yoffers natural pale oak',[199,164,118]);
 const drum=oak.clone();drum.vertexColors=true;
 const cap=new THREE.Shape();
 cap.moveTo(r,0);cap.lineTo(w-r,0);
 cap.absarc(w-r,r,r,-Math.PI/2,Math.PI/2,false);cap.lineTo(r,d);
 cap.absarc(r,r,r,Math.PI/2,1.5*Math.PI,false);cap.closePath();
 const g=new THREE.ExtrudeGeometry(cap,{depth:rim,curveSegments:24,bevelEnabled:false});
 const {position,normal,uv}=g.attributes;
 for(let i=0;i<uv.count;i++){
  const capFace=Math.abs(normal.getZ(i))>.5;
  uv.setXY(i,(capFace?position.getY(i):position.getZ(i))/.70,position.getX(i)/1.42);
 }
 s.add('bottom-rim',g,oak,0,0,base);
 s.add('top',g,oak,0,0,top-rim);
 s.add('body',iconYoffersTambour(THREE,w,d,base+rim,top-rim),drum,0,0,0);
 part('plain-back',[r,.010,w-r,.021],base+rim,top-base-2*rim,oak);
 for(const [i,x] of [.213,w-.213].entries()){
  for(const [j,y] of [.080,d-.080].entries())s.disc('dowel-leg-'+i+'-'+j,x,y,0,.017,.017,base,oak);
  part('side-stretcher-'+i,[x-.011,.08,x+.011,d-.08],.127,.039,oak);
 }
 part('underframe-rail',[.213,d/2-.014,w-.213,d/2+.014],.15,.043,oak);
}

function iconMediaArtBook({THREE},s,name,u,v,z,w,d,h,angle,cover,pages) {
 const board=.003;
 function layer(id,width,depth,height,offsetY,base,material) {
  const geometry=new THREE.BoxGeometry(width,depth,height);
  geometry.translate(0,offsetY,base+height/2);
  geometry.rotateZ(angle);
  s.add(name+'-'+id,geometry,material,u,v,z);
 }
 layer('back-cover',w,d,board,0,0,cover);
 layer('paper',w-.007,d-.009,h-2*board,-.001,board,pages);
 layer('spine',w,.005,h-2*board,d/2-.0025,board,cover);
 layer('front-cover',w,d,board,0,h-board,cover);
}

function iconLivingMediaAccessories(context) {
 const {THREE,data,obstacle}=context,cabinet=data.furniture.find(item=>item.id==='media-console');
 if(!cabinet)return;
 const frame=iconInteriorFurnitureFrame(context,{...cabinet,id:'media-decor'});
 const s=iconLivingShapes(context,frame),p=iconLivingPalette(context),top=cabinet.height;
 const u=.43,v=frame.depth/2;
 iconMediaArtBook(context,s,'indigo-folio',u,v,top,.331,.242,.035,-.035,p.indigo,p.chalk);
 iconMediaArtBook(context,s,'linen-folio',u+.008,v+.003,top+.035,.282,.211,.027,.055,p.linen,p.ivory);
 iconUpperCeramic(s,THREE,'footed-dish',u+.019,v+.013,top+.062,.094,.094,
  [[0,0],[.45,0],[.46,.011],[.38,.017],[.61,.022],[.88,.036],[1,.049],[.99,.054],[.90,.052],[.64,.034],[.32,.026],[0,.024]],p.cocoa);
 const urn=frame.width+.38,depth=frame.depth*.50,rx=.157,ry=.145,handleReach=.204;
 const clay=new THREE.MeshStandardMaterial({name:'Oxblood glazed earthenware',color:'#854839',roughness:.48});
 iconUpperCeramic(s,THREE,'floor-amphora',urn,depth,0,rx,ry,
  [[0,0],[.55,0],[.57,.021],[.54,.036],[.66,.08],[.82,.16],[.96,.27],[1,.35],[.98,.415],[.88,.477],[.66,.513],[.40,.538],[.37,.563],[.38,.619],[.44,.625],[.44,.641],[.35,.641],[.33,.621],[.32,.562],[.36,.544]],clay);
 for(const side of [-1,1]) {
  const at=(offset,z)=>[urn+side*offset,depth,z];
  s.tube('amphora-handle-'+side,[at(.058,.587),at(.113,.592),at(.163,.556),at(handleReach-.014,.480),at(.166,.421),at(.147,.399)],.014,clay);
 }
 const [x,y]=frame.point(urn,depth);
 obstacle('media-floor-amphora',[x-ry,y-handleReach,x+ry,y+handleReach],0,.641);
}

function iconLivingWallSconce(context) {
 const {THREE,mesh,group,mats,data}=context,p=iconLivingPalette(context);
 const wall=group.getObjectByName(data.projection.wall);
 wall.geometry.computeBoundingBox();
 const x=wall.geometry.boundingBox.max.x,y=12.78,z=1.69;
 const plate=mesh(new THREE.CylinderGeometry(.119,.129,.023,48),p.brass,'living-sconce-backplate');
 plate.rotation.z=Math.PI/2;plate.position.set(x+.0115,y,z);
 const globe=mesh(new THREE.SphereGeometry(.078,28,18),mats.lamp,'living-sconce-opal');
 globe.scale.x=.82;globe.position.set(x+.055,y,z);
 iconLocalSconceLight(context,'living',x+.156,y,z);
}

function iconLivingProjector(context) {
 const {THREE,mesh,box,beam,obstacle,data,group}=context,p=iconLivingPalette(context);
 const projection=data.projection,firstPart=group.children.length;
 const wall=group.getObjectByName(projection.wall);
 wall.geometry.computeBoundingBox();
 const target=new THREE.Vector3(wall.geometry.boundingBox.max.x,projection.centerY,projection.centerHeightM);
 const lens=new THREE.Vector3(7.51,target.y,2.57);
 const aim=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1,0,0),target.clone().sub(lens).normalize());
 const at=(x,y,z)=>new THREE.Vector3(x,y,z).applyQuaternion(aim).add(lens);
 const shapes=iconLivingShapes(context,{item:{id:'projector',facing:'+y'},point:(x,y,z)=>at(x,y,z).toArray()});
 function shell(name,x,y,z,w,d,h,r,mat){
  const piece=shapes.cushion(name,x,y,z,w,d,h,r,mat);
  piece.quaternion.premultiply(aim);
 }
 shell('base',.232,-.072,-.019,.365,.45,.107,.033,p.black);
 shell('case',.232,-.072,.033,.37,.451,.107,.032,p.ivory);
 shell('focus-dial',.107,.011,.088,.071,.043,.013,.006,p.black);
 for(let i=0;i<11;i++)shell('intake-'+i,.128+i*.020,-.298,.018,.008,.005,.055,.002,p.black);
 function optic(name,x,radius,length,mat){
  const geometry=new THREE.CylinderGeometry(radius,radius,length,48);
  geometry.rotateZ(Math.PI/2);
  const part=mesh(geometry,mat,'projector-'+name);part.position.copy(at(x,0,0));part.quaternion.copy(aim);
 }
 optic('lens-barrel',.034,.067,.064,p.black);
 optic('lens-ring',.012,.058,.022,p.espresso);
 optic('lens-glass',.003,.048,.006,p.lens);
 const terrace=context.data.facades.find(w=>w.id==='facade-terrace');
 const hub=at(.24,-.072,.084),wallX=terrace.a[0]-iconGroundFacadeDepth(terrace);
 box('projector-anchor-plate',[wallX-.022,hub.y-.093,wallX,hub.y+.093],2.55,.242,p.black);
 for(const dy of [-.066,.066])for(const z of [2.584,2.76])
  beam('projector-bolt-'+dy+'-'+z,[wallX-.029,hub.y+dy,z],[wallX-.019,hub.y+dy,z],.009,p.espresso);
 box('projector-wall-arm',[hub.x-.018,hub.y-.022,wallX-.019,hub.y+.022],2.729,.037,p.black);
 beam('projector-mount-brace',[wallX-.021,hub.y,2.593],[hub.x+.066,hub.y,2.736],.016,p.black);
 beam('projector-tilt-pivot',hub.toArray(),[hub.x,hub.y,2.739],.030,p.black);
 obstacle('projector-overhead',[lens.x-.01,hub.y-.232,wallX,hub.y+.232],2.48,2.792);
 const assembly=new THREE.Group();assembly.name='living-room-projector';
 assembly.add(...group.children.slice(firstPart));group.add(assembly);
 return iconProjectorControl(context,assembly,wall);
}

function iconLakePrint(THREE) {
 const width=640,height=360,pixels=new Uint8Array(width*height*4);
 const skyTop=[102,143,166],horizon=[248,192,141],water=[64,119,131];
 const sun=[255,225,161],farHills=[167,154,156],nearHills=[104,133,143],cape=[53,92,98],pines=[35,66,73];
 const mix=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);
 let seed=18421;
 const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
 const ink=(x,y,color,grain=0)=>{
  const index=4*(y*width+x);
  for(let i=0;i<3;i++)pixels[index+i]=Math.min(255,Math.max(0,color[i]+grain));
  pixels[index+3]=255;
 };
 const shore=u=>Math.max(.27-.67*u+.021*Math.sin(15*u),.72*(u-.84)+.010*Math.sin(29*u));
 for(let y=0;y<height;y++){
  const v=(y+.5)/height,sky=mix(horizon,skyTop,Math.max(0,(v-.44)/.56)),lake=mix(water,horizon,v*.85);
  const ripplePhase=random()*6.28;
  for(let x=0;x<width;x++){
   const u=(x+.5)/width,grain=(random()-.5)*6;
   let color=sky;
   if(Math.hypot((u-.68)*16/9,v-.66)<.105)color=sun;
   if(v<.51+.033*Math.sin(u*12+.4)+.022*Math.sin(u*22+1))color=farHills;
   if(v<.445+.04*Math.cos(u*10)+.013*Math.cos(u*23))color=nearHills;
   if(v<.39){
    color=lake;
    const spread=.015+.11*(.39-v),distance=Math.abs(u-.68+.009*Math.sin(y*1.9));
    if(distance<spread && Math.sin(1.61*y+.6*Math.sin(x*.14))>.35+distance/spread*.51)color=mix(lake,sun,.72);
    else if(Math.sin(y*2.16+.8*Math.sin(x*.041+ripplePhase))>.974)color=mix(lake,horizon,.14);
   }
   const mast=u-.54,sail=v-.308;
   if(sail>0&&sail<.063&&mast<0&&mast>(sail-.063)*.45)color=sun;
   if(sail>0&&sail<.05&&mast>.0015&&mast<(.05-sail)*.38)color=[189,109,82];
   if(sail<0&&sail>-.008&&Math.abs(mast+.002)<.026+sail*.8)color=pines;
   if(v<shore(u))color=cape;
   ink(x,y,color,grain);
  }
 }
 for(let tree=0;tree<86;tree++){
  const u=tree===0?.085:tree===1?.11:random(),x=Math.floor(u*width);
  const base=shore(u)*height-2,h=tree<2?77-tree*23:(8+random()*31)*(.4+.8*Math.abs(2*u-1));
  if(base<0)continue;
  for(let iy=0;iy<h;iy++){
   const taper=1-iy/h,half=Math.max(.65,h*.19*taper*(.62+.38*((iy%4)/3)));
   for(let ix=Math.max(0,Math.ceil(x-half));ix<=Math.min(width-1,x+half);ix++)ink(ix,Math.floor(base+iy),pines);
  }
 }
 const texture=new THREE.DataTexture(pixels,width,height);
 texture.name='Jezioro o zachodzie';texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.needsUpdate=true;
 return texture;
}

function iconProjectedPaint(THREE,paint,zone,handedness) {
 const finish=paint.clone(),image=iconLakePrint(THREE);
 finish.name='Projected lake landscape on white plaster';
 finish.onBeforeCompile=shader=>{
  shader.uniforms.lakePrint={value:image};
  shader.uniforms.projectionCenter={value:new THREE.Vector2(zone.centerY,zone.centerHeightM)};
  shader.uniforms.projectionScale={value:new THREE.Vector2(handedness/zone.widthM,1/zone.heightM)};
  shader.vertexShader='varying vec2 vWallYZ;\n'+shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\n vWallYZ = position.yz;');
  shader.fragmentShader='uniform sampler2D lakePrint; uniform vec2 projectionCenter, projectionScale; varying vec2 vWallYZ;\n'+
   shader.fragmentShader.replace('#include <opaque_fragment>',`
    vec2 imageUv = (vWallYZ - projectionCenter) * projectionScale + 0.5;
    vec2 edge = min(imageUv, 1.0 - imageUv);
    vec2 feather = smoothstep(vec2(0.0), max(fwidth(imageUv), vec2(0.0015)), edge);
    vec3 ink = texture2D(lakePrint, imageUv).rgb;
    outgoingLight = mix(outgoingLight, outgoingLight * 0.10 + ink, feather.x * feather.y);
    #include <opaque_fragment>`);
 };
 return finish;
}

function iconVisiblePick({THREE,scene},roots) {
 const ray=new THREE.Raycaster(),direction=new THREE.Vector3(),segment=new THREE.Box3(),instanceBounds=new THREE.Box3();
 function blocks(object){
  if(!object.visible)return false;
  if(object.isMesh&&object.layers.test(ray.layers)){
   if(object.isInstancedMesh){
    if(!object.boundingBox)object.computeBoundingBox();
    if(!instanceBounds.copy(object.boundingBox).applyMatrix4(object.matrixWorld).intersectsBox(segment))return false;
   }
   const hits=ray.intersectObject(object,false);
   if(hits.some(hit=>{
    const material=Array.isArray(object.material)?object.material[hit.face.materialIndex]:object.material;
    return material?.visible&&material.colorWrite&&(!material.transparent||material.opacity>=.5);
   }))return true;
  }
  return object.children.some(blocks);
 }
 return (ndc,camera)=>{
  const visibleRoots=roots.filter(root=>{
   for(let node=root;node;node=node.parent)if(!node.visible)return false;
   root.updateWorldMatrix(true,true);
   return true;
  });
  camera.updateWorldMatrix(true,false);
  ray.setFromCamera(ndc,camera);ray.layers.mask=camera.layers.mask;
  const forward=ray.ray.direction.dot(camera.getWorldDirection(direction));
  ray.near=camera.near/forward;ray.far=camera.far/forward;
  const hit=ray.intersectObjects(visibleRoots,true).find(({object,face})=>{
   for(let node=object;node;node=node.parent)if(!node.visible)return false;
   return (Array.isArray(object.material)?object.material[face.materialIndex]:object.material)?.visible;
  });
  if(!hit)return null;
  ray.far=hit.distance-.0001;
  segment.setFromPoints([ray.ray.at(ray.near,direction),hit.point]);
  scene.updateMatrixWorld();
  if(blocks(scene))return null;
  let root=hit.object;
  while(!visibleRoots.includes(root))root=root.parent;
  return root;
 };
}

function iconApplianceControls(context) {
 const parts=new Map(),doors=[];
 for(const id of ['fridge','freezer']){
  const pivot=context.group.getObjectByName('kitchen-'+id+'-door');
  if(!pivot)continue;
  const body=context.group.getObjectByName('kitchen-'+id+'-body');
  body.visible=false;
  const state={pivot,body,open:false,start:0,from:0,target:0,moving:false};
  doors.push(state);
  parts.set(pivot,state);
  parts.set(body,state);
 }
 const pick=iconVisiblePick(context,[...parts.keys()]);
 function update(now){
  let moving=false;
  for(const state of doors){
   if(!state.moving)continue;
   const t=Math.min(1,(now-state.start)/340);
   state.pivot.rotation.z=state.from+(state.target-state.from)*t*t*(3-2*t);
   state.moving=t<1;
   state.body.visible=state.open||state.moving;
   moving||=state.moving;
  }
  return moving;
 }
 function toggleAt(ndc,camera){
  const part=pick(ndc,camera),state=parts.get(part);
  if(!state||(!state.open&&part!==state.pivot))return false;
  const now=performance.now();
  update(now);
  state.open=!state.open;
  state.body.visible=true;
  state.from=state.pivot.rotation.z;
  state.target=state.open?state.pivot.userData.openYaw:state.pivot.userData.closedYaw;
  state.start=now;state.moving=true;
  return true;
 }
 return {toggleAt,update};
}

function iconProjectorControl(context,assembly,wall) {
 const {THREE,group,data}=context,pick=iconVisiblePick(context,[assembly]);
 const lens=assembly.getObjectByName('projector-lens-glass'),paint=wall.material[2];
 let projectedPaint,isOn=false;
 function toggleAt(ndc,camera){
  if(!pick(ndc,camera))return false;
  projectedPaint??=iconProjectedPaint(THREE,paint,data.projection,Math.sign(group.matrix.determinant()));
  isOn=!isOn;
  wall.material[2]=isOn?projectedPaint:paint;
  lens.material.emissive.setHex(isOn?0xa8d8ff:0);
  return true;
 }
 return {toggleAt,get isOn(){return isOn;}};
}

function iconLivingCoffeeTable(THREE,s,p) {
 const lobes=20,r=.39,shape=new THREE.Shape();
 for(let i=0;i<=lobes*8;i++){
  const angle=i*2*Math.PI/(lobes*8),radius=r-.009*(1-Math.cos(lobes*angle));
  const x=radius*Math.cos(angle),y=radius*Math.sin(angle);
  if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
 }
 shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:.032,bevelEnabled:false});
 const pos=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,.5+pos.getX(i)/(2*r),.5+pos.getY(i)/(2*r));
 s.add('top-0',g,p.accentWalnut,.405,.405,.36);
 for(const [i,x,y] of [[0,.25,.28],[1,.48,.42],[2,.34,.59]])
  s.disc('pillar-'+i,x,y,.016,.050,.050,.344,p.silver);
 s.disc('drum-1',.76,.26,.016,.12,.12,.204,p.cocoa);
 s.disc('top-1',.76,.26,.22,.235,.235,.033,p.stone);
}

function iconLivingFurniture(context,frame) {
 const {item,width:w,depth:d,part}=frame,p=iconLivingPalette(context),s=iconLivingShapes(context,frame);
 if(item.chairStyle)iconDiningChair(context.THREE,frame,s,p);
 else if(item.type==='armchair')iconHorseshoeChair(context.THREE,frame,s,p);
 else if(item.type==='sofa'||item.type==='ottoman')iconVelvetSectional(context.THREE,frame,s,p);
 else if(item.id.startsWith('kitchen-')||item.id==='hob')iconLivingKitchen(context,frame,s,p);
 else if(item.id==='media-console')iconLivingYoffers(context,frame,s);
 else if(item.id==='living-rug')iconLivingRug(context.THREE,frame,s,p);
 else if(item.id==='dining-table')iconMadoxTable(context.THREE,frame,s,p);
 else if(item.id==='coffee-table'){
  iconLivingCoffeeTable(context.THREE,s,p);
 }else return false;
 return true;
}

function iconBedroomOfficePalette(context) {
 if(context.bedroomOfficePalette)return context.bedroomOfficePalette;
 const {THREE}=context;
 const finish=(name,color,roughness,metalness=0,map=null)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness,map});
 function weave(herringbone=false){
  const n=128,data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const yarn=((x%4===0)?-9:0)+((y%4<2)?6:0);
   const diagonal=(x+(Math.floor(x/32)%2?y:-y)+128)%16;
   const shade=(herringbone?(diagonal<7?153:239):240)+yarn;
   data.set([shade,shade,shade,255],(y*n+x)*4);
  }
  const map=new THREE.DataTexture(data,n,n);
  map.wrapS=map.wrapT=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  if(herringbone)map.repeat.set(2,1);
  return map;
 }
 const cloth=weave();
 return context.bedroomOfficePalette={
  laminate:finish('warm grey plain laminate','#c8c2b5',.67),lacquer:finish('oat painted MDF','#ddd4c5',.52),
  taupe:finish('mushroom painted MDF','#a49687',.59),graphite:finish('graphite powder-coated steel','#454647',.61,.25),
  silver:finish('brushed aluminium','#bfc0bc',.34,.65),black:finish('charcoal moulded plastic','#303233',.63),
  ivory:finish('warm white cotton','#f3ecde',.94,0,cloth),linen:finish('oatmeal woven fabric','#ded4c4',.95,0,cloth),
  sage:finish('muted eucalyptus fabric','#a5a89a',.96,0,cloth),olive:finish('moss fabric','#8c8b73',.97,0,cloth),
  felt:finish('graphite upholstery','#5a5a59',.96,0,cloth),indigo:finish('muted indigo fabric','#565a70',.96,0,cloth),
  headcloth:finish('sand and umber herringbone upholstery','#cdbaa6',.96,0,weave(true)),
  stone:finish('warm-grey glazed ceramic','#bdb4a6',.32),screen:finish('display glass','#202b30',.22,.26),
  beech:finish('solid beech toy','#c29b70',.77)
 };
}

function iconUpperBed(frame,s,p) {
 const {item,width:w,depth:d,part}=frame,master=item.room==='1.8',cloth=item.room==='1.1'?p.olive:p.linen;
 part('plinth',[.095,.08,w-.095,d-.09],0,.20,p.taupe);
 s.cushion('frame',w/2,(d+.06)/2,.285,w,d-.06,.21,.05,master?p.linen:p.lacquer);
 s.cushion('mattress',w/2,d*.5+.035,.445,w-.048,d-.095,.21,.09,p.ivory);
 s.cushion('headboard',w/2,.03,master?.58:.51,w,.06,master?1.02:.88,.028,master?p.linen:p.lacquer);
 for(let i=0;i<(master?2:1);i++){
  const bays=master?2:1,u=(i+.5)*w/bays;
  s.cushion('head-pad-'+i,u,.087,master?.758:.65,w/bays-.035,.097,master?.63:.53,.045,master?p.headcloth:p.linen);
  s.cushion('pillow-'+i,u,.32,.617,Math.min(.75,w*.7),.41,.15,.072,p.ivory,.067);
 }
 s.cushion('duvet',w/2,(d+.47)/2,.575,w-.045,d-.51,.13,.063,cloth);
 s.cushion('turnback',w/2,.607,.651,w-.06,.24,.063,.028,p.ivory);
 s.cushion('throw',w/2,d-.34,.652,w-.055,.46,.055,.025,master?p.olive:item.room==='1.3'?p.indigo:p.sage);
 for(let i=0;i<3;i++)part('woven-stripe-'+i,[.06,d-.21+i*.021,w-.06,d-.202+i*.021],.680,.002,p.linen);
}

function iconUpperDesk(frame,s,p) {
 const {width:w,depth:d,part,line}=frame;
 part('top',[0,0,w,d],.717,.035,p.laminate);
 part('apron',[.33,.055,w-.06,.10],.625,.092,p.taupe);
 const side=.29;
 part('drawer-case',[.035,.035,side+.04,d-.05],.09,.627,p.taupe);
 for(let i=0;i<3;i++){
  const z=.105+i*.20;
  part('drawer-'+i,[.045,d-.05,side+.03,d-.032],z,.182,p.laminate);
  part('pull-'+i,[.124,d-.032,.24,d-.019],z+.135,.014,p.black);
 }
 for(const v of [.065,d-.065])line('tapered-leg-'+v,[w-.05,v,.014],[w-.08,v,.717],.028,p.graphite);
 s.disc('lamp-foot',w-.21,.145,.752,.074,.074,.019,p.black);
 line('lamp-lower-arm',[w-.21,.145,.77],[w-.24,.125,1.035],.010,p.silver);
 line('lamp-upper-arm',[w-.24,.125,1.035],[w-.36,.23,1.112],.010,p.silver);
 s.cushion('task-light',w-.36,.25,1.098,.11,.092,.037,.014,p.ivory);
 part('notebook',[w*.49,d*.38,w*.49+.19,d*.38+.245],.752,.018,p.olive);
 part('paper',[w*.49+.012,d*.38+.012,w*.49+.181,d*.38+.236],.770,.003,p.ivory);
 s.disc('pencil-cup',w*.42,.102,.752,.037,.037,.079,p.laminate);
 for(let i=0;i<3;i++)line('pencil-'+i,[w*.42,.102,.812],[w*.42+(i-1)*.024,.108+i*.006,.882+i*.008],.0035,p.graphite);
}

function iconUpperChair(frame,s,p) {
 const {item,width:w,depth:d,line}=frame;
 if(item.id==='gallery-chair'){
  s.cushion('base',w/2,d*.5,.245,w-.09,d-.08,.27,.10,p.sage);
  s.cushion('seat',w/2,d*.55,.406,w-.13,d*.77,.18,.079,p.linen);
  s.cushion('back',w/2,d*.18,.585,w-.08,.16,.51,.073,p.sage,-.12);
  for(const u of [.058,w-.058])s.cushion('arm-'+u,u,d*.48,.526,.105,d*.80,.185,.046,p.sage);
  s.cushion('scatter',w/2,d*.32,.586,.34,.11,.26,.048,p.olive,-.18);
 }
 else{
  s.cushion('seat',w/2,d*.54,.46,w-.036,d*.82,.073,.034,p.sage);
  s.cushion('back',w/2,d*.116,.727,w-.048,.055,.252,.026,p.sage,-.10);
  for(const u of [.09,w-.09])line('back-upright-'+u,[u,d*.18,.445],[u,d*.103,.75],.016,p.graphite);
 }
 const gallery=item.id==='gallery-chair';
 for(const u of [.04,w-.04])for(const v of [.045,d-.045]){
  const innerU=u<w/2?u+.045:u-.045,innerV=v<d/2?v+.035:v-.035;
  line('leg-'+u+'-'+v,[u,v,.014],[innerU,innerV,gallery?.191:.444],.018,gallery?p.black:p.graphite);
 }
}

function iconUpperWardrobe(frame,p) {
 const {width:w,depth:d,item,part}=frame,h=item.height,n=Math.round(w/.58),span=w/n;
 part('body',[.028,0,w-.028,.035],.075,h-.109,p.laminate);
 part('plinth',[.036,.022,w-.036,d-.085],0,.075,p.taupe);
 part('top',[0,0,w,d-.018],h-.034,.034,p.lacquer);
 for(const [i,u] of [0,w-.028].entries())part('side-'+i,[u,0,u+.028,d-.018],.075,h-.109,p.lacquer);
 for(let i=0;i<n;i++){
  const a=i*span+.008,b=(i+1)*span-.008,u=i%2?a+.062:b-.062;
  part('door-'+i,[a,d-.045,b,d-.021],.08,h-.123,p.lacquer);
  part('handle-'+i,[u-.009,d-.021,u+.009,d],h*.51,.18,p.silver);
 }
}

function iconUpperGarment(THREE,s,id,u,v,shoulder,length,cloth) {
 const outline=new THREE.Shape();
 const profile=[[-.045,0],[-.175,-.044],[-.222,-.227],[-.164,-.246],[-.139,-.153],[-.144,-length],
  [.144,-length],[.139,-.153],[.164,-.246],[.222,-.227],[.175,-.044],[.045,0],[.027,-.027],[-.027,-.027]];
 profile.forEach(([x,y],i)=>i?outline.lineTo(x,y):outline.moveTo(x,y));outline.closePath();
 const geometry=new THREE.ExtrudeGeometry(outline,{depth:.038,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:2});
 geometry.rotateX(Math.PI/2);geometry.rotateZ(Math.PI/2);
 s.add(id,geometry,cloth,u-.019,v,shoulder);
}

function iconDressingHighStorage({THREE,ceilingAt},frame,s,p) {
 const {width:w,depth:d,item,point,part}=frame,h=item.lowerSectionHeight??item.height,board=.026;
 const topAt=(u,v)=>{
  const [x,y,z]=point(u,v);
  return ceilingAt(x,y)-z-.008;
 };
 function fitted(name,a,b,back,front,cap=false) {
  const geometry=new THREE.BufferGeometry().copy(new THREE.BoxGeometry(b-a,front-back,1));
  geometry.translate((b+a)/2,(front+back)/2,0);
  const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){
   const top=topAt(pos.getX(i),pos.getY(i));
   const z=cap ? top-(pos.getZ(i)>0?0:board) : pos.getZ(i)>0?top-board:h;
   pos.setZ(i,z);
  }
  geometry.computeVertexNormals();
  s.add(name,geometry,p.laminate,0,0,0);
 }
 fitted('sloping-cap',0,w,0,d,true);
 fitted('upper-back',0,w,0,board);
 for(let i=0;i<=3;i++){
  const u=(w-board)*i/3;
  fitted('upper-upright-'+i,u,u+board,board,d);
 }
 for(let i=0;i<3;i++){
  const a=(w-board)*i/3+board,b=(w-board)*(i+1)/3;
  const clearTop=Math.min(topAt(a,0),topAt(b,0))-board;
  for(let z=h+.44,level=0;z+.22<clearTop;z+=.46,level++) {
   part('upper-shelf-'+i+'-'+level,[a,board,b,d-.007],z,board,p.laminate);
   if(level===0){
    const mid=(a+b)/2;
    s.cushion('linen-case-'+i,mid,d*.51,z+board+.094,(b-a)*.67,d*.70,.188,.024,p.linen);
    part('case-tab-'+i,[mid-.04,d*.86,mid+.04,d*.86+.008],z+board+.087,.026,p.taupe);
   }
  }
 }
}

function iconUpperDressing(context,frame,s,p) {
 const {THREE}=context,{width:w,depth:d,item,part,line}=frame,h=item.lowerSectionHeight??item.height,span=w/3;
 part('body',[0,0,w,.026],.105,h-.14,p.laminate);
 part('plinth',[.03,.025,w-.03,d-.07],0,.07,p.taupe);
 part('base',[0,0,w,d],.07,.035,p.laminate);
 part('top',[0,0,w,d],h-.035,.035,p.laminate);
 for(let i=0;i<=3;i++){
  const u=(w-.026)*i/3;
  part('upright-'+i,[u,.026,u+.026,d],.105,h-.14,p.laminate);
 }
 for(let i=0;i<2;i++){
  const a=i*span+.033,b=(i+1)*span-.033;
  line('rail-'+i,[a,d*.49,h-.19],[b,d*.49,h-.19],.014,p.silver);
  for(let j=0;j<3;j++){
   const u=a+(b-a)*(.23+j*.26),v=d*.49;
   line('hook-'+i+'-'+j,[u,v,h-.19],[u,v,h-.28],.006,p.silver);
   line('hanger-front-'+i+'-'+j,[u,v,h-.27],[u,v+.17,h-.36],.008,p.black);
   line('hanger-back-'+i+'-'+j,[u,v,h-.27],[u,v-.17,h-.36],.008,p.black);
   iconUpperGarment(THREE,s,'garment-'+i+'-'+j,u,v,h-.28,.62+j*.085,[p.linen,p.sage,p.olive][(j+i)%3]);
  }
 }
 const a=2*span+.024,b=w-.028;
 for(let i=0;i<3;i++){
  const z=.115+i*.195;
  part('drawer-'+i,[a,.03,b,d-.025],z,.177,p.taupe);
  part('handle-'+i,[(a+b)/2-.075,d-.025,(a+b)/2+.075,d-.009],z+.11,.014,p.silver);
 }
 for(const z of [.72,1.12]){
  part('shelf-'+z,[a,.026,b,d],z,.024,p.laminate);
  for(let j=0;j<2;j++)s.cushion('folded-'+z+'-'+j,(a+b)/2,d*.57,z+.066+j*.077,(b-a)*.72,d*.66,.077,.031,j?p.linen:p.sage);
 }
 iconDressingHighStorage(context,frame,s,p);
}

function iconUpperCeramic(s,THREE,name,u,v,z,rx,ry,profile,material) {
 const geometry=new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),48);
 geometry.rotateX(Math.PI/2);geometry.scale(rx,ry,1);
 return s.add(name,geometry,material,u,v,z);
}

function iconUpperSanitary(context,frame,s,p) {
 const {THREE,ceilingAt}=context,{item,width:w,depth:d,part,line,point,mats}=frame;
 const family=item.room==='1.2',finish=iconUpperBathPalette(context),metal=family?finish.nickel:finish.brass;
 const ceramic=(name,u,v,z,rx,ry,profile)=>iconUpperCeramic(s,THREE,name,u,v,z,rx,ry,profile,mats.white);
 if(item.type==='sink'){
  const front=family?finish.honey:finish.moss;
  s.cushion('vanity',w/2,(d-.027)/2,.501,w-.012,d-.027,.538,.018,front);
  for(let i=0;i<2;i++){
   part('drawer-'+i,[.012,d-.025,w-.012,d-.020],.252+i*.25,.235,front);
   line('drawer-pull-'+i,[w*.36,d-.011,.424+i*.25],[w*.64,d-.011,.424+i*.25],.009,metal);
  }
  s.cushion('counter',w/2,d/2,.787,w,d,.032,.010,finish.cream);
  ceramic('bowl',w/2,d*.58,.803,w*.386,d*.385,[[.56,0],[.85,.01],[1,.111],[.992,.127],[.95,.13],[.9,.102],[.58,.035],[.09,.016]]);
  s.disc('drain',w/2,d*.58,.815,.024,.024,.004,metal);
  s.tube('tap',[[w*.52,d*.11,.801],[w*.52,d*.11,1.01],[w*.52,d*.16,1.04],[w*.52,d*.39,1.04],[w*.52,d*.40,1.00]],.012,metal);
  const mirrorTop=Math.min(1.94,...[.04,w-.04].map(u=>{const [x,y,z]=point(u,.02);return ceilingAt(x,y)-z-.03;}));
  const mirror=(name,width,height,v,material)=>{
   const shape=new THREE.Shape(),r=width/2;
   if(family)shape.absellipse(0,height/2,r,height/2,0,2*Math.PI,false);
   else{shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,height-r);shape.absarc(0,height-r,r,0,Math.PI,false);shape.lineTo(-r,0);}
   const g=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,curveSegments:24});
   const xy=g.attributes.position,uv=g.attributes.uv;
   for(let i=0;i<uv.count;i++)uv.setXY(i,xy.getX(i)/width+.5,xy.getY(i)/height);
   g.rotateX(Math.PI/2);
   s.add(name,g,material,w/2,v,1.115+(name==='mirror'?.008:0));
  };
  const width=w*(family?.91:.76),height=mirrorTop-1.115;
  mirror('mirror-frame',width,height,.033,metal);
  mirror('mirror',width-.016,height-.016,.035,finish.silver);
  const u=w*.12,v=d*.26;
  s.disc('amber-soap',u,v,.804,.033,.033,.112,finish.amber);
  s.disc('pump-neck',u,v,.916,.015,.015,.023,metal);
  line('pump-spout',[u,v,.941],[u+.030,v,.941],.005,metal);
 }else if(item.type==='toilet'){
  part('wall-carrier',[w*.24,0,w*.76,d*.43],.17,.22,mats.white);
  ceramic('base',w/2,d*.573,.08,w*.48,d*.409,[[.46,0],[.58,.025],[.70,.13],[.97,.24],[1,.32],[.95,.337],[.78,.333],[.67,.23],[.18,.13]]);
  ceramic('seat',w/2,d*.57,.413,w*.48,d*.403,[[.77,0],[.96,0],[1,.012],[.98,.033],[.79,.035],[.76,.023],[.77,0]]);
  s.cushion('cistern',w/2,d*.13,.542,w-.036,d*.25,.37,.035,mats.white);
  s.disc('flush',w/2,d*.13,.727,.024,.016,.004,metal);
 }else if(item.type==='tub'){
  ceramic('shell',w/2,d/2,.016,w*.50,d*.50,[[.73,0],[.79,.026],[.90,.22],[.995,.53],[1,.556],[.976,.569],[.918,.561],[.88,.49],[.72,.13],[.58,.096],[.025,.096]]);
  s.disc('drain',w*.50,d*.50,.110,.028,.028,.005,metal);
  part('bath-bridge',[w*.27,.005,w*.38,d-.005],.582,.022,finish.honey);
  s.disc('bridge-soap-dish',w*.325,d*.54,.604,.064,.047,.014,finish.cream);
  s.tube('filler',[[w*.20,.10,.025],[w*.2,.10,.65],[w*.23,.12,.70],[w*.26,d*.28,.70],[w*.26,d*.29,.66]],.017,metal);
 }else{
  s.cushion('tray',w/2,d/2,.036,w,d,.06,.025,p.stone);
  part('linear-drain',[w*.18,.075,w*.78,.099],.066,.006,p.black);
  const maxHeight=Math.min(2.03,...[.025,d-.025].map(v=>{const [x,y,z]=point(w-.028,v);return ceilingAt(x,y)-z-.035;}));
  part('screen',[w-.035,.024,w-.023,d-.019],.066,maxHeight-.066,mats.glass).castShadow=false;
  for(const v of [.025,d-.025])line('glazing-stile-'+v,[w-.029,v,.065],[w-.029,v,maxHeight],.011,p.black);
  const u=family?w*.56:.075,v=family?.065:d*.51;
  const [mx,my]=family?[.15,0]:[0,.15],headU=family?u:w*.39,headV=family?d*.46:v;
  line('mixer',[u-mx,v-my,1.04],[u+mx,v+my,1.04],.023,metal);
  for(const side of [-1,1]){
   const end=[u+side*mx*.64,v+side*my*.64,1.04];
   line('wall-feed-'+side,family?[end[0],0,1.04]:[0,end[1],1.04],end,.015,metal);
  }
  line('column',[u,v,1.04],[u,v,1.98],.014,metal);
  line('arm',[u,v,1.98],[headU,headV,1.98],.014,metal);
  s.disc('head',headU,headV,1.94,.093,.093,.033,metal);
  s.disc('perforated-face',headU,headV,1.937,.086,.086,.003,finish.spray);
 }
}

function iconLaundryBasket(context,frame,s,p) {
 const {THREE}=context,{width:w,depth:d,item}=frame,h=item.height,rx=w*.46,ry=d*.46,lip=h-.075;
 const profile=[[.001,.018],[.71,.018],[.78,.029],[.86,h*.29],[.97,lip-.10],[1,lip-.012],[1,lip],
  [.98,lip+.007],[.956,lip],[.953,lip-.012],[.92,lip-.10],[.81,h*.29],[.73,.043],[.001,.043]];
 const geometry=new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),48);
 geometry.rotateX(Math.PI/2);geometry.scale(rx,ry,1);
 s.add('open-linen-body',geometry,p[item.cloth],w/2,d/2,0);
 for(const side of [-1,1]){
  const v=d/2+side*ry*.77;
  s.tube('loop-handle-'+side,[[w*.24,v,lip-.019],[w*.26,v+side*.011,lip+.029],
   [w*.37,v+side*.012,h-.011],[w*.63,v+side*.012,h-.011],[w*.74,v+side*.011,lip+.029],[w*.76,v,lip-.019]],.008,p.walnut);
 }
}

function iconLaundryWallStorage(frame,s,p) {
 const {item,width:w,depth:d,part}=frame,h=item.height,t=.019;
 part('back',[0,0,w,t],0,h,p.ash);
 for(const [i,z] of [0,h-t].entries())part('deck-'+i,[0,t,w,d-.022],z,t,p.ash);
 for(const [i,u] of [0,w-t].entries())part('side-'+i,[u,t,u+t,d-.022],t,h-2*t,p.ash);
 const shelf=h*.48;
 part('middle-shelf',[t,t,w-t,d-.027],shelf,t,p.ash);
 if(item.type==='wall-cabinet'){
  for(let i=0;i<2;i++){
   const a=i*w/2+.003,b=(i+1)*w/2-.003,u=i?a+.032:b-.032;
   part('door-'+i,[a,d-.022,b,d-.006],.003,h-.006,p.ivory);
   part('pull-'+i,[u-.008,d-.006,u+.008,d],.061,.112,p.brass);
  }
 }else{
  for(const [i,u] of [w*.29,w*.69].entries())for(let j=0;j<2;j++)
   s.cushion('towel-'+i+'-'+j,u,d*.50,t+.032+j*.064,w*.32,d*.7,.064,.018,i?p.sage:p.linen);
  for(let i=0;i<3;i++){
   const u=w*(.23+i*.24);
   s.disc('jar-'+i,u,d*.49,shelf+t,.064,.064,.13,p.ivory);
   s.disc('jar-lid-'+i,u,d*.49,shelf+t+.13,.066,.066,.014,p.walnut);
  }
 }
}

function iconUpperFurniture(context,frame) {
 const {item,line,width:w,depth:d,mats}=frame;
 if(item.type==='nightstand'||item.room==='1.5'&&!['laundry-basket','wall-cabinet','wall-shelves'].includes(item.type))return false;
 const p=['1.1','1.3','1.7','1.8'].includes(item.room)?iconBedroomOfficePalette(context):iconLivingPalette(context),s=iconLivingShapes(context,frame);
 if(item.type==='bed')iconUpperBed(frame,s,p);
 else if(item.type==='chair')iconUpperChair(frame,s,p);
 else if(item.type==='table')iconUpperDesk(frame,s,p);
 else if(item.room==='1.7')iconUpperDressing(context,frame,s,p);
 else if(item.type==='laundry-basket')iconLaundryBasket(context,frame,s,p);
 else if(item.type==='wall-cabinet'||item.type==='wall-shelves')iconLaundryWallStorage(frame,s,p);
 else if(item.type==='cabinet')iconUpperWardrobe(frame,p);
 else if(item.type==='floor-lamp'){
  s.disc('foot',w/2,d/2,.019,.119,.119,.026,p.black);
  line('stem',[w/2,d/2,.045],[w/2,d/2,1.15],.012,p.brass);
  s.disc('drum-shade',w/2,d/2,1.10,w*.49,d*.49,.247,p.linen);
  s.disc('diffuser',w/2,d/2,1.096,w*.465,d*.465,.005,mats.lamp);
 }
 else if(['sink','toilet','tub','shower'].includes(item.type))iconUpperSanitary(context,frame,s,p);
 else return false;
 return true;
}

function iconInteriorFurnitureObject(context, frame) {
 if(frame.item.id.startsWith('office-under-stair-'))return iconOfficeFittedCabinet(context,frame);
 if(frame.item.type==='pet-bed')return iconPugBed(context,frame);
 if(iconGroundRoomFurniture(context,frame))return;
 if(frame.item.room.startsWith('1.')&&iconUpperFurniture(context,frame))return;
 if(frame.item.room==='0.4'&&iconLivingFurniture(context,frame))return;
 const {item,width:w,depth:d,part,mats}=frame;
 if(item.type==='bed')iconInteriorFurnitureBed(frame);
 else if(['sofa','chair','stool','ottoman'].includes(item.type))iconInteriorFurnitureSeating(frame);
 else if(['cabinet','counter','appliance'].includes(item.type))iconInteriorFurnitureStorage(frame);
 else if(item.type==='table')iconInteriorFurnitureTable(frame);
 else if(['sink','basin','toilet','shower','tub'].includes(item.type))iconInteriorFurnitureSanitary(frame);
 else if(item.type==='laundry-stack')iconInteriorLaundryStack(context,frame);
 else if(item.type==='ironing-board')iconInteriorIroningBoard(context,frame);
 else if(item.type==='nightstand')iconInteriorNightstand(context,frame);
 else if(item.type==='rug')part('surface',[0,0,w,d],.026,item.height||.015,mats.rug);
 else if(item.type==='screen'||item.type==='hob')part('panel',[0,0,w,d],0,item.height||.025,mats.dark);
 else throw new Error('Unsupported furniture type: '+item.type);
}

function iconInteriorFurnishings(context) {
 const {data,group,obstacle}=context;
 for(const item of data.furniture){
  const start=group.children.length,frame=iconInteriorFurnitureFrame(context,item);
  iconInteriorFurnitureObject(context,frame);
  const objects=group.children.slice(start);
  for(const object of objects)object.userData={furnitureId:item.id,room:item.room,facing:item.facing,source:item.source,approximation:item.approximation||null};
  if(item.type==='rug'||item.type==='concealed-door'||item.support)continue;
  const bounds=objects.reduce((max,object)=>{object.updateMatrix();object.geometry.computeBoundingBox();return Math.max(max,object.geometry.boundingBox.clone().applyMatrix4(object.matrix).max.z);},frame.z);
  obstacle('furniture-'+item.id,frame.walkBox??item.box,frame.z,bounds);
  for(const appliance of frame.appliances??[])iconMountSamsung(context,appliance);
 }
}

function iconIndoorOlive({THREE,mesh,obstacle},cx,cy,scale) {
 const potHeight=.49;
 const profile=[[0,.01],[.15,.01],[.205,.13],[.19,.40],[.17,.49],[.151,.49],[.15,.446],[.001,.446]];
 const ceramic=new THREE.MeshStandardMaterial({color:'#9c8269',roughness:.9});
 const pot=mesh(new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r*scale,z*scale)),36),ceramic,'olive-planter');
 pot.rotation.x=Math.PI/2;pot.position.set(cx,cy,0);
 const soil=new THREE.MeshStandardMaterial({color:'#383022',roughness:1});
 const earth=mesh(new THREE.CylinderGeometry(.152*scale,.152*scale,.012,30),soil,'olive-soil');
 earth.rotation.x=Math.PI/2;earth.position.set(cx,cy,.452*scale);
 const leaves=[],stems=[],bark=new THREE.MeshStandardMaterial({color:'#76654f',roughness:1});
 let seed=736+Math.round(scale*415);
 const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return (seed>>>0)/4294967296;};
 function twig(a,b,r,depth){
  stems.push([a,b,r]);
  if(depth<=1){
   for(let i=0;i<10;i++){
    const t=(i+.5)/10,angle=i*2.40+random()*.5;
    leaves.push([a.clone().lerp(b,t),angle,.052+random()*.045,.10+random()*.75]);
   }
  }
  if(!depth)return;
  const heading=Math.atan2(b.y-a.y,b.x-a.x);
  for(const side of [-1,1]){
   const start=a.clone().lerp(b,.56+random()*.37);
   const angle=heading+side*(.54+random());
   const span=(.08+.046*depth)*(.8+random()*.6);
   twig(start,start.clone().add(new THREE.Vector3(span*Math.cos(angle),span*Math.sin(angle),span*(.45+random()*.85))),r*.58,depth-1);
  }
 }
 for(let i=0;i<5;i++){
  const angle=i*2.4;
  twig(new THREE.Vector3(0,0,potHeight-.05),new THREE.Vector3(.18*Math.cos(angle),.18*Math.sin(angle),1.08+.45*random()),.019,3);
 }
 const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.64,1,1,6),bark,stems.length);
 const axis=new THREE.Vector3(0,1,0),pose=new THREE.Object3D();
 for(const [i,[a,b,r]] of stems.entries()){
  const dir=b.clone().sub(a);pose.position.copy(a).lerp(b,.5);pose.scale.set(r,dir.length(),r);pose.quaternion.setFromUnitVectors(axis,dir.normalize());
  pose.updateMatrix();branches.setMatrixAt(i,pose.matrix);
 }
 const leaf=new THREE.BufferGeometry();
 leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.52,-.175,-.05,.50,0,.08,.48,.175,-.05,1,0,.01],3));
 leaf.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);leaf.computeVertexNormals();
 const crown=new THREE.InstancedMesh(leaf,new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.76}),leaves.length);
 for(const [i,[p,a,length,tilt]] of leaves.entries()){
  pose.position.copy(p);pose.rotation.set(.3,-tilt,a,'ZYX');pose.scale.setScalar(length);pose.updateMatrix();crown.setMatrixAt(i,pose.matrix);
  crown.setColorAt(i,new THREE.Color().setHSL(.21+.045*random(),.26+.16*random(),.22+.19*random()));
 }
 for(const [object,name] of [[branches,'branches'],[crown,'leaves']]){
  object.name='indoor-olive-'+name;object.position.set(cx,cy,0);object.scale.setScalar(scale);object.castShadow=true;object.receiveShadow=true;pot.parent.add(object);
 }
 const r=.205*scale;
 obstacle('olive-pot-'+scale,[cx-r,cy-r,cx+r,cy+r],0,potHeight*scale);
}

function iconMezzaninePrint({THREE,box,mats}) {
 const width=240,height=256,pixels=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width*2-1,v=(y+.5)/height*2-1,theta=Math.atan2(v,u);
  const grain=Math.sin(x*91.35+y*33.71)*18653.3;
  const dust=grain-Math.floor(grain);
  const dist=Math.hypot(u*1.13,v),edge=.6+.029*Math.sin(theta*9)+.016*Math.sin(theta*18+dist*41);
  const ink=Math.abs(dist-edge)<.105+.052*Math.sin(theta+1.2)+.064*dust && dust>(.05+.1*Math.sin(83*dist));
  pixels.set(ink?[53+dust*24,52+dust*19,49+dust*20,255]:[197+dust*20,185+dust*18,162+dust*18,255],4*(y*width+x));
 }
 const paper=new THREE.DataTexture(pixels,width,height);paper.colorSpace=THREE.SRGBColorSpace;paper.magFilter=THREE.LinearFilter;paper.generateMipmaps=true;paper.minFilter=THREE.LinearMipmapLinearFilter;paper.needsUpdate=true;
 for(let i=0;i<2;i++){
  const x=6.72+i*.55;
  box('gallery-frame-'+i,[x-.016,8.032,x+.536,8.066],4.17,1.09,mats.metal);
  const map=paper.clone();map.repeat.x=.5;map.offset.x=i*.5;map.needsUpdate=true;
  const print=new THREE.MeshStandardMaterial({map,roughness:.98});
  box('gallery-print-'+i,[x,8.066,x+.52,8.071],4.185,1.06,print);
 }
}

function iconRoofLining(context,part,inverse,neutral,white) {
 const {THREE,group,mesh,data,cutRoof}=context;
 const points=part.vertices.map(v=>{const p=new THREE.Vector3(...v).applyMatrix4(inverse);p.z-=.045;return p;});
 const [,start,endX]=data.void.box,main=points.every(p=>p.x<=endX+1e-5);
 const clip=(face,living)=>{
  const polygon=[];
  for(let i=0;i<face.length;i++){
   const a=face[i],b=face[(i+1)%face.length];
   const inside=p=>living?p.y>=start:p.y<=start;
   if(inside(a))polygon.push(a);
   if((a.y-start)*(b.y-start)<0)polygon.push(a.clone().lerp(b,(start-a.y)/(b.y-a.y)));
  }
  return polygon;
 };
 for(const living of main?[false,true]:[false]){
  const vertices=[];
  for(const indices of part.faces){
   const face=indices.map(i=>points[i]),polygon=main?clip(face,living):face;
   for(let i=1;i<polygon.length-1;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]])vertices.push(p.x,p.y,p.z);
  }
  if(!vertices.length)continue;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const lining=mesh(cutRoof(geometry,group.matrix),living?white:neutral,'interior-roof-lining-'+part.id+(living?'-living':''));
  lining.castShadow=false;
 }
}

function iconDiningLantern(context,paper,id,x,y,z,radius,halfHeight) {
 const {THREE,mesh,beam,ceilingAt,mats}=context;
 const profile=[];
 for(let i=0;i<=32;i++){
  const angle=Math.PI*(i/32-.5);
  profile.push(new THREE.Vector2(Math.max(.037,radius*Math.cos(angle)),halfHeight*Math.sin(angle)));
 }
 const shade=mesh(new THREE.LatheGeometry(profile,36),paper,id+'-washi');
 shade.rotation.x=Math.PI/2;shade.position.set(x,y,z);
 const top=z+halfHeight;
 beam(id+'-cord',[x,y,top],[x,y,ceilingAt(x,y)],.006,mats.metal);
 beam(id+'-cap',[x,y,top-.006],[x,y,top+.018],.049,mats.metal);
}

function iconLivingLighting(context) {
 const {THREE,mesh,box,beam,ceilingAt,mats,data}=context;
 const paper=new THREE.MeshStandardMaterial({color:'#ffebc8',emissive:'#f4cba2',emissiveIntensity:.34,side:THREE.DoubleSide,roughness:.96});
 paper.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 paperUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\npaperUv=uv;');
  shader.fragmentShader='varying vec2 paperUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   float rib=abs(fract(paperUv.y*36.)-.5);
   float spine=abs(fract(paperUv.x*8.)-.5);
   diffuseColor.rgb*=1.-.13*smoothstep(.39,.49,rib)-.18*smoothstep(.46,.49,spine);`);
 };
 const table=data.furniture.find(item=>item.id==='dining-table').box;
 const x=(table[0]+table[2])/2,y=(table[1]+table[3])/2;
 iconDiningLantern(context,paper,'dining-lantern-1',x-.09,y-.32,2.58,.24,.17);
 iconDiningLantern(context,paper,'dining-lantern-2',x+.15,y+.02,3.16,.19,.30);
 iconDiningLantern(context,paper,'dining-lantern-3',x-.06,y+.30,2.79,.25,.14);
 for(const [id,px,py,bottom,radius,height] of [
  ['island-1',3.05,10.94,2.04,.23,.14],['island-2',5.44,10.94,2.13,.23,.14],
  ['lounge-1',1.2,13.71,2.62,.13,.035],['lounge-2',1.2,14.59,2.62,.13,.035],['lounge-3',1.2,15.47,2.62,.13,.035]
 ]){
  beam(id+'-cord',[px,py,bottom+height],[px,py,ceilingAt(px,py)],.005,mats.metal);
  const shade=mesh(new THREE.CylinderGeometry(.025,radius,height,36,1,true),mats.metal,id+'-shade');
  shade.rotation.x=Math.PI/2;shade.position.set(px,py,bottom+height/2);
  const bulb=mesh(new THREE.SphereGeometry(.053,14,10),mats.lamp,id+'-bulb');
  bulb.position.set(px,py,bottom-.014);
 }
 for(const py of [11.45,12.95,14.45,15.95]){
  const z=7.06,ridge=4.25;
  const half=(ceilingAt(ridge,py)-z)/((8.3-4.07)/4.25);
  const bevel=.17*4.25/(8.3-4.07);
  const section=new THREE.Shape([[-half,0],[half,0],[half-bevel,.17],[-half+bevel,.17]].map(([u,v])=>new THREE.Vector2(u,v)));
  const tie=mesh(new THREE.ExtrudeGeometry(section,{depth:.11,bevelEnabled:false}),mats.wood,'living-collar-tie-'+py);
  tie.rotation.x=Math.PI/2;tie.position.set(ridge,py+.055,z);
 }
 box('kitchen-linear-light',[.8,10.09,4.68,10.115],2.787,.012,mats.lamp);
}

function iconMezzanineTrusses(context) {
 const {THREE,mesh,data}=context,{eave,ridge}=data.levels;
 const pitch=(ridge-eave)/4.25,top=ridge-.045,mid=8.46,wood=iconLivingPalette(context).walnut;
 function timber(name,a,b,width,depth){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const nx=-dy*width/(2*length),ny=dx*width/(2*length);
  const vertices=[a,b].flatMap(([x,y,z])=>[[x+nx,y+ny,z],[x-nx,y-ny,z],[x-nx,y-ny,z-depth],[x+nx,y+ny,z-depth]]);
  const g=new THREE.BufferGeometry(),positions=[],uv=[];
  for(const [i,j,k,l] of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[3,2,1,0],[4,5,6,7]]){
   for(const [index,u,v] of [[i,0,0],[j,.15,0],[k,.15,length],[i,0,0],[k,.15,length],[l,0,length]]){
    positions.push(...vertices[index]);uv.push(u,v);
   }
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();mesh(g,wood,'gallery-truss-'+name);
 }
 const roofZ=run=>top-.013-run*pitch;
 for(const sign of [-1,1]){
  const run=4.25;
  timber('valley-'+sign,[4.25,mid,top-.08],[8.50,mid+sign*run,top-.08-run*pitch],.15,.23);
 }
 for(const [i,x] of [6.43,7.55,8.87].entries()){
  const run=Math.min(x-4.25,4.04);
  for(const sign of [-1,1]){
   timber('rafter-'+i+'-'+sign,[x,mid,roofZ(0)],[x,mid+sign*run,roofZ(run)],.12,.235);
  }
  const tieRun=1.15,tieTop=roofZ(tieRun)-.022;
  timber('collar-'+i,[x,mid-tieRun,tieTop],[x,mid+tieRun,tieTop],.112,.17);
 }
}

function iconRoomShade(THREE, profile, radius, pleats=0) {
 const outline=profile.map(([r,z])=>new THREE.Vector2(radius*r,z));
 const geometry=new THREE.LatheGeometry(outline,pleats?pleats*2:36);
 geometry.rotateX(Math.PI/2);
 if(pleats){
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),y=positions.getY(i);
   const scale=1+.025*Math.cos(pleats*Math.atan2(y,x));
   positions.setXY(i,x*scale,y*scale);
  }
  geometry.computeVertexNormals();
 }
 return geometry;
}

function iconRoomCeilingLights(context) {
 const {THREE,group,mesh,mats,beam,ceilingAt,data}=context;
 const palette=iconLivingPalette(context);
 const linenShade=palette.linen.clone();
 linenShade.side=THREE.DoubleSide;
 const fittings=[
  ['pantry',2.12,7.58,2.53,'opal',.14],
  ['hall',8.3,8.4,2.52,'opal',.16],['guest',12.6,7,2.44,'pleated',.29],
  ['office',12,10.9,2.49,'disc',.32],['upper-hall',5.6,7.5,5.70,'opal',.19],
  ['upper-one',4.52,2,5.64,'pleated',.26],['upper-two',3.2,7.6,5.66,'pleated',.26],
  ['upper-master',11.7,10,5.63,'pleated',.32]
 ];
 const profiles={
  opal:[[.001,.005],[.62,.017],[.91,.055],[1,.11],[.95,.155],[.68,.19],[.24,.202]],
  pleated:[[.85,.019],[1,.018],[.99,.029],[.66,.180],[.62,.192],[.19,.192]],
  disc:[[.85,.019],[.93,.018],[1,.026],[1,.05],[.96,.07],[.53,.127],[.18,.135]]
 };
 for(const [id,x,y,z,style,r] of fittings){
  const upstairs=id.startsWith('upper-'),ceiling=upstairs?ceilingAt(x,y):data.levels.groundCeiling;
  const name='light-fixture-'+id+'-',shape=profiles[style],shadeTop=shape.at(-1)[1];
  const part=(geometry,material,suffix,height)=>{
   const m=mesh(geometry,material,name+suffix);
   m.position.set(x,y,height);return m;
  };
  const mat=style==='opal'?mats.lamp:style==='disc'?palette.slate:linenShade;
  part(iconRoomShade(THREE,shape,r,style==='pleated'?30:0),mat,'shade',z);
  if(style!=='opal'){
   const lens=iconRoomShade(THREE,[[.001,0],[.61,.003],[.98,.014]],r*.93);
   part(lens,mats.lamp,'diffuser',z+.009);
  }
  const collar=iconRoomShade(THREE,[[.80,0],[1,.005],[1,.020],[.64,.024],[.001,.024]],r*.22);
  part(collar,palette.brass,'collar',z+shadeTop-.002);
  const slopeX=upstairs?(ceilingAt(x+.001,y)-ceilingAt(x-.001,y))/.002:0;
  const slopeY=upstairs?(ceilingAt(x,y+.001)-ceilingAt(x,y-.001))/.002:0;
  const up=new THREE.Vector3(-slopeX,-slopeY,1).normalize();
  const mounting=part(new THREE.CylinderGeometry(.050,.042,.025,20),palette.brass,'canopy',ceiling);
  mounting.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);
  mounting.position.addScaledVector(up,-.0125);
  beam(name+'drop',[x,y,z+shadeTop+.020],[x,y,ceiling-.010],.0055,mats.dark);
  const lamp=new THREE.PointLight('#ffe4c2',8,5,2);
  lamp.position.set(x,y,z-.018);group.add(lamp);
 }
 // General room lighting for the two existing groups of decorative pendants.
 for(const [x,y,z] of [[4.4,14,2.5],[4.3,10.5,2.55]]){
  const lamp=new THREE.PointLight('#ffe4c2',8,5,2);lamp.position.set(x,y,z);group.add(lamp);
 }
}

function iconInteriorLightingAndRoof(context) {
 iconMezzanineTrusses(context);
 iconLivingLighting(context);
 iconIndoorOlive(context,.97,16.21,.88);
 iconMezzaninePrint(context);
 const {THREE,group,navigation,contains,data,house,ceilingAt}=context;
 const neutral=new THREE.MeshStandardMaterial({color:'#ede8df',roughness:.84,side:THREE.DoubleSide});
 const white=new THREE.MeshStandardMaterial({name:'Smooth white living room plaster',color:'#f7f6f1',roughness:.94,side:THREE.DoubleSide});
 iconRoomCeilingLights(context);
 const inverse=group.matrix.clone().invert();
 navigation.ceilingHeight = worldXY => {
  const p=new THREE.Vector3(worldXY[0],worldXY[1],0).applyMatrix4(inverse);
  if(!contains([p.x,p.y],data.exterior.upper))return Infinity;
  return ceilingAt(p.x,p.y);
 };
 for(const part of house.meshes.filter(m=>m.kind==='roof'))iconRoofLining(context,part,inverse,neutral,white);
 group.userData={kind:'walkable-interior',rooms:data.rooms.length,stairRises:18,source:data.metadata,groundFloor:0,upperFloor:3.2};
}

function iconCurtainOpening({group}, panes, axis, inward) {
 const points=[];
 for(const pane of panes){
  const glass=group.getObjectByName(pane).geometry.attributes.position;
  for(let i=0;i<glass.count;i++) points.push([glass.getComponent(i,axis),glass.getComponent(i,1-axis),glass.getZ(i)]);
 }
 const start=Math.min(...points.map(p=>p[0])),end=Math.max(...points.map(p=>p[0]));
 const topAtEdge=edge=>Math.max(...points.filter(p=>Math.abs(p[0]-edge)<.0001).map(p=>p[2]));
 const low=topAtEdge(start),slope=(topAtEdge(end)-low)/(end-start),plane=points[0][1];
 return {
  start,end,sill:Math.min(...points.map(p=>p[2])),
  top:u=>low+(u-start)*slope,
  at:(u,depth,z)=>axis===0?[u,plane+inward*depth,z]:[plane+inward*depth,u,z]
 };
}

function iconCurtainPanel({THREE,mesh},name,opening,settings,edge,sign,cloth) {
 const {stack,depth,rise}=settings,folds=Math.max(4,Math.round(stack/.095)),columns=folds*9;
 const rows=[0,.014,.03,.14,.37,.62,.84,.965,.981,1];
 const vertices=[],colors=[],indices=[];
 for(const [j,t] of rows.entries()) for(let i=0;i<=columns;i++){
  const s=i/columns,wave=s*folds*2*Math.PI;
  const phase=wave+.13*Math.sin(wave*.45)+.31*(1-t)*Math.sin(wave*.27+sign);
  const flare=.85+.15*(1-t)**1.5;
  const u=edge+sign*(.02+stack*(s*flare+.022*(1-t)*Math.sin(phase)));
  const ripple=(.030+.013*(1-t))*Math.cos(phase)+.005*Math.sin(2*phase);
  const hem=opening.sill+.033+.008*Math.sin(phase+.8);
  const head=opening.top(u)+rise-.019;
  vertices.push(...opening.at(u,depth+ripple,hem+(head-hem)*t));
  const shade=(j===1||j===8?.91:1)*(.976+.024*Math.sin(wave*.47+1));
  colors.push(shade,shade,shade);
  if(i&&j){const n=j*(columns+1)+i;indices.push(n-columns-2,n-columns-1,n,n-columns-2,n,n-1);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 mesh(geometry,cloth,'curtain-'+name+(sign>0?'-left':'-right'));
}

function iconCurtainTrack({THREE,mesh},name,opening,settings,start,end,metal) {
 const {depth,rise,face}=settings,vertices=[];
 const at=(u,d,z=opening.top(u)+rise)=>opening.at(u,d,z);
 const addBar=(a,b,width,height)=>{
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),direction=bv.clone().sub(av);
  const bar=new THREE.BoxGeometry(width,direction.length(),height).toNonIndexed();
  bar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
  const mid=av.lerp(bv,.5);bar.translate(mid.x,mid.y,mid.z);
  vertices.push(...bar.attributes.position.array);
 };
 addBar(at(start,depth),at(end,depth),.032,.036);
 const anchors=Math.ceil((end-start)/1.6);
 for(let i=0;i<=anchors;i++){
  const u=start+.075+(end-start-.15)*i/anchors;
  addBar(at(u,depth),at(u,face),.023,.028);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.computeVertexNormals();mesh(geometry,metal,'curtain-'+name+'-track');
}

function iconInteriorCurtains(context) {
 const {THREE}=context;
 const cloth=new THREE.MeshStandardMaterial({color:'#dbccb3',roughness:.97,vertexColors:true,side:THREE.DoubleSide});
 const metal=new THREE.MeshStandardMaterial({color:'#786750',roughness:.55,metalness:.39});
 const garden={depth:.18,rise:.076,face:.12,left:-.028,right:-.028,stack:.46};
 const ground={depth:.335,rise:.083,face:.24,left:.17,right:.17,stack:.25};
 const gable={depth:.265,rise:.075,face:.18,left:.10,right:.10,stack:.33};
 const windows=[
  ['living',['facade-garden-glass-0-pane-0','facade-garden-glass-0-pane-2'],0,-1,garden],
  ['playroom',['facade-front-wing-glass-2'],0,1,ground],
  ['study',['facade-wing-end-glass-1'],1,-1,{...ground,left:.014,right:.23}],
  ['bedroom-one',['front-gable-glass-0'],0,1,gable],
  ['master',['wing-gable-glass-0'],1,-1,gable]
 ];
 for(const [name,panes,axis,inward,settings] of windows){
  const opening=iconCurtainOpening(context,panes,axis,inward);
  const start=opening.start-settings.left,end=opening.end+settings.right;
  iconCurtainTrack(context,name,opening,settings,start,end,metal);
  iconCurtainPanel(context,name,opening,settings,start,1,cloth);
  iconCurtainPanel(context,name,opening,settings,end,-1,cloth);
 }
}

function iconGuestDaybed({width:w,depth:d,part},s,p,THREE) {
 part('recessed-plinth',[.065,.075,w-.065,d-.07],0,.17,p.taupe);
 s.cushion('upholstered-frame',w/2,d/2,.245,w,d,.24,.077,p.sage);
 s.cushion('seat',w/2,d*.54,.415,w-.16,d*.89,.18,.079,p.linen);
 s.cushion('back',w/2,.076,.57,w-.055,.123,.50,.058,p.sage,-.05);
 for (const u of [.058,w-.058]) s.cushion('padded-end-'+u,u,d*.49,.48,.11,d-.036,.355,.051,p.sage);
 for (const [i,u] of [w*.25,w*.71].entries()) {
  s.cushion('linen-bolster-'+i,u,.205,.652,w*.40,.195,.34,.09,p.linen,-.15);
 }
 s.cushion('scatter',w*.22,.323,.65,.34,.137,.33,.065,p.olive,-.22).rotateY(.11);
 const vertices=[],indices=[],cols=12,drop=[[.37,.519],[.48,.522],[d-.12,.521],[d-.055,.506],[d-.016,.474],[d-.009,.435],[d-.011,.383]];
 for (let j=0;j<drop.length;j++) for(let i=0;i<=cols;i++){
  const u=i/cols,ripple=Math.cos(u*Math.PI*6+j*.13)*.004;
  vertices.push(w*.60+u*.49,drop[j][0]+(j>2?ripple:0),drop[j][1]+(j<4?ripple:ripple*.45));
  if(j&&i){const n=j*(cols+1)+i;indices.push(n-cols-2,n,n-1,n-cols-2,n-cols-1,n);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
 s.add('woven-throw',g,p.olive,0,0,0);
}

function iconGuestWardrobe({width:w,depth:d,item,part},s,p) {
 const h=item.height,open=.43,closed=w-open;
 part('body',[0,0,w,.025],.073,h-.101,p.taupe);
 part('plinth',[.031,.016,w-.031,d-.05],0,.073,p.taupe);
 part('top',[0,0,w,d-.005],h-.028,.028,p.lacquer);
 for(const u of [0,open,w-.021])part('side-'+u,[u,.025,u+.021,d-.007],.073,h-.101,p.lacquer);
 const leaf=(closed-.023)/3;
 for(let i=0;i<3;i++){
  const left=open+.019+leaf*i,u=left+(i===1?.054:leaf-.054);
  part('door-'+i,[left+.003,d-.046,left+leaf-.004,d-.019],.078,h-.115,i===2?p.taupe:p.lacquer);
  part('handle-'+i,[u-.008,d-.019,u+.008,d],.94,.245,p.silver);
 }
 for(const z of [.075,.46,.86,1.29,1.68])part('shelf-'+z,[.021,.026,open,d-.009],z,.019,p.lacquer);
 for(const [level,z] of [.479,.879].entries())for(let i=0;i<2;i++)
  s.cushion('folded-linen-'+level+i,open*.51,d*.54,z+.0325+i*.065,.325,.239,.065,.025,i?p.sage:p.linen);
 s.disc('tray',open*.5,d*.52,1.309,.125,.084,.024,p.silver);
}

function iconToyPaints(context) {
 if(context.toyPaints)return context.toyPaints;
 const colors={clay:'#b8806c',honey:'#c7a970',lagoon:'#73958b',blue:'#85869e'};
 return context.toyPaints=Object.fromEntries(Object.entries(colors).map(([key,color])=>
  [key,new context.THREE.MeshStandardMaterial({name:key+' toy paint',color,roughness:.82})]));
}

function iconPlayCubbies(context,{width:w,depth:d,item,part},s,p) {
 const h=item.height,t=.022,paint=iconToyPaints(context);
 part('body',[0,0,w,t],.038,h-.038,p.taupe);
 for(const z of [.038,h/2,h-t])part('shelf-'+z,[0,t,w,d],z,t,p.lacquer);
 for(const [i,z] of [.038+t,h/2+t].entries()){
  const top=i===0?h/2:h-t;
  for(const x of [0,(w-t)/2,w-t])part('upright-'+i+'-'+x,[x,t,x+t,d],z,top-z,p.lacquer);
 }
 for(const [i,cloth] of [p.sage,p.linen].entries()){
  const x=(i+.5)*w/2;
  s.cushion('basket-'+i,x,d*.56,.163,.449,d*.80,.203,.018,cloth);
  part('label-'+i,[x-.045,d*.96,x+.045,d*.963],.174,.033,p.taupe);
 }
 for(const [i,col] of [paint.clay,paint.honey,paint.lagoon,p.linen,paint.blue].entries()){
  const x=.045+i*.064;
  part('picture-book-'+i,[x,.073,x+.047,d-.035],h/2+t,.158+(i%3)*.021,col);
  part('spine-band-'+i,[x+.006,d-.035,x+.041,d-.034],h/2+.125,.012,p.ivory);
 }
 const blocks=[[.69,.11,0,paint.lagoon],[.79,.11,0,paint.honey],[.74,.11,.088,paint.clay]];
 for(const [i,[x,y,z,mat]] of blocks.entries())
  s.cushion('block-'+i,x,y,h/2+t+z+.044,.087,.088,.088,.009,mat);
 s.disc('stacker-base',w*.23,d*.51,h,.093,.093,.025,p.beech);
 s.disc('stacker-peg',w*.23,d*.51,h+.025,.015,.015,.23,p.beech);
 for(const [i,col] of [paint.lagoon,paint.blue,paint.honey,paint.clay].entries()){
  const r=.072-i*.012;
  const ring=new context.THREE.TorusGeometry(r-.014,.014,8,24);
  s.add('stacking-ring-'+i,ring,col,w*.23,d*.51,h+.039+i*.028);
 }
}

function iconPlayMat(context,{width:w,depth:d,part},s,p) {
 const {THREE}=context,paint=iconToyPaints(context),u=w*.34,v=d*.60,ink=.0175;
 s.cushion('woven-edge',w/2,d/2,.006,w,d,.012,.005,p.olive);
 s.cushion('woven-face',w/2,d/2,.013,w-.026,d-.026,.008,.003,p.linen);
 for(const [i,col] of [paint.clay,paint.honey,paint.lagoon].entries()){
  const outer=.32-.063*i,inner=outer-.049;
  s.add('rainbow-arc-'+i,new THREE.RingGeometry(inner,outer,40,1,0,Math.PI),col,u,v,ink);
  for(const x of [u-outer,u+inner])
   part('rainbow-foot-'+i+'-'+x,[x,v-.18,x+outer-inner,v],ink-.0002,.0002,col);
 }
 s.disc('sun',w*.79,d*.74,ink,.11,.11,.0004,paint.honey);
}

function iconWoodenTrain(context,{width:w,depth:d,part},s,p) {
 const {THREE}=context,paint=iconToyPaints(context);
 const radius=.164,left=radius+.012,right=w-left,mid=d/2;
 function stadium(path,r){
  path.moveTo(left,mid-r);path.lineTo(right,mid-r);
  path.absarc(right,mid,r,-Math.PI/2,Math.PI/2,false);path.lineTo(left,mid+r);
  path.absarc(left,mid,r,Math.PI/2,Math.PI*1.5,false);path.closePath();return path;
 }
 function track(name,outer,inner,z,height,mat){
  const shape=stadium(new THREE.Shape(),outer);
  shape.holes.push(stadium(new THREE.Path(),inner));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,curveSegments:16,bevelEnabled:false});
  s.add(name,geometry,mat,0,0,z);
 }
 track('beech-track',radius,radius-.057,0,.016,p.beech);
 for(const offset of [.011,.042])track('wheel-groove-'+offset,radius-offset,radius-offset-.004,.016,.0004,p.taupe);
 const v=mid-radius+.028;
 for(const [i,u] of [.255,.417].entries()){
  const body=i?paint.lagoon:paint.clay;
  s.cushion('chassis-'+i,u,v,.056,.146,.058,.028,.007,p.taupe);
  for(const x of [u-.045,u+.045])for(const y of [v-.023,v+.023]){
   const wheel=new THREE.CylinderGeometry(.026,.026,.011,16);
   s.add('wheel-'+i+'-'+x+'-'+y,wheel,p.black,x,y,.043);
  }
  if(i){
   s.cushion('wagon',u,v,.083,.14,.057,.037,.005,body);
   for(const x of [u-.029,u+.029])s.cushion('cargo-'+x,x,v,.123,.046,.041,.045,.005,paint.honey);
  }else{
   const boiler=new THREE.CylinderGeometry(.027,.027,.076,18);boiler.rotateZ(Math.PI/2);
   s.add('boiler',boiler,body,u-.022,v,.094);
   part('cab',[u+.019,v-.027,u+.062,v+.027],.070,.078,paint.lagoon);
   part('cab-roof',[u+.012,v-.033,u+.068,v+.033],.148,.010,p.taupe);
   s.disc('chimney',u-.048,v,.111,.009,.009,.033,p.black);
  }
 }
}

function iconOfficeKeyboard(context,s,p,u,v,h) {
 const {THREE}=context;
 if(!context.keyboardCapMaterial){
  const width=160,height=56,a=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const row=Math.min(4,Math.floor(y/11)),col=x+([0,1,3,5,1][row]);
   const space=row===0&&x>=45&&x<=105;
   const top=(space||col%10>=1&&col%10<=8)&&y%11>=1&&y%11<=8;
   const mark=top&&!space&&col%10===3&&y%11===6;
   const ink=mark?180:top?86:42;a.set([ink,ink+2,ink+3,255],(y*width+x)*4);
  }
  const map=new THREE.DataTexture(a,width,height);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;
  map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  context.keyboardCapMaterial=new THREE.MeshStandardMaterial({map,roughness:.75});
 }
 s.cushion('keyboard',u,v,h+.008,.425,.153,.016,.007,p.black);
 s.add('keycaps',new THREE.PlaneGeometry(.407,.133),context.keyboardCapMaterial,u,v,h+.0162);
 s.cushion('mouse',u+.295,v-.014,h+.018,.066,.104,.036,.017,p.black);
}

function iconElectricDeskFrame({width:w,depth:d,part,line},s,p,h) {
 const underside=h-.025,rail=underside-.078,v=d*.46,mid=(.43+rail)/2;
 for(const [i,u] of [.145,w-.145].entries()){
  for(const [j,y] of [.085,d-.085].entries())s.disc('levelling-pad-'+i+'-'+j,u,y,0,.029,.029,.013,p.black);
  part('t-foot-'+i,[u-.037,.04,u+.037,d-.04],.013,.04,p.graphite);
  part('lifting-column-base-'+i,[u-.041,v-.033,u+.041,v+.033],.053,.377,p.graphite);
  part('lifting-column-middle-'+i,[u-.035,v-.028,u+.035,v+.028],.422,mid-.422,p.graphite);
  part('lifting-column-inner-'+i,[u-.029,v-.023,u+.029,v+.023],mid-.008,rail-mid+.015,p.graphite);
  part('motor-'+i,[u-.054,v-.049,u+.054,v+.049],rail,.058,p.graphite);
  part('top-bracket-'+i,[u-.046,.085,u+.046,d-.085],underside-.021,.021,p.graphite);
 }
 part('support-rail',[.199,v-.029,w-.199,v+.029],rail+.012,.046,p.graphite);
 const trayZ=underside-.095;
 part('cable-tray',[.23,.074,w-.23,.195],trayZ,.012,p.graphite);
 for(const y of [.074,.183])part('tray-lip-'+y,[.23,y,w-.23,y+.012],trayZ+.012,.032,p.graphite);
 for(const x of [.25,w-.25])part('tray-hanger-'+x,[x,.112,x+.017,.153],trayZ+.012,.083,p.graphite);
 part('control-unit',[w*.42,v-.125,w*.60,v-.033],underside-.043,.043,p.black);
 const panel=w-.317;
 part('control-panel',[panel,d-.091,panel+.112,d-.009],underside-.034,.034,p.black);
 part('height-display',[panel+.009,d-.009,panel+.040,d-.007],underside-.025,.014,p.screen);
 for(const [key,x] of [panel+.060,panel+.091].entries()){
  const z=underside-.018,tip=z+(key?-.004:.004);
  line('control-chevron-left-'+key,[x-.005,d-.006,z],[x,d-.006,tip],.0015,p.silver);
  line('control-chevron-right-'+key,[x,d-.006,tip],[x+.005,d-.006,z],.0015,p.silver);
 }
 s.tube('power-lead',[[.27,.125,trayZ+.02],[.20,.13,trayZ-.06],[.105,.135,.44],[.11,.16,.18],
  [.145,.215,.11],[.145,v-.039,.083]],.005,p.black);
 s.tube('controller-wire',[[panel+.018,d-.081,underside-.013],[panel-.01,d*.72,underside-.021],
  [w*.63,d*.49,underside-.023],[w*.59,v-.09,underside-.027]],.003,p.black);
}

function iconStudyDesk(context,frame,s,p) {
 const {width:w,depth:d,part,line}=frame,windowDesk=frame.item.id==='office-desk-window';
 const h=frame.item.worktopHeightM;
 s.cushion('top',w/2,d/2,h-.0125,w,d,.025,.005,p.laminate);
 iconElectricDeskFrame(frame,s,p,h);
 s.cushion('desk-mat',w*.52,d*.68,h+.0025,.91,.338,.005,.002,p.felt);
 const screens=windowDesk?[[0,w*.50,.214,.69,.397]]:[[0,w*.45,.218,.61,.355],[1,w*.815,.178,.27,.443]];
 for(const [i,u,v,mw,mh] of screens){
  s.cushion('monitor-foot-'+i,u,v,h+.0095,.189,.138,.019,.008,p.black);
  part('display-neck-'+i,[u-.022,v-.022,u+.022,v+.011],h+.015,.257,p.black);
  const z=h+(i?.088:.132);
  part('display-frame-'+i,[u-mw/2,v-.020,u+mw/2,v+.015],z,mh,p.black);
  part('display-'+i,[u-mw/2+.008,v+.015,u+mw/2-.008,v+.016],z+.015,mh-.023,p.screen);
  part('status-light-'+i,[u+mw*.38,v+.015,u+mw*.38+.007,v+.016],z+.005,.002,frame.mats.lamp);
  s.disc('cable-port-'+i,u+.05,.059,h,.024,.024,.002,p.graphite);
  s.tube('monitor-wire-'+i,[[u,v-.022,z+.083],[u-.016,v-.03,z+.026],[u-.005,v-.043,h+.036],
   [u+.04,.077,h+.013],[u+.05,.059,h+.002]],.003,p.black);
 }
 iconOfficeKeyboard(context,s,p,w*.52,d*.69,h+.005);
 const u=.115,v=.15;
 s.disc('task-lamp-foot',u,v,h,.066,.066,.014,p.graphite);
 line('task-lamp-arm',[u,v,h+.014],[u-.005,v,h+.322],.009,p.silver);
 line('task-lamp-elbow',[u-.005,v,h+.322],[u+.098,v+.067,h+.426],.008,p.silver);
 s.cushion('task-lamp-shade',u+.113,v+.081,h+.417,.106,.083,.039,.013,p.graphite);
 part('folio',[.055,.32,.244,.568],h,.017,p.indigo);
}

function iconStudyChair({item,width:w,depth:d,line},s,p,THREE) {
 const upholstery=item.id==='office-chair-window'?p.felt:p.sage;
 const u=w/2,v=d/2,r=Math.min(w,d)*.428;
 for(let i=0;i<5;i++){
  const a=(i+.5)*2*Math.PI/5,dx=Math.cos(a),dy=Math.sin(a);
  line('spoke-'+i,[u,v,.143],[u+r*dx,v+r*dy,.075],.014,p.graphite);
  const wheel=new THREE.CylinderGeometry(.033,.033,.041,12);wheel.rotateZ(a);
  s.add('castor-'+i,wheel,p.black,u+r*dx,v+r*dy,.033);
 }
 s.disc('lift',u,v,.095,.036,.036,.18,p.black);
 s.disc('gas-piston',u,v,.275,.021,.021,.116,p.silver);
 s.cushion('seat',u,d*.55,.441,w*.82,d*.75,.107,.052,upholstery);
 s.cushion('back',u,d*.152,.746,w*.76,.079,.49,.038,upholstery,-.104);
 s.cushion('lumbar-support',u,d*.219,.636,w*.62,.056,.126,.027,upholstery,-.104);
 line('spine',[u,d*.37,.402],[u,d*.115,.782],.026,p.graphite);
 for(const x of [w*.077,w*.923]){
  line('arm-support-'+x,[x,d*.53,.398],[x,d*.53,.605],.017,p.graphite);
  s.cushion('arm-rest-'+x,x,d*.52,.622,.067,d*.42,.044,.019,p.black);
 }
}

function iconPugBed(context,frame) {
 const {THREE}=context,{width:w,depth:d,item}=frame,s=iconLivingShapes(context,frame),p=iconLivingPalette(context);
 const profile=[[.10,.010],[.67,.005],[.83,.015],[.94,.032],[.982,.056],[1,.085],
  [.992,.111],[.958,.137],[.898,.159],[.814,.175],[.730,.18],[.650,.175],
  [.570,.160],[.500,.143],[.446,.121],[.418,.103],[.412,.084],[.421,.064]];
 const geometry=new THREE.LatheGeometry(profile.map(([r,h])=>new THREE.Vector2(r,h)),192);
 geometry.rotateX(Math.PI/2);
 const {position,uv}=geometry.attributes;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i),u=uv.getX(i);
  const phase=(u*24+.5)%1,seam=Math.exp(-((Math.min(phase,1-phase)/.115)**2));
  const swell=1-.009*seam;
  position.setXYZ(i,x*w/2*swell,y*d/2*swell,z*(item.height/.18)*(1-.018*seam)-.009*Math.max(y,0)**4);
  uv.setX(i,u+.5/24);
 }
 geometry.computeVertexNormals();
 s.disc('non-slip-base',w/2,d/2,0,w*.398,d*.398,.016,p.shadow);
 s.add('radial-panel-bolster',geometry,p.pugStripe,w/2,d/2,0);
 iconUpperCeramic(s,THREE,'nesting-cushion',w/2,d/2,0,w*.231,d*.231,
  [[0,.042],[.93,.045],[1,.070],[.99,.094],[.94,.107],[.82,.113],[.55,.101],[.23,.095],[0,.094]],p.tomatoCloth);
}

function iconStudyPrint({THREE},s,frame,p,paint,left,base,width) {
 const {part}=frame,height=.79;
 part('print-frame',[left,.031,left+width,.055],base,height,p.beech);
 part('print-paper',[left+.016,.055,left+width-.016,.058],base+.016,height-.032,paint.chalk);
 const plane=(name,u,z,radius,start,arc,material,face=.060)=>{
  const shape=new THREE.CircleGeometry(radius,48,start,arc);
  shape.rotateX(-Math.PI/2);
  s.add('print-'+name,shape,material,left+u,face,base+z);
 };
 plane('sun',width*.69,height*.70,.104,0,Math.PI*2,paint.clay,.059);
 plane('arch',width*.44,height*.49,.212,Math.PI,Math.PI,paint.cocoa);
 part('print-arch-column',[left+width*.44-.212,.058,left+width*.44+.212,.060],base+.18,height*.49-.18,paint.cocoa);
 plane('arch-cutout',width*.44,height*.49,.110,Math.PI,Math.PI,paint.chalk,.061);
 part('print-arch-opening',[left+width*.44-.11,.060,left+width*.44+.11,.061],base+.18,height*.49-.18,paint.chalk);
 part('print-horizon',[left+.052,.061,left+width-.052,.063],base+.15,.015,paint.indigo);
}

function iconStudyShelfObjects(context,frame,s,p,paint,bays) {
 const {part,depth:d}=frame,[left,right]=bays;
 const covers=[paint.indigo,paint.chalk,paint.clay,paint.putty,paint.cocoa,p.olive];
 for(const [row,u,z,n] of [[0,.065,.716,8],[1,.068,1.556,6],[2,right+.062,1.086,7],[3,right+.075,2.206,5]]){
  let x=u;
  for(let i=0;i<n;i++){
   const thick=.031+((row+i*2)%4)*.009,h=.181+((i*7+row)%5)*.028,front=d-.030-(i%3)*.007;
   part('book-'+row+'-'+i,[x,.032,x+thick,front],z,h,covers[(row+i)%covers.length]);
   part('spine-band-'+row+'-'+i,[x+.004,front,x+thick-.004,front+.002],z+h*.72,.007,paint.chalk);
   x+=thick+.003;
  }
 }
 for(let i=0;i<3;i++){
  const dx=i%2*.019;
  part('folio-'+i,[left+.06+dx,.039,left+.36+dx,d-.026],.716+i*.037,.036,covers[i]);
 }
 const vase=(name,u,z,rx,ry,profile,material)=>iconUpperCeramic(s,context.THREE,name,u,d*.52,z,rx,ry,profile,material);
 vase('stoneware-vase',.31,1.146,.082,.078,[[0,0],[.66,0],[.98,.025],[1,.14],[.57,.21],[.47,.273],[.36,.273],[.32,.217]],paint.clay);
 vase('stoneware-bowl',right+.31,1.606,.105,.093,[[0,0],[.57,0],[.72,.026],[1,.097],[.92,.099],[.68,.043],[0,.031]],p.stone);
 vase('small-urn',left+.32,2.206,.094,.085,[[0,0],[.55,0],[.94,.045],[1,.13],[.65,.211],[.47,.226],[.33,.226],[.34,.203]],paint.indigo);
}

function iconStudyBookcase(context,frame,s,p) {
 const {width:w,depth:d,item,part,line}=frame;
 const h=item.height,paint=iconLivingPalette(context),left=w*.282,right=w*.720,t=.026;
 part('body',[0,0,w,.017],.068,h-.068,p.taupe);
 part('plinth',[.015,.019,w-.015,d-.042],0,.068,paint.cocoa);
 const shelfLevels=[.068,.69,2.18,h-t];
 part('niche-back',[left+t/2,.017,right-t/2,.030],.69+t,2.18-.69-t,paint.putty);
 for(const [i,z] of shelfLevels.entries()){
  part('shelf-'+i,[0,.017,w,d],z,t,p.lacquer);
  if(i===shelfLevels.length-1)continue;
  const depth=i===0?d-.052:d;
  for(const [j,x] of [0,left-t/2,right-t/2,w-t].entries())
   part('upright-'+i+'-'+j,[x,.017,x+t,depth],z+t,shelfLevels[i+1]-z-t,p.lacquer);
 }
 for(const [i,[a,b,z]] of [[t,left-t/2,1.12],[t,left-t/2,1.53],[t,left-t/2,1.86],
  [right+t/2,w-t,1.06],[right+t/2,w-t,1.58]].entries())
  part('bay-shelf-'+i,[a,.018,b,d],z,t,p.lacquer);
 const dark=paint.cocoa,reed=dark.clone();reed.color.offsetHSL(0,.012,.032);
 for(let i=0;i<4;i++){
  const a=i*w/4+.004,b=(i+1)*w/4-.004;
  part('door-'+i,[a,d-.050,b,d-.032],.096,.585,dark);
  const x=(i%2? a+.061:b-.061);
  for(const dx of [-.033,.033])line('pull-mount-'+i+'-'+dx,[x+dx,d-.032,.552],[x+dx,d-.012,.552],.007,p.beech);
  line('handle-'+i,[x-.044,d-.012,.552],[x+.044,d-.012,.552],.012,p.beech);
 }
 for(const i of [0,3]){
  const a=i*w/4,b=(i+1)*w/4;
  for(let j=0;j<13;j++){
   const x=a+(j+.5)*(b-a)/13;
   part('reed-'+i+'-'+j,[x-.008,d-.032,x+.008,d-.025],.099,.576,reed);
  }
 }
 const printWidth=Math.min(.73,right-left-.14);
 iconStudyPrint(context,s,frame,p,paint,(left+right-printWidth)/2,1.10,printWidth);
 iconStudyShelfObjects(context,frame,s,p,paint,[left,right]);
}

function iconGroundVanity(context,{width:w,depth:d,part,line,mats},s,p) {
 const {THREE}=context;
 s.cushion('vanity',w/2,d*.455,.548,w-.032,d*.87,.457,.012,p.cocoa);
 for(let i=0;i<2;i++)part('drawer-'+i,[.018,d-.062,w-.018,d-.048],.324+i*.217,.202,p.putty);
 part('stone-counter',[0,.006,w,d],.778,.029,p.stone);
 iconUpperCeramic(s,THREE,'bowl',w/2,d*.568,.807,w*.405,d*.376,
  [[.55,0],[.80,.025],[1,.086],[.995,.104],[.96,.108],[.905,.085],[.64,.028],[.10,.012]],mats.white);
 s.disc('drain',w/2,d*.568,.821,.021,.021,.003,p.brass);
 s.tube('tap',[[w*.55,.051,.807],[w*.55,.051,.982],[w*.55,.079,1.007],[w*.55,.158,1.007],[w*.55,.169,.987]],.010,p.brass);
 for(const u of [.087,w-.087])line('towel-bracket-'+u,[u,d-.048,.682],[u,d-.018,.682],.008,p.brass);
 line('towel-rail',[.078,d-.018,.682],[w-.078,d-.018,.682],.009,p.brass);
 s.cushion('linen-towel',w*.612,d-.016,.551,.164,.028,.279,.010,p.linen);
 part('towel-hem',[w*.612-.079,d-.0014,w*.612+.079,d-.0004],.430,.011,p.sage);
 function capsule(name,r,height,depth,face,mat){
  const straight=height/2-r,shape=new THREE.Shape();
  shape.absarc(0,straight,r,0,Math.PI,false);shape.absarc(0,-straight,r,Math.PI,Math.PI*2,false);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:16});g.rotateX(Math.PI/2);
  s.add(name,g,mat,w/2,face,1.447);
 }
 const silver=context.upperMirror??=new THREE.MeshStandardMaterial({color:'#cbd8d6',metalness:.26,roughness:.12});
 capsule('mirror-rim',.209,.712,.023,.029,p.brass);
 capsule('mirror',.202,.698,.005,.033,silver);
 part('sconce-base',[w*.41,.005,w*.59,.044],1.872,.05,p.brass);
 line('sconce-stem',[w*.5,.039,1.9],[w*.5,.088,1.9],.012,p.brass);
 line('opal-light',[w*.22,.087,1.895],[w*.78,.087,1.895],.023,mats.lamp);
}

function iconGroundWc(context,{width:w,depth:d,part,mats},s,p) {
 const vessel=(name,z,rx,ry,profile)=>iconUpperCeramic(s,context.THREE,name,w/2,d*.605,z,rx,ry,profile,mats.white);

 part('cistern',[.012,.008,w-.012,d*.165],.018,1.002,p.shadow);
 part('wall-carrier',[w*.22,.057,w*.78,d*.43],.15,.22,mats.white);
 vessel('base',.116,w*.479,d*.39,[[.40,0],[.59,.023],[.79,.095],[.98,.21],[1,.278],[.972,.292],[.823,.293],[.702,.241],[.33,.109],[.025,.092]]);
 vessel('seat',.408,w*.481,d*.395,[[.757,0],[.94,0],[1,.012],[.977,.033],[.8,.033],[.753,.017],[.757,0]]);
 vessel('lid',.440,w*.477,d*.391,[[.001,0],[.84,0],[.98,.004],[1,.012],[.97,.021],[.78,.027],[.01,.03]]);
 part('flush-plate',[w*.27,d*.178,w*.73,d*.188],.810,.107,p.black);
 part('flush-large',[w*.295,d*.188,w*.516,d*.195],.828,.071,p.shadow);
 part('flush-small',[w*.531,d*.188,w*.699,d*.195],.828,.071,p.shadow);
}

function iconGroundShower(context,frame,s,p) {
 const {width:w,depth:d,part,line,point,mats}=frame;
 const entry=.70,edge=d-.024,top=2.08;
 s.cushion('tray',w/2,d/2,.029,w,d,.05,.012,p.stone);
 part('drain-slot',[w*.60,.078,w-.092,.098],.054,.002,p.espresso);
 part('tile-backing',[.004,0,w-.004,.015],.054,2.114,p.stone);
 part('glass',[entry,edge-.006,w-.018,edge+.006],.074,top-.074,mats.glass).castShadow=false;
 part('glazing-channel',[entry,edge-.013,w-.012,edge+.013],.054,.020,p.brass);
 line('glass-brace',[w-.078,.018,top-.04],[w-.078,edge,top-.04],.010,p.brass);
 for(const z of [1.036,1.856])line('rail-bracket-'+z,[w-.33,.012,z],[w-.33,.078,z],.014,p.brass);
 line('column',[w-.33,.077,1.036],[w-.33,.077,2.01],.013,p.brass);
 s.tube('arm',[[w-.33,.077,1.965],[w-.33,.077,2.019],[w-.33,.108,2.045],[w-.33,.317,2.045],[w-.33,.344,2.016]],.012,p.brass);
 s.disc('rain-head',w-.33,.343,1.991,.109,.109,.021,p.brass);
 s.disc('spray-face',w-.33,.343,1.988,.103,.103,.004,p.ivory);
 line('thermostat',[w-.454,.077,1.033],[w-.208,.077,1.033],.022,p.brass);
 s.tube('handset-hose',[[w-.243,.077,1.033],[w-.224,.122,.742],[w-.396,.126,.650],[w-.491,.101,.92],[w-.491,.101,1.265]],.006,p.brass);
 line('handset-bracket',[w-.491,.012,1.29],[w-.491,.104,1.29],.015,p.brass);
 line('handset',[w-.491,.101,1.255],[w-.491,.130,1.445],.020,p.brass);
 const a=point(entry,edge-.013),b=point(w-.012,edge+.013);
 frame.walkBox=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
}

function iconPantryLabel(context,shapes,key,text,u,v,z,width,height) {
 const {THREE}=context,labels=context.pantryLabels??=new Map();
 if(!labels.has(text)){
  const paper=new THREE.MeshStandardMaterial({color:'#f5edda',roughness:.88});
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;
   const ink=canvas.getContext('2d');ink.fillStyle='#f5edda';ink.fillRect(0,0,256,96);
   ink.fillStyle='#344541';ink.fillRect(10,9,236,5);ink.fillRect(10,81,236,3);
   ink.font='bold 36px sans-serif';ink.textAlign='center';ink.textBaseline='middle';ink.fillText(text,128,48,226);
   paper.map=new THREE.CanvasTexture(canvas);paper.map.colorSpace=THREE.SRGBColorSpace;paper.color.set(0xffffff);
  }
  labels.set(text,paper);
 }
 const face=iconLabelPlane(context,width,height);
 shapes.add(key+'-label',face,labels.get(text),u,v,z);
}

function iconPantryJar(context,shapes,key,u,v,z,r,h,contents,cap,label) {
 const {THREE}=context;
 const glass=context.pantryGlass??=new THREE.MeshStandardMaterial({color:'#d4e6d8',transparent:true,opacity:.19,depthWrite:false,roughness:.13,metalness:.10});
 const skin=[[0,0],[r*.9,0],[r,.007],[r,h*.78],[r*.93,h*.84],[r*.77,h*.88],[r*.77,h*.94]];
 const profile=skin.map(([radius,height])=>new THREE.Vector2(radius,height));
 const jar=new THREE.LatheGeometry(profile,18).rotateX(Math.PI/2);
 shapes.add(key+'-glass',jar,glass,u,v,z).castShadow=false;
 shapes.disc(key+'-contents',u,v,z+.006,r*.94,r*.94,h*.72,contents);
 shapes.disc(key+'-cap',u,v,z+h*.92,r*.83,r*.83,h*.08,cap);
 iconPantryLabel(context,shapes,key,label,u,v+r+.001,z+h*.46,r*1.22,r*.55);
}

function iconBrorFinishes(context) {
 return context.brorFinishes??={
  steel:context.material('#303234',{name:'BROR black powder-coated galvanized steel',roughness:.57,metalness:.46}),
  fastener:context.material('#44484a',{name:'BROR black steel fittings',roughness:.44,metalness:.55}),
  cap:context.material('#222526',{name:'BROR moulded foot cap',roughness:.84}),
  plywood:iconLongGrainOak(context.THREE,'BROR pine plywood worktop',[198,165,115]),
 };
}

function iconBrorPost(THREE,width,height,holes) {
 const face=new THREE.Shape(),t=.0018,r=.004;
 face.moveTo(0,0);face.lineTo(width,0);face.lineTo(width,height-.005);
 face.quadraticCurveTo(width,height,width-.005,height);face.lineTo(0,height);face.closePath();
 for(const z of holes){
  const u=width*.52,cut=new THREE.Path();
  cut.moveTo(u-r,z);cut.absarc(u,z,r,Math.PI,0,true);
  cut.lineTo(u+r*.58,z-.007);cut.lineTo(u-r*.58,z-.007);cut.closePath();face.holes.push(cut);
 }
 return new THREE.ExtrudeGeometry(face,{depth:t,bevelEnabled:false,curveSegments:5}).rotateX(Math.PI/2).translate(0,t,0);
}

function iconBrorUprights(context,frame,shapes,height,bench) {
 const {THREE}=context,{width:w,depth:d,part}=frame,p=iconBrorFinishes(context);
 const holes=bench?[.07,.27,.47,.69,.81]:Array.from({length:17},(_,i)=>.068+.11*i);
 const flange=bench?.042:.032,t=.0018;
 const face=iconBrorPost(THREE,flange,height-.006,holes);
 const side=iconBrorPost(THREE,flange-t,height-.006,holes).rotateZ(Math.PI/2).translate(t,t,0);
 const corners=[[.002,.002,0],[w-.002,.002,Math.PI/2],[w-.002,d-.002,Math.PI],[.002,d-.002,-Math.PI/2]];
 for(const [i,[x,y,yaw]] of corners.entries()){
  shapes.add('pierced-post-'+i,face,p.steel,x,y,.006).rotateZ(yaw);
  shapes.add('return-flange-'+i,side,p.steel,x,y,.006).rotateZ(yaw);
  const lx=x<w/2?0:w-flange-.004,ly=y<d/2?0:d-flange-.004;
  part('foot-cap-'+i,[lx,ly,lx+flange+.004,ly+flange+.004],0,.006,p.cap);
 }
}

function iconBrorDeck(frame,key,z,p) {
 const {width:w,depth:d,part}=frame,lip=.033;
 part(key+'-deck',[.005,.005,w-.005,d-.005],z-.003,.003,p.steel);
 for(const [i,v] of [.006,d-.009].entries())
  part(key+'-fold-'+i,[.011,v,w-.011,v+.003],z-lip,lip-.003,p.steel);
 for(const [i,u] of [.007,w/2-.009,w-.010].entries())
  part(key+'-support-'+i,[u,.009,u+(i===1?.018:.003),d-.009],z-lip,lip-.003,p.steel);
}

function iconBrorStockBin(context,frame,shapes,key,u,z,width,depth,paint,label) {
 const {part}=frame,v=.285,height=.224;
 shapes.cushion(key+'-tub',u,v,z+height/2,width,depth,height,.014,paint.putty);
 part(key+'-lid',[u-width/2-.003,v-depth/2-.003,u+width/2+.003,v+depth/2+.003],z+height,.016,paint.ivory);
 iconPantryLabel(context,shapes,key,label,u,v+depth/2+.002,z+.135,.112,.043);
}

function iconBrorShelfStock(context,frame,shapes,paint,row,z,label) {
 const {width:w,part}=frame,p=iconBrorFinishes(context),count=w>.8?5:4;
 const fills=[paint.cocoa,paint.clay,paint.olive,paint.putty],fill=fills[row%4];
 for(const [lane,v] of [.161,.404].entries())for(let j=0;j<count;j++){
  const u=.091+j*(w-.182)/(count-1),key='stock-'+row+'-'+lane+'-'+j;
  if(row===1){
   const r=.054,h=.118;
   shapes.disc(key+'-can',u,v,z,r,r,h,fill);
   shapes.disc(key+'-base',u,v,z,r+.001,r+.001,.004,paint.silver);
   shapes.disc(key+'-lid',u,v,z+h-.004,r+.001,r+.001,.004,paint.silver);
   iconPantryLabel(context,shapes,key,label,u,v+r+.002,z+h*.50,.086,.038);
  }else if(row===2){
   iconPantryJar(context,shapes,key,u,v,z,.057,.191,fill,p.fastener,label);
  }else{
   const h=row===3?.192:.157,depth=.116,bag=row===3;
   part(key+'-packet',[u-.064,v-depth/2,u+.064,v+depth/2],z,h,bag?paint.putty:fill);
   if(bag)part(key+'-fold',[u-.058,v-.012,u+.058,v+.012],z+h,.016,paint.chalk);
   iconPantryLabel(context,shapes,key,label,u,v+depth/2+.001,z+h*.53,.101,.043);
  }
 }
}

function iconBrorRack(context,frame,shapes,paint) {
 const {THREE}=context,{width:w,item}=frame,p=iconBrorFinishes(context);
 const levels=item.shelfLevelsM;
 iconBrorUprights(context,frame,shapes,1.90,false);
 for(const [i,z] of levels.entries())iconBrorDeck(frame,'shelf-'+i,z,p);
 const span=w-.042,rise=.66;
 for(const [i,sign] of [-1,1].entries()){
  const strap=new THREE.BoxGeometry(Math.hypot(span,rise),.003,.016).rotateY(-sign*Math.atan2(rise,span));
  shapes.add('cross-brace-'+i,strap,p.fastener,w/2,.009+i*.004,.78);
 }
 for(const [i,x] of [.034,w-.034].entries())
  frame.part('wall-restraint-'+i,[x-.009,0,x+.009,.030],1.82,.018,p.fastener);
 const wide=w>.8,goods=item.stock;
 for(let i=0;i<2;i++)
  iconBrorStockBin(context,frame,shapes,'reserve-'+i,(i+.5)*w/2,levels[0],wide?.335:.252,.395,paint,goods[0]);
 for(let row=1;row<levels.length-1;row++)iconBrorShelfStock(context,frame,shapes,paint,row,levels[row],goods[row]);
 for(let i=0;i<2;i++){
  const u=(i+.5)*w/2,z=levels.at(-1);
  frame.part('carton-'+i,[u-.112,.087,u+.112,.398],z,.145,paint.chalk);
  frame.part('carton-tape-'+i,[u-.021,.087,u+.021,.398],z+.145,.001,paint.putty);
  iconPantryLabel(context,shapes,'carton-'+i,goods.at(-1),u,.399,z+.071,.145,.048);
 }
}

function iconBrorWallRack(context,frame,shapes,paint) {
 const p=iconBrorFinishes(context),{width:w,part}=frame;
 const start=(w-.875)/2,end=start+.875,base=1.43;
 part('wall-cleat',[start,0,end,.014],base+.845,.055,p.steel);
 for(const [i,u] of [start+.023,end-.023].entries()){
  part('wall-rail-'+i,[u-.015,.015,u+.015,.048],base,.885,p.steel);
 }
 const labels=['PESTO','MIÓD','ZIOŁA','HERBATA'],fills=[paint.olive,paint.putty,paint.cocoa,paint.clay];
 for(const [row,offset] of [.06,.32,.58,.84].entries()){
  const z=base+offset;
  part('wall-shelf-'+row,[start+.0125,.05,end-.0125,.45],z-.008,.008,p.steel);
  for(const [i,x] of [start+.038,end-.038].entries()){
   part('wall-arm-'+row+'-'+i,[x-.008,.044,x+.008,.435],z-.029,.021,p.fastener);
  }
  for(let i=0;i<5;i++){
   const u=start+.112+i*.160;
   iconPantryJar(context,shapes,'wall-stock-'+row+'-'+i,u,.337,z,.052,.154,fills[row],p.fastener,labels[row]);
  }
 }
}

function iconPantryCrate(context,frame,shapes,key,u,z,produce,vegetable) {
 const {part}=frame,p=iconBedroomOfficePalette(context),width=.48,depth=.36,back=.09,front=back+depth;
 part(key+'-bottom',[u,back,u+width,front],z,.016,p.beech);
 for(const [i,x] of [u,u+width-.014].entries())part(key+'-end-'+i,[x,back,x+.014,front],z+.016,.177,p.beech);
 for(const [i,y] of [back,front-.012].entries())for(const [j,h] of [.021,.095,.167].entries()){
  part(key+'-slat-'+i+'-'+j,[u+.014,y,u+width-.014,y+.012],z+h,.038,p.beech);
 }
 for(let i=0;i<11;i++){
  const upper=i>=8,col=upper?i-8:i%4;
  const x=u+.079+col*.107+(upper?.053:0),y=back+.106+(upper?.056:Math.floor(i/4)*.112);
  const radiusZ=vegetable?.046:.057;
  const tuber=new context.THREE.SphereGeometry(1,11,7);
  tuber.scale(.058,.052,radiusZ);
  const root=shapes.add(key+'-produce-'+i,tuber,produce,x,y,z+.016+radiusZ*(upper?2.25:1));
  root.rotation.z+=i*.85;
 }
}

function iconBrorBench(context,frame,shapes,paint) {
 const {width:w,depth:d,part}=frame,p=iconBrorFinishes(context);
 iconBrorUprights(context,frame,shapes,.857,true);
 iconBrorDeck(frame,'lower',.16,p);iconBrorDeck(frame,'middle',.49,p);
 iconBrorDeck(frame,'top-frame',.857,p);
 part('pine-plywood',[0,0,w,d],.857,.023,p.plywood);
 iconPantryCrate(context,frame,shapes,'potatoes',.038,.16,paint.putty,true);
 iconPantryCrate(context,frame,shapes,'onions',w-.518,.16,iconBedroomOfficePalette(context).beech,false);
 for(let i=0;i<3;i++)iconBrorStockBin(context,frame,shapes,'bulk-'+i,.195+i*.355,.49,.30,.38,paint,['MĄKA','RYŻ','KASZA'][i]);
 iconBrorWallRack(context,frame,shapes,paint);
}

function iconGroundRoomFurniture(context,frame) {
 const id=frame.item.id;
 const draw=iconGroundRoomBuilders[id];
 if(!draw)return false;
 const p=frame.item.room==='0.8'||frame.item.room==='0.9'?iconBedroomOfficePalette(context):iconLivingPalette(context);
 const segments=draw===iconStudyDesk?3:5;
 draw(context,frame,iconLivingShapes(context,frame,segments),p);
 return true;
}

const iconGroundRoomBuilders={
 'pantry-bror-85':iconBrorRack,
 'pantry-bror-65':iconBrorRack,
 'pantry-bror-return':iconBrorRack,
 'pantry-bror-bench':iconBrorBench,
 'entry-wardrobe-rear':iconEntryWardrobe,
 'entry-wardrobe-side':iconEntryWardrobe,
 'entry-console':iconEntryConsole,
 'entry-pouf':iconEntryPouf,
 'guest-sofa-bed':(c,f,s,p)=>iconGuestDaybed(f,s,p,c.THREE),
 'guest-wardrobe':(_,f,s,p)=>iconGuestWardrobe(f,s,p),
 'play-cubbies':iconPlayCubbies,
 'play-mat':iconPlayMat,
 'play-train':iconWoodenTrain,
 'office-desk':iconStudyDesk,
 'office-chair':(c,f,s,p)=>iconStudyChair(f,s,p,c.THREE),
 'office-desk-window':iconStudyDesk,
 'office-chair-window':(c,f,s,p)=>iconStudyChair(f,s,p,c.THREE),
 'office-bookcase':iconStudyBookcase,
 'ground-bath':iconGroundVanity,
 'ground-wc':iconGroundWc,
 'ground-shower':iconGroundShower,
};

function iconFinishTexture(THREE,name,width,height,roughness,sample,repeat) {
 const bytes=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,[r,g,b]=sample((x+.5)/width,(y+.5)/height);
  bytes[i]=r;bytes[i+1]=g;bytes[i+2]=b;bytes[i+3]=255;
 }
 const map=new THREE.DataTexture(new Uint8Array(bytes.buffer),width,height);
 if(repeat){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(...repeat);}
 map.name=name;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.anisotropy=4;map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;
 const material=new THREE.MeshStandardMaterial({map,roughness});material.name=name;
 return material;
}

function iconMoodWallPanel({THREE,mesh},id,a,b,bottom,height,material) {
 const width=Math.hypot(b[0]-a[0],b[1]-a[1]),geometry=new THREE.PlaneGeometry(width,height);
 const uv=geometry.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width,uv.getY(i)*height);
 geometry.rotateX(Math.PI/2);geometry.rotateZ(Math.atan2(b[1]-a[1],b[0]-a[0]));
 const panel=mesh(geometry,material,id);
 panel.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,bottom+height/2);
 panel.castShadow=false;
}

function iconLocalSconceLight({THREE,group},id,x,y,z,intensity=6) {
 const lamp=new THREE.PointLight('#ffdaaf',intensity,3.4,2);
 lamp.name='sconce-light-'+id;lamp.position.set(x,y,z);group.add(lamp);
}

function iconMoodSconce(context,id,x,y,z,nx,ny) {
 const {THREE,mesh,mats}=context;
 const normal=new THREE.Vector3(nx,ny,0);
 const base=mesh(new THREE.CylinderGeometry(.078,.082,.024,24),mats.metal,'light-fixture-mood-'+id+'-mount');
 base.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
 base.position.set(x+.012*nx,y+.012*ny,z);
 const globe=mesh(new THREE.SphereGeometry(.067,20,12),mats.lamp,'light-fixture-mood-'+id+'-opal');
 globe.position.set(x+.077*nx,y+.077*ny,z);
 globe.castShadow=false;
 iconLocalSconceLight(context,id,x+.16*nx,y+.16*ny,z);
}

function iconEntryPalette(context) {
 if(context.entryPalette)return context.entryPalette;
 const {THREE}=context;
 const paint=(name,color,roughness)=>new THREE.MeshStandardMaterial({name,color,roughness});
 const cloth=iconFinishTexture(THREE,'cinnamon loop pile',160,160,.96,(u,v)=>{
  const yarn=7*Math.cos(2*Math.PI*(43*u+1.3*Math.sin(2*Math.PI*v*27)))*Math.cos(2*Math.PI*35*v);
  const fleck=4*Math.sin((Math.floor(u*160)+1)*(Math.floor(v*160)+3)*9.7);
  return [167+yarn+fleck,109+yarn+fleck,80+yarn+fleck];
 },[3,1]);
 return context.entryPalette={
  mushroom:paint('putty painted MDF','#afa18b',.68),bead:paint('tonal applied moulding','#bdaF9a',.64),
  blue:paint('powder-blue enamel','#adc5d4',.52),ink:paint('black lacquer','#242321',.41),
  cloth,welt:paint('cinnamon upholstery piping','#865a45',.96),
 };
}

function iconEntryWardrobe(context,frame,s,p) {
 const {item,width:w,depth:d,part}=frame,h=item.height,paint=iconEntryPalette(context);
 const leaf=(w-(item.blindCornerWidth||0))/item.doors,front=d-.028,split=2.18;
 part('toe-kick',[.028,.012,w-.028,front-.051],.008,.083,p.shadow);
 part('body',[0,0,w,front-.023],.091,h-.091,paint.mushroom);
 for(let i=0;i<item.doors;i++){
  const a=i*leaf+.003,b=(i+1)*leaf-.003,center=(a+b)/2;
  part('door-'+i,[a,front-.023,b,front],.096,split-.099,paint.mushroom);
  part('upper-front-'+i,[a,front-.023,b,front],split+.003,h-split-.006,paint.mushroom);
  part('upper-lip-'+i,[center-.039,front,center+.039,front+.013],split+.014,.011,p.brass);
  const tab=.032;
  for(const z of [.965,1.28])part('pull-post-'+i+'-'+z,[center-.008,front,center+.008,d-.010],z,.016,p.brass);
  part('handle-'+i,[center-.010,d-.010,center+.010,d],.965-tab,.331+2*tab,p.brass);
  const inset=.047,r=leaf-inset,archBase=1.58;
  const left=i%2===0,cx=left?b:a,outer=left?a+inset:b-inset;
  const profile=[[outer,front+.004,.19],[outer,front+.004,archBase]];
  for(let j=1;j<=18;j++){
   const angle=j*Math.PI/36;
   profile.push([cx+(outer-cx)*Math.cos(angle),front+.004,archBase+r*Math.sin(angle)]);
  }
  const path=new context.THREE.CurvePath();
  for(let j=1;j<profile.length;j++)
   path.add(new context.THREE.LineCurve3(new context.THREE.Vector3(...profile[j-1]),new context.THREE.Vector3(...profile[j])));
  s.add('arched-bead-'+i,new context.THREE.TubeGeometry(path,96,.006,6,false),paint.bead,0,0,0);
  part('lower-bead-'+i,[Math.min(cx,outer),front,Math.max(cx,outer),front+.009],.183,.009,paint.bead);
 }
}

function iconEntryConsole(context,frame,s) {
 const {THREE}=context,{width:w,depth:d,part}=frame,paint=iconEntryPalette(context);
 const top=frame.item.height,bottom=.465,face=d-.046,knob=.045;
 const centers=[w*.243,w*.757],blade=.029;
 for(const [i,x] of centers.entries())
  part('slab-support-'+i,[x-blade/2,.004,x+blade/2,face+.008],.008,top-.008,paint.ink);
 const edges=[[0,centers[0]-blade/2],[centers[0]+blade/2,centers[1]-blade/2],[centers[1]+blade/2,w]];
 for(const [i,[a,b]] of edges.entries()){
  part('case-'+i,[a,0,b,face-.021],bottom,top-bottom,paint.blue);
  const count=i===1?2:1;
  for(let j=0;j<count;j++){
   const lo=a+j*(b-a)/count,hi=a+(j+1)*(b-a)/count;
   part('drawer-'+i+'-'+j,[lo+.0015,face-.021,hi-.0015,face],bottom+.002,top-bottom-.004,paint.blue);
   s.add('hemisphere-'+i+'-'+j,new THREE.SphereGeometry(knob,28,12,0,Math.PI*2,0,Math.PI/2),paint.ink,
    (lo+hi)/2,face,(top+bottom)/2);
  }
 }
}

function iconEntryPouf(context,frame,s,p) {
 const {width:w,depth:d}=frame,x=w/2,y=d/2,paint=iconEntryPalette(context);
 s.disc('recessed-foot',x,y,.008,.173,.173,.046,p.shadow);
 iconUpperCeramic(s,context.THREE,'upholstered-drum',x,y,.050,w/2,d/2,
  [[.02,0],[.89,0],[.95,.008],[.984,.026],[1,.055],[.991,.296],[.977,.319],[.94,.329],[.01,.329]],paint.cloth);
 iconUpperCeramic(s,context.THREE,'padded-seat',x,y,.376,w/2,d/2,
  [[.01,0],[.95,0],[.987,.008],[.994,.023],[.982,.040],[.935,.054],[.80,.063],[0,.069]],paint.cloth);
 const pipe=new context.THREE.TorusGeometry(w*.484,.0034,8,64);
 s.add('seat-welt',pipe,paint.welt,x,y,.382);
}

function iconEntryStar(x,y,straight,diagonal,waist) {
 const sector=Math.PI/8,angle=Math.atan2(Math.abs(y),Math.abs(x))/sector,i=Math.min(3,Math.floor(angle));
 const rays=[straight,waist,diagonal,waist,straight],a=rays[i],b=rays[i+1],f=(angle-i)*sector;
 return Math.hypot(x,y)*(a*Math.sin(f)+b*Math.sin(sector-f))<=a*b*Math.sin(sector);
}

function iconEntryFloor(context) {
 const {THREE,data,group,mesh}=context;
 const ink=[39,37,34],cream=[234,226,209],tile=.335;
 const field=iconFinishTexture(THREE,'graphite and ivory double-star cement tile',256,256,.79,(u,v)=>{
  const x=u-.5,y=v-.5,cornerX=.5-Math.abs(x),cornerY=.5-Math.abs(y);
  const pale=iconEntryStar(x,y,.215,.31,.098)||iconEntryStar(cornerX,cornerY,.5,.36,.146);
  const pigment=1.6*Math.sin(47*u+2*Math.cos(29*v))*Math.cos(41*v-u);
  const joint=Math.min(cornerX,cornerY)<.0026;
  return (joint?[110,106,96]:pale?cream:ink).map(channel=>channel+pigment);
 },[1/tile,1/tile]);
 field.map.offset.set(-7.50/tile+.5,-5.27/tile+.5);
 group.getObjectByName('finish-0.6').material=field;
 const border=iconFinishTexture(THREE,'ivory rosettes between ink pinstripes',128,128,.79,(u,v)=>{
  if(v<.08||v>.92||v>.17&&v<.22||v>.78&&v<.83)return ink;
  if(v<.25||v>.75)return cream;
  return iconEntryStar(u-.5,(v-.5)*1.38,.35,.19,.105)?cream:ink;
 },[1,1]);
 const room=data.rooms.find(r=>r.id==='0.6'),rear=data.furniture.find(f=>f.id==='entry-wardrobe-rear');
 const side=data.furniture.find(f=>f.id==='entry-wardrobe-side'),[left,front,,back]=room.box;
 const wall=room.outline[3][0],outer=[[left,front],[side.box[0],front],[side.box[0],rear.box[1]],
  [wall,rear.box[1]],[wall,back],[left,back]];
 const inner=iconInteriorInsetSlab(outer,outer,.116),vertices=[],uvs=[];
 for(let i=0;i<outer.length;i++){
  const j=(i+1)%outer.length,a=outer[i],b=outer[j],c=inner[j],d=inner[i];
  const count=Math.max(1,Math.round(Math.hypot(a[0]-b[0],a[1]-b[1])/.074));
  for(const [pt,u,v] of [[a,0,0],[b,count,0],[c,count,1],[a,0,0],[c,count,1],[d,0,1]]){
   vertices.push(...pt,.0087);uvs.push(u,v);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
 mesh(geometry,border,'entry-mitred-tile-border').castShadow=false;
}

function iconEntryArtwork(context) {
 const {THREE,box,mesh}=context,cy=7.08,cz=1.344,width=.482,height=.666;
 const canvas=iconFinishTexture(THREE,'abstract vermilion and celadon monotype',192,256,.96,(u,v)=>{
  const weave=Math.sin(u*867)*Math.cos(v*1190);
  const drag=Math.sin(68*v+u*7+Math.cos(31*v))*Math.sin(17*u-.8*Math.sin(83*v));
  const grain=weave*.004+drag*.012+.011*Math.sin(13*u+22*v);
  const shift=v+grain+.033*Math.sin(5*u+10*v)+.014*Math.sin(16*u-v);
  const colors=[[80,128,119],[202,69,39],[199,199,179],[121,148,138],[41,49,45],
   [196,203,181],[118,150,139],[199,67,40],[138,167,149],[54,74,67],[206,62,37]];
  const cutoffs=[.045,.083,.175,.255,.49,.585,.65,.712,.865,.966,2];
  let band=cutoffs.findIndex(edge=>shift<edge);
  if(u<.13+.052*Math.cos(15*v)&&v>.10&&v<.93)band=4;
  if(u>.52&&shift>.75&&shift<.85)band=8;
  const scrape=Math.sin(85*v+Math.sin(5*u+8*v)*1.8)>.958&&Math.cos(u*30+v*67)>.26;
  const tint=scrape?31:5*weave+5*drag;
  return colors[band].map(value=>value+tint);
 });
 box('entry-print-frame',[8.466,cy-width/2-.009,8.487,cy+width/2+.009],cz-height/2-.009,height+.018,iconEntryPalette(context).ink);
 const g=new THREE.PlaneGeometry(width,height);
 g.rotateX(Math.PI/2);g.rotateZ(-Math.PI/2);
 const print=mesh(g,canvas,'entry-framed-monotype');print.position.set(8.4655,cy,cz);print.castShadow=false;
}

function iconMoodVestibule(context,paint) {
 iconEntryArtwork(context);
 const {THREE,group,box,mesh,beam,mats}=context;
 const frame=box('entry-full-mirror-frame',[8.464,5.74,8.489,6.37],.28,1.69,mats.metal);
 frame.userData.furnitureId='entry-wall-mirror';
 const silver=iconFinishTexture(THREE,'silvered vestibule mirror',64,64,.16,(u,v)=>{
  const shade=14*v+4*Math.cos(2.8*u+1.2*v)+3*Math.tanh(18*(u-.47+.13*v));
  return [178+shade,184+shade,182+shade];
 },[1,1]);
 silver.metalness=.23;
 box('entry-full-mirror-glass',[8.458,5.752,8.463,6.358],.292,1.666,silver).userData.furnitureId='entry-wall-mirror';
 const fiber=iconFinishTexture(THREE,'ribbed washable entry mat',128,128,.99,(u,v)=>{
  if(Math.min(u,1-u,v,1-v)<.026)return [65,60,48];
  const rib=5*Math.cos(2*Math.PI*u*31)+2*Math.cos(2*Math.PI*v*28);
  return [106+rib,96+rib,72+rib];
 },[1,1]);
 box('entry-washable-mat',[7.00,4.82,7.84,5.41],.009,.009,fiber);
 const start=group.children.length;
 box('entry-leash-rail',[6.581,6.66,6.612,7.52],1.42,.077,paint);
 for(const y of [6.74,6.98,7.22,7.45]){
  beam('entry-hook-stem-'+y,[6.606,y,1.45],[6.652,y,1.45],.010,mats.metal);
  beam('entry-hook-tip-'+y,[6.652,y,1.45],[6.664,y,1.477],.010,mats.metal);
 }
 const webbing=new THREE.MeshStandardMaterial({color:'#945c42',roughness:.91});
 const path=(id,yz,radius,material,x)=>{
  const curve=new THREE.CatmullRomCurve3(yz.map(([y,z])=>new THREE.Vector3(x,y,z)),true,'centripetal');
  mesh(new THREE.TubeGeometry(curve,42,radius,5,true),material,id);
 };
 path('entry-looped-leash',[[6.742,1.474],[6.77,1.34],[6.81,.98],[6.79,.81],[6.74,.78],[6.72,.95],[6.726,1.29]],.009,webbing,6.653);
 for(const sign of [-1,1]){
  const outline=[[0,1.47],[.014,1.38],[.110,1.25],[.112,1.16],[.055,1.15],[.012,1.23],[0,1.32]];
  path('entry-harness-loop-'+sign,outline.map(([offset,z])=>[6.99+offset*sign,z]),.012,mats.dark,6.653);
 }
 path('entry-key-ring',[[7.221,1.468],[7.239,1.449],[7.22,1.427],[7.202,1.448]],.004,mats.metal,6.651);
 beam('entry-hanging-key',[6.65,7.22,1.434],[6.65,7.207,1.396],.006,mats.metal);
 for(const object of group.children.slice(start))object.userData.furnitureId='entry-hooks';
 iconMoodSconce(context,'entry',8.487,7.05,1.81,-1,0);
}

function iconBathTerrazzo(THREE) {
 const bits=[[247,236,212],[160,130,103],[183,165,145],[121,111,101],[204,182,155]];
 const hash=(i,j,n)=>{const v=Math.sin(i*81.35+j*41.57+n*23.82)*42746.91;return v-Math.floor(v);};
 return iconFinishTexture(THREE,'Limestone and clay terrazzo',384,384,.61,(u,v)=>{
  const cells=38,x=u*cells,y=v*cells,i=Math.floor(x),j=Math.floor(y);
  const dx=x-i-.25-.5*hash(i,j,1),dy=y-j-.25-.5*hash(i,j,2);
  const r=.07+.19*hash(i,j,4),angle=6.28*hash(i,j,3),a=dx*Math.cos(angle)-dy*Math.sin(angle),b=dx*Math.sin(angle)+dy*Math.cos(angle);
  const chip=Math.abs(a)*.75+Math.abs(b)*1.29<r && Math.abs(a-b)<r*1.3;
  const color=chip?bits[Math.floor(hash(i,j,5)*bits.length)]:[212,202,184];
  const grain=(hash(Math.floor(u*384),Math.floor(v*384),7)-.5)*14;
  return color.map(c=>c+grain);
 },[1/.86,1/.86]);
}

function iconBathGlaze(THREE) {
 const w=256,h=256,cols=4,rows=2,colors=[[108,58,43],[96,49,39],[118,65,48],[101,53,42]];
 const relief=new Uint8Array(w*h*4);
 const material=iconFinishTexture(THREE,'Embossed oxblood glazed finger tiles',w,h,.235,(u,v)=>{
  const x=u*cols,y=v*rows,i=Math.floor(x),j=Math.floor(y),dx=x-i-.5,dy=y-j-.5;
  const edge=Math.min((.5-Math.abs(dx))*.071,(.5-Math.abs(dy))*.242);
  const bevel=Math.min(1,Math.max(0,(edge-.0009)/.0027));
  const dotY=(y*4%1)-.5,dot=Math.max(0,1-(dx/.154)**2-(dotY/.158)**2);
  const k=(Math.floor(v*h)*w+Math.floor(u*w))*4;
  const height=Math.round(38+bevel*145+dot*61);
  relief.set([height,height,height,255],k);
  const base=edge<.00095?[135,99,78]:colors[(i+3*j)%4];
  const dotSheen=dot===0?0:7+22*Math.sqrt(dot)*(dotY/.158-dx/.154);
  const tone=3*Math.sin((dx*1.35+dy*.42+i)*5)+dotSheen+8*(1-bevel)*bevel;
  return base.map(c=>c+tone);
 },[1/(cols*.071),1/(rows*.242)]);
 const bump=new THREE.DataTexture(relief,w,h);
 bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.copy(material.map.repeat);
 bump.magFilter=THREE.LinearFilter;bump.minFilter=THREE.LinearMipmapLinearFilter;bump.generateMipmaps=true;bump.needsUpdate=true;
 material.bumpMap=bump;material.bumpScale=.0045;return material;
}

function iconBathSunburst(context,x,y,z) {
 const {THREE,mesh,mats}=context,p=iconLivingPalette(context);
 const part=(name,g,mat,offset)=>{
  const m=mesh(g,mat,'light-fixture-bath-sunburst-'+name);m.position.set(x-offset,y,z);return m;
 };
 const disc=(radius,depth)=>{
  const g=new THREE.CylinderGeometry(radius,radius,depth,64);g.rotateZ(Math.PI/2);return g;
 };
 part('mount',disc(.126,.018),p.brass,.012);
 const g=new THREE.PlaneGeometry(1,1,96,8),pos=g.attributes.position;
 const profile=[[.026,.037],[.045,.071],[.067,.044],[.094,.036],[.117,.047],[.140,.070],[.146,.066],[.145,.054],[.135,.032]];
 for(let j=0;j<profile.length;j++)for(let i=0;i<=96;i++){
  const angle=i*Math.PI/48,[r,depth]=profile[j],rib=(i%2)*.0045*Math.sin(j*Math.PI/8);
  pos.setXYZ(j*97+i,-depth-rib,r*Math.sin(angle),r*Math.cos(angle));
 }
 g.computeVertexNormals();
 const glass=new THREE.MeshStandardMaterial({color:'#c7aa83',roughness:.28,metalness:.33,transparent:true,opacity:.87,flatShading:true,side:THREE.DoubleSide});
 part('pressed-glass',g,glass,0).castShadow=false;
 const rim=new THREE.TorusGeometry(.141,.0028,8,80);
 rim.rotateY(Math.PI/2);part('bezel',rim,p.brass,.054);
 part('socket',disc(.044,.026),p.brass,.068);
 const bulb=part('opal',new THREE.SphereGeometry(.035,24,16),mats.lamp,.087);
 bulb.scale.x=.72;bulb.castShadow=false;
 const warm=iconFinishTexture(THREE,'Pressed-glass sconce caustic',256,256,.99,(u,v)=>{
  const a=Math.atan2(v-.5,u-.5),r=2*Math.hypot(u-.5,v-.5);
  const rays=Math.pow(Math.abs(Math.cos(24*a)),3.8);
  const glow=Math.max(0,1-r)**2*(.21+.79*rays)*Math.min(1,r*7);
  return [255,179,98].map(c=>c*Math.sqrt(glow));
 });
 const halo=mesh(new THREE.PlaneGeometry(.96,.96),new THREE.MeshBasicMaterial({map:warm.map,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.47}),'bath-ground-sunburst-reflection');
 halo.rotation.y=-Math.PI/2;halo.position.set(x-.002,y,z);halo.castShadow=false;
 const lamp=new THREE.PointLight('#ffd3a1',.44,3.2,2);
 lamp.name='sconce-light-ground-bath';lamp.position.set(x-.215,y,z);context.group.add(lamp);
}

function iconGroundBathFinishes(context) {
 const {THREE,group,data,box}=context;
 const [left,south,right,north]=data.rooms.find(r=>r.id==='0.7').box,ceiling=data.levels.groundCeiling;
 const hall=data.walls.find(w=>w.id==='hall-front'),[openLeft,openRight]=hall.doors[0].map(v=>hall.a[0]+v);
 const plaster=iconDoorPaint(context,'groundBath');
 const panel=(id,a,b,z,h,material=plaster)=>iconMoodWallPanel(context,'bath-ground-'+id,a,b,z,h,material);
 const x=left+.002,end=right-.002,y=south+.002,far=north-.002;
 panel('plaster-vanity',[end,y],[x,y],.008,ceiling-.01);
 panel('plaster-shower',[x,y],[x,far],.008,ceiling-.01);
 panel('plaster-wc',[end,far],[end,y],1.226,ceiling-1.228);
 panel('plaster-hall-left',[x,far],[openLeft,far],.008,ceiling-.01);
 panel('plaster-hall-right',[openRight,far],[end,far],.008,ceiling-.01);
 panel('plaster-lintel',[openLeft,far],[openRight,far],2.1,ceiling-2.102);
 box('bath-ground-ceiling',[left,south,right,north],ceiling-.003,.002,new THREE.MeshStandardMaterial({color:'#362c29',roughness:.9}));
 const wc=data.furniture.find(i=>i.id==='ground-wc'),wcFace=right-(wc.box[2]-wc.box[0])*.178;
 box('bath-ground-cistern-wall',[wcFace,south,right,north],.009,1.217,new THREE.MeshStandardMaterial({color:'#713d2d',roughness:.57}));
 panel('wc-relief-glaze',[wcFace-.0006,far],[wcFace-.0006,y],.009,1.214,iconBathGlaze(THREE));
 const stone=iconBathTerrazzo(THREE);
 group.getObjectByName('finish-0.7').material=stone;
 const shower=group.getObjectByName('ground-shower-tile-backing');
 shower.material=new THREE.MeshStandardMaterial({color:'#9e5d44',roughness:.45});
 iconBathSunburst(context,end,(wc.box[1]+wc.box[3])/2,1.86);
}

function iconUpperBathPalette(context) {
 if(context.upperBathPalette)return context.upperBathPalette;
 const {THREE}=context;
 const plain=(name,color,roughness,metalness=0)=>new THREE.MeshStandardMaterial({name,color,roughness,metalness});
 const glaze=(name,tones,grout,w,h)=>{
  const finish=iconFinishTexture(THREE,name,256,256,.23,(u,v)=>{
   const x=u*4,y=v*4,i=Math.floor(x),j=Math.floor(y),dx=x-i,dy=y-j;
   const edge=Math.min(dx*w,(1-dx)*w,dy*h,(1-dy)*h);
   if(edge<.0012)return grout;
   const shade=3.1*Math.cos(10*dx+2.3*j)*Math.sin(6*dy+i)+7*Math.exp(-((edge-.003)**2)/.000005);
   return tones[(i+2*j+(j%2)*i)%tones.length].map(c=>c+shade);
  },[1/(4*w),1/(4*h)]);
  return finish;
 };
 const silver=iconFinishTexture(THREE,'Silvered mirror',128,256,.15,(u,v)=>{
  const tint=13*v+5*Math.cos(2.1*u+2*v)+5*Math.tanh((u-.58+.16*v)*13);
  return [172+tint,183+tint,180+tint];
 });silver.metalness=.24;
 const spray=iconFinishTexture(THREE,'Perforated nickel spray plate',96,96,.34,(u,v)=>
  Math.hypot(u*13%1-.5,v*13%1-.5)<.15?[55,57,54]:[169,166,149]);
 return context.upperBathPalette={
  petrol:glaze('Petrol glazed square tile',[[43,88,91],[50,96,98],[55,100,101],[39,83,87]],[114,137,132],.142,.142),
  olive:glaze('Olive glazed stick mosaic',[[95,103,49],[118,119,65],[106,114,58],[86,99,54]],[112,112,78],.065,.215),
  cream:plain('Ivory solid surface','#dbd1b8',.46),honey:plain('Ochre lacquer','#bf843d',.43),
  moss:plain('Dark olive lacquer','#404939',.46),nickel:plain('Brushed nickel','#babdb8',.32,.56),
  brass:plain('Satin champagne metal','#b79c69',.35,.5),amber:plain('Amber glass','#714527',.22,.12),
  familyWall:plain('Warm oyster paint','#c8bca9',.89),privateWall:plain('Dusty almond paint','#b59e87',.90),
  piping:plain('Ivory ceramic pencil trim','#e3d7b9',.32),silver,spray
 };
}

function iconFamilyBathFloor(THREE) {
 return iconFinishTexture(THREE,'Ochre and petrol compass-star porcelain',256,256,.60,(u,v)=>{
  const x=u-.5,y=v-.5,ax=Math.abs(x),ay=Math.abs(y),angle=Math.atan2(y,x)+Math.PI/8;
  const segment=Math.floor(angle/(Math.PI/4)),ray=angle-segment*Math.PI/4-Math.PI/8;
  const peak=segment%2===0?.411:.282;
  const r=.075*peak*Math.sin(Math.PI/8)/(peak*Math.sin(Math.abs(ray))+.075*Math.sin(Math.PI/8-Math.abs(ray)));
  const shade=1.6*Math.sin(209*u)*Math.cos(157*v);
  const tone=Math.max(ax,ay)>.493?[162,151,130]:ax+ay>.841?[156,135,91]:
   Math.hypot(x,y)<r?(ray>0?[53,86,87]:[113,134,125]):[223,211,184];
  return tone.map(c=>c+shade);
 },[1/.293,1/.293]);
}

function iconPrivateBathFloor(THREE) {
 return iconFinishTexture(THREE,'Honed shell-limestone porcelain',256,256,.68,(u,v)=>{
  const offset=Math.floor(v*2)%2*.5,edge=Math.min((u+offset)%1,1-(u+offset)%1,(v*2)%1,1-(v*2)%1);
  if(edge<.0025)return [167,155,135];
  const xi=Math.floor(u*116),yi=Math.floor(v*73),cell=Math.sin(xi*63.97+yi*35.60)*41031;
  const fossil=cell-Math.floor(cell)>.92 && (u*116%1+v*73%1*.7)<.83;
  const cloud=4*Math.sin(16*u+5*Math.cos(9*v))*Math.cos(15*v+u*4)+2*Math.cos(44*v+2*Math.sin(15*u));
  const shade=cloud+(fossil?-22:0);
  return [201,187,162].map(c=>c+shade);
 },[1/.80,1/.80]);
}

function iconUpperBathWall({THREE,mesh,ceilingAt},id,a,b,bottom,top,material) {
 const vertices=[],uvs=[],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 const at=t=>a.map((v,i)=>v+(b[i]-v)*t);
 const roof=t=>ceilingAt(...at(t))-.007;
 const times=[0,1],ridge=(4.25-a[0])/(b[0]-a[0]);
 if(ridge>0&&ridge<1)times.splice(1,0,ridge);
 const breaks=[...times];
 for(let i=1;i<times.length;i++){
  const lo=times[i-1],hi=times[i],z0=roof(lo),z1=roof(hi);
  for(const z of [bottom,top])if(z>Math.min(z0,z1)&&z<Math.max(z0,z1))breaks.push(lo+(hi-lo)*(z-z0)/(z1-z0));
 }
 breaks.sort((x,y)=>x-y);
 for(let i=1;i<breaks.length;i++){
  const lo=breaks[i-1],hi=breaks[i],zl=Math.min(top,roof(lo)),zh=Math.min(top,roof(hi));
  if(Math.max(zl,zh)<=bottom+.0001)continue;
  for(const [t,z] of [[lo,bottom],[hi,bottom],[hi,zh],[lo,bottom],[hi,zh],[lo,zl]]){
   vertices.push(...at(t),z);uvs.push(t*length,z-bottom);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();
 mesh(g,material,id).castShadow=false;
}

function iconUpperBathLamp(context,id,x,y,z,family) {
 const {THREE,mesh,beam,mats}=context,p=iconUpperBathPalette(context),prefix='light-fixture-mood-'+id+'-';
 const origin=[x,y,z],position=(u,v,h)=>family?[x+u,y+v,z+h]:[x-v,y+u,z+h];
 const metal=family?p.nickel:p.brass;
 const mount=mesh(new THREE.CylinderGeometry(.072,.072,.02,32),metal,prefix+'mount');
 mount.position.set(...position(0,.012,0));if(!family)mount.rotation.z=Math.PI/2;
 beam(prefix+'bracket',origin,position(0,.082,0),.018,metal);
 if(family){
  const geometry=new THREE.CapsuleGeometry(.027,.415,6,24);geometry.rotateZ(Math.PI/2);
  const tube=mesh(geometry,mats.lamp,prefix+'opal');tube.position.set(...position(0,.089,0));tube.castShadow=false;
  for(const side of [-1,1])beam(prefix+'end-'+side,position(side*.209,.089,0),position(side*.236,.089,0),.03,metal);
 }else{
  beam(prefix+'spindle',position(0,.084,-.103),position(0,.084,.103),.026,metal);
  for(const side of [-1,1]){
   const globe=mesh(new THREE.SphereGeometry(.055,24,16),mats.lamp,prefix+(side===1?'opal':'lower-opal'));
   globe.scale.z=1.12;globe.position.set(...position(0,.084,side*.119));globe.castShadow=false;
  }
 }
 iconLocalSconceLight(context,id,...position(0,.161,0),family ? .43 : .31);
}

function iconUpperBathFinishes(context) {
 const {THREE,group,box,beam,mesh}=context,p=iconUpperBathPalette(context),floor=3.223;
 group.getObjectByName('finish-1.2').material=iconFamilyBathFloor(THREE);
 group.getObjectByName('finish-1.6').material=iconPrivateBathFloor(THREE);
 const tile=(id,a,b,top,mat)=>iconUpperBathWall(context,id,a,b,floor,top,mat);
 const family=(id,a,b,top)=>{
  tile('bath-family-'+id,a,b,top,p.petrol);
  iconUpperBathWall(context,'bath-family-paint-'+id,a,b,top,Infinity,p.familyWall);
  beam('bath-family-ivory-pencil-'+id,[...a,top],[...b,top],.009,p.piping);
 };
 family('tub-side',[.502,5.638],[4.768,5.638],4.30);
 family('basin-side',[3.87,3.742],[.502,3.742],4.30);
 family('shower',[4.768,3.742],[3.87,3.742],5.29);
 tile('bath-family-shower-return',[4.768,4.638],[4.768,3.742],5.29,p.petrol);
 box('bath-family-tub-ledge',[.186,3.745,.498,5.635],3.223,.625,p.cream);
 box('bath-family-tub-shelf',[.185,3.745,.51,5.635],3.848,.025,p.piping);
 context.obstacle('bath-family-tub-ledge',[.185,3.745,.51,5.635],floor,3.873);
 const vessel=(id,x,y,z,r,h,finish)=>{
  const profile=[[.8,0],[1,.05],[1,.66],[.94,.77],[.56,.88],[.56,1],[.42,1],[.42,.88]];
  const g=new THREE.LatheGeometry(profile.map(([radius,height])=>new THREE.Vector2(r*radius,h*height)),28);
  g.rotateX(Math.PI/2);mesh(g,finish,id).position.set(x,y,z);
 };
 vessel('bath-family-ochre-jar',.435,4.10,3.873,.067,.16,p.honey);
 vessel('bath-family-pale-bud-vase',.435,4.25,3.873,.050,.21,p.piping);
 iconUpperBathLamp(context,'family-basin',3.35,3.743,5.262,true);
 const privateWall=(id,a,b,top,mat=p.olive)=>{
  tile('bath-private-'+id,a,b,top,mat);
  iconUpperBathWall(context,'bath-private-paint-'+id,a,b,top,Infinity,p.privateWall);
 };
 privateWall('double-vanity',[11.548,7.887],[11.548,5.115],5.34);
 privateWall('shower',[8.912,5.226],[8.912,6.50],5.21);
 for(const side of [-1,1]){
  const y=5.4+.51+side*.15*.64;
  beam('bath-private-mixer-feed-'+side,[8.912,y,4.24],[8.95,y,4.24],.015,p.brass);
 }
 privateWall('towel-wall',[8.912,6.50],[8.912,7.887],4.31);
 privateWall('door-left',[8.912,7.888],[9.997,7.888],4.31);
 privateWall('door-right',[10.902,7.888],[11.548,7.888],4.31);
 const capZ=4.176;
 box('bath-private-service-ledge',[8.913,4.82,11.545,5.132],floor,capZ-floor,p.moss);
 tile('bath-private-service-glaze',[11.545,5.133],[8.913,5.133],capZ,p.olive);
 box('bath-private-ledge-cap',[8.913,4.82,11.545,5.143],capZ,.024,p.cream);
 context.obstacle('bath-private-service-ledge',[8.913,4.82,11.545,5.143],floor,capZ+.024);
 vessel('bath-private-oil-flask',10.90,5.018,capZ+.024,.041,.176,p.amber);
 vessel('bath-private-bath-salts',11.035,5.001,capZ+.024,.065,.122,p.cream);
 for(const y of [6.704,7.29])beam('bath-private-rail-bracket-'+y,[8.913,y,4.36],[8.986,y,4.36],.012,p.brass);
 beam('bath-private-towel-bar',[8.986,6.687,4.36],[8.986,7.305,4.36],.010,p.brass);
 const towel=iconFinishTexture(THREE,'Ivory ribbed linen with olive selvedges',128,128,.94,(u,v)=>{
  const stripe=v<.03||v>.97||v>.115&&v<.133;
  const rib=4*Math.sin(u*67*Math.PI*2);
  return (stripe?[104,112,74]:[212,202,182]).map(c=>c+rib);
 });
 box('bath-private-hand-towel',[8.98,6.79,9.006,7.206],3.864,.508,towel);
 iconUpperBathLamp(context,'private-basins',11.547,6.976,4.82,false);
}

function iconMoodEntryBathFinishes(context) {
 const {THREE}=context;
 iconEntryFloor(context);
 const paint=new THREE.MeshStandardMaterial({color:'#b7aa8e',roughness:.73});
 iconMoodVestibule(context,paint);
 iconGroundBathFinishes(context);
 iconUpperBathFinishes(context);
}

function iconLoftElectrical({THREE,data,group,mesh}) {
 const {frameDiameterM,points}=data.electrical;
 const forms=iconLoftFixtureForms(THREE);
 const glaze={};
 for(const [finish,color] of Object.entries({red:'#bd1118',blue:'#1644ad',white:'#eeeae2',black:'#242424'})){
  glaze[finish]=new THREE.MeshStandardMaterial({name:'JLM Loft '+finish+' gloss',color,roughness:.21,metalness:.06});
 }
 const materials={
  shadow:new THREE.MeshStandardMaterial({name:'Loft contact recess',color:'#171615',roughness:.84}),
  steel:new THREE.MeshStandardMaterial({name:'Loft nickel contact',color:'#b8b7af',metalness:.77,roughness:.25})
 };
 const up=new THREE.Vector3(0,0,1),size=frameDiameterM/81;
 for(const [i,point] of points.entries()){
  const {room,type,finish,support,normal,alongM,heightM}=point;
  const anchor=group.getObjectByName(support);
  const cabinet=['kitchen-tall','kitchen-back'].find(id=>support.startsWith(id+'-'));
  if(!anchor&&cabinet&&!data.furniture.some(item=>item.id===cabinet))continue;
  if(!anchor?.isMesh)throw new Error('Missing support for Loft fixture '+i+': '+support);
  anchor.updateMatrix();
  if(!anchor.geometry.boundingBox)anchor.geometry.computeBoundingBox();
  const bounds=anchor.geometry.boundingBox.clone().applyMatrix4(anchor.matrix);
  const axis=normal.endsWith('x')?'x':'y',sign=normal.startsWith('+')?1:-1;
  const face=(sign>0?bounds.max:bounds.min)[axis]+sign*.0005;
  const z=(room.startsWith('1.')?data.levels.upper:data.levels.ground)+heightM;
  const outward=new THREE.Vector3(axis==='x'?sign:0,axis==='y'?sign:0,0);
  const across=new THREE.Vector3().crossVectors(up,outward);
  const orientation=new THREE.Matrix4().makeBasis(across,up,outward);
  const id='loft-fixture-'+i;
  for(const {name,geometry,material} of forms[type]){
   const part=mesh(geometry,materials[material]??glaze[finish],id+'-'+name);
   part.position.set(axis==='x'?face:alongM,axis==='y'?face:alongM,z);
   part.quaternion.setFromRotationMatrix(orientation);
   part.scale.setScalar(size);
   part.castShadow=false;
   part.userData={furnitureId:id,room,finish,type,support};
  }
 }
}

function iconLoftFixtureForms(THREE) {
 const part=(name,geometry,material)=>({name,geometry,material});
 const turned=(profile,segments=20)=>{
  const vertices=profile.map(([radius,depth])=>new THREE.Vector2(radius,depth));
  const geometry=new THREE.LatheGeometry(vertices,segments);
  geometry.rotateX(Math.PI/2);return geometry;
 };
 const ring=(name,profile,material)=>part(name,turned(profile),material);
 const disc=(r,z,segments=20)=>new THREE.CircleGeometry(r,segments).translate(0,0,z);
 const box=(w,h,d,x,y,z)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
 const rounded=(w,h,r)=>{
  const x=w/2,y=h/2,s=new THREE.Shape();
  s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);
  s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);
  s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
  return s;
 };
 const circle=(r,x=0,y=0)=>{const path=new THREE.Path();path.absarc(x,y,r,0,Math.PI*2,true);return path;};
 const plate=(r,depth,holes)=>{
  const shape=new THREE.Shape();shape.absarc(0,0,r,0,Math.PI*2,false);shape.holes=holes;
  return new THREE.ShapeGeometry(shape,10).translate(0,0,depth);
 };
 const frame=ring('frame',[[26.5,0],[39.1,0],[40.3,.7],[40.5,2.2],[40.1,4.1],
  [38.9,6.4],[37.0,8.15],[34.4,9.25],[30.5,9.45],[28.5,8.85],[27.9,7.85],[27.45,6.05],[26.5,5.9]]);
 const seat=ring('insert-joint',[[22.1,5.75],[27.63,5.75],[27.75,6.8],[27.60,7.53],
  [26.5,7.75],[25.8,7.42],[22.1,7.0]],'shadow');
 const paddle=new THREE.ExtrudeGeometry(rounded(6.4,15.3,1.15),{
  depth:2,bevelEnabled:true,bevelThickness:1,bevelSize:.9,bevelSegments:2,curveSegments:3
 });
 paddle.rotateX(-.22);paddle.translate(0,0,11.1);
 const switches=[frame,seat,
  ring('switch-bead',[[20.1,6],[26.7,6],[26.95,7.9],[26.45,9.1],[25.5,9.64],
   [24.1,9.65],[22.8,9.02],[22.55,8.43],[22.1,8.39],[21.45,8.76],[20.1,8.7]]),
  part('rocker-face',plate(22.13,8.70,[rounded(9.4,20.2,.72)])),
  part('rocker-slot',box(9.8,20.7,1.4,0,0,7.8),'shadow'),part('rocker',paddle)];
 const socketRim=ring('socket-well',[[17.9,2.5],[26.65,5.92],[27.10,7.44],[26.97,9.6],
  [26.04,11.2],[24.6,12.0],[21.7,12.3],[20.2,11.95],[19.38,11.0],
  [18.94,8.15],[18.68,4.15],[18.14,3.31],[17.9,3.12]]);
 const sockets=[frame,seat,socketRim,
  part('socket-face',plate(18.14,3.15,[circle(2.76,-9.5,0),circle(2.76,9.5,0)])),
  part('contact-shadow',disc(17,.7),'shadow')];
 for(const x of [-9.5,9.5]){
  const sleeve=turned([[2.73,3.14],[2.50,2.7],[2.33,.75]],10).translate(x,0,0);
  sockets.push(part(x<0?'contact-left':'contact-right',sleeve,'shadow'));
 }
 sockets.push(part('earth-pin',turned([[0,3.15],[2.38,3.15],[2.38,13.6],[2.11,14.6],[1.55,15.2],[0,15.45]],12).translate(0,9.9,0),'steel'),
  part('retaining-screw',turned([[0,3.15],[2.55,3.15],[2.38,3.83],[1.77,4.12],[0,4.12]],12),'steel'),
  part('screw-slot',box(2.90,.51,.12,0,0,4.13),'shadow'));
 const cover=ring('protective-lid',[[0,11.4],[21.2,11.4],[23.4,12.15],[24.2,13.35],[23.85,14.7],
  [22.7,15.75],[19.8,16.65],[14.1,17.24],[7.4,17.55],[0,17.68]]);
 const covered=[frame,seat,socketRim,cover,
  part('lid-gasket',turned([[20,10.4],[23.96,10.4],[24.09,11.5],[23.84,12.12],[20,12.12]]),'shadow')];
 for(const [i,[x,length]] of [[-6.3,5.2],[0,6.4],[6.3,5.2]].entries()){
  const barrel=new THREE.CylinderGeometry(2.32,2.32,length,10);
  barrel.rotateZ(Math.PI/2);barrel.translate(x,22.45,13.3);
  covered.push(part('lid-hinge-'+i,barrel));
 }
 const tab=new THREE.ExtrudeGeometry(rounded(12,4.75,1.35),{
  depth:1.8,bevelEnabled:true,bevelThickness:.65,bevelSize:.55,bevelSegments:2,curveSegments:3
 });
 tab.translate(0,-23.15,12.7);covered.push(part('lid-grip',tab));
 return {switch:switches,socket:sockets,covered};
}
