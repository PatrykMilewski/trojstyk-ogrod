// Coordinates follow the mirrored Icon floor plan; the installation inherits its site transform.
const rainOutlets193 = [
  [.075,.36], [.075,16.84], [14.19,4.285], [8.68,12.635]
];
// The first bed takes the SW roof directly. The two lawn beds take only the SE tank overflow.
const rainTank193 = {center:[1.10747124,22.96049605], outside:[2,2.9], wall:.08, usableM3:6};
const [rainTankX193,rainTankY193]=rainTank193.center;
const rainFilter193=[rainTankX193+.40,rainTankY193-2.02];
const westFilter193=[-3.35,17];
const fieldInspection193=[rainTankX193,rainTankY193+2.30];
const fieldVent193=[fieldInspection193[0]-.46,fieldInspection193[1]];
const westVent193=[westFilter193[0]-.42,westFilter193[1]+.48];
const rainField193 = {unit:.80, height:.66, unitNetM3:.405,
  strips:[
    {x:-5.8,y:15.8,columns:2,rows:4,feed:[westFilter193,[-4.60,17]]},
    {x:8.4,y:24.6,columns:4,rows:2,feed:[fieldInspection193,[2,fieldInspection193[1]],[2+fieldInspection193[1]-25,25],[8.80,25]]},
    {x:4.6,y:29.4,columns:2,rows:3,feed:[fieldInspection193,[rainTankX193,25.50],[5,25.50+5-rainTankX193],[5,29.80]]}
  ]};

const rainGutter193 = {outletDepth:.125, slope:.003, socketDrop:.12};
const rainDownpipe193 = {width:.070, depth:.080};
const rainIntake193 = [[.072,.36],[.072,16.84],[14.19,4.282],[8.68,12.638]];
const rainInward193 = [[1,0],[1,0],[0,1],[0,-1]];
const rainCovers193 = [
  ['sw-filter',...westFilter193,.23],
  ['leaf-filter',...rainFilter193,.23],
  ['tank-inspection',rainTankX193+.40,rainTankY193,.30],
  ['field-inspection',...fieldInspection193,.30]
];

function rainLength193(points) {
  return points.slice(1).reduce((sum,[x,y],i)=>sum+Math.hypot(x-points[i][0],y-points[i][1]),0);
}
function rainGrade193(points,start,slope) {
  let z=start;
  return points.map(([x,y],i)=>{
    if(i)z-=slope*Math.hypot(x-points[i-1][0],y-points[i-1][1]);
    return [x,y,z];
  });
}

// All ordinates are pipe axes relative to the design datum. Inverts sit one radius below them.
export function rainHydraulics193() {
  const [swFront,swRear,seFront,seRear]=rainOutlets193,tee=[7.6,20.4];
  const sw=[[swFront,[-.85,.36],[-.85,14.50],westFilter193],
    [swRear,[-.75,16.84],[-.91,17],westFilter193]];
  const se=[[seFront,[14.19,3.60],[15.12,3.60],[15.95,4.43],[15.95,19.55],[15.10,20.4],tee],
    [seRear,[8.90,12.855],[8.90,19.1],tee]];
  function pairedPaths(paths) {
    const lengths=paths.map(rainLength193),drop=Math.max(...lengths)*.012;
    return paths.map((points,i)=>rainGrade193(points,-.47,drop/lengths[i]));
  }
  const west=pairedPaths(sw),east=pairedPaths(se);
  const eastTrunk=rainGrade193([tee,[rainFilter193[0]+rainFilter193[1]-20.4,20.4],rainFilter193],east[0].at(-1)[2],.012);
  const westIn=west[0].at(-1),eastIn=eastTrunk.at(-1);
  const filterDrop=.08,westOut=[...westFilter193,westIn[2]-filterDrop],eastOut=[...rainFilter193,eastIn[2]-filterDrop];
  const tankInlet=rainGrade193([rainFilter193,[rainFilter193[0],rainTankY193-1.45]],eastOut[2],.012);
  const overflowZ=tankInlet.at(-1)[2]-.12;
  const overflow=rainGrade193([[rainTankX193,rainTankY193+1.45],fieldInspection193],overflowZ,.015);
  const level=overflow.at(-1)[2]-.20;
  const feeds=rainField193.strips.map((s,i)=>rainGrade193(s.feed,i===0?westOut[2]:level,.012));
  const {outside:[w,d],wall,usableM3}=rainTank193,waterLevel=overflowZ-.065;
  const tank={...rainTank193,top:-.55,waterLevel,bottom:waterLevel-usableM3/((w-2*wall)*(d-2*wall))-wall};
  const fields=rainField193.strips.map(({x,y,columns,rows})=>({x,y,width:columns*rainField193.unit,
    depth:rows*rainField193.unit,height:rainField193.height}));
  return {west,east,eastTrunk,westIn,westOut,eastIn,eastOut,filterDrop,tankInlet,tank,overflow,feeds,fields};
}

