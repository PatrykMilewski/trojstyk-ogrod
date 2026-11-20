const shrubProfiles = [
  {name:'spirea', tint:'#a4b873', height:.63, width:.68, lean:.84, tips:4},
  {name:'snowberry', tint:'#8ead87', height:1.23, width:.82, lean:.68, tips:3},
  {name:'dogwood', tint:'#839f68', height:1.64, width:1.03, lean:.53, tips:4},
  {name:'ninebark', tint:'#a08373', height:1.52, width:.94, lean:.64, tips:3},
  {name:'potted-holly', tint:'#79945e', lean:.90, tips:7, stems:48, crownDrop:.26},
];

// The shared alpha cutout preserves gaps between the leaves even at walking distance.
function shrubSprigTexture(THREE,random) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  function twig(x,y,ex,ey,width) {
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(ex,ey);
    ctx.strokeStyle='#95896b'; ctx.lineWidth=width; ctx.stroke();
  }
  function leaf(x,y,angle,length,width) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.bezierCurveTo(length*.28,-width*1.18,length*.72,-width,length,0);
    ctx.bezierCurveTo(length*.63,width*.94,length*.26,width,0,0);
    ctx.fillStyle=['#b4c68d','#c9d8a2','#a4bc84','#bfd7a7','#d0d8aa'][Math.floor(random()*5)];
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(length*.85,0);
    ctx.strokeStyle='rgba(104,122,76,.36)'; ctx.lineWidth=.95; ctx.stroke();
    ctx.restore();
  }
  twig(128,254,117,18,2.8);
  for(let level=0;level<7;level++) {
    const originY=237-level*29, originX=127-level*1.45;
    for(const side of [-1,1]) {
      const reach=(43+31*Math.sin((level+1)*Math.PI/9))*(.87+random()*.18);
      const dx=side*reach, dy=-39-random()*13;
      twig(originX,originY,originX+dx,originY+dy,1.8);
      const angle=Math.atan2(dy,dx);
      for(let j=0;j<6;j++) {
        const t=(j+1)/7;
        leaf(originX+dx*t,originY+dy*t,angle+(j%2?1:-1)*(.64+random()*.26),
          25+random()*15,6+random()*4);
      }
      leaf(originX+dx,originY+dy,angle,18+random()*9,6);
    }
  }
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,6,6);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  return map;
}

function shrubSpecimen(THREE,profile,random) {
  const positions=[],uv=[],colors=[],indices=[];
  const goldenAngle=2.399963, tint=new THREE.Color();
  function stemSegment(a,b,r) {
    const start=positions.length/3;
    for(const [point,radius] of [[a,r],[b,r*.71]]) for(let j=0;j<3;j++) {
      const yaw=j*2*Math.PI/3;
      positions.push(point[0]+radius*Math.cos(yaw),point[1]+radius*Math.sin(yaw),point[2]);
      uv.push(.009,.991); colors.push(.32,.23,.15);
    }
    for(let j=0;j<3;j++) {
      const next=(j+1)%3;
      indices.push(start+j,start+next,start+3+j,start+next,start+3+next,start+3+j);
    }
  }
  const stems=profile.stems??13;
  for(let stem=0;stem<stems;stem++) {
    const radial=Math.sqrt((stem+.25)/stems);
    const angle=stem*goldenAngle+random()*.26;
    const height=.94-(profile.crownDrop??.54)*radial**1.7+.11*random();
    const endRadius=radial*.92*profile.lean;
    stemSegment([0,0,0],[Math.cos(angle)*endRadius,Math.sin(angle)*endRadius,.92*height*.82],.009);
    for(let j=0;j<profile.tips;j++) {
      const a=angle+(j%2?1:-1)*(.13+.34*random());
      const t=.26+.66*j/(profile.tips-1);
      const length=.29+.14*random(), width=.17+.13*random();
      const x=Math.cos(angle)*radial*t*profile.lean, y=Math.sin(angle)*radial*t*profile.lean;
      const z=t*height*.82, pitch=.36+(1-radial)*.75+random()*.25;
      const twist=(random()-.5)*.55, start=positions.length/3;
      tint.setRGB(.70+.23*t,.71+.22*t,.65+.25*t).multiplyScalar(.90+.14*random());
      for(const f of [0,.55,1]) {
        const extension=length*f*Math.cos(pitch-f*.34), elevation=length*f*Math.sin(pitch-f*.34);
        for(const edge of [-1,1]) {
          const spread=width*(.56+.44*Math.sin(Math.PI*f))*.5*edge;
          positions.push(x+Math.cos(a)*extension-Math.sin(a)*spread,
            y+Math.sin(a)*extension+Math.cos(a)*spread,z+elevation+twist*spread);
          uv.push((edge+1)/2,f); colors.push(tint.r,tint.g,tint.b);
        }
      }
      indices.push(start,start+1,start+3,start,start+3,start+2,start+2,start+3,start+5,start+2,start+5,start+4);
    }
  }
  let radius=0,top=0;
  for(let i=0;i<positions.length;i+=3) {
    radius=Math.max(radius,Math.hypot(positions[i],positions[i+1]));
    top=Math.max(top,positions[i+2]);
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,size] of [['position',positions,3],['uv',uv,2],['color',colors,3]])
    geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  geometry.setIndex(indices);
  geometry.scale(1/radius,1/radius,1/top);
  geometry.computeVertexNormals();
  return geometry;
}

