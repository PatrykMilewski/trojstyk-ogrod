import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import clipping from 'polygon-clipping';

const read=name=>readFile(new URL(name,import.meta.url),'utf8');
const load=src=>import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const html=await read('../trzy-domy-3d/index.html');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'","'"+imports['three/core']+"'"));
const marker='const [source,garden,house,neighbors]=';
const [source,garden,house,neighbors]=JSON.parse(html.slice(html.indexOf(marker)+marker.length,html.indexOf(';\nconst landscaping=')));
const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const wood=JSON.parse(await read('../trzy-domy-3d/woodland-plan.json')).parcels.find(p=>p.id==='193');
const {createRainServices,createRainSurface}=await load(await read('../src/model/rain-services.js'));
const {matrix:[[a,b],[c,d]],translation:[x,y]}=house.metadata;
const group=new THREE.Group();
group.matrix.set(-a,b,0,a*14.64+x,-c,d,0,c*14.64+y,0,0,1,0,0,0,0,1);
const rain=createRainServices(THREE,house,{group},data);
const surface=createRainSurface(THREE,house,{group},data);
rain.updateMatrixWorld(true);surface.updateMatrixWorld(true);
const named=prefix=>rain.children.filter(m=>m.name.startsWith('rain-'+prefix));
const close=(a,b,tol=1e-6)=>Math.abs(a-b)<tol;

test('catchment uses the projected roof triangles and covers a 30 mm event with the tank empty or full',()=>{
  let actual=0;
  for(const roof of house.meshes.filter(o=>o.kind==='roof'))for(const face of roof.faces){
    const [a,b,c]=face.map(i=>roof.vertices[i]);
    actual+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
  }
  const info=rain.userData;
  assert(close(info.projectedRoofM2,actual));
  assert(close(info.stormVolumeM3,actual*.03*.9));
  assert(info.tankUsableM3>=info.stormVolumeM3);
  assert(info.fieldNetM3>=info.stormVolumeM3);
  assert.equal(named('crate-').filter(m=>m.name!=='rain-crate-rib').length,15);
  assert.equal(named('downpipe-').length,4);
});

function pipeEnds(mesh) {
  return [-.5,.5].map(t=>new THREE.Vector3(0,t*mesh.geometry.parameters.height,0)
    .applyQuaternion(mesh.quaternion).add(mesh.position));
}

test('each actual low roof edge drops into an open folded metal gutter visible from above',()=>{
  const gutters=surface.children.filter(m=>m.name.startsWith('rain-gutter-'));
  assert.equal(gutters.length,8);
  assert.equal(named('gutter-').length,0);
  assert(gutters.every(m=>m.material.isMeshStandardMaterial&&m.material.depthTest&&m.material.color.getHex()===0x384143));
  const roofParts=house.meshes.filter(m=>m.kind==='roof');
  const roofs=roofParts.map(part=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices.flat(),3));geometry.setIndex(part.faces.flat());
    return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  });
  function firstHit(x,y){
    const origin=new THREE.Vector3(x,y,12).applyMatrix4(surface.matrixWorld);
    return new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1)).intersectObjects([...gutters,...roofs])[0];
  }
  const inverse=rain.matrixWorld.clone().invert();
  for(const part of roofParts)for(const face of part.faces){
    const eave=house.metadata.dimensions.eave, low=face.map(i=>part.vertices[i]).filter(p=>close(p[2],eave));
    if(low.length!==2)continue;
    const [a,b]=low.map(p=>new THREE.Vector3(...p).applyMatrix4(inverse));
    const nx=close(a.x,b.x)?(close(a.x,0)?-1:1):0,ny=nx?0:(close(a.y,4.21)?-1:1);
    for(const t of [.13,.35,.62,.87]){
      const p=a.clone().lerp(b,t);
      const sole=firstHit(p.x+nx*.06,p.y+ny*.06),hem=firstHit(p.x+nx*.129,p.y+ny*.129);
      assert(sole&&hem&&gutters.includes(sole.object)&&gutters.includes(hem.object),part.id);
      assert(sole.point.z<eave-.075&&hem.point.z-sole.point.z>.080,part.id);
    }
  }
  for(const offset of named('outlet-offset-')){
    const [intake]=pipeEnds(offset);
    assert(!firstHit(intake.x,intake.y),'open drain throat '+offset.name);
    const socket=surface.getObjectByName(offset.name.replace('outlet-offset','outlet-socket'));
    const origin=intake.clone().setZ(12).applyMatrix4(surface.matrixWorld);
    const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1)).intersectObject(socket)[0];
    assert(hit&&hit.point.z<intake.z-.015,'socket receives open throat '+offset.name);
  }
});

