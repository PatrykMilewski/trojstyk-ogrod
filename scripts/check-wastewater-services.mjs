import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import clipping from 'polygon-clipping';

const read=name=>readFile(new URL(name,import.meta.url),'utf8');
const load=src=>import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const html=await read('../trzy-domy-3d/index.html');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'","'"+imports['three/core']+"'"));
const {createWastewaterInstallation,createWastewaterSurface,wastewater193,wastewaterServiceAccess193}=await load(await read('../src/model/wastewater.js'));
const marker='const [source,garden,house,neighbors]=';
const [source,garden,house,neighbors]=JSON.parse(html.slice(html.indexOf(marker)+marker.length,html.indexOf(';\nconst landscaping=')));
const woods=JSON.parse(await read('../trzy-domy-3d/woodland-plan.json')).parcels.find(p=>p.id==='193');
const system=createWastewaterInstallation(THREE), surface=createWastewaterSurface(THREE);
system.updateMatrixWorld(true);surface.updateMatrixWorld(true);
const field=system.getObjectByName('wastewater-tunnel-field'), hard=source.variants[0];
const xy=v=>v.toArray().slice(0,2);
const close=(a,b)=>Math.abs(a-b)<1e-6;
function axisEnds(mesh) {
  return [-.5,.5].map(f=>mesh.localToWorld(new THREE.Vector3(0,f*mesh.geometry.parameters.height,0)));
}
function gradedPipes(meshes,slope){
  let previous;
  for(const mesh of meshes){
    const [a,b]=axisEnds(mesh);
    if(previous)assert(previous.distanceTo(a)<1e-6,mesh.name+' continuity');
    assert(close((a.z-b.z)/Math.hypot(b.x-a.x,b.y-a.y),slope),mesh.name+' grade');
    previous=b;
  }
  return previous;
}

test('the downhill clarified pipe reaches the distributor and equally feeds both end caps',()=>{
  const outlet=system.children.filter(m=>m.name.startsWith('clarified-outlet-'));
  assert(outlet.length>1);
  assert(close(axisEnds(outlet[0])[0].z-.055,wastewater193.outletInvert));
  const end=gradedPipes(outlet,.01);
  const chamber=field.getObjectByName('distribution-chamber'),axis=axisEnds(chamber);
  assert(close(end.x,axis[0].x)&&close(end.y,axis[0].y)&&end.z>axis[0].z&&end.z<axis[1].z);
  let firstInvert;
  for(const row of [0,1]){
    const branches=field.children.filter(m=>m.name.startsWith('distribution-branch-'+row+'-'));
    assert.equal(branches.length,2);
    const start=axisEnds(branches[0])[0];
    assert(close(start.x,end.x)&&close(start.y,end.y)&&start.z<end.z);
    const terminal=gradedPipes(branches,.02);
    if(row)assert(close(terminal.z,firstInvert));
    firstInvert=terminal.z;
    const cap=field.getObjectByName('drain-row-'+(row+1)+'-inlet-cap');
    const foot=cap.getWorldPosition(new THREE.Vector3());
    assert(close(terminal.x,foot.x)&&close(terminal.y,foot.y));
    assert(terminal.z-.055>foot.z&&terminal.z+.055<foot.z+wastewater193.moduleHeight);
  }
  assert(-wastewater193.fieldBase-wastewater193.moduleHeight<=1.20);
});

function clearance(point,ring){
  const p=new THREE.Vector3(...point,0),nearest=new THREE.Vector3();
  return Math.min(...ring.map((a,i)=>new THREE.Line3(new THREE.Vector3(...a,0),
    new THREE.Vector3(...ring[(i+1)%ring.length],0)).closestPointToPoint(p,true,nearest).distanceTo(p)));
}
function ringDistance(a,b) {
  return Math.min(...a.map(p=>clearance(p,b)),...b.map(p=>clearance(p,a)));
}
function worldFieldRing(){
  const bounds=new THREE.Box3();
  for(const mesh of field.children.filter(m=>m.name.endsWith('-cap')||m.name.includes('-tunnel-'))){
    mesh.geometry.computeBoundingBox();
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
  }
  return [[bounds.min.x,bounds.min.y],[bounds.max.x,bounds.min.y],
    [bounds.max.x,bounds.max.y],[bounds.min.x,bounds.max.y]].map(([x,y])=>xy(field.localToWorld(new THREE.Vector3(x,y,0))));
}

test('the tunnel footprint is entirely inside /193, away from structures, vehicles and tree trunks',()=>{
  const ring=worldFieldRing();
  assert.equal(clipping.difference([ring],neighbors.parcels['193'].coordinates).length,0);
  assert(ringDistance(ring,neighbors.parcels['193'].coordinates[0])>4.3);
  for(const [key,gap] of [['house',9.5],['terrace',8.1],['driveway',27.6],['entry',20]]){
    const polygon=hard[key].coordinates;
    assert.equal(clipping.intersection([ring],polygon).length,0,key);
    assert(ringDistance(ring,polygon[0])>gap,key);
  }
  for(const p of garden.polygons.filter(o=>['path','shared_boundary','gravel','paving'].includes(o.kind))){
    assert.equal(clipping.intersection([ring],[p.ring,...p.holes||[]]).length,0,p.id);
  }
  for(const tree of [...garden.trees,...woods.trees])assert(clearance(tree.center,ring)>3.1);
  assert.equal(field.children.filter(m=>/-tunnel-[1-5]$/.test(m.name)).length,10);
});

