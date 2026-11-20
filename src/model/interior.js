export function addIconInterior(options) {
 const context = iconInteriorSetup(options);
 iconInteriorFloorsAndPartitions(context);
 iconInteriorFacades(context);
 iconBasaltApron(context,options.exteriorPaving);
 iconGardenPierPlinth(context);
 iconInteriorCurtains(context);
 iconInteriorStairs(context);
 iconInteriorOfficeBacking(context);
 iconInteriorFurnishings(context);
 const robotCabinet=iconKitchenRobotControl(context);
 iconPlantOutdoorUnit(context);
 iconRecliningAdult(context);
 options.fitGarage?.(context);
 const projector=iconLivingProjector(context);
 const appliances=iconApplianceControls(context);
 const officeWindow=iconOfficeWindowControl(context);
 iconLivingWallSconce(context);
 iconLivingMediaAccessories(context);
 iconInteriorLightingAndRoof(context);
 iconMoodEntryBathFinishes(context);
 iconFramedArt(context);
 if(context.data.electrical)iconLoftElectrical(context);
 options.joinStory?.(options.THREE,context.group);
 const exteriorLights=iconExteriorLighting(context);
 const updateHallDoors=iconHallDoorMotion(context);
 const {group,navigation,data,world} = context;
 return {group,navigation,rooms:data.rooms,metadata:data.metadata,localToWorld:world,updateHallDoors,projector,appliances,officeWindow,exteriorLights,robotCabinet};
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
 mats.indigoSteel=material('#414a89',{name:'Indigo powder-coated steel',roughness:.53,metalness:.32});
 mats.hall=material('#c77d59',{name:'Hall smooth terracotta paint',roughness:.92});
 mats.pantry=material('#e7d4a8',{name:'Pantry pale straw mineral paint',roughness:.92});
 mats.garage=material('#abb8a6',{name:'Garage sage mineral paint',roughness:.92});
 mats.garageCeiling=material('#d3dbcd',{name:'Garage pale sage ceiling',roughness:.92});
 for(const [id,name,color] of [
  ['vestibule','Vestibule pale lichen paint','#d7dbcb'],['playroom','Playroom meadow sage','#b7ccaf'],
  ['office','Office mist blue','#aec4cd'],['playroomCeiling','Playroom pale sage','#dee7d9'],
  ['officeCeiling','Office pale mist','#dee6e9']
 ])mats[id]=material(color,{name,roughness:.92});
 for(const paint of [mats.wall,mats.ceiling,mats.white,mats.hall,mats.vestibule,mats.pantry,mats.garage,
  mats.garageCeiling,mats.playroom,mats.office,mats.playroomCeiling,mats.officeCeiling])paint.userData.surfaceProfile='smoothPaint';
 mats.plinth=iconPlinthPorcelain(THREE,mats.dark.color);
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
  const finishes=external?[mats.wall,mats.dark]:hallFace?[mats.wall,mats.hall]:[mats.wall];
  if(paintedFrom!==undefined){
   mats.projectionPaint??=material('#ffffff',{roughness:1,name:'Matte white projection paint'});
   finishes.push(mats.projectionPaint);
  }
  const paintZones=iconGroundWallPaint(data,id,L).map(([side,from,to,room])=>{
   let index=finishes.indexOf(mats[room]);
   if(index===-1)index=finishes.push(mats[room])-1;
   return {side,from,to,index,returns:['vestibule','playroom','office'].includes(room)};
  });
  const plinth=external&&z0===0?finishes.push(mats.plinth)-1:undefined;
  const geometry=iconInteriorWallGeometry(THREE,{plinth,a,ux,uy,L,z0,z1,thickness,outer,holes,ceilingAt,sloped:id.startsWith('u-'),external,nx,ny,corners,paintedFrom,hallFace,paintZones,flushDoors:openings.filter(o=>o.flush&&hallFace&&o.start>=hallFace.from&&o.end<=hallFace.to)});
  const wallMesh=mesh(geometry,finishes.length===1?finishes[0]:finishes,id);
  if(hallFace)wallMesh.userData.kind='hall-partition';
  const cuts=[0,L,...openings.flatMap(o=>[o.start,o.end])].sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){const start=cuts[i-1],end=cuts[i];if(end-start<.001)continue;const opening=openings.find(o=>(start+end)/2>o.start&&(start+end)/2<o.end);const ax=a[0]+ux*start,ay=a[1]+uy*start,bx=a[0]+ux*end,by=a[1]+uy*end,bounds=[Math.min(ax,bx)-Math.abs(uy)*thickness/2,Math.min(ay,by)-Math.abs(ux)*thickness/2,Math.max(ax,bx)+Math.abs(uy)*thickness/2,Math.max(ay,by)+Math.abs(ux)*thickness/2];
   if(!opening)obstacle(id+'-'+i,bounds,z0,z1);else{if(opening.bottom>z0+.01)obstacle(id+'-sill-'+i,bounds,z0,opening.bottom);if(opening.top<z1-.01)obstacle(id+'-header-'+i,bounds,opening.top,z1);}
  }
  for(const [i,o] of openings.entries()){
   const points=o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]],recess=o.recess||0,to3=p=>[a[0]+ux*p[0]-nx*recess,a[1]+uy*p[0]-ny*recess,p[1]];
   if(recess>thickness/2)iconInteriorWindowReveal({THREE,mesh,mats,id:id+'-reveal-'+i,points:o.wallPoly||points,to3,normal:[nx,ny],depth:recess-thickness/2});
   if(o.casement)continue;
   if(!o.flush)for(let j=0;j<points.length;j++)beam(id+'-opening-'+i+'-frame-'+j,to3(points[j]),to3(points[(j+1)%points.length]),.025,mats.dark);
   if(o.glass){
    const panes=o.panels??1;
    for(let pane=0;pane<panes;pane++){
     const left=o.start+(o.end-o.start)*pane/panes,right=o.start+(o.end-o.start)*(pane+1)/panes;
     if(pane>0)beam(id+'-mullion-'+i+'-'+pane,to3([left,o.bottom]),to3([left,o.top]),.025,mats.dark);
     if(pane===o.slidingPanel)continue;
     const outline=panes===1?points:[[left,o.bottom],[right,o.bottom],[right,o.top],[left,o.top]];
     const glass=iconGlassGeometry(THREE,outline,to3);
     mesh(glass,mats.glass,id+'-glass-'+i+(panes===1?'':'-pane-'+pane)).castShadow=false;
     const [x0,y0]=to3([left,0]),[x1,y1]=to3([right,0]);
     obstacle(id+'-glass-barrier-'+i+(panes===1?'':'-pane-'+pane),
      [Math.min(x0,x1)-.035,Math.min(y0,y1)-.035,Math.max(x0,x1)+.035,Math.max(y0,y1)+.035],o.bottom,o.top);
    }
    const dividers=o.dividers??(panes===1&&o.end-o.start>2?[(o.start+o.end)/2]:[]);
    for(const u of dividers){
     const height=iconGlassHeadAt(points,u);
     const name=o.dividers?'garden-upper-triangle-mullion-'+u:id+'-mullion-'+i;
     beam(name,to3([u,o.bottom]),to3([u,height]),.025,mats.dark);
    }
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

function iconGroundWallPaint(data,id,length) {
 const back=data.walls.find(w=>w.id==='garage-back');
 const divider=data.walls.find(w=>w.id==='pantry-technical');
 const kitchen=data.walls.find(w=>w.id==='kitchen-back');
 const pantryEnd=divider.a[0]-back.a[0],garageEnd=back.a[1];
 const playWall=data.walls.find(w=>w.id==='guest-inner'),officeWall=data.walls.find(w=>w.id==='guest-office');
 const vestibuleScreen=data.walls.find(w=>w.id==='vestibule-screen'),bath=data.walls.find(w=>w.id==='vestibule-bath-top');
 const front=data.facades.find(f=>f.id==='facade-front-wing'),rear=data.facades.find(f=>f.id==='facade-wing-rear');
 const garageStart=data.walls.find(w=>w.id==='garage-hall').a[1];
 switch(id){
  case 'facade-front-wing':return [[1,0,playWall.a[0]-front.a[0],'vestibule'],[1,playWall.a[0]-front.a[0],length,'playroom']];
  case 'facade-wing-end':return [[1,0,officeWall.a[1]-front.a[1],'playroom'],[1,officeWall.a[1]-front.a[1],length,'office']];
  case 'facade-wing-rear':return [[-1,data.stairs.box[2]-rear.a[0],length,'office']];
  case 'vestibule-bath-top':return [[-1,0,length,'vestibule']];
  case 'bath-left':return [[1,0,length,'vestibule'],[-1,0,bath.a[1]-data.walls.find(w=>w.id===id).a[1],'vestibule']];
  case 'guest-inner':return [[-1,0,length,'playroom'],[1,0,bath.a[1]-playWall.a[1],'vestibule']];
  case 'guest-office':return [[1,0,length,'office'],[-1,playWall.a[0]-officeWall.a[0],length,'playroom']];
  case 'facade-garage':case 'facade-garage-side':return [[1,0,length,'garage']];
  case 'facade-main-side':return [[-1,0,garageEnd,'garage'],[-1,garageEnd,kitchen.a[1],'pantry']];
  case 'garage-hall':return [[1,0,garageEnd-garageStart,'garage'],[-1,0,vestibuleScreen.a[1]-garageStart,'vestibule']];
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
 function reveal(u,face,base,flush=false){
  if(u===L&&hallFace?.paintEnd){quad(...face(-thickness/2,thickness/2),1);return;}
  const zones=paintZones.filter(zone=>zone.returns&&u>=zone.from&&u<=zone.to);
  if(!zones.length){quad(...face(-thickness/2,thickness/2),flush?1:base);return;}
  for(const side of [-1,1]){
   const finish=zones.find(zone=>zone.side===side)?.index??(flush&&side===hallFace?.side?1:base);
   quad(...face(Math.min(0,side*thickness/2),Math.max(0,side*thickness/2)),finish);
  }
 }
 for(let i=1;i<xs.length;i++){
  const start=xs[i-1],end=xs[i];if(end-start<1e-8)continue;const mid=(start+end)/2,lo=bands(start,mid),hi=bands(end,mid);
  const interiorMaterial=mid>=paintedFrom?2:0;
  for(let j=0;j<lo.length;j++){
   for(const d of [-thickness/2,thickness/2]){
    const side=Math.sign(d),outside=external&&(-uy*d*nx+ux*d*ny)>0;
    const hallPaint=hallFace&&side===hallFace.side&&mid>=hallFace.from&&mid<=hallFace.to;
    const zone=paintZones.find(p=>p.side===side&&mid>=p.from&&mid<=p.to);
    const finish=outside||hallPaint?1:zone?.index??interiorMaterial;
    let bottomLeft=lo[j][0],bottomRight=hi[j][0];
    if(outside&&options.plinth!==undefined&&bottomLeft<.30&&bottomRight<.30){
     const topLeft=Math.min(.30,lo[j][1]),topRight=Math.min(.30,hi[j][1]);
     quad(point(start,d,bottomLeft),point(end,d,bottomRight),point(end,d,topRight),point(start,d,topLeft),options.plinth);
     bottomLeft=topLeft;bottomRight=topRight;
    }
    if(bottomLeft<lo[j][1]||bottomRight<hi[j][1])
     quad(point(start,d,height(start,d,bottomLeft)),point(end,d,height(end,d,bottomRight)),point(end,d,height(end,d,hi[j][1])),point(start,d,height(start,d,lo[j][1])),finish);
   }
   for(const edge of [0,1]){const h0=lo[j][edge],h1=hi[j][edge];if(sloped&&edge===1&&h0===z1&&h1===z1)continue;reveal(mid,(d0,d1)=>[point(start,d0,height(start,d0,h0)),point(end,d0,height(end,d0,h1)),point(end,d1,height(end,d1,h1)),point(start,d1,height(start,d1,h0))],interiorMaterial,flushDoors.some(o=>mid>=o.start&&mid<=o.end&&h0===o.top));}
  }
 }
 for(let i=0;i<xs.length;i++){
  if(i===0&&corners[0]||i===xs.length-1&&corners[1])continue;
  const u=xs[i],left=i?bands(u,(xs[i-1]+u)/2):[],right=i<xs.length-1?bands(u,(u+xs[i+1])/2):[],heights=[...new Set([...left.flat(),...right.flat()])].sort((x,y)=>x-y);
  for(let j=1;j<heights.length;j++){const bottom=heights[j-1],top=heights[j],mid=(bottom+top)/2,solid=band=>band.some(([lo,hi])=>mid>lo&&mid<hi);if(solid(left)===solid(right))continue;reveal(u,(d0,d1)=>[point(u,d0,height(u,d0,bottom)),point(u,d1,height(u,d1,bottom)),point(u,d1,height(u,d1,top)),point(u,d0,height(u,d0,top))],0,flushDoors.some(o=>(u===o.start||u===o.end)&&mid<=o.top));}
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
 const cabinetWall=data.walls.find(w=>w.id==='kitchen-back');
 const kitchenStart=cabinetWall.a[1]+cabinetWall.thickness/2,cornerEnd=cabinetWall.b[0];
 const screenY=screen.a[1]+screen.thickness/2,hallY=hall.a[1]+hall.thickness/2;
 const cornerX=screen.b[0],westX=garage.a[0]+garage.thickness/2,officeY=office.a[1]-office.thickness/2;
 const ceilingPlan=[[westX,screenY],[cornerX,screenY],[cornerX,hallY],[east,hallY],
  [east,officeY],[data.stairs.box[2],officeY],[data.stairs.box[2],north],
  [west,north],[west,kitchenStart],[cornerEnd,kitchenStart],[cornerEnd,garage.b[1]],[westX,garage.b[1]]];
 meshPaintedCeiling(context,'hall-painted-ceiling',ceilingPlan,mats.hall);
 const kitchenWest=cabinetWall.a[0],voidStart=data.void.box[1],stairEdge=data.stairs.box[0];
 meshPaintedCeiling(context,'kitchen-painted-ceiling',[[kitchenWest,kitchenStart],[west,kitchenStart],[west,north],
  [stairEdge,north],[stairEdge,voidStart],[kitchenWest,voidStart]],mats.hall);
 const perimeterX=iconGroundFacadeDepth(data.facades.find(f=>f.id==='facade-main-side'));
 const garageSide=data.facades.find(f=>f.id==='facade-garage-side');
 const garageEast=garageSide.a[0]-iconGroundFacadeDepth(garageSide),jambEnd=garage.a[1];
 const dividerX=garage.a[0]-garage.thickness/2;
 const garageRoom=data.rooms.find(r=>r.id==='0.1'),pantry=data.rooms.find(r=>r.id==='0.2');
 const garageFront=iconGroundFacadeDepth(data.facades.find(f=>f.id==='facade-garage'));
 meshPaintedCeiling(context,'garage-painted-ceiling',[[perimeterX,garageFront],[garageEast,garageFront],
  [garageEast,jambEnd],[dividerX,jambEnd],[dividerX,garageRoom.box[3]],[perimeterX,garageRoom.box[3]]],mats.garageCeiling);
 meshPaintedCeiling(context,'pantry-painted-ceiling',ring([perimeterX,pantry.box[1],pantry.box[2],pantry.box[3]]),mats.pantry);

 iconFrontRoomCeilings(context);
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

function iconFrontRoomCeilings(context) {
 const {data,ring,mats}=context;
 const front=data.facades.find(f=>f.id==='facade-front-wing'),side=data.facades.find(f=>f.id==='facade-wing-end');
 const rear=data.facades.find(f=>f.id==='facade-wing-rear'),garage=data.walls.find(w=>w.id==='garage-hall');
 const screen=data.walls.find(w=>w.id==='vestibule-screen'),bath=data.walls.find(w=>w.id==='vestibule-bath-top');
 const play=data.walls.find(w=>w.id==='guest-inner'),office=data.walls.find(w=>w.id==='guest-office');
 const south=front.a[1]+iconGroundFacadeDepth(front),east=side.a[0]-iconGroundFacadeDepth(side);
 const west=garage.a[0]+garage.thickness/2,bathSouth=bath.a[1]-bath.thickness/2;
 const screenSouth=screen.a[1]-screen.thickness/2,playWest=play.a[0]-play.thickness/2;
 meshPaintedCeiling(context,'vestibule-painted-ceiling',[
  [front.a[0],south],[playWest,south],[playWest,bathSouth],[screen.b[0],bathSouth],
  [screen.b[0],screenSouth],[west,screenSouth],[west,garage.a[1]],[front.a[0],garage.a[1]]
 ],mats.vestibule);
 meshPaintedCeiling(context,'playroom-painted-ceiling',ring([play.a[0]+play.thickness/2,south,east,office.a[1]-office.thickness/2]),mats.playroomCeiling);
 meshPaintedCeiling(context,'office-painted-ceiling',ring([data.stairs.box[2],office.a[1]+office.thickness/2,east,rear.a[1]-iconGroundFacadeDepth(rear)]),mats.officeCeiling);
}

function meshPaintedCeiling({THREE,data,mesh},name,outline,paint) {
 const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));
 const ceiling=mesh(new THREE.ShapeGeometry(shape),paint,name);
 ceiling.position.z=data.levels.groundCeiling-.002;ceiling.castShadow=false;
}

function iconHallWallFinish(data,wall) {
 const [,south,east]=data.rooms.find(r=>r.id==='0.5').box;
 switch(wall.id){
  case 'guest-inner': return {side:1,from:south-wall.a[1],to:wall.b[1]-wall.a[1]};
  case 'guest-office': return {side:-1,from:0,to:east-wall.a[0]};
  case 'hall-front': return {side:1,from:0,to:east-wall.a[0]};
  case 'kitchen-back': {
   const towerEdge=data.furniture.find(f=>f.id==='kitchen-tall')?.box[2]??wall.b[0];
   return {side:1,from:towerEdge-wall.a[0],to:wall.b[0]-wall.a[0],paintEnd:true};
  }
  case 'garage-hall': {
   const screen=data.walls.find(w=>w.id==='vestibule-screen');
   return {side:-1,from:screen.a[1]+screen.thickness/2-wall.a[1],to:wall.b[1]-wall.a[1],paintEnd:true};
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
 if(finish==='coral')return mats.hall;
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
 const doorPlane=cornerY+wallDepth/2;
 face([cornerX,cornerY],[cornerX,doorPlane],0,door.top);
 face([cornerX,doorPlane],[cornerX,insideY],0,door.top);
 face([cornerX,insideY],[cornerX,backY],0,top);
 face([innerX,backY],[divider.a[0]-divider.thickness/2,backY],0,top);
 face([divider.a[0]+divider.thickness/2,backY],[cornerX,backY],0,top);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 for(const [start,count,finish] of [[0,6,1],[6,6,2],[12,12,0],[24,6,1],[30,6,0]])geometry.addGroup(start,count,finish);
 mesh(geometry,[mats.vestibule,mats.garage,mats.wall],'entry-garage-jamb-return');
 obstacle('entry-garage-jamb-return',[innerX,cornerY,cornerX,backY],0,top);
 const x0=cornerX+door.start,x1=cornerX+door.end,y=cornerY+wallDepth/2;
 box('entry-main-door-leaf',[x0+.006,y-.027,x1-.006,y+.027],.008,door.top-.014,mats.indigoSteel);
 for(const sign of [-1,1]){
  const face=y+sign*.085,pull=x1-.14;
  for(const z of [.78,1.29])beam('entry-main-pull-mount-'+sign+'-'+z,[pull,y+sign*.027,z],[pull,face,z],.012,mats.metal);
  beam('entry-main-pull-'+sign,[pull,face,.756],[pull,face,1.314],.016,mats.metal);
 }
}

function iconGlazedSlider(context,name,prefix,x,y,yaw,width,opening) {
 const {box,mats}=context,stile=.033,bottom=opening.bottom+.021,top=opening.top-.015;
 const pivot=iconDoorPivot(context,name,x,y,0,yaw,width,0,1);
 const part=(id,b,z,h,material=mats.metal)=>{
  const mesh=box(prefix+'-'+id,b,z,h,material);
  pivot.add(mesh);return mesh;
 };
 for(const [id,u] of [['leading',0],['trailing',width-stile]])
  part(id,[u,-.017,u+stile,.017],bottom,top-bottom);
 for(const [id,z] of [['shoe',bottom],['head',top-stile]])
  part(id,[stile,-.017,width-stile,.017],z,stile);
 part('glass',[stile,-.004,width-stile,.004],bottom+stile,top-bottom-2*stile,mats.glass).castShadow=false;
 part('pull',[.005,-.038,.031,-.017],.95,.17);
 part('outside-pull',[.005,.017,.031,.025],.95,.17);
}

function iconTerraceSlider(context) {
 const wall=context.data.facades.find(f=>f.id==='facade-terrace');
 const opening=wall.openings.find(o=>!o.glass),width=opening.end-opening.start;
 const x=wall.a[0]-iconGroundFacadeDepth(wall)/2-.055;
 iconGlazedSlider(context,'garden-terrace-slider','terrace-slider',x,wall.a[1]+opening.end,-Math.PI/2,width,opening);
}

function iconOfficeCasement({THREE,group,mesh,beam,box,mats,obstacle,navigation,world},facade,index,opening) {
 const x=facade.a[0]-iconGroundFacadeDepth(facade)/2;
 const start=facade.a[1]+opening.start,end=facade.a[1]+opening.end,mid=(start+end)/2;
 const {bottom,top}=opening,r=.025,gap=.0015;
 const fixedPane=iconGlassGeometry(THREE,[[start,bottom],[mid,bottom],[mid,top],[start,top]],([u,z])=>[x,u,z]);
 mesh(fixedPane,mats.glass,facade.id+'-glass-'+index).castShadow=false;
 obstacle(facade.id+'-glass-barrier-'+index,[x-.025,start,x+.025,mid],bottom,top);
 for(const [id,a,b] of [['south',[start,bottom],[start,top]],['lower',[start,bottom],[mid,bottom]],['upper',[start,top],[mid,top]]])
  beam('office-window-fixed-'+id,[x,...a],[x,...b],r,mats.dark);
 const sash=new THREE.Group();sash.name='office-window-sash';sash.position.set(x-r,mid,bottom);group.add(sash);
 const width=end-mid,height=top-bottom;
 const pane=mesh(new THREE.PlaneGeometry(width-2*r,height-2*r),mats.glass,'office-window-sash-glass');
 pane.geometry.rotateX(Math.PI/2);pane.geometry.rotateZ(Math.PI/2);
 pane.position.set(r,width/2,height/2);pane.castShadow=false;sash.add(pane);
 // Split the original octagonal profiles at the joint so the closed window retains its 50 mm sightlines.
 const profile=(id,vertical,u,z,length,sign,moving)=>{
  const section=new THREE.Shape(),shoulder=r*Math.SQRT1_2;
  const face=vertical?sign:-sign,edge=r-gap*(r-shoulder)/shoulder;
  section.moveTo(-edge,face*gap);section.lineTo(-shoulder,face*shoulder);
  section.lineTo(0,face*r);section.lineTo(shoulder,face*shoulder);section.lineTo(edge,face*gap);section.closePath();
  const geometry=new THREE.ExtrudeGeometry(section,{depth:length,bevelEnabled:false});
  if(!vertical)geometry.rotateX(-Math.PI/2);
  const part=mesh(geometry,mats.dark,(moving?'office-window-sash-':'office-window-frame-')+id);
  if(moving){part.position.set(r,u,z);sash.add(part);}
  else part.position.set(x,mid+u,bottom+z);
 };
 for(const [id,vertical,u,z,length,inside] of [
  ['hinge',true,0,0,height,1],['latch',true,width,0,height,-1],
  ['sill',false,0,0,width,1],['head',false,0,height,width,-1]
 ]){
  profile(id,vertical,u,z,length,-inside,false);
  const inset=vertical?gap:r;
  profile(id,vertical,u+(vertical?0:inset),z+(vertical?inset:0),length-2*inset,inside,true);
  const y=mid+u,base=bottom+z;
  box('office-window-gasket-'+id,[x+r+.0005,y-(vertical?.003:0),x+r+.002,y+(vertical?.003:length)],
   base-(vertical?0:.003),vertical?length:.006,mats.dark);
 }
 const handleY=width-.015;
 for(const [id,d,w,base,h,depth] of [
  ['plate',.009,.018,1.030,.084,-.030],['neck',.035,.012,1.088,.013,-.050],['lever',.013,.014,1.002,.100,-.071]
 ]){
  const hardware=mesh(new THREE.BoxGeometry(d,w,h),mats.metal,'office-window-sash-handle-'+id);
  hardware.position.set(r+depth,handleY,base+h/2);sash.add(hardware);
 }
 obstacle('office-window-moving-barrier',[x-r,mid,x+r,end],bottom,top);
 const barrier=navigation.obstacles.at(-1);
 const corners=[[0,0],[2*r,0],[2*r,width],[0,width]];
 return angle=>{
  const cos=Math.cos(angle),sin=Math.sin(angle);
  for(const [i,[v,u]] of corners.entries()){
   const point=world([x-r+v*cos-u*sin,mid+v*sin+u*cos,0]);
   barrier.ring[i][0]=point[0];barrier.ring[i][1]=point[1];
  }
 };
}

function iconOfficeWindowControl(context) {
 const sash=context.group.getObjectByName('office-window-sash'),pick=iconVisiblePick(context,sash?[sash]:[]);
 let isOpen=false,from=0,to=0,start=0,moving=false;
 function update(now){
  if(!moving)return false;
  const t=context.THREE.MathUtils.clamp((now-start)/300,0,1);
  sash.rotation.z=from+(to-from)*t*t*(3-2*t);context.updateOfficeBarrier(sash.rotation.z);moving=t<1;
  return moving;
 }
 function toggleAt(ndc,camera){
  if(!pick(ndc,camera))return false;
  const now=performance.now();update(now);
  from=sash.rotation.z;isOpen=!isOpen;to=isOpen?Math.PI*84/180:0;
  start=now;moving=true;return true;
 }
 return {toggleAt,update,get isOpen(){return isOpen;}};
}

function iconInteriorFacades(context) {
 const {data, wall, box, obstacle, mats, beam, opening} = context;
 for(const facade of data.facades){
  let openings=facade.openings;
  const o=facade.id==='facade-garden'&&openings.find(o=>o.glass&&o.panels===3);
  if(o){
   const slidingPanel=1,width=(o.end-o.start)/o.panels,jambGap=.003;
   const gardenOpening={...o,slidingPanel,wallPoly:[[o.start,0],[o.end,0],[o.end,o.top],[7.76,o.top],[7.76,2.8],[.74,2.8],[.74,o.top],[o.start,o.top]]};
   openings=openings.map(original=>original===o?gardenOpening:original);
   const fixedPlane=facade.a[1]-iconGroundFacadeDepth(facade)/2;
   iconGlazedSlider(context,'living-garden-slider','living-slider',facade.a[0]+o.start+slidingPanel*width+jambGap,fixedPlane-.065,0,width-2*jambGap,o);
  }
  wall(facade.id,facade.a,facade.b,0,2.8,iconGroundFacadeDepth(facade),openings);
  for(const [i,aperture] of openings.entries())if(aperture.casement)context.updateOfficeBarrier=iconOfficeCasement(context,facade,i,aperture);
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

function iconStairFoldProfile(base,steps,tread,rise) {
 const profile=[[0,base]],run=steps*tread;
 for(let i=0;i<=steps;i++){
  const height=base+(i+1)*rise;
  profile.push([i===steps?run-iconStairSheet:i*tread,height]);
  if(i<steps)profile.push([i===steps-1?run-iconStairSheet:(i+1)*tread,height]);
 }
 return profile;
}

function iconFoldedStairFlight({THREE,mesh},id,x,width,y,dir,base,steps,tread,rise,steel) {
 const profile=iconStairFoldProfile(base,steps,tread,rise);
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
 const steel=context.mats.indigoSteel;
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

function iconStairBackingGeometry(THREE,[x,from,back,to],height,nextHeight,hallReturnEnd,lowerTreads) {
 const geometry=new THREE.BufferGeometry(),vertices=[];
 const quad=(finish,a,b,c,d)=>{
  geometry.addGroup(vertices.length/3,6,finish);
  vertices.push(...a,...b,...d,...b,...c,...d);
 };
 for(const [start,end,elevation] of lowerTreads){
  const y0=Math.max(start,from),y1=Math.min(end,to);
  if(y1<=y0)continue;
  const split=Math.min(elevation,height);
  quad(0,[x,y0,0],[x,y0,split],[x,y1,split],[x,y1,0]);
  if(split<height)quad(2,[x,y0,split],[x,y0,height],[x,y1,height],[x,y1,split]);
 }
 if(nextHeight<height)quad(0,[x,to,nextHeight],[x,to,height],[back,to,height],[back,to,nextHeight]);
 if(hallReturnEnd!==undefined){
  quad(1,[x,from,0],[back,from,0],[back,from,height],[x,from,height]);
  quad(1,[back,from,0],[back,hallReturnEnd,0],[back,hallReturnEnd,height],[back,from,height]);
 }
 quad(0,[x,from,height],[back,from,height],[back,to,height],[x,to,height]);
 quad(0,[x,from,0],[x,to,0],[back,to,0],[back,from,0]);
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.computeVertexNormals();
 return geometry;
}

function iconInteriorOfficeBacking(context) {
 const {THREE,data,mesh,obstacle,mats,navigation,material}=context;
 const cabinets=data.furniture.filter(item=>item.id.startsWith('office-under-stair-'));
 if(!cabinets.length)return;
 const backX=cabinets[0].box[0];
 const stairs=data.stairs,[sx,frontY,,rearY]=stairs.box,half=stairs.floorHeight/2;
 const cover={ramp:navigation.ramps.find(r=>r.id==='stair-upper'),landing:navigation.floors.find(f=>f.id==='stair-landing')};
 const office=data.walls.find(wall=>wall.id==='guest-office');
 const steps=stairs.rises/2-1,turn=frontY+steps*stairs.tread,rise=stairs.floorHeight/stairs.rises;
 const profile=iconStairFoldProfile(0,steps,stairs.tread,rise);
 const lowerTreads=[];
 for(let i=1;i<profile.length;i+=2){
  const [start,height]=profile[i],end=profile[i+1];
  lowerTreads.push([frontY+start,end?frontY+end[0]:rearY,height]);
 }
 const paint=material('#414a89',{name:'Smooth matte indigo paint',roughness:.79});
 const finishes=[mats.wall,mats.hall,paint];
 const segment=(name,from,to,height,nextHeight)=>{
  const bounds=[sx+stairs.width,Math.max(from,frontY),backX,Math.min(to,rearY)];
  if(bounds[3]<=bounds[1])return;
  const hallReturnEnd=bounds[1]===frontY?office.a[1]-office.thickness/2:undefined;
  const geometry=iconStairBackingGeometry(THREE,bounds,height,nextHeight,hallReturnEnd,lowerTreads);
  mesh(geometry,finishes,name).userData.kind='hall-partition';
  obstacle(name,bounds,0,height,cover);
 };
 // Set the plaster 2 mm behind the steel underside on horizontal and vertical folds.
 const setback=iconStairSheet+.002,landingHeight=half-iconLandingPlate;
 for(let i=0;i<steps;i++){
  const y=turn-i*stairs.tread-setback,height=half+(i+1)*rise-setback;
  segment('office-backing-flight-'+i,y-stairs.tread,y,height,i===0?landingHeight:height-rise);
 }
 const noseEnd=turn+iconLandingPlate;
 segment('office-backing-landing-nose',turn-setback,noseEnd,landingHeight,landingHeight);
 segment('office-backing-landing',noseEnd,rearY,landingHeight,0);
 iconInteriorOfficePartition(context,cabinets,frontY,steps*stairs.tread);
}

function iconCurvHousing(THREE,rings) {
 const points=[],indices=[],sides=64;
 for(const [radius,z,arched] of rings)for(let i=0;i<sides;i++){
  const angle=2*Math.PI*i/sides,sin=Math.sin(angle),cos=Math.cos(angle);
  const u=Math.sign(sin)*Math.abs(sin)**.66,v=Math.sign(cos)*Math.abs(cos)**.66;
  const opening=cos>0?Math.sqrt(Math.max(0,1-(Math.abs(u)/.90)**4)):0;
  points.push(.225*radius*u,.225*(1+radius*v),z+arched*(.007+.129*opening));
 }
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<sides;i++){
  const a=r*sides+i,b=r*sides+(i+1)%sides;
  indices.push(a,a+sides,b+sides,a,b+sides,b);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}

function iconCurvDock(context,frame) {
 const {THREE,material}=context,s=iconLivingShapes(context,frame),p=iconLivingPalette(context);
 const pearl=material('#e8e8e3',{name:'Qrevo Curv pearl shell',roughness:.33});
 const tray=material('#a7aaa7',{name:'Curv removable wash tray',roughness:.51});
 // The lower rim arches over the robot. Two inset rings separate the moulded base and the tank lid.
 const shell=[[.965,0,1],[1,0,1],[1,.153,0],[.991,.155,0],[.998,.158,0],
  [.98,.29,0],[.947,.358,0],[.899,.397,0],[.842,.422,0],[.815,.429,0],
  [.797,.429,0],[.797,.432,0],[.749,.436,0],[.55,.446,0],[.20,.4495,0],[0,.45,0]];
 s.add('curv-dock-shell',iconCurvHousing(THREE,shell),pearl,0,0,0);
 s.add('wash-tray',iconCurvHousing(THREE,[[.985,0,0],[.998,.006,0],[.946,.012,0],[0,.012,0]]),tray,0,0,0);
 s.disc('robot-base',0,.255,.012,.169,.169,.013,p.shadow);
 s.disc('robot-bumper',0,.255,.025,.175,.176,.061,pearl);
 s.disc('robot-lid',0,.255,.086,.174,.175,.0058,pearl);
 s.disc('retracted-lidar',0,.231,.091,.046,.046,.0008,tray);
 s.cushion('rgb-sensor-window',0,.427,.053,.075,.008,.022,.004,p.screen);
 s.cushion('rgb-lens',.014,.431,.055,.013,.002,.010,.001,p.lens);
 frame.part('tank-lid-pull',[-.029,.405,.029,.411],.429,.002,tray);
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
 const partition=panel('office-stair-partition',frontX,.055,[...edge,[endY,ceiling]],[mats.wall,mats.office]);
 const geometry=partition.geometry,normals=geometry.getAttribute('normal');
 geometry.clearGroups();
 for(let i=0;i<normals.count;i+=3){
  const finish=normals.getX(i)>.99?1:0,last=geometry.groups.at(-1);
  if(last?.materialIndex===finish)last.count+=3;
  else geometry.addGroup(i,3,finish);
 }
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

function iconRugMaterial(THREE,swatch) {
 const {name,width,height,palette,pixels}=swatch;
 const colors=atob(palette),indices=atob(pixels),rgba=new Uint8Array(width*height*4);
 for(let i=0;i<indices.length;i++){
  const index=indices.charCodeAt(i);
  if(index===255)continue;
  for(let channel=0;channel<3;channel++)rgba[4*i+channel]=colors.charCodeAt(index*3+channel);
  rgba[4*i+3]=255;
 }
 const map=new THREE.DataTexture(rgba,width,height);
 map.name=name;map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;
 map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;
 return new THREE.MeshStandardMaterial({name,map,roughness:.96,alphaTest:.44});
}

function iconLivingAccentMaterials({THREE}) {
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
 return {accentWalnut:walnut,
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

function iconRecliningAdult(context) {
 const sofa=context.data.furniture.find(item=>item.id==='sofa');
 if(!sofa)return;
 const {THREE,material}=context,frame=iconInteriorFurnitureFrame(context,{...sofa,id:'lounge-reader'});
 const s=iconLivingShapes(context,frame),p=iconLivingPalette(context);
 const sphere=new THREE.SphereGeometry(1,20,14),detailSphere=new THREE.SphereGeometry(1,10,7);
 const start=context.group.children.length;
 const fabric=(name,color)=>material(color,{name,map:p.linen.map,roughness:.96});
 const skin=material('#c48e71',{name:'Warm skin',roughness:.84}),hair=material('#342720',{name:'Dark chestnut hair',roughness:.83});
 const knit=fabric('Rust cotton knit','#ad6047'),rib=fabric('Ribbed knit edging','#944b37');
 const denim=fabric('Indigo lounge trousers','#354958'),sock=fabric('Oatmeal socks','#e4dbc3');
 const lips=material('#995e54'),brow=material('#4e382d');
 const ball=(name,center,radii,mat)=>{
  const mesh=s.add(name,Math.max(...radii)<.012?detailSphere:sphere,mat,...center);
  mesh.scale.set(...radii);return mesh;
 };
 const sweep=(name,rows,mat,sides)=>iconBodySweep(THREE,s,name,rows,mat,sides);
 const pad=iconVelvetBlock(THREE,s,'head-pillow',.53,.674,.524,.52,.52,.142,p.linen,0,.68);
 pad.rotateZ(.06);
 sweep('pullover',[[.647,.68,.642,.060,.054],[.682,.68,.64,.113,.081],[.728,.678,.631,.166,.108],
  [.783,.675,.621,.192,.119],[.883,.674,.607,.185,.131],[.977,.676,.588,.161,.119],
  [1.046,.677,.579,.146,.106],[1.066,.677,.580,.148,.110],[1.080,.677,.575,.144,.103],
  [1.118,.676,.571,.152,.104],[1.145,.676,.570,.154,.105],[1.162,.676,.566,.150,.098]],knit,26);
 sweep('pullover-waistband',[[1.158,.676,.568,.156,.104],[1.166,.676,.566,.158,.103],
  [1.198,.675,.560,.156,.095],[1.209,.675,.559,.151,.091]],rib);
 sweep('trousers-seat',[[1.174,.673,.559,.131,.083],[1.212,.673,.560,.149,.093],
  [1.269,.673,.559,.157,.096],[1.327,.673,.557,.149,.090],[1.381,.669,.551,.120,.076]],denim);
 iconRestingLegs(sweep,denim,sock);
 iconRestingArms(THREE,s,sweep,ball,knit,rib,skin);
 sweep('neck',[[.603,.678,.675,.056,.059],[.645,.679,.660,.064,.062],[.687,.68,.642,.064,.061]],skin);
 sweep('crew-neck',[[.650,.680,.646,.065,.059],[.659,.68,.645,.075,.068],[.678,.68,.642,.079,.070]],rib);
 iconRestingFace(THREE,s,ball,skin,hair,brow,lips);
 for(const object of context.group.children.slice(start))object.userData={furnitureId:'lounge-reader',room:sofa.room,pose:'reclining'};
}

// Each cross-section follows the centreline, so bent fabric keeps its volume through elbows and knees.
function iconBodySweep(THREE,s,name,rows,mat,sides=18){
 const vertices=[],uv=[],index=[],centers=rows.map(row=>new THREE.Vector3(...row.slice(0,3)));
 for(const [i,row] of rows.entries()){
  const tangent=centers[Math.min(i+1,rows.length-1)].clone().sub(centers[Math.max(i-1,0)]).normalize();
  const side=new THREE.Vector3(0,1,0);side.addScaledVector(tangent,-side.dot(tangent)).normalize();
  const up=tangent.clone().cross(side),[,,,width,thickness]=row;
  for(let j=0;j<=sides;j++){
   const angle=j*2*Math.PI/sides,point=centers[i].clone()
    .addScaledVector(side,width*Math.cos(angle)).addScaledVector(up,thickness*Math.sin(angle));
   vertices.push(...point.toArray());uv.push(j/sides,i/(rows.length-1));
   if(i&&j){const d=i*(sides+1)+j,a=d-sides-2;index.push(a,a+1,d,a,d,d-1);}
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
 return s.add(name,geometry,mat,0,0,0);
}

function iconRestingLegs(sweep,denim,sock) {
 const legs=[
  [[1.28,.610,.558,.086,.090],[1.40,.591,.558,.083,.092],[1.57,.577,.550,.071,.085],
   [1.697,.569,.537,.060,.067],[1.755,.572,.532,.058,.064],[1.872,.594,.532,.056,.065],
   [2.00,.614,.518,.046,.050],[2.099,.637,.508,.036,.039]],
  [[1.275,.742,.560,.085,.091],[1.414,.765,.602,.088,.096],[1.535,.783,.662,.076,.088],
   [1.635,.794,.712,.065,.073],[1.686,.794,.710,.062,.072],[1.76,.785,.651,.061,.070],
   [1.86,.773,.580,.052,.062],[1.988,.750,.516,.036,.042]]
 ];
 for(const [i,leg] of legs.entries()){
  sweep('trouser-leg-'+i,leg,denim);
  const [x,y,z]=leg.at(-1);
  sweep('sock-'+i,[[x-.018,y,z+.006,.036,.037],[x+.015,y,z,.039,.04],
   [x+.046,y+.006,z+.001,.045,.042],[x+.067,y+.014,z+.031,.044,.043],
   [x+.082,y+.035,z+.074,.042,.038],[x+.092,y+.051,z+.104,.037,.031],
   [x+.098,y+.058,z+.118,.019,.014],[x+.099,y+.059,z+.12,.002,.002]],sock);
 }
}

function iconRestingArms(THREE,s,sweep,ball,knit,rib,skin) {
 const arms=[
  [[.717,.538,.639,.006,.008],[.728,.531,.640,.036,.039],[.744,.524,.637,.053,.058],[.764,.519,.631,.061,.068],[.824,.494,.618,.061,.061],[.931,.479,.585,.051,.055],
   [1.018,.464,.545,.049,.050],[1.065,.469,.539,.048,.05],[1.129,.489,.538,.046,.044],[1.229,.522,.523,.034,.035]],
  [[.710,.814,.640,.006,.008],[.720,.822,.640,.035,.036],[.738,.828,.64,.055,.056],[.764,.830,.638,.062,.065],[.834,.864,.615,.063,.062],[.941,.895,.571,.053,.054],
   [1.010,.906,.553,.050,.05],[1.026,.906,.549,.050,.049],[1.038,.897,.556,.049,.049],
   [1.047,.886,.569,.049,.049],[1.06,.859,.601,.047,.048],[1.084,.778,.674,.034,.034]]
 ];
 for(const [i,arm] of arms.entries()){
  sweep('pullover-sleeve-'+i,arm,knit);
  const [x,y,z]=arm.at(-1),forearm=new THREE.Vector3(x,y,z).sub(new THREE.Vector3(...arm.at(-2).slice(0,3))).normalize();
  const axis=forearm.toArray(),from=length=>[x+length*axis[0],y+length*axis[1],z+length*axis[2]];
  sweep('sleeve-cuff-'+i,[[...from(-.008),.036,.036],[...from(-.006),.037,.037],[...from(.017),.033,.032]],rib);
  const wrist=from(.017),tip=i?[1.086,.670,.694]:[1.331,.553,.515];
  const forward=new THREE.Vector3(...tip).sub(new THREE.Vector3(...wrist)).normalize();
  const lateral=new THREE.Vector3(-forward.y,forward.x,0).normalize();
  const at=(length,offset,lift)=>new THREE.Vector3(...wrist).addScaledVector(forward,length).addScaledVector(lateral,offset).add(new THREE.Vector3(0,0,lift)).toArray();
  const palm=ball('hand-'+i,at(.041,0,.001),[.051,.036,.022],skin);palm.rotateZ(Math.atan2(forward.y,forward.x));
  for(let finger=0;finger<4;finger++){
   const length=[.048,.055,.051,.040][finger],offset=(finger-1.5)*.0135;
   s.tube('hand-'+i+'-finger-'+finger,[at(.065,offset,.003),at(.067+length*.5,offset*1.12,.002),at(.067+length,offset*1.15,-.005)],.0078,skin);
   ball('hand-'+i+'-fingertip-'+finger,at(.067+length,offset*1.15,-.005),[.008,.008,.008],skin);
  }
  s.tube('thumb-'+i,[at(.022,-.018,.006),at(.045,-.039,.010),at(.071,-.044,.002)],.012,skin);
 }
}

function iconRestingFace(THREE,s,ball,skin,hair,brow,lips) {
 // The head is turned toward the room; the back of the skull nestles into the linen cushion.
 const center=[.537,.683,.674],tilt=-.55,cos=Math.cos(tilt),sin=Math.sin(tilt);
 const head=(x,y,z)=>[center[0]+x,center[1]+y*cos-z*sin,center[2]+y*sin+z*cos];
 const oval=(name,x,y,z,radii,mat)=>ball(name,head(x,y,z),radii,mat).rotateX(tilt);
 const curve=(name,points,r,mat)=>s.tube(name,points.map(q=>head(...q)),r,mat);
 const radii=x=>{
  const t=Math.max(0,1-(x/.126)**2)**.5,jaw=Math.max(0,x/.126);
  return [.085*t*(1-.19*jaw**2),.096*t*(1-.14*jaw),-.009*jaw];
 };
 const surface=(x,a,offset=0)=>{
  const [w,h,z]=radii(x);
  const v=(w+offset)*Math.sin(a),front=Math.cos(a),bump=(u,dx,y,dy)=>Math.exp(-(((x-u)/dx)**2+((v-y)/dy)**2));
  const relief=.019*bump(.017,.037,0,.009)+.022*bump(.041,.014,0,.012)
   +.008*bump(.043,.009,Math.sign(v)*.012,.008)
   +.005*bump(.032,.03,Math.sign(v)*.045,.02)-.004*bump(0,.015,Math.sign(v)*.030,.015)
   +.004*bump(.066,.012,0,.018)+.005*bump(.091,.014,0,.023);
  return [x,v,z+(h+offset)*front+Math.max(0,front)**4*relief];
 };
 const hairline=a=>-.048+.132*(1-Math.cos(a))/2+.013*Math.sin(a*2+.3)+.006*Math.sin(a*5+.6);
 for(const isHair of [false,true]){
  const vertices=[],indices=[],uv=[],colors=[],rings=isHair?28:52,sides=isHair?108:84;
  for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
   const a=j*2*Math.PI/sides;
   const fringe=hairline(a);
   const t=i/rings,x=-.126+t*(isHair?fringe+.126:.252);
   const ridge=.5+.5*Math.cos(28*a+2*Math.sin(4*a)+Math.sin(7*a)-4*t-.7*Math.sin(Math.PI*t));
   const offset=isHair?Math.min(1,8*t)*(.006+.003*ridge):0;
   vertices.push(...head(...surface(x,a,offset)));uv.push(j/sides,t);
   if(isHair){const tone=.80+.27*ridge+.13*Math.sin(3*a-.4*t)**2;colors.push(tone,tone,tone);}
   if(i&&j){const d=i*(sides+1)+j,b=d-sides-2;indices.push(b,d,b+1,b,d-1,d);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  if(isHair){geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));hair.vertexColors=true;}
  s.add(isHair?'hair':'face',geometry,isHair?hair:skin,0,0,0);
 }
 const onFace=(x,y,lift=0)=>{
  const [w]=radii(x),p=surface(x,Math.asin(y/w));p[2]+=lift;return p;
 };
 for(const side of [-1,1]){
  oval('ear-'+side,.021,side*.08,-.002,[.021,.010,.015],skin);
  curve('eyelid-'+side,[[.002,.013],[.004,.026],[.003,.039],[.001,.047]].map(([x,y])=>onFace(x,side*y,.0011)),.0012,brow);
  curve('eyebrow-'+side,[[-.010,.015],[-.016,.029],[-.016,.040],[-.012,.049]].map(([x,y])=>onFace(x,side*y,.0014)),.0021,brow);
 }
 curve('mouth',[[.069,-.019],[.068,-.010],[.069,0],[.068,.010],[.069,.019]].map(([x,y])=>onFace(x,y,.0009)),.00135,lips);
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

function iconPhotoRug(context,frame) {
 const {THREE}=context,{item,width:w,depth:d}=frame;
 const swatch=context.data.textiles[item.id],s=iconLivingShapes(context,frame);
 const material=iconRugMaterial(THREE,swatch),h=item.height;
 const points=swatch.outline.map(([x,y])=>[(x+.5)/swatch.width,(y+.5)/swatch.height]);
 const positions=[],uvs=[],indices=[];
 for(let i=0;i<points.length;i++){
  const [u,v]=points[i],next=2*((i+1)%points.length),start=2*i;
  for(const z of [0,h]){
   positions.push((u-.5)*w,(v-.5)*d,z);
   uvs.push(u,v);
  }
  indices.push(start,next,next+1,start,next+1,start+1);
 }
 const edge=new THREE.BufferGeometry();
 edge.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 edge.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 edge.setIndex(indices);edge.computeVertexNormals();
 const binding=material.clone();
 binding.side=THREE.DoubleSide;binding.alphaTest=0;
 s.add('woven-edge',edge,binding,w/2,d/2,0);
 s.add('woven-face',new THREE.PlaneGeometry(w,d),material,w/2,d/2,h);
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
 const cornerX=.060,cornerY=.120,halfJoint=.025;
 for(const u of [cornerX,w-cornerX])part('long-apron-'+u,[u-.012,cornerY+halfJoint,u+.012,d-cornerY-halfJoint],apronBase,apronHeight,wood);
 for(const v of [cornerY,d-cornerY])part('end-apron-'+v,[cornerX+halfJoint,v-.012,w-cornerX-halfJoint,v+.012],apronBase,apronHeight,wood);
 for(const sx of [-1,1])for(const sy of [-1,1]){
  const shoulderX=sx<0?cornerX:w-cornerX,shoulderY=sy<0?cornerY:d-cornerY;
  part('corner-joint-'+sx+'-'+sy,[shoulderX-halfJoint,shoulderY-halfJoint,shoulderX+halfJoint,shoulderY+halfJoint],apronBase,apronHeight,wood);
  const leg=new THREE.BoxGeometry(1,1,1),pos=leg.attributes.position;
  for(let i=0;i<pos.count;i++){
   const t=pos.getZ(i)+.5,thickness=.032+.018*t;
   const x=shoulderX+sx*.029*(1-t);
   const y=shoulderY+sy*.049*(1-t);
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
 const laminate=new THREE.MeshPhysicalMaterial({name:'Smoked walnut matte HPL',color:'#5c4a3b',roughness:.87,specularIntensity:.14});
 laminate.userData.surfaceProfile='kitchenWorktopSmokedWalnut';
 laminate.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float bandDistance; varying float vBandDistance;\n'+shader.vertexShader
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvBandDistance=bandDistance;');
  shader.fragmentShader='varying float vBandDistance;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
   #include <map_fragment>
   float bandAA = max(fwidth(vBandDistance), 0.0001);
   float band = clamp((0.0015 - vBandDistance)/bandAA + 0.5, 0.0, 1.0);
   diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.090, 0.050, 0.029), band);
  `);
 };
 return {
  laminate,
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

function iconKitchenRobotTower(context,frame,k,width,front,head) {
 const {item,part}=frame,{mats}=context,t=.018,center=width/2;
 const {slotWidthM,slotHeightM,shelfHeightsM}=item.robotCabinet,shoulder=(width-slotWidthM)/2;
 part('robot-back',[t,0,width-t,t],0,item.height,mats.oak);
 for(const [side,l,r] of [['left',0,t],['right',width-t,width]])
  part('robot-side-'+side,[l,0,r,front-.021],0,item.height,mats.oak);
 for(const [i,h] of shelfHeightsM.entries())
  part('robot-shelf-'+i,[t,t,width-t,front-.045],h,t,mats.oak);
 part('robot-top',[t,t,width-t,front-.021],item.height-t,t,mats.oak);
 for(const [side,l,r] of [['left',.003,shoulder],['right',width-shoulder,width-.003]])
  iconKitchenPanel(frame,'robot-slot-'+side,l,r,.002,slotHeightM-.003,front,k.yellow);
 iconKitchenPanel(frame,'left-front',.003,width-.003,slotHeightM,head-.003,front,k.yellow);
 iconKitchenGrip(frame,'robot-pull',width-.035,front,1.025,.20,true,k.bronze);
 const [x,y]=frame.point(center,t+.037);
 const dockFrame=iconInteriorFurnitureFrame(context,{id:'kitchen-robot',room:item.room,facing:'+y',box:[x,y,x+.45,y+.45]});
 iconCurvDock(context,dockFrame);
 const p=iconLivingPalette(context),service=iconLivingShapes(context,frame);
 service.cushion('robot-socket',center+.150,t+.006,.33,.076,.012,.076,.005,p.chalk);
 service.cushion('robot-plug',center+.150,t+.024,.33,.032,.027,.031,.006,p.black);
 service.tube('robot-cord',[[center+.150,t+.037,.33],[center+.150,t+.043,.285],
  [center+.140,t+.040,.225],[center+.110,t+.049,.215],[center+.090,t+.077,.215]],.003,p.black);
 const [x0,y0]=item.box,inner=front-.021;
 context.obstacle('robot-tower-back',[x0,y0,x0+width,y0+t],0,item.height);
 context.obstacle('robot-tower-left',[x0,y0,x0+t,y0+inner],0,item.height);
 context.obstacle('robot-tower-right',[x0+width-t,y0,x0+width,y0+inner],0,item.height);
 context.obstacle('robot-tower-dock',[x-.225,y,x+.225,y+.45],0,.45);
 context.obstacle('robot-tower-shelves',[x0+t,y0+t,x0+width-t,y0+inner],shelfHeightsM[0],item.height);
}

function iconKitchenRobotControl(context) {
 const {THREE,group,navigation,world,obstacle}=context,door=group.getObjectByName('kitchen-pantry-left-front');
 if(!group.getObjectByName('kitchen-pantry-robot-pull'))return null;
 const {width,height:thickness,depth:height}=door.geometry.parameters;
 const hinge=new THREE.Group(),mount=new THREE.Group();
 hinge.name='kitchen-robot-cabinet-door';
 hinge.position.set(door.position.x-width/2,door.position.y+thickness/2,0);
 mount.position.copy(hinge.position).negate();group.add(hinge);hinge.add(mount);
 mount.add(door,group.getObjectByName('kitchen-pantry-robot-pull'));
 const {x,y}=hinge.position,lower=door.position.z-height/2;
 obstacle(hinge.name,[x,y-thickness,x+width,y],lower,lower+height);
 const ring=navigation.obstacles.at(-1).ring,eye=new THREE.Vector3(),pick=iconVisiblePick(context,[hinge]);
 const corners=[[0,-thickness],[width,-thickness],[width,0],[0,0]];
 let open=false;
 function toggleAt(ndc,camera){
  if(!pick(ndc,camera))return false;
  if(camera.isPerspectiveCamera){
   group.worldToLocal(camera.getWorldPosition(eye));eye.sub(hinge.position);
   if(eye.z>0&&eye.z<lower+height+1.7&&eye.x>-.24&&eye.y>-.24&&Math.hypot(eye.x,eye.y)<width+.24)return false;
  }
  open=!open;hinge.rotation.z=open?Math.PI/2:0;
  for(const [i,[u,v]] of corners.entries()){
   const point=world(open?[x-v,y+u]:[x+u,y+v]);ring[i][0]=point[0];ring[i][1]=point[1];
  }
  hinge.updateWorldMatrix(true,true);
  return true;
 }
 return {toggleAt,get isOpen(){return open;}};
}

function iconKitchenPantry(context,frame,k) {
 const {item,width:w,depth:d,part}=frame,[x0,y0,,y1]=item.box,top=item.height,front=d-.039;
 const wall=context.data.walls.find(wall=>wall.id===item.passageWall);
 const [a,b]=wall.doors[0].map(offset=>wall.a[0]+offset-x0),head=2.1;
 if(item.robotCabinet)iconKitchenRobotTower(context,frame,k,a,front,head);
 else part('left-carcass',[0,0,a,front-.021],.008,top-.008,k.recess);
 part('right-filler',[b,0,w,front-.021],.008,top-.008,k.recess);
 part('bridge',[a,0,b,front-.021],head,top-head,k.recess);
 for(const [i,l,r] of [[0,0,a],[1,a,b],[2,b,w]]){
  const leaf=i===1,id=leaf?'closed-leaf':i===0?'left-front':'right-front';
  const robot=i===0&&item.robotCabinet;
  if(!robot)iconKitchenPanel(frame,id,l+.003,r-.003,.008,head-.003,front,k.yellow);
  iconKitchenPanel(frame,'crown-'+i,l+.003,r-.003,head+.002,top,front,k.yellow);
  if(!leaf&&!robot)context.obstacle('furniture-'+item.id+'-'+(i===0?'left':'right'),[x0+l,y0,x0+r,y1],0,top);
 }
 iconKitchenGrip(frame,'leaf-pull',b-.017,front,1.025,.20,true,k.bronze);
 context.obstacle('furniture-'+item.id,[x0+a,y0,x0+b,y1],head,top);
}

function iconKitchenMosaic(context,frame,left,right,bottom,top) {
 const {THREE,mesh}=context,vertices=[],colors=[],rows=15;
 const cols=Math.round((right-left)/((top-bottom)/rows));
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

function iconMagnificaPanel(context,s,x,y,z,black) {
 const {THREE}=context,tilt=.96,geometry=iconLabelPlane(context,.210,.085).rotateX(tilt);
 const material=black.clone();material.roughness=.18;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=256;
  const ink=canvas.getContext('2d');
  ink.fillStyle='#171819';ink.fillRect(0,0,640,256);ink.textAlign='center';ink.textBaseline='middle';
  ink.strokeStyle='#a4a3a1';ink.lineWidth=3;ink.font='24px sans-serif';ink.fillStyle='#d4d2cd';
  for(const [i,text] of ['≋','○','●  ●  ●','×2','⏻'].entries()){
   const u=[88,170,320,465,546][i];ink.beginPath();ink.roundRect(u-(i===2?67:31),32,i===2?134:62,47,23);
   ink.stroke();ink.fillText(text,u,55);
  }
  for(const [i,name] of ['Steam','Espresso','Coffee','Long'].entries()){
   const u=138+i*121,h=[35,23,31,36][i];
   ink.fillStyle=['#eaeae7','#c79052','#d1a56e','#b27a47'][i];ink.strokeStyle='#e8e6e1';
   ink.beginPath();ink.moveTo(u-18,153-h);ink.lineTo(u+18,153-h);ink.lineTo(u+13,153);ink.lineTo(u-12,153);ink.closePath();ink.fill();ink.stroke();
   ink.font='15px sans-serif';ink.fillStyle='#eeece7';ink.fillText(name,u,179);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;material.map=map;material.color.set(0xffffff);
 }
 s.add('magnifica-touch-panel',geometry,material,x,y,z).castShadow=false;
}

function iconKitchenEspresso(context,frame,s,x,z) {
 const {material}=context,rear=.095;
 const black=material('#28292b',{name:'DeLonghi Magnifica Evo ECAM290.21.B black ABS',roughness:.30});
 const trim=material('#17181a',{name:'Magnifica satin black trim',roughness:.42});
 const steel=material('#c1c2c3',{name:'Magnifica brushed silver',metalness:.64,roughness:.28});
 const piece=(id,u,v,h,w,d,height,r,finish=black,tilt=0)=>
  s.cushion('magnifica-'+id,x+u,rear+v,z+h,w,d,height,r,finish,tilt);
 piece('tray-base',0,.220,.017,.240,.440,.034,.015,trim);
 piece('rear-body',0,.144,.180,.237,.284,.292,.014);
 piece('removable-tank',.1155,.155,.145,.008,.237,.211,.003,trim);
 for(const side of [-1,1])piece('bay-cheek-'+side,side*.093,.283,.145,.052,.032,.223,.008);
 piece('grounds-drawer',0,.284,.106,.129,.014,.131,.004,trim);
 piece('hopper-lid',0,.110,.339,.215,.203,.036,.015,trim);
 piece('ground-coffee-hatch',0,.183,.3585,.069,.045,.003,.0014,black);
 piece('cup-shelf',0,.248,.321,.228,.103,.014,.006,trim);
 for(let i=-6;i<=6;i++)piece('shelf-rib-'+i,i*.015,.248,.330,.002,.078,.004,.001);
 piece('front-hood',0,.324,.265,.240,.147,.065,.019);
 piece('sloped-fascia',0,.341,.304,.232,.096,.025,.011,black,-(Math.PI/2-.96));
 iconMagnificaPanel(context,s,x,rear+.349,z+.315,trim);
 piece('dispensing-head',0,.335,.205,.085,.078,.084,.010,steel);
 piece('adjustable-slide',0,.325,.160,.052,.046,.048,.005,trim);
 for(const [i,u] of [-.020,.020].entries())
  s.disc('magnifica-spout-'+i,x+u,rear+.340,z+.130,.006,.006,.025,steel);
 piece('steam-valve',-.086,.398,.255,.027,.019,.013,.005,trim);
 s.disc('magnifica-wand-grip',x-.091,rear+.337,z+.179,.012,.012,.055,trim);
 s.disc('magnifica-steam-wand',x-.091,rear+.337,z+.115,.009,.009,.065,steel);
 piece('drip-grille',0,.367,.037,.224,.132,.007,.003,steel);
 for(let i=-5;i<=5;i++)piece('grille-slot-'+i,i*.018,.363,.041,.003,.100-.018*(Math.abs(i)%2),.001,.0004,trim);
 piece('brand-plaque',0,.374,.213,.047,.0025,.013,.001,trim);
 iconApplianceMark(context,frame,'magnifica-brand','De’Longhi',x,rear+.3754,z+.213,.045,.013,'#f4f4f2');
 iconApplianceMark(context,frame,'magnifica-series','MAGNIFICA EVO',x,rear+.3743,z+.194,.064,.011);
}

function iconKitchenNiche(context,frame,s,p,k) {
 const {width:w,depth:d,part}=frame,top=context.data.levels.groundCeiling;
 const counter=frame.item.height,upper=1.58,crown=2.1,front=d-.065,bay=w/5;
 part('slab-backsplash',[0,0,w,.0359],counter,upper-counter,p.putty);
 iconKitchenMosaic(context,frame,.028,w,counter,upper);
 iconKitchenEspresso(context,frame,s,.218,counter);
 part('niche-end-trim',[.010,.0359,.028,.393],counter,upper-counter,p.accentWalnut);
 part('upper-carcass',[0,0,w,.423],upper,crown-upper,k.recess);
 part('crown-carcass',[0,0,w,front-.021],crown,top-crown,k.recess);
 for(let i=0;i<5;i++){
  const l=bay*i+.0025,r=bay*(i+1)-.0025;
  iconKitchenPanel(frame,'upper-'+i,l,r,upper,crown-.003,.445,k.yellow);
  iconKitchenPanel(frame,'crown-'+i,l,r,crown+.002,top,front,k.yellow);
 }
 part('niche-light',[.036,.38,w-.036,.39],upper-.008,.008,frame.mats.lamp);
}

function iconIslandOven(context,frame,s,p,x,face) {
 const {THREE}=context,{part,line}=frame,w=.595,h=.595,top=.889,bottom=top-h;
 const left=x-w/2,right=x+w/2,back=face+.515,sill=bottom+.060,lintel=top-.161;
 const box=(id,l,a,r,b,z,height,material)=>part('oven-'+id,[l,a,r,b],z,height,material);
 const steel=new THREE.MeshStandardMaterial({name:'Oven satin stainless steel',color:'#a6a7a3',roughness:.38,metalness:.66});
 const enamel=new THREE.MeshStandardMaterial({name:'Oven cavity enamel',color:'#414644',roughness:.38,metalness:.25});
 const glass=new THREE.MeshStandardMaterial({name:'Smoked oven door glass',color:'#41504e',roughness:.13,metalness:.12,transparent:true,opacity:.49,depthWrite:false});
 box('enamel-back',left+.025,back,right-.025,back+.012,sill,lintel-sill,enamel);
 box('enamel-floor',left+.025,face+.027,right-.025,back+.012,sill-.009,.009,enamel);
 box('enamel-ceiling',left+.025,face+.027,right-.025,back+.012,lintel,.009,enamel);
 for(const [side,l,r,inside] of [['left',left,left+.025,left+.018],['right',right-.025,right,right-.025]]){
  box('jamb-'+side,l,face,r,face+.021,bottom,h,p.black);
  box('cavity-side-'+side,inside,face+.021,inside+.007,back+.012,bottom,h,p.black);
 }
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
}

function iconIslandDrawer(context,frame,k,p,column,row,left,right,face,bottom,top,depth,wallHeight,oven=false) {
 const suffix=column+'-'+row,front=face+.021,back=front+depth,floor=bottom+.024,wall=.012;
 const id='drawer-box-'+suffix,parts=[],runners=[];
 const l=left+.027,r=right-.027,mid=(l+r)/2;
 const piece=(kind,outline,z,h)=>parts.push(frame.part(id+'-'+kind,outline,z,h,p.ash));
 piece('floor',[l,front,r,back],floor,wall);
 piece('back',[l,back-wall,r,back],floor+wall,wallHeight-wall);
 for(const [side,sign,edge,seam] of [['left',1,l,left+.009],['right',-1,r,right-.009]]){
  const inner=edge+sign*wall;
  piece(side,[Math.min(edge,inner),front,Math.max(edge,inner),back-wall],floor+wall,wallHeight-wall);
  for(const [i,height] of [.045,.034,.021].entries()){
   const u=seam+sign*.006*i,v=u+sign*.006;
   const rail=frame.part('slide-'+suffix+'-'+side+'-'+i,[Math.min(u,v),front+.003,Math.max(u,v),back-.003],
    floor+.030-height/2,height,p.silver);
   if(i===1)runners.push(rail);
   if(i===2)parts.push(rail);
  }
 }
 const first=context.group.children.length;
 iconKitchenPanel(frame,oven?'oven-tray-drawer':'working-drawer-'+suffix,left+.0025,right-.0025,bottom,top,face,k.yellow,true);
 iconKitchenGrip(frame,oven?'oven-tray-pull':'working-pull-'+suffix,mid,face,top,.145,false,k.bronze,true);
 parts.push(...context.group.children.slice(first));
 const [x,y]=frame.point(left,face-.021),[endX,endY]=frame.point(right,front);
 (frame.pullouts??=[]).push({name:'kitchen-island-pullout-'+suffix,moving:parts,runners,
  box:[x,y,endX,endY],travel:-(depth-.01),bottom,top});
}

function iconIslandCabinets(context,frame,s,p,k,cx,cy,hob) {
 const {width:w,depth:d,item,part}=frame,{moduleWidthsM,ovenColumn,extractorColumns}=item.cabinetry;
 const face=.045,near=face+.021,rear=d-.19,cap=item.height-.038;
 let edge=(w-moduleWidthsM.reduce((sum,v)=>sum+v,0))/2;
 const bodyEnd=w-edge,centerSeam=extractorColumns[1];
 part('body',[edge,rear,bodyEnd,rear+.018],.118,cap-.118,k.recess);
 for(const [id,l,r] of [['left',.038,edge],['right',bodyEnd,w-.038]])
  part('end-filler-'+id,[l,face,r,near],.118,cap-.118,k.yellow);
 for(const [id,l,r] of [['left',.064,cx-.23],['right',cx+.23,w-.064]])
  part('plinth-'+id,[l,face+.049,r,rear],.014,.104,p.shadow);
 const hobRear=cy+(hob.box[3]-hob.box[1])/2;
 // Keep the NYTTIG plinth unit at its standard length behind a recessed central grille.
 const outletFace=hobRear-.014+.0275-.4867;
 iconNyttig(context,frame,s,p,cx,outletFace,hobRear);
 for(const [i,width] of moduleWidthsM.entries()){
  const right=edge+width,paired=extractorColumns.includes(i),mid=(edge+right)/2;
  // Paired 600 mm fronts share a 1200 mm chassis opening above a low rail support.
  const low=i===centerSeam,wallBack=low?near+.405:rear,wallTop=low?.680:cap,wallBase=low?.136:.118;
  part('side-'+i,[edge-.009,near,edge+.009,wallBack],wallBase,wallTop-wallBase,k.recess);
  if(!low){
   const railEnd=i+1===centerSeam?right+moduleWidthsM[centerSeam]:right;
   part('worktop-support-'+i,[edge+.009,near+.03,railEnd-.009,near+.105],cap-.018,.018,p.ash);
  }
  part('support-'+i,[low?edge:edge+.009,near,i+1===centerSeam?right:right-.009,paired?near+.405:rear],.118,.018,p.ash);
  if(i===ovenColumn){
   part('oven-support',[edge+.009,near,right-.009,near+.55],.276,.018,p.ash);
   iconIslandOven(context,frame,s,p,mid,face);
   iconIslandDrawer(context,frame,k,p,i,0,edge,right,face,.122,.289,.5,.105,true);
  }else{
   const depth=paired?.40:.50;
   iconIslandDrawer(context,frame,k,p,i,0,edge,right,face,.122,.490,depth,.235);
   iconIslandDrawer(context,frame,k,p,i,1,edge,right,face,.497,item.height-.055,depth,paired?.145:.245);
  }
  edge=right;
 }
 part('side-end',[edge-.009,near,edge+.009,rear],.118,cap-.118,k.recess);
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

function iconApplianceMark(context,frame,tag,label,x,y,z,width,height,color='#536067') {
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
  ink.fillStyle=color;ink.fillText(label,128,32,248);
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
  iconApplianceMark(context,frame,name,label,x+(id==='freezer'?.157:0),front+.003,bottom+height*.40,id==='freezer'?.062:.206,id==='freezer'?.062:.036);
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
 iconApplianceMark(context,frame,id+'-header','SAMSUNG',x-.192,nose-.003,top-.032,.105,.025);
 iconApplianceMark(context,frame,id+'-display',id==='fridge'?'03°':'−18°',x,nose-.001,top-.032,.082,.028);
 for(const [i,h] of [1.575,1.427,1.282].entries()){
  const width=i?.049:.147;
  for(const offset of i?[-.061,.061]:[0])plate('vent-'+i+'-'+offset,offset-width/2,offset+width/2,inner+.007,inner+.009,base+h,base+h+.007,m.slot);
 }
 iconApplianceMark(context,frame,id+'-duct','Metal Cooling',x,inner+.010,base+1.503,.207,.040);
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

function iconKitchenDrawers(frame,k,start,end,count,face,first=0) {
 const w=(end-start)/count,panel=k.yellow,top=frame.item.height-.055;
 for(let i=0;i<count;i++){
  const l=start+w*i+.0025,r=start+w*(i+1)-.0025,x=(l+r)/2;
  const rows=first+i===2?[[.122,top]]:[[.122,.634],[.641,top]];
  for(const [j,[b,t]] of rows.entries()){
   iconKitchenPanel(frame,'front-'+(first+i)+'-'+j,l,r,b,t,face,panel);
   iconKitchenGrip(frame,'drawer-pull-'+(first+i)+'-'+j,x,face,t,.145,false,k.bronze);
  }
 }
}

function iconIslandVeneer(THREE) {
 const tau=2*Math.PI;
 return iconFinishTexture(THREE,'Slate blue and pale ash figured veneer',2048,448,.59,(u,v)=>{
  const across=u*18,leaf=Math.floor(across),seed=leaf*2.39996;
  const drift=.044*Math.sin(6*v+seed)+.022*Math.sin(13*v-.7*seed)+
   .010*Math.sin(25*v+2*Math.sin(7*v+seed)-seed);
  const x=across-leaf-.48-.22*Math.sin(seed)-drift;
  const z=v-(.5+.64*Math.sin(seed+1.8));
  // A flat slice through successive growth rings opens up into a cathedral at the pith.
  const radius=Math.sqrt(x*x+(.10+.04*Math.cos(seed))*(z+.065*Math.sin(7*x+seed))**2+.0028);
  const layers=radius*(10.5+3*Math.cos(seed))+.11*Math.sin(28*x+4*v+seed);
  const phase=layers+.29*Math.sin(layers*1.8+seed)+.14*Math.sin(layers*3.2-seed);
  const ripple=Math.cos(tau*phase)+.22*Math.cos(tau*phase*2+.7);
  const strand=Math.sin(tau*(across*29+drift*11)+2*Math.cos(tau*(v+3*x)));
  const pore=Math.sin(Math.floor(u*2048)*17.7+Math.floor(v*448)*8.91);
  const boundary=.23*Math.sin(tau*layers*.43+seed)+.10*strand+.075*pore;
  const ash=Math.max(0,Math.min(1,.52+1.60*(ripple-boundary)));
  const fibres=3.2*strand+3.4*pore+2.5*Math.sin(130*x+12*v+seed);
  return [66+132*ash+fibres,88+109*ash+fibres,105+81*ash+fibres];
 });
}

function iconKitchenOutline(path,x,y,w,d,r=0) {
 if(!r){
  path.moveTo(x,y);path.lineTo(x+w,y);path.lineTo(x+w,y+d);path.lineTo(x,y+d);path.closePath();return path;
 }
 path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);
 path.lineTo(x+w,y+d-r);path.quadraticCurveTo(x+w,y+d,x+w-r,y+d);
 path.lineTo(x+r,y+d);path.quadraticCurveTo(x,y+d,x,y+d-r);
 path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);path.closePath();
 return path;
}

function iconTacknanControls(THREE,s,z) {
 const keys=[],digits=[];
 const mark=(set,x,y,w,h)=>set.push(iconKitchenOutline(new THREE.Shape(),x,y,w,h,0));
 for(const x of [.269,.320,.480,.531]){
  for(const dx of [-.012,.009])mark(keys,x+dx-.003,.043,.006,.0012);
  mark(keys,x+.0084,.0406,.0012,.006);
  mark(keys,x-.003,.026,.006,.001);mark(keys,x-.003,.031,.006,.001);
  for(const dx of [-.003,.002])mark(keys,x+dx,.027,.001,.004);
  for(const y of [.040,.048])mark(digits,x-.002,y,.004,.0008);
  for(const dx of [-.0028,.0021])mark(digits,x+dx,.041,.0007,.006);
 }
 for(const x of [.197,.210,.226,.373,.389,.406,.422,.438,.556,.573,.591]){
  const key=new THREE.Shape();key.absarc(x,.043,.0021,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.absarc(x,.043,.0012,0,Math.PI*2,true);key.holes.push(hole);keys.push(key);
 }
 for(const [name,shapes,color] of [['touch-keys',keys,'#b6bab8'],['red-display',digits,'#d54b35']]){
  const o=s.add(name,new THREE.ShapeGeometry(shapes),new THREE.MeshBasicMaterial({color}),0,0,z);
  o.castShadow=o.receiveShadow=false;
 }
}

function iconTacknan({THREE},frame,s,p) {
 const {width:w,depth:d,item,part}=frame,h=item.height,cx=w/2;
 const glass=new THREE.MeshStandardMaterial({name:'TÄCKNAN black ceramic glass',color:'#17191a',roughness:.13,metalness:.22});
 const iron=new THREE.MeshStandardMaterial({name:'TÄCKNAN graphite intake',color:'#404345',roughness:.43,metalness:.38});
 const print=new THREE.MeshBasicMaterial({color:'#9eaaa8'});
 const outline=iconKitchenOutline(new THREE.Shape(),0,0,w,d,.004);
 outline.holes.push(iconKitchenOutline(new THREE.Path(),cx-.042,.102,.084,.372,.009));
 s.add('glass',new THREE.ExtrudeGeometry(outline,{depth:h,bevelEnabled:false,curveSegments:4}),glass,0,0,0);
 const grille=iconKitchenOutline(new THREE.Shape(),cx-.041,.103,.082,.370,.008);
 for(let j=0;j<16;j++)grille.holes.push(iconKitchenOutline(new THREE.Path(),cx-.032,.117+j*.0211,.064,.015,.0073));
 s.add('extractor-grille',new THREE.ExtrudeGeometry(grille,{depth:.004,bevelEnabled:false,curveSegments:4}),iron,0,0,.0004);
 part('filter-bed',[cx-.040,.104,cx+.040,.472],-.032,.002,p.black);
 part('filter-spine',[cx-.002,.106,cx+.002,.470],-.029,.008,iron);
 for(const [row,y,diameter,inset] of [['front',.173,.16,.178],['rear',.394,.22,.157]]){
  for(const [side,x] of [['left',inset],['right',w-inset]]){
   const symbols=[[x-diameter/2,y-.0008,diameter/2-.021,.0016],[x-.0026,y-.0026,.0052,.0052],[x+.021,y-.0008,diameter/2-.021,.0016]];
   const zone=s.add('induction-zone-'+row+'-'+side,new THREE.ShapeGeometry(symbols.map(b=>iconKitchenOutline(new THREE.Shape(),...b))),print,0,0,h+.00015);
   zone.castShadow=zone.receiveShadow=false;
  }
 }
 iconTacknanControls(THREE,s,h+.00015);
 const chassis=iconKitchenOutline(new THREE.Shape(),cx-.3725,(d-.487)/2,.745,.487,.004);
 chassis.holes.push(iconKitchenOutline(new THREE.Path(),cx-.041,.103,.082,.370,.008));
 s.add('chassis',new THREE.ExtrudeGeometry(chassis,{depth:.045,bevelEnabled:false,curveSegments:4}),p.black,0,0,h-.049);
 s.cushion('blower',cx,d/2,h-.1495,.43,.435,.201,.028,iron);
}

function iconWorktopUV(THREE,geometry,base,height,fold){
 const {position,normal,uv}=geometry.attributes;
 const bandDistance=new Float32Array(position.count);
 const sampleDepth=1.05,sampleLength=sampleDepth*1642/1528;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),drop=height-base-position.getZ(i);
  const nx=normal.getX(i),ny=normal.getY(i);
  let u=x+nx*drop,v=y+ny*drop;
  const edge=Math.abs(ny)>.99;
  if(fold && edge){
   // Continue the waterfall grain around the narrow front and rear returns.
   u=fold.outerX+fold.direction*drop;
   v=y+ny*Math.abs(x-fold.outerX);
  }
  uv.setXY(i,u/sampleLength,v/sampleDepth);
  bandDistance[i]=edge?(fold?Math.abs(x-fold.outerX):drop):1;
 }
 geometry.setAttribute('bandDistance',new THREE.BufferAttribute(bandDistance,1));
}

function iconIslandWorktop({THREE},frame,s,p,laminate,cutout) {
 const {width:w,depth:d,item}=frame,{height,socket}=item,thick=.038,base=height-thick;
 const shape=(outline,holes=[])=>{
  const profile=iconKitchenOutline(new THREE.Shape(),...outline);
  for(const hole of holes)profile.holes.push(iconKitchenOutline(new THREE.Path(),...hole));
  return profile;
 };
 const extrude=(profile,depth)=>new THREE.ExtrudeGeometry(profile,{depth,bevelEnabled:false,curveSegments:6});
 const slab=extrude(shape([0,0,w,d],[cutout]),thick);
 iconWorktopUV(THREE,slab,base,height);s.add('top',slab,laminate,0,0,base);
 const right=extrude(shape([w-thick,0,thick,d]),base);
 iconWorktopUV(THREE,right,0,height,{outerX:w,direction:1});s.add('waterfall-right',right,laminate,0,0,0);

 // On the window end the profile axes are depth and height; extrusion goes into the island.
 const endPlane=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0));
 const [cy,cz]=socket.centerYZ,[width,h]=socket.size,opening=[cy-width/2,cz-h/2,width,h,.004];
 const left=extrude(shape([0,0,d,base],[opening]),thick).applyMatrix4(endPlane);
 iconWorktopUV(THREE,left,0,height,{outerX:0,direction:-1});s.add('waterfall-left',left,laminate,0,0,0);

 const black=new THREE.MeshStandardMaterial({name:'Matte black recessed socket cover',color:'#232323',metalness:.38,roughness:.52});
 const well=shape([-.5*width,-.5*h,width,h,.004],[[-width/2+.009,-h/2+.009,width-.018,h-.018,.003]]);
 const sidePart=(name,profile,x,thickness,material)=>
  s.add('socket-'+name,extrude(profile,thickness).applyMatrix4(endPlane),material,x,cy,cz);
 const bezel=sidePart('bezel',well,0,.021,black);
 sidePart('housing',shape([-width/2,-h/2,width,h]),.052,.009,p.black);
 const insert=shape([-width/2+.009,-h/2+.009,width-.018,h-.018]);
 const circle=(u,v,r)=>new THREE.Path().absarc(u,v,r,0,2*Math.PI,true);
 for(const u of [-.06,.06]){
  insert.holes.push(circle(u,0,.024));
  const outlet=new THREE.Shape();outlet.absarc(u,0,.024,0,2*Math.PI,false);
  for(const offset of [-.0095,.0095])outlet.holes.push(circle(u+offset,0,.0027));
  sidePart('outlet-'+u,outlet,.037,.003,black);
  const pin=new THREE.CylinderGeometry(.0023,.0023,.010,10).rotateZ(Math.PI/2);
  s.add('socket-earth-'+u,pin,p.silver,.032,cy+u,cz+.010);
 }
 sidePart('face',insert,.021,.016,p.black);
 const lidHeight=h-.022,hingeZ=cz+lidHeight/2;
 const flap=extrude(shape([-width/2+.011,-lidHeight,width-.022,lidHeight,.002]),.0025).applyMatrix4(endPlane);
 const lid=s.add('socket-lid',flap,black,.0008,cy,hingeZ);
 frame.socketCover={roots:[lid,bezel],canOpen:()=>true,pose(fraction){lid.rotation.y=1.82*fraction;}};
}

function iconKitchenIslandVeneer({THREE,mesh},frame) {
 const {width:w,depth:d,item,part}=frame;
 const x0=.038,x1=w-.038,y=d-.018,bottom=.018,top=item.height-.038;
 const core=new THREE.MeshStandardMaterial({name:'Slate veneer joint',color:'#455158',roughness:.78});
 part('veneer-backing-salon',[x0,y-.024,x1,y-.002],bottom,top-bottom,core);
 const vertices=[],uv=[],indices=[],count=6,gap=.002;
 for(let panel=0;panel<count;panel++){
  const left=x0+(x1-x0)*panel/count+(panel?gap/2:0);
  const right=x0+(x1-x0)*(panel+1)/count-(panel<count-1?gap/2:0);
  const base=vertices.length/3;
  for(const [x,z] of [[left,bottom],[left,top],[right,top],[right,bottom]]){
   vertices.push(...frame.point(x,y,z));
   uv.push((x-x0)/(x1-x0),(z-bottom)/(top-bottom));
  }
  indices.push(base,base+1,base+2,base,base+2,base+3);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 mesh(geometry,iconIslandVeneer(THREE),item.id+'-figured-veneer-salon');
}

function iconNyttig({THREE},frame,s,p,x,front,hobRear) {
 const {part,item}=frame,grilleWidth=.46,grilleHeight=.077,z=.032,ductWidth=.22,ductDepth=.055;
 const rear=front+.4867,axis=rear-ductDepth/2,elbow=item.height-.238;
 const shell=new THREE.MeshStandardMaterial({name:'NYTTIG charcoal duct',color:'#303335',roughness:.66,side:THREE.DoubleSide});
 const white=shell.clone();white.name='NYTTIG white riser';white.color.set('#deded9');
 const edge=new THREE.MeshStandardMaterial({name:'NYTTIG satin grille',color:'#989b99',metalness:.55,roughness:.44});
 const duct=(name,sections,mat)=>{
  const vertices=[],indices=[];
  for(const [y,h,width,depth,angle] of sections){
   for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]])
    vertices.push(u*width/2,y-v*depth/2*Math.sin(angle),h+v*depth/2*Math.cos(angle));
  }
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){
   const a=i*4+j,b=i*4+(j+1)%4;indices.push(a,b+4,b,a,a+4,b+4);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);g.computeVertexNormals();return s.add('nyttig-'+name,g,mat,x,0,0);
 };
 const riserBase=[axis,z+.102,ductWidth,ductDepth,Math.PI/2],riserTop=[axis,elbow-.13,ductWidth,ductDepth,Math.PI/2];
 duct('plinth-duct',[[front,z+grilleHeight/2,.454,.073,0],[front+.14,z+.036,.28,.060,0],
    [axis-.058,z+.036,ductWidth,ductDepth,0],[axis-.016,z+.052,ductWidth,ductDepth,Math.PI/4],riserBase],shell);
 duct('riser',[riserBase,riserTop],white);
 duct('coupling',[riserTop,[axis,elbow-.065,ductWidth,ductDepth,Math.PI/2],
    [axis-.019,elbow-.023,ductWidth,ductDepth,Math.PI*.75],[hobRear-.115,elbow,ductWidth,ductDepth,Math.PI]],shell);
 const opening=[x-grilleWidth/2,front,x+grilleWidth/2,front+.016];
 part('plinth-under-outlet',opening,.014,z-.014,p.shadow);
 part('plinth-over-outlet',opening,z+grilleHeight,.118-z-grilleHeight,p.shadow);
 const rim=iconKitchenOutline(new THREE.Shape(),-grilleWidth/2,0,grilleWidth,grilleHeight,.005);
 for(let col=0;col<9;col++)for(let row=0;row<4;row++)
  rim.holes.push(iconKitchenOutline(new THREE.Path(),-.211+col*.0475,.009+row*.015,.042,.010,.002));
 const metal=new THREE.ExtrudeGeometry(rim,{depth:.003,bevelEnabled:false,curveSegments:3});metal.rotateX(Math.PI/2);
 s.add('nyttig-outlet',metal,edge,x,front,z);
}

function iconSinkPullout(context,frame,s,k,face,left,right,sink) {
 const {part,item}=frame,p=iconLivingPalette(context),centre=(left+right)/2;
 const back=.056,front=face-.021,notch=.383,halfNotch=.085,wall=.012,floor=.165;
 const drain=sink.box[1]-item.box[1]+.204,wasteTop=item.height-.200;
 s.tube('sink-waste-trap',[[centre,drain,wasteTop],[centre,drain,.413],[centre,drain-.033,.364],
  [centre,drain-.075,.375],[centre,drain-.101,.433],[centre,drain-.138,.451],[centre,.018,.451]],.021,p.putty);
 s.disc('sink-waste-coupling',centre,drain,wasteTop-.030,.042,.042,.030,p.putty);
 const moving=[],runners=[],tray=(id,l,b,r,f,z,h,mat=p.ash)=>moving.push(part('sink-tray-'+id,[l,b,r,f],z,h,mat));
 const l=left+.027,r=right-.027;
 tray('floor-front',l,notch,r,front,floor,wall);
 tray('notch-front',centre-halfNotch,notch,centre+halfNotch,notch+wall,floor+wall,.215);
 for(const [side,sign,edge,seam] of [['left',1,l,left+.009],['right',-1,r,right-.009]]){
  const span=(a,b)=>[Math.min(a,b),Math.max(a,b)];
  const [a,b]=span(edge,centre-sign*halfNotch);
  tray('floor-'+side,a,back,b,notch,floor,wall);
  tray('back-'+side,a,back,b,back+wall,floor+wall,.215);
  const [outer,inner]=span(edge,edge+sign*wall),[n0,n1]=span(centre-sign*halfNotch,centre-sign*(halfNotch+wall));
  tray('side-'+side,outer,back+wall,inner,front,floor+wall,.295);
  tray('notch-'+side,n0,back+wall,n1,notch,floor+wall,.215);
  for(const [i,[inset,width,height]] of [[0,.006,.048],[.006,.006,.034],[.012,.006,.022]].entries()){
   const [u,v]=span(seam+sign*inset,seam+sign*(inset+width));
   const member=part('sink-slide-'+side+'-'+i,[u,back,v,front-.006],floor+.044-height/2,height,p.silver);
   if(i===1)runners.push(member);
   if(i===2)moving.push(member);
  }
 }
 const first=context.group.children.length;
 iconKitchenDrawers(frame,k,left,right,1,face,2);
 moving.push(...context.group.children.slice(first));
 frame.pullouts=[{name:'kitchen-sink-pullout',travel:.45,bottom:.122,top:.895,moving,runners,box:[item.box[0]+left,item.box[1]+face-.021,item.box[0]+right,item.box[1]+face+.021]}];
}

function iconDishwasher(context,frame,k,left,right,face,sink) {
 const {part,item}=frame,p=iconLivingPalette(context),mid=(left+right)/2+.009;
 const back=.031,front=face-.047,bottom=.146,top=.894;
 const plate=(name,l,b,r,f,z,h,m=p.silver)=>part('dishwasher-'+name,[l,b,r,f],z,h,m);
 plate('back',mid-.298,back,mid+.298,back+.020,bottom,top-bottom);
 plate('sump',mid-.298,back+.02,mid+.298,front,bottom,.055);
 plate('ceiling',mid-.298,back+.02,mid+.298,front,top-.020,.020);
 plate('toe-kick',mid-.298,face-.072,mid+.298,face-.064,.014,.104,p.shadow);
 plate('spray-arm',mid-.205,back+.225,mid+.205,back+.247,.216,.013,p.black);
 for(const sign of [-1,1]){
  const x=mid+sign*.290;
  plate('side-'+sign,x-.008,back+.02,x+.008,front,bottom+.055,top-bottom-.075);
  for(const y of [.07,front-.07])plate('foot',x-.007,y-.015,x+.007,y+.015,.006,bottom-.006,p.black);
 }
 for(const [i,h] of [.255,.552].entries()){
  for(let j=-5;j<=5;j++){
   const x=mid+j*.049;
   frame.line('dishwasher-rack-'+i+'-bar-'+j,[x,back+.044,h],[x,front-.014,h],.003,p.silver);
  }
  for(const [j,y] of [back+.044,back+.18,back+.31,front-.014].entries()){
   frame.line('dishwasher-rack-'+i+'-cross-'+j,[mid-.26,y,h+.006],[mid+.26,y,h+.006],.004,p.silver);
   for(const sign of [-1,1])frame.line('dishwasher-rack-'+i+'-upright',[mid+sign*.26,y,h+.006],[mid+sign*.26,y,h+.095],.004,p.silver);
  }
  for(const y of [back+.17,back+.31])for(let tine=-3;tine<=3;tine++){
   const x=mid+tine*.050;
   frame.line('dishwasher-rack-'+i+'-tine',[x,y,h+.006],[x,y+.022,h+.096],.0025,p.silver);
  }
  for(const sign of [-1,1])frame.line('dishwasher-rack-'+i+'-rim',[mid+sign*.26,back+.044,h+.095],[mid+sign*.26,front-.014,h+.095],.005,p.silver);
 }
 for(const [tag,x,z,mat] of [['inlet',left+.15,.16,p.silver],['outlet',left+.21,.19,p.putty],['power-inlet',left+.30,.18,p.black]])
  plate(tag,x-.011,.020,x+.011,back,z-.011,.022,mat);
 const trapX=(sink.box[0]+sink.box[2])/2-item.box[0],trapY=sink.box[1]-item.box[1]+.204;
 frame.line('dishwasher-trap-spigot',[trapX+.05,trapY,.645],[trapX,trapY,.60],.014,p.putty);
 plate('isolation-valve',left-.17,.018,left-.13,.046,.538,.024,p.silver);
 plate('socket',right+.09,.018,right+.17,.032,.51,.08,p.chalk);
 plate('plug',right+.111,.032,right+.149,.050,.53,.04,p.black);
 const start=context.group.children.length;
 iconKitchenPanel(frame,'dishwasher-front',left+.0025,right-.0025,.122,.895,face,k.yellow);
 iconKitchenGrip(frame,'dishwasher-grip',(left+right)/2,face,.882,.145,false,k.bronze);
 plate('door-liner',mid-.275,front,mid+.275,face-.021,.151,.732);
 plate('detergent-lid',mid-.17,front-.012,mid-.05,front,.629,.07,p.black);
 plate('control-strip',mid-.24,front+.002,mid+.24,face-.024,.883,.007,p.black);
 frame.dishwasher={door:context.group.children.slice(start),hinge:frame.point(mid,face,.122),
  left:item.box[0]+left,right:item.box[0]+right};
}

function iconMountDishwasher(context,{door,hinge,left,right}) {
 const {THREE,group,world,navigation,obstacle}=context,pivot=new THREE.Group(),mount=new THREE.Group();
 pivot.name='kitchen-dishwasher-door';pivot.position.set(...hinge);pivot.userData.dynamic=true;
 mount.position.copy(pivot.position).multiplyScalar(-1);
 group.add(pivot);pivot.add(mount);mount.add(...door);
 const [,y,z]=hinge,reach=.895-z,eye=new THREE.Vector3();
 obstacle(pivot.name,[left,y-.047,right,y+.021],z,.895);
 const ring=navigation.obstacles.at(-1).ring;
 const clearance=new THREE.Box3(new THREE.Vector3(left,y,z-.025),new THREE.Vector3(right,y+reach,.895));
 return {roots:[pivot],clearance,dishwasher:true,
  canOpen(camera){
   if(!camera.isPerspectiveCamera)return true;
   group.worldToLocal(camera.getWorldPosition(eye));
   return eye.z<0||eye.z>2.6||Math.hypot(eye.x-THREE.MathUtils.clamp(eye.x,left,right),eye.y-THREE.MathUtils.clamp(eye.y,y,y+reach))>.28;
  },
  pose(fraction,opening){
   pivot.rotation.x=-Math.PI/2*fraction;
   const front=y+Math.max(.021,reach*(opening?1:Math.sin(-pivot.rotation.x)));
   for(const [i,x] of [[2,right],[3,left]])ring[i]=world([x,front]).slice(0,2);
  }
 };
}

function iconKitchenBackCounter(context,frame,s,k,face) {
 const {THREE,data}=context;
 const {width:w,depth:d,item,part}=frame,h=item.height;
 for(const x of [0,w-.018])part('cabinet-end-'+x,[x,.018,x+.018,face-.021],.136,h-.186,k.yellow);
 const outline=new THREE.Shape();
 outline.moveTo(0,0);outline.lineTo(w,0);outline.lineTo(w,d);outline.lineTo(0,d);outline.closePath();
 const sink=data.furniture.find(unit=>unit.id==='kitchen-sink'&&unit.support===item.id);
 const centre=sink?(sink.box[0]+sink.box[2])/2-item.box[0]:w/2;
 const bayWidth=sink?sink.baseCabinetWidthM??.80:w/5,left=centre-bayWidth/2,right=centre+bayWidth/2;
 const end=(right+w)/2;
 for(const [i,[a,b]] of [[0,right+.009],[end+.009,w]].entries()){
  part(i?'body-end':'body',[a,0,b,.018],.118,h-.168,k.yellow);
  part('cabinet-floor-'+i,[a,.018,b,face-.021],.118,.018,k.yellow);
  part('recessed-plinth-'+i,[Math.max(a,.064),.049,Math.min(b,w-.064),face-.064],.014,.104,iconLivingPalette(context).shadow);
 }
 for(const [i,seam] of [left/2,left,right,end+.018].entries())
  part('cabinet-divider-'+i,[seam-.009,.018,seam+.009,face-.021],.136,h-.186,k.yellow);
 iconKitchenDrawers(frame,k,0,left,2,face);
 if(sink)iconSinkPullout(context,frame,s,k,face,left,right,sink);
 else iconKitchenDrawers(frame,k,left,right,1,face,2);
 if(sink)iconDishwasher(context,frame,k,right,end,face,sink);
 else iconKitchenDrawers(frame,k,right,end,1,face,3);
 iconKitchenDrawers(frame,k,end,w,1,face,4);
 if(sink){
  const [l,b,r,f]=sink.box.map((n,i)=>n-item.box[i%2]);
  outline.holes.push(iconKitchenOutline(new THREE.Path(),l+.009,b+.009,r-l-.018,f-b-.018,.024));
 }
 const slab=new THREE.ExtrudeGeometry(outline,{depth:.05,bevelEnabled:false,curveSegments:8});
 iconWorktopUV(THREE,slab,h-.05,h);
 s.add('top',slab,k.laminate,0,0,h-.05);
}

function iconKitchenSink({THREE},frame,s,p) {
 const {width:w,depth:d}=frame,x=w/2,drainY=.204,z=-.198;
 const basin=new THREE.MeshStandardMaterial({name:'Matte black composite sink',color:'#252628',roughness:.65,side:THREE.DoubleSide});
 const steel=new THREE.MeshStandardMaterial({name:'Brushed silver stainless steel',color:'#d1d3d5',metalness:.56,roughness:.29});
 const vertices=[],indices=[],steps=128;
 const ring=(outline,h)=>outline.getSpacedPoints(steps).slice(0,-1).map(q=>[q.x,q.y,h]);
 const rings=[
  [0,0,w,d,.032,.001],[0,0,w,d,.032,.004],[.004,.004,w-.004,d-.004,.029,.005],
  [.019,.079,w-.019,d-.018,.044,.005],[.023,.083,w-.023,d-.022,.044,.001],
  [.028,.088,w-.028,d-.027,.044,-.009],[.040,.100,w-.040,d-.039,.055,-.150],
  [.046,.106,w-.046,d-.045,.058,-.168],[.063,.123,w-.063,d-.062,.065,-.180]
 ].map(([l,b,r,f,radius,h])=>ring(iconKitchenOutline(new THREE.Path(),l,b,r-l,f-b,radius),h));
 const edge=rings.at(-1);
 rings.push(edge.map(([u,v])=>{
  const a=Math.atan2(v-drainY,u-x);
  return [x+.045*Math.cos(a),drainY+.045*Math.sin(a),z];
 }));
 for(const [j,points] of rings.entries())for(let i=0;i<steps;i++){
  vertices.push(...points[i]);
  if(j){const a=(j-1)*steps+i,b=(j-1)*steps+(i+1)%steps;indices.push(a,b,b+steps,a,b+steps,a+steps);}
 }
 const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 shell.setIndex(indices);shell.computeVertexNormals();s.add('basin',shell,basin,0,0,0);
 s.disc('waste-recess',x,drainY,z-.003,.0455,.0455,.002,p.black);
 s.add('waste-rim',new THREE.RingGeometry(.034,.047,64),steel,x,drainY,z+.0008);
 const basket=new THREE.Shape();basket.absarc(0,0,.034,0,2*Math.PI,false);
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,hole=new THREE.Path();
  hole.absellipse(.023*Math.cos(angle),.023*Math.sin(angle),.007,.0024,0,2*Math.PI,true,angle);basket.holes.push(hole);
 }
 s.add('basket-strainer',new THREE.ShapeGeometry(basket,7),steel,x,drainY,z-.0005);
 s.disc('basket-pin',x,drainY,z-.0005,.009,.009,.005,steel);
 s.disc('tap-foot',x,.043,.005,.027,.027,.009,steel);
 s.tube('arched-spout',[[x,.043,.014],[x,.043,.19],[x,.050,.257],[x,.086,.300],[x,.141,.303],[x,.188,.273],[x,.207,.213]],.012,steel);
 s.disc('tap-aerator',x,.207,.207,.013,.013,.009,steel);
 s.tube('mixer-lever',[[x+.010,.043,.073],[x+.036,.043,.073],[x+.042,.041,.084],[x+.042,.045,.133]],.005,steel);
}

function iconLivingKitchen(context,frame,s,p) {
 const {item,width:w,depth:d,part}=frame;
 if(item.id==='kitchen-sink'){
  iconKitchenSink(context,frame,s,p);return;
 }
 if(item.id==='hob'){iconTacknan(context,frame,s,p);return;}
 const k=context.kitchenFinishes??=iconKitchenFinishes(context);
 if(item.id==='kitchen-pantry'){iconKitchenPantry(context,frame,k);return;}
 const island=item.id==='kitchen-island',tall=item.id==='kitchen-tall',height=item.height;
 const face=d-.065;
 if(tall)part('recessed-plinth',[.064,.049,w-.064,(tall?d-.035:face)-.064],.014,.105,p.shadow);
 if(tall){iconSamsungTower(context,frame,k,d-.035);return;}
 if(island){
  const hob=context.data.furniture.find(unit=>unit.id==='hob');
  const cx=(hob.box[0]+hob.box[2])/2-item.box[0],cy=(hob.box[1]+hob.box[3])/2-item.box[1];
  const [cw,cd]=hob.cutout;
  iconIslandWorktop(context,frame,s,p,k.laminate,[cx-cw/2,cy-cd/2,cw,cd]);
  iconKitchenIslandVeneer(context,frame);
  iconIslandCabinets(context,frame,s,p,k,cx,cy,hob);
 }else{
  iconKitchenBackCounter(context,frame,s,k,face);
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
 const appleY=hub.y+.31,appleZ=2.674;
 box('projector-apple-tv-bracket',[wallX-.006,appleY-.053,wallX,appleY+.053],appleZ-.050,.100,p.black);
 box('projector-apple-tv-cradle',[wallX-.041,appleY-.050,wallX-.006,appleY+.050],appleZ-.0525,.006,p.black);
 const av=iconLivingShapes(context,{item:{id:'projector',facing:'+y'},point:(x,y,z)=>[wallX+x,appleY+y,appleZ+z]});
 av.cushion('apple-tv-4k',-.0215,0,0,.031,.093,.093,.010,p.black);
 av.cushion('apple-tv-indicator',-.0372,-.029,-.020,.0008,.002,.002,.0003,context.mats.lamp);
 av.tube('apple-tv-hdmi',[[-.023,-.046,.011],[-.028,-.069,.011],[-.041,-.105,-.008],[-.075,-.153,-.017],
  [hub.x+.16-wallX,-.210,hub.z-appleZ-.025]],.0028,p.black);
 av.tube('apple-tv-power',[[-.019,.045,.015],[-.018,.058,.017],[-.012,.071,.020],[0,.077,.018]],.0025,p.black);
 obstacle('projector-overhead',[lens.x-.01,hub.y-.232,wallX,appleY+.079],2.48,2.792);
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

function iconMountPullout(context,{name,moving,runners,box,travel,bottom,top}) {
 const {THREE,group,world,navigation,obstacle}=context,bodyRadius=.28;
 const drawer=new THREE.Group(),slides=new THREE.Group();
 drawer.name=name;slides.name=name.replace('pullout','telescoping-slides');
 group.add(drawer,slides);drawer.add(...moving);slides.add(...runners);
 obstacle(drawer.name,box,bottom,top);
 const leadingEdge=travel<0?[0,1]:[2,3];
 const ring=navigation.obstacles.at(-1).ring,closed=ring.map(p=>p.slice());
 const a=world([0,0]),b=world([0,travel]),dx=b[0]-a[0],dy=b[1]-a[1],eye=new THREE.Vector3();
 const clearance=new THREE.Box3(new THREE.Vector3(box[0],box[1]+Math.min(0,travel),bottom),new THREE.Vector3(box[2],box[3]+Math.max(0,travel),top));
 return {roots:[drawer,slides],clearance,
  canOpen(camera){
   if(!camera.isPerspectiveCamera)return true;
   group.worldToLocal(camera.getWorldPosition(eye));
   const x=THREE.MathUtils.clamp(eye.x,box[0],box[2]),y=THREE.MathUtils.clamp(eye.y,box[1]+Math.min(0,travel),box[3]+Math.max(0,travel));
   return eye.z<0||eye.z>2.6||Math.hypot(eye.x-x,eye.y-y)>bodyRadius;
  },
  pose(fraction,opening){
   drawer.position.y=travel*fraction;slides.position.y=drawer.position.y/2;
   // Reserve the remaining opening stroke so a walker cannot enter it during the animation.
   const reach=opening?1:fraction;
   for(const i of leadingEdge){ring[i][0]=closed[i][0]+dx*reach;ring[i][1]=closed[i][1]+dy*reach;}
  }};
}

function iconApplianceControls(context) {
 const parts=new Map(),motions=[];
 function add(mechanism){
  const state={...mechanism,open:false,start:0,from:0,fraction:0,moving:false};
  motions.push(state);
  for(const root of state.roots)parts.set(root,state);
 }
 if(context.socketCover)add(context.socketCover);
 if(context.dishwasher)add(context.dishwasher);
 for(const pullout of context.pullouts??[])add(pullout);
 for(const id of ['fridge','freezer']){
  const pivot=context.group.getObjectByName('kitchen-'+id+'-door');
  if(!pivot)continue;
  const body=context.group.getObjectByName('kitchen-'+id+'-body');
  body.visible=false;
  add({roots:[pivot,body],canOpen:(_camera,part)=>part===pivot,pose(fraction,opening){
   pivot.rotation.z=pivot.userData.openYaw*fraction;
   body.visible=opening||fraction>0;
  }});
 }
 const pick=iconVisiblePick(context,[...parts.keys()]);
 function update(now){
  let moving=false;
  for(const state of motions){
   if(!state.moving)continue;
   const t=Math.min(1,(now-state.start)/340);
   state.fraction=state.from+(Number(state.open)-state.from)*t*t*(3-2*t);
   state.pose(state.fraction,state.open);
   state.moving=t<1;
   moving||=state.moving;
  }
  return moving;
 }
 function toggleAt(ndc,camera){
  const part=pick(ndc,camera),state=parts.get(part);
  if(!state||(!state.open&&!state.canOpen(camera,part)))return false;
  if(!state.open&&state.clearance&&motions.some(other=>other!==state&&(state.dishwasher||other.dishwasher)
   &&(other.open||other.fraction>0)&&other.clearance?.intersectsBox(state.clearance)))return false;
  const now=performance.now();
  update(now);
  state.open=!state.open;
  state.from=state.fraction;
  state.pose(state.fraction,state.open);
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

function iconHeadboardWings(context,frame,s,p) {
 const {item,width:w,depth:d}=frame;
 const bed=context.data.furniture.find(f=>f.id===item.support);
 const wing=(w-(bed.box[2]-bed.box[0]))/2;
 const panelWidth=wing-.002;
 for(const [i,u] of [panelWidth/2,w-panelWidth/2].entries())
  s.cushion('panel-'+i,u,d/2,item.height/2,panelWidth,d,item.height,.025,p.headcloth);
}

function iconBedFootPouf(frame,s,p) {
 const {width:w,depth:d,item}=frame,h=item.height;
 s.cushion('recessed-foot',w/2,d/2,.032,w-.12,d-.10,.064,.029,p.taupe);
 s.cushion('upholstered-base',w/2,d/2,.16,w-.024,d-.024,.24,.09,p.olive);
 s.cushion('seat',w/2,d/2,h-.065,w,d,.13,.061,p.olive);
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

function iconPrivateVanity(context,frame,s,finish) {
 const {THREE}=context,{width:w,depth:d,line,part,mats}=frame;
 const top=.865,u=w/2,v=d*.555,rx=w*.365,ry=d*.325;
 part('vanity',[0,0,w,d-.052],.215,.020,finish.custard);
 for(const edge of [0,w-.018])part('cheek-'+edge,[edge,0,edge+.018,d-.052],.235,top-.262,finish.custard);
 part('back',[.018,0,w-.018,.017],.235,top-.262,finish.custard);
 for(let i=0;i<2;i++){
  const h=.215+i*.31;
  s.cushion('drawer-'+i,u,d-.037,h+.15,w-.008,.028,.30,.008,finish.custard);
  s.tube('drawer-pull-'+i,[[u-.083,d-.023,h+.186],[u-.076,d-.015,h+.177],
   [u+.076,d-.015,h+.177],[u+.083,d-.023,h+.186]],.005,finish.espresso);
 }
 const slab=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(w,0),new THREE.Vector2(w,d),new THREE.Vector2(0,d)]);
 const cut=new THREE.Path();cut.absellipse(u,v,rx,ry,0,2*Math.PI,true);
 slab.holes.push(cut);
 const stone=new THREE.ExtrudeGeometry(slab,{depth:.027,bevelEnabled:false,curveSegments:32});
 s.add('counter',stone,finish.breccia,0,0,top-.027);
 const profile=[[1.014,-.004],[1.014,.002],[.985,.004],[.957,-.002],[.88,-.051],[.67,-.106],[.24,-.136],[.055,-.139]];
 iconUpperCeramic(s,THREE,'bowl',u,v,top,rx,ry,profile,mats.white);
 s.disc('drain',u,v,top-.140,.019,.019,.004,finish.chrome);
 s.tube('tap',[[u,.054,top],[u,.054,1.02],[u,.063,1.036],[u,.14,1.036],[u,.15,1.019]],.011,finish.chrome);
 s.disc('tap-collar',u,.054,top,.024,.024,.008,finish.chrome);
 line('tap-lever',[u+.013,.054,.993],[u+.046,.054,1.041],.006,finish.chrome);
}

function iconUpperSanitary(context,frame,s,p) {
 const {THREE,ceilingAt}=context,{item,width:w,depth:d,part,line,point,mats}=frame;
 const family=item.room==='1.2',finish=iconUpperBathPalette(context),metal=family?finish.nickel:finish.chrome;
 const ceramic=(name,u,v,z,rx,ry,profile)=>iconUpperCeramic(s,THREE,name,u,v,z,rx,ry,profile,mats.white);
 if(item.type==='sink'&&!family)return iconPrivateVanity(context,frame,s,finish);
 if(item.type==='sink'){
  const front=finish.honey;
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
   shape.absellipse(0,height/2,r,height/2,0,2*Math.PI,false);
   const g=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,curveSegments:24});
   const xy=g.attributes.position,uv=g.attributes.uv;
   for(let i=0;i<uv.count;i++)uv.setXY(i,xy.getX(i)/width+.5,xy.getY(i)/height);
   g.rotateX(Math.PI/2);
   s.add(name,g,material,w/2,v,1.115+(name==='mirror'?.008:0));
  };
  const width=w*.91,height=mirrorTop-1.115;
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
  part('screen',[w-.035,.024,w-.023,d-.019],.066,maxHeight-.066,family?mats.glass:finish.sageGlass).castShadow=false;
  for(const v of [.025,d-.025])line('glazing-stile-'+v,[w-.029,v,.065],[w-.029,v,maxHeight],family?.011:.017,family?p.black:finish.sage);
  if(!family)for(const z of [.072,maxHeight-.01])part('screen-channel-'+z,[w-.045,.019,w-.012,d-.018],z-.009,.018,finish.sage);
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
 else if(item.type==='headboard-wings')iconHeadboardWings(context,frame,s,p);
 else if(item.type==='ottoman')iconBedFootPouf(frame,s,p);
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
 if(frame.item.type==='rug' && context.data.textiles?.[frame.item.id])return iconPhotoRug(context,frame);
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
  if(frame.dishwasher)context.dishwasher=iconMountDishwasher(context,frame.dishwasher);
  if(frame.socketCover){
   context.socketCover=frame.socketCover;
   for(const root of frame.socketCover.roots)root.userData.dynamic=true;
  }
  for(const pullout of frame.pullouts??[])
   (context.pullouts??=[]).push(iconMountPullout(context,pullout));
 }
}

function iconPlantFoliage(THREE) {
 const xyz=[],colors=[],indices=[],vec=(x,y,z)=>new THREE.Vector3(x,y,z);
 function vertex(p,c,brightness=1) {
  xyz.push(p.x,p.y,p.z);colors.push(c.r*brightness,c.g*brightness,c.b*brightness);
 }
 function stem(points,radius,color){
  const first=xyz.length/3;
  for(const [j,p] of points.entries()){
   const tangent=points[Math.min(j+1,points.length-1)].clone().sub(points[Math.max(0,j-1)]).normalize();
   const side=vec(1,0,0).cross(tangent).normalize(),across=side.clone().cross(tangent);
   for(let k=0;k<5;k++){
    const a=k*2*Math.PI/5,r=radius*(1-.75*j/(points.length-1));
    vertex(p.clone().addScaledVector(side,r*Math.cos(a)).addScaledVector(across,r*Math.sin(a)),color);
    if(j){const n=first+j*5+k,next=first+j*5+(k+1)%5;indices.push(n-5,n,next,n-5,next,next-5);}
   }
  }
 }
 function blade(at,side,halfWidth,color,{rows=5,mark=()=>1}={}){
  const first=xyz.length/3;
  for(let j=0;j<=rows;j++){
   const t=j/rows,center=at(t),w=halfWidth*Math.sin(Math.PI*t)**.78;
   for(const [i,f] of [-1,-.13,0,.13,1].entries()){
    const p=center.clone().addScaledVector(side,f*w);
    p.z+=w*(1-Math.abs(f))*.25;
    vertex(p,color,mark(j,i)*(i===2?1.22:i<2?.84:1));
    if(j&&i){const n=first+j*5+i;indices.push(n-6,n-1,n,n-6,n,n-5);}
   }
  }
 }
 const finish=()=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
  return g;
 };
 return {stem,blade,finish};
}

function iconParlourPalm(THREE,foliage,z) {
 const vector=(x,y,h)=>new THREE.Vector3(x,y,h),tau=Math.PI*2;
 const stemColor=new THREE.Color('#718350'),leafColors=['#466744','#4d7146','#608049','#64884f','#527949'].map(c=>new THREE.Color(c));
 for(let cane=0;cane<5;cane++){
  const angle=cane*2.4,base=vector(.080*Math.cos(angle),.080*Math.sin(angle),z-.035);
  const crown=vector(base.x*1.65,base.y*1.65,z+.64+.43*(.5+.5*Math.sin(cane*2.05)));
  foliage.stem([base,base.clone().lerp(crown,.55),crown],.011,stemColor);
  for(let frond=0;frond<4;frond++){
   const turn=angle+frond*tau/4+.24*Math.cos(frond+cane);
   const axis=vector(Math.cos(turn),Math.sin(turn),0),side=vector(-axis.y,axis.x,0);
   const span=.41+.09*Math.sin(frond*1.5+cane),rise=.20+.055*frond;
   const at=t=>crown.clone().addScaledVector(axis,span*t).add(vector(0,0,rise*Math.sin(Math.PI*t*.91)+(.13-.07*frond)*t));
   foliage.stem(Array.from({length:9},(_,i)=>at(i/8)),.005,stemColor);
   for(let pair=0;pair<9;pair++)for(const hand of [-1,1]){
    const t=.14+pair*.090+.012*hand,root=at(t),length=.075+.103*Math.sin(t*Math.PI);
    const direction=side.clone().multiplyScalar(hand).addScaledVector(axis,.45+t*.5).normalize();
    const width=vector(-direction.y,direction.x,0);
    foliage.blade(q=>root.clone().addScaledVector(direction,q*length)
     .add(vector(0,0,.022*Math.sin(Math.PI*q)-(.033+.058*t)*q*q)),width,.0105,leafColors[(pair+cane+frond)%5],{rows:3});
   }
   foliage.blade(t=>at(.92+.08*t).addScaledVector(axis,t*.073),side,.011,leafColors[cane],{rows:3});
  }
 }
}

function iconRosettePlant(THREE,foliage,z,aspidistra) {
 const count=aspidistra?13:15,colors=(aspidistra?['#385c43','#557451','#476d48']:['#476447','#718553','#596e4d']).map(c=>new THREE.Color(c));
 for(let i=0;i<count;i++){
  const a=i*2.400,dx=Math.cos(a),dy=Math.sin(a),side=new THREE.Vector3(-dy,dx,0);
  const vigor=.5+.5*Math.cos(i*1.54),reach=aspidistra?.105+.037*vigor:.17+.10*vigor;
  const h=aspidistra?.16+.13*vigor:(.15+.13*vigor)*.77;
  const spread=aspidistra?.035:.050,start=new THREE.Vector3(dx*spread,dy*spread,z-.018);
  const leafBase=start.clone().add(new THREE.Vector3(dx*reach*.42,dy*reach*.42,h));
  foliage.stem([start,leafBase],.0035,colors[0]);
  const rise=aspidistra?.17+.11*vigor:.035-.09*vigor;
  const at=t=>new THREE.Vector3(leafBase.x+dx*reach*t,leafBase.y+dy*reach*t,leafBase.z+.085*Math.sin(t*Math.PI)+rise*t);
  foliage.blade(at,side,aspidistra?.038+.010*vigor:.061+.014*vigor,colors[i%3],{rows:10,
   mark:(row,col)=>aspidistra?(col===2?1.1:1):(col!==2&&(row+(col===0||col===4?1:0))%3===0?.64:1)});
 }
}

function iconFlowerRosette(THREE,foliage,z,orchid) {
 const color=new THREE.Color(orchid?'#41694d':'#507451'),count=orchid?6:13;
 for(let i=0;i<count;i++){
  const a=orchid?(i%2?Math.PI:0)+.58+(i%3)*.24:i*2.40;
  const along=new THREE.Vector3(Math.cos(a),Math.sin(a),0),side=new THREE.Vector3(-along.y,along.x,0);
  const reach=(orchid?.072:.091)*(.81+.19*Math.cos(i*2.19));
  const at=t=>along.clone().multiplyScalar(reach*t).setZ(z-.001+.022*Math.sin(t*Math.PI)+.008*t);
  foliage.blade(at,side,orchid?.019:.027,color,{rows:8,mark:(row,col)=>col===2?1.12:1-.06*(row%2)});
 }
}

function iconBeddingFlowers(THREE,foliage,z,orchid) {
 iconFlowerRosette(THREE,foliage,z,orchid);
 const vec=(x,y,h)=>new THREE.Vector3(x,y,h),color=hex=>new THREE.Color(hex),tau=Math.PI*2;
 const green=color(orchid?'#66815c':'#788e67'),throat=color('#dc9b36');
 const petal=color(orchid?'#f5eddb':'#9261b0'),lip=color(orchid?'#cd798d':'#7646a3');
 const normal=vec(orchid?-.52:.46,orchid?-.78:-.25,orchid?.34:.85).normalize();
 const side=vec(-normal.y,normal.x,0).normalize(),up=normal.clone().cross(side);
 const point=(x,y,h)=>vec(x,y,z+h);
 const petalAt=(root,a,length,width,paint,curl)=>{
  const axis=up.clone().multiplyScalar(Math.cos(a)).addScaledVector(side,Math.sin(a));
  const cross=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up,-Math.sin(a));
  foliage.blade(t=>root.clone().addScaledVector(axis,t*length).addScaledVector(normal,curl*(t*t-.5*t)),cross,width,paint,{rows:6});
 };
 const stalk=[point(0,0,-.004),point(.012,-.008,.10),point(.043,-.032,.20),point(.070,-.053,.243),point(.102,-.060,.249)];
 if(orchid)foliage.stem(stalk,.0025,green);
 for(let i=0;i<(orchid?4:8);i++){
  const a=i*2.40,r=.020+.019*Math.cos(i*1.3);
  const root=orchid?point(.034+i*.019+.004*(i%2),-.028-i*.010-(i%2)*.012,.155+i*.026):
   point(r*Math.cos(a),r*Math.sin(a),.064+.019*Math.cos(i*1.25));
  const branch=orchid?stalk[i<2?2:3]:point(.006*Math.cos(a),.006*Math.sin(a),0);
  foliage.stem([branch,root],orchid?.0013:.0016,green);
  const turn=orchid?(i%2)*.21:a;
  for(let j=0;j<5;j++)petalAt(root,turn+j*tau/5,orchid?(j===0?.015:.020):.013,orchid?(j===1||j===4?.011:.006):.0065,petal,orchid?.006:.003);
  const front=root.clone().addScaledVector(normal,.0025);
  if(orchid)petalAt(front,Math.PI+turn,.012,.006,lip,.008);
  for(const sign of [-1,1])petalAt(front,turn+sign*.9,.0038,.0022,throat,.002);
 }
 if(orchid)for(const i of [0,1]){
  const q=stalk.at(-1).clone().add(vec(-i*.013,0,0));
  petalAt(q,.4,.012,.005,color('#cccfad'),.006);
 }
}

function iconIndoorPlants(context) {
 const {THREE,mesh,obstacle}=context;
 const clay=color=>new THREE.MeshStandardMaterial({color,roughness:.87});
 const soil=clay('#473b30'),foliageMaterial=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.73});
 const placements=[
  ['parlour-palm',1.26,12.57,0,.219,.45,'#b47c60'],
  ['cast-iron-plant',13.87,12.00,0,.143,.27,'#bba988'],
  ['prayer-plant',3.77,.97,3.215,.156,.255,'#aa785f']
 ];
 for(const [id,support,u,v,r,h,finish] of [
  ['african-violet','play-cubbies',.68,.55,.057,.084,'#b88e6c'],
  ['moth-orchid','master-bedside-right',.20,.805,.046,.084,'#b7c4b7']
 ]){
  const item=context.data.furniture.find(f=>f.id===support);if(!item)continue;
  const frame=iconInteriorFurnitureFrame(context,item);
  placements.push([id,...frame.point(frame.width*u,frame.depth*v,item.height),r,h,finish,support]);
 }
 for(const [id,x,y,floor,r,h,finish,support] of placements){
  const profile=[[.72,0],[.76,.025],[.79,.095],[.99,.87],[1,.94],[.98,1],[.88,1],[.87,.88]];
  const pot=mesh(new THREE.LatheGeometry(profile.map(([radius,height])=>new THREE.Vector2(radius*r,height*h)),24),clay(finish),id+'-pot');
  pot.rotation.x=Math.PI/2;pot.position.set(x,y,floor);
  const soilTop=h*.91;
  const earth=mesh(new THREE.CircleGeometry(r*.89,24),soil,id+'-soil');earth.position.set(x,y,floor+soilTop);
  const foliage=iconPlantFoliage(THREE);
  if(id==='parlour-palm')iconParlourPalm(THREE,foliage,soilTop);
  else if(support)iconBeddingFlowers(THREE,foliage,soilTop,id==='moth-orchid');
  else iconRosettePlant(THREE,foliage,soilTop,id==='cast-iron-plant');
  const crown=mesh(foliage.finish(),foliageMaterial,id+'-foliage');crown.position.set(x,y,floor);
  if(!support)obstacle(id+'-pot',[x-r,y-r,x+r,y+r],floor,floor+h);
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

function iconStillLifePrint({shape,stroke,oval}) {
 shape('#acb5a5','M0 0H300V380H0Z');
 shape('#698b84','M25 0H167L134 224 20 249Z');
 shape('#d69374','M0 259L300 211V380H0Z');
 for(let x=-90;x<340;x+=28)stroke('#b86756',2.4,`M${x} 381l88 -147`);
 oval('#86645b',141,279,96,9,-.09);
 shape('#233f57','M116 128C106 120 93 122 80 117L86 143Q76 164 66 191C52 231 61 268 77 274Q112 286 142 268C154 245 152 211 140 179C197 185 204 110 161 119Q149 120 139 135L140 114Z');
 shape('#aeb4a2','M144 148C179 108 194 153 157 166L143 166Z');
 stroke('#91a39b',2.7,'M80 250Q64 229 83 190M82 134Q105 140 129 127');
 shape('#d3ad46','M192 229C192 220 197 210 203 209C210 209 210 220 216 227C223 236 237 241 238 255C238 271 221 278 204 278C183 279 173 269 174 256C175 241 186 240 192 229Z');
 stroke('#504c38',3.5,'M204 214Q203 204 212 196');
 shape('#425e4b','M208 203Q223 185 238 199Q226 209 208 203Z');
}

function iconHarePrint({shape,stroke,oval}) {
 shape('#e2c388','M0 0H420V300H0Z');
 oval('#c66b45',327,64,32,31,-.14);
 shape('#99aaa0','M0 196Q83 120 184 162T420 139V300H0Z');
 shape('#537a74','M0 233Q94 255 173 209T420 200V300H0Z');
 for(let x=-12;x<420;x+=20)stroke('#96a99a',2.4,`M${x} 264q18 -10 26 -10`);
 shape('#394755','M57 217Q86 196 120 172L145 143Q161 136 173 143Q156 165 131 185Q100 209 67 222Z');
 shape('#af593a','M79 209L120 165C131 141 146 115 175 114Q209 111 238 129L260 118C252 100 244 62 251 42C261 43 280 94 280 111C282 87 298 54 310 47C316 63 300 102 292 118Q311 121 319 137L335 144Q333 156 314 159L284 164Q271 184 243 186L269 209 303 215Q306 222 290 223L258 220 218 197Q197 202 171 188L135 183 87 216Q72 221 79 209Z');
 oval('#eee2c6',132,141,16,12,-.5);
 shape('#e0a07a','M253 54Q269 74 276 105Q261 92 253 54ZM305 59Q300 85 287 104Q289 85 305 59Z');
 stroke('#784937',2.4,'M147 171Q187 180 187 146M285 144Q284 152 277 155');
 oval('#293b3b',301,136,3.2,3.2,0);oval('#f4e9cf',302,135,1,1,0);
 stroke('#263c3c',2.2,'M327 145l6 0M56 160l34 -10M67 172l23 -8');
 const grasses=[[21,246],[46,249],[351,251],[387,237]];
 for(const [x,y] of grasses)stroke('#34594e',2,`M${x} ${y}q-1 -18 -6 -27m6 27q3 -18 14 -26m-14 26q10 -7 19 -9`);
}

function iconReedbedPrint({shape,stroke,oval}) {
 shape('#d5c4a9','M0 0H500V272H0Z');
 oval('#c48658',343,78,30,30,0);
 shape('#a5aba3','M0 107Q68 91 127 108T269 101Q328 84 400 108T500 96V182H0Z');
 shape('#84938c','M0 143Q84 135 135 127Q210 113 271 127T410 123L500 113V176H0Z');
 shape('#afbcb0','M0 155Q160 147 258 152T500 140V272H0Z');
 shape('#506563','M0 115Q67 130 113 130L128 135 183 138 197 144 245 147 276 151 226 155 70 160 0 166Z');
 shape('#516f6b','M500 190Q419 175 376 177Q356 170 309 166Q385 171 406 164Q440 159 500 160Z');
 for(const [x,y,len] of [[301,155,59],[273,162,54],[308,168,42],[126,179,76],[45,185,39],[189,196,45],[287,188,90],[357,203,38],[220,213,55]])
  stroke('#e1c9a1',1.6,`M${x} ${y}q${len*.52} -1 ${len} -1`);
 shape('#697965','M0 191Q75 183 111 205T231 226Q305 229 354 244T500 251V272H0Z');
 shape('#3e5750','M0 203Q65 199 134 229T239 252Q185 253 152 272H0Z');
 for(const [x,y,h] of [[14,235,40],[32,226,28],[59,234,22],[83,240,29],[104,250,16],[124,253,27],[150,261,22],[184,266,12]]){
  stroke('#c3ab7e',1.4,`M${x} ${y}q0 -8 ${h*.2} ${-h}`);
  oval('#c3ab7e',x+h*.20,y-h,1.3,4.7,.23);
 }
}

function iconLunariaPrint({shape,stroke,oval}) {
 shape('#435963','M0 0H300V400H0Z');
 stroke('#b0aa83',2.6,'M89 400C113 332 110 256 148 195S171 88 198 37M114 293Q82 246 68 179M120 269Q163 250 195 195M151 187Q126 157 114 107M166 148Q201 133 223 91');
 const pods=[[70,170,-.48],[58,207,-.88],[82,221,-.45],[105,248,.61],[118,109,-.38],[122,143,-.56],[150,159,.65],[161,110,-.30],
  [179,84,-.28],[198,49,.37],[201,91,.73],[219,106,.65],[174,218,-.55],[195,185,.39],[195,222,.86],[148,256,.82]];
 for(const [i,[x,y,a]] of pods.entries()){
  const colors=['#d2c6aa','#a5b2a3','#c0b79c','#dbceb1'];
  oval(colors[i%4],x,y,11+(i%3),21+(i%4),a);
  const dx=Math.sin(a),dy=Math.cos(a);
  stroke('#818876',.95,`M${x+dx*19} ${y-dy*19}Q${x-3} ${y} ${x-dx*19} ${y+dy*19}`);
  oval('#8f9680',x+2,y-1,2.2,3.3,a);
 }
}

function iconPrintPaper(THREE,title,width,height,draw) {
 const paper=new THREE.MeshStandardMaterial({name:title,color:'#ede6d7',roughness:.97});
 if(typeof document==='undefined')return paper;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*2.4);canvas.height=Math.ceil(height*2.4);
 const ink=canvas.getContext('2d');
 ink.scale(canvas.width/width,canvas.height/height);
 ink.fillStyle='#ede6d7';ink.fillRect(0,0,width,height);
 ink.save();ink.translate(width*.08,height*.075);ink.scale(.84,.835);
 ink.beginPath();ink.rect(0,0,width,height);ink.clip();
 draw({
  shape:(color,path)=>{ink.fillStyle=color;ink.fill(new Path2D(path));},
  stroke:(color,weight,path)=>{ink.strokeStyle=color;ink.lineWidth=weight;ink.lineCap='round';ink.stroke(new Path2D(path));},
  oval:(color,x,y,rx,ry,angle)=>{ink.fillStyle=color;ink.beginPath();ink.ellipse(x,y,rx,ry,angle,0,2*Math.PI);ink.fill();}
 });
 ink.restore();
 // A repeating dry-ink grain softens the flat pigments without adding geometry.
 const grain=document.createElement('canvas');grain.width=grain.height=64;
 const grainInk=grain.getContext('2d'),tile=grainInk.createImageData(64,64);
 let seed=1729;
 for(let i=0;i<tile.data.length;i+=4){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  tile.data[i]=tile.data[i+1]=tile.data[i+2]=seed&128?255:0;tile.data[i+3]=seed>>>28;
 }
 grainInk.putImageData(tile,0,0);
 ink.fillStyle=ink.createPattern(grain,'repeat');ink.fillRect(0,0,width,height);
 paper.map=new THREE.CanvasTexture(canvas);paper.map.colorSpace=THREE.SRGBColorSpace;paper.map.anisotropy=4;
 paper.color.set(0xffffff);return paper;
}

function iconFramedArt(context) {
 const {THREE,data,mesh}=context,{ash,walnut}=iconLivingPalette(context);
 const pieces=[
  {id:'hall-still-life',title:'Dzbanek i gruszka',support:'hall-front',along:8.90,normal:[0,1],z:1.65,w:.54,h:.68,wood:walnut,sheet:[300,380],draw:iconStillLifePrint},
  {id:'playroom-hare',title:'Zając w biegu',support:'facade-wing-end',along:6.12,normal:[-1,0],z:1.57,w:.94,h:.68,wood:ash,sheet:[420,300],draw:iconHarePrint},
  {id:'bedroom-lake',title:'Cisza nad jeziorem',support:'u-room1',along:3.45,normal:[0,-1],z:4.74,w:1.14,h:.64,wood:walnut,sheet:[500,272],draw:iconReedbedPrint},
  {id:'suite-lunaria',title:'Miesiącznica',support:'u-suite-hall',along:10.67,normal:[1,0],z:4.76,w:.69,h:.91,wood:ash,sheet:[300,400],draw:iconLunariaPrint}
 ];
 for(const {id,title,support,along,normal:[nx,ny],z,w,h,wood,sheet,draw} of pieces){
  const facade=data.facades.find(f=>f.id===support),wall=facade??data.walls.find(p=>p.id===support);
  const offset=facade?iconGroundFacadeDepth(facade):wall.thickness/2;
  const x=nx?wall.a[0]+nx*offset:along,y=ny?wall.a[1]+ny*offset:along;
  const rim=.014,depth=.030;
  const corners=inset=>[[-w/2+inset,-h/2+inset],[w/2-inset,-h/2+inset],[w/2-inset,h/2-inset],[-w/2+inset,h/2-inset]].map(([u,v])=>new THREE.Vector2(u,v));
  const profile=new THREE.Shape(corners(0));profile.holes.push(new THREE.Path(corners(rim)));
  const frame=new THREE.ExtrudeGeometry(profile,{depth,bevelEnabled:false});
  const mount=(geometry,material,suffix,distance)=>{
   geometry.rotateX(Math.PI/2);geometry.rotateZ(Math.atan2(nx,-ny));
   const piece=mesh(geometry,material,'wall-art-'+id+'-'+suffix);
   piece.position.set(x+nx*distance,y+ny*distance,z);return piece;
  };
  mount(frame,wood,'frame',.001);
  const print=mount(new THREE.PlaneGeometry(w-rim*2,h-rim*2),iconPrintPaper(THREE,title,...sheet,draw),'print',depth-.006);
  print.castShadow=false;
 }
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

function iconBedroomRoofFinish({THREE,data,group}) {
 const [left,front]=data.rooms.find(room=>room.id==='1.8').box;
 const innerFace=(name,axis)=>{
  const geometry=group.getObjectByName(name).geometry;
  geometry.computeBoundingBox();
  return geometry.boundingBox.min[axis];
 };
 const right=innerFace('wing-gable','x'),back=innerFace('upper-rear-wing','y');
 const width=right-left,panelCount=4,tau=Math.PI*2;
 const oak=iconFinishTexture(THREE,'Honey oak bedroom ceiling panels',1536,384,.69,(u,v)=>{
  const panel=Math.floor(u*panelCount),across=u*panelCount-panel,seed=panel*2.37;
  const seamM=Math.min(panel>0?across:1,panel<panelCount-1?1-across:1)*width/panelCount;
  const bend=.019*Math.sin(4.7*v+seed)+.008*Math.sin(11*v+3*across+seed);
  const cut=across+bend,ring=22*cut+.54*Math.sin(15*cut+seed)+.19*Math.sin(61*cut+seed);
  const fibre=Math.cos(tau*ring),pores=Math.max(0,Math.cos(tau*(ring*3.3+.18*Math.sin(17*v+seed))))**8;
  const shade=4*Math.sin(14*cut+seed)+2.9*fibre-4.7*Math.max(0,fibre)**5-3*pores+2*Math.cos(seed);
  const joint=Math.max(0,1-seamM/.0035);
  return [188+shade,143+.85*shade,95+.66*shade].map(c=>c*(1-.67*joint));
 });
 oak.side=THREE.DoubleSide;
 return {oak,left,front,right,back};
}

function iconSplitRoofPolygon(polygon,axis,limit) {
 const below=[],above=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],da=a[axis]-limit,db=b[axis]-limit;
  if(da<=0)below.push(a);
  if(da>=0)above.push(a);
  if(da*db<0){
   const cross=a.clone().lerp(b,da/(da-db));
   below.push(cross);above.push(cross);
  }
 }
 return [below,above];
}

function iconRoofLining(context,part,inverse,neutral,white,bedroom) {
 const {THREE,group,mesh,data,cutRoof}=context,{left,front,right,back,oak}=bedroom;
 const points=part.vertices.map(v=>{const p=new THREE.Vector3(...v).applyMatrix4(inverse);p.z-=.045;return p;});
 const [,start,endX]=data.void.box,main=points.every(p=>p.x<=endX+1e-5);
 const finishes=new Map([[neutral,''],[white,'-living'],[oak,'-bedroom']]);
 const positions=new Map([...finishes.keys()].map(mat=>[mat,[]]));
 const add=(face,material)=>{
  const vertices=positions.get(material);
  for(let i=1;i<face.length-1;i++)for(const p of [face[0],face[i],face[i+1]])vertices.push(p.x,p.y,p.z);
 };
 for(const indices of part.faces){
  let face=indices.map(i=>points[i]);
  if(main){
   const [other,living]=iconSplitRoofPolygon(face,'y',start);
   add(other,neutral);add(living,white);continue;
  }
  for(const [axis,limit,keep] of [['x',left,1],['y',front,1],['x',right,0],['y',back,0]]){
   if(face.length<3)break;
   const halves=iconSplitRoofPolygon(face,axis,limit);
   add(halves[1-keep],neutral);face=halves[keep];
  }
  add(face,oak);
 }
 for(const [material,vertices] of positions){
  if(!vertices.length)continue;
  const source=new THREE.BufferGeometry();source.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  source.computeVertexNormals();
  const geometry=cutRoof(source,group.matrix);
  if(material===oak){
   const p=geometry.attributes.position,uv=[];
   for(let i=0;i<p.count;i++)uv.push((p.getX(i)-left)/(right-left),(p.getY(i)-front)/(back-front));
   geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  }
  mesh(geometry,material,'interior-roof-lining-'+part.id+finishes.get(material)).castShadow=false;
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

function iconLivingLighting(context,roofTimber) {
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
  const geometry=new THREE.ExtrudeGeometry(section,{depth:.11,bevelEnabled:false});
  const {position,normal,uv}=geometry.attributes;
  for(let i=0;i<position.count;i++){
   const across=Math.abs(normal.getZ(i))>.5?position.getY(i):position.getZ(i);
   uv.setXY(i,across/.32+py*.27,position.getX(i)/2.65+py*.43);
  }
  const tie=mesh(geometry,roofTimber,'living-collar-tie-'+py);
  tie.rotation.x=Math.PI/2;tie.position.set(ridge,py+.055,z);
 }
 box('kitchen-linear-light',[.8,10.09,4.68,10.115],2.787,.012,mats.lamp);
}

function iconMezzanineTrusses(context,roofTimber) {
 const {THREE,mesh,data}=context,{eave,ridge}=data.levels;
 const pitch=(ridge-eave)/4.25,top=ridge-.045,mid=8.46;
 function timber(name,a,b,width,depth){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const nx=-dy*width/(2*length),ny=dx*width/(2*length);
  const vertices=[a,b].flatMap(([x,y,z])=>[[x+nx,y+ny,z],[x-nx,y-ny,z],[x-nx,y-ny,z-depth],[x+nx,y+ny,z-depth]]);
  const g=new THREE.BufferGeometry(),positions=[],uv=[];
  for(const [i,j,k,l] of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[3,2,1,0],[4,5,6,7]]){
   const edge=(p,q)=>Math.hypot(...vertices[p].map((n,c)=>n-vertices[q][c]));
   const across=edge(i,j)/.32,along=edge(i,l)/2.65;
   for(const [index,u,v] of [[i,0,0],[j,across,0],[k,across,along],[i,0,0],[k,across,along],[l,0,along]]){
    positions.push(...vertices[index]);uv.push(u+a[0]*.27+i*.17,v+b[1]*.43);
   }
  }
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();mesh(g,roofTimber,'gallery-truss-'+name);
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
  ['pantry',2.12,7.58,2.53,'opal',.14],['plant-room',5.13,7.44,2.55,'opal',.14],
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

function iconPhotovoltaicGlass(THREE) {
 const glass=iconFinishTexture(THREE,'Trina Vertex S+ anti-reflective glass and 108 half-cells',384,576,.31,(u,v)=>{
  const column=u*6,row=v*18,cellX=column%1,cellY=row%1;
  const edgeX=Math.min(cellX,1-cellX),edgeY=Math.min(cellY,1-cellY);
  const tone=1.8*Math.sin(3.71*Math.floor(column)+5.13*Math.floor(row))+.9*Math.cos(v*17.4);
  if(edgeX<.010 || edgeY<.025 || Math.abs(v-.5)<.0025)return [75,78,81];
  if(edgeX+.59*edgeY<.047)return [64,69,76];
  const ribbon=Math.min((cellX*8)%1,1-(cellX*8)%1)<.062?8:0;
  return [31+tone+ribbon,43+tone+ribbon,55+tone+ribbon];
 },[1,1]);
 glass.metalness=.18;
 return glass;
}

function iconPhotovoltaicHardware(THREE,array,width,length,depth) {
 const rim=.012;
 const corners=inset=>[[-1,-1],[-1,1],[1,1],[1,-1]].map(([x,y])=>new THREE.Vector2(x*(width/2-inset),y*(length/2-inset)));
 const frameOutline=new THREE.Shape(corners(0));frameOutline.holes.push(new THREE.Path(corners(rim)));
 const frame=new THREE.ExtrudeGeometry(frameOutline,{depth,bevelEnabled:false});frame.translate(0,0,-depth/2);
 const anodized=new THREE.MeshStandardMaterial({name:'Black anodized PV frame',color:'#34393b',roughness:.46,metalness:.62});
 const alloy=new THREE.MeshStandardMaterial({name:'Dark aluminium mounting hardware',color:'#4e5556',roughness:.61,metalness:.54});
 const batch=(name,g,m,n)=>{
  const parts=new THREE.InstancedMesh(g,m,n);parts.name=name;parts.castShadow=true;parts.receiveShadow=true;array.add(parts);return parts;
 };
 const frames=batch('pv-module-frames',frame,anodized,20);
 frames.userData={model:'Trina Solar Vertex S+ TSM-500NEG18R.28',powerWp:500};
 const cells=batch('pv-module-cells',new THREE.BoxGeometry(width-2*rim,length-2*rim,.0032),iconPhotovoltaicGlass(THREE),20);
 const rails=batch('pv-mounting-rails',new THREE.BoxGeometry(1,1,1),alloy,16);
 const feet=batch('pv-roof-feet',new THREE.BoxGeometry(.11,.075,.055),alloy,40);
 const clampProfile=new THREE.Shape([[-.006,0],[.006,0],[.006,depth],[.025,depth],[.025,depth+.005],
  [-.025,depth+.005],[-.025,depth],[-.006,depth]].map(([x,z])=>new THREE.Vector2(x,z)));
 const clamp=new THREE.ExtrudeGeometry(clampProfile,{depth:.060,bevelEnabled:false});
 clamp.rotateX(Math.PI/2);clamp.translate(0,.030,0);
 const clamps=batch('pv-frame-clamps',clamp,anodized,56);
 return {frames,cells,rails,feet,clamps};
}

function iconRoofPhotovoltaics({THREE,group}) {
 const array=new THREE.Group();array.name='icon-193-photovoltaics';group.add(array);
 const width=1.134,depth=.030,gap=.030,clear=.090,seamPitch=.52;
 const {frames,cells,rails,feet,clamps}=iconPhotovoltaicHardware(THREE,array,width,1.961,depth);
 const tilt=Math.atan2(4.23,4.25),cosine=Math.cos(tilt),pose=new THREE.Object3D();
 let panel=0,rail=0,foot=0,clip=0;
 const fields=[
  {ridge:[4.25,0,8.3],rotation:0,first:4.16,rows:2,columns:6,setback:.64},
  {ridge:[0,8.46,8.3],rotation:-Math.PI/2,first:10.92,rows:4,columns:2,setback:.70}
 ];
 for(const field of fields){
  pose.rotation.set(0,-tilt,field.rotation,'ZYX');
  const ridge=new THREE.Vector3(...field.ridge),uphill=new THREE.Vector3(1,0,0).applyQuaternion(pose.quaternion);
  const along=new THREE.Vector3(0,1,0).applyQuaternion(pose.quaternion),normal=new THREE.Vector3(0,0,1).applyQuaternion(pose.quaternion);
  const place=(mesh,index,down,column,height,sx=1,sy=1,sz=1)=>{
   pose.position.copy(ridge).addScaledVector(uphill,-down).addScaledVector(along,column).addScaledVector(normal,height);
   pose.scale.set(sx,sy,sz);pose.updateMatrix();mesh.setMatrixAt(index,pose.matrix);
  };
  const span=field.rows*(width+gap)-gap;
  for(let col=0;col<field.columns;col++){
   const center=field.first+col*4*seamPitch;
   for(let row=0;row<field.rows;row++){
    const down=field.setback+row*(width+gap)+width/2;
    place(frames,panel,down,center,clear+depth/2);place(cells,panel++,down,center,clear+depth-.0022);
    // Some main-roof triangles have transverse seams; choose their intersection with the rail.
    const footDown=field.rotation===0?(ridge.x-Math.round((ridge.x-down*cosine)/seamPitch)*seamPitch)/cosine:down;
    for(const side of [-1,1])place(feet,foot++,footDown,center+side*seamPitch,.0275);
   }
   for(const side of [-1,1]){
    const mount=center+side*seamPitch;
    place(rails,rail++,field.setback+span/2,mount,.0725,span+.086,.043,.035);
    for(let edge=0;edge<=field.rows;edge++)
     place(clamps,clip++,field.setback-gap/2+edge*(width+gap),mount,clear);
   }
  }
 }
}

function iconInteriorLightingAndRoof(context) {
 iconRoofPhotovoltaics(context);
 const roofTimber=iconLongGrainOak(context.THREE,'Clear-finished light oak roof timber',[207,177,137]);
 roofTimber.roughness=.72;
 iconMezzanineTrusses(context,roofTimber);
 iconLivingLighting(context,roofTimber);
 iconIndoorOlive(context,.97,16.21,.88);
 iconIndoorPlants(context);
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
 const bedroom=iconBedroomRoofFinish(context);
 for(const part of house.meshes.filter(m=>m.kind==='roof'))iconRoofLining(context,part,inverse,neutral,white,bedroom);
 group.userData={kind:'walkable-interior',rooms:data.rooms.length,stairRises:18,source:data.metadata,groundFloor:0,upperFloor:3.2};
}

function iconCurtainOpening({group}, panes, axis, inward, fullSpan) {
 const points=[];
 for(const pane of panes){
  const glass=group.getObjectByName(pane).geometry.attributes.position;
  for(let i=0;i<glass.count;i++)points.push([glass.getComponent(i,axis),glass.getComponent(i,1-axis),glass.getZ(i)]);
 }
 const start=Math.min(...points.map(p=>p[0])),end=fullSpan?start+fullSpan:Math.max(...points.map(p=>p[0]));
 const topAtEdge=edge=>Math.max(...points.filter(p=>Math.abs(p[0]-edge)<.0001).map(p=>p[2]));
 const low=topAtEdge(start),slope=fullSpan?0:(topAtEdge(end)-low)/(end-start),plane=points[0][1];
 return {
  start,end,sill:Math.min(...points.map(p=>p[2])),
  top:u=>low+(u-start)*slope,
  at:(u,depth,z)=>axis===0?[u,plane+inward*depth,z]:[plane+inward*depth,u,z]
 };
}

function iconCurtainPanel({THREE,mesh},name,opening,settings,edge,sign,cloth) {
 const {stack,depth,foldScale=1,headOffset=settings.rise-.019}=settings;
 const folds=settings.folds??Math.max(4,Math.round(stack/.095)),columns=folds*9;
 const rows=[0,.014,.03,.14,.37,.62,.84,.965,.981,1];
 const vertices=[],colors=[],indices=[],uv=[];
 for(const [j,t] of rows.entries()) for(let i=0;i<=columns;i++){
  const s=i/columns,wave=s*folds*2*Math.PI;
  const phase=wave+.13*Math.sin(wave*.45)+.31*(1-t)*Math.sin(wave*.27+sign);
  const flare=.85+.15*(1-t)**1.5;
  const u=edge+sign*(.02+stack*(s*flare+.022*(1-t)*Math.sin(phase)));
  const ripple=(.030+.013*(1-t))*Math.cos(phase)+.005*Math.sin(2*phase);
  const hem=opening.sill+.033+.008*Math.sin(phase+.8);
  const head=opening.top(u)+headOffset,z=hem+(head-hem)*t;
  vertices.push(...opening.at(u,depth+ripple*foldScale,z));
  if(cloth.map)uv.push(s*folds,(z-hem)*5);
  const shade=(j===1||j===8?.91:1)*(.976+.024*Math.sin(wave*.47+1));
  colors.push(shade,shade,shade);
  if(i&&j){const n=j*(columns+1)+i;indices.push(n-columns-2,n-columns-1,n,n-columns-2,n,n-1);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 if(uv.length)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
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

function iconKitchenCurtains(context) {
 const {THREE,data,box,material}=context,facade=data.facades.find(wall=>wall.id==='facade-main-side');
 const opening=iconCurtainOpening(context,['facade-main-side-glass-0'],1,1);
 const start=opening.start+.012,end=opening.end-.012,head=opening.top(start),railHeight=.016;
 const glassX=opening.at(start,0,head)[0],wallFace=facade.a[0]+iconGroundFacadeDepth(facade);
 const depth=(wallFace-glassX)/2,x=glassX+depth;
 const metal=material('#d5cabc',{name:'Satin ivory ceiling track',metalness:.32,roughness:.58});
 box('curtain-kitchen-track',[x-.014,start,x+.014,end],head-railHeight,railHeight,metal);
 const linen=iconLoungeFabric(THREE,'Natural flax linen',[222,211,191]);
 linen.side=THREE.DoubleSide;linen.vertexColors=true;linen.roughness=.97;
 const gathered={stack:.166,folds:8,foldScale:1.5,depth,headOffset:-railHeight};
 iconCurtainPanel(context,'kitchen',opening,gathered,start,1,linen);
 iconCurtainPanel(context,'kitchen',opening,gathered,end,-1,linen);
}

function iconInteriorCurtains(context) {
 const {THREE}=context;
 iconKitchenCurtains(context);
 const cloth=new THREE.MeshStandardMaterial({color:'#dbccb3',roughness:.97,vertexColors:true,side:THREE.DoubleSide});
 const metal=new THREE.MeshStandardMaterial({color:'#786750',roughness:.55,metalness:.39});
 const garden={depth:.18,rise:.076,face:.12,left:-.028,right:-.028,stack:.46};
 const ground={depth:.335,rise:.083,face:.24,left:.17,right:.17,stack:.25};
 const gable={depth:.265,rise:.075,face:.18,left:.10,right:.10,stack:.33};
 const office=context.data.facades.find(f=>f.id==='facade-wing-end').openings[1];
 const windows=[
  ['living',['facade-garden-glass-0-pane-0','facade-garden-glass-0-pane-2'],0,-1,garden],
  ['playroom',['facade-front-wing-glass-2'],0,1,ground],
  ['study',['facade-wing-end-glass-1'],1,-1,{...ground,left:.014,right:.23,fullSpan:office.end-office.start,rightStack:.21}],
  ['bedroom-one',['front-gable-glass-0'],0,1,gable],
  ['master',['wing-gable-glass-0'],1,-1,gable]
 ];
 for(const [name,panes,axis,inward,settings] of windows){
  const opening=iconCurtainOpening(context,panes,axis,inward,settings.fullSpan);
  const start=opening.start-settings.left,end=opening.end+settings.right;
  iconCurtainTrack(context,name,opening,settings,start,end,metal);
  iconCurtainPanel(context,name,opening,settings,start,1,cloth);
  iconCurtainPanel(context,name,opening,settings.rightStack?{...settings,stack:settings.rightStack}:settings,end,-1,cloth);
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

function iconPlantPalette(context) {
 const {material,mats}=context;
 return context.plantPalette??={
  enamel:material('#e6ebe8',{name:'Plant enamel',roughness:.38,metalness:.21}),
  silver:material('#aab4b5',{name:'Galvanized duct and unions',roughness:.36,metalness:.58}),
  graphite:mats.metal,black:mats.dark,glass:mats.glass,brass:material('#b79453',{name:'Valve brass',metalness:.57,roughness:.34}),
  copper:material('#af765c',{name:'Copper pipe',metalness:.60,roughness:.42}),
  blue:material('#477888',{name:'Cold supply marker'}),red:material('#a35849',{name:'Warm supply marker'}),
  display:material('#243c43',{name:'Plant control glass',roughness:.2}),
  led:material('#a9dfb4',{name:'Equipment indicator',emissive:'#77b88d',emissiveIntensity:.65}),
 };
}

function iconPlantMark(context,s,text,u,v,z,w,h) {
 const {THREE}=context,cache=context.plantMarks??=new Map();
 if(!cache.has(text)){
  const mat=context.material('#dae4df',{roughness:.55});
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=384;canvas.height=72;
   const ink=canvas.getContext('2d');
   ink.fillStyle='#e2eae6';ink.fillRect(0,0,384,72);ink.fillStyle='#476d73';ink.fillRect(0,0,9,72);
   ink.fillStyle='#152d31';ink.font='bold 43px sans-serif';ink.textAlign='center';ink.textBaseline='middle';
   ink.fillText(text,195,37,347);mat.map=new THREE.CanvasTexture(canvas);
   mat.map.colorSpace=THREE.SRGBColorSpace;mat.color.set(0xffffff);
  }
  cache.set(text,mat);
 }
 s.add('rating-plate-'+text,iconLabelPlane(context,w,h),cache.get(text),u,v,z).castShadow=false;
}

function iconPlantCylinder(context,{width:w,depth:d,line},s,p) {
 const r=.296,c=w/2,v=d/2;
 iconUpperCeramic(s,context.THREE,'insulated-vessel',c,v,0,r,r,
  [[0,.016],[.82,.016],[.92,.049],[.98,.079],[1,.14],[1,1.40],[.98,1.47],[.91,1.51],[.72,1.535],[0,1.542]],p.enamel);
 for(const [i,z] of [.082,.81,1.425].entries())s.disc('jacket-band-'+i,c,v,z,r+.005,r+.005,.014,p.silver);
 s.disc('plinth',c,v,.008,.255,.255,.045,p.graphite);
 line('service-hatch',[c,v+r-.012,.43],[c,v+r+.011,.43],.105,p.graphite);
 line('access-cover',[c,v+r+.008,.43],[c,v+r+.016,.43],.092,p.enamel);
 iconPlantMark(context,s,'ZASOBNIK CWU',c,v+r+.002,1.16,.225,.043);
 for(const [i,u,z] of [[0,.21,1.66],[1,.41,1.74]]){
  line('top-union-'+i,[u,v,1.495],[u,v,1.56],.028,p.brass);
  line('tank-riser-'+i,[u,v,1.56],[u,v,z],.016,p.copper);
  line('charging-line-'+i,[u,v,z],[0,v,z],.016,p.copper);
  s.disc('port-marker-'+i,u,v,1.567,.021,.021,.019,i?p.red:p.blue);
 }
}

function iconPlantHydrobox(context,{width:w,depth:d,line,part},s,p) {
 const c=w*.49;
 part('wall-hanger',[.104,0,w-.108,.026],1.29,.087,p.silver);
 s.cushion('hydronic-casing',c,.153,1.075,.565,.284,.81,.028,p.enamel);
 part('control-strip',[.081,.294,.573,.306],.811,.174,p.graphite);
 part('controller-display',[.139,.306,.319,.310],.853,.084,p.display);
 part('controller-status',[.157,.310,.221,.313],.889,.012,p.led);
 line('encoder',[.484,.306,.891],[.484,.327,.891],.034,p.silver);
 iconPlantMark(context,s,'POMPA CIEPŁA',c,.296,1.30,.251,.044);
 for(const [i,u] of [.13,.24,.37,.48].entries()){
  line('underbody-pipe-'+i,[u,.14,.40],[u,.14,.675],.013,p.copper);
  line('shutoff-'+i,[u,.14,.48],[u,.14,.539],.025,p.brass);
  part('valve-lever-'+i,[u-.014,.151,u+.014,.214],.511,.011,i%2?p.red:p.blue);
  line('wall-feed-'+i,[u,0,.40],[u,.14,.40],.013,p.copper);
 }
 for(const [i,absolute] of [1.66,1.74].entries()){
  const z=absolute-.40,v=.33,u=.608+i*.036;
  line('tank-connection-'+i,[w,v,z],[u,v,z],.016,p.copper);
  line('charging-drop-'+i,[u,v,z],[u,v,.301+i*.061],.016,p.copper);
  line('charging-return-'+i,[u,v,.301+i*.061],[.37+i*.11,v,.301+i*.061],.016,p.copper);
  line('charging-tail-'+i,[.37+i*.11,v,.301+i*.061],[.37+i*.11,.14,.301+i*.061],.016,p.copper);
  line('charging-riser-'+i,[.37+i*.11,.14,.301+i*.061],[.37+i*.11,.14,.4],.016,p.copper);
 }
}

function iconPlantHrv(context,{width:w,depth:d,line,part},s,p) {
 part('wall-bracket',[.075,0,w-.075,.024],.808,.099,p.graphite);
 s.cushion('counterflow-casing',w/2,d/2,.55,w-.014,d-.026,.76,.023,p.silver);
 s.cushion('service-door',w/2,d-.023,.55,w-.045,.033,.72,.014,p.enamel);
 part('filter-drawer',[.042,d-.009,w-.042,d-.004],.745,.066,p.graphite);
 for(const u of [.14,w-.14])part('filter-grip-'+u,[u-.043,d-.004,u+.043,d],.765,.016,p.silver);
 iconPlantMark(context,s,'REKUPERATOR',w/2,d-.005,.552,.30,.048);
 for(const [i,fraction] of [.14,.38,.62,.86].entries()){
  const u=w*fraction,v=i%2?.124:.223,endV=i%2?.109:.251;
  s.disc('duct-socket-'+i,u,v,.921,.088,.088,.069,p.graphite);
  s.tube('air-duct-'+i,[[u,v,.977],[u,v,1.067],[u,endV,1.185],[u,endV,1.48]],.072,p.silver);
  for(const [j,z] of [1.025,1.31,1.454].entries())s.disc('duct-band-'+i+'-'+j,u,j?endV:v,z,.074,.074,.012,p.graphite);
 }
 line('condensate-outlet',[.08,.09,.174],[.08,.09,.045],.015,p.silver);
 line('condensate-return',[.08,.09,.045],[.08,0,.045],.015,p.silver);
}

function iconPlantSoftener(context,{width:w,depth:d,line},s,p) {
 const u=w*.51, v=d*.55;
 s.cushion('base-pan',u,v,.024,w*.70,d*.78,.032,.009,p.graphite);
 s.cushion('brine-cabinet',u,v,.45,w*.77,d*.86,.872,.067,p.enamel);
 s.cushion('salt-lid',u,v,.902,w*.80,d*.87,.071,.028,p.graphite);
 s.cushion('valve-head',u,.165,.987,.235,.199,.132,.022,p.blue);
 s.cushion('programmer',u,.261,.992,.152,.027,.070,.009,p.display);
 iconPlantMark(context,s,'ZMIĘKCZACZ',u,v+d*.43+.001,.649,.21,.042);
 for(const [i,h] of [.805,.893].entries()){
  const u=.144+.074*i;
  line('bypass-tail-'+i,[u,.069,h],[u,.143,h],.016,p.brass);
  line('rear-line-'+i,[0,.069,h],[u,.069,h],.015,p.copper);
  line('valve-riser-'+i,[u,.143,h],[u,.143,1.02],.014,p.brass);
 }
}

function iconPlantMeter(context,{width:w,line,part},s,p) {
 const z=.195,v=.069,u=w*.51;
 line('inlet',[.021,v,z],[w,v,z],.016,p.copper);
 line('inlet-down',[.021,v,.018],[.021,v,z],.016,p.copper);
 line('wall-entry',[.021,0,.018],[.021,v,.018],.016,p.copper);
 for(const x of [u-.059,u+.059])line('meter-union-'+x,[x-.012,v,z],[x+.012,v,z],.034,p.brass);
 line('meter-body',[u-.052,v,z],[u+.052,v,z],.044,p.brass);
 line('dial-shroud',[u,v,z],[u,.151,z+.047],.063,p.blue);
 line('dial-face',[u,.149,z+.046],[u,.157,z+.051],.052,p.enamel);
 part('totalizer',[u-.026,.157,u+.026,.164],z+.046,.021,p.display);
 for(const [i,x] of [.052,w-.042].entries()){
  line('isolation-'+i,[x-.016,v,z],[x+.016,v,z],.024,p.brass);
  part('isolation-lever-'+i,[x-.010,v,x+.010,v+.063],z+.021,.012,p.blue);
 }
 line('bypass-riser',[w-.071,v,z],[w-.071,v,.283],.013,p.copper);
 line('bypass-outlet',[w-.071,v,.283],[w,v,.283],.013,p.copper);
 iconPlantMark(context,s,'WODOMIERZ',u,.128,.374,.174,.032);
 part('meter-tag-backing',[u-.093,.117,u+.093,.128],.35,.047,p.graphite);
 line('tag-mount',[u,0,.374],[u,.12,.374],.016,p.silver);
}

function iconPlantRack(context,{width:w,depth:d,line,part},s,p) {
 const h=.405,t=.016;
 const grille=iconPerforatedGuardMaterial(context.THREE,p.graphite);
 grille.name='Perforated steel rack panels';grille.alphaMap.repeat.set(64,22);
 part('backplate',[0,0,w,t],0,h,p.graphite);
 for(const [i,z] of [0,h-t].entries())part('shell-'+i,[0,t,w,d],z,t,p.graphite);
 for(const [i,u] of [0,w-t].entries()){
  part('vented-side-'+i,[u,t,u+t,d-.019],t,h-2*t,grille).castShadow=false;
 }
 for(const u of [.026,w-.05])part('rack-rail-'+u,[u,d-.071,u+.024,d-.052],.025,.353,p.silver);
 for(const [i,z] of [.100,.192,.276].entries()){
  part(['router','ethernet-switch','patch-panel'][i],[.054,.045,w-.054,d-.051],z,.044,i===1?p.silver:p.black);
  const count=[4,16,8][i];
  for(let j=0;j<count;j++){
   const u=.104+j*(i===1?.024:.037),half=i===1?.008:.012;
   part('rj45-'+i+'-'+j,[u-half,d-.052,u+half,d-.048],z+.010,.019,p.display);
   part('link-'+i+'-'+j,[u+.001,d-.048,u+.008,d-.046],z+.032,.004,p.led);
  }
 }
 for(let i=0;i<8;i++){
  const panel=.104+i*.037,sw=.104+i*.024;
  s.tube('patch-lead-'+i,[[panel,d-.048,.295],[panel,d-.022,.275],[sw,d-.022,.231],[sw,d-.048,.211]],.0034,i%2?p.blue:p.brass);
 }
 const uplink=.104+15*.024;
 s.tube('switch-router-uplink',[[uplink,d-.048,.211],[uplink,d-.022,.195],[.104,d-.022,.139],[.104,d-.048,.120]],.0034,p.blue);
 part('perforated-door-insert',[.027,d-.008,w-.027,d-.007],.029,h-.058,grille).castShadow=false;
 for(const u of [0,w-.026])part('door-stile-'+u,[u,d-.018,u+.026,d],.016,h-.032,p.graphite);
 part('door-lower-rail',[.026,d-.015,w-.026,d],t,.027,p.graphite);
 line('cabinet-lock',[w-.013,d-.002,.207],[w-.013,d+.0004,.207],.009,p.silver);
 iconPlantMark(context,s,'LAN',w*.79,d+.0004,.029,.075,.022);
}

function iconPlantBattery(context,frame,s,p) {
 const {width:w,depth:d,item,line,part}=frame,h=item.height;
 for(const u of [.074,w-.074])for(const v of [.048,d-.048]){
  line('caster-'+u+'-'+v,[u-.018,v,.043],[u+.018,v,.043],.043,p.black);
  part('caster-fork-'+u+'-'+v,[u-.024,v-.019,u+.024,v+.019],.046,.062,p.graphite);
 }
 s.cushion('steel-shell',w/2,(d-.012)/2,.569,w-.016,d-.012,.944,.020,p.enamel);
 s.cushion('front-panel',w/2,d-.018,(h+.094)/2,w,.030,h-.094,.016,p.enamel);
 for(const u of [.047,w-.047])line('carry-handle-'+u,[u,.038,1.057],[u,d-.053,1.057],.016,p.silver);
 for(const [id,[u,v,z]] of Object.entries(item.ports))
  s.disc('terminal-'+id,u,v,1.032,.022,.022,z-1.032,id==='positive'?p.red:p.black);
 s.cushion('lcd-bezel',w/2,d-.002,.898,.175,.002,.120,.002,p.black);
 part('lcd-screen',[w/2-.047,d-.001,w/2+.047,d-.0005],.866,.065,p.display);
 for(let i=0;i<4;i++)part('lcd-bar-'+i,[w/2-.035+i*.018,d-.0005,w/2-.021+i*.018,d],.887,.022,p.led);
 part('status-strip',[w/2-.004,d-.001,w/2+.004,d],.455,.220,p.graphite);
 iconApplianceMark(context,frame,'maker','MUST',w/2,d,.256,.148,.071,'#c52636');
 iconPlantMark(context,s,item.model,w/2,d,.129,.171,.027);
}

function iconPlantBoard(context,{width:w,depth:d,item,part},s,p) {
 const h=item.height;
 part('steel-enclosure',[0,0,w,d-.035],.014,h-.014,p.graphite);
 for(const u of [0,w-.019])part('edge-'+u,[u,d-.035,u+.019,d-.004],0,h,p.enamel);
 for(const z of [0,h-.024])part('edge-'+z+'-rail',[.019,d-.035,w-.019,d],z,.024,p.enamel);
 iconPlantMark(context,s,'ROZDZIELNICA',w/2,d-.033,.586,.245,.047);
 const rows=[['WYŁ. GŁÓWNY','SPD'],['FALOWNIK','WALLBOX'],['ZMYWARKA','REZERWA']];
 for(const [i,labels] of rows.entries()){
  const z=.434-.165*i;
  part('din-rail-'+i,[.035,d-.036,w-.035,d-.028],z,.033,p.silver);
  for(const [j,label] of labels.entries()){
   const u=.046+j*.178;
   const modules=label==='ZMYWARKA'?1:label==='REZERWA'?0:4;
   for(let k=0;k<modules;k++){
    const a=u+k*.031;
    part('din-device-'+i+'-'+j+'-'+k,[a,d-.030,a+.029,d-.010],z-.019,.080,p.enamel);
    if(label==='WALLBOX'&&k===0)part('rcbo-test-button',[a+.007,d-.010,a+.022,d-.003],z+.041,.010,p.blue);
    part('toggle-'+i+'-'+j+'-'+k,[a+.004,d-.010,a+.025,d-.001],z+.005,.025,label==='SPD'?p.red:p.black);
   }
   iconPlantMark(context,s,label,u+.062,d-.033,z-.042,.135,.022);
  }
 }
 part('clear-cover',[.019,d-.0008,w-.019,d],.024,h-.048,p.glass).castShadow=false;
 for(const z of [.095,h-.125])part('hinge-'+z,[.004,d-.012,.016,d],z,.027,p.silver);
 part('door-latch',[w-.017,d-.013,w-.003,d],h/2,.040,p.black);
 for(const [id,[u,v,z]] of Object.entries(item.ports))
  s.disc('gland-'+id,u,v,0,.015,.015,z,p.black);
}

function iconGarageWallbox(context,{width:w,depth:d,item,part,line},s,p) {
 const c=w/2;
 part('wall-mount',[.061,0,w-.061,.052],.419,.392,p.graphite);
 s.cushion('enclosure',c,.099,.623,w-.034,.145,.454,.053,p.enamel);
 s.cushion('fascia',c,.163,.628,w-.065,.032,.409,.015,p.graphite);
 part('charge-indicator',[c-.059,.179,c+.059,.181],.733,.013,p.led);
 iconPlantMark(context,s,'11 kW · 3~ 400 V',c,.181,.675,.236,.038);
 const [u,v,z]=item.ports.ac;
 s.disc('ac-inlet',u,v,z,.016,.016,.038,p.black);
 line('cable-hook',[c,.092,.36],[c,.159,.36],.035,p.graphite);
 line('plug-socket',[.257,.147,.529],[.257,.180,.529],.047,p.black);
 s.cushion('type-2-handle',.257,.181,.493,.074,.054,.150,.020,p.enamel,-.18);
 s.tube('coiled-ev-cable',[[.116,.110,.413],[.062,.121,.256],[.067,.14,.100],[.145,.147,.055],
  [.262,.15,.079],[.297,.156,.156],[.272,.154,.297],[.208,.148,.367],[.160,.157,.365],
  [.08,.166,.256],[.082,.174,.111],[.155,.176,.076],[.248,.179,.096],[.285,.184,.17],
  [.258,.185,.303],[.249,.189,.369],[.257,.191,.436]],.010,p.black);
}

function iconPlantInverter(context,{width:w,depth:d,item,part},s,p) {
 part('heat-sink',[.027,0,w-.027,.069],.115,.591,p.graphite);
 for(let i=0;i<12;i++)part('cooling-fin-'+i,[.033+i*.029,.019,.042+i*.029,.125],.114,.588,p.silver);
 s.cushion('inverter-housing',w/2,.151,.435,w-.019,.173,.614,.025,p.enamel);
 part('indicator-window',[w*.22,d-.005,w*.78,d-.001],.335,.071,p.display);
 for(let i=0;i<3;i++)part('status-'+i,[.134+i*.060,d-.001,.146+i*.060,d],.365,.008,p.led);
 iconPlantMark(context,s,'FALOWNIK HYBRYDOWY',w/2,d-.001,.582,.227,.044);
 for(const [i,[u,v,z]] of [[.065,.139,.109],[.135,.139,.109],item.ports.ac,item.ports.batteryPlus,item.ports.batteryMinus].entries()){
  s.disc('cable-gland-'+i,u,v,z,.019,.019,.037,p.graphite);
  if(i<2)s.tube('cable-'+i,[[u,.139,.113],[u,.139,.079],[u,.114,.040],[u,.079,.031],[u,.006,.031]],.007,i<2?p.black:p.silver);
 }
}

function iconHeatPumpLouvres(THREE,width,count,pitch,depth,thickness) {
 const section=[[0,0],[depth,-.004],[depth,-.004+thickness],[0,thickness]];
 const vertices=[],indices=[];
 for(let i=0;i<count;i++){
  const offset=vertices.length/3;
  for(const u of [0,width])for(const [v,z] of section)vertices.push(u,v,z+i*pitch);
  for(const [a,b,c,d] of [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
   indices.push(offset+a,offset+c,offset+b,offset+a,offset+d,offset+c);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
 const folded=geometry.toNonIndexed();folded.computeVertexNormals();return folded;
}

function iconThermatecFan(THREE,s,line,mat) {
 const u=.429,v=.934,z=.725,r=.290;
 line('fan-recess',[u,v-.004,z],[u,v-.003,z],r+.021,mat.shadow);
 for(let i=0;i<3;i++){
  const blade=new THREE.Shape();blade.moveTo(.042,-.021);
  blade.bezierCurveTo(.132,-.043,.221,-.172,.279,-.055);
  blade.quadraticCurveTo(.307,.012,.276,.089);
  blade.quadraticCurveTo(.187,.123,.059,.053);blade.closePath();
  const rotor=new THREE.ShapeGeometry(blade,10).rotateZ(i*2*Math.PI/3).rotateX(Math.PI/2);
  s.add('fan-blade-'+i,rotor,mat.rotor,u,v,z);
 }
 line('fan-hub',[u,v-.008,z],[u,v+.003,z],.066,mat.rotor);
}

function iconThermatecBadge(context,s) {
 const {THREE}=context;
 if(typeof document==='undefined')return;
 const canvas=document.createElement('canvas');canvas.width=96;canvas.height=512;
 const ink=canvas.getContext('2d');
 ink.translate(48,256);ink.rotate(-Math.PI/2);ink.textAlign='center';ink.textBaseline='middle';
 ink.fillStyle='#eef1ef';ink.font='bold 64px Arial,sans-serif';ink.fillText('THERMATEC',0,0,472);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const print=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false});
 s.add('wordmark',iconLabelPlane(context,.082,.445),print,1.025,.956,.725).castShadow=false;
}

function iconPlantOutdoorUnit(context) {
 const spec=context.data.outdoorHeatPump;
 if(!spec)return;
 const {THREE,group,obstacle,material}=context,start=group.children.length;
 const frame=iconInteriorFurnitureFrame(context,{...spec,room:'outdoors'}),{part,line}=frame;
 const s=iconLivingShapes(context,frame,8),p=iconPlantPalette(context);
 const mat={
  shell:material('#202224',{name:'Thermatec matte black ASA housing',roughness:.64}),
  blades:material('#36383a',{name:'Black moulded discharge louvres',roughness:.57}),
  shadow:material('#101215',{name:'Heat exchanger shadow',roughness:.86}),
  rotor:material('#313438',{name:'Dark moulded axial rotor',roughness:.66}),
 };
 const foot=.34,top=foot+.795;
 for(const [i,u] of [.185,1.015].entries()){
  part('precast-support-'+i,[u-.074,.505,u+.074,1.002],0,.245,context.mats.tile);
  part('rubber-foot-'+i,[u-.050,.524,u+.050,.980],.245,.095,p.graphite);
  part('mounting-rail-'+i,[u-.035,.542,u+.035,.962],foot,.023,mat.shell);
 }
 // R290-020-1P-DTU, measured to the casing. The mounting feet project beyond its depth.
 s.cushion('weatherproof-cabinet',.6155,.743,foot+.409,1.136,.370,.772,.027,mat.shell);
 for(const [id,back,front,low,high] of [
  ['rear',.558,.585,.036,.778],['front',.836,.928,.036,.778],
  ['bottom',.585,.836,.036,.096],['top',.585,.836,.707,.778],
 ])part('intake-surround-'+id,[.0165,back,.075,front],foot+low,high-low,mat.shell);
 part('intake-plenum',[.042,.584,.051,.837],foot+.095,.613,mat.shadow);
 part('fan-chamber',[.033,.923,.820,.929],foot+.059,.656,mat.shadow);
 iconThermatecFan(THREE,s,line,mat);
 part('lid',[.024,.550,1.176,.955],top-.037,.028,mat.shell);
 part('lower-sill',[.029,.551,1.171,.955],foot+.034,.024,mat.shell);
 s.cushion('service-cover',1.023,.933,.729,.273,.046,.633,.025,mat.shell);
 const louvres=iconHeatPumpLouvres(THREE,.778,20,.032,.019,.010);
 s.add('discharge-louvres',louvres,mat.blades,.033,.938,foot+.073);
 const coil=iconHeatPumpLouvres(THREE,.811,56,.011,.008,.003);
 s.add('rear-exchanger-fins',coil,mat.blades,.031,.550,foot+.095);
 const intake=s.add('side-intake-fins',iconHeatPumpLouvres(THREE,.251,44,.014,.007,.004),mat.blades,.024,.585,foot+.10);
 intake.rotateZ(Math.PI/2);
 iconThermatecBadge(context,s);
 for(const [i,z] of [.331,.570].entries()){
  line('insulated-line-'+i,[1.017,.556,foot+z],[1.017,0,foot+z],.026,mat.rotor);
  line('wall-collar-'+i,[1.017,.001,foot+z],[1.017,.019,foot+z],.043,mat.shell);
 }
 for(const mesh of group.children.slice(start))mesh.userData.furnitureId=spec.id;
 obstacle(spec.id,spec.box,0,top);
}

function iconGroundRoomFurniture(context,frame) {
 const id=frame.item.id;
 const draw=iconGroundRoomBuilders[id];
 if(!draw)return false;
 const p=['0.1','0.3'].includes(frame.item.room)?iconPlantPalette(context):frame.item.room==='0.8'||frame.item.room==='0.9'?iconBedroomOfficePalette(context):iconLivingPalette(context);
 const segments=draw===iconStudyDesk?3:5;
 draw(context,frame,iconLivingShapes(context,frame,segments),p);
 return true;
}

const iconGroundRoomBuilders={
 'heat-pump-module':iconPlantHydrobox,
 'dhw-cylinder':iconPlantCylinder,
 'utility-hrv':iconPlantHrv,
 'utility-softener':iconPlantSoftener,
 'utility-water-meter':iconPlantMeter,
 'utility-network-rack':iconPlantRack,
 'utility-pv-inverter':iconPlantInverter,
 'utility-battery':iconPlantBattery,
 'utility-distribution-board':iconPlantBoard,
 'garage-wallbox':iconGarageWallbox,
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

function iconPrivateBathEtching(THREE) {
 const mat=new THREE.MeshStandardMaterial({name:'Sepia tigers and tropical fronds on ivory',color:'#e3d9c7',roughness:.89});
 if(typeof document==='undefined')return mat;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ink=canvas.getContext('2d');
 ink.fillStyle='#e5decc';ink.fillRect(0,0,512,512);
 const trace=(d,color,width=.9)=>{ink.strokeStyle=color;ink.lineWidth=width;ink.stroke(new Path2D(d));};
 const wash=(d,color)=>{ink.fillStyle=color;ink.fill(new Path2D(d));};
 function fern(x,y,scale,rotation){
  ink.save();ink.translate(x,y);ink.rotate(rotation);ink.scale(scale,scale);
  trace('M0 0 Q-18 -66 5 -151','#988f75',1.35);
  for(let i=0;i<15;i++)for(const side of [-1,1]){
   const t=i/16,h=-9-i*9.1,x=4*t*t-8*Math.sin(Math.PI*t),reach=side*(10+48*Math.sin(Math.PI*(.1+.88*t)));
   ink.save();ink.translate(x,h);ink.scale(side,1);
   const l=Math.abs(reach),lift=11+13*t;
   const leaf='M0 0 Q'+l*.35+' '+(-lift-9)+' '+l+' '+(-lift-11)+' Q'+l*.55+' '+(-lift+5)+' 0 0Z';
   wash(leaf,'#d2c9b1');trace(leaf,'#a89d82',.85);
   trace('M0 0 Q'+l*.46+' '+(-lift)+' '+l+' '+(-lift-11),'#aca288',.65);
   for(let j=1;j<7;j++){const f=j/8;trace('M'+l*f+' '+(-lift*f-5*f)+'l4 -4','#b2a78c',.56);}
   ink.restore();
  }
  ink.restore();
 }
 function tiger(x,y,angle){
  ink.save();ink.translate(x,y);ink.rotate(angle);ink.scale(1.04,1.04);
  const body='M-84 -6 C-74 -26 -51 -25 -33 -22 C-11 -18 11 -29 31 -26 Q45 -26 51 -21 L56 -30 Q63 -35 65 -24 Q74 -22 76 -18 L84 -15 86 -9 81 -7 Q80 1 70 0 L60 -1 Q54 5 49 8 L50 24 59 40 Q61 46 50 45 L43 40 33 19 29 8 Q10 16 -19 9 L-39 9 Q-45 20 -55 25 L-58 41 -53 44 Q-58 48 -67 45 L-68 39 -69 20 -62 8 Q-73 7 -80 0Z';
  trace('M-78 -8 C-109 -16 -107 19 -126 20 Q-140 21 -141 11','#9c9178',6.4);
  trace('M-78 -8 C-109 -16 -107 19 -126 20 Q-140 21 -141 11','#d7cbb0',3.4);
  wash('M-49 4Q-47 21 -32 24L-20 38 -13 40Q-11 45 -22 44L-42 32 -61 21Z M38 4L34 25 22 38 25 42 17 44 13 40 24 20 23 7Z','#b4a88b');
  wash(body,'#d4c7aa');trace(body,'#96896e',1.6);
  for(const [i,at] of [-72,-63,-51,-40,-28,-16,-4,9,21,31,42].entries()){
   const base=-19-3*Math.cos(i*.66),drop=12+11*Math.abs(Math.sin(i*4.1));
   wash('M'+at+' '+base+'q-1 6 5 '+drop+'q-8 -6 -10 '+(-drop+2)+'z','#9c9075');
   trace('M'+(at-4)+' 6q5 -4 6 -9','#aa9b7e',1.7);
  }
  wash('M59 -26Q63 -31 63 -24Z M71 -17l7 1 -5 1z M80 -10l5 -1 -2 3z','#81765f');
  for(const path of ['M50 -19q7 1 10 5','M53 -14q5 1 8 6','M70 -8q-4 1 -8 0','M69 -6l-10 2','M63 -2l-8 3','M44 27l7 -2','M-66 32l8 -3'])trace(path,'#988a6f',1.25);
  ink.restore();
 }
 for(const dx of [-512,0,512])for(const dy of [-512,0,512]){
  ink.save();ink.translate(dx,dy);
  for(const f of [[5,108,.73,.64],[66,216,1,-.63],[190,92,.77,.94],[272,247,.94,.58],[420,164,1.02,-.5],
   [494,242,.67,.85],[62,413,.92,.42],[171,502,1.13,-.52],[323,428,.93,.55],[458,486,.89,-.4]]){
   if(f[0]+dx>=-170&&f[0]+dx<=682&&f[1]+dy>=-170&&f[1]+dy<=682)fern(...f);
  }
  if(!dx&&!dy){tiger(161,153,-.08);ink.save();ink.translate(512,0);ink.scale(-1,1);tiger(156,340,.06);ink.restore();}
  ink.restore();
 }
 mat.color.set(0xffffff);mat.map=new THREE.CanvasTexture(canvas);mat.map.colorSpace=THREE.SRGBColorSpace;
 mat.map.wrapS=mat.map.wrapT=THREE.RepeatWrapping;mat.map.repeat.set(.70,.70);mat.map.anisotropy=4;
 return mat;
}

function iconPrivateShowerGlass(THREE) {
 const mat=iconFinishTexture(THREE,'Pressed sage glass with square relief',160,320,.18,(u,v)=>{
  const x=(u*4)%1,y=(v*8)%1,edge=Math.min(x,1-x,y,1-y);
  const t=edge<.025?-54:edge<.058?27:edge<.078?-14:4*Math.sin(12*x+3*Math.sin(y*4))*Math.sin(14*y+3*x);
  return [170+t,194+t,171+t];
 });
 const map=mat.map,{width,height,data}=map.image;
 for(let j=0;j<height;j++)for(let i=0;i<width;i++){
  const x=(i+.5)/width*4%1,y=(j+.5)/height*8%1;
  data[4*(j*width+i)+3]=Math.min(x,1-x,y,1-y)<.074?168:55;
 }
 mat.transparent=true;mat.depthWrite=false;return mat;
}

function iconBrecciaCounter(THREE) {
 return iconFinishTexture(THREE,'Espresso breccia with ivory and amber veins',384,256,.27,(u,v)=>{
  const x=2*Math.PI*u,y=2*Math.PI*v,warp=Math.sin(x-y)+.36*Math.sin(3*x+2*y)+.11*Math.cos(5*x-7*y);
  const line=Math.abs(Math.sin(x+2*y+warp)),secondary=Math.abs(Math.sin(3*x-y+.68*Math.sin(2*y-x)));
  const vein=Math.exp(-line*line/.0018),thread=Math.exp(-secondary*secondary/.0012);
  const grain=4*Math.cos(67*x-51*y)+7*Math.sin(3*x-2*y)*Math.sin(4*y)+4*Math.sin(13*x+y);
  return [57+grain+156*vein+65*thread,44+grain+142*vein+50*thread,41+grain+124*vein+35*thread];
 },[1.8,1.8]);
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
  biscuit:glaze('Warm biscuit satin tile',[[220,211,190],[225,216,198],[217,207,188],[223,214,195]],[176,165,145],.235,.155),
  orange:new THREE.MeshPhysicalMaterial({name:'Tangerine enamel',color:'#ef740c',roughness:.22,clearcoat:.85,clearcoatRoughness:.16}),
  custard:plain('Butter ochre enamel','#d7b477',.39),espresso:plain('Dark bronze handles','#52382d',.32,.36),
  chrome:plain('Polished chrome','#d1d6d3',.18,.64),sage:plain('Sage enamel glazing channel','#95a895',.29,.18),
  sageGlass:iconPrivateShowerGlass(THREE),etching:iconPrivateBathEtching(THREE),breccia:iconBrecciaCounter(THREE),
  cream:plain('Ivory solid surface','#dbd1b8',.46),honey:plain('Ochre lacquer','#bf843d',.43),
  nickel:plain('Brushed nickel','#babdb8',.32,.56),
  amber:plain('Amber glass','#714527',.22,.12),
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
  if(edge<.0035)return [159,139,116];
  const xi=Math.floor(u*116),yi=Math.floor(v*73),cell=Math.sin(xi*63.97+yi*35.60)*41031;
  const fossil=cell-Math.floor(cell)>.92 && (u*116%1+v*73%1*.7)<.83;
  const cloud=4*Math.sin(16*u+5*Math.cos(9*v))*Math.cos(15*v+u*4)+2*Math.cos(44*v+2*Math.sin(15*u));
  const shade=cloud+(fossil?-22:0);
  return [202,174,145].map(c=>c+shade);
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
 const metal=family?p.nickel:p.chrome;
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

function iconPrivateMirrorSilver(THREE,p) {
 if(!p.etching.map)return p.silver;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=360;
 const ink=canvas.getContext('2d');
 ink.fillStyle='#c1cabf';ink.fillRect(0,0,512,360);
 ink.globalAlpha=.38;
 for(const x of [-150,106,362])ink.drawImage(p.etching.map.image,x,-12,256,256);
 ink.globalAlpha=1;
 const shade=ink.createLinearGradient(0,0,512,280);
 shade.addColorStop(0,'rgba(85,98,89,.32)');shade.addColorStop(.48,'rgba(226,235,224,.22)');shade.addColorStop(1,'rgba(137,148,147,.18)');
 ink.fillStyle=shade;ink.fillRect(0,0,512,360);
 ink.fillStyle='rgba(135,137,119,.55)';ink.fillRect(0,243,512,1.8);
 for(let x=-24;x<512;x+=80)ink.fillRect(x,245,1.3,115);
 for(let y=287;y<360;y+=49)ink.fillRect(0,y,512,1.2);
 ink.fillStyle='rgba(133,157,143,.22)';ink.fillRect(302,0,210,360);
 for(let x=300;x<512;x+=65){
  ink.fillStyle='#99a89a';ink.fillRect(x,0,3,360);ink.fillStyle='#d4dcd0';ink.fillRect(x+3,0,1.8,360);
 }
 for(let y=31;y<360;y+=65){
  ink.fillStyle='#a2afa2';ink.fillRect(300,y,212,2.6);ink.fillStyle='#d4dcd0';ink.fillRect(300,y+3,212,1.8);
 }
 const light=ink.createLinearGradient(0,0,335,190);
 light.addColorStop(0,'rgba(255,255,242,.31)');light.addColorStop(.31,'rgba(255,255,248,.09)');light.addColorStop(1,'rgba(255,255,248,0)');
 ink.fillStyle=light;ink.fillRect(0,0,512,360);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
 return new THREE.MeshStandardMaterial({name:'Silvered glass with opposite wall reflection',map,roughness:.14,metalness:.21});
}

function iconPrivateVanityMirror(context,p) {
 const {THREE,mesh}=context,cy=6.975,cz=4.825,halfW=.709,halfH=.493,r=.145;
 function outline(w,h,radius){
  const path=new THREE.Shape();
  path.moveTo(0,-h);path.lineTo(w-radius,-h);path.absarc(w-radius,-h+radius,radius,-Math.PI/2,0,false);
  path.lineTo(w,h-radius);path.absarc(w-radius,h-radius,radius,0,Math.PI/2,false);
  path.lineTo(-w+radius,h);path.absarc(-w+radius,h-radius,radius,Math.PI/2,Math.PI,false);
  path.lineTo(-w,-h+radius);path.absarc(-w+radius,-h+radius,radius,Math.PI,Math.PI*1.5,false);
  path.closePath();return path;
 }
 const g=new THREE.ShapeGeometry(outline(halfW,halfH,r),24),pos=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/(2*halfW)+.5,pos.getY(i)/(2*halfH)+.5);
 g.rotateX(Math.PI/2);g.rotateZ(-Math.PI/2);
 mesh(g,iconPrivateMirrorSilver(THREE,p),'bath-private-vanity-mirror').position.set(11.518,cy,cz);
 const rim=outline(halfW,halfH,r),length=rim.getLength(),joins=[.034,.273,.534,.773,1.034];
 for(let k=0;k<4;k++){
  const vertices=[],indices=[],rings=52,sides=18,start=joins[k],end=joins[k+1];
  for(let i=0;i<=rings;i++){
   const q=(1-Math.cos(Math.PI*i/rings))/2,t=start+(end-start)*q,at=rim.getPointAt(t%1),tan=rim.getTangentAt(t%1);
   const terminal=Math.min(q,1-q)*(end-start)*length,cap=.018,rad=.070*Math.sqrt(1-(Math.max(0,1-terminal/cap))**2);
   for(let j=0;j<=sides;j++){
    const angle=j/sides*2*Math.PI,side=rad*Math.sin(angle);
    vertices.push(11.473-rad*.86*Math.cos(angle),cy+at.x+side*tan.y,cz+at.y-side*tan.x);
    if(i<rings&&j<sides){
     const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);
    }
   }
  }
  const tube=new THREE.BufferGeometry();tube.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  tube.setIndex(indices);tube.computeVertexNormals();mesh(tube,p.orange,'bath-private-tangerine-frame-'+k);
 }
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
 const privateWall=(id,a,b,top,mat=p.biscuit)=>{
  tile('bath-private-'+id,a,b,top,mat);
  iconUpperBathWall(context,'bath-private-paint-'+id,a,b,top,Infinity,p.etching);
 };
 privateWall('double-vanity',[11.548,7.887],[11.548,5.115],4.34);
 privateWall('shower',[8.912,5.226],[8.912,6.50],4.34);
 for(const side of [-1,1]){
  const y=5.4+.51+side*.15*.64;
  beam('bath-private-mixer-feed-'+side,[8.912,y,4.24],[8.95,y,4.24],.015,p.chrome);
 }
 privateWall('towel-wall',[8.912,6.50],[8.912,7.887],4.31);
 privateWall('door-left',[8.912,7.888],[9.997,7.888],4.31);
 privateWall('door-right',[10.902,7.888],[11.548,7.888],4.31);
 const capZ=4.176;
 box('bath-private-service-ledge',[8.913,4.82,11.545,5.132],floor,capZ-floor,p.biscuit);
 tile('bath-private-service-glaze',[11.545,5.133],[8.913,5.133],capZ,p.biscuit);
 box('bath-private-ledge-cap',[8.913,4.82,11.545,5.143],capZ,.024,p.cream);
 context.obstacle('bath-private-service-ledge',[8.913,4.82,11.545,5.143],floor,capZ+.024);
 vessel('bath-private-oil-flask',10.90,5.018,capZ+.024,.041,.176,p.amber);
 vessel('bath-private-bath-salts',11.035,5.001,capZ+.024,.065,.122,p.cream);
 for(const y of [6.704,7.29])beam('bath-private-rail-bracket-'+y,[8.913,y,4.36],[8.986,y,4.36],.012,p.chrome);
 beam('bath-private-towel-bar',[8.986,6.687,4.36],[8.986,7.305,4.36],.010,p.chrome);
 const towel=iconFinishTexture(THREE,'Ivory ribbed linen with olive selvedges',128,128,.94,(u,v)=>{
  const stripe=v<.03||v>.97||v>.115&&v<.133;
  const rib=4*Math.sin(u*67*Math.PI*2);
  return (stripe?[104,112,74]:[212,202,182]).map(c=>c+rib);
 });
 box('bath-private-hand-towel',[8.98,6.79,9.006,7.206],3.864,.508,towel);
 box('bath-private-counter-bridge',[11.05,6.90,11.55,7.05],4.038,.027,p.breccia);
 box('bath-private-cabinet-bridge',[11.081,6.90,11.55,7.05],3.415,.621,p.custard);
 iconPrivateVanityMirror(context,p);
 iconUpperBathLamp(context,'private-basins',11.547,6.02,4.82,false);
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

function iconExteriorTexture(THREE,width,height,pixels,name,color=false){
 const map=new THREE.DataTexture(pixels,width,height);
 map.name=name;map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;
 if(color)map.colorSpace=THREE.SRGBColorSpace;
 return map;
}

function iconStoneNoise(x,y,seed){
 let n=Math.imul(x+13,374761393)+Math.imul(y+seed,668265263);
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967296;
}

function iconPlinthPorcelain(THREE,timberColor){
 const w=256,h=64,pixels=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const stone=201+18*iconStoneNoise(x,y,91)+6*iconStoneNoise(x>>2,y>>2,29);
  const edge=x===0||y===h-1,shade=edge?155:stone;
  pixels.set([shade,shade,shade+2,255],(y*w+x)*4);
 }
 const map=iconExteriorTexture(THREE,w,h,pixels,'Rectified graphite porcelain · 1200 × 300 mm',true);
 // Facade projection spans 1.44 × 4.4 m per UV repeat.
 map.repeat.set(1.44/1.2,4.4/.30);
 return new THREE.MeshStandardMaterial({name:'Black porcelain plinth',color:timberColor,map,roughness:.58,side:THREE.DoubleSide});
}

function iconBasaltMaterial(THREE){
 const n=512,tileM=.48,color=new Uint8Array(n*n*4),height=new Uint8Array(n*n*4);
 const relief=new Float32Array(n*n).fill(-1);
 for(let i=0;i<n*n;i++){
  const tone=37+17*iconStoneNoise(i%n,Math.floor(i/n),51);
  color.set([tone,tone,tone+1,255],4*i);height.set([33,33,33,255],4*i);
 }
 // Two layers of randomly oriented pebbles leave shadowed crevices above the bedding.
 for(let id=0;id<1000;id++){
  const rng=seed=>iconStoneNoise(id,seed,109);
  const a=(.016+.014*rng(1))*n/(2*tileM),b=.016*n/(2*tileM)+(a-.016*n/(2*tileM))*rng(2);
  const cx=rng(3)*n,cy=rng(4)*n,angle=2*Math.PI*rng(5),c=Math.cos(angle),s=Math.sin(angle);
  const base=id<590?0:.31,peak=.32+.36*rng(6),stone=55+40*rng(7)+(rng(8)>.93?14:0);
  for(let y=Math.floor(cy-a-1);y<=cy+a+1;y++)for(let x=Math.floor(cx-a-1);x<=cx+a+1;x++){
   const dx=x-cx,dy=y-cy,u=(dx*c+dy*s)/a,v=(dy*c-dx*s)/b;
   const oval=u*u+v*v+.09*u*v*(u-v);
   if(oval>=1)continue;
   const crown=Math.sqrt(1-oval),z=base+peak*crown,i=(x+n)%n+((y+n)%n)*n;
   if(z<relief[i])continue;
   relief[i]=z;
   const grain=iconStoneNoise(x,y,72),fleck=iconStoneNoise(x>>1,y>>1,113);
   const tone=stone*(.69+.31*crown)+7*(grain-.5)+(fleck>.965?10:0);
   const h=39+190*z;
   color.set([tone,tone+1,tone+2.5,255],i*4);height.set([h,h,h,255],i*4);
  }
 }
 const mat=new THREE.MeshStandardMaterial({name:'Washed basalt pebbles · 16–30 mm',
  map:iconExteriorTexture(THREE,n,n,color,'Washed basalt · rounded charcoal stone',true),
  bumpMap:iconExteriorTexture(THREE,n,n,height,'Rounded pebble crowns and recessed gaps'),bumpScale:.011,roughness:.76});
 mat.userData.gradingMm=[16,30];mat.userData.textureExtentM=tileM;
 return mat;
}

function iconGardenFootprint(ring,house){
 const span=(i)=>{
  const [a,b]=house.meshes.find(m=>m.id==='garden-pier-0-wall-'+i).vertices;
  return Math.hypot(a[0]-b[0],a[1]-b[1]);
 };
 const direction=(a,b)=>{const d=b.map((v,k)=>v-a[k]);return d.map(v=>v/Math.hypot(...d));};
 const a=ring[6],b=ring[7],across=direction(a,b),out=direction(ring[5],a),width=span(1),depth=span(0);
 const at=(p,u,v)=>p.map((n,k)=>n+across[k]*u+out[k]*v);
 return [...ring.slice(0,6),at(a,0,depth),at(a,width,depth),at(a,width,0),
  at(b,-width,0),at(b,-width,depth),at(b,0,depth)];
}

function iconGardenPierPlinth({THREE,scene,mats}){
 for(const wall of scene.children.filter(o=>/^garden-pier-\d+-wall-\d+$/.test(o.name))){
  const g=wall.geometry,p=g.attributes.position,positions=[],uv=[];
  const low=[0,1].map(i=>new THREE.Vector3().fromBufferAttribute(p,i));
  const span=low[0].distanceTo(low[1]);
  for(const z of [0,.30,2.8])for(let i=0;i<2;i++){
   positions.push(low[i].x,low[i].y,z);uv.push(i*span/1.44,z/4.4);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex([0,1,3,0,3,2,2,3,5,2,5,4]);geometry.computeVertexNormals();
  geometry.addGroup(0,6,0);geometry.addGroup(6,6,1);
  wall.geometry=geometry;wall.material=[mats.plinth,wall.material];g.dispose();
 }
}

function iconApronOuterRing(ring,width=.655){
 const area=ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
 return iconInteriorInsetSlab(ring,ring,area>0?-width:width);
}

function iconGardenTerraceReturn({THREE,scene,group,data,world},ring){
 const wall=data.facades.find(f=>f.id==='facade-garden'),opening=wall.openings[0];
 const facade=wall.a[1],glass=facade-iconGroundFacadeDepth(wall)/2;
 const [right,front]=ring[7],[left]=ring[10];
 const x0=wall.a[0]+opening.start,x1=wall.a[0]+opening.end,panel=(x1-x0)/opening.panels;
 const leaf=group.getObjectByName('living-garden-slider');
 const shoe=leaf.children.find(part=>part.name==='living-slider-shoe');
 const slidingThreshold=leaf.position.y+shoe.position.y+shoe.geometry.parameters.height/2;
 const deck=[],drain=[],sill=[],zones=[];
 const quad=(vertices,a,b,c,d,near,far)=>{
  const points=[[a,b,near],[c,b,near],[c,d,far],[a,d,far]].map(world);
  for(const i of [0,2,1,0,3,2])vertices.push(...points[i]);
  if(d>b)zones.push([[a,b],[c,b],[c,d],[a,d]]);
 };
 const lip=.014,bottom=.003,slot=glass+.030,slotEnd=slot+.012,edge=.006;
 quad(deck,left,facade,right,front,.080,.080);
 // Only the 24 cm frame reveal changes level. The boards between the piers stay horizontal.
 quad(deck,x0,slotEnd+edge,x1,facade,lip,.080);
 quad(sill,x0,glass,x1,slot-edge,.018,lip);
 quad(sill,x0+panel,slidingThreshold,x1-panel,glass,.018,.018);
 quad(drain,x0,slot-edge,x1,slot,lip,lip);
 quad(drain,x0,slot,x1,slot,lip,bottom);
 quad(drain,x0,slot,x1,slotEnd,bottom,bottom);
 quad(drain,x0,slotEnd,x1,slotEnd,bottom,lip);
 quad(drain,x0,slotEnd,x1,slotEnd+edge,lip,lip);
 const surface=(vertices,name,kind,properties)=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const part=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({...properties,side:THREE.DoubleSide}));
  part.name=name;part.userData.kind=kind;part.receiveShadow=true;scene.add(part);
 };
 // World coordinates keep board grain and seams aligned across the original deck edge.
 surface(deck,'surface-terrace','icon-garden-threshold',{color:'#b5a38d',roughness:.84});
 surface(sill,'icon-garden-sill','threshold-flashing',{color:'#686967',metalness:.55,roughness:.59});
 surface(drain,'icon-garden-slot-drain','threshold-drain',{color:'#393b39',metalness:.48,roughness:.68});
 return zones;
}

function iconBasaltApron(context,paving=[]){
 const {THREE,group,data,mesh,house}=context;
 const ring=iconGardenFootprint(data.exterior.ground,house);
 const basaltEdge=iconApronOuterRing(ring,.60),curbEdge=iconApronOuterRing(ring);
 const inverse=group.matrix.clone().invert(),point=new THREE.Vector3();
 const zones=paving.map(({ring})=>ring.map(([x,y])=>{
  point.set(x,y,0).applyMatrix4(inverse);
  return [point.x,point.y].map(v=>Math.round(v*1e5)/1e5);
 }));
 zones.push(...iconGardenTerraceReturn(context,ring));
 // The apron, terrace, entry and driveway all have orthogonal edges in the house frame.
 const corners=[ring,basaltEdge,curbEdge,...zones].flat();
 const cuts=[0,1].map(k=>[...new Set(corners.map(p=>Number(p[k].toFixed(5))))].sort((a,b)=>a-b));
 const [xs,ys]=cuts,basalt=[],curb=[],curbCells=new Set();
 const quad=(positions,a,b,c,d)=>positions.push(...a,...b,...c,...a,...c,...d);
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
  const a=xs[i-1],b=ys[j-1],c=xs[i],d=ys[j],center=[(a+c)/2,(b+d)/2];
  if(!iconInteriorContains(center,curbEdge)||iconInteriorContains(center,ring)||zones.some(zone=>iconInteriorContains(center,zone)))continue;
  const isStone=iconInteriorContains(center,basaltEdge),z=isStone?.071:.08;
  quad(isStone?basalt:curb,[a,b,z],[c,b,z],[c,d,z],[a,d,z]);
  if(!isStone)curbCells.add(i+','+j);
 }
 for(const key of curbCells){
  const [i,j]=key.split(',').map(Number),a=xs[i-1],b=ys[j-1],c=xs[i],d=ys[j];
  for(const [di,dj,p,q] of [[0,-1,[a,b],[c,b]],[1,0,[c,b],[c,d]],[0,1,[c,d],[a,d]],[-1,0,[a,d],[a,b]]]){
   if(!curbCells.has((i+di)+','+(j+dj)))quad(curb,[...p,.016],[...q,.016],[...q,.08],[...p,.08]);
  }
 }
 const surface=(name,vertices,mat,width)=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const uv=[];for(let i=0;i<vertices.length;i+=3)uv.push(vertices[i]/.48,vertices[i+1]/.48);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  const part=mesh(geometry,mat,name);part.castShadow=false;part.userData.widthM=width;
 };
 surface('icon-basalt-apron',basalt,iconBasaltMaterial(THREE),.60);
 const edging=new THREE.MeshStandardMaterial({name:'Anthracite concrete garden edging',color:'#484947',roughness:.93,side:THREE.DoubleSide});
 surface('icon-basalt-curb',curb,edging,.055);
}

function iconExteriorFittings({THREE,scene,group,data}){
 const bezel=new THREE.MeshStandardMaterial({name:'Brushed anthracite uplight bezel',color:'#696b65',roughness:.42,metalness:.72});
 const opal=new THREE.MeshStandardMaterial({name:'Exterior 2700 K recessed optic',color:'#c3bda6',emissive:'#ffca8b',emissiveIntensity:0,roughness:.22});
 const rim=new THREE.CylinderGeometry(.069,.064,.018,32).rotateX(Math.PI/2);
 const lens=new THREE.CircleGeometry(.045,32);
 const locations=[['garage',.51],['garage',6.51],['front-wing',1.30],['front-wing',4.21],
  ['wing-end',2.25],['wing-rear',4.24],['terrace',.61],['main-side',2.75],['main-side',14.68]];
 const ground=[group.getObjectByName('icon-basalt-apron'),...scene.children.filter(o=>
  o.isMesh&&/^(?:parcel-grass-193|surface-(?:entry|driveway|terrace|paving|gravel|path|planting|lawn))$/.test(o.name))];
 scene.updateMatrixWorld(true);
 const down=new THREE.Vector3(0,0,-1),ray=new THREE.Raycaster();
 const fittings=locations.map(([id,u])=>{
  const facade=data.facades.find(f=>f.id==='facade-'+id),vertical=facade.a[0]===facade.b[0];
  const nx=vertical?(facade.a[0]===0?-1:1):0,ny=vertical?0:(facade.a[1]<5?-1:1);
  const x=facade.a[0]+(vertical?0:u)+.34*nx,y=facade.a[1]+(vertical?u:0)+.34*ny;
  ray.set(group.localToWorld(new THREE.Vector3(x,y,1)),down);
  const grade=ray.intersectObjects(ground,false)[0]?.point.z??0;
  const root=new THREE.Group();root.name='icon-exterior-uplight-'+id+'-'+u;
  root.position.set(x,y,grade);group.add(root);
  const trim=new THREE.Mesh(rim,bezel);trim.position.z=-.006;trim.receiveShadow=true;root.add(trim);
  const aperture=new THREE.Mesh(lens,opal);aperture.name='uplight-aperture';aperture.position.z=.004;root.add(aperture);
  return {root,aperture,id:facade.id,x,y,z:grade+aperture.position.z,nx,ny};
 });
 return {fittings,opal};
}

function iconExteriorIrradiance(lamps,x,y,z){
 let sum=0;
 for(const lamp of lamps){
  const dx=x-lamp.x,dy=y-lamp.y,dz=z-lamp.z;
  if(dz<=0)continue;
  const inward=-(dx*lamp.nx+dy*lamp.ny),tangent=dx*lamp.ny-dy*lamp.nx;
  const r2=dx*dx+dy*dy+dz*dz;
  // An asymmetric optic aims 18 degrees towards the wall and spreads more in the vertical plane.
  const axis=.309*inward+.951*dz,radial=.951*inward-.309*dz;
  const across=tangent/(.035+.35*axis),depth=radial/(.035+.58*axis);
  const beam=Math.exp(-2*(across*across+depth*depth));
  sum+=beam*inward/Math.sqrt(r2)*128/(.30+r2);
 }
 return sum;
}

function iconBakedExteriorMap(THREE,width,height,name,sample){
 const pixels=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const flux=1-Math.exp(-sample((x+.5)/width,(y+.5)/height)/24),p=4*(y*width+x);
  pixels[p]=255*flux;pixels[p+1]=153*flux;pixels[p+2]=78*flux;pixels[p+3]=255;
 }
 const map=iconExteriorTexture(THREE,width,height,pixels,name);
 map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.channel=1;
 return map;
}

function iconExteriorLightmaps({THREE,group,data},fittings){
 const replacements=new Map(),facades=data.facades;
 const upperByFacade={'facade-garage':'front-gable','facade-wing-end':'wing-gable',
  'facade-main-side':'upper-main-side','facade-front-wing':'upper-front-wing',
  'facade-wing-rear':'upper-rear-wing','facade-terrace':'upper-terrace-side'};
 const faces=facades.map(f=>{
  const axis=f.a[0]===f.b[0]?1:0,aligned=[group.getObjectByName(f.id)];
  if(upperByFacade[f.id])aligned.push(group.getObjectByName(upperByFacade[f.id]));
  // Some upper timber planes extend past the ground floor at the garage and garden.
  const along=data.exterior.upper.map(p=>p[axis]);
  const start=Math.min(...along)-.15,length=Math.max(...along)+.15-start;
  return {axis,aligned,start,length,plane:f.a[1-axis],lights:fittings.filter(l=>l.id===f.id)};
 });
 const base=-.15,wallHeight=data.levels.ridge+.15-base;
 const wallMap=iconBakedExteriorMap(THREE,512,faces.length*128,'Exterior facade grazing light',(u,v)=>{
  const band=v*faces.length,i=Math.floor(band),f=faces[i],z=base+(band-i)*wallHeight;
  const along=f.start+u*f.length;
  return iconExteriorIrradiance(f.lights,f.axis?f.plane:along,f.axis?along:f.plane,z);
 });
 function lightmapped(original){
  if(!replacements.has(original)){
   const mat=original.clone();mat.lightMap=wallMap;mat.lightMapIntensity=0;
   replacements.set(original,mat);
  }
  return replacements.get(original);
 }
 group.updateWorldMatrix(true,true);
 const inverse=group.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),p=new THREE.Vector3();
 function writeUvs(mesh,project){
  const pos=mesh.geometry.attributes.position,uv=new Float32Array(pos.count*2);
  matrix.multiplyMatrices(inverse,mesh.matrixWorld);
  for(let i=0;i<pos.count;i++){
   p.fromBufferAttribute(pos,i).applyMatrix4(matrix);const [u,v]=project(p);
   uv[i*2]=u;uv[i*2+1]=v;
  }
  mesh.geometry.setAttribute('uv1',new THREE.BufferAttribute(uv,2));
 }
 for(const [i,f] of faces.entries())for(const wall of f.aligned){
  writeUvs(wall,p=>[((f.axis?p.y:p.x)-f.start)/f.length,(i+(p.z-base)/wallHeight)/faces.length]);
  wall.material=wall.material.map((m,index)=>index===1||m.name==='Black porcelain plinth'?lightmapped(m):m);
 }
 return [...replacements.values()];
}

function iconExteriorLighting(context){
 const {fittings,opal}=iconExteriorFittings(context);
 const pick=iconVisiblePick(context,fittings.map(f=>f.root)),center=new context.THREE.Vector3();
 function pickNearAperture(ndc,camera,viewport){
  if(pick(ndc,camera))return true;
  if(!viewport)return false;
  for(const {root,aperture} of fittings){
   aperture.getWorldPosition(center).project(camera);
   if(Math.abs(center.z)>1)continue;
   const dx=(ndc.x-center.x)*viewport.clientWidth/2,dy=(ndc.y-center.y)*viewport.clientHeight/2;
   if(dx*dx+dy*dy<=14*14&&pick(center,camera)===root)return true;
  }
  return false;
 }
 let materials=[],night=null,on=false;
 function set(value){
  on=value;opal.emissiveIntensity=on?3.8:0;
  for(const m of materials)m.lightMapIntensity=on?24:0;
 }
 return {
  prepare(){materials=iconExteriorLightmaps(context,fittings);set(on);},
  update(elevation){const next=elevation<=-3;if(next!==night){night=next;set(night);}},
  toggleAt(ndc,camera,viewport){if(!night||!pickNearAperture(ndc,camera,viewport))return false;set(!on);return true;},
  get isOn(){return on;}
 };
}
