// Coordinates follow the mirrored Icon floor plan; the installation inherits its site transform.
const rainOutlets193 = [
  [.075,.36], [.075,16.84], [14.19,4.285], [8.68,12.635]
];
const rainField193 = {center:[9.6,26.65], columns:5, rows:3, unit:.80, height:.66, unitNetM3:.405};
const rainTank193 = {center:[-1.05,22.75], outside:[2,2.9], wall:.08, usableM3:6, overflowZ:-1.22};

const rainGutter193 = {outletDepth:.125, slope:.003, socketDrop:.12};
const rainDownpipe193 = {width:.070, depth:.080};
const rainFilter193 = [-1.05,20.30,-1.10];
const rainIntake193 = [[-.06,.36],[-.06,16.84],[14.19,4.15],[8.68,12.77]];
const rainCovers193 = [
  ['leaf-filter',...rainFilter193.slice(0,2),.23],
  ['tank-inspection',rainTank193.center[0]+.45,rainTank193.center[1],.30],
  ['field-inspection',rainField193.center[0]-2*rainField193.unit,rainField193.center[1]+rainField193.unit,.11]
];

function rainDrawing(THREE,group) {
  const color = {gutter:0x44d0b8,lip:0xb4f0db,pipe:0x36beb5,body:0x17555d,water:0x46aeb5,grid:0x84e5d3};
  const cache = new Map();
  function mesh(id,geometry,at,tone,opacity=1,order=2) {
    const key = tone+':'+opacity;
    if(!cache.has(key)) cache.set(key,new THREE.MeshBasicMaterial({
      color:color[tone],transparent:true,opacity,depthTest:false,depthWrite:false,side:THREE.DoubleSide
    }));
    const item=new THREE.Mesh(geometry,cache.get(key));
    item.position.set(...at);item.name='rain-'+id;item.renderOrder=310+order;
    item.raycast=()=>{};group.add(item);return item;
  }
  function box(id,size,at,tone,opacity,order) {
    return mesh(id,new THREE.BoxGeometry(...size),at,tone,opacity,order);
  }
  function pipe(id,from,to,radius=.065,tone='pipe') {
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),v=b.clone().sub(a);
    const item=mesh(id,new THREE.CylinderGeometry(radius,radius,v.length(),12),a.lerp(b,.5).toArray(),tone);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
    return item;
  }
  function route(id,points) {
    for(let i=1;i<points.length;i++)pipe(id+'-'+i,points[i-1],points[i]);
  }
  function chamber(id,x,y,bottom,radius) {
    pipe(id,[x,y,bottom],[x,y,.018],radius,'body');
  }
  return {box,mesh,pipe,route,chamber};
}

// Paths start at the four outlets. The sign selects the roof-facing side of the metal profile.
function rainGutterRuns193() {
  const [gf,gr,wf,wr]=rainIntake193;
  return [
    [1,[gf,[-.06,0]]],[-1,[gf,[-.06,8.60]]],[1,[gr,[-.06,8.60]]],[-1,[gr,[-.06,18.13]]],
    [-1,[wf,[8.56,4.15],[8.56,0]]],[1,[wf,[14.64,4.15]]],
    [1,[wr,[8.56,12.77],[8.56,18.13]]],[-1,[wr,[14.64,12.77]]]
  ];
}

function rainRoof193(draw,eave,ridge) {
  const z=eave-rainGutter193.outletDepth;
  for(const [i,[,points]] of rainGutterRuns193().entries()){
    let height=z;
    const route=points.map(([x,y],j)=>{
      if(j)height+=rainGutter193.slope*Math.hypot(x-points[j-1][0],y-points[j-1][1]);
      return [x,y,height];
    });
    for(let j=1;j<route.length;j++)draw.pipe('flow-'+i+'-'+j,route[j-1],route[j],.012,'gutter');
  }
  for(const [index,[x,y]] of rainOutlets193.entries()){
    draw.pipe('outlet-offset-'+index,[...rainIntake193[index],z],[x,y,z-rainGutter193.socketDrop],.044);
    const top=z-rainGutter193.socketDrop;
    draw.box('downpipe-'+index,[rainDownpipe193.width,rainDownpipe193.depth,top+.47],[x,y,(top-.47)/2],'pipe');
    draw.box('cleanout-'+index,[.12,.13,.18],[x,y,.20],'lip',1,4);
  }
  // Both valleys conduct runoff into the inside corners of the T-shaped eaves.
  for(const [index,y] of [4.21,12.71].entries())draw.pipe('valley-'+index,[4.25,8.46,ridge],[8.5,y,eave],.041,'lip');
}

