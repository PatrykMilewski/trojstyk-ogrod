export function addIconInterior(options) {
 const context = iconInteriorSetup(options);
 iconInteriorFloorsAndPartitions(context);
 iconInteriorFacades(context);
 iconInteriorStairs(context);
 iconInteriorOfficeBacking(context);
 iconInteriorFurnishings(context);
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
    if(panes===1&&o.end-o.start>2&&id!=='garden-gable'){
     const mid=(o.start+o.end)/2;
     beam(id+'-mullion-'+i,to3([mid,o.bottom]),to3([mid,Math.min(o.top,4.0)]),.025,mats.dark);
    }
    obstacle(id+'-glass-barrier-'+i,[Math.min(to3([o.start,0])[0],to3([o.end,0])[0])-.035,Math.min(to3([o.start,0])[1],to3([o.end,0])[1])-.035,Math.max(to3([o.start,0])[0],to3([o.end,0])[0])+.035,Math.max(to3([o.start,0])[1],to3([o.end,0])[1])+.035],o.bottom,o.top);
   }
  }
 };
 const opening = (start,end,bottom=0,top=2.35,glass=true) => ({start,end,bottom,top,glass});
 const contains = iconInteriorContains;
 return {THREE, scene, house, data, group, world, ring, navigation, mats, mesh, box, obstacle, floor, slab, beam, rail, wall, opening, contains, ceilingAt, cutRoof};
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
 for(const w of data.walls){const z=w.level?3.2:0,top=w.level?8.3:2.8;wall(w.id,w.a,w.b,z,top,w.thickness,w.doors.map(d=>opening(d[0],d[1],z,z+2.1,false)));}
}