function rainPlanRing193(house,project,[left,bottom,right,top]) {
  return [[left,bottom],[right,bottom],[right,top],[left,top]].map(([x,y])=>project(house.metadata,x,y,0).slice(0,2));
}

export function rainFieldFootprints193(house,project) {
  return rainField193.strips.map(({x,y,columns,rows},i)=>({
    id:'rain-field-'+(i+1),
    ring:rainPlanRing193(house,project,[x,y,x+columns*rainField193.unit,y+rows*rainField193.unit])
  }));
}

export function rainTankFootprint193(house,project) {
  const [x,y]=rainTank193.center,[w,d]=rainTank193.outside;
  return {id:'rain-tank',ring:rainPlanRing193(house,project,[x-w/2,y-d/2,x+w/2,y+d/2])};
}

export function rainServiceAccess193(house,project) {
  const [x,y]=rainTank193.center,[w,d]=rainTank193.outside,margin=.15;
  const areas=[
    [x-w/2-margin,y-d/2-margin,x+w/2+margin,y+d/2+margin],
    ...rainField193.strips.map(({x,y,columns,rows})=>[x-margin,y-margin,
      x+columns*rainField193.unit+margin,y+rows*rainField193.unit+margin]),
    [rainTankX193-.55,19.50,rainTankX193+1.0,fieldInspection193[1]+.55],
    [fieldVent193[0]-.50,fieldInspection193[1]-.50,fieldInspection193[0]+.50,fieldInspection193[1]+.50],
    [westVent193[0]-.50,16.40,westFilter193[0]+.50,19.05],
    [westVent193[0]-.50,18.50,.10,19.50]
  ];
  return [...areas.map(bounds=>({ring:rainPlanRing193(house,project,bounds)})),
    ...rainCovers193.map(([id,x,y,r])=>({id:'rain-'+id,
      ring:rainPlanRing193(house,project,[x-r-.20,y-r-.20,x+r+.20,y+r+.20])}))];
}

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
    [1,[gf,[.072,0]]],[-1,[gf,[.072,8.60]]],[1,[gr,[.072,8.60]]],[-1,[gr,[.072,18.13]]],
    [-1,[wf,[8.428,4.282],[8.428,0]]],[1,[wf,[14.64,4.282]]],
    [1,[wr,[8.428,12.638],[8.428,18.13]]],[-1,[wr,[14.64,12.638]]]
  ];
}

