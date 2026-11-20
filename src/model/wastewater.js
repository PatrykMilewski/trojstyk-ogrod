// Tank-local +Y points into the rear garden. World XY is easting/northing relative to the site origin.
export const wastewater193 = {
  tankCenter: [.274988513,-10.454065338], tankPlanCenter: [-1.80,24.30], angleDeg: -133.5311992803774,
  tankDiameter: 1.995, tankHeight: 2.66, serviceMargin: 1.015, inletInvert: -.950, outletInvert: -1.035, residents: 5, capacityPE: 6, capacityM3Day: 1.2,
  rows: 2, modulesPerRow: 5, moduleLength: 1.20, moduleWidth: .50, moduleHeight: .36,
  clearBetweenRows: 1, endCapDepth: .043, fieldCenter: [-7.096863052,6.550660186], fieldAngleDeg: 170.0311992803774,
  distributorOffset: 3.90, outletSlope: .01, inletSlope: .02, fieldBase: -1.35,
  status: 'Wariant warunkowy. Do potwierdzenia możliwość przyłączenia do kanalizacji i warunki gruntowo-wodne.'
};

function wastewaterXY([x,y], [cx,cy], degrees) {
  const a = degrees*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
  return [cx+x*c-y*s,cy+x*s+y*c];
}

function wastewaterFieldPoint(point) {
  return wastewaterXY(point,wastewater193.fieldCenter,wastewater193.fieldAngleDeg);
}

const wastewaterCoverShoulder193={radiusFactor:.76,height:.245};
const wastewaterRunLength = wastewater193.moduleLength*wastewater193.modulesPerRow;
const wastewaterRowOffsets = Array.from({length:wastewater193.rows},(_,i)=>
  (i-(wastewater193.rows-1)/2)*(wastewater193.moduleWidth+wastewater193.clearBetweenRows));
const wastewaterVentY = -wastewaterRunLength/2+.19;
const wastewaterDistributor = wastewaterFieldPoint([0,wastewater193.distributorOffset]);

function wastewaterTankLocal193([x,y]) {
  const [cx,cy]=wastewater193.tankPlanCenter;
  return [cx-x,y-cy];
}

// A grass maintenance strip reaches the lid from the driveway around the heat pump and tree crowns.
const wastewaterHosePath193=[[1.20,-1.75],[-1.10,-1.10],[-1.10,2.60],[-1.60,4],[-1.60,18],[-1.80,23.30]];
function wastewaterApproach193() {
  const normals=wastewaterHosePath193.slice(1).map(([x,y],i)=>{
    const [ax,ay]=wastewaterHosePath193[i],length=Math.hypot(x-ax,y-ay);
    return [(ay-y)/length,(x-ax)/length];
  });
  const side=sign=>wastewaterHosePath193.map(([x,y],i)=>{
    const a=normals[Math.max(0,i-1)],b=normals[Math.min(i,normals.length-1)];
    const offset=sign*.45/(1+a[0]*b[0]+a[1]*b[1]);
    return wastewaterTankLocal193([x+offset*(a[0]+b[0]),y+offset*(a[1]+b[1])]);
  });
  return [...side(1),...side(-1).reverse()];
}

export function wastewaterServiceAccess193() {
  const world = p=>wastewaterXY(p,wastewater193.tankCenter,wastewater193.angleDeg);
  const circle = (center,r)=>Array.from({length:40},(_,i)=>{
    const a = 2*Math.PI*i/40;
    return [center[0]+r*Math.cos(a),center[1]+r*Math.sin(a)];
  });
  const margin = .80;
  const halfWidth = Math.max(...wastewaterRowOffsets)+wastewater193.moduleWidth/2+margin;
  const halfLength = wastewaterRunLength/2+wastewater193.endCapDepth+margin;
  const field = [[-halfWidth,-halfLength],[halfWidth,-halfLength],[halfWidth,halfLength],[-halfWidth,halfLength]];
  return [circle([0,0],wastewater193.tankDiameter/2+wastewater193.serviceMargin),circle(wastewaterDistributor,.75),
    field.map(wastewaterFieldPoint),wastewaterApproach193()].map(ring=>({ring:ring.map(world)}));
}

