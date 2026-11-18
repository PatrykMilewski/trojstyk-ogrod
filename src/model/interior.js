export function addIconInterior(options) {
 const context = iconInteriorSetup(options);
 iconInteriorFloorsAndPartitions(context);
 iconInteriorFacades(context);
 iconInteriorCurtains(context);
 iconInteriorStairs(context);
 iconInteriorOfficeBacking(context);
 iconInteriorFurnishings(context);
 options.fitGarage?.(context);
 iconLivingMediaWall(context);
 iconInteriorLightingAndRoof(context);
 options.joinStory?.(options.THREE,context.group);
 const {group,navigation,data,world} = context;
 return {group,navigation,rooms:data.rooms,metadata:data.metadata,localToWorld:world};
}

const iconInteriorContains = (p,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};

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
 const mesh = (geometry,mat,name) => {const m=new THREE.Mesh(geometry,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const box = (name,b,z,h,mat=mats.wood) => {const m=mesh(new THREE.BoxGeometry(b[2]-b[0],b[3]-b[1],h),mat,name);m.position.set((b[0]+b[2])/2,(b[1]+b[3])/2,z+h/2);return m;};
 const obstacle = (id,b,minZ,maxZ) => navigation.obstacles.push({id,ring:ring(b).map(p=>world(p).slice(0,2)),minZ,maxZ});
 const floor = (id,b,z) => navigation.floors.push({id,ring:ring(b).map(p=>world(p).slice(0,2)),z});
 const path = points => new THREE.Path(points.map(p=>new THREE.Vector2(...p)));
 const slab = (id,outline,holes,z,depth,mat) => {const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));shape.holes=holes.map(path);const m=mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat,id);m.position.z=z;return m;};
 const beamInstances=new Map();
 const beam = (id,a,b,r=.025,mat=mats.metal) => {const key=[a.map(n=>n.toFixed(6)).join(','),b.map(n=>n.toFixed(6)).join(',')].sort().join('|')+'|'+r+'|'+mat.uuid;if(beamInstances.has(key))return beamInstances.get(key);const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat,id);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());beamInstances.set(key,m);return m;};
 const rail = (id,a,b,z,glazed=false) => {
  beam(id+'-top',[...a,z+1.05],[...b,z+1.05]);
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(length/(glazed?1.15:.55)));
  const point=i=>a.map((v,k)=>v+(b[k]-v)*i/count);
  for(let i=0;i<=count;i++){
   const p=point(i);
   beam(id+'-post-'+i,[...p,z],[...p,z+1.05],.017);
   if(glazed && i<count){
    const end=point(i+1);
    const bounds=[0,1].map(k=>Math.min(p[k],end[k])+(p[k]===end[k]?-.005:.021))
     .concat([0,1].map(k=>Math.max(p[k],end[k])+(p[k]===end[k]?.005:-.021)));
    box(id+'-glass-'+i,bounds,z+.018,1.005,mats.glass).castShadow=false;
   }
  }
  obstacle(id,[Math.min(a[0],b[0])-.04,Math.min(a[1],b[1])-.04,Math.max(a[0],b[0])+.04,Math.max(a[1],b[1])+.04],z,z+1.1);
 };
 const ceilingAt = (x,y) => {const slope=(8.3-4.07)/4.25;return Math.max(x<=8.5?8.3-slope*Math.abs(x-4.25):-Infinity,x>=4.25&&y>=4.21&&y<=12.71?8.3-slope*Math.abs(y-8.46):-Infinity)-.045;};
 const wall = (id,a,b,z0,z1,thickness,openings=[],profile=null) => {
  const external=id.startsWith('facade-')||id.startsWith('upper-')||id.endsWith('-gable');
  const omitCaps=external?[a,b].map(p=>iconInteriorConvexCorner(p,z0===0?data.exterior.ground:data.exterior.upper)):[false,false];
  let nx=0,ny=0;if(external){if(Math.abs(a[0]-b[0])<.01)nx=a[0]<.1?-1:1;else ny=a[1]<5?-1:1;a=[a[0]-nx*thickness/2,a[1]-ny*thickness/2];b=[b[0]-nx*thickness/2,b[1]-ny*thickness/2];}
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const outer=profile||[[0,z0],[L,z0],[L,z1],[0,z1]],holes=openings.map(o=>o.wallPoly||o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]]);
  const geometry=iconInteriorWallGeometry(THREE,{a,ux,uy,L,z0,z1,thickness,outer,holes,ceilingAt,sloped:id.startsWith('u-'),external,nx,ny,omitCaps});
  mesh(geometry,external?[mats.wall,mats.dark]:mats.wall,id);
  const cuts=[0,L,...openings.flatMap(o=>[o.start,o.end])].sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){const start=cuts[i-1],end=cuts[i];if(end-start<.001)continue;const opening=openings.find(o=>(start+end)/2>o.start&&(start+end)/2<o.end);const ax=a[0]+ux*start,ay=a[1]+uy*start,bx=a[0]+ux*end,by=a[1]+uy*end,bounds=[Math.min(ax,bx)-Math.abs(uy)*thickness/2,Math.min(ay,by)-Math.abs(ux)*thickness/2,Math.max(ax,bx)+Math.abs(uy)*thickness/2,Math.max(ay,by)+Math.abs(ux)*thickness/2];
   if(!opening)obstacle(id+'-'+i,bounds,z0,z1);else{if(opening.bottom>z0+.01)obstacle(id+'-sill-'+i,bounds,z0,opening.bottom);if(opening.top<z1-.01)obstacle(id+'-header-'+i,bounds,opening.top,z1);}
  }
  for(const [i,o] of openings.entries()){
   const points=o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]],recess=o.recess||0,to3=p=>[a[0]+ux*p[0]-nx*recess,a[1]+uy*p[0]-ny*recess,p[1]];
   if(recess>thickness/2)iconInteriorWindowReveal({THREE,mesh,mats,id:id+'-reveal-'+i,points:o.wallPoly||points,to3,normal:[nx,ny],depth:recess-thickness/2});
   for(let j=0;j<points.length;j++)beam(id+'-opening-'+i+'-frame-'+j,to3(points[j]),to3(points[(j+1)%points.length]),.025,mats.dark);
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
 return {THREE, scene, house, data, group, world, ring, navigation, mats, mesh, box, obstacle, floor, slab, beam, rail, wall, opening, contains, ceilingAt, cutRoof};
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

function iconInteriorConvexCorner(point,ring) {
 const i=ring.findIndex(p=>Math.hypot(p[0]-point[0],p[1]-point[1])<1e-7);
 if(i<0)return false;
 const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];
 return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0;
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

