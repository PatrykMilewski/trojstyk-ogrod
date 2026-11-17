export function addIconInterior(options) {
 const context = iconInteriorSetup(options);
 iconInteriorFloorsAndPartitions(context);
 iconInteriorFacades(context);
 iconInteriorStairs(context);
 iconInteriorFurnishings(context);
 iconInteriorLightingAndRoof(context);
 const {group,navigation,data,world} = context;
 return {group,navigation,rooms:data.rooms,metadata:data.metadata,localToWorld:world};
}

const iconInteriorContains = (p,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};

function iconInteriorSetup({THREE,scene,house,data}) {
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
 const beam = (id,a,b,r=.025,mat=mats.metal) => {const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat,id);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;};
 const rail = (id,a,b,z) => {beam(id+'-top',[...a,z+1.05],[...b,z+1.05]);const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(length/.55));for(let i=0;i<=count;i++){const s=i/count,p=[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s];beam(id+'-post-'+i,[...p,z],[...p,z+1.05],.017);}obstacle(id,[Math.min(a[0],b[0])-.04,Math.min(a[1],b[1])-.04,Math.max(a[0],b[0])+.04,Math.max(a[1],b[1])+.04],z,z+1.1);};
 const wall = (id,a,b,z0,z1,thickness,openings=[],profile=null) => {
  const external=id.startsWith('facade-')||id.startsWith('upper-')||id.endsWith('-gable');
  let nx=0,ny=0;if(external){if(Math.abs(a[0]-b[0])<.01)nx=a[0]<.1?-1:1;else ny=a[1]<5?-1:1;a=[a[0]-nx*thickness/2,a[1]-ny*thickness/2];b=[b[0]-nx*thickness/2,b[1]-ny*thickness/2];}
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const shape=new THREE.Shape((profile||[[0,z0],[L,z0],[L,z1],[0,z1]]).map(p=>new THREE.Vector2(...p)));
  shape.holes=openings.map(o=>path(o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]]));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}),pos=geometry.getAttribute('position');
  for(let i=0;i<pos.count;i++){const u=pos.getX(i),h=pos.getY(i),d=pos.getZ(i)-thickness/2;pos.setXYZ(i,a[0]+ux*u-uy*d,a[1]+uy*u+ux*d,h);}if(id.startsWith('u-'))for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),main=8.3-(8.3-4.07)/4.25*Math.abs(x-4.25),wing=8.3-(8.3-4.07)/4.25*Math.abs(y-8.46),roof=Math.max(x<=8.5?main:-Infinity,y>=4.21&&y<=12.71&&x>=4.25?wing:-Infinity);pos.setZ(i,Math.min(pos.getZ(i),roof-.25));}
  geometry.computeVertexNormals();mesh(geometry,mats.wall,id);
  if(id.startsWith('facade-')||id.startsWith('upper-')||id.endsWith('-gable')){
   const shell=new THREE.ShapeGeometry(shape),sp=shell.getAttribute('position');

   for(let i=0;i<sp.count;i++){const u=sp.getX(i),h=sp.getY(i);sp.setXYZ(i,a[0]+ux*u+nx*(thickness/2+.003),a[1]+uy*u+ny*(thickness/2+.003),h);}shell.computeVertexNormals();mesh(shell,mats.dark,id+'-charred-exterior');
  }
  const cuts=[0,L,...openings.flatMap(o=>[o.start,o.end])].sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){const start=cuts[i-1],end=cuts[i];if(end-start<.001)continue;const opening=openings.find(o=>(start+end)/2>o.start&&(start+end)/2<o.end);const ax=a[0]+ux*start,ay=a[1]+uy*start,bx=a[0]+ux*end,by=a[1]+uy*end,bounds=[Math.min(ax,bx)-Math.abs(uy)*thickness/2,Math.min(ay,by)-Math.abs(ux)*thickness/2,Math.max(ax,bx)+Math.abs(uy)*thickness/2,Math.max(ay,by)+Math.abs(ux)*thickness/2];
   if(!opening)obstacle(id+'-'+i,bounds,z0,z1);else{if(opening.bottom>z0+.01)obstacle(id+'-sill-'+i,bounds,z0,opening.bottom);if(opening.top<z1-.01)obstacle(id+'-header-'+i,bounds,opening.top,z1);}
  }
  for(const [i,o] of openings.entries()){
   const points=o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]],to3=p=>[a[0]+ux*p[0],a[1]+uy*p[0],p[1]];
   for(let j=0;j<points.length;j++)beam(id+'-opening-'+i+'-frame-'+j,to3(points[j]),to3(points[(j+1)%points.length]),.025,mats.dark);
   if(o.glass){const g=new THREE.ShapeGeometry(new THREE.Shape(points.map(p=>new THREE.Vector2(...p)))),ps=g.getAttribute('position');for(let j=0;j<ps.count;j++){const p=to3([ps.getX(j),ps.getY(j)]);ps.setXYZ(j,...p);}g.computeVertexNormals();mesh(g,mats.glass,id+'-glass-'+i).castShadow=false;
    const mid=(o.start+o.end)/2;if(o.end-o.start>2)beam(id+'-mullion-'+i,to3([mid,o.bottom]),to3([mid,Math.min(o.top,4.0)]),.025,mats.dark);
    obstacle(id+'-glass-barrier-'+i,[Math.min(a[0]+ux*o.start,a[0]+ux*o.end)-.035,Math.min(a[1]+uy*o.start,a[1]+uy*o.end)-.035,Math.max(a[0]+ux*o.start,a[0]+ux*o.end)+.035,Math.max(a[1]+uy*o.start,a[1]+uy*o.end)+.035],o.bottom,o.top);
   }
  }
 };
 const opening = (start,end,bottom=0,top=2.35,glass=true) => ({start,end,bottom,top,glass});
 const contains = iconInteriorContains;
 return {THREE, scene, house, data, group, world, ring, navigation, mats, mesh, box, obstacle, floor, slab, beam, rail, wall, opening, contains};
}