function wastewaterGravityPipe(points,startInvert,slope) {
  let z=startInvert;
  return points.map(([x,y],i)=>{
    if(i)z-=slope*Math.hypot(x-points[i-1][0],y-points[i-1][1]);
    return [x,y,z+.055];
  });
}

function wastewaterInlet() {
  const fromHouse=[[7.20,17.09],[7.20,17.41],[10.65,20.86],[10.65,22.75],[9.20,24.20],
    [2.90,24.20],[1.05,22.35],[-1.04,22.35],[-1.80,23.11],[-1.80,23.32]];
  const fromTank=fromHouse.reverse().map(wastewaterTankLocal193);
  return wastewaterGravityPipe(fromTank,wastewater193.inletInvert,-wastewater193.inletSlope).reverse();
}

function wastewaterOutlet() {
  const [x,y]=wastewaterDistributor;
  return wastewaterGravityPipe([[0,.98],[0,1.10],[-.65,1.75],[x+y-1.75,1.75],[x,y]],
    wastewater193.outletInvert,wastewater193.outletSlope);
}

function wastewaterFieldGroup(THREE,parent) {
  const field = new THREE.Group();
  field.name = 'wastewater-tunnel-field';
  field.position.set(...wastewater193.fieldCenter,0);
  field.rotation.z = wastewater193.fieldAngleDeg*Math.PI/180;
  parent.add(field);
  return field;
}

function wastewaterDrawing(THREE, group) {
  const materials = new Map();
  function part(name, geometry, position, color, order, opacity = 1) {
    const key = color + ':' + opacity;
    if (!materials.has(key)) materials.set(key, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide
    }));
    const mesh = new THREE.Mesh(geometry,materials.get(key));
    mesh.name = name;
    mesh.position.set(...position);
    mesh.renderOrder = 200 + order;
    mesh.raycast = () => {};
    group.add(mesh);
    return mesh;
  }
  function pipe(name, from, to, radius, color, order) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
    const axis = end.clone().sub(start);
    const geom = new THREE.CylinderGeometry(radius,radius,axis.length(),12);
    const mesh = part(name,geom,start.lerp(end,.5).toArray(),color,order);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
  }
  function ring(name,x,y,z,radius,color,order) {
    part(name,new THREE.TorusGeometry(radius,.018,6,64),[x,y,z],color,order);
  }
  return {part,pipe,ring};
}

function wastewaterTank(THREE, {part,pipe,ring}) {
  const r = wastewater193.tankDiameter / 2, bottom = wastewater193.inletInvert-1.40;
  const water = wastewater193.outletInvert;
  const floor = part('biodisc-base',new THREE.CircleGeometry(r,64),[0,0,bottom],'#163f4b',1);
  floor.userData.dimensionM = wastewater193.tankDiameter;
  const shellHeight=.095-bottom;
  const shell = new THREE.CylinderGeometry(r,r*.94,shellHeight,64,1,true,-Math.PI*.38,Math.PI*1.38);
  part('biodisc-cutaway-shell',shell,[0,0,bottom+shellHeight/2],'#256775',2,.54).rotation.x = Math.PI/2;
  part('biodisc-liquid-surface',new THREE.CircleGeometry(r*.94,64),[0,0,water],'#52989b',3,.7);
  for (const [stage,start] of [[1,-.65],[2,.055]]) {
    for (let i=0;i<10;i++) {
      const x = start+i*.064;
      const disc = part('biodisc-rotor-'+stage+'-'+i,new THREE.CylinderGeometry(.40,.40,.036,32),
        [x,0,water+.09],i%2?'#8cd7c0':'#316f69',4);
      disc.rotation.z = Math.PI/2;
    }
  }
  pipe('biodisc-shaft',[-.85,0,water+.09],[.85,0,water+.09],.046,'#d7e5c8',5);
  for (const x of [-.76,0,.76]) {
    part('biodisc-baffle',new THREE.BoxGeometry(.035,2*Math.sqrt(r*r-x*x)*.91,.96),
      [x,0,bottom+.66],'#7ba0a2',3,.56);
  }
  pipe('biodisc-inlet-socket',[0,-.98,wastewater193.inletInvert+.055],[0,-.91,wastewater193.inletInvert+.055],.062,'#d58d63',4);
  pipe('biodisc-outlet-socket',[0,.91,water+.055],[0,.98,water+.055],.062,'#53b5aa',4);
  ring('biodisc-cover-rim',0,0,.095,r,'#98ead2',6);
  ring('biodisc-service-cover-outline',0,0,wastewaterCoverShoulder193.height,r*wastewaterCoverShoulder193.radiusFactor,'#69aa98',6);
}