function iconInteriorWallGeometry(THREE,options) {
 const {a,ux,uy,L,z0,z1,thickness,outer,holes,ceilingAt,sloped,external,nx,ny,omitCaps}=options;
 const vertices=[],groups=[],cuts=[0,L,...outer.map(p=>p[0]),...holes.flatMap(p=>p.map(v=>v[0]))];
 const point=(u,d,h)=>{
  const inset=external?thickness/2-(-uy*d*nx+ux*d*ny):0;
  const along=Math.max(omitCaps[0]?inset:0,Math.min(omitCaps[1]?L-inset:L,u));
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
 const quad=(p,q,r,t,material=0)=>{const start=vertices.length/3;vertices.push(...p,...q,...r,...p,...r,...t);groups.push({start,count:6,material});};
 for(let i=1;i<xs.length;i++){
  const start=xs[i-1],end=xs[i];if(end-start<1e-8)continue;const mid=(start+end)/2,lo=bands(start,mid),hi=bands(end,mid);
  for(let j=0;j<lo.length;j++){
   for(const d of [-thickness/2,thickness/2]){const outside=external&&(-uy*d*nx+ux*d*ny)>0;quad(point(start,d,height(start,d,lo[j][0])),point(end,d,height(end,d,hi[j][0])),point(end,d,height(end,d,hi[j][1])),point(start,d,height(start,d,lo[j][1])),outside?1:0);}
   for(const edge of [0,1]){const h0=lo[j][edge],h1=hi[j][edge];if(sloped&&edge===1&&h0===z1&&h1===z1)continue;quad(point(start,-thickness/2,height(start,-thickness/2,h0)),point(end,-thickness/2,height(end,-thickness/2,h1)),point(end,thickness/2,height(end,thickness/2,h1)),point(start,thickness/2,height(start,thickness/2,h0)));}
  }
 }
 for(let i=0;i<xs.length;i++){
  if(i===0&&omitCaps[0]||i===xs.length-1&&omitCaps[1])continue;
  const u=xs[i],left=i?bands(u,(xs[i-1]+u)/2):[],right=i<xs.length-1?bands(u,(u+xs[i+1])/2):[],heights=[...new Set([...left.flat(),...right.flat()])].sort((x,y)=>x-y);
  for(let j=1;j<heights.length;j++){const bottom=heights[j-1],top=heights[j],mid=(bottom+top)/2,solid=band=>band.some(([lo,hi])=>mid>lo&&mid<hi);if(solid(left)===solid(right))continue;quad(point(u,-thickness/2,height(u,-thickness/2,bottom)),point(u,thickness/2,height(u,thickness/2,bottom)),point(u,thickness/2,height(u,thickness/2,top)),point(u,-thickness/2,height(u,-thickness/2,top)));}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));for(const group of groups)geometry.addGroup(group.start,group.count,group.material);geometry.computeVertexNormals();return geometry;
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

 navigation.floors.push({id:'ground',ring:data.exterior.ground.map(p=>world(p).slice(0,2)),z:0});
 const upperOutline=[[0,0],[8.5,0],[8.5,4.21],[14.64,4.21],[14.64,12.71],[8.5,12.71],[8.5,12.21],[9.8,12.21],[9.8,9.23],[7.94,9.23],[7.94,10.3],[0,10.3]];
 const structureOutline=iconInteriorInsetSlab(upperOutline,data.exterior.upper,.18);
 slab('upper-structure',structureOutline,[],2.8,.4,mats.ceiling);
 slab('upper-oak-finish',structureOutline,[],3.2,.015,mats.oak);
 const xs=[...new Set([0,.5,7.94,8.5,9.8,14.64])].sort((a,b)=>a-b),ys=[0,4.21,9.23,10.3,12.21,12.71,17.63,18.13];
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){const b=[xs[i-1],ys[j-1],xs[i],ys[j]],p=[(b[0]+b[2])/2,(b[1]+b[3])/2];if(contains(p,data.exterior.upper)&&!contains(p,stairHole)&&!contains(p,livingHole)){floor('upper-'+i+'-'+j,b,3.2);obstacle('upper-slab-'+i+'-'+j,b,2.8,3.2);navigation.obstacles[navigation.obstacles.length-1].kind='slab';}}
 for(const room of data.rooms){const z=room.id.startsWith('1.')?3.215:0;if(room.finish==='tile')slab('finish-'+room.id,room.outline||ring(room.box),[],z,.008,mats.tile);}
 for(const w of data.walls){
  if(w.finish==='clear-glass'||w.finish==='reeded-glass'){iconVestibuleScreen(context,w);continue;}
  const z=w.level?3.2:0,top=w.level?8.3:data.levels.groundCeiling;
  wall(w.id,w.a,w.b,z,top,w.thickness,w.doors.map(d=>opening(d[0],d[1],z,z+2.1,false)));
 }
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
 mesh(geometry,mats.wall,'entry-garage-jamb-return');
 obstacle('entry-garage-jamb-return',[innerX,cornerY,cornerX,backY],0,top);
 const x0=cornerX+door.start,x1=cornerX+door.end,y=cornerY+wallDepth/2,finish=iconLivingPalette(context);
 box('entry-main-door-leaf',[x0+.006,y-.027,x1-.006,y+.027],.008,door.top-.014,finish.espresso);
 for(const sign of [-1,1]){
  const face=y+sign*.085,pull=x1-.14;
  for(const z of [.78,1.29])beam('entry-main-pull-mount-'+sign+'-'+z,[pull,y+sign*.027,z],[pull,face,z],.012,mats.metal);
  beam('entry-main-pull-'+sign,[pull,face,.756],[pull,face,1.314],.016,mats.metal);
 }
}

function iconInteriorFacades(context) {
 const {data, wall, box, obstacle, mats, beam, opening} = context;
 for(const facade of data.facades){
  const openings=facade.id==='facade-garden'?facade.openings.map(o=>({...o,wallPoly:[[o.start,0],[o.end,0],[o.end,o.top],[7.76,o.top],[7.76,2.8],[.74,2.8],[.74,o.top],[o.start,o.top]]})):facade.openings;
  wall(facade.id,facade.a,facade.b,0,2.8,.48,openings);
 }
 iconEntryReturn(context);
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

function iconInteriorStairs(context) {
 const {data, box, mats, floor, navigation, world, beam, rail, obstacle} = context;
 const s=data.stairs,[sx,sy,ex,ey]=s.box,run=8*s.tread,half=s.floorHeight/2;
 for(let i=0;i<8;i++){
  box('stair-lower-tread-'+i,[sx,sy+i*s.tread,sx+s.width,sy+(i+1)*s.tread],i*half/9,half/9,mats.oak);
  box('stair-upper-tread-'+i,[ex-s.width,sy+(7-i)*s.tread,ex,sy+(8-i)*s.tread],half+i*half/9,half/9,mats.oak);
 }
 box('stair-lower-riser-9',[sx,sy+run-.015,sx+s.width,sy+run],8*half/9,half/9,mats.oak);
 box('stair-upper-riser-18',[ex-s.width,sy,ex,sy+.015],half+8*half/9,half/9,mats.oak);
 box('stair-landing',[sx,sy+run,ex,ey],half-.15,.15,mats.oak);floor('stair-landing',[sx,sy+run,ex,ey],half);
 navigation.ramps.push({id:'stair-lower',start:world([sx+s.width/2,sy]).slice(0,2),end:world([sx+s.width/2,sy+run]).slice(0,2),width:s.width,z0:0,z1:half},{id:'stair-upper',start:world([ex-s.width/2,sy+run]).slice(0,2),end:world([ex-s.width/2,sy]).slice(0,2),width:s.width,z0:half,z1:3.2});
 for(const [id,x,z0,z1] of [['lower',sx,0,half],['upper',ex,3.2,half]]){
  beam('stair-handrail-'+id,[x,sy,z0+1.05],[x,sy+run,z1+1.05],.025);
  for(let i=0;i<8;i++){const t=i/8,y=sy+run*t,step=id==='lower'?Math.min(half,(i+1)*half/9):half+Math.min(half,(9-i)*half/9);beam('stair-'+id+'-baluster-'+i,[x,y,step],[x,y,z0+(z1-z0)*t+1.05],.017);}
  rail('landing-'+id,[x,sy+run],[x,ey],half);
 }
 for(const [id,x0,x1,front,slope] of [['lower',sx+.09,sx+s.width-.09,-.06,half/9/s.tread],['upper',ex-s.width+.09,ex-.09,3.2-half/9-.06,-half/9/s.tread]])for(const [index,x] of [x0,x1].entries())iconInteriorStairStringer(context,'stair-stringer-'+id+'-'+index,x,sy,run,front,slope);
 rail('landing-back',[sx,ey],[ex,ey],half);
 box('upper-void-rim',[4.84,10.23,8.01,10.37],3.02,.18,mats.wood);
 box('upper-stair-rim',[7.87,10.3,8.01,12.28],3.02,.18,mats.wood);
 box('upper-stair-rim-anchor',[7.94,12.14,9.87,12.28],3.02,.18,mats.wood);
 for(const guard of data.rails)rail(guard.id,guard.a,guard.b,guard.level?3.2:0,true);
 obstacle('stair-divider',[sx+s.width,sy,sx+s.width+s.gap,sy+run],0,3.2);
}

function iconInteriorOfficeBacking(context) {
 const {data,box,obstacle,mats}=context;
 const cabinets=data.furniture.filter(item=>item.id.startsWith('office-under-stair-'));
 if(!cabinets.length)return;
 const [backX,startY]=cabinets[0].box,endY=cabinets.at(-1).box[3];
 const stairs=data.stairs,[,frontY,,rearY]=stairs.box,half=stairs.floorHeight/2;
 const segment=(name,from,to,height)=>{
  const bounds=[backX-.04,Math.max(from,startY),backX,Math.min(to,endY)];
  if(bounds[3]<=bounds[1])return;
  box(name,bounds,0,height,mats.wall);
  obstacle(name,bounds,0,height);
 };
 const steps=stairs.rises/2-1;
 for(let i=0;i<steps;i++){
  const y=frontY+i*stairs.tread,underside=half+(steps-1-i)*stairs.floorHeight/stairs.rises;
  segment('office-backing-flight-'+i,y,y+stairs.tread,underside);
 }
 segment('office-backing-landing',frontY+steps*stairs.tread,rearY,half-.15);
 segment('office-backing-rear',rearY,endY,data.levels.groundCeiling);
 iconInteriorOfficePartition(context,cabinets,frontY,steps*stairs.tread);
}

function iconInteriorOfficePartition({THREE,data,mesh,obstacle,mats},cabinets,frontY,run) {
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
  mesh(geometry,mat,id);
 };
 const begin=Math.max(startY,ceilingY),edge=profile(begin,endY);
 panel('office-stair-partition',frontX,.055,[...edge,[endY,ceiling]],mats.wall);
 for(const cabinet of cabinets){
  const [,y0,,y1]=cabinet.box;
  panel(cabinet.id+'-filler',frontX-.033,.032,[[y0,cabinet.height],[y1,cabinet.height],...profile(y0,y1).reverse()],mats.wood);
  obstacle(cabinet.id+'-upper-enclosure',[frontX-.033,y0,frontX+.055,y1],cabinet.height,ceiling);
 }
}