function rainRoof193(draw,eave,ridge) {
  const z=eave-rainGutter193.outletDepth;
  const runs=rainGutterRuns193();
  for(const [i,[,points]] of runs.entries()){
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
  for(const [i,points] of [runs[4][1],runs[6][1]].entries()){
    const [outlet,corner]=points;
    const cornerZ=z+rainGutter193.slope*Math.hypot(outlet[0]-corner[0],outlet[1]-corner[1]);
    const drip=[8.37,i?12.58:4.34,eave+.13*(ridge-eave)/4.25];
    draw.pipe('valley-'+i,[4.25,8.46,ridge],drip,.041,'lip');
    draw.pipe('corner-inflow-'+i,drip,[...corner,cornerZ],.021,'gutter');
  }
}

function rainCollectors193(draw,layout) {
  for(const [i,route] of [...layout.west,...layout.east].entries())draw.route('ground-outlet-'+i,route);
  draw.route('ground-east-trunk',layout.eastTrunk);
  for(const [id,from,to] of [['sw-filter',layout.westIn,layout.westOut],['leaf-filter',layout.eastIn,layout.eastOut]]){
    draw.route('filter-drop-'+id,[from,to]);
    draw.chamber(id,...from.slice(0,2),to[2]-.15,.23);
  }
  draw.route('filtered-inlet',layout.tankInlet);
}

function rainStorage193(THREE,draw,layout) {
  const {center:[x,y],outside:[w,d],wall,waterLevel,bottom,top}=layout.tank;
  draw.box('tank-shell',[w,d,top-bottom],[x,y,(top+bottom)/2],'body',.38,0);
  draw.mesh('tank-water',new THREE.PlaneGeometry(w-2*wall,d-2*wall),[x,y,waterLevel],'water',.63,1);
  draw.chamber('tank-inspection',x+.40,y,top,.30);
  draw.route('screened-overflow',layout.overflow);
  draw.chamber('field-inspection',...fieldInspection193,layout.feeds[1][0][2]-.17,.30);
  rainField193.strips.forEach((strip,i)=>rainInfiltrationStrip193(draw,strip,i,layout.feeds[i]));
  for(const [id,chamber,vent,start] of [
    ['field',fieldInspection193,fieldVent193,layout.feeds[1][0][2]],
    ['sw',westFilter193,westVent193,layout.westOut[2]]]){
    const z=start+.23;
    draw.pipe(id+'-air-branch',[...chamber,z],[...vent,z],.055);
    draw.pipe(id+'-air-riser',[...vent,z],[...vent,.22],.055);
  }
}

function rainInfiltrationStrip193(draw,{x,y,columns,rows},index,branch) {
  const {unit,height}=rainField193,z=branch.at(-1)[2];
  draw.route('field-feed-'+index,branch);
  draw.route('field-vent-return-'+index,branch.map(([x,y,h])=>[x,y,h+.23]));
  for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
    const cx=x+(col+.5)*unit,cy=y+(row+.5)*unit;
    draw.box('crate-'+index+'-'+col+'-'+row,[unit,unit,height],[cx,cy,z],'body',.66,1);
    for(const offset of [-.24,0,.24]){
      draw.box('crate-rib',[.022,unit,.035],[cx+offset,cy,z+height/2],'grid',1,3);
      draw.box('crate-rib',[unit,.022,.035],[cx,cy+offset,z+height/2],'grid',1,3);
    }
  }
}

// Five slots include both legs of each valley corner; dimensions are in local Icon plan metres.
function rainEaveSlots193() {
  return [[-.002,-.002,.130,18.132],[8.37,-.002,8.502,4.34],[8.37,4.208,14.642,4.34],
    [8.37,12.58,8.502,18.132],[8.37,12.58,14.642,12.712]];
}

export function rainRoofCuts193(metadata,project=iconPlanPoint) {
  return rainEaveSlots193().map(([l,f,r,b])=>{
    const ring=[[l,f],[l,b],[r,b],[r,f]].map(([x,y])=>project(metadata,x,y,0).slice(0,2));
    return {parcel:'193',ring};
  });
}

function rainSubtractSlot(face,[l,f,r,b,low,high]) {
  const planes=[[2,low,1],[2,high,-1],[0,l,1],[0,r,-1],[1,f,1],[1,b,-1]];
  if(planes.some(([axis,limit,sign])=>face.every(p=>(p[axis]-limit)*sign<=0)))return [face];
  const kept=[];
  let inside=face;
  for(const [axis,limit,sign] of planes){
    const outside=[],next=[];
    for(let i=0;i<inside.length;i++){
      const p=inside[i],q=inside[(i+1)%inside.length],a=(p[axis]-limit)*sign,c=(q[axis]-limit)*sign;
      (a>=0?next:outside).push(p);
      if((a<0)!==(c<0)){
        const cut=p.map((v,k)=>v+(q[k]-v)*a/(a-c));
        next.push(cut);outside.push(cut);
      }
    }
    if(outside.length>=3)kept.push(outside);
    inside=next;
    if(inside.length<3)break;
  }
  return kept;
}