function sampleWoodyBed(bed,random,surfaceClearance,serviceAccess,borderShrubs,plant) {
  const {ring}=bed;
  const xs=ring.map(p=>p[0]), ys=ring.map(p=>p[1]);
  const x0=Math.min(...xs), y0=Math.min(...ys), x1=Math.max(...xs), y1=Math.max(...ys);
  const spacing=1.23;
  let count=0;
  for(let row=0;y0+row*spacing*.87<y1;row++) {
    for(let col=-1;x0+col*spacing<x1;col++) {
      const x=x0+(col+.28+(row%2)*.5+(random()-.5)*.49)*spacing;
      const y=y0+(row+.30+(random()-.5)*.47)*spacing*.87;
      let gap=surfaceClearance(x,y,bed);
      for(const area of serviceAccess)gap=Math.min(gap,-surfaceClearance(x,y,area));
      for(const p of borderShrubs)gap=Math.min(gap,Math.hypot(x-p.x,y-p.y)-p.radius-.03);
      if(gap<.23) continue;
      plant(x,y,gap); count++;
    }
  }
  return count;
}

function plantInspectionBorders(beds,serviceAccess,surfaceClearance,placements) {
  const planted=placements.flat();
  const borders=[];
  for(const vent of serviceAccess.filter(area=>['vent-1','vent-2','distributor','tank'].includes(area.id))){
    const center=vent.ring.reduce(([x,y],[vx,vy])=>[x+vx/vent.ring.length,y+vy/vent.ring.length],[0,0]);
    const neighbors=planted.filter(p=>Math.hypot(p.x-center[0],p.y-center[1])<3);
    const tank=vent.id==='tank', distributor=vent.id==='distributor';
    const distances=tank?[3.18,3.02,3.37,3.57]:distributor?[1.12,1.23,1.34]:[.78,.87,.97];
    const maximumGap=tank?3.0:distributor?1.0:.63;
    for(const distance of distances)for(let step=0;step<36;step++){
      const angle=step*Math.PI/18,x=center[0]+distance*Math.cos(angle),y=center[1]+distance*Math.sin(angle);
      let radius=Math.min(tank?.68:.40,Math.max(...beds.map(bed=>surfaceClearance(x,y,bed)))-.03);
      for(const area of serviceAccess)radius=Math.min(radius,-surfaceClearance(x,y,area)-.03);
      for(const p of neighbors)radius=Math.min(radius,Math.hypot(x-p.x,y-p.y)-p.radius-.06);
      if(radius<Math.max(.23,distance-maximumGap))continue;
      const height=tank?.85+.33*Math.cos(angle*3)**2:.42;
      const shrub={x,y,radius,height,angle,tone:.93};
      placements[0].push(shrub);neighbors.push(shrub);planted.push(shrub);
      borders.push(shrub);
    }
  }
  return borders;
}