function wastewaterTunnels(THREE,{part,pipe}) {
  const {modulesPerRow,moduleLength:l,moduleWidth:w,moduleHeight:h,endCapDepth,fieldBase:base} = wastewater193;
  const run = wastewaterRunLength;
  const arch = new THREE.Shape();
  arch.moveTo(-w/2,0);
  arch.bezierCurveTo(-w/2,h*1.33,w/2,h*1.33,w/2,0);
  arch.closePath();
  function archSection(length) {
    const geometry = new THREE.ExtrudeGeometry(arch,{depth:length,bevelEnabled:false,curveSegments:14});
    geometry.rotateX(Math.PI/2);
    return geometry;
  }
  const tunnel = archSection(l-.014), rim = archSection(.025);
  for (const [row,x] of wastewaterRowOffsets.entries()) {
    const id = 'drain-row-'+(row+1);
    const gravel = new THREE.BoxGeometry(w+.10,run+.10,.11);
    part(id+'-gravel',gravel,[x,0,base-.055],'#c1a576',1,.86);
    for (let i=0;i<modulesPerRow;i++) {
      const end = run/2-i*l;
      part(id+'-tunnel-'+(i+1),tunnel,[x,end,base],'#b97838',3);
      for (let j=0;j<4;j++) part(id+'-rib',rim,[x,end-.07-j*.29,base+.009],'#edc585',4);
    }
    const cap = archSection(endCapDepth);
    for(const [end,y] of [['inlet',run/2+endCapDepth],['end',-run/2]]) {
      part(id+'-'+end+'-cap',cap,[x,y,base],'#82512e',4);
    }
    const ventY = wastewaterVentY;
    pipe(id+'-vent',[x,ventY,base+h],[x,ventY,0],.055,'#e8cc9e',5);
  }
}

export function createWastewaterInstallation(THREE) {
  const group = new THREE.Group();
  group.name = 'installations-wastewater-193';
  group.position.set(...wastewater193.tankCenter,0);
  group.rotation.z = wastewater193.angleDeg*Math.PI/180;
  group.visible = false;
  group.userData = {kind:'wastewater-concept',parcel:'193',...wastewater193};
  const draw = wastewaterDrawing(THREE,group);
  wastewaterTank(THREE,draw);
  const fieldDraw = wastewaterDrawing(THREE,wastewaterFieldGroup(THREE,group));
  wastewaterTunnels(THREE,fieldDraw);
  function pipeRun(name,points,color) {
    for (let i=1;i<points.length;i++) draw.pipe(name+'-'+i,points[i-1],points[i],.055,color,4);
  }
  pipeRun('building-inlet',wastewaterInlet(),'#d58d63');
  const outlet = wastewaterOutlet();
  pipeRun('clarified-outlet',outlet,'#53b5aa');
  const radius=.055, y=wastewater193.distributorOffset, invert=outlet.at(-1)[2]-radius;
  fieldDraw.pipe('distribution-chamber',[0,y,invert-.18],[0,y,.04],.20,'#346d70',5);
  fieldDraw.ring('distributor-cover',0,y,.095,.20,'#9ed5bf',6);
  const inletY = wastewaterRunLength/2+wastewater193.endCapDepth;
  for(const [index,x] of wastewaterRowOffsets.entries()) {
    const from = [0,y,invert-.015+radius];
    const elbow = [x,y-.50,from[2]-.02*Math.hypot(x,.50)];
    fieldDraw.pipe('distribution-branch-'+index+'-1',from,elbow,radius,'#70c9b3',4);
    fieldDraw.pipe('distribution-branch-'+index+'-2',elbow,[x,inletY,elbow[2]-.02*(elbow[1]-inletY)],radius,'#70c9b3',4);
  }
  return group;
}