function rainCollectors193(draw) {
  const [gf,gr,wf,wr]=rainOutlets193;
  const westTee=[-1.48,gr[1],-.72],eastTee=[15.36,13.55,-.72],filter=rainFilter193;
  draw.route('ground-front-west',[[...gf,-.47],[-1.48,gf[1],-.49],westTee]);
  draw.route('ground-rear-west',[[...gr,-.47],[gr[0],gr[1],-.69],westTee]);
  draw.route('ground-west-trunk',[westTee,[-1.48,19.87,-1.085],filter]);
  draw.route('ground-front-east',[[...wf,-.47],[15.36,3.80,-.50],eastTee]);
  draw.route('ground-rear-east',[[...wr,-.47],[9.48,13.55,-.60],eastTee]);
  draw.route('ground-east-trunk',[eastTee,[15.36,19.66,-.83],[14.68,20.34,-.85],[.10,20.34,-1.08],filter]);
  draw.chamber('leaf-filter',filter[0],filter[1],-1.23,.23);
  draw.route('filtered-inlet',[filter,[rainTank193.center[0],rainTank193.center[1]-rainTank193.outside[1]/2,-1.13]]);
}

function rainStorage193(THREE,draw) {
  const {center:[x,y],outside:[w,d],wall,usableM3,overflowZ}=rainTank193;
  const depth=usableM3/((w-2*wall)*(d-2*wall)),bottom=overflowZ-depth,top=-.70;
  draw.box('tank-shell',[w,d,top-bottom+wall],[x,y,(top+bottom-wall)/2],'body',.38,0);
  draw.mesh('tank-water',new THREE.PlaneGeometry(w-2*wall,d-2*wall),[x,y,overflowZ],'water',.63,1);
  draw.chamber('tank-inspection',x+.45,y,top,.30);
  const field=rainField193;
  const firstX=field.center[0]-(field.columns-1)*field.unit/2;
  const nearY=field.center[1]-field.rows*field.unit/2;
  const fieldInZ=-1.37;
  draw.route('screened-overflow',[[x,y+d/2,overflowZ],[x,24.55,-1.23],[.40,26,-1.265],
    [6.95,26,-1.35],[firstX-field.unit/2+.04,field.center[1],fieldInZ]]);
  for(let col=0;col<field.columns;col++)for(let row=0;row<field.rows;row++){
    const cx=firstX+col*field.unit,cy=nearY+(row+.5)*field.unit,cz=fieldInZ;
    const size=field.unit-.014;
    draw.box('crate-'+col+'-'+row,[size,size,field.height],[cx,cy,cz],'body',.66,1);
    for(const offset of [-.24,0,.24]){
      draw.box('crate-rib',[.022,size,.035],[cx+offset,cy,cz+field.height/2],'grid',1,3);
      draw.box('crate-rib',[size,.022,.035],[cx,cy+offset,cz+field.height/2],'grid',1,3);
    }
  }
  draw.chamber('field-inspection',firstX,nearY+(field.rows-.5)*field.unit,fieldInZ,.11);
}

