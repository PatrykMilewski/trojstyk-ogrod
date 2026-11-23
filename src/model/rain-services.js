// Coordinates follow the mirrored Icon floor plan; the installation inherits its site transform.
const rainOutlets193 = [
  [.075,.36], [.075,16.84], [14.19,4.285], [8.68,12.635]
];
const rainTank193 = {center:[16.70,16.70], outside:[1.50,3.50], wall:.08, usableM3:6};
const [rainTankX193,rainTankY193]=rainTank193.center;
const rainFilter193=[16.20,14.10],fieldInspection193=[16.90,22.10];
const [fieldX193,fieldY193]=fieldInspection193;
const fieldVent193=[fieldX193+.50,fieldY193],hoseTap193=[15.82,17.95];
// Survey-plan cross sections: garden edges, gravelly planted floor, and the saddle between the two bowls.
const rainGardenSections193=[
  [-.5,-6.31,-6.05,.069],[-.12,-6.73,-5.8,-.12],[.45,-7.05,-5.98,-.23],[1.25,-7.17,-6.23,-.19],
  [2.02,-7.17,-6.34,-.045],[2.85,-7.18,-6.15,-.30],[3.55,-7.18,-5.86,-.34],[4.2,-7.17,-5.38,-.36],
  [4.85,-7.14,-5.05,-.36],[6.1,-7.10,-5.03,-.36],[7.5,-7.05,-5.03,-.36],[8.4,-6.99,-5.12,-.34],
  [8.7,-6.90,-5.55,-.26],[9.08,-7.0,-6.50,.055]];
const rainSpillSections193=[rainGardenSections193.at(-1),[9.85,-7.13,-6.82,.051],
  [11.78,-6.93,-6.57,.041],[12.74,-6.35,-5.95,.036],[13.48,-6.10,-5.35,.032]];
const rainGarden193={rim:.069,crest:-.045,designLevel:.020,floor:-.36,soilDepth:.32,
  ring:[...rainGardenSections193.map(([y,l])=>[l,y]),...rainGardenSections193.slice().reverse().map(([y,,r])=>[r,y])]};
const rainGardenShrubs193=[[-6.67,.61,.30],[-6.62,2.74,.34],[-6.65,3.73,.41],[-6.66,4.98,.44],
  [-5.89,6.04,.47],[-6.54,6.75,.45],[-5.69,7.51,.44],[-6.54,8.25,.34]];
// GRAF 402000 end plate. Heights are pipe axes above the base at its outside face.
const fieldPorts193={feedRadius:.080,feedHeight:.140,ventRadius:.055,ventHeight:.565,insertion:.20};
const rainField193 = {unit:.80, height:.66, unitNetM3:.405,
  strips:[
    {x:8.4,y:22.2,columns:4,rows:2,feed:[fieldInspection193,[15.15,22.10],[12.351,22.85],[11.4,22.85]],
      vent:[fieldInspection193,[14.60,22.10],[12.734,22.60],[11.4,22.60]]},
    {x:8.4,y:26.0,columns:4,rows:2,feed:[fieldInspection193,[12.35,26.65],[11.4,26.65]],
      vent:[fieldInspection193,[12.60,26.40],[11.4,26.40]]}
  ]};