function wastewaterMulchSurfaces(THREE,tank,field,material) {
  const z=.084;
  function hole(shape,x,y,radius){
    const cut=new THREE.Path();
    cut.absarc(x,y,radius,0,Math.PI*2,true);
    shape.holes.push(cut);
  }
  function place(parent,shape,id){
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape,40),material);
    mesh.name='wastewater-mulch-'+id;
    mesh.position.z=z;mesh.receiveShadow=true;parent.add(mesh);
  }
  const aroundTank=new THREE.Shape(),r=wastewater193.tankDiameter/2;
  aroundTank.absarc(0,0,r+wastewater193.serviceMargin,0,Math.PI*2,false);
  hole(aroundTank,0,0,r-.006);
  place(tank,aroundTank,'biodisc');

  const strip=new THREE.Shape(),y=wastewater193.distributorOffset;
  const far=-wastewaterRunLength/2-wastewater193.endCapDepth-.81;
  strip.moveTo(-.60,y);
  strip.absarc(0,y,.60,Math.PI,0,true);
  strip.bezierCurveTo(.40,y-1,.43,-1.30,.58,-1.65);
  strip.bezierCurveTo(.77,-2.07,1.15,-2.14,1.18,-2.66);
  strip.lineTo(1.18,far);strip.lineTo(-1.18,far);strip.lineTo(-1.18,-2.66);
  strip.bezierCurveTo(-1.15,-2.14,-.77,-2.07,-.58,-1.65);
  strip.bezierCurveTo(-.43,-1.30,-.40,y-1,-.60,y);
  hole(strip,0,y,.214);
  for(const x of wastewaterRowOffsets)hole(strip,x,wastewaterVentY,.051);
  place(field,strip,'inspection-strip');
}

export function createWastewaterSurface(THREE,plantingMaterial) {
  const group = new THREE.Group();
  group.name = 'wastewater-surface-193';
  group.position.set(...wastewater193.tankCenter,0);
  group.rotation.z = wastewater193.angleDeg*Math.PI/180;
  const plastic = new THREE.MeshStandardMaterial({color:'#54624d',roughness:.83});
  const trim = new THREE.MeshStandardMaterial({color:'#39453c',roughness:.8});
  function turned(name,x,y,profile,material,parent=group) {
    const points = profile.map(([radius,z])=>new THREE.Vector2(radius,z));
    const part = new THREE.Mesh(new THREE.LatheGeometry(points,48),material);
    part.name=name;part.rotation.x=Math.PI/2;part.position.set(x,y,0);
    part.castShadow=true;part.receiveShadow=true;parent.add(part);
  }
  const r=wastewater193.tankDiameter/2;
  turned('biodisc-service-lid',0,0,[[r,0],[r,.09],[r*.96,.12],[r*wastewaterCoverShoulder193.radiusFactor,wastewaterCoverShoulder193.height],[r*.3,.30],[.001,.31]],plastic);
  turned('biodisc-lid-seam',0,0,[[r*.988,.086],[r*1.003,.09],[r*1.003,.106],[r*.98,.11]],trim);
  const field=wastewaterFieldGroup(THREE,group);
  const mulch=plantingMaterial??new THREE.MeshStandardMaterial({color:'#685847',roughness:.99});
  wastewaterMulchSurfaces(THREE,group,field,mulch);
  turned('distributor-hatch',0,wastewater193.distributorOffset,[[.22,0],[.22,.095],[.20,.11],[.001,.11]],trim,field);
  for(const [row,x] of wastewaterRowOffsets.entries()){
    turned('tunnel-vent-'+row,x,wastewaterVentY,[[.055,0],[.055,.36],[.047,.37]],plastic,field);
    for(let i=0;i<3;i++){
      const a=i*2*Math.PI/3;
      turned('vent-cowl-stay',x+.045*Math.cos(a),wastewaterVentY+.045*Math.sin(a),
        [[.005,.36],[.005,.404]],trim,field);
    }
    turned('vent-cowl-'+row,x,wastewaterVentY,[[.043,.399],[.085,.401],[.085,.415],[.032,.438],[.001,.438]],trim,field);
  }
  return group;
}