function iconInteriorStairStringer(context,id,x,y,run,front,slope) {
 const {THREE,mesh,mats}=context,start=-.15,end=run+.3;
 const shape=new THREE.Shape([new THREE.Vector2(start,front+start*slope),new THREE.Vector2(end,front+end*slope),new THREE.Vector2(end,front+end*slope-.16),new THREE.Vector2(start,front+start*slope-.16)]);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false}),positions=geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++)positions.setXYZ(i,x+positions.getZ(i)-.06,y+positions.getX(i),positions.getY(i));
 geometry.computeVertexNormals();mesh(geometry,mats.wood,id);
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

function iconInteriorNightstand(frame) {
 const {width:w,depth:d,item,part,mats}=frame,h=item.height;
 part('shelf',[0,0,w,d],.055,.025);
 for(const [i,u] of [0,w-.025].entries())part('side-'+i,[u,0,u+.025,d],.08,h-.08);
 part('drawer',[.025,.01,w-.025,d-.018],h-.18,.14);
 part('pull',[w*.36,d-.018,w*.64,d],h-.125,.018,mats.dark);
 part('top',[.025,0,w-.025,d],h-.04,.04);
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
 return context.livingPalette={walnut:finish('#604638','wood'),espresso:finish('#483b32','wood'),ash:finish('#ad8662','wood'),slate:finish('#343637','wood'),stone:finish('#d3c6b2','stone'),ivory:paint('#efe8da'),black:paint('#252625',.48,.32),screen:paint('#202c33',.24,.25),sage:finish('#aaa998','cloth'),olive:finish('#959984','cloth'),linen:finish('#ded8c8','cloth'),rug:finish('#bcae96','cloth'),brass:paint('#ab8454',.34,.55),projection:paint('#faf9f5',1),lens:paint('#315877',.16,.46)};
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
  const g=new THREE.CylinderGeometry(1,1,h,40);g.rotateX(Math.PI/2);g.scale(rx,ry,1);return add(name,g,mat,u,v,z+h/2);
 }
 function tube(name,pts,r,mat){
  const path=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
  return add(name,new THREE.TubeGeometry(path,Math.max(12,pts.length*4),r,8,false),mat,0,0,0);
 }
 return {add,cushion,disc,tube};
}

function iconLivingSeats(frame,s,p) {
 const {item,width:w,depth:d,line}=frame;
 if(item.type==='armchair'){
  for(const u of [.12,w-.12])for(const v of [.13,d-.13]){
   line('oak-foot-'+u+'-'+v,[u,v,.0041],[u+(u<w/2?.025:-.025),v,.20],.032,p.walnut);
  }
  s.cushion('upholstered-base',w/2,d/2,.26,w-.035,d-.035,.25,.117,p.sage);
  s.cushion('outer-back',w/2,.125,.55,w-.05,.19,.58,.09,p.sage,-.075);
  s.cushion('seat',w/2,.53,.415,w-.225,d-.27,.20,.095,p.sage);
  s.cushion('back',w/2,.24,.65,w-.215,.23,.46,.108,p.sage,-.14);
  for(const u of [.081,w-.081])s.cushion('rolled-arm-'+u,u,.49,.505,.16,d-.095,.365,.079,p.sage,-.025);
  s.cushion('scatter',w*.53,.39,.665,.43,.17,.397,.082,p.linen,-.30).rotateY(-.15);
  return;
 }
 if(item.type==='sofa'||item.type==='ottoman'){
  const ott=item.type==='ottoman';
  s.cushion('recessed-foot',w/2,d/2,.10,w-.13,d-.12,.16,.06,p.espresso);
  s.cushion('upholstered-base',w/2,d/2,.245,w,d,.28,.12,p.sage);
  if(ott){s.cushion('loose-cushion',w/2,d/2,.395,w-.014,d-.014,.22,.10,p.sage);return;}
  for(let i=0;i<3;i++){
   const u=(i+.5)*w/3;
   s.cushion(i===1?'seat':'seat-'+i,u,.56,.414,w/3-.019,d-.15,.24,.115,p.sage);
   s.cushion(i===1?'back':'back-'+i,u,.19,.63,w/3-.02,.29,.53,.13,p.sage,-.14);
   s.cushion('scatter-'+i,u+(i===1?.17:-.18),.32,.72,.47,.20,i===1?.38:.46,.095,i===1?p.linen:p.olive,-.32).rotateY(i===1?-.15:.12);
  }
  s.cushion('arm',.10,.54,.54,.19,.9,.32,.09,p.sage);
  return;
 }
 const h=.445;
 s.disc('seat',w/2,d*.5,h,w*.46,d*.46,.052,p.linen);
 for(const left of [false,true])for(const front of [false,true]){
  const x=left?.035:w-.035,y=front?d-.035:.035;
  line('splayed-leg-'+left+front,[x,y,.01],[left?.105:w-.105,front?d-.105:.105,h+.002],.019,p.ash);
 }
 s.tube('back',[[.04,d*.65,h+.14],[.044,d*.34,h+.245],[.095,.058,h+.31],[w*.5,.036,h+.33],[w-.095,.058,h+.31],[w-.044,d*.34,h+.245],[w-.04,d*.65,h+.14]],.025,p.ash);
 for(const x of [.078,w-.078])line('back-stile-'+x,[x,.09,h],[x,.07,h+.29],.019,p.ash);
}