const rainGutter193 = {outletDepth:.125, slope:.003, socketDrop:.12};
const rainDownpipe193 = {width:.070, depth:.080};
const rainIntake193 = [[.072,.36],[.072,16.84],[14.19,4.282],[8.68,12.638]];
const rainInward193 = [[1,0],[1,0],[0,1],[0,-1]];
const rainCovers193 = [
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
function rainBedTriangles193(sections=rainGardenSections193) {
  const rows=sections.map(([y,l,r,z])=>
    [[l,y,rainGarden193.rim],[l+.26*(r-l),y,z],[r-.26*(r-l),y,z],[r,y,rainGarden193.rim]]);
  return rows.slice(1).flatMap((b,k)=>b.slice(1).flatMap((_,j)=>{
    const a=rows[k];return [[a[j],a[j+1],b[j+1]],[a[j],b[j+1],b[j]]];
  }));
}

function rainBedStorage193(triangles,level){
  let volume=0;
  for(const tri of triangles){
    const wet=[];
    tri.forEach((p,i)=>{
      const q=tri[(i+1)%3];
      if(p[2]<=level)wet.push(p);
      if((p[2]<level)!==(q[2]<level)){
        const t=(level-p[2])/(q[2]-p[2]);wet.push(p.map((v,j)=>v+t*(q[j]-v)));
      }
    });
    for(let j=1;j<wet.length-1;j++){
      const t=[wet[0],wet[j],wet[j+1]];
      volume+=rainArea193(t)*t.reduce((sum,p)=>sum+(level-p[2])/3,0);
    }
  }
  return volume;
}

function rainBedZ193(x,y){
  for(const [p,q,r] of rainBedTriangles193()){
    const ax=q[0]-p[0],ay=q[1]-p[1],bx=r[0]-p[0],by=r[1]-p[1],det=ax*by-ay*bx;
    const u=((x-p[0])*by-(y-p[1])*bx)/det,v=(ax*(y-p[1])-ay*(x-p[0]))/det;
    if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)return p[2]+u*(q[2]-p[2])+v*(r[2]-p[2]);
  }
  return rainGarden193.rim;
}

function rainArea193(ring) {
  return Math.abs(ring.reduce((sum,[x,y],i)=>{
    const [nx,ny]=ring[(i+1)%ring.length];return sum+x*ny-y*nx;
  },0))/2;
}

// All pipe ordinates are axes in metres relative to the concept's design datum.
export function rainHydraulics193() {
  const [swFront,swRear,seFront,seRear]=rainOutlets193;
  const west=[rainGrade193([swFront,[-.22,.36],[-.22,4.12],[-1.22,5.12],[-5.69,5.12]],-.145,.010),
    rainGrade193([swRear,[-.65,16.84],[-.65,8.92],[-1.73,7.84],[-5.72,7.84]],-.150,.008)];
  const tee=[16.20,13.40],eastRoutes=[
    [seFront,[14.19,3.36],[15.22,3.36],[16.20,4.34],tee],
    [seRear,[9.04,12.995],[15.795,12.995],tee]];
  const lengths=eastRoutes.map(rainLength193),fall=Math.max(...lengths)*.012;
  const east=eastRoutes.map((points,i)=>rainGrade193(points,-.47,fall/lengths[i]));
  const [a,b]=east[1].slice(1,3),joinX=15.37;
  const joinZ=a[2]+(b[2]-a[2])*(joinX-a[0])/(b[0]-a[0]);
  const pergola=rainGrade193([[joinX,a[1]],[14.605,a[1]+joinX-14.605],[14.605,16.645]],joinZ,-.018).reverse();
  pergola.unshift([14.605,16.645,-.20]);
  const eastTrunk=rainGrade193([tee,rainFilter193],east[0].at(-1)[2],.012);
  const eastIn=eastTrunk.at(-1),eastOut=[...rainFilter193,eastIn[2]-.08];
  const tankInlet=rainGrade193([rainFilter193,[rainFilter193[0],rainTankY193-1.75]],eastOut[2],.012);
  const overflowZ=tankInlet.at(-1)[2]-.12;
  const overflow=rainGrade193([[rainTankX193,rainTankY193+1.75],fieldInspection193],overflowZ,.015);
  const level=overflow.at(-1)[2]-.67;
  const feeds=rainField193.strips.map(strip=>rainGrade193(strip.feed,level,.012));
  const {outside:[w,d],wall,usableM3}=rainTank193,waterLevel=overflowZ-.065;
  const tank={...rainTank193,top:-.55,waterLevel,bottom:waterLevel-usableM3/((w-2*wall)*(d-2*wall))-wall};
  const fields=rainField193.strips.map(({x,y,columns,rows},i)=>({x,y,width:columns*rainField193.unit,
    depth:rows*rainField193.unit,height:rainField193.height,
    base:feeds[i].at(-1)[2]+fieldPorts193.insertion*.012-fieldPorts193.feedHeight}));
  const ventStart=level+fieldPorts193.ventHeight-fieldPorts193.feedHeight;
  const vents=rainField193.strips.map(({vent},i)=>{
    const slope=(ventStart-fields[i].base-fieldPorts193.ventHeight)/(rainLength193(vent)-fieldPorts193.insertion);
    return rainGrade193(vent,ventStart,slope);
  });
  const triangles=rainBedTriangles193(),footprintM2=rainArea193(rainGarden193.ring);
  const spillAreaM2=rainSpillSections193.slice(1).reduce((total,[y,l,r],i)=>{
    const [py,pl,pr]=rainSpillSections193[i];return total+(y-py)*(r-l+pr-pl)/2;
  },0);
  const garden={...rainGarden193,footprintM2,spillAreaM2,triangles,spillSections:rainSpillSections193,
    floorArea:footprintM2*.48,pondDepth:rainGarden193.designLevel-rainGarden193.floor,
    storageM3:.90*rainBedStorage193(triangles,rainGarden193.designLevel),
    storageToSaddleM3:.90*rainBedStorage193(triangles.filter(t=>t.every(p=>p[1]>=2.02)),rainGarden193.crest)};
  return {west,garden,east,pergola,eastTrunk,eastIn,eastOut,
    tankInlet,tank,overflow,feeds,vents,fields,fieldPorts:fieldPorts193};
}