test('all four corner vertices of each socket meet the rectangular downpipe head',()=>{
  for(const pipe of named('downpipe-')){
    const socket=surface.getObjectByName(pipe.name.replace('downpipe','outlet-socket'));
    const vertices=socket.geometry.getAttribute('position');
    const {width,height,depth}=pipe.geometry.parameters;
    const corners=Array.from({length:vertices.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(vertices,i));
    for(const dx of [-width/2,width/2])for(const dy of [-height/2,height/2]){
      const corner=pipe.position.clone().add(new THREE.Vector3(dx,dy,depth/2));
      const matched=corners.some(p=>corner.distanceTo(p)<.000002);
      assert(matched,pipe.name+' corner '+dx+', '+dy);
    }
  }
});

test('concealed downpipes drain through continuously falling buried branches and an overflow into the field',()=>{
  assert(!surface.children.some(m=>m.name.includes('downpipe')));
  const tank=named('tank-shell')[0],{height:depth}=tank.geometry.parameters;
  const filter=pipeEnds(named('filtered-inlet')[0])[0];
  const branches=named('ground-').map(pipeEnds);
  const reachesFilter=start=>{
    let p=start;
    for(let i=0;i<=branches.length;i++){
      if(p.distanceTo(filter)<1e-6)return true;
      const next=branches.find(([a])=>a.distanceTo(p)<1e-6);
      if(!next)return false;
      p=next[1];
    }
    return false;
  };
  for(const mesh of [...named('ground-'),...named('filtered-inlet'),...named('screened-overflow')]){
    const [a,b]=pipeEnds(mesh);
    assert(a.z-b.z>=.01*Math.hypot(b.x-a.x,b.y-a.y),mesh.name);
  }
  const tankIn=pipeEnds(named('filtered-inlet')[0])[1],over=named('screened-overflow').map(pipeEnds);
  assert(close(tankIn.y,tank.position.y-depth/2)&&close(tankIn.x,tank.position.x));
  assert(close(over[0][0].y,tank.position.y+depth/2)&&close(over[0][0].x,tank.position.x));
  assert(close(over[0][0].z,named('tank-water')[0].position.z)&&tankIn.z>over[0][0].z);
  for(let i=1;i<over.length;i++)assert(over[i][0].distanceTo(over[i-1][1])<1e-6);
  const fieldIn=over.at(-1)[1];
  assert(named('crate-').filter(m=>m.name!=='rain-crate-rib').some(m=>
    Math.abs(m.position.x-fieldIn.x)<m.geometry.parameters.width/2&&Math.abs(m.position.y-fieldIn.y)<m.geometry.parameters.height/2&&close(m.position.z,fieldIn.z)));
  for(const mesh of named('downpipe-')){
    const foot=mesh.position.clone();foot.z-=mesh.geometry.parameters.depth/2;
    assert(reachesFilter(foot),mesh.name);
    const [intake,top]=pipeEnds(named('outlet-offset-'+mesh.name.split('-').at(-1))[0]);
    assert(close(mesh.position.z+mesh.geometry.parameters.depth/2,top.z)&&close(top.x,foot.x)&&close(top.y,foot.y));
    assert(named('flow-').map(pipeEnds).some(([a])=>a.distanceTo(intake)<1e-6));
  }
  assert.equal(named('valley-').length,2);
});

const world=([x,y])=>new THREE.Vector3(x,y,0).applyMatrix4(rain.matrixWorld).toArray().slice(0,2);
const lawn=garden.polygons.filter(p=>p.kind==='lawn').map(p=>[p.ring,...p.holes||[]]);
const lot=source.variants[0],outline=neighbors.parcels['193'].coordinates;
const obstacles=[...['house','terrace','driveway','entry'].map(key=>lot[key].coordinates),
  ...[...wood.beds,...garden.polygons.filter(p=>p.kind!=='lawn'),...garden.objects.filter(p=>p.ring)]
    .map(p=>[p.ring,...p.holes||[]])];

function boxPolygon(mesh,margin=0){
  const {width,height}=mesh.geometry.parameters,x=width/2+margin,y=height/2+margin;
  return [[[-x,-y],[x,-y],[x,y],[-x,y]].map(([dx,dy])=>world([mesh.position.x+dx,mesh.position.y+dy]))];
}
function pointEdgeDistance(point,a,b){
  const [dx,dy]=[b[0]-a[0],b[1]-a[1]];
  const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}
const edgeDistance=(p,ring)=>Math.min(...ring.map((a,i)=>pointEdgeDistance(p,a,ring[(i+1)%ring.length])));
const clearLawn=polygon=>{
  assert.equal(clipping.difference(polygon,...lawn).length,0,'private lawn');
  assert.equal(clipping.difference(polygon,outline).length,0,'lot boundary');
  for(const obstacle of obstacles)assert.equal(clipping.intersection(polygon,obstacle).length,0,'garden or building obstacle');
  for(const t of [...wood.trees,...garden.trees])assert(edgeDistance(t.center,polygon[0])>t.crownRadius);
};

test('tank at the side planting bed leaves the central lawn free and has a 90 cm service approach from the terrace',()=>{
  const tank=named('tank-shell')[0],polygon=boxPolygon(tank);
  assert(tank.position.x<0&&Math.hypot(tank.position.x-10.2,tank.position.y-22.35)>11);
  const nearestBed=Math.min(...wood.beds.flatMap(bed=>polygon[0].map(p=>edgeDistance(p,bed.ring))));
  assert(nearestBed>.50&&nearestBed<.65);
  assert(Math.min(...polygon[0].map(p=>edgeDistance(p,outline[0])))>5.7);
  clearLawn(boxPolygon(tank,.45));
  const access=[[.1,19.56],[1,19.56],[1,20.3],[-.15,22.8],[-1.05,22.8],[.1,20.1]];
  clearLawn([access.map(world)]);
  for(const crate of named('crate-').filter(m=>m.name!=='rain-crate-rib'))clearLawn(boxPolygon(crate));
});

test('all three covered openings align with buried chambers and remain visible in normal mode',()=>{
  const caps=surface.children.filter(m=>m.name.startsWith('rain-cover-')&&m.name!=='rain-cover-keyhole');
  assert(surface.visible&&caps.length===3);
  assert(!rain.children.some(m=>m.name.includes('-cover')||m.name.endsWith('-rim')));
  for(const cap of caps){
    const chamber=rain.getObjectByName(cap.name.replace('rain-cover-','rain-'));
    assert(chamber&&close(chamber.position.x,cap.position.x)&&close(chamber.position.y,cap.position.y));
    assert.equal(cap.material.depthTest,true);
    const radius=cap.geometry.parameters.radiusTop;
    const perimeter=Array.from({length:40},(_,i)=>world([cap.position.x+(radius+.025)*Math.cos(i*Math.PI/20),
      cap.position.y+(radius+.025)*Math.sin(i*Math.PI/20)]));
    clearLawn([perimeter]);
    const lawnHeight=Math.max(...garden.polygons.filter(p=>p.kind==='lawn').map(p=>p.z))+.01;
    const highestBlade=lawnHeight+.001+.043*1.14;
    assert(cap.position.z+cap.geometry.parameters.height/2>highestBlade);
  }
});