function iconKitchenPantry(context,frame,p) {
 const {item,width:w,depth:d,part}=frame,[x0,y0,,y1]=item.box,top=item.height,front=d-.025;
 const wall=context.data.walls.find(wall=>wall.id===item.passageWall);
 const [a,b]=wall.doors[0].map(offset=>wall.a[0]+offset-x0),head=2.1,crown=2.32;
 part('left-carcass',[0,0,a,front-.022],.008,top-.008,p.espresso);
 part('right-filler',[b,0,w,front-.022],.008,top-.008,p.espresso);
 part('bridge',[a,0,b,front-.022],head,top-head,p.espresso);
 part('closed-leaf',[a+.003,front-.048,b-.003,front],.008,crown-.014,p.walnut);
 part('leaf-pull',[b-.091,front,b-.075,front+.021],.81,.47,p.espresso);
 for(const [id,l,r] of [['left',0,a],['right',b,w]]){
  part(id+'-veneer',[l+.002,front-.022,r-.002,front],.012,crown-.017,p.walnut);
  context.obstacle('furniture-'+item.id+'-'+id,[x0+l,y0,x0+r,y1],0,top);
 }
 for(const [i,l,r] of [[0,0,a],[1,a,b],[2,b,w]])part('crown-'+i,[l+.002,front-.022,r-.002,front],crown,top-crown,p.walnut);
 context.obstacle('furniture-'+item.id,[x0+a,y0,x0+b,y1],head,top);
}