export function recessRainWallHeads193(THREE,group,eave) {
  const eaves=rainEaveSlots193().map(box=>[...box,eave-.14,eave+.3]);
  const openings=new Map(['upper-main-side','upper-garage-side','upper-terrace-side','upper-front-wing',
    'upper-rear-wing','front-gable','garden-gable','wing-gable'].map(id=>[id,eaves]));
  for(const [i,[x,y]] of rainOutlets193.entries()){
    const id=['facade-main-side','facade-main-side','facade-front-wing','facade-wing-rear'][i];
    if(!openings.has(id))openings.set(id,[]);
    const slot=i<2?[-.01,y-.073,.16,y+.073]:[x-.073,y-.13,x+.073,y+.13];
    openings.get(id).push([...slot,.106,.294]);
  }
  for(const [name,slots] of openings){
    const mesh=group.getObjectByName(name),old=mesh.geometry,geometry=new THREE.BufferGeometry();
    const attributes=Object.entries(old.attributes).filter(([key])=>key!=='normal');
    const output=attributes.map(()=>[]);
    for(const {start,count,materialIndex} of old.groups){
      const at=output[0].length/3;
      for(let i=start;i<start+count;i+=3){
        const triangle=[0,1,2].map(j=>{
          const n=old.index?old.index.getX(i+j):i+j;
          return attributes.flatMap(([,attr])=>Array.from({length:attr.itemSize},(_,k)=>attr.getComponent(n,k)));
        });
        let faces=[triangle];
        for(const slot of slots)faces=faces.flatMap(face=>rainSubtractSlot(face,slot));
        for(const face of faces)for(let j=1;j<face.length-1;j++)for(const p of [face[0],face[j],face[j+1]]){
          let offset=0;
          attributes.forEach(([,attr],k)=>{output[k].push(...p.slice(offset,offset+attr.itemSize));offset+=attr.itemSize;});
        }
      }
      geometry.addGroup(at,output[0].length/3-at,materialIndex);
    }
    attributes.forEach(([key,attr],i)=>geometry.setAttribute(key,new THREE.Float32BufferAttribute(output[i],attr.itemSize)));
    geometry.computeVertexNormals();mesh.geometry=geometry;old.dispose();
  }
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
  sections.splice(1,0,[low[0]+(following[0]-low[0])*f,low[1]+(following[1]-low[1])*f,low[2],low[3],.045]);
  function profile([x,y,nx,ny,run]){
    const floor=eave-rainGutter193.outletDepth+run*rainGutter193.slope;
    // The front apron meets the cut wall below; the rear fold follows the slope under the covering.
    return [[-.072,eave-.142],[-.072,eave+.065],[-.065,eave+.065],[-.065,floor],
      [.052,floor],[.058,eave+.129],[.077,eave+.144]].map(([offset,z])=>[x+nx*offset,y+ny*offset,z]);
  }
  const rings=sections.map(profile);
  for(let i=1;i<rings.length;i++){
    const a=rings[i-1],b=rings[i];
    for(let j=1;j<a.length;j++){
      if(i===1&&j===4)continue;
      positions.push(...a[j-1],...b[j-1],...b[j],...a[j-1],...b[j],...a[j]);
    }
  }
  // Gable ends have stop ends. The two west runs meet at a shared high point.
  if(!(points.at(-1)[0]===.072&&points.at(-1)[1]===8.60)){
    const [bottom,hem,,,,back,fold]=rings.at(-1);
    const inside=[fold[0],fold[1],bottom[2]];
    positions.push(...bottom,...hem,...back,...bottom,...back,...fold,...bottom,...fold,...inside);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

function rainOutletSocket(THREE,index,eave) {
  const [x,y]=rainIntake193[index],[tx,ty]=rainOutlets193[index];
  const [nx,ny]=rainInward193[index],positions=[];
  const z=eave-rainGutter193.outletDepth;
  const inlet=[[-.065,-.045],[.052,-.045],[.052,.045],[-.065,.045]]
    .map(([n,t])=>[x+nx*n-ny*t,y+ny*n+nx*t,z+Math.abs(t)*rainGutter193.slope]);
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

function rainMulch193(THREE,group,plantingMaterial) {
  const outlines=[
    [[-6.15,15.25],[-5.45,15.20],[-4.10,15.32],[-3.88,15.83],[-3.40,16.38],[-2.72,16.46],
      [-2.65,17.40],[-3.13,18.15],[-3.80,19.25],[-4.00,19.57],[-5.76,19.56],[-6.22,19.40],[-6.27,18.2]],
    [[.76,20.43],[1.90,20.36],[2.19,20.90],[1.96,21.65],[2.10,22.60],[2.12,23.40],
      [1.35,24.25],[1.82,25.18],[1.62,25.91],[.42,25.98],[.04,25.30],[.21,24.63],
      [.80,23.82],[.81,22.96],[.84,21.79],[.77,21.07]]
  ];
  const material=plantingMaterial??new THREE.MeshStandardMaterial({color:'#725d44',roughness:.99});
  // The scanned planting surface repeats every 1.30 m in site coordinates.
  const tileMetres=1.30;
  for(const [index,outline] of outlines.entries()){
    const shape=new THREE.Shape(),last=outline.at(-1);
    shape.moveTo((outline[0][0]+last[0])/2,(outline[0][1]+last[1])/2);
    outline.forEach(([x,y],i)=>{
      const [nx,ny]=outline[(i+1)%outline.length];
      shape.quadraticCurveTo(x,y,(x+nx)/2,(y+ny)/2);
    });
    const geometry=new THREE.ShapeGeometry(shape,8),position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
    const point=new THREE.Vector3();
    for(let i=0;i<position.count;i++){
      point.fromBufferAttribute(position,i).applyMatrix4(group.matrix);
      uv.setXY(i,point.x/tileMetres,point.y/tileMetres);
    }
    const mulch=new THREE.Mesh(geometry,material);
    mulch.name='rain-mulch-'+index;mulch.position.z=.084;mulch.receiveShadow=true;group.add(mulch);
  }
}

function rainSurfaceCovers(THREE,group) {
  const frame=new THREE.MeshStandardMaterial({color:0x3e4741,roughness:.86});
  const lid=new THREE.MeshStandardMaterial({color:0x59605a,roughness:.88});
  for(const [id,[vx,vy]] of [['field',fieldVent193],['sw',westVent193]]){
    for(const [name,r,h,z] of [['neck',.055,.19,.145],['hood',.078,.024,.264]]){
      const vent=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20,1,name==='neck'),frame);
      vent.rotation.x=Math.PI/2;vent.position.set(vx,vy,z);vent.name='rain-'+id+'-vent-'+name;group.add(vent);
    }
    for(let i=0;i<3;i++){
      const a=i*2*Math.PI/3,post=new THREE.Mesh(new THREE.BoxGeometry(.008,.008,.025),frame);
      post.position.set(vx+.05*Math.cos(a),vy+.05*Math.sin(a),.244);post.name='rain-'+id+'-vent-post';group.add(post);
    }
  }
  for(const [id,x,y,radius] of rainCovers193){
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(radius+.025,radius+.025,.065,40),frame);
    collar.name='rain-frame-'+id;
    collar.rotation.x=Math.PI/2;collar.position.set(x,y,.0605);group.add(collar);
    const cover=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.016,40),lid);
    cover.name='rain-cover-'+id;
    cover.rotation.x=Math.PI/2;cover.position.set(x,y,.092);cover.receiveShadow=true;group.add(cover);
    for(const offset of [-.38,.38]){
      const recess=new THREE.Mesh(new THREE.BoxGeometry(radius*.17,radius*.34,.003),frame);
      recess.name='rain-cover-keyhole';recess.position.set(x+offset*radius,y,.100);group.add(recess);
    }
  }
}