function addLidPlanters(THREE,group,plants,planters) {
  if(!planters.length)return;
  const potHeight=.34,exposedRim=.33,mulchTop=.084;
  const pot=new THREE.CylinderGeometry(.174,.145,potHeight,16);
  pot.rotateX(Math.PI/2);
  const containers=new THREE.InstancedMesh(pot,new THREE.MeshStandardMaterial({color:'#544c3e',roughness:.98}),planters.length);
  containers.name='biodisc-portable-pots';
  const matrix=new THREE.Matrix4();
  for(const [i,{center:[x,y],radius,height}] of planters.entries()) {
    const width=Math.min(1,radius/.32);
    matrix.makeScale(width,width,1).setPosition(x,y,mulchTop+exposedRim-potHeight/2);
    containers.setMatrixAt(i,matrix);
    plants.push({x,y,radius,height:height-exposedRim,z:mulchTop+exposedRim,angle:i*2.4,tone:.92+.06*Math.sin(i)});
  }
  containers.castShadow=containers.receiveShadow=true;
  group.add(containers);
}

export function createWoodyBeds(THREE,parcels,{surfaceClearance,woodyRandom,serviceAccess=[]}) {
  const group=new THREE.Group(), profiles=shrubProfiles, placements=profiles.map(()=>[]);
  const plantingAccess=serviceAccess.map(area=>area.plantingRing?{...area,ring:area.plantingRing}:area);
  group.name='woody-beds';
  const shapes=[],stats={},base=.068;
  for(const {id,beds,trees,lidPlanters=[]} of parcels) {
    const random=woodyRandom(937+Number(id)), phase=random()*Math.PI*2;
    const borderShrubs=id==='193'?plantInspectionBorders(beds,plantingAccess,surfaceClearance,placements):[];
    addLidPlanters(THREE,group,placements[4],lidPlanters);
    let shrubs=borderShrubs.length+lidPlanters.length;
    for(const bed of beds) {
      const path=ring=>ring.map(([x,y])=>new THREE.Vector2(x,y));
      const shape=new THREE.Shape(path(bed.ring));
      shape.holes=(bed.holes||[]).map(h=>new THREE.Path(path(h)));
      shapes.push(shape);
      shrubs+=sampleWoodyBed(bed,random,surfaceClearance,id==='193'?plantingAccess:[],borderShrubs,(x,y,gap)=>{
        const drift=Math.sin(x*.44+phase)+.65*Math.sin(y*.62-phase)+.43*Math.sin((x+y)*.53);
        const interior=Math.min(1,gap/1.2), scale=.82+.30*random();
        const species=gap<.66?0:drift<-.98?3:drift<.08?1:drift<.61?0:2;
        const profile=profiles[species], radius=Math.min(gap-.03,profile.width*scale);
        const height=profile.height*scale*(.53+.47*interior);
        placements[species].push({x,y,radius,height,angle:random()*Math.PI*2,tone:.83+random()*.31});
      });
    }
    stats[id]={beds:beds.length,shrubs,trees:trees.length};
  }
  group.userData.parcels=stats;
  if(!shapes.length) return group;
  const soil=new THREE.Mesh(new THREE.ShapeGeometry(shapes),new THREE.MeshStandardMaterial({color:'#6f7758',roughness:.99}));
  soil.name='surface-planting'; soil.position.z=base; soil.receiveShadow=true; group.add(soil);
  const leafMaterial=new THREE.MeshLambertMaterial({map:shrubSprigTexture(THREE,woodyRandom(68428)),vertexColors:true,
    side:THREE.DoubleSide,alphaTest:.30});
  const transform=new THREE.Object3D(), color=new THREE.Color();
  for(const [i,plants] of placements.entries()) {
    if(!plants.length) continue;
    const profile=profiles[i], geometry=shrubSpecimen(THREE,profile,woodyRandom(37922+i));
    const foliage=new THREE.InstancedMesh(geometry,leafMaterial,plants.length);
    foliage.name='woody-shrub-'+profile.name;
    plants.forEach(({x,y,radius,height,angle,tone,z=base},index)=>{
      transform.position.set(x,y,z); transform.rotation.z=angle;
      transform.scale.set(radius,radius,height); transform.updateMatrix();
      foliage.setMatrixAt(index,transform.matrix);
      foliage.setColorAt(index,color.set(profile.tint).multiplyScalar(tone));
    });
    foliage.computeBoundingSphere(); foliage.castShadow=foliage.receiveShadow=true; group.add(foliage);
  }
  return group;
}
