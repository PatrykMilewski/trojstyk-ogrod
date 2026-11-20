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

function iconCarMaterials(THREE,paintName,paintColor) {
 const car=new THREE.Group(),material=(name,color,metalness,roughness)=>new THREE.MeshStandardMaterial({name,color,metalness,roughness,side:THREE.DoubleSide});
 const paint=material(paintName,paintColor,.23,.25),glass=material('Solar control glazing','#354b58',.38,.15);
 const black=material('Gloss black glazing surround','#151c20',.19,.26),grille=material('Grille and wheel wells','#202327',.10,.63);
 const alloy=material('Machined alloy','#aeb5b7',.72,.28),chrome=material('Chrome brightwork','#d6dcdc',.78,.19);
 const lamp=material('Headlamp light guide','#dfedf0',.29,.17),red=material('Rear lamp lens','#982723',.28,.23);
 lamp.emissive.setHex(0x73868a);lamp.emissiveIntensity=.24;
 const tyre=material('Tyre rubber','#25272a',.02,.94);
 function mesh(geometry,finish,name) {
  const m=new THREE.Mesh(geometry,finish);m.castShadow=m.receiveShadow=true;if(name)m.name=name;car.add(m);return m;
 }
 function surface(rows,finish,name) {
  const positions=rows.flat(2),indices=[],n=rows[0].length;
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<n-1;j++){
   const k=i*n+j;indices.push(k,k+n,k+n+1,k,k+n+1,k+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setIndex(indices);g.computeVertexNormals();return mesh(g,finish,name);
 }
 function line(points,r,finish) {
  const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  return mesh(new THREE.TubeGeometry(path,Math.max(4,points.length*3),r,6,false),finish);
 }
 function ellipse(pos,scale,finish,name) {
  const m=mesh(new THREE.SphereGeometry(1,24,14),finish,name);m.position.set(...pos);m.scale.set(...scale);return m;
 }
 return {THREE,car,mesh,surface,line,ellipse,paint,glass,black,grille,alloy,chrome,lamp,red,tyre};
}

function iconAstraModel(THREE,spec) {
 const ctx=iconCarMaterials(THREE,'Astra Olympic White','#f3f3ed');
 iconAstraBody(ctx);iconAstraGlazing(ctx);iconAstraFascias(ctx);
 iconCarAlloys(ctx,[-1.225,1.437],.313,.776,'astra');
 ctx.car.name=spec.id;
 ctx.car.userData={kind:'garage-vehicle',...spec};
 return ctx.car;
}

function iconAstraBody({surface,line,paint,grille,black}) {
 const stations=[[-2.185,.828,.29,.735],[-1.86,.860,.26,.784]],rad=.347;
 for(const [axle,belt] of [[-1.225,.864],[1.437,.976]]){
  for(let i=0;i<=18;i++){
   const a=Math.PI-i*Math.PI/18;
   stations.push([axle+rad*Math.cos(a),.9045,.313+rad*Math.sin(a),belt+.015*Math.cos(a)]);
  }
  if(axle<0)stations.push([-.51,.895,.201,.905],[.25,.893,.196,.932],[.92,.891,.204,.958]);
 }
 stations.push([1.94,.881,.257,.988],[2.185,.824,.32,.995]);
 const rings=stations.map(([y,w,floor,belt],i)=>{
  const bend=i===0?1:i===stations.length-1?-1:0, hood=y<-.72;
  const shoulder=hood?.034:.020;
  const half=[[0,floor],[w*.89,floor],[w*.98,floor+.015],[w,(belt+floor)/2],[w*.985,belt-shoulder-.045],[w*.95,belt-shoulder],[w*.83,belt],[0,belt+.014]];
  return [...half,...half.slice(1,-1).reverse().map(([x,z])=>[-x,z]),half[0]]
   .map(([x,z])=>[x,y+bend*(.010+.195*(x/.828)**2),z]);
 });
 surface(rings,paint,'astra-sculpted-body');
 for(const i of [0,rings.length-1]){
  const cap=rings[i],half=(cap.length-1)/2;
  const end=i===0?-1:1;
  surface(Array.from({length:half+1},(_,j)=>Array.from({length:25},(_,k)=>{
   const [w,,z]=cap[j],x=w*(k/12-1);return [x,end*(2.175-.195*(x/.828)**2),z];
  })),paint);
 }
 surface([[[-.68,-1.87,.26],[.68,-1.87,.26]],[[-.68,1.92,.26],[.68,1.92,.26]]],grille);
 function bodySurfaceX(y,z) {
  const n=stations.findIndex(row=>row[0]>y);
  function at(i){
   const ring=rings[i].slice(1,8),k=ring.findIndex(p=>p[2]>=z);
   if(k<=0)return ring[k===0?0:ring.length-1][0];
   const [x0,,z0]=ring[k-1],[x1,,z1]=ring[k];
   return x0+(x1-x0)*(z-z0)/(z1-z0);
  }
  const t=(y-stations[n-1][0])/(stations[n][0]-stations[n-1][0]);
  return at(n-1)*(1-t)+at(n)*t+.0035;
 }
 for(const side of [-1,1]){
  const p=(x,y,z)=>[side*x,y,z];
  line([p(.872,-.84,.247),p(.893,-.56,.239),p(.895,.55,.294),p(.888,1.09,.454)],.009,paint);
  for(const [y,z] of [[-.08,.872],[1.02,.927]]){
   line([p(.878,y-.055,z),p(.888,y-.03,z+.009),p(.888,y+.045,z+.009),p(.878,y+.069,z)],.012,paint);
  }
  for(const pts of [[[-.78,.81],[-.8,.64],[-.77,.38],[-.75,.245]],[[.15,.889],[.113,.67],[.096,.45],[.105,.236]],[[1.29,.918],[1.19,.757],[1.08,.59],[.99,.46]]]){
   const curve=[];
   for(let i=1;i<pts.length;i++)for(let k=0;k<6;k++){
    const t=k/6, y=pts[i-1][0]*(1-t)+pts[i][0]*t,z=pts[i-1][1]*(1-t)+pts[i][1]*t;
    curve.push(p(bodySurfaceX(y,z),y,z));
   }
   const [y,z]=pts.at(-1);curve.push(p(bodySurfaceX(y,z),y,z));line(curve,.0022,black);
  }
 }
}

function iconAstraGlazing({surface,line,ellipse,paint,glass,black,chrome}) {
 // Stations follow the windscreen, roof crown, floating rear pillar, and tailgate glass.
 const stations=[[-.965,.922,.826,.922,.772,.925],[-.63,.928,.827,1.17,.723,1.184],
  [-.245,.934,.829,1.413,.664,1.444],[.00,.939,.83,1.445,.660,1.478],[.46,.952,.829,1.451,.654,1.485],
  [1.04,.973,.824,1.426,.641,1.460],[1.39,.992,.808,1.380,.620,1.413],
  [1.70,1.006,.786,1.313,.608,1.351],[1.99,1.012,.735,1.046,.632,1.068]];
 function section(y) {
  const hi=stations.findIndex(row=>row[0]>=y);
  if(hi<1)return stations[hi===0?0:stations.length-1];
  const a=stations[hi-1],b=stations[hi],t=(y-a[0])/(b[0]-a[0]);
  return a.map((v,i)=>v+(b[i]-v)*t);
 }
 const sidePoint=(side,y,t,offset=.002)=>{
  const [,base,w,top,r]=section(y);return [side*(w+(r-w)*t+offset),y,base+(top-base)*t];
 };
 const roof=stations.map(([y,base,w,top,r,crown])=>[[-r,y,top],[-r*.72,y,crown-.006],[0,y,crown],[r*.72,y,crown-.006],[r,y,top]]);
 surface(roof.slice(0,3),glass,'astra-windscreen');surface(roof.slice(2,8),paint,'astra-roof');surface(roof.slice(7),glass,'astra-tailgate-glass');
 for(const sign of [-1,1]){
  surface(stations.map(([y])=>[sidePoint(sign,y,0),sidePoint(sign,y,1)]),glass);
  for(const [bottomStart,bottomEnd,topStart,topEnd,finish] of [
   [-.965,-.865,-.26,-.19,paint],[.079,.191,.184,.299,black],
   [1.185,1.335,1.029,1.119,black],[1.45,1.89,1.346,1.563,paint],[1.77,1.99,1.563,1.7,black]
  ]){
   surface([[sidePoint(sign,bottomStart,0,.008),sidePoint(sign,bottomEnd,0,.008)],
    [sidePoint(sign,topStart,1,.008),sidePoint(sign,topEnd,1,.008)]],finish);
  }
  line(stations.slice(0,8).map(([y])=>sidePoint(sign,y,.985,.008)),.009,chrome);
  line(stations.map(([y])=>sidePoint(sign,y,0,.006)),.010,black);
  line([[sign*.829,-.725,.95],[sign*.883,-.708,.971],[sign*.916,-.698,1.004]],.021,black);
  ellipse([sign*.944,-.693,1.014],[.077,.113,.049],paint,'astra-mirror-cap');
  ellipse([sign*.944,-.606,1.011],[.061,.026,.034],glass);
 }
 surface([[[-.63,1.649,1.342],[0,1.649,1.356],[.63,1.649,1.342]],
  [[-.640,1.785,1.329],[0,1.797,1.346],[.640,1.785,1.329]]],paint);
}

function iconAstraFascias({THREE,surface,line,mesh,grille,chrome,black,lamp,red,paint}) {
 const face=(end,x,z,offset=.004)=>[x,end*(2.175-.195*(x/.828)**2+offset),z];
 const band=(end,rows,mat,name)=>{
  const profile=[];
  for(let i=1;i<rows.length;i++){
   const a=rows[i-1],b=rows[i],steps=Math.max(1,Math.ceil(Math.abs(b[0]-a[0])/.037));
   for(let n=0;n<steps;n++)profile.push(a.map((v,k)=>v+(b[k]-v)*n/steps));
  }
  return surface([...profile,rows.at(-1)].map(([x,z,top])=>[face(end,x,z),face(end,x,top)]),mat,name);
 };
 const symmetric=rows=>[...rows.slice(1).reverse().map(([x,a,b])=>[-x,a,b]),...rows];
 band(-1,symmetric([[0,.544,.698],[.24,.552,.687],[.46,.59,.691],[.56,.651,.685]]),grille,'astra-wing-grille');
 band(-1,symmetric([[0,.32,.445],[.39,.332,.44],[.56,.371,.43]]),black);
 for(const x of [-.32,-.22,-.12,0,.12,.22,.32])line([face(-1,x,.345,.002),face(-1,x+.015,.428,.002)],.003,grille);
 for(const sign of [-1,1]){
  const m=(x,z,depth)=>face(-1,sign*x,z,depth);
  line([m(.059,.637,.003),m(.22,.64,.005),m(.41,.669,.005),m(.57,.67,.004)],.0038,chrome);
  band(-1,[[sign*.55,.37,.432],[sign*.66,.383,.457],[sign*.75,.416,.478]],grille);
  line([m(.605,.411,.008),m(.655,.427,.008),m(.713,.449,.008)],.007,lamp);
  const lights=[[.45,.642,.702],[.58,.637,.725],[.697,.646,.730],[.786,.686,.718]].map(([x,a,b])=>[sign*x,a,b]);
  band(-1,lights,black);
  surface([[m(.481,.663,.011),m(.51,.699,.011)],[m(.642,.656,.011),m(.644,.718,.011)],
   [m(.744,.687,.009),m(.762,.71,.009)]],lamp);
  line([m(.535,.697,.012),m(.64,.713,.012),m(.747,.706,.012)],.006,lamp);
  const wrapped=(x,y,z)=>[sign*x,y,z];
  surface([[wrapped(.747,-2.015,.685),wrapped(.747,-2.015,.720)],
   [wrapped(.846,-1.88,.704),wrapped(.846,-1.88,.765)],[wrapped(.853,-1.75,.759),wrapped(.853,-1.75,.779)]],lamp);
  band(1,[[sign*.45,.829,.912],[sign*.62,.828,.928],[sign*.77,.87,.946]],red);
  surface([[wrapped(.77,2.012,.869),wrapped(.77,2.012,.946)],[wrapped(.864,1.908,.853),wrapped(.862,1.908,.958)],
   [wrapped(.891,1.638,.882),wrapped(.882,1.638,.933)]],red);
 }
 for(const end of [-1,1]){
  band(end,[[-.253,end<0?.425:.602,end<0?.532:.708],[0,end<0?.425:.602,end<0?.532:.708],[.253,end<0?.425:.602,end<0?.532:.708]],paint);
  const z=end<0?.64:.83;
  const emblem=mesh(new THREE.TorusGeometry(.045,.005,8,36),chrome,'astra-opel-ring');emblem.rotation.x=Math.PI/2;emblem.position.set(0,end*2.180,z);
  const outline=[[-.064,.011],[.011,.011],[.001,.001],[.064,.001],[.052,-.009],[-.014,-.009],[-.005,.002],[-.054,.002]];
  const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
  const bolt=mesh(new THREE.ExtrudeGeometry(shape,{depth:.003,bevelEnabled:false}),chrome,'astra-opel-blitz');
  bolt.rotation.set(Math.PI/2,0,end>0?Math.PI:0,'ZXY');bolt.position.set(0,end*2.182,z);
 }
}

function iconCarAlloys({THREE,mesh,line,tyre,black,alloy,chrome},axles,radius,trackHalf,prefix) {
 for(const y of axles)for(const side of [-1,1]){
  const wheelX=side*trackHalf,z=radius,offset=trackHalf-.776;
  const circular=(geometry,x,finish,name)=>{
   const m=mesh(geometry,finish,name);m.position.set(x,y,z);m.rotation.z=Math.PI/2;return m;
  };
  circular(new THREE.CylinderGeometry(radius,radius,.204,40),wheelX,tyre,prefix+'-tyre');
  circular(new THREE.CylinderGeometry(.211,.211,.011,40),side*(.881+offset),black);
  const rim=mesh(new THREE.TorusGeometry(.207,.009,8,40),alloy);rim.rotation.y=Math.PI/2;rim.position.set(side*(.889+offset),y,z);
  const p=(r,a,x)=>[side*(x+offset),y+r*Math.cos(a),z+r*Math.sin(a)];
  for(let i=0;i<5;i++)for(const s of [-1,1]){
   const a=i*2*Math.PI/5;
   line([p(.044,a,.893),p(.115,a+s*.065,.89),p(.196,a+s*.17,.888)],.0105,alloy);
  }
  circular(new THREE.CylinderGeometry(.053,.053,.014,24),side*(.890+offset),alloy);
  circular(new THREE.CylinderGeometry(.027,.027,.012,20),side*(.898+offset),chrome);
 }
}

function iconAudiAvantModel(THREE,spec) {
 const ctx=iconCarMaterials(THREE,'Mythos Black metallic','#212429');
 ctx.paint.metalness=.50;
 iconAudiAvantBody(ctx);
 iconAudiAvantGlazing(ctx);
 iconAudiAvantFascias(ctx);
 iconCarAlloys(ctx,[-1.5065,1.3855],.335,.805,'audi');
 ctx.car.name=spec.id;
 ctx.car.userData={kind:'garage-vehicle',...spec};
 return ctx.car;
}

function iconAudiAvantBody({surface,line,paint,black,grille}) {
 // Sections are local metres, with the front at negative Y. The lower edge follows both wheel arches.
 const stations=[[-2.4145,.785,.29,.70],[-2.18,.866,.215,.77],[-1.90,.91,.188,.82]];
 for(const [axle,belt] of [[-1.5065,.87],[1.3855,.99]]){
  for(let i=0;i<=20;i++){
   const a=Math.PI-i*Math.PI/20;
   stations.push([axle+.362*Math.cos(a),.930,.329+.362*Math.sin(a),belt+.023*Math.cos(a)]);
  }
  if(axle<0)stations.push([-.99,.91,.180,.902],[-.55,.911,.173,.913],[.35,.909,.173,.945],[.95,.914,.187,.965]);
 }
 stations.push([1.91,.912,.230,1.009],[2.19,.899,.252,1.010],[2.4145,.811,.304,.987]);
 const rings=stations.map(([y,w,bottom,belt],i)=>{
  const end=i===0?-1:i===stations.length-1?1:0;
  const half=[[0,bottom],[w*.90,bottom],[w*.978,bottom+.021],[w,bottom+(belt-bottom)*.62],
   [w*.991,belt-.064],[w*.947,belt-.018],[w*.854,belt],[0,belt+.018]];
  return [...half,...half.slice(1,-1).reverse().map(([x,z])=>[-x,z]),half[0]]
   .map(([x,z])=>[x,y-end*(.0065+.149*(x/.85)**2),z]);
 });
 surface(rings,paint,'audi-sculpted-body');
 for(const i of [0,rings.length-1]){
  const end=i===0?-1:1;
  surface(rings[i].slice(0,8).map(([w,,z])=>Array.from({length:25},(_,k)=>{
   const x=w*(k/12-1);return [x,end*(2.408-.149*(x/.85)**2),z];
  })),paint);
 }
 surface([[[-.72,-2.05,.225],[.72,-2.05,.225]],[[-.72,2.11,.225],[.72,2.11,.225]]],grille);
 for(const sign of [-1,1]){
  const p=(x,y,z)=>[sign*x,y,z];
  line([p(.885,-1.11,.211),p(.899,-.54,.206),p(.9,.48,.206),p(.902,1.00,.24)],.016,black);
  for(const [y,z] of [[-.02,.812],[1.05,.857]])line([p(.915,y-.064,z),p(.921,y,z+.004),p(.916,y+.064,z)],.009,black);
  for(const [y,lean] of [[-1.05,-.004],[.152,-.038],[1.25,-.258]]){
   const rear=y>1;
   line([p(rear?.914:.904,y,rear?.962:.889),p(rear?.927:.914,y+.010,rear?.894:.81),
    p(.914,y+lean,rear?.674:.508),p(.90,y+lean-.019,rear?.472:.249)],.0032,black);
  }
 }
}

function iconAudiAvantGlazing({THREE,mesh,surface,line,ellipse,glass,paint,black,chrome}) {
 // The long roof, raked rear pillar and fixed quarter glass follow Audi's Avant side elevation.
 const sections=[[-1.125,.904,.837,.906,.838,.92],[-.75,.912,.838,1.160,.761,1.184],
  [-.373,.922,.839,1.355,.709,1.386],[-.14,.928,.840,1.398,.687,1.421],[.25,.945,.84,1.414,.684,1.438],
  [1.00,.968,.840,1.406,.677,1.426],[1.47,.982,.834,1.379,.665,1.398],[1.82,.992,.825,1.326,.656,1.347],
  [2.32,1.008,.785,1.016,.704,1.042]];
 const roof=sections.map(([y,, ,top,w,crown])=>[[-w,y,top],[-w*.75,y,crown-.005],[0,y,crown],[w*.75,y,crown-.005],[w,y,top]]);
 surface(roof.slice(0,3),glass,'audi-windscreen');surface(roof.slice(2,8),paint,'audi-avant-roof');
 surface(roof.slice(7),glass,'audi-hatch-glass');
 const edge=(sign,y,t,offset=0)=>{
  const i=Math.max(0,sections.findIndex(row=>row[0]>=y)-1),a=sections[i],b=sections[i+1],u=(y-a[0])/(b[0]-a[0]);
  const [,base,w,top,r]=a.map((v,k)=>v+(b[k]-v)*u);
  return [sign*(w+(r-w)*t+offset),y,base+(top-base)*t];
 };
 for(const sign of [-1,1]){
  surface(sections.map(([y])=>[edge(sign,y,0),edge(sign,y,1)]),glass,'audi-side-glazing');
  for(const [a,b,c,d,finish] of [[-1.125,-1.033,-.378,-.290,paint],[.075,.182,.210,.310,black],
   [1.18,1.26,.989,1.077,black],[1.862,2.32,1.514,1.82,paint]]){
   surface([[edge(sign,a,0,.006),edge(sign,b,0,.006)],[edge(sign,c,1,.006),edge(sign,d,1,.006)]],finish);
  }
  line(sections.slice(0,8).map(([y])=>edge(sign,y,.99,.006)),.009,chrome);
  line(sections.map(([y])=>edge(sign,y,0,.004)),.009,chrome);
  line([[sign*.834,-.778,.941],[sign*.909,-.754,.965],[sign*.963,-.738,1.005]],.017,black);
  ellipse([sign*.9645,-.734,1.026],[.085,.126,.052],paint,'audi-mirror-cap');
  ellipse([sign*.966,-.640,1.026],[.073,.021,.04],glass);
  line([[sign*.623,-.28,1.398],[sign*.63,-.05,1.43],[sign*.628,.42,1.445],[sign*.62,1.04,1.430],[sign*.611,1.59,1.39]],.009,chrome);
 }
 surface([[[-.66,1.722,1.350],[0,1.722,1.365],[.66,1.722,1.350]],
  [[-.665,1.874,1.323],[0,1.901,1.345],[.665,1.874,1.323]]],paint,'audi-hatch-spoiler');
 const fin=new THREE.Shape();fin.moveTo(-.095,0);fin.quadraticCurveTo(-.052,.031,.062,.057);fin.lineTo(.075,.014);fin.lineTo(.077,0);
 const antenna=mesh(new THREE.ExtrudeGeometry(fin,{depth:.026,bevelEnabled:false}),paint,'audi-roof-aerial');
 antenna.rotation.set(Math.PI/2,Math.PI/2,0,'ZXY');antenna.position.set(-.013,1.36,1.403);
}

function iconAudiAvantFascias({THREE,mesh,surface,line,paint,chrome,black,grille,lamp,red}) {
 const face=(end,x,z,depth=.003)=>[x,end*(2.408-.149*(x/.85)**2+depth),z];
 const band=(end,rows,mat,name,depth=.003)=>surface(rows.map(([x,z,top])=>[face(end,x,z,depth),face(end,x,top,depth)]),mat,name);
 const mirror=rows=>[...rows.slice(1).reverse().map(([x,a,b])=>[-x,a,b]),...rows];
 const frame=mirror([[0,.299,.667],[.325,.301,.659],[.458,.325,.614],[.521,.441,.56]]);
 band(-1,frame,grille,'audi-singleframe');
 for(const edge of [1,2])line(frame.map(row=>face(-1,row[0],row[edge],.0028)),.004,black);
 for(let row=0;row<4;row++)for(let i=-4;i<=4;i++){
  const x=i*.091+(row%2)*.037,z=.342+row*.076;
  line([face(-1,x-.036,z+.015,.0028),face(-1,x,z-.006,.0028),face(-1,x+.036,z+.015,.0028)],.0038,black);
 }
 for(const sign of [-1,1]){
  const side=rows=>rows.map(([x,a,b])=>[sign*x,a,b]);
  band(-1,side([[.445,.599,.650],[.552,.597,.676],[.697,.632,.700],[.802,.662,.714]]),black,'audi-headlamp');
  band(-1,side([[.446,.633,.646],[.562,.641,.655],[.69,.665,.681],[.794,.682,.696]]),lamp,'audi-daytime-running-light',.006);
  band(-1,side([[.576,.281,.31],[.639,.283,.548],[.747,.295,.534],[.788,.326,.373]]),black,'audi-lower-intake');
  band(1,side([[.36,.845,.897],[.535,.842,.940],[.747,.879,.944],[.808,.895,.936]]),red,'audi-rear-lamp');
  surface([[[sign*.788,2.275,.888],[sign*.788,2.275,.943]],[[sign*.888,2.11,.891],[sign*.888,2.11,.941]],
   [[sign*.915,1.9,.911],[sign*.913,1.9,.932]]],red);
 }
 band(1,mirror([[0,.869,.889],[.28,.868,.890],[.54,.869,.898]]),red,'audi-rear-light-strip');
 band(1,mirror([[0,.282,.340],[.5,.291,.356],[.76,.317,.398]]),grille,'audi-diffuser');
 for(const end of [-1,1]){
  const z=end<0?.592:.939,plateZ=end<0?.414:.67;
  band(end,[[-.243,plateZ,plateZ+.097],[0,plateZ,plateZ+.097],[.243,plateZ,plateZ+.097]],chrome,'audi-number-plate',.005);
  for(const x of [-.0711,-.0237,.0237,.0711]){
   const ring=mesh(new THREE.TorusGeometry(.035,.004,8,40),chrome,'audi-emblem-ring');
   ring.rotation.x=Math.PI/2;ring.scale.y=.86;ring.position.set(...face(end,x,z,.0026));
  }
 }
}

export function addIconGarage(context) {
 const {THREE,group,box,beam,obstacle,mats,data}=context,spec=data.garageFitout;
 iconGarageCabinet(context,spec.workbench);
 const vehicles=[iconAstraModel,iconAudiAvantModel];
 for(const [index,build] of vehicles.entries()){
  const [left,front,right,back]=spec.parkingBays[index];
  const car=build(THREE,spec.vehicles[index]);
  car.position.set((left+right)/2,(front+back)/2,.008);group.add(car);
 }
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
