function heatingCabinetFinish(THREE) {
 const metal=(color,metalness,roughness)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 return {
  zinc:metal('#929b9b',.62,.44),brass:metal('#ac8954',.64,.35),rail:metal('#adb5b8',.76,.29),
  pipe:metal('#e1dcd0',.03,.73),returnPipe:metal('#d9dde0',.03,.72),ink:metal('#495256',.35,.54),
  red:metal('#963d36',.12,.46),blue:metal('#4a6b88',.12,.46),white:metal('#ede8df',.07,.47),
  glass:new THREE.MeshPhysicalMaterial({color:'#d4e4e5',transparent:true,opacity:.35,depthWrite:false,roughness:.18})
 };
}

function heatingCabinetParts(THREE) {
 const cube=new THREE.BoxGeometry(),round=new THREE.CylinderGeometry(1,1,1,16),hex=new THREE.CylinderGeometry(1,1,1,6);
 function part(root,name,shape,finish,x,y,z){
  const mesh=new THREE.Mesh(shape,finish);
  mesh.position.set(x,y,z);mesh.name=name;root.add(mesh);return mesh;
 }
 return {
  box(root,name,x,y,z,w,d,h,finish){
   const mesh=part(root,name,cube,finish,x,y,z);mesh.scale.set(w,d,h);return mesh;
  },
  cylinder(root,name,x,y,z,r,h,finish,axis='z',nut=false){
   const mesh=part(root,name,nut?hex:round,finish,x,y,z);
   mesh.scale.set(r,h,r);
   if(axis==='x')mesh.rotation.z=Math.PI/2;
   if(axis==='z')mesh.rotation.x=Math.PI/2;
   return mesh;
  }
 };
}

function heatingCabinetShell(THREE,root,{box,cylinder},finish,config,span) {
 const left=-.109,right=span+.068,width=right-left,middle=(left+right)/2;
 const bottom=.045,top=.735,height=top-bottom,midZ=(bottom+top)/2,back=-.067,front=.116;
 const wall=new THREE.MeshStandardMaterial({color:config.finish,roughness:.83});
 const [start,end,liningHeight]=config.lining;
 const cladding=(name,a,b,z,h)=>box(root,name,(a+b)/2,(front+back)/2,z+h/2,b-a,front-back,h,wall);
 cladding('lining-left',start,left,.003,liningHeight);
 cladding('lining-right',right,end,.003,liningHeight);
 cladding('lining-skirt',left,right,.003,bottom-.003);
 cladding('lining-head',left,right,top,liningHeight-top+.003);
 box(root,'back',middle,back,midZ,width,.012,height,finish.zinc);
 for(const [i,u] of [left,right].entries())box(root,'jamb-'+i,u,(back+front)/2,midZ,.015,front-back,height,wall);
 for(const [i,z] of [bottom,top].entries())box(root,'edge-'+i,middle,(back+front)/2,z,width,front-back,.014,wall);
 const hinge=new THREE.Group();hinge.name='heating-access-door';hinge.position.set(left+.008,front,midZ);
 root.add(hinge);
 const leafWidth=width-.016;
 box(hinge,'painted-access-panel',leafWidth/2,.003,0,leafWidth-.004,.014,height-.019,wall);
 cylinder(hinge,'quarter-turn-latch',leafWidth-.050,.012,0,.013,.003,finish.zinc,'y');
 box(hinge,'latch-slot',leafWidth-.050,.014,0,.015,.002,.0025,finish.ink);
 return hinge;
}

function heatingCabinetRail(root,parts,finish,span,ports,supply,height) {
 const {box,cylinder}=parts,rail=supply?'supply':'return',cap=supply?finish.red:finish.blue;
 cylinder(root,rail+'-header',span/2,0,height,.022,span,finish.rail,'x');
 cylinder(root,rail+'-isolation-valve',-.035,0,height,.023,.064,finish.brass,'x',true);
 box(root,rail+'-valve-lever',-.035,.012,height+.032,.072,.014,.009,cap);
 cylinder(root,rail+'-end-plug',span+.009,0,height,.024,.018,finish.brass,'x',true);
 cylinder(root,rail+'-air-vent',span+.012,0,height+.031,.009,.046,finish.brass);
 for(const [i,u] of ports.entries()){
  cylinder(root,rail+'-port-'+i,u,.003,height-.012,.014,.034,finish.brass,'z',true);
  cylinder(root,rail+'-seat-'+i,u,0,height+.022,.014,.021,finish.brass,'z',true);
  if(supply){
   cylinder(root,'flowmeter-'+i,u,0,height+.063,.010,.065,finish.glass);
   cylinder(root,'flow-float-'+i,u,0,height+.059,.006,.013,finish.red);
   cylinder(root,'meter-cap-'+i,u,0,height+.097,.011,.007,finish.red);
  }else{
   cylinder(root,'return-valve-'+i,u,0,height+.047,.017,.037,finish.blue);
  }
 }
}