test('vent openings and the distributor align with the accessible surface fittings',()=>{
  const access=wastewaterServiceAccess193();
  const centre=m=>m.getWorldPosition(new THREE.Vector3());
  for(const [sub,cap] of [['drain-row-1-vent','tunnel-vent-0'],['drain-row-2-vent','tunnel-vent-1'],
    ['distribution-chamber','distributor-hatch']]){
    const a=centre(field.getObjectByName(sub)), b=centre(surface.getObjectByName(cap));
    assert(close(a.x,b.x)&&close(a.y,b.y));
    const pad=Array.from({length:24},(_,i)=>[a.x+.50*Math.cos(i*Math.PI/12),a.y+.50*Math.sin(i*Math.PI/12)]);
    assert.equal(clipping.difference([pad],...access.map(g=>[g.ring])).length,0);
    if(cap.startsWith('tunnel-')){
      const bedGap=Math.min(...woods.beds.map(bed=>clearance(xy(a),bed.ring)));
      assert(bedGap>=1&&bedGap<1.1);
    }
  }
});

test('the separate rain and wastewater networks clear each other in three dimensions',async()=>{
  const {createRainServices}=await load(await read('../src/model/rain-services.js'));
  const {matrix:[[a,b],[c,d]],translation:[x,y],dimensions}=house.metadata;
  const group=new THREE.Group();
  group.matrix.set(-a,b,0,a*dimensions.width+x,-c,d,0,c*dimensions.width+y,0,0,1,0,0,0,0,1);
  const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
  const rain=createRainServices(THREE,house,{group},data);
  rain.updateMatrixWorld(true);
  const wastewater=system.children.filter(m=>m.name.startsWith('clarified-outlet')||m.name.startsWith('building-inlet-'));
  const rainPipes=rain.children.filter(m=>m.geometry.type==='CylinderGeometry'&&
    /rain-(ground-|leaf-filter|screened-overflow|filtered-inlet|tank-inspection|field-inspection)/.test(m.name));
  let closest=Infinity;
  for(const wet of wastewater)for(const storm of rainPipes){
    const [a,b]=axisEnds(wet),[c,d]=axisEnds(storm);
    const ray=new THREE.Ray(a,b.clone().sub(a).normalize()), projected=new THREE.Vector3();
    const distance=Math.sqrt(ray.distanceSqToSegment(c,d,projected));
    const axes=a.distanceTo(projected)<=a.distanceTo(b)?distance:
      new THREE.Line3(c,d).closestPointToPoint(b,true,projected).distanceTo(b);
    closest=Math.min(closest,axes-wet.geometry.parameters.radiusTop-storm.geometry.parameters.radiusTop);
  }
  assert(closest>.10,'least pipe wall clearance '+closest);
  const bays=rain.children.filter(m=>/^rain-crate-\d/.test(m.name));
  assert(bays.length>0);
  const footprint=worldFieldRing();
  for(const bay of bays){
    const {width,height}=bay.geometry.parameters;
    const ring=[[-width,-height],[width,-height],[width,height],[-width,height]].map(([x,y])=>
      xy(bay.localToWorld(new THREE.Vector3(x/2,y/2,0))));
    assert.equal(clipping.intersection([footprint],[ring]).length,0);
    assert(ringDistance(footprint,ring)>5);
  }
});

test('the level mulch finishes join the shrub beds and leave every service opening clear',()=>{
  const soilMeshes=['biodisc','inspection-strip'].map(id=>surface.getObjectByName('wastewater-mulch-'+id));
  const areas=woods.beds.map(b=>[b.ring,...b.holes]);
  for(const mesh of soilMeshes){
    const shape=mesh.geometry.parameters.shapes;
    const ring=shape.getPoints(40).map(({x,y})=>xy(mesh.localToWorld(new THREE.Vector3(x,y,0))));
    assert(areas.some(area=>clipping.intersection([ring],area).length));
    assert(mesh.position.z>.032+.001+.043*1.14&&mesh.position.z<.09);
  }
  for(const [i,id] of ['biodisc-service-lid','distributor-hatch','tunnel-vent-0','tunnel-vent-1'].entries()){
    const point=surface.getObjectByName(id).getWorldPosition(new THREE.Vector3()).setZ(1);
    const down=new THREE.Raycaster(point,new THREE.Vector3(0,0,-1));
    assert.equal(down.intersectObject(soilMeshes[i===0?0:1]).length,0,id);
  }
});