function iconInteriorFacades(context) {
 const {data, wall, box, obstacle, mats, beam, opening} = context;
 for(const facade of data.facades){
  const openings=facade.id==='facade-garden'?facade.openings.map(o=>({...o,wallPoly:[[o.start,0],[o.end,0],[o.end,o.top],[7.76,o.top],[7.76,2.8],[.74,2.8],[.74,o.top],[o.start,o.top]]})):facade.openings;
  wall(facade.id,facade.a,facade.b,0,2.8,.48,openings);
 }
 box('garage-sectional-door',[1.08,-.05,6.04,.05],0,2.32,mats.dark);obstacle('garage-door',[1.06,-.1,6.06,.1],0,2.35);
 // These three walls include the upper gable and its asymmetrical glazing.
 wall('front-gable',[0,0],[8.5,0],2.8,8.3,.36,[{...opening(.9,4.25,3.2,7.25),poly:[[.9,3.2],[4.25,3.2],[4.25,7.25],[.9,3.9]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 const gardenGlassY=data.facades.find(f=>f.id==='facade-garden').a[1]-.24;
 wall('garden-gable',[0,18.13],[8.5,18.13],2.8,8.3,.36,[{...opening(.9,7.6,3.2,7.35),recess:18.13-.18-gardenGlassY,wallPoly:[[.74,2.8],[7.76,2.8],[7.76,3.2],[7.6,3.2],[7.6,3.95],[4.25,7.35],[.9,3.95],[.9,3.2],[.74,3.2]],poly:[[.9,3.2],[7.6,3.2],[7.6,3.95],[4.25,7.35],[.9,3.95]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 const transom=box('garden-window-transom',[.74,gardenGlassY-.12,7.76,gardenGlassY],2.35,.85,[mats.wall,mats.dark]);
 for(const [face,group] of transom.geometry.groups.entries())group.materialIndex=face===3?0:1;
 for(const x of [3.1,5.4])beam('garden-upper-triangle-mullion-'+x,[x,gardenGlassY,3.2],[x,gardenGlassY,7.35-Math.abs(x-4.25)],.025,mats.dark);
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
 return context.livingPalette={walnut:finish('#604638','wood'),espresso:finish('#483b32','wood'),ash:finish('#ad8662','wood'),slate:finish('#343637','wood'),stone:finish('#d3c6b2','stone'),ivory:paint('#efe8da'),black:paint('#252625',.48,.32),screen:paint('#202c33',.24,.25),sage:finish('#aaa998','cloth'),olive:finish('#959984','cloth'),linen:finish('#ded8c8','cloth'),rug:finish('#bcae96','cloth'),brass:paint('#ab8454',.34,.55),fire:new THREE.MeshStandardMaterial({color:'#eaa259',emissive:'#e77628',emissiveIntensity:.9})};
}

function iconLivingShapes(context,frame) {
 const {THREE,mesh}=context,{item,point}=frame,rotation={'+y':0,'-y':Math.PI,'+x':-Math.PI/2,'-x':Math.PI/2}[item.facing];
 const add=(name,geometry,mat,u,v,z)=>{
  const object=mesh(geometry,mat,item.id+'-'+name);object.position.set(...point(u,v,z));object.rotation.z=rotation;return object;
 };
 function cushion(name,u,v,z,w,d,h,r,mat,tilt=0){
  const g=new THREE.BoxGeometry(w,d,h,8,8,6),p=g.attributes.position,radius=Math.min(r,w*.49,d*.49,h*.49);
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
  s.cushion('arm',w-.10,.54,.54,.19,.9,.32,.09,p.sage);
  return;
 }
 const stool=item.type==='stool',mat=stool?p.black:p.ash,h=stool?.67:.445;
 s.disc('seat',w/2,d*.5,h,w*.46,d*.46,.052,stool?p.black:p.linen);
 for(const left of [false,true])for(const front of [false,true]){
  const x=left?.035:w-.035,y=front?d-.035:.035;
  line('splayed-leg-'+left+front,[x,y,.01],[left?.105:w-.105,front?d-.105:.105,h+.002],stool?.013:.019,mat);
 }
 if(stool){
  s.tube('footrail',[[.06,d*.72,.25],[.06,d*.84,.25],[w/2,d*.89,.25],[w-.06,d*.84,.25],[w-.06,d*.72,.25]],.012,mat);
  s.tube('back',[[.045,d*.52,h],[.042,.075,h+.16],[w/2,.042,h+.21],[w-.042,.075,h+.16],[w-.045,d*.52,h]],.022,mat);
 }else{
  s.tube('back',[[.04,d*.65,h+.14],[.044,d*.34,h+.245],[.095,.058,h+.31],[w*.5,.036,h+.33],[w-.095,.058,h+.31],[w-.044,d*.34,h+.245],[w-.04,d*.65,h+.14]],.025,mat);
  for(const x of [.078,w-.078])line('back-stile-'+x,[x,.09,h],[x,.07,h+.29],.019,mat);
 }
}

function iconLivingKitchen(frame,s,p) {
 const {item,width:w,depth:d,part}=frame;
 if(item.id==='kitchen-sink'){
  part('rim',[0,0,w,d],.002,.012,p.black);part('basin',[.035,.025,w-.035,d-.025],.014,.003,p.slate);
  s.tube('arched-spout',[[w*.5,.035,.014],[w*.5,.035,.21],[w*.5,.062,.30],[w*.5,.15,.31],[w*.5,.19,.26],[w*.5,.19,.22]],.012,p.brass);return;
 }
 if(item.id==='hob'){
  part('glass',[0,0,w,d],0,.012,p.black);
  for(const x of [.17,w-.17])for(const y of [.16,d-.16])s.disc('induction-zone-'+x+'-'+y,x,y,.012,.105,.105,.001,p.screen);
  return;
 }
 const island=item.id==='kitchen-island',tall=item.id==='kitchen-tall',height=item.height,front=island?d-.27:tall?d-.04:d-.025,count=tall?2:island?6:5;
 part('recessed-plinth',[.05,.05,w-.05,front-.045],.014,.105,p.espresso);
 part('body',[island?.053:.016,0,w-(island?.053:.016),front-.018],.116,height-.116-(tall?0:.05),p.espresso);
 for(let i=0;i<count;i++){
  const a=Math.max(island?.054:0,w*i/count+.005),b=Math.min(island?w-.054:w,w*(i+1)/count-.005);
  part('walnut-front-'+i,[a,front-.018,b,front],.12,height-.155,p.walnut);
  if(!tall||i===1)part('handle-'+i,[a+.075,front,b-.075,front+.018],tall?1.04:.79,.014,p.espresso);
  if(!island&&!tall)part('drawer-reveal-'+i,[a,front,b,front+.002],.69,.009,p.espresso);
 }
 if(tall){
  for(const z of [.70,1.23]){
   part('oven-'+z,[.035,front,.615,front+.012],z,.49,p.black);
   part('oven-window-'+z,[.073,front+.012,.577,front+.016],z+.04,.32,p.screen);
   part('oven-pull-'+z,[.08,front+.018,.57,front+.036],z+.39,.018,p.black);
  }
  return;
 }
 part('top',[0,0,w,d],height-.05,.05,p.stone);
 if(island){
  for(const a of [0,w-.052])part('waterfall-'+a,[a,0,a+.052,d],.008,height-.058,p.stone);
 }else{
  part('slab-backsplash',[0,0,w,.037],height, .57,p.stone);
  for(let i=0;i<5;i++)part('upper-'+i,[w*i/5+.004,0,w*(i+1)/5-.004,.365],1.52,.78,p.ivory);
 }
}

function iconLivingMediaWall(context) {
 const {THREE,box,beam,mesh,ceilingAt,obstacle}=context,p=iconLivingPalette(context);
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
 const cx=.95,cy=12.95;
 const profile=[[.01,.46],[.23,.475],[.37,.55],[.43,.67],[.425,.81],[.36,.92],[.22,1.06],[.088,1.22]];
 function shell(name,points,start,length,mat){
  const geometry=new THREE.LatheGeometry(points.map(([r,z])=>new THREE.Vector2(r,z)),40,start,length);
  geometry.rotateX(Math.PI/2);const m=mesh(geometry,mat,'living-stove-'+name);m.position.set(cx,cy,0);
 }
 p.black.side=THREE.DoubleSide;
 shell('bowl',profile.slice(0,4),0,Math.PI*2,p.black);
 shell('firebox',profile.slice(3,6),Math.PI/2+.83,Math.PI*2-1.66,p.black);
 shell('hood',profile.slice(5),0,Math.PI*2,p.black);
 for(let i=0;i<3;i++)beam('living-stove-birch-'+i,[cx-.13,cy-.13+.07*i,.59],[cx+.15,cy-.07+.08*i,.63],.035,p.ash);
 for(let i=0;i<3;i++)beam('living-stove-ember-'+i,[cx+.08,cy-.07+i*.06,.64],[cx+.06,cy-.046+i*.06,.69+i*.012],.014,p.fire);
 beam('living-stove-flue',[cx,cy,1.205],[cx,cy,ceilingAt(cx,cy)],.088,p.black);
 obstacle('living-suspended-stove',[cx-.43,cy-.43,cx+.43,cy+.43],.46,1.22);
}

function iconLivingFurniture(context,frame) {
 const {item,width:w,depth:d,part}=frame,p=iconLivingPalette(context),s=iconLivingShapes(context,frame);
 if(['sofa','ottoman','chair','stool'].includes(item.type))iconLivingSeats(frame,s,p);
 else if(['kitchen-island','kitchen-back','kitchen-tall','kitchen-sink','hob'].includes(item.id))iconLivingKitchen(frame,s,p);
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
 }else if(item.id==='tv'){
  part('bezel',[0,0,w,d-.003],0,.95,p.black);part('display',[.018,d-.003,w-.018,d],.018,.914,p.screen);
 }else if(item.id==='media-console'){
  part('body',[0,.05,w,d-.016],.215,.27,p.espresso);
  for(let i=0;i<4;i++)part('face-'+i,[i*w/4+.005,d-.016,(i+1)*w/4-.005,d],.22,.255,p.walnut);
 }else return false;
 return true;
}

function iconInteriorFurnitureObject(context, frame) {
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
  if(item.type==='rug'||item.support)continue;
  const bounds=objects.reduce((max,object)=>{object.updateMatrix();object.geometry.computeBoundingBox();return Math.max(max,object.geometry.boundingBox.clone().applyMatrix4(object.matrix).max.z);},frame.z);
  obstacle('furniture-'+item.id,item.box,frame.z,bounds);
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

function iconInteriorLightingAndRoof(context) {
 iconLivingLighting(context);
 iconIndoorOlive(context,.97,16.21,.88);
 iconMezzaninePrint(context);
 const roofLining=iconLivingCeilingMaterial(context.THREE);
 const {THREE, group, box, mats, navigation, contains, data, house, mesh, ceilingAt, cutRoof} = context;
 for(const [id,x,y,z] of [['living',4.4,14,2.5],['kitchen',4.3,10.5,2.55],['hall',8.3,8.4,2.55],['guest',12.6,7,2.55],['office',12,10.9,2.55],['upper-hall',5.6,7.5,5.6],['upper-one',4.3,2,5.6],['upper-two',3.2,7.6,5.6],['upper-master',11.7,10,5.6]]){const lamp=new THREE.PointLight('#fff0d6',12,5,2);lamp.position.set(x,y,z);lamp.castShadow=false;group.add(lamp);if(id!=='living'&&id!=='kitchen')box('light-fixture-'+id,[x-.12,y-.12,x+.12,y+.12],z+.05,.04,mats.lamp);}
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