function heatingCabinetTails(THREE,hardware,source,levelZ,finish) {
 const position=source.geometry.getAttribute('position'),points=[];
 // Opposite vertices on the diagram tube give its exact rounded centreline.
 for(let i=0;i<position.count;i+=8){
  const a=new THREE.Vector3().fromBufferAttribute(position,i);
  const b=new THREE.Vector3().fromBufferAttribute(position,i+4);
  points.push(a.lerp(b,.5));
 }
 const base=levelZ+.046;
 if(points[0].z<points.at(-1).z)points.reverse();
 const path=[];
 for(const point of points){
  if(point.z<base){
   const previous=path.at(-1);
   if(previous)path.push(previous.clone().lerp(point,(previous.z-base)/(previous.z-point.z)));
   break;
  }
  path.push(point);
 }
 if(path.length<2)return;
 const radius=source.userData.rail.startsWith('primary')?.014:.008;
 const curve=new THREE.CurvePath();
 for(let i=1;i<path.length;i++)curve.add(new THREE.LineCurve3(path[i-1],path[i]));
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(24,Math.ceil(curve.getLength()/.008)),radius,8,false),
  source.userData.rail.includes('return')?finish.returnPipe:finish.pipe);
 mesh.name=source.name;mesh.userData={route:source.name,terminal:path[0].toArray(),room:source.userData.room};hardware.add(mesh);
}

export function createHeatingCabinets(THREE,services,makePicker) {
 const group=new THREE.Group();group.name='heating-access-cabinets-193';
 const doors=new Map(),finish=heatingCabinetFinish(THREE),parts=heatingCabinetParts(THREE);
 for(const level of ['ground','upper']){
  const system=services.getObjectByName('underfloor-'+level);
  for(const [bank,config] of system.userData.cabinets.entries()){
   const {x,y,face,alongY,location}=config;
   const rail=system.getObjectByName('manifold-'+bank+'-0.55');
   const span=Math.hypot(rail.userData.to[0]-x,rail.userData.to[1]-y),base=rail.userData.from[2]-.55;
   const root=new THREE.Group();root.name='heating-cabinet-'+level+'-'+bank;group.add(root);
   root.userData={level,location,ports:rail.userData.ports,open:false};
   root.position.set(x,y,base);root.rotation.z=alongY?Math.PI/2:0;root.scale.y=alongY?-face:face;
   const door=heatingCabinetShell(THREE,root,parts,finish,config,span);
   const hardware=new THREE.Group();hardware.name='manifold-hardware';root.add(hardware);
   const tails=new THREE.Group();tails.name=root.name+'-connections';group.add(tails);
   const pipes=system.children.filter(mesh=>mesh.userData.bank===bank&&mesh.userData.rail);
   for(const pipe of pipes)heatingCabinetTails(THREE,tails,pipe,base,finish);
   const ports=pipes.filter(mesh=>mesh.userData.rail==='supply').map(mesh=>alongY?mesh.userData.from[1]-y:mesh.userData.from[0]-x);
   for(const u of [span*.16,span*.84])parts.box(hardware,'rail-bracket',u,-.035,.46,.020,.042,.255,finish.zinc);
   heatingCabinetRail(hardware,parts,finish,span,ports,true,.55);
   heatingCabinetRail(hardware,parts,finish,span,ports,false,.38);
   hardware.visible=tails.visible=false;
   doors.set(door,()=>{root.userData.open=!root.userData.open;hardware.visible=tails.visible=root.userData.open;
    door.rotation.z=root.userData.open?Math.PI/2:0;door.updateWorldMatrix(true,true);});
  }
 }
 const pick=makePicker([...doors.keys()]);
 return {group,toggleAt(ndc,camera){const toggle=doors.get(pick(ndc,camera));if(!toggle)return false;toggle();return true;}};
}