function iconKitchenNiche(context,frame,p) {
 const {THREE,mesh}=context,{item,width:w,depth:d,part,point}=frame,top=context.data.levels.groundCeiling;
 const counter=item.height,upper=1.58,crown=2.32,front=d-.065;
 part('slab-backsplash',[0,0,w,.029],counter,upper-counter,p.stone);
 const cols=Math.ceil(w/.108),rows=6,vertices=[],colors=[];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const l=col*w/cols+.0015,r=(col+1)*w/cols-.0015;
  const base=counter+row*(upper-counter)/rows+.0015,cap=counter+(row+1)*(upper-counter)/rows-.0015;
  const seed=Math.sin((row+1)*75.13+(col+1)*12.7)*453.6,tone=.78+.2*(seed-Math.floor(seed)),tilt=.002*Math.sin(seed);
  for(const [x,v,h] of [[l,.032,base],[r,.032+tilt,base],[r,.032+tilt,cap],[l,.032,base],[r,.032+tilt,cap],[l,.032,cap]]){
   vertices.push(...point(x,v,h));colors.push(tone,tone*.96,tone*.87);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const tile=new THREE.MeshStandardMaterial({color:'#f0e9d9',vertexColors:true,roughness:.28,side:THREE.DoubleSide});
 mesh(geometry,tile,item.id+'-glazed-tiles');
 part('upper-carcass',[0,0,w,.425],upper,top-upper,p.espresso);
 for(let i=0;i<5;i++){
  const l=w*i/5+.0025,r=w*(i+1)/5-.0025;
  part('upper-'+i,[l,.425,r,.445],upper,crown-upper-.004,p.ivory);
  part('walnut-crown-'+i,[l,.425,r,front],crown,top-crown,p.walnut);
 }
 part('niche-light',[.025,.38,w-.025,.39],upper-.008,.008,frame.mats.lamp);
}

function iconLivingKitchen(context,frame,s,p) {
 const {item,width:w,depth:d,part}=frame;
 if(item.id==='kitchen-pantry'){iconKitchenPantry(context,frame,p);return;}
 if(item.id==='kitchen-sink'){
  part('rim',[0,0,w,d],.002,.012,p.black);part('basin',[.035,.025,w-.035,d-.025],.014,.003,p.slate);
  s.tube('arched-spout',[[w*.5,.035,.014],[w*.5,.035,.21],[w*.5,.062,.30],[w*.5,.15,.31],[w*.5,.19,.26],[w*.5,.19,.22]],.012,p.brass);return;
 }
 if(item.id==='hob'){
  part('glass',[0,0,w,d],0,.012,p.black);
  for(const x of [.17,w-.17])for(const y of [.16,d-.16])s.disc('induction-zone-'+x+'-'+y,x,y,.012,.105,.105,.001,p.screen);
  return;
 }
 const island=item.id==='kitchen-island',tall=item.id==='kitchen-tall',height=item.height,front=island?d-.27:d-.065,count=tall?2:island?6:5;
 part('recessed-plinth',[.05,.05,w-.05,front-.045],.014,.105,p.espresso);
 part('body',[island?.053:.016,0,w-(island?.053:.016),front-.018],.116,height-.116-(tall?0:.05),p.espresso);
 for(let i=0;i<count;i++){
  const a=Math.max(island?.054:0,w*i/count+.005),b=Math.min(island?w-.054:w,w*(i+1)/count-.005);
  part('walnut-front-'+i,[a,front-.018,b,front],.12,tall?2.32-.124:height-.155,p.walnut);
  if(tall)part('walnut-crown-'+i,[a,front-.018,b,front],2.32,height-2.32,p.walnut);
  if(!tall||i===1)part('handle-'+i,[a+.075,front,b-.075,front+.018],tall?1.04:.79,.014,p.espresso);
  if(!island&&!tall)part('drawer-reveal-'+i,[a,front,b,front+.002],.69,.009,p.espresso);
 }
 if(tall){
  for(const z of [.70,1.23]){
   part('oven-'+z,[.035,front,.615,front+.012],z,.49,p.black);
   part('oven-window-'+z,[.073,front+.012,.577,front+.016],z+.04,.32,p.screen);
   part('oven-pull-'+z,[.08,front+.016,.57,front+.036],z+.39,.018,p.black);
  }
  return;
 }
 part('top',[0,0,w,d],height-.05,.05,p.stone);
 if(island){
  for(const a of [0,w-.052])part('waterfall-'+a,[a,0,a+.052,d],.008,height-.058,p.stone);
 }else iconKitchenNiche(context,frame,p);
}

function iconLivingMediaWall(context) {
 const {THREE,box}=context,p=iconLivingPalette(context);
 const x=.494,y0=12.36,y1=16.56;
 box('living-slate-backing',[.477,y0,x,y1],.02,2.75,p.slate);
 const boards=new THREE.InstancedMesh(new THREE.BoxGeometry(),p.slate,34);
 const board=new THREE.Object3D(),pitch=(y1-y0)/boards.count;
 for(let i=0;i<boards.count;i++){
  board.scale.set(.013+(i%3)*.001,pitch-.007,2.74);
  board.position.set(x+board.scale.x/2,y0+i*pitch+board.scale.y/2,.025+board.scale.z/2);
  board.updateMatrix();boards.setMatrixAt(i,board.matrix);
 }
 boards.name='living-slate-boards';boards.castShadow=boards.receiveShadow=true;context.group.add(boards);
 const screen=context.data.furniture.find(item=>item.id==='projection-screen');
 iconLivingProjector(context,screen,p);
}

function iconLivingProjector(context,screen,p) {
 const {THREE,mesh,box,beam,obstacle}=context;
 const target=new THREE.Vector3(screen.box[2],(screen.box[1]+screen.box[3])/2,screen.elevation+screen.height/2);
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
 const hub=at(.24,-.072,.084),wallX=context.data.facades.find(w=>w.id==='facade-terrace').a[0]-.48;
 box('projector-anchor-plate',[wallX-.022,hub.y-.093,wallX,hub.y+.093],2.55,.242,p.black);
 for(const dy of [-.066,.066])for(const z of [2.584,2.76])
  beam('projector-bolt-'+dy+'-'+z,[wallX-.029,hub.y+dy,z],[wallX-.019,hub.y+dy,z],.009,p.espresso);
 box('projector-wall-arm',[hub.x-.018,hub.y-.022,wallX-.019,hub.y+.022],2.729,.037,p.black);
 beam('projector-mount-brace',[wallX-.021,hub.y,2.593],[hub.x+.066,hub.y,2.736],.016,p.black);
 beam('projector-tilt-pivot',hub.toArray(),[hub.x,hub.y,2.739],.030,p.black);
 obstacle('projector-overhead',[lens.x-.01,hub.y-.232,wallX,hub.y+.232],2.48,2.792);
}

function iconLivingFurniture(context,frame) {
 const {item,width:w,depth:d,part}=frame,p=iconLivingPalette(context),s=iconLivingShapes(context,frame);
 if(['sofa','ottoman','chair','armchair'].includes(item.type))iconLivingSeats(frame,s,p);
 else if(item.id.startsWith('kitchen-')||item.id==='hob')iconLivingKitchen(context,frame,s,p);
 else if(item.id==='living-rug')s.cushion('woven',w/2,d/2,.0075,w,d,.015,.007,p.rug);
 else if(item.id==='dining-table'){
  s.cushion('solid-top',w/2,d/2,.743,w,d,.077,.036,p.espresso);
  for(const y of [.48,d-.48])part('trestle-'+y,[.13,y-.082,w-.13,y+.082],.012,.695,p.espresso);
  s.disc('pottery-foot',w/2,d*.50,.782,.12,.12,.024,p.ivory);
  s.disc('pottery-bowl',w/2,d*.50,.806,.19,.19,.055,p.stone);
 }else if(item.id==='coffee-table'){
  for(const [i,x,y,r,h] of [[0,.405,.405,.39,.36],[1,.76,.26,.235,.22]]){
   s.disc('drum-'+i,x,y,.04,r*.67,r*.67,h-.04,i?p.walnut:p.stone);
   s.disc('top-'+i,x,y,h,r,r,.035,i?p.walnut:p.stone);
  }
 }else if(item.id==='projection-screen'){
  part('panel',[0,0,w,d-.002],0,item.height,p.ivory);
  part('surface',[0,d-.002,w,d],0,item.height,p.projection);
 }else if(item.id==='media-console'){
  part('body',[0,.05,w,d-.016],.215,.27,p.espresso);
  for(let i=0;i<4;i++)part('face-'+i,[i*w/4+.005,d-.016,(i+1)*w/4-.005,d],.22,.255,p.walnut);
 }else return false;
 return true;
}

function iconUpperBed(frame,s,p) {
 const {item,width:w,depth:d,part}=frame,master=item.room==='1.8',cloth=item.room==='1.1'?p.olive:p.linen;
 part('plinth',[.095,.08,w-.095,d-.09],0,.20,p.espresso);
 s.cushion('frame',w/2,(d+.06)/2,.285,w,d-.06,.21,.05,p.ash);
 s.cushion('mattress',w/2,d*.5+.035,.445,w-.048,d-.095,.21,.09,p.ivory);
 s.cushion('headboard',w/2,.03,.51,w,.06,.88,.028,master?p.walnut:p.ash);
 for(let i=0;i<(master?2:1);i++){
  const bays=master?2:1,u=(i+.5)*w/bays;
  s.cushion('head-pad-'+i,u,.087,.65,w/bays-.035,.097,.53,.045,master?p.sage:p.linen);
  s.cushion('pillow-'+i,u,.32,.617,Math.min(.75,w*.7),.41,.15,.072,p.ivory,.067);
 }
 s.cushion('duvet',w/2,(d+.47)/2,.575,w-.045,d-.51,.13,.063,cloth);
 s.cushion('turnback',w/2,.607,.651,w-.06,.24,.063,.028,p.ivory);
 s.cushion('throw',w/2,d-.34,.652,w-.055,.46,.055,.025,master?p.olive:p.sage);
 for(let i=0;i<3;i++)part('woven-stripe-'+i,[.06,d-.21+i*.021,w-.06,d-.202+i*.021],.680,.002,p.linen);
}

function iconUpperDesk(frame,s,p) {
 const {width:w,depth:d,part,line}=frame;
 part('top',[0,0,w,d],.717,.035,p.ash);
 part('apron',[.33,.055,w-.06,.10],.625,.092,p.walnut);
 const side=.29;
 part('drawer-case',[.035,.035,side+.04,d-.05],.09,.627,p.walnut);
 for(let i=0;i<3;i++){
  const z=.105+i*.20;
  part('drawer-'+i,[.045,d-.05,side+.03,d-.032],z,.182,p.ash);
  part('pull-'+i,[.124,d-.032,.24,d-.019],z+.135,.014,p.black);
 }
 for(const v of [.065,d-.065])line('tapered-leg-'+v,[w-.05,v,.014],[w-.08,v,.717],.028,p.walnut);
 s.disc('lamp-foot',w-.21,.145,.752,.074,.074,.019,p.black);
 line('lamp-lower-arm',[w-.21,.145,.77],[w-.24,.125,1.035],.010,p.brass);
 line('lamp-upper-arm',[w-.24,.125,1.035],[w-.36,.23,1.112],.010,p.brass);
 s.cushion('task-light',w-.36,.25,1.098,.11,.092,.037,.014,p.ivory);
 part('notebook',[w*.49,d*.38,w*.49+.19,d*.38+.245],.752,.018,p.olive);
 part('paper',[w*.49+.012,d*.38+.012,w*.49+.181,d*.38+.236],.770,.003,p.ivory);
 s.disc('pencil-cup',w*.42,.102,.752,.037,.037,.079,p.ash);
 for(let i=0;i<3;i++)line('pencil-'+i,[w*.42,.102,.812],[w*.42+(i-1)*.024,.108+i*.006,.882+i*.008],.0035,p.espresso);
}

function iconUpperChair(frame,s,p) {
 const {item,width:w,depth:d,line}=frame;
 if(item.id==='gallery-chair'){
  s.cushion('base',w/2,d*.5,.245,w-.09,d-.08,.27,.10,p.walnut);
  s.cushion('seat',w/2,d*.55,.406,w-.13,d*.77,.18,.079,p.linen);
  s.cushion('back',w/2,d*.18,.585,w-.08,.16,.51,.073,p.sage,-.12);
  for(const u of [.058,w-.058])s.cushion('arm-'+u,u,d*.48,.526,.105,d*.80,.185,.046,p.sage);
  s.cushion('scatter',w/2,d*.32,.586,.34,.11,.26,.048,p.olive,-.18);
 }
 else{
  s.cushion('seat',w/2,d*.54,.46,w-.036,d*.82,.073,.034,p.sage);
  s.cushion('back',w/2,d*.116,.727,w-.048,.055,.252,.026,p.ash,-.10);
  for(const u of [.09,w-.09])line('back-upright-'+u,[u,d*.18,.445],[u,d*.103,.75],.016,p.walnut);
 }
 const gallery=item.id==='gallery-chair';
 for(const u of [.04,w-.04])for(const v of [.045,d-.045]){
  const innerU=u<w/2?u+.045:u-.045,innerV=v<d/2?v+.035:v-.035;
  line('leg-'+u+'-'+v,[u,v,.014],[innerU,innerV,gallery?.191:.444],.018,p.walnut);
 }
}

function iconUpperWardrobe(frame,p) {
 const {width:w,depth:d,item,part}=frame,h=item.height,n=Math.round(w/.58),span=w/n;
 part('body',[.028,0,w-.028,.035],.075,h-.109,p.walnut);
 part('plinth',[.036,.022,w-.036,d-.085],0,.075,p.espresso);
 part('top',[0,0,w,d-.018],h-.034,.034,p.ash);
 for(const [i,u] of [0,w-.028].entries())part('side-'+i,[u,0,u+.028,d-.018],.075,h-.109,p.ash);
 for(let i=0;i<n;i++){
  const a=i*span+.008,b=(i+1)*span-.008,u=i%2?a+.062:b-.062;
  part('door-'+i,[a,d-.045,b,d-.021],.08,h-.123,p.ash);
  part('handle-'+i,[u-.009,d-.021,u+.009,d],h*.51,.18,p.espresso);
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
  s.add(name,geometry,p.ash,0,0,0);
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
   part('upper-shelf-'+i+'-'+level,[a,board,b,d-.007],z,board,p.ash);
   if(level===0){
    const mid=(a+b)/2;
    s.cushion('linen-case-'+i,mid,d*.51,z+board+.094,(b-a)*.67,d*.70,.188,.024,p.linen);
    part('case-tab-'+i,[mid-.04,d*.86,mid+.04,d*.86+.008],z+board+.087,.026,p.walnut);
   }
  }
 }
}