function iconInteriorFloorsAndPartitions(context) {
 const {data, navigation, ring, world, floor, slab, mats, obstacle, wall, opening, contains} = context;
 slab('ground-floor',data.exterior.ground,[],-.12,.12,mats.oak);
 const stairHole=ring(data.stairs.box),livingHole=ring(data.void.box);

 navigation.floors.push({id:'ground',ring:data.exterior.ground.map(p=>world(p).slice(0,2)),z:0});
 const xs=[...new Set([0,.5,7.94,8.5,9.8,14.64])].sort((a,b)=>a-b),ys=[0,4.21,9.23,10.3,12.21,12.71,17.63,18.13];
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){const b=[xs[i-1],ys[j-1],xs[i],ys[j]],p=[(b[0]+b[2])/2,(b[1]+b[3])/2];if(contains(p,data.exterior.upper)&&!contains(p,stairHole)&&!contains(p,livingHole)){floor('upper-'+i+'-'+j,b,3.2);slab('upper-slab-'+i+'-'+j,ring(b),[],2.8,.4,mats.ceiling);slab('upper-finish-'+i+'-'+j,ring(b),[],3.2,.015,mats.oak);obstacle('upper-slab-'+i+'-'+j,b,2.8,3.2);navigation.obstacles[navigation.obstacles.length-1].kind='slab';}}
 for(const room of data.rooms){const z=room.id.startsWith('1.')?3.218:.018;if(room.finish==='tile')slab('finish-'+room.id,ring(room.box),[],z,.008,mats.tile);}
 for(const w of data.walls){const z=w.level?3.2:0,top=w.level?5.86:2.8;wall(w.id,w.a,w.b,z,top,w.thickness,w.doors.map(d=>opening(d[0],d[1],z,z+2.1,false)));}
}