function rainFacadeCleanouts(THREE,group) {
  const seal=new THREE.MeshStandardMaterial({color:0x1d2422,roughness:.86});
  const panel=new THREE.MeshStandardMaterial({color:0x343b35,roughness:.81});
  for(const [i,[x,y]] of rainOutlets193.entries()){
    const [nx,ny]=rainInward193[i],wall=nx?[0,y]:[x,ny>0?4.21:12.71];
    const part=(id,w,d,h,offset,z,material,along=0)=>{
      const item=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),material);
      item.name='rain-service-hatch-'+id+'-'+i;
      item.rotation.z=Math.atan2(-nx,ny);
      item.position.set(wall[0]-nx*offset+ny*along,wall[1]-ny*offset-nx*along,z);group.add(item);
    };
    for(const edge of [-1,1]){
      part('jamb',.007,.018,.205,-.006,.20,seal,edge*.0765);
      part('frame',.146,.018,.0085,-.006,.20+edge*.09825,seal);
    }
    part('plug',.105,.018,.145,-.047,.20,panel);
    part('door',.153,.004,.198,.005,.20,panel);
    part('turn',.020,.002,.006,.008,.265,seal);
  }
}

export function createRainSurface(THREE,house,interior,plantingMaterial) {
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
  rainFacadeCleanouts(THREE,group);
  rainMulch193(THREE,group,plantingMaterial);
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
    fieldNetM3:rainField193.strips.reduce((sum,s)=>sum+s.columns*s.rows,0)*rainField193.unitNetM3};
  const draw=rainDrawing(THREE,group),{eave,ridge}=house.metadata.dimensions;
  const layout=rainHydraulics193();
  const swArea=4.25*18.13;
  const capacity=({rows,columns})=>rows*columns*rainField193.unitNetM3;
  const swCapacity=capacity(rainField193.strips[0]);
  group.userData.circuits={sw:{areaM2:swArea,stormM3:swArea*.027,fieldM3:swCapacity},
    se:{areaM2:area-swArea,stormM3:(area-swArea)*.027,fieldM3:group.userData.fieldNetM3-swCapacity}};
  rainRoof193(draw,eave,ridge);rainCollectors193(draw,layout);rainStorage193(THREE,draw,layout);
  return group;
}