function iconUpperDressing(context,frame,s,p) {
 const {THREE}=context,{width:w,depth:d,item,part,line}=frame,h=item.lowerSectionHeight??item.height,span=w/3;
 part('body',[0,0,w,.026],.105,h-.14,p.ash);
 part('plinth',[.03,.025,w-.03,d-.07],0,.07,p.espresso);
 part('base',[0,0,w,d],.07,.035,p.ash);
 part('top',[0,0,w,d],h-.035,.035,p.ash);
 for(let i=0;i<=3;i++){
  const u=(w-.026)*i/3;
  part('upright-'+i,[u,.026,u+.026,d],.105,h-.14,p.ash);
 }
 for(let i=0;i<2;i++){
  const a=i*span+.033,b=(i+1)*span-.033;
  line('rail-'+i,[a,d*.49,h-.19],[b,d*.49,h-.19],.014,p.brass);
  for(let j=0;j<3;j++){
   const u=a+(b-a)*(.23+j*.26),v=d*.49;
   line('hook-'+i+'-'+j,[u,v,h-.19],[u,v,h-.28],.006,p.brass);
   line('hanger-front-'+i+'-'+j,[u,v,h-.27],[u,v+.17,h-.36],.008,p.walnut);
   line('hanger-back-'+i+'-'+j,[u,v,h-.27],[u,v-.17,h-.36],.008,p.walnut);
   iconUpperGarment(THREE,s,'garment-'+i+'-'+j,u,v,h-.28,.62+j*.085,[p.linen,p.sage,p.olive][(j+i)%3]);
  }
 }
 const a=2*span+.024,b=w-.028;
 for(let i=0;i<3;i++){
  const z=.115+i*.195;
  part('drawer-'+i,[a,.03,b,d-.025],z,.177,p.walnut);
  part('handle-'+i,[(a+b)/2-.075,d-.025,(a+b)/2+.075,d-.009],z+.11,.014,p.brass);
 }
 for(const z of [.72,1.12]){
  part('shelf-'+z,[a,.026,b,d],z,.024,p.ash);
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
 const ceramic=(name,u,v,z,rx,ry,profile)=>iconUpperCeramic(s,THREE,name,u,v,z,rx,ry,profile,mats.white);
 if(item.type==='sink'){
  s.cushion('vanity',w/2,(d-.027)/2,.502,w,d-.027,.54,.018,p.walnut);
  for(let i=0;i<2;i++)part('drawer-'+i,[.014,d-.023,w-.014,d],.254+i*.25,.227,p.ash);
  part('counter',[0,0,w,d],.772,.031,p.stone);
  ceramic('bowl',w/2,d*.58,.803,w*.386,d*.385,[[.56,0],[.85,.01],[1,.111],[.992,.127],[.95,.13],[.9,.102],[.58,.035],[.09,.016]]);
  s.disc('drain',w/2,d*.58,.815,.024,.024,.004,p.brass);
  s.tube('tap',[[w*.52,d*.11,.801],[w*.52,d*.11,1.01],[w*.52,d*.16,1.04],[w*.52,d*.39,1.04],[w*.52,d*.40,1.00]],.012,p.brass);
  const mirrorTop=Math.min(1.90,...[.04,w-.04].map(u=>{const [x,y,z]=point(u,.02);return ceilingAt(x,y)-z-.03;}));
  part('mirror-frame',[.032,.005,w-.032,.027],1.11,mirrorTop-1.11,p.walnut);
  const silver=context.upperMirror??=new THREE.MeshStandardMaterial({color:'#cbd8d6',metalness:.26,roughness:.12});
  part('mirror',[.044,.027,w-.044,.031],1.122,mirrorTop-1.134,silver);
 }else if(item.type==='toilet'){
  part('wall-carrier',[w*.24,0,w*.76,d*.43],.17,.22,mats.white);
  ceramic('base',w/2,d*.573,.08,w*.48,d*.409,[[.46,0],[.58,.025],[.70,.13],[.97,.24],[1,.32],[.95,.337],[.78,.333],[.67,.23],[.18,.13]]);
  ceramic('seat',w/2,d*.57,.413,w*.48,d*.403,[[.77,0],[.96,0],[1,.012],[.98,.033],[.79,.035],[.76,.023],[.77,0]]);
  s.cushion('cistern',w/2,d*.13,.542,w-.036,d*.25,.37,.035,mats.white);
  s.disc('flush',w/2,d*.13,.727,.024,.016,.004,p.brass);
 }else if(item.type==='tub'){
  ceramic('shell',w/2,d/2,.016,w*.50,d*.50,[[.73,0],[.79,.026],[.90,.22],[.995,.53],[1,.556],[.976,.569],[.918,.561],[.88,.49],[.72,.13],[.58,.096],[.025,.096]]);
  s.disc('drain',w*.50,d*.50,.110,.028,.028,.005,p.brass);
  s.tube('filler',[[w*.20,.10,.025],[w*.2,.10,.65],[w*.23,.12,.70],[w*.26,d*.28,.70],[w*.26,d*.29,.66]],.017,p.brass);
 }else{
  s.cushion('tray',w/2,d/2,.036,w,d,.06,.025,p.stone);
  part('linear-drain',[w*.18,.075,w*.78,.099],.066,.006,p.black);
  const maxHeight=Math.min(2.03,...[.025,d-.025].map(v=>{const [x,y,z]=point(w-.028,v);return ceilingAt(x,y)-z-.035;}));
  part('screen',[w-.035,.024,w-.023,d-.019],.066,maxHeight-.066,mats.glass).castShadow=false;
  for(const v of [.025,d-.025])line('glazing-stile-'+v,[w-.029,v,.065],[w-.029,v,maxHeight],.011,p.black);
  line('mixer',[w-.184,d*.45,1.03],[w-.05,d*.45,1.03],.024,p.brass);
  line('column',[w-.09,d*.45,1.03],[w-.09,d*.45,1.98],.014,p.brass);
  line('arm',[w-.09,d*.45,1.98],[w*.59,d*.45,1.98],.014,p.brass);
  s.disc('head',w*.59,d*.45,1.94,.093,.093,.033,p.brass);
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
 const p=iconLivingPalette(context),s=iconLivingShapes(context,frame);
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
 else if(item.type==='nightstand')iconInteriorNightstand(frame);
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

function iconLivingCeilingMaterial(THREE) {
 const material=new THREE.MeshStandardMaterial({color:'#ede8df',roughness:.84,side:THREE.DoubleSide});
 // Shade the existing lining so both the roof openings and the room clearances stay exact.
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 liningPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nliningPosition=position;');
  shader.fragmentShader='varying vec3 liningPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   if(liningPosition.y>10.30 && liningPosition.y<16.86 && liningPosition.x<8.50) {
    float row=liningPosition.y/.165;
    float seed=fract(sin(floor(row)*127.1)*4375.545);
    float run=liningPosition.x*1.41 + seed*2.7;
    float seam=smoothstep(.004,.019,min(fract(row),1.-fract(row)));
    float butt=smoothstep(.0006,.002,min(fract(run/2.8),1.-fract(run/2.8)));
    float fibre=sin(row*18.+.9*sin(run*2.+seed))*sin(row*61.+.8*sin(run));
    diffuseColor.rgb=vec3(.072,.058,.047)*(.70+seed*.36+fibre*.052)*mix(.4,1.,seam*butt);
   }`);
 };
 return material;
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
 iconDiningLantern(context,paper,'dining-lantern-1',x-.24,y-.57,2.58,.36,.24);
 iconDiningLantern(context,paper,'dining-lantern-2',x+.21,y+.08,3.39,.25,.46);
 iconDiningLantern(context,paper,'dining-lantern-3',x-.06,y+.61,2.85,.42,.22);
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
  const lamp=new THREE.PointLight('#fff0d6',12,5,2);
  lamp.position.set(x,y,z-.018);group.add(lamp);
 }
 // General room lighting for the two existing groups of decorative pendants.
 for(const [x,y,z] of [[4.4,14,2.5],[4.3,10.5,2.55]]){
  const lamp=new THREE.PointLight('#fff0d6',12,5,2);lamp.position.set(x,y,z);group.add(lamp);
 }
}

function iconInteriorLightingAndRoof(context) {
 iconMezzanineTrusses(context);
 iconLivingLighting(context);
 iconIndoorOlive(context,.97,16.21,.88);
 iconMezzaninePrint(context);
 const roofLining=iconLivingCeilingMaterial(context.THREE);
 const {THREE,group,navigation,contains,data,house,mesh,ceilingAt,cutRoof}=context;
 iconRoomCeilingLights(context);
 const inverse=group.matrix.clone().invert();
 navigation.ceilingHeight = worldXY => {
  const p=new THREE.Vector3(worldXY[0],worldXY[1],0).applyMatrix4(inverse);
  if(!contains([p.x,p.y],data.exterior.upper))return Infinity;
  return ceilingAt(p.x,p.y);
 };
 for(const part of house.meshes.filter(m=>m.kind==='roof')){
  const vertices=part.vertices.map(v=>{const p=new THREE.Vector3(...v).applyMatrix4(inverse);return [p.x,p.y,p.z-.045];});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geometry.setIndex(part.faces.flatMap(f=>f.slice(1,-1).flatMap((_,i)=>[f[0],f[i+1],f[i+2]])));geometry.computeVertexNormals();mesh(cutRoof(geometry,group.matrix),roofLining,'interior-roof-lining-'+part.id).castShadow=false;
 }
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
 part('recessed-plinth',[.065,.075,w-.065,d-.07],0,.17,p.walnut);
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
 part('body',[0,0,w,.025],.073,h-.101,p.walnut);
 part('plinth',[.031,.016,w-.031,d-.05],0,.073,p.espresso);
 part('top',[0,0,w,d-.005],h-.028,.028,p.ash);
 for(const u of [0,open,w-.021])part('side-'+u,[u,.025,u+.021,d-.007],.073,h-.101,p.ash);
 const leaf=(closed-.023)/3;
 for(let i=0;i<3;i++){
  const left=open+.019+leaf*i,u=left+(i===1?.054:leaf-.054);
  part('door-'+i,[left+.003,d-.046,left+leaf-.004,d-.019],.078,h-.115,i===2?p.walnut:p.ash);
  part('handle-'+i,[u-.008,d-.019,u+.008,d],.94,.245,p.brass);
 }
 for(const z of [.075,.46,.86,1.29,1.68])part('shelf-'+z,[.021,.026,open,d-.009],z,.019,p.ash);
 for(const [level,z] of [.479,.879].entries())for(let i=0;i<2;i++)
  s.cushion('folded-linen-'+level+i,open*.51,d*.54,z+.0325+i*.065,.325,.239,.065,.025,i?p.sage:p.linen);
 s.disc('tray',open*.5,d*.52,1.309,.125,.084,.024,p.brass);
}

function iconToyPaints(context) {
 if(context.toyPaints)return context.toyPaints;
 const colors={clay:'#c36c52',honey:'#e1b45d',lagoon:'#568b87',blue:'#7295ae'};
 return context.toyPaints=Object.fromEntries(Object.entries(colors).map(([key,color])=>
  [key,new context.THREE.MeshStandardMaterial({color,roughness:.82})]));
}

function iconPlayCubbies(context,{width:w,depth:d,item,part},s,p) {
 const h=item.height,t=.022,paint=iconToyPaints(context);
 part('body',[0,0,w,t],.038,h-.038,p.walnut);
 for(const z of [.038,h/2,h-t])part('shelf-'+z,[0,t,w,d],z,t,p.ash);
 for(const [i,z] of [.038+t,h/2+t].entries()){
  const top=i===0?h/2:h-t;
  for(const x of [0,(w-t)/2,w-t])part('upright-'+i+'-'+x,[x,t,x+t,d],z,top-z,p.ash);
 }
 for(const [i,cloth] of [p.sage,p.linen].entries()){
  const x=(i+.5)*w/2;
  s.cushion('basket-'+i,x,d*.56,.163,.449,d*.80,.203,.018,cloth);
  part('label-'+i,[x-.045,d*.96,x+.045,d*.963],.174,.033,p.walnut);
 }
 for(const [i,col] of [paint.clay,paint.honey,paint.lagoon,p.linen,paint.blue].entries()){
  const x=.045+i*.064;
  part('picture-book-'+i,[x,.073,x+.047,d-.035],h/2+t,.158+(i%3)*.021,col);
  part('spine-band-'+i,[x+.006,d-.035,x+.041,d-.034],h/2+.125,.012,p.ivory);
 }
 const blocks=[[.69,.11,0,paint.lagoon],[.79,.11,0,paint.honey],[.74,.11,.088,paint.clay]];
 for(const [i,[x,y,z,mat]] of blocks.entries())
  s.cushion('block-'+i,x,y,h/2+t+z+.044,.087,.088,.088,.009,mat);
 s.disc('stacker-base',w*.23,d*.51,h,.093,.093,.025,p.ash);
 s.disc('stacker-peg',w*.23,d*.51,h+.025,.015,.015,.23,p.walnut);
 for(const [i,col] of [paint.lagoon,paint.blue,paint.honey,paint.clay].entries()){
  const r=.072-i*.012;
  const ring=new context.THREE.TorusGeometry(r-.014,.014,8,24);
  s.add('stacking-ring-'+i,ring,col,w*.23,d*.51,h+.039+i*.028);
 }
}

function iconPlayMat(context,{width:w,depth:d,part},s,p) {
 const {THREE}=context,paint=iconToyPaints(context),u=w*.34,v=d*.60,ink=.0175;
 s.cushion('woven-edge',w/2,d/2,.006,w,d,.012,.005,p.rug);
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
 track('beech-track',radius,radius-.057,0,.016,p.ash);
 for(const offset of [.011,.042])track('wheel-groove-'+offset,radius-offset,radius-offset-.004,.016,.0004,p.walnut);
 const v=mid-radius+.028;
 for(const [i,u] of [.255,.417].entries()){
  const body=i?paint.lagoon:paint.clay;
  s.cushion('chassis-'+i,u,v,.056,.146,.058,.028,.007,p.walnut);
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
   part('cab-roof',[u+.012,v-.033,u+.068,v+.033],.148,.010,p.walnut);
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

function iconStudyDesk(context,frame,s,p) {
 const {width:w,depth:d,part,line}=frame;
 s.cushion('top',w/2,d/2,.733,w,d,.038,.013,p.ash);
 for(const [i,u] of [.09,w-.09].entries()){
  for(const v of [.078,d-.078])part('metal-leg-'+i+'-'+v,[u-.022,v-.022,u+.022,v+.022],0,.715,p.black);
  part('crossbar-'+i,[u-.022,.100,u+.022,d-.100],.046,.034,p.black);
 }
 part('cable-tray',[.22,.099,w-.22,.203],.619,.076,p.espresso);
 s.cushion('desk-mat',w*.52,d*.68,.754,.91,.338,.005,.002,p.sage);
 const screens=frame.item.id==='office-desk-window'?[[0,w*.50,.214,.69,.397]]:[[0,w*.45,.218,.61,.355],[1,w*.815,.178,.27,.443]];
 for(const [i,u,v,mw,mh] of screens){
  s.cushion('monitor-foot-'+i,u,v,.764,.189,.138,.019,.008,p.black);
  part('display-neck-'+i,[u-.022,v-.022,u+.022,v+.011],.767,.257,p.black);
  const z=i?.840:.884;
  part('display-frame-'+i,[u-mw/2,v-.020,u+mw/2,v+.015],z,mh,p.black);
  part('display-'+i,[u-mw/2+.008,v+.015,u+mw/2-.008,v+.016],z+.015,mh-.023,p.screen);
  part('status-light-'+i,[u+mw*.38,v+.015,u+mw*.38+.007,v+.016],z+.005,.002,frame.mats.lamp);
 }
 iconOfficeKeyboard(context,s,p,w*.52,d*.69,.757);
 const u=.115,v=.15;
 s.disc('task-lamp-foot',u,v,.752,.066,.066,.014,p.black);
 line('task-lamp-arm',[u,v,.766],[u-.005,v,1.074],.009,p.brass);
 line('task-lamp-elbow',[u-.005,v,1.074],[u+.098,v+.067,1.178],.008,p.brass);
 s.cushion('task-lamp-shade',u+.113,v+.081,1.169,.106,.083,.039,.013,p.black);
 part('folio',[.055,.32,.244,.568],.752,.017,p.walnut);
}

function iconStudyChair({item,width:w,depth:d,line},s,p,THREE) {
 const upholstery=item.id==='office-chair-window'?p.olive:p.sage;
 const u=w/2,v=d/2,r=Math.min(w,d)*.428;
 for(let i=0;i<5;i++){
  const a=(i+.5)*2*Math.PI/5,dx=Math.cos(a),dy=Math.sin(a);
  line('spoke-'+i,[u,v,.143],[u+r*dx,v+r*dy,.075],.014,p.black);
  const wheel=new THREE.CylinderGeometry(.033,.033,.041,12);wheel.rotateZ(a);
  s.add('castor-'+i,wheel,p.black,u+r*dx,v+r*dy,.033);
 }
 s.disc('lift',u,v,.095,.036,.036,.294,p.black);
 s.cushion('seat',u,d*.55,.441,w*.82,d*.75,.107,.052,upholstery);
 s.cushion('back',u,d*.152,.742,w*.76,.079,.49,.038,p.olive,-.104);
 line('spine',[u,d*.37,.402],[u,d*.115,.782],.026,p.black);
 for(const x of [w*.077,w*.923]){
  line('arm-support-'+x,[x,d*.53,.398],[x,d*.53,.605],.017,p.black);
  s.cushion('arm-rest-'+x,x,d*.52,.622,.067,d*.42,.044,.019,p.black);
 }
}

function iconStudyBookcase({width:w,depth:d,item,part},s,p,THREE) {
 const h=item.height;
 part('body',[0,0,w,.019],.07,h-.07,p.walnut);
 part('plinth',[.027,.025,w-.027,d-.039],0,.07,p.espresso);
 for(const u of [0,w-.022])part('end-'+u,[u,.019,u+.022,d],.067,h-.067,p.ash);
 for(const z of [.065,.62,1.02,1.365,h-.023])part('shelf-'+z,[.022,.020,w-.022,d],z,.023,p.ash);
 for(let i=0;i<2;i++){
  const u=i*w/2;
  part('door-'+i,[u+.025,d-.024,u+w/2-.006,d-.009],.089,.524,p.ash);
  part('handle-'+i,[u+w*.24,d-.009,u+w*.24+.064,d],.518,.018,p.espresso);
 }
 for(const [row,z,start,count] of [[0,.643,.072,8],[1,1.043,.504,6]]) {
  for(let i=0;i<count;i++){
   const u=start+i*.054,height=.164+((i*7)%5)*.021;
   part('book-'+row+'-'+i,[u,.046,u+.044,d-.037],z,height,[p.sage,p.olive,p.espresso,p.linen][(row+i)%4]);
  }
 }
 iconUpperCeramic(s,THREE,'stoneware',w*.22,d*.53,1.043,.063,.063,[[0,0],[.64,0],[1,.055],[.89,.134],[.51,.167],[.49,.193],[.39,.193],[.36,.175]],p.stone);
}

function iconGroundVanity(context,{width:w,depth:d,part,line,mats},s,p) {
 const {THREE}=context;
 s.cushion('vanity',w/2,d*.455,.548,w-.032,d*.87,.457,.012,p.walnut);
 for(let i=0;i<2;i++)part('drawer-'+i,[.018,d-.062,w-.018,d-.048],.324+i*.217,.202,p.ash);
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
 part('cistern',[.012,0,w-.012,d*.178],.009,1.03,p.stone);
 part('wall-carrier',[w*.22,.057,w*.78,d*.43],.15,.22,mats.white);
 vessel('base',.116,w*.479,d*.39,[[.40,0],[.59,.023],[.79,.095],[.98,.21],[1,.278],[.972,.292],[.823,.293],[.702,.241],[.33,.109],[.025,.092]]);
 vessel('seat',.408,w*.481,d*.395,[[.757,0],[.94,0],[1,.012],[.977,.033],[.8,.033],[.753,.017],[.757,0]]);
 part('flush-plate',[w*.27,d*.178,w*.73,d*.188],.810,.107,p.ivory);
 part('flush-large',[w*.295,d*.188,w*.516,d*.195],.828,.071,p.brass);
 part('flush-small',[w*.531,d*.188,w*.699,d*.195],.828,.071,p.brass);
}

function iconGroundShower(context,frame,s,p) {
 const {width:w,depth:d,part,line,point,mats}=frame;
 const entry=.70,edge=d-.024,top=2.08;
 s.cushion('tray',w/2,d/2,.029,w,d,.05,.012,p.stone);
 part('drain-slot',[w*.60,.078,w-.092,.098],.054,.002,p.espresso);
 part('tile-backing',[.004,0,w-.004,.015],.054,2.114,p.stone);
 for(const z of [.602,1.202,1.802])part('tile-joint-'+z,[.004,.015,w-.004,.016],z,.003,p.ivory);
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

function iconGroundRoomFurniture(context,frame) {
 const id=frame.item.id;
 const draw=iconGroundRoomBuilders[id];
 if(!draw)return false;
 draw(context,frame,iconLivingShapes(context,frame,5),iconLivingPalette(context));
 return true;
}

const iconGroundRoomBuilders={
 'guest-sofa-bed':(c,f,s,p)=>iconGuestDaybed(f,s,p,c.THREE),
 'guest-wardrobe':(_,f,s,p)=>iconGuestWardrobe(f,s,p),
 'play-cubbies':iconPlayCubbies,
 'play-mat':iconPlayMat,
 'play-train':iconWoodenTrain,
 'office-desk':iconStudyDesk,
 'office-chair':(c,f,s,p)=>iconStudyChair(f,s,p,c.THREE),
 'office-desk-window':iconStudyDesk,
 'office-chair-window':(c,f,s,p)=>iconStudyChair(f,s,p,c.THREE),
 'office-bookcase':(c,f,s,p)=>iconStudyBookcase(f,s,p,c.THREE),
 'ground-bath':iconGroundVanity,
 'ground-wc':iconGroundWc,
 'ground-shower':iconGroundShower,
};