function iconInteriorFacades(context) {
 const {data, wall, box, obstacle, mats, beam, opening} = context;
 for(const facade of data.facades)wall(facade.id,facade.a,facade.b,0,2.8,.48,facade.openings);
 box('garage-sectional-door',[1.08,-.05,6.04,.05],0,2.32,mats.dark);obstacle('garage-door',[1.06,-.1,6.06,.1],0,2.35);
 // These three walls include the upper gable and its asymmetrical glazing.
 wall('front-gable',[0,0],[8.5,0],2.8,8.3,.36,[{...opening(.9,4.25,3.2,7.25),poly:[[.9,3.2],[4.25,3.2],[4.25,7.25],[.9,3.9]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 wall('garden-gable',[0,18.13],[8.5,18.13],2.8,8.3,.36,[{...opening(.9,7.6,3.2,7.35),poly:[[.9,3.2],[7.6,3.2],[7.6,3.95],[4.25,7.35],[.9,3.95]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 for(const x of [3.1,5.4])beam('garden-upper-triangle-mullion-'+x,[x,18.13-.18,3.2],[x,18.13-.18,7.35-Math.abs(x-4.25)],.025,mats.dark);
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
 for(const [id,x,z0,z1] of [['lower',sx,0,half],['upper',ex,3.2,half]])beam('stair-handrail-'+id,[x,sy,z0+1.02],[x,sy+run,z1+1.02],.025);
 rail('landing-back',[sx,ey],[ex,ey],half);
 for(const guard of data.rails)rail(guard.id,guard.a,guard.b,guard.level?3.2:0);
 obstacle('stair-divider',[sx+s.width,sy,sx+s.width+s.gap,sy+run],0,3.2);
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
 part('frame',[0,0,w,d],.15,.23);
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
 part('body',[0,0,w,d],0,h,item.type==='appliance'?mats.white:mats.wood);
 if(item.type==='counter')part('top',[0,0,w,d],h-.05,.05,mats.counter);
 for(let u=.15;u<w;u+=.6)part('handle-'+u,[u,d-.035,Math.min(u+.025,w),d],Math.min(1,h*.55),Math.min(.3,h*.25),mats.dark);
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

function iconInteriorFurnitureWasher(context, frame) {
 const {THREE,mesh}=context,{item,width:w,depth:d,part,point,mats}=frame,h=item.height||.87;
 part('body',[0,0,w,d],0,h,mats.white);
 const drum=mesh(new THREE.CylinderGeometry(.22,.22,.035,24),mats.dark,item.id+'-drum');
 const a=point(w/2,d-.02,h*.52),b=point(w/2,d,h*.52);
 drum.position.set(...a);
 drum.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(b[0]-a[0],b[1]-a[1],0).normalize());
}

function iconInteriorFurnitureObject(context, frame) {
 const {item,width:w,depth:d,part,mats}=frame;
 if(item.type==='bed')iconInteriorFurnitureBed(frame);
 else if(['sofa','chair','stool','ottoman'].includes(item.type))iconInteriorFurnitureSeating(frame);
 else if(['cabinet','counter','appliance'].includes(item.type))iconInteriorFurnitureStorage(frame);
 else if(item.type==='table')iconInteriorFurnitureTable(frame);
 else if(['sink','basin','toilet','shower','tub'].includes(item.type))iconInteriorFurnitureSanitary(frame);
 else if(item.type==='washer')iconInteriorFurnitureWasher(context,frame);
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

function iconInteriorLightingAndRoof(context) {
 const {THREE, group, box, mats, navigation, contains, data, house, mesh} = context;
 for(const [id,x,y,z] of [['living',4.4,14,2.5],['kitchen',4.3,10.5,2.55],['hall',8.3,8.4,2.55],['guest',12.6,7,2.55],['office',12,10.9,2.55],['upper-hall',5.6,7.5,5.6],['upper-one',4.3,2,5.6],['upper-two',3.2,7.6,5.6],['upper-master',11.7,10,5.6]]){const lamp=new THREE.PointLight('#fff0d6',12,5,2);lamp.position.set(x,y,z);lamp.castShadow=false;group.add(lamp);box('light-fixture-'+id,[x-.12,y-.12,x+.12,y+.12],z+.05,.04,mats.lamp);}
 const inverse=group.matrix.clone().invert();
 navigation.ceilingHeight = worldXY => {
  const p=new THREE.Vector3(worldXY[0],worldXY[1],0).applyMatrix4(inverse);
  if(!contains([p.x,p.y],data.exterior.upper))return Infinity;
  const slope=(8.3-4.07)/4.25,heights=[];
  if(p.x>=0&&p.x<=8.5)heights.push(8.3-slope*Math.abs(p.x-4.25));
  if(p.x>=4.25&&p.y>=4.21&&p.y<=12.71)heights.push(8.3-slope*Math.abs(p.y-8.46));
  return Math.max(...heights)-.045;
 };
 for(const part of house.meshes.filter(m=>m.kind==='roof')){
  const vertices=part.vertices.map(v=>{const p=new THREE.Vector3(...v).applyMatrix4(inverse);return [p.x,p.y,p.z-.045];});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geometry.setIndex(part.faces.flatMap(f=>f.slice(1,-1).flatMap((_,i)=>[f[0],f[i+1],f[i+2]])));geometry.computeVertexNormals();mesh(geometry,mats.ceiling,'interior-roof-lining-'+part.id).castShadow=false;
 }
 group.userData={kind:'walkable-interior',rooms:data.rooms.length,stairRises:18,source:data.metadata,groundFloor:0,upperFloor:3.2};
}
