// Local XY follows the front garden; world XY is easting/northing relative to the parcel model origin.
export const wastewater193 = {
  tankCenter: [-8.337,18.526], angleDeg: -43.5,
  tankDiameter: 1.995, tankHeight: 2.16, outletInvert: -.535, residents: 5, capacityPE: 6, capacityM3Day: 1.2,
  rows: 2, modulesPerRow: 5, moduleLength: 1.20, moduleWidth: .50, moduleHeight: .36,
  clearBetweenRows: 1, fieldCenter: [3,-1.1], distributor: [3,2.7],
  status: 'Wariant porównawczy. Obowiązujący plan nie przewiduje rozsączania ścieków na tej działce.'
};

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
  const r = wastewater193.tankDiameter / 2, bottom = -1.85;
  const top = bottom + wastewater193.tankHeight, water = wastewater193.outletInvert;
  const floor = part('biodisc-base',new THREE.CircleGeometry(r,64),[0,0,bottom],'#163f4b',1);
  floor.userData.dimensionM = wastewater193.tankDiameter;
  const shell = new THREE.CylinderGeometry(r,r*.94,1.945,64,1,true,-Math.PI*.38,Math.PI*1.38);
  part('biodisc-cutaway-shell',shell,[0,0,bottom+1.945/2],'#256775',2,.54).rotation.x = Math.PI/2;
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
      [x,0,-1.19],'#7ba0a2',3,.56);
  }
  ring('biodisc-cover-rim',0,0,.095,r,'#98ead2',6);
  ring('biodisc-service-cover-outline',0,0,top,r*.77,'#69aa98',6);
}

function wastewaterTunnels(THREE,{part,pipe}) {
  const {fieldCenter:[cx,cy],modulesPerRow,rows,moduleLength:l,moduleWidth:w,moduleHeight:h,clearBetweenRows} = wastewater193;
  const base = -.84, run = l*modulesPerRow;
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
  for (let row=0;row<rows;row++) {
    const x = cx+(row-(rows-1)/2)*(w+clearBetweenRows);
    const id = 'drain-row-'+(row+1);
    const gravel = new THREE.BoxGeometry(w+.10,run+.10,.11);
    part(id+'-gravel',gravel,[x,cy,base-.055],'#c1a576',1,.86);
    for (let i=0;i<modulesPerRow;i++) {
      const end = cy+run/2-i*l;
      part(id+'-tunnel-'+(i+1),tunnel,[x,end,base],'#b97838',3);
      for (let j=0;j<4;j++) part(id+'-rib',rim,[x,end-.07-j*.29,base+.009],'#edc585',4);
    }
    const ventY = cy-run/2+.19;
    pipe(id+'-vent',[x,ventY,base+h],[x,ventY,.35],.055,'#e8cc9e',5);
    pipe(id+'-vent-cap',[x,ventY,.35],[x,ventY,.41],.082,'#4e6e69',6);
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
  wastewaterTunnels(THREE,draw);
  function pipeRun(name,points,color) {
    for (let i=1;i<points.length;i++) draw.pipe(name+'-'+i,points[i-1],points[i],.055,color,4);
  }
  pipeRun('building-inlet',[[6.11,-4.54,-.34],[1.28,-4.54,-.40],[0,-3.26,-.42],[0,-.98,-.45]],'#d58d63');
  const [x,y] = wastewater193.distributor;
  pipeRun('clarified-outlet',[[0,.98,wastewater193.outletInvert],[0,1.55,-.55],[1.15,y,-.57],[x,y,-.60]],'#53b5aa');
  draw.pipe('distribution-chamber',[x,y,-.76],[x,y,.04],.20,'#346d70',5);
  draw.ring('distributor-cover',x,y,.05,.20,'#9ed5bf',6);
  for (const offset of [-.75,.75]) {
    pipeRun('distribution-branch',[[x+offset/4,y,-.61],[x+offset,y-.32,-.64],
      [x+offset,1.9,-.66]],'#70c9b3');
  }
  return group;
}
