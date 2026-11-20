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
const {matrix:[[a,b],[c,d]],translation:[tx,ty],dimensions}=house.metadata;
const planToSite=new THREE.Matrix4().set(-a,b,0,a*dimensions.width+tx,-c,d,0,c*dimensions.width+ty,0,0,1,0,0,0,0,1);
const siteToPlan=planToSite.clone().invert();
function axisEnds(mesh) {
  return [-.5,.5].map(f=>mesh.localToWorld(new THREE.Vector3(0,f*mesh.geometry.parameters.height,0)));
}
function pipeWallClearance(first,second){
  const [a,b]=axisEnds(first),[c,d]=axisEnds(second);
  const ray=new THREE.Ray(a,b.clone().sub(a).normalize()),projected=new THREE.Vector3();
  const distance=Math.sqrt(ray.distanceSqToSegment(c,d,projected));
  const axes=a.distanceTo(projected)<=a.distanceTo(b)?distance:
    new THREE.Line3(c,d).closestPointToPoint(b,true,projected).distanceTo(b);
  return axes-first.geometry.parameters.radiusTop-second.geometry.parameters.radiusTop;
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

test('the garage-side domestic collector connects to the real wall penetration and discharges by gravity into the BioDisc',async()=>{
  const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
  const {createIndoorServices}=await load(await read('../src/model/indoor-services.js'));
  const collector=createIndoorServices(THREE,null,data).getObjectByName('collector-to-exterior');
  const exit=new THREE.Vector3(...collector.userData.to).applyMatrix4(planToSite);
  const raw=system.children.filter(m=>m.name.startsWith('building-inlet-'));
  assert(raw.length>0);
  assert(exit.distanceTo(axisEnds(raw[0])[0])<1e-6,'indoor and outdoor ends meet in world coordinates');
  const inlet=gradedPipes(raw,.02);
  const expected=system.localToWorld(new THREE.Vector3(0,-.98,wastewater193.inletInvert+.055));
  assert(inlet.distanceTo(expected)<1e-6);
  assert(close(wastewater193.inletInvert-wastewater193.outletInvert,.085));
});

test('the downhill clarified pipe reaches the distributor and equally feeds both end caps',()=>{
  const outlet=system.children.filter(m=>m.name.startsWith('clarified-outlet-'));
  assert(outlet.length>1);
  const socket=axisEnds(system.getObjectByName('biodisc-outlet-socket'))[1];
  assert(socket.distanceTo(axisEnds(outlet[0])[0])<1e-6);
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
  const cover=-wastewater193.fieldBase-wastewater193.moduleHeight;
  assert(cover>=.30&&cover<=1.20-.15);
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
  assert(ringDistance(ring,neighbors.parcels['193'].coordinates[0])>3.4);
  for(const [key,gap] of [['house',2.1],['terrace',6.3],['driveway',.63],['entry',.63]]){
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

test('the tank and tunnels occupy the original garage-side site, with service access from the driveway',()=>{
  const tankPlan=system.position.clone().applyMatrix4(siteToPlan);
  const fieldPlan=field.getWorldPosition(new THREE.Vector3()).applyMatrix4(siteToPlan);
  assert(Math.hypot(tankPlan.x-13.279,tankPlan.y+1.904)<.02);
  assert(Math.hypot(fieldPlan.x-12.181,fieldPlan.y-1.097)<.02);
  const circle=(centre,r)=>Array.from({length:96},(_,i)=>[centre.x+r*Math.cos(i*Math.PI/48),centre.y+r*Math.sin(i*Math.PI/48)]);
  const tank=circle(system.position,wastewater193.tankDiameter/2);
  const cap=surface.getObjectByName('distributor-hatch'),centre=cap.getWorldPosition(new THREE.Vector3());
  const chamber=circle(centre,.22);
  for(const outline of [tank,chamber,worldFieldRing()]){
    assert.equal(clipping.difference([outline],neighbors.parcels['193'].coordinates).length,0);
  }
  assert(ringDistance(tank,hard.house.coordinates[0])>5.1);
  assert(ringDistance(tank,hard.terrace.coordinates[0])>9.4);
  assert(ringDistance(tank,neighbors.parcels['193'].coordinates[0])>2.0);
  assert(ringDistance(tank,worldFieldRing())>1.0);
  for(const tree of [...garden.trees,...woods.trees])assert(clearance(tree.center,tank)>3);
  const access=wastewaterServiceAccess193(),approach=access.at(-1).ring;
  assert(clipping.intersection([approach],hard.driveway.coordinates).length);
  assert(clipping.intersection([approach],[access[0].ring]).length);
  for(const geo of [hard.house,hard.terrace])assert.equal(clipping.intersection([approach],geo.coordinates).length,0);
});

test('actual BioDisc lid, rim, distribution hatch and vent cowls clear the parcel boundary',()=>{
  const boundary=neighbors.parcels['193'].coordinates[0];
  for(const [name,minGap] of [['biodisc-service-lid',2],['biodisc-lid-seam',2],
    ['distributor-hatch',2],['vent-cowl-0',2.20],['vent-cowl-1',2.20]]){
    const part=surface.getObjectByName(name),center=part.getWorldPosition(new THREE.Vector3());
    const vertices=part.geometry.getAttribute('position'),vertex=new THREE.Vector3();
    let radius=0;
    for(let i=0;i<vertices.count;i++){
      part.localToWorld(vertex.fromBufferAttribute(vertices,i));
      radius=Math.max(radius,Math.hypot(vertex.x-center.x,vertex.y-center.y));
    }
    const outline=Array.from({length:48},(_,i)=>{
      const angle=i*Math.PI/24;
      return [center.x+radius*Math.cos(angle),center.y+radius*Math.sin(angle)];
    });
    assert.equal(clipping.difference([outline],[boundary]).length,0,name+' must lie inside /193');
    const gap=clearance(xy(center),boundary)-radius;
    assert(gap>=minGap,name+' outer edge '+gap+' m from boundary');
  }
});

test('vent openings and the distributor align with the accessible surface fittings',()=>{
  const access=wastewaterServiceAccess193();
  const centre=m=>m.getWorldPosition(new THREE.Vector3());
  for(const [sub,cap] of [['drain-row-1-vent','tunnel-vent-0'],['drain-row-2-vent','tunnel-vent-1'],
    ['distribution-chamber','distributor-hatch']]){
    const a=centre(field.getObjectByName(sub)), b=centre(surface.getObjectByName(cap));
    assert(close(a.x,b.x)&&close(a.y,b.y));
    const r=cap.startsWith('tunnel-')?.375:.50;
    const pad=Array.from({length:24},(_,i)=>[a.x+r*Math.cos(i*Math.PI/12),a.y+r*Math.sin(i*Math.PI/12)]);
    assert.equal(clipping.difference([pad],...access.map(g=>[g.ring])).length,0);
    if(cap.startsWith('tunnel-')){
      const approach=access.find(item=>item.id==='approach');
      assert.equal(clipping.intersection([pad],[approach.ring]).length,0);
      assert.equal(clipping.intersection([pad],[worldFieldRing()]).length,0);
    }
  }
});

test('each tunnel vents through its far end cap and drains condensation back from a separate shrub-bed riser',()=>{
  for(const row of [1,2]){
    const prefix='drain-row-'+row, vent=field.getObjectByName(prefix+'-vent');
    const lateral=field.children.filter(mesh=>mesh.name.startsWith(prefix+'-vent-link-'));
    const end=gradedPipes(lateral,-.01);
    assert(end.distanceTo(axisEnds(vent)[0])<1e-6);
    const cap=field.getObjectByName(prefix+'-end-cap'), start=field.worldToLocal(axisEnds(lateral[0])[0]);
    assert(close(start.x,cap.position.x)&&close(start.y,cap.position.y-wastewater193.endCapDepth));
    assert(start.z-.055>cap.position.z&&start.z+.055<cap.position.z+wastewater193.moduleHeight);
    const otherPipes=[
      ...system.children.filter(m=>m.name.startsWith('building-inlet-')||m.name.startsWith('clarified-outlet-')),
      ...field.children.filter(m=>m.name.startsWith('drain-row-'+(3-row)+'-vent'))
    ];
    for(const mesh of [...lateral,vent])for(const other of otherPipes){
      assert(pipeWallClearance(mesh,other)>.10,mesh.name+' near '+other.name);
    }
  }
});

test('the separate rain and wastewater networks clear each other in three dimensions',async()=>{
  const {createRainServices,rainTankFootprint193}=await load(await read('../src/model/rain-services.js'));
  const {iconPlanPoint}=await load(await read('../src/model/roof-windows.js'));
  const group=new THREE.Group();group.matrix.copy(planToSite);
  const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
  const rain=createRainServices(THREE,house,{group},data);
  rain.updateMatrixWorld(true);
  const wastewater=[...system.children,...field.children].filter(m=>
    /^(clarified-outlet-|building-inlet-|distribution-branch-|distribution-chamber$|drain-row-\d+-vent(?:$|-link-))/.test(m.name));
  const rainPipes=rain.children.filter(m=>m.geometry.type==='CylinderGeometry'&&
    /^rain-(ground-|leaf-filter|screened-overflow|filtered-inlet|tank-inspection|field-(inspection|feed-|vent-return-|air-))/.test(m.name));
  assert(rainPipes.some(mesh=>mesh.name.startsWith('rain-field-feed-')));
  assert(rainPipes.some(mesh=>mesh.name.startsWith('rain-field-vent-return-')));
  let closest=Infinity;
  for(const wet of wastewater)for(const storm of rainPipes)closest=Math.min(closest,pipeWallClearance(wet,storm));
  assert(closest>.10,'least pipe wall clearance '+closest);
  const bays=rain.children.filter(m=>/^rain-crate-\d/.test(m.name));
  assert(bays.length>0);
  const footprint=worldFieldRing(),rainTank=rainTankFootprint193(house,iconPlanPoint).ring;
  const bioDisc=wastewaterServiceAccess193().find(s=>s.id==='tank').footprint;
  for(const [outline,minGap] of [[footprint,18.5],[bioDisc,23.2]]){
    assert.equal(clipping.intersection([outline],[rainTank]).length,0);
    assert(ringDistance(outline,rainTank)>minGap);
  }
  for(const bay of bays){
    const {width,height}=bay.geometry.parameters;
    const ring=[[-width,-height],[width,-height],[width,height],[-width,height]].map(([x,y])=>
      xy(bay.localToWorld(new THREE.Vector3(x/2,y/2,0))));
    assert.equal(clipping.intersection([footprint],[ring]).length,0);
    assert(ringDistance(footprint,ring)>5);
  }
});

test('the section outline meets the physical shoulder of the BioDisc lid',()=>{
  const ring=system.getObjectByName('biodisc-service-cover-outline'),lid=surface.getObjectByName('biodisc-service-lid');
  const origin=ring.localToWorld(new THREE.Vector3(ring.geometry.parameters.radius,0,1));
  const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1)).intersectObject(lid)[0];
  assert(hit&&Math.abs(hit.point.z-ring.position.z)<.002);
  const bottom=system.getObjectByName('biodisc-base').position.z;
  assert(close(.31-bottom,wastewater193.tankHeight));
});

test('the level mulch finishes join the shrub beds and leave every service opening clear',()=>{
  const soilMeshes=['biodisc','distributor','vent-0','vent-1'].map(id=>surface.getObjectByName('wastewater-mulch-'+id));
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
    assert.equal(down.intersectObject(soilMeshes[i]).length,0,id);
  }
});

test('tank boundary labels measure the lid edge and the rotated rain tank footprint in the site frame',async()=>{
  const {measureTankGaps}=await load(await read('../src/model/tank-dimensions.js'));
  const {rainTankFootprint193}=await load(await read('../src/model/rain-services.js'));
  const footprint=rainTankFootprint193(house,(_house,x,y,z)=>new THREE.Vector3(x,y,z).applyMatrix4(planToSite).toArray()).ring;
  const part=surface.getObjectByName('biodisc-lid-seam');
  part.geometry.computeBoundingBox();
  const radius=part.geometry.boundingBox.max.x,boundary=neighbors.parcels['193'].coordinates[0];
  const [lid,body]=measureTankGaps(boundary,wastewater193.tankCenter,radius,footprint);
  assert.equal(lid.length.toFixed(2),'2.10');
  assert.equal(body.length.toFixed(2),'7.90');
  assert(close(clearance(body.start,footprint),0));
  for(const gap of [lid,body]){
    assert(close(clearance(gap.end,boundary),0));
    assert(close(Math.hypot(gap.start[0]-gap.end[0],gap.start[1]-gap.end[1]),gap.length));
  }
});
