// Bicycle coordinates are in metres: X across the handlebar, Y toward the front wheel, Z up.
function iconBicycle(THREE, spec) {
 const bike=new THREE.Group();
 bike.name=spec.id;
 bike.position.set(...spec.center);
 const paint=(color,metalness=0,roughness=.58)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const tire=paint('#2a2c2a',0,.91), chrome=paint('#b2b8b6',.67,.32), dark=paint('#333a39',.32), enamel=paint(spec.paint,.37,.31);
 const tubes=new Map();
 function tube(a,b,r,mat){
  if(!tubes.has(mat))tubes.set(mat,[]);
  tubes.get(mat).push([a,b,r]);
 }
 function ring(name,x,y,z,r,width,mat) {
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(r,width,10,64),mat);
  wheel.rotation.y=Math.PI/2;wheel.position.set(x,y,z);wheel.name=name;bike.add(wheel);
 }
 function cable(points,r,mat) {
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  bike.add(new THREE.Mesh(new THREE.TubeGeometry(path,20,r,6,false),mat));
 }
 const half=spec.wheelbase/2,axle=spec.wheelRadius,top=axle+.56;
 const rear=[0,-half,axle],front=[0,half,axle],pedal=[0,-.09,axle-.05];
 const seat=[0,-.25,top-.09],head=[0,.32,top+.005],fork=[0,.35,top-.112];
 iconBikeWheels({half,axle,tire,chrome,tube,ring});
 for(const [a,b,r] of [[pedal,seat,.024],[seat,head,.024],[fork,pedal,.032],[fork,head,.030]])tube(a,b,r,enamel);
 for(const side of [-1,1]){
  const rearAxle=[side*.045,rear[1],rear[2]];
  tube(rearAxle,seat,.014,enamel);tube(rearAxle,pedal,.015,enamel);
  tube([side*.045,front[1],front[2]],[side*.027,fork[1],fork[2]],.024,dark);
 }
 const saddle=[0,-.28,top+.075];
 tube(seat,saddle,.016,chrome);
 const cushion=new THREE.Mesh(new THREE.SphereGeometry(1,22,12),tire);
 cushion.scale.set(.085,.137,.031);cushion.position.set(...saddle);bike.add(cushion);
 tube(head,[0,.29,top+.09],.018,chrome);tube([0,.29,top+.09],[0,.36,top+.10],.017,dark);
 for(const side of [-1,1]){
  const tip=side*spec.barWidth/2;
  tube([0,.36,top+.10],[tip*.72,.34,top+.13],.012,chrome);
  tube([tip*.72,.34,top+.13],[tip-.013*side,.297,top+.14],.013,tire);
  tube([tip*.55,.35,top+.116],[tip*.87,.383,top+.08],.007,dark);
 }
 cable([[.16,.355,top+.10],[.22,.49,top-.09],[.078,.39,top-.26],[.05,half,axle+.03]],.0045,dark);
 ring('chainring',.071,pedal[1],pedal[2],.085,.008,chrome);
 ring('rear-cog',.071,rear[1],axle,.043,.008,dark);
 for(const side of [-1,1]){
  tube([.071,rear[1],axle+side*.043],[.071,pedal[1],pedal[2]+side*.085],.005,dark);
  const tip=[side*.085,pedal[1]+side*.109,pedal[2]+side*.105];
  tube([side*.074,pedal[1],pedal[2]],tip,.012,chrome);
  tube(tip,[side*.158,tip[1],tip[2]],.02,tire);
 }
 for(const [mat,segments] of tubes)iconGarageTubeInstances(THREE,bike,segments,mat);
 bike.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
 return bike;
}

function iconBikeWheels({half,axle,tire,chrome,tube,ring}) {
 for(const [i,y] of [-half,half].entries()){
  ring('tyre-'+i,0,y,axle,axle-.024,.024,tire);
  ring('alloy-rim-'+i,0,y,axle,axle-.052,.010,chrome);
  tube([-.053,y,axle],[.053,y,axle],.023,chrome);
  for(let j=0;j<28;j++){
   const t=j*2*Math.PI/28,offset=j%2?.21:-.21;
   tube([j%2?.027:-.027,y+.023*Math.sin(t+offset),axle+.023*Math.cos(t+offset)],
    [0,y+(axle-.052)*Math.sin(t),axle+(axle-.052)*Math.cos(t)],.0025,chrome);
  }
 }
}

function iconGarageTubeInstances(THREE,group,segments,material) {
 const batch=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,10),material,segments.length);
 const pose=new THREE.Object3D(),axis=new THREE.Vector3(0,1,0);
 for(const [i,[a,b,r]] of segments.entries()){
  const start=new THREE.Vector3(...a),dir=new THREE.Vector3(...b).sub(start);
  pose.position.copy(start).addScaledVector(dir,.5);
  pose.scale.set(r,dir.length(),r);pose.quaternion.setFromUnitVectors(axis,dir.normalize());
  pose.updateMatrix();batch.setMatrixAt(i,pose.matrix);
 }
 batch.castShadow=batch.receiveShadow=true;group.add(batch);
}