function rainPlanRing193(house,project,[left,bottom,right,top]) {
  return [[left,bottom],[right,bottom],[right,top],[left,top]].map(([x,y])=>project(house.metadata,x,y,0).slice(0,2));
}

export function rainGardenFootprint193(house,project) {
  return {id:'rain-garden',ring:rainGarden193.ring.map(([x,y])=>project(house.metadata,x,y,0).slice(0,2))};
}
export function rainGardenSpillFootprint193(house,project){
  const ring=[...rainSpillSections193.map(([y,l])=>[l,y]),...rainSpillSections193.slice().reverse().map(([y,,r])=>[r,y])];
  return {id:'rain-garden-spill',ring:ring.map(([x,y])=>project(house.metadata,x,y,0).slice(0,2))};
}
function rainShrubOutline193(x,y,r,index){
  return Array.from({length:24},(_,i)=>{
    const a=i*Math.PI/12,reach=r*(.87+.08*Math.cos(3*a+index)+.05*Math.cos(7*a-index));
    return [x+reach*Math.cos(a),y+reach*Math.sin(a)];
  });
}
export function rainGardenCanopies193(house,project) {
  return rainGardenShrubs193.map(([x,y,r],i)=>({ring:rainShrubOutline193(x,y,r,i)
    .map(([px,py])=>project(house.metadata,px,py,0).slice(0,2))}));
}
export function rainFieldFootprints193(house,project) {
  return rainField193.strips.map(({x,y,columns,rows},i)=>({
    id:'rain-field-'+(i+2),
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
    [15.55,13.57,16.76,18.50],
    [fieldX193-.50,fieldY193-.57,fieldVent193[0]+.45,fieldY193+.53],
    [12.80,fieldY193-.40,fieldX193,fieldY193+.40]
  ];
  return [rainGardenFootprint193(house,project),rainGardenSpillFootprint193(house,project),...areas.map(bounds=>({ring:rainPlanRing193(house,project,bounds)})),
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
  function pipe(id,from,to,radius=.065,tone='pipe',openEnds=false) {
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),v=b.clone().sub(a);
    const item=mesh(id,new THREE.CylinderGeometry(radius,radius,v.length(),12,1,openEnds),a.lerp(b,.5).toArray(),tone);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());
    return item;
  }
  function route(id,points,radius,openEnds=false) {
    for(let i=1;i<points.length;i++)pipe(id+'-'+i,points[i-1],points[i],radius,'pipe',openEnds);
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

function rainRoof193(draw,eave,ridge,layout) {
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
    const foot=index<2?layout.west[index][0][2]:-.47;
    draw.box('downpipe-'+index,[rainDownpipe193.width,rainDownpipe193.depth,top-foot],[x,y,(top+foot)/2],'pipe');
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
  // Shallow pedestrian planting-strip crossings have a separate spanning cover on independent side bearings.
  for(const [i,branch] of layout.west.entries())for(let j=1;j<branch.length;j++){
    const a=branch[j-1],b=branch[j];
    const t=j===branch.length-1?(-4.89-a[0])/(b[0]-a[0]):1;
    const end=a.map((v,k)=>v+t*(b[k]-v)),dx=end[0]-a[0],dy=end[1]-a[1],dz=end[2]-a[2];
    const run=Math.hypot(dx,dy),cx=(a[0]+end[0])/2,cy=(a[1]+end[1])/2,cz=(a[2]+end[2])/2;
    for(const [part,width,height,offset,z] of [['cap',.34,.028,0,.09],['left-bearing',.045,.23,-.145,-.039],
      ['right-bearing',.045,.23,.145,-.039]]){
      const plate=draw.box('garden-protection-'+i+'-'+j+'-'+part,[Math.hypot(run,dz),width,height],
        [cx-offset*dy/run,cy+offset*dx/run,cz+z],'grid',.47,0);
      plate.rotation.order='ZYX';plate.rotation.z=Math.atan2(dy,dx);plate.rotation.y=-Math.atan2(dz,run);
    }
  }
  draw.route('pergola-collector',layout.pergola,.045,true);
  draw.route('ground-east-trunk',layout.eastTrunk);
  draw.route('filter-drop-leaf-filter',[layout.eastIn,layout.eastOut]);
  draw.chamber('leaf-filter',...rainFilter193,layout.eastOut[2]-.15,.23);
  draw.route('filtered-inlet',layout.tankInlet);


}

function rainIrrigation193(draw,layout,info) {
  const [x,y]=rainTank193.center,lid=[x+.4,y],base=layout.tank.bottom+.20;
  draw.pipe('irrigation-pump',[...lid,base],[...lid,base+.42],.085,'body');
  const terminal=[lid[0]+.057,y,base+.39];
  draw.box('irrigation-power-terminal',[.045,.052,.055],terminal,'lip');
  info.irrigationTerminal=terminal;
  info.irrigationCablePath=[[lid[0],y-1.97,-.38],[terminal[0],y-1.85,-.38],
    [terminal[0],y,-.38],terminal];
  const water=[[...lid,base+.42],[...lid,-.66],[x-.50,y,-.66],[x-.50,hoseTap193[1]-.26,-.66],
    [...hoseTap193,-.66],[...hoseTap193,.66],[hoseTap193[0]-.15,hoseTap193[1],.66],
    [hoseTap193[0]-.15,hoseTap193[1],.59]];
  for(let i=1;i<water.length;i++)draw.pipe('irrigation-supply-'+i,water[i-1],water[i],.016,'lip');
}

function rainStorage193(THREE,draw,layout) {
  const {center:[x,y],outside:[w,d],wall,waterLevel,bottom,top}=layout.tank;
  draw.box('tank-shell',[w,d,top-bottom],[x,y,(top+bottom)/2],'body',.38,0);
  draw.mesh('tank-water',new THREE.PlaneGeometry(w-2*wall,d-2*wall),[x,y,waterLevel],'water',.63,1);
  draw.chamber('tank-inspection',x+.40,y,top,.30);
  draw.route('screened-overflow',layout.overflow);
  draw.chamber('field-inspection',...fieldInspection193,layout.feeds[0][0][2]-.17,.30);
  rainField193.strips.forEach((strip,i)=>rainInfiltrationStrip193(THREE,draw,strip,i,layout));
  const z=layout.vents[0][0][2];
  draw.pipe('field-air-branch',[...fieldInspection193,z],[...fieldVent193,z],.055);
  draw.pipe('field-air-riser',[...fieldVent193,z],[...fieldVent193,.22],.055);
}

function rainFieldEndPlate193(THREE,draw,index,field){
  const {unit,height}=rainField193,half=unit/2,h=height/2;
  const shape=new THREE.Shape();
  shape.moveTo(-half,-h);shape.lineTo(-half,h);shape.lineTo(half,h);shape.lineTo(half,-h);shape.closePath();
  for(const [side,axis,radius] of [[half-.15,fieldPorts193.feedHeight,fieldPorts193.feedRadius],
    [0,fieldPorts193.ventHeight,fieldPorts193.ventRadius]]){
    const port=new THREE.Path();
    port.absarc(side,axis-h,radius+.001,0,2*Math.PI,false);
    shape.holes.push(port);
  }
  const geometry=new THREE.ShapeGeometry(shape,48).rotateX(Math.PI/2).rotateZ(Math.PI/2);
  draw.mesh('field-end-plate-'+index,geometry,[field.x+field.width,field.y+half,field.base+h],'body',.66,1);
}

function rainInfiltrationStrip193(THREE,draw,{x,y,columns,rows},index,layout) {
  const {unit,height}=rainField193,z=layout.fields[index].base+height/2;
  rainFieldEndPlate193(THREE,draw,index,layout.fields[index]);
  draw.route('field-feed-'+index,layout.feeds[index],fieldPorts193.feedRadius,true);
  draw.route('field-vent-return-'+index,layout.vents[index],fieldPorts193.ventRadius,true);
  for(let col=0;col<columns;col++)for(let row=0;row<rows;row++){
    const cx=x+(col+.5)*unit,cy=y+(row+.5)*unit;
    const crate=draw.box('crate-'+index+'-'+col+'-'+row,[unit,unit,height],[cx,cy,z],'body',.66,1);
    if(row===0){
      // The service lane is continuous across crate joints; only its far end is closed.
      const geometry=crate.geometry;
      geometry.setIndex(Array.from(geometry.index.array).slice(col===0?6:12));
      geometry.clearGroups();
    }
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
    const hatch=.20;
    openings.get(id).push([...slot,hatch-.094,hatch+.094]);
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
  const outlines=[[[15.70,13.70],[16.15,13.43],[16.68,13.64],[16.77,14.25],
    [17.54,15.65],[17.76,16.37],[17.75,17.15],[17.18,17.70],[16.43,18.26],
    [15.72,18.30],[15.70,17.65],[16.38,16.80],[16.09,15.38],[15.70,14.52]],
    [[-1.24,-.31],[-.65,-.35],[-.32,-.64],[.38,-.58],[.92,-.33],[.91,.31],[.51,.61],
    [-.17,.64],[-.65,.39],[-1.24,.38],[-1.24,.08]].map(([dx,dy])=>[fieldX193+dx,fieldY193+dy])];
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

function rainDogwoodGeometry193(THREE,x,y,z,r,index){
  const positions=[],colors=[],outline=rainShrubOutline193(x,y,r,index);
  const tints=['#63844d','#81965a','#92a561','#769053','#506f46'].map(c=>new THREE.Color(c));
  const bark=new THREE.Color('#7d5849');
  function face(a,b,c,tone){
    positions.push(...a,...b,...c);for(let j=0;j<3;j++)colors.push(tone.r,tone.g,tone.b);
  }
  function leaf(base,tip,width,tone){
    const dx=tip[0]-base[0],dy=tip[1]-base[1],run=Math.hypot(dx,dy)||1;
    const mid=base.map((v,j)=>(v+tip[j])*.5),rib=[mid[0],mid[1],mid[2]+width*.24];
    const left=[mid[0]-dy/run*width,mid[1]+dx/run*width,mid[2]],right=[2*mid[0]-left[0],2*mid[1]-left[1],mid[2]];
    face(base,left,rib,tone);face(left,tip,rib,tone);face(base,rib,right,tone);face(rib,tip,right,tone);
  }
  for(let k=0;k<42;k++){
    const j=k%24,[ox,oy]=outline[j],dx=ox-x,dy=oy-y;
    const scale=k<24?1:.25+.4*(k%5)/5,angle=Math.atan2(dy,dx);
    const height=r*(k<24?.60+.35*Math.sin(k*2.4+index):1.0+.33*Math.sin(k));
    const point=t=>[x+dx*scale*t**1.30,y+dy*scale*t**1.30,z+height*Math.sin(t*1.65)+.10*r*t];
    let last=point(0);
    for(let n=1;n<=11;n++){
      const t=n/12,base=point(t);
      face([last[0]-.004,last[1],last[2]],[last[0]+.004,last[1],last[2]],base,bark);
      if(n>2)for(const side of [-1,1]){
        const yaw=angle+side*(.87+.18*Math.sin(k+n)),length=r*(.12+.055*Math.sin(n+k)**2)*(1-.34*t);
        leaf(base,[base[0]+length*Math.cos(yaw),base[1]+length*Math.sin(yaw),base[2]+length*(.48-.19*t)],
          length*.26,tints[(j+n+(side+1))%tints.length]);
      }
      last=base;
    }
    const tip=point(1);leaf(last,tip,r*.028,tints[j%tints.length]);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}

function rainGardenSurface193(THREE,group,plantingMaterial) {
  const layout=rainHydraulics193(),g=layout.garden;
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.91,side:THREE.DoubleSide});
  const timber=material(0x85674b),soil=material(0x605244),gravel=material(0x9e9382);
  const copper=material(0x5b6466),brass=material(0x9e8461);
  function add(id,geometry,mat,at=[0,0,0]){
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.name='rain-'+id;mesh.position.set(...at);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    return mesh;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(rainBedTriangles193().flat(2),3));
  function finishBed(id,geometry){
    const pos=geometry.getAttribute('position'),world=new THREE.Vector3(),uv=[];
    for(let i=0;i<pos.count;i++){
      world.fromBufferAttribute(pos,i).applyMatrix4(group.matrix);uv.push(world.x/1.30,world.y/1.30);
    }
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.computeVertexNormals();add(id,geometry,plantingMaterial??soil);
  }
  finishBed('garden-planted-slopes',geo);
  const spillGeo=new THREE.BufferGeometry();
  spillGeo.setAttribute('position',new THREE.Float32BufferAttribute(rainBedTriangles193(rainSpillSections193).flat(2),3));
  finishBed('garden-grass-overflow-swale',spillGeo);
  const plants=[],blades=[];
  for(let i=0;i<30;i++){
    const row=rainGardenSections193[1+i%12],y=row[0]+.04*Math.sin(i),t=.25+.5*((i*7)%17)/16;
    const x=row[1]+t*(row[2]-row[1]),z=rainBedZ193(x,y);
    if(rainGardenShrubs193.some(([sx,sy,r])=>Math.hypot(x-sx,y-sy)<r*.72))continue;
    plants.push([x,y]);
    for(let k=0;k<21;k++){
      const a=2.39996*k+i,dx=Math.cos(a),dy=Math.sin(a),reach=.09+.13*(k%6)/5,h=.19+.23*((k*7+i)%13)/12;
      blades.push(x-dy*.012,y+dx*.012,z,x+dy*.012,y-dx*.012,z,x+dx*reach,y+dy*reach,z+h);
    }
  }
  for(let i=1;i<rainSpillSections193.length;i++){
    const a=rainSpillSections193[i-1],b=rainSpillSections193[i],count=Math.ceil((b[0]-a[0])*16);
    for(let j=0;j<count;j++){
      const t=(j+.5)/count,[y,l,r,floor]=a.map((v,k)=>v+t*(b[k]-v)),across=.27+.46*((11*j+7*i)%17)/16;
      const x=l+across*(r-l);
      for(let k=0;k<13;k++){
        const angle=k*2.4+j,dx=Math.cos(angle),dy=Math.sin(angle),lean=.045+.04*(k%5)/4;
        blades.push(x-dy*.006,y+dx*.006,floor,x+dy*.006,y-dx*.006,floor,x+dx*lean,y+dy*lean,floor+.07+.036*(k%3));
      }
    }
  }
  const bladeGeo=new THREE.BufferGeometry();
  bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));bladeGeo.computeVertexNormals();
  add('garden-sedges',bladeGeo,material(0x667c45)).userData.clumps=plants;
  const foliage=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  function pipe(id,from,to,r,mat,openEnds=false){
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),v=b.clone().sub(a);
    const mesh=add(id,new THREE.CylinderGeometry(r,r,v.length(),12,1,openEnds),mat,a.lerp(b,.5).toArray());
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return mesh;
  }
  for(const [i,[x,y,r]] of rainGardenShrubs193.entries())
    add('garden-dogwood-crown-'+i,rainDogwoodGeometry193(THREE,x,y,rainBedZ193(x,y),r,i),foliage);
  const stone=new THREE.DodecahedronGeometry(.075);
  for(const [i,route] of layout.west.entries()){
    const outlet=route.at(-1);
    pipe('garden-inlet-mouth-'+i,[outlet[0]+.33,outlet[1],outlet[2]+.33*(i?.008:.010)],outlet,.065,copper,true);
    for(let j=0;j<18;j++){
      const a=j*2.4,r=.053*Math.sqrt(j),x=outlet[0]-.12+r*Math.cos(a),y=outlet[1]+r*Math.sin(a);
      const p=add('garden-inlet-cobble-'+i+'-'+j,stone,gravel,[x,y,rainBedZ193(x,y)+.02]);
      p.scale.set(1.1,.78,.58);p.rotation.z=a;
    }
  }
  const [hx,hy]=hoseTap193;
  add('irrigation-tap-post',new THREE.BoxGeometry(.075,.075,.72),timber,[hx+.04,hy,.36]);
  pipe('irrigation-tap-riser',[hx,hy,.02],[hx,hy,.66],.016,brass);
  pipe('irrigation-tap-body',[hx,hy,.66],[hx-.15,hy,.66],.024,brass);
  pipe('irrigation-hose-connector',[hx-.15,hy,.66],[hx-.15,hy,.59],.017,brass);
  pipe('irrigation-tap-handle',[hx-.081,hy-.056,.705],[hx-.081,hy+.056,.705],.012,copper);
  pipe('irrigation-tap-spindle',[hx-.081,hy,.675],[hx-.081,hy,.705],.009,brass);
}

function rainSurfaceCovers(THREE,group) {
  const frame=new THREE.MeshStandardMaterial({color:0x3e4741,roughness:.86});
  const lid=new THREE.MeshStandardMaterial({color:0x59605a,roughness:.88});
  for(const [id,[vx,vy]] of [['field',fieldVent193]]){
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
  rainGardenSurface193(THREE,group,plantingMaterial);
  return group;
}

export function createRainServices(THREE,house,interior,data) {
  const group=new THREE.Group();
  group.name='services-rain-193';
  group.matrixAutoUpdate=false;group.matrix.copy(interior.group.matrix);
  const footprint=data.exterior.upper;
  const area=rainArea193(footprint),layout=rainHydraulics193();
  const fieldNetM3=rainField193.strips.reduce((sum,s)=>sum+s.columns*s.rows*rainField193.unitNetM3,0);
  const lowVentInvert=Math.min(...layout.vents.map(vent=>vent.at(-1)[2]))-fieldPorts193.ventRadius;
  const headspace=layout.fields.reduce((sum,f)=>sum+f.width*f.depth*(f.base+f.height-lowVentInvert),0);
  const inserted=layout.fields.length*Math.PI*(fieldPorts193.feedRadius**2+fieldPorts193.ventRadius**2)*fieldPorts193.insertion;
  const fieldVentedM3=fieldNetM3-headspace-inserted;
  const swArea=4.25*18.13,pergolaArea=6.30*4.38;
  // Size for the full frame footprint with the canopy deployed and all rainfall collected.
  const pergolaStorm=pergolaArea*.03;
  group.userData={kind:'rain-services',parcel:'193',projectedRoofM2:area,assumedStormMm:30,
    runoffCoefficient:.90,pergolaEnvelopeM2:pergolaArea,pergolaStormM3:pergolaStorm,stormVolumeM3:area*.027+pergolaStorm,tankUsableM3:rainTank193.usableM3,fieldNetM3,fieldVentedM3,
    circuits:{sw:{areaM2:swArea,stormM3:swArea*.027,directRainM3:(layout.garden.footprintM2+layout.garden.spillAreaM2)*.030,gardenM3:layout.garden.storageM3},
      se:{roofAreaM2:area-swArea,areaM2:area-swArea+pergolaArea,stormM3:(area-swArea)*.027+pergolaStorm}}};
  const draw=rainDrawing(THREE,group),{eave,ridge}=house.metadata.dimensions;
  rainRoof193(draw,eave,ridge,layout);rainCollectors193(draw,layout);rainStorage193(THREE,draw,layout);
  const rootSection=new THREE.BufferGeometry();
  rootSection.setAttribute('position',new THREE.Float32BufferAttribute(layout.garden.triangles.flat(2),3));
  rootSection.computeVertexNormals();
  draw.mesh('garden-permeable-filter-base',rootSection,[0,0,-layout.garden.soilDepth],'gutter',.52,0);
  rainIrrigation193(draw,layout,group.userData);
  return group;
}
