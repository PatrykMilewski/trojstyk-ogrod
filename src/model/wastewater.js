// World XY is site easting/northing. The tank and tunnels retain their first location beside the garage.
export const wastewater193 = {
  tankCenter: [-8.337,18.526], tankPlanCenter: [13.279028504,-1.903691200], angleDeg: -43.5,
  tankDiameter: 1.995, tankHeight: 2.66, serviceMargin: 1.015, inletInvert: -.950, outletInvert: -1.035, residents: 5, capacityPE: 6, capacityM3Day: 1.2,
  rows: 2, modulesPerRow: 5, moduleLength: 1.20, moduleWidth: .50, moduleHeight: .36,
  clearBetweenRows: 1, endCapDepth: .043, fieldCenter: [3,-1.10], fieldAngleDeg: 0,
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

const wastewaterCoverShoulder193={radiusFactor:.76,height:.245,rimFactor:1.003};
const wastewaterRunLength = wastewater193.moduleLength*wastewater193.modulesPerRow;
const wastewaterRowOffsets = Array.from({length:wastewater193.rows},(_,i)=>
  (i-(wastewater193.rows-1)/2)*(wastewater193.moduleWidth+wastewater193.clearBetweenRows));
// Sealed vent laterals leave the far end caps and rise into the driveway-side shrub bed.
const ventCapY193=-wastewaterRunLength/2-wastewater193.endCapDepth;
const ventRoutes193=[
  [[wastewaterRowOffsets[0],ventCapY193],[-.75,-3.22],[-1.16,-3.63],[-2.82,-3.63],[-3.75,-2.70],[-3.75,-1.70]],
  [[wastewaterRowOffsets[1],ventCapY193],[.75,-3.48],[.12,-4.11],[-3.04,-4.11],[-3.75,-3.40]]
];
const ventEnds193=ventRoutes193.map(route=>route.at(-1));
const ventServiceRadius193=.38;
const wastewaterDistributor = wastewaterFieldPoint([0,wastewater193.distributorOffset]);

function wastewaterTankLocal193([x,y]) {
  const [cx,cy]=wastewater193.tankPlanCenter;
  const planYAxisDeg=-43.5311992803774;
  return wastewaterXY([y-cy,x-cx],[0,0],planYAxisDeg-wastewater193.angleDeg);
}

// A 90 cm grass strip connects the driveway to the BioDisc lid.
function wastewaterApproach193() {
  const [x,y]=wastewater193.tankPlanCenter;
  const centerY=y+.90;
  return [[6,centerY-.45],[x-.90,centerY-.45],[x-.90,centerY+.45],[6,centerY+.45]].map(wastewaterTankLocal193);
}

export function wastewaterServiceAccess193() {
  const world = p=>wastewaterXY(p,wastewater193.tankCenter,wastewater193.angleDeg);
  const circle = (center,r)=>Array.from({length:40},(_,i)=>{
    const a = 2*Math.PI*i/40;
    return [center[0]+r*Math.cos(a),center[1]+r*Math.sin(a)];
  });
  const fieldOutline=margin=>{
    const w=Math.max(...wastewaterRowOffsets)+wastewater193.moduleWidth/2+margin;
    const l=wastewaterRunLength/2+wastewater193.endCapDepth+margin;
    return [[-w,-l],[w,-l],[w,l],[-w,l]].map(wastewaterFieldPoint).map(world);
  };
  const radius=wastewater193.tankDiameter/2;
  return [
    {id:'tank',ring:circle([0,0],radius+wastewater193.serviceMargin).map(world),footprint:circle([0,0],radius).map(world)},
    {id:'distributor',ring:circle(wastewaterDistributor,.75).map(world)},
    {id:'field',ring:fieldOutline(.80),footprint:fieldOutline(0)},
    ...ventEnds193.map((p,i)=>({id:'vent-'+(i+1),ring:circle(wastewaterFieldPoint(p),ventServiceRadius193).map(world)})),
    {id:'approach',ring:wastewaterApproach193().map(world)}
  ];
}

function wastewaterGravityPipe(points,startInvert,slope) {
  let z=startInvert;
  return points.map(([x,y],i)=>{
    if(i)z-=slope*Math.hypot(x-points[i-1][0],y-points[i-1][1]);
    return [x,y,z+.055];
  });
}

function wastewaterInlet() {
  const fromHouse=[[6.11,-4.54],[1.28,-4.54],[0,-3.26],[0,-.98]];
  return wastewaterGravityPipe(fromHouse.reverse(),wastewater193.inletInvert,-wastewater193.inletSlope).reverse();
}

function wastewaterOutlet() {
  const [x,y]=wastewaterDistributor;
  return wastewaterGravityPipe([[0,.98],[0,1.42],[y-1.42,y],[x,y]],
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
    const vent=wastewaterGravityPipe(ventRoutes193[row],base+h-.15,-.01);
    for(let i=1;i<vent.length;i++)pipe(id+'-vent-link-'+i,vent[i-1],vent[i],.055,'#e8cc9e',5);
    pipe(id+'-vent',vent.at(-1),[...ventEnds193[row],0],.055,'#e8cc9e',5);
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
  function pad(parent,id,x,y,outer,inner) {
    const shape=new THREE.Shape();
    shape.absarc(x,y,outer,0,Math.PI*2,false);
    hole(shape,x,y,inner);
    place(parent,shape,id);
  }
  const r=wastewater193.tankDiameter/2;
  pad(tank,'biodisc',0,0,r+wastewater193.serviceMargin+.035,r-.006);
  pad(field,'distributor',0,wastewater193.distributorOffset,.79,.214);
  for(const [i,[x,y]] of ventEnds193.entries())pad(field,'vent-'+i,x,y,ventServiceRadius193+.04,.051);
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
  turned('biodisc-lid-seam',0,0,[[r*.988,.086],[r*wastewaterCoverShoulder193.rimFactor,.09],[r*wastewaterCoverShoulder193.rimFactor,.106],[r*.98,.11]],trim);
  const field=wastewaterFieldGroup(THREE,group);
  const mulch=plantingMaterial??new THREE.MeshStandardMaterial({color:'#685847',roughness:.99});
  wastewaterMulchSurfaces(THREE,group,field,mulch);
  turned('distributor-hatch',0,wastewater193.distributorOffset,[[.22,0],[.22,.095],[.20,.11],[.001,.11]],trim,field);
  for(const [row,[x,wastewaterVentY]] of ventEnds193.entries()){
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