function iconGarageCabinet(context,spec) {
 const {THREE,box,mats}=context,[x,y,ex,ey]=spec.footprint;
 const mat=(color,metalness=.3)=>new THREE.MeshStandardMaterial({color,roughness:.51,metalness});
 const lacquer=mat('#3f5857'), steel=mat('#606969',.56), light=mat('#bdc2bb',.72);
 const block=(name,b,z,h,m)=>box('garage-workbench-'+name,b,z,h,m);
 block('base',[x+.035,y+.062,ex-.035,ey],.012,.072,mats.metal);
 block('carcass',[x,y+.03,ex,ey],.084,.734,steel);
 for(let i=0;i<6;i++){
  const z=.092+i*.118;
  block('drawer-'+i,[x+.014,y+.012,x+.72,y+.035],z,.109,lacquer);
  block('drawer-pull-'+i,[x+.07,y,x+.67,y+.012],z+.079,.017,light);
 }
 for(let i=0;i<2;i++){
  const left=x+.74+(ex-x-.74)*i/2,right=x+.74+(ex-x-.74)*(i+1)/2;
  block('locker-'+i,[left+.005,y+.012,right-.005,y+.03],.094,.714,lacquer);
  block('locker-pull-'+i,[i?left+.037:right-.05,y,i?left+.05:right-.037,y+.012],.64,.115,light);
 }
 block('beech-top',[x,y,ex,ey],.818,spec.topHeight-.818,mats.oak);
 for(let i=0;i<2;i++){
  const left=x+(ex-x)*i/2,right=x+(ex-x)*(i+1)/2;
  block('upper-case-'+i,[left+.004,ey-.29,right-.004,ey],1.82,spec.upperCabinetTop-1.82,steel);
  block('upper-door-'+i,[left+.016,ey-.308,right-.016,ey-.29],1.835,.54,lacquer);
  block('upper-grip-'+i,[left+.1,ey-.325,right-.1,ey-.308],1.87,.014,light);
 }
 iconGarageToolPanel(context,spec,{steel,light},block);
 context.obstacle('garage-workbench',spec.footprint,0,spec.upperCabinetTop);
}

function iconGarageToolPanel(context,spec,{steel,light},block) {
 const {THREE,mats,beam}=context,[x,,ex,ey]=spec.footprint;
 const pegboard=steel.clone();
 pegboard.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 pegMeters;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npegMeters=position.xz;');
  shader.fragmentShader='varying vec2 pegMeters;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   float radius=length(fract(pegMeters/.032+.5)-.5);
   float aa=max(fwidth(radius),.015);
   diffuseColor.rgb*=mix(.11,1.,smoothstep(.086-aa,.086+aa,radius));
  `);
 };
 block('tool-panel',[x+.04,ey-.061,ex-.04,ey-.025],1.00,.71,pegboard);
 const hooks=[];
 for(let i=0;i<5;i++){
  const px=x+.19+i*.103,h=.15+.015*i,pz=1.44;
  beam('wrench-shank-'+i,[px,ey-.095,pz-h],[px,ey-.095,pz],.009,light);
  const end=new THREE.Mesh(new THREE.TorusGeometry(.023,.008,8,16,Math.PI*1.56),light);
  end.rotation.set(Math.PI/2,0,-Math.PI*.27);end.position.set(px,ey-.095,pz+.014);
  end.castShadow=true;context.group.add(end);
  hooks.push([[px,ey-.052,pz-.030],[px,ey-.10,pz-.030],.007]);
 }
 const yellow=new THREE.MeshStandardMaterial({color:'#d28c48',roughness:.56});
 for(let i=0;i<5;i++){
  const px=ex-.22-i*.080;
  beam('driver-grip-'+i,[px,ey-.115,1.43],[px,ey-.115,1.51],.021,yellow);
  beam('driver-shaft-'+i,[px,ey-.115,1.27],[px,ey-.115,1.43],.006,light);
 }
 block('driver-rack',[ex-.60,ey-.13,ex-.14,ey-.063],1.416,.018,mats.metal);
 iconGarageTubeInstances(THREE,context.group,hooks,steel);
}

export function addIconGarage(context) {
 const {THREE,group,box,beam,obstacle,mats,data}=context,spec=data.garageFitout;
 iconGarageCabinet(context,spec.workbench);
 for(const bike of spec.bikes){
  group.add(iconBicycle(THREE,bike));
  const [cx,cy,z]=bike.center;
  for(const dy of [-.16,.025]){
   beam(bike.id+'-hook-'+dy,[.475,cy+dy,z+.83],[cx+.035,cy+dy,z+.83],.013,mats.metal);
   beam(bike.id+'-peg-'+dy,[cx+.035,cy+dy,z+.83],[cx+.035,cy+dy,z+.92],.013,mats.dark);
  }
  const halfX=bike.barWidth/2,halfY=bike.wheelbase/2+bike.wheelRadius;
  obstacle(bike.id,[cx-halfX,cy-halfY,cx+halfX,cy+halfY],z,z+bike.wheelRadius+1.0);
 }
 for(const x of [1.85,4.95]){
  box('garage-linear-'+x,[x-.035,2.14,x+.035,3.26],2.761,.033,mats.lamp);
  const light=new THREE.PointLight('#fff5dd',15,6,2);light.position.set(x,2.70,2.63);group.add(light);
 }
}
