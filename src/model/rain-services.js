// Coordinates follow the mirrored Icon floor plan; the installation inherits its site transform.
const rainOutlets193 = [
  [.075,.36], [.075,16.84], [14.19,4.285], [8.68,12.635]
];
const rainField193 = {center:[9.6,26.65], columns:5, rows:3, unit:.80, height:.66, unitNetM3:.405};
const rainTank193 = {center:[10.2,22.35], outside:[2,2.9], wall:.08, usableM3:6, overflowZ:-1.10};

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
    pipe(id,[x,y,bottom],[x,y,.015],radius,'body');
    mesh(id+'-rim',new THREE.TorusGeometry(radius,.022,8,40),[x,y,.022],'lip',1,5);
  }
  return {box,mesh,pipe,route,chamber};
}

function rainRoof193(THREE,draw,eave,ridge) {
  const [gf,gr,wf,wr]=rainOutlets193, z=eave-.085;
  // Centrelines run inside the fascia; the unsupported porch edge discharges at the wing wall.
  const runs=[
    [[.075,0],gf],[[.075,9.06],gf],[[.075,9.06],gr],[[.075,18.13],gr],
    [[8.425,0],[8.425,4.285],wf],[[14.64,4.285],wf],
    [[8.425,18.13],[8.425,12.635],wr],[[14.64,12.635],wr]
  ];
  const profile=new THREE.Shape();
  for(const [i,[x,y]] of [[-.0625,0],[-.0625,.075],[-.054,.075],[-.054,.009],[.054,.009],[.054,.075],[.0625,.075],[.0625,0]].entries()){
    if(i===0)profile.moveTo(x,y);else profile.lineTo(x,y);
  }
  profile.closePath();
  for(const [run,points] of runs.entries()){
    let rise=0;
    for(let i=points.length-1;i>0;i--){
      const a=points[i],b=points[i-1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      const geometry=new THREE.ExtrudeGeometry(profile,{depth:length,bevelEnabled:false});
      geometry.rotateX(Math.PI/2);geometry.rotateZ(Math.atan2(dx,-dy));
      const pos=geometry.attributes.position;
      for(let j=0;j<pos.count;j++)pos.setZ(j,pos.getZ(j)+.001*(pos.getX(j)*dx+pos.getY(j)*dy)/length);
      draw.mesh('gutter-'+run+'-'+i,geometry,[...a,z+rise],'gutter',1,4);
      rise+=length*.001;
    }
  }
  for(const [index,[x,y]] of rainOutlets193.entries()){
    draw.box('downpipe-'+index,[.070,.080,z+.47],[x,y,(z-.47)/2],'pipe');
    draw.box('cleanout-'+index,[.12,.13,.18],[x,y,.20],'lip',1,4);
  }
  // Both valleys conduct runoff into the inside corners of the T-shaped eaves.
  for(const [index,y] of [4.21,12.71].entries())draw.pipe('valley-'+index,[4.25,8.46,ridge],[8.5,y,eave],.041,'lip');
}

function rainCollectors193(draw) {
  const [gf,gr,wf,wr]=rainOutlets193;
  const westTee=[-1.48,gr[1],-.72],eastTee=[15.36,13.55,-.72],filter=[10.2,20.15,-.99];
  draw.route('ground-front-west',[[...gf,-.47],[-1.48,gf[1],-.485],westTee]);
  draw.route('ground-rear-west',[[...gr,-.47],[gr[0],gr[1],-.69],westTee]);
  draw.route('ground-west-trunk',[westTee,[-1.48,19.95,-.76],[-.80,20.63,-.78],[9.72,20.63,-.98],filter]);
  draw.route('ground-front-east',[[...wf,-.47],[15.36,3.80,-.50],eastTee]);
  draw.route('ground-rear-east',[[...wr,-.47],[9.48,13.55,-.60],eastTee]);
  draw.route('ground-east-trunk',[eastTee,[15.36,18.30,-.80],[14.40,19.26,-.83],[11.09,19.26,-.94],filter]);
  draw.chamber('leaf-filter',filter[0],filter[1],-1.16,.23);
  draw.route('filtered-inlet',[filter,[10.2,20.91,-1.01]]);
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
  const feedX=firstX+3*field.unit,fieldInZ=-1.18;
  draw.route('screened-overflow',[[x,y+d/2,overflowZ],[x,y+d/2+.40,-1.12],[feedX,y+d/2+.66,-1.14],[feedX,nearY,fieldInZ]]);
  for(let col=0;col<field.columns;col++)for(let row=0;row<field.rows;row++){
    const cx=firstX+col*field.unit,cy=nearY+(row+.5)*field.unit,cz=fieldInZ;
    const size=field.unit-.014;
    draw.box('crate-'+col+'-'+row,[size,size,field.height],[cx,cy,cz],'body',.66,1);
    for(const offset of [-.24,0,.24]){
      draw.box('crate-rib',[.022,size,.035],[cx+offset,cy,cz+field.height/2],'grid',1,3);
      draw.box('crate-rib',[size,.022,.035],[cx,cy+offset,cz+field.height/2],'grid',1,3);
    }
  }
  draw.chamber('field-inspection',feedX,nearY+(field.rows-.5)*field.unit,fieldInZ,.11);
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
  rainRoof193(THREE,draw,eave,ridge);rainCollectors193(draw);rainStorage193(THREE,draw);
  return group;
}