function rainChannelGeometry(THREE,points,side,eave) {
  const normals=[],lengths=[0],positions=[];
  for(let i=1;i<points.length;i++){
    const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1],length=Math.hypot(dx,dy);
    normals.push([-side*dy/length,side*dx/length]);
    lengths.push(lengths[i-1]+length);
  }
  const sections=points.map(([x,y],i)=>{
    const prev=normals[Math.max(0,i-1)],next=normals[Math.min(i,normals.length-1)];
    const factor=1+prev[0]*next[0]+prev[1]*next[1];
    return [x,y,(prev[0]+next[0])/factor,(prev[1]+next[1])/factor,lengths[i]];
  });
  // Leave a 90 mm opening in the sole directly above each concealed offset.
  const [low,following]=sections,f=.045/lengths[1];
  sections.splice(1,0,low.map((v,i)=>v+(following[i]-v)*f));
  function profile([x,y,nx,ny,run]){
    const floor=eave-rainGutter193.outletDepth+run*rainGutter193.slope;
    // The inner fold tucks under the roof covering. The front hem and sole stay outside the wall.
    return [[-.072,floor+.085],[-.065,floor+.085],[-.065,floor],
      [.052,floor],[.060,eave-.006],[.079,eave+.008]].map(([offset,z])=>[x+nx*offset,y+ny*offset,z]);
  }
  const rings=sections.map(profile);
  for(let i=1;i<rings.length;i++){
    const a=rings[i-1],b=rings[i];
    for(let j=1;j<a.length;j++){
      if(i===1&&j===3)continue;
      positions.push(...a[j-1],...b[j-1],...b[j],...a[j-1],...b[j],...a[j]);
    }
  }
  // Gable ends have stop ends. The two west runs meet at a shared high point.
  if(!(points.at(-1)[0]===-.06&&points.at(-1)[1]===8.60)){
    const [,lip,a,b,back]=rings.at(-1),backLip=[back[0],back[1],lip[2]];
    positions.push(...a,...b,...backLip,...a,...backLip,...lip);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

function rainOutletSocket(THREE,index,eave) {
  const [x,y]=rainIntake193[index],[tx,ty]=rainOutlets193[index],distance=Math.hypot(tx-x,ty-y);
  const nx=(tx-x)/distance,ny=(ty-y)/distance,positions=[];
  const z=eave-rainGutter193.outletDepth;
  const inlet=[[-.065,-.045],[.052,-.045],[.052,.045],[-.065,.045]]
    .map(([n,t])=>[x+nx*n-ny*t,y+ny*n+nx*t,z]);
  const socket=inlet.map(([ix,iy])=>[
    tx+Math.sign(ix-x)*rainDownpipe193.width/2,
    ty+Math.sign(iy-y)*rainDownpipe193.depth/2,
    z-rainGutter193.socketDrop
  ]);
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    positions.push(...inlet[i],...socket[i],...socket[j],...inlet[i],...socket[j],...inlet[j]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

function rainSurfaceCovers(THREE,group) {
  const frame=new THREE.MeshStandardMaterial({color:0x3e4741,roughness:.86});
  const lid=new THREE.MeshStandardMaterial({color:0x59605a,roughness:.88});
  for(const [id,x,y,radius] of rainCovers193){
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(radius+.025,radius+.025,.065,40),frame);
    collar.name='rain-frame-'+id;
    collar.rotation.x=Math.PI/2;collar.position.set(x,y,.0475);group.add(collar);
    const cover=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.016,40),lid);
    cover.name='rain-cover-'+id;
    cover.rotation.x=Math.PI/2;cover.position.set(x,y,.079);cover.receiveShadow=true;group.add(cover);
    for(const offset of [-.38,.38]){
      const recess=new THREE.Mesh(new THREE.BoxGeometry(radius*.17,radius*.34,.003),frame);
      recess.name='rain-cover-keyhole';recess.position.set(x+offset*radius,y,.087);group.add(recess);
    }
  }
}

export function createRainSurface(THREE,house,interior) {
  const group=new THREE.Group();
  group.name='rain-surface-193';
  group.matrixAutoUpdate=false;group.matrix.copy(interior.group.matrix);
  const metal=new THREE.MeshStandardMaterial({color:0x384143,roughness:.48,metalness:.40,side:THREE.DoubleSide});
  metal.name='Icon roof folded metal';
  for(const [i,[side,points]] of rainGutterRuns193().entries()){
    const geometry=rainChannelGeometry(THREE,points,side,house.metadata.dimensions.eave);
    const channel=new THREE.Mesh(geometry,metal);
    channel.name='rain-gutter-'+i;channel.receiveShadow=true;channel.castShadow=true;group.add(channel);
  }
  for(let i=0;i<rainOutlets193.length;i++){
    const socket=new THREE.Mesh(rainOutletSocket(THREE,i,house.metadata.dimensions.eave),metal);
    socket.name='rain-outlet-socket-'+i;socket.receiveShadow=true;group.add(socket);
  }
  rainSurfaceCovers(THREE,group);
  return group;
}

export function createRainServices(THREE,house,interior,data) {
  const group=new THREE.Group();
  group.name='services-rain-193';
  group.matrixAutoUpdate=false;group.matrix.copy(interior.group.matrix);
  const footprint=data.exterior.upper;
  const area=Math.abs(footprint.reduce((sum,[x,y],i)=>{
    const [nx,ny]=footprint[(i+1)%footprint.length];return sum+x*ny-y*nx;
  },0))/2;
  group.userData={kind:'rain-services',parcel:'193',projectedRoofM2:area,assumedStormMm:30,
    runoffCoefficient:.90,stormVolumeM3:area*.030*.90,tankUsableM3:rainTank193.usableM3,
    fieldNetM3:rainField193.columns*rainField193.rows*rainField193.unitNetM3};
  const draw=rainDrawing(THREE,group),{eave,ridge}=house.metadata.dimensions;
  rainRoof193(draw,eave,ridge);rainCollectors193(draw);rainStorage193(THREE,draw);
  return group;
}
