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
const woodParcels=JSON.parse(await read('../trzy-domy-3d/woodland-plan.json')).parcels;
const {createRainServices,createRainSurface,rainServiceAccess193,rainFieldFootprints193,rainRoofCuts193,recessRainWallHeads193}=await load(await read('../src/model/rain-services.js'));
const {matrix:[[a,b],[c,d]],translation:[x,y]}=house.metadata;
const group=new THREE.Group();
group.matrix.set(-a,b,0,a*14.64+x,-c,d,0,c*14.64+y,0,0,1,0,0,0,0,1);
const rain=createRainServices(THREE,house,{group},data);
const plantingMaterial=new THREE.MeshStandardMaterial();
const surface=createRainSurface(THREE,house,{group},plantingMaterial);
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
  assert.equal(named('crate-').filter(m=>m.name!=='rain-crate-rib').length,22);
  assert(close(info.fieldNetM3,8.91));
  assert.equal(named('downpipe-').length,4);
});

function pipeEnds(mesh) {
  return [-.5,.5].map(t=>new THREE.Vector3(0,t*mesh.geometry.parameters.height,0)
    .applyQuaternion(mesh.quaternion).add(mesh.position));
}

const {iconPlanPoint,cutRoofGeometry,roofWindowOpenings,clipRoofSeam}=await load(await read('../src/model/roof-windows.js'));
const {addIconInterior}=await load(await read('../src/model/interior.js'));
const {joinIconStorySurfaces}=await load(await read('../src/model/story-joints.js'));
const {createSoilVentSurface,soilVentRoofCut193,createIndoorServices}=await load(await read('../src/model/indoor-services.js'));
const cuts=[...roofWindowOpenings(house,neighbors).filter(o=>o.parcel==='193'),...rainRoofCuts193(house.metadata,iconPlanPoint),
  soilVentRoofCut193(house.metadata,iconPlanPoint)];
const interior=addIconInterior({THREE,scene:new THREE.Scene(),house,data,joinStory:joinIconStorySurfaces,
  cutRoof:(geometry,matrix)=>cutRoofGeometry(THREE,geometry,cuts,matrix)});
recessRainWallHeads193(THREE,interior.group,house.metadata.dimensions.eave);
interior.group.updateMatrixWorld(true);
const shell=interior.group.children.filter(m=>/^(interior-roof-lining-|upper-|facade-)|-gable$/.test(m.name)&&m.isMesh);
const vents=createSoilVentSurface(THREE,house,interior);vents.updateMatrixWorld(true);
const roofs=house.meshes.filter(m=>m.kind==='roof').map(part=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices.flat(),3));geometry.setIndex(part.faces.flat());
  return new THREE.Mesh(cutRoofGeometry(THREE,geometry,cuts),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
});
const gutters=surface.children.filter(m=>m.name.startsWith('rain-gutter-'));
function ray(objects,point,direction,far=25){
  const origin=new THREE.Vector3(...point).applyMatrix4(surface.matrixWorld);
  const d=new THREE.Vector3(...direction).transformDirection(surface.matrixWorld);
  return new THREE.Raycaster(origin,d,0,far).intersectObjects(objects,false)[0];
}

test('the visible trough, flashing and edge of the actual cut roofing sit inside all five facade planes',()=>{
  assert.equal(gutters.length,8);
  const {eave}=house.metadata.dimensions,all=[...roofs,...shell,...gutters];
  const edges=[[[0,0],[0,18.13],[1,0]],[[8.5,0],[8.5,4.21],[-1,0]],
    [[8.5,4.21],[14.64,4.21],[0,1]],[[8.5,12.71],[14.64,12.71],[0,-1]],
    [[8.5,12.71],[8.5,18.13],[-1,0]]];
  for(const [a,b,n] of edges)for(const t of [.07,.23,.49,.76,.90]){
    const [x,y]=a.map((p,k)=>p+(b[k]-p)*t);
    const fromTop=inset=>ray(all,[x+n[0]*inset,y+n[1]*inset,12],[0,0,-1]);
    const sole=fromTop(.06),hem=fromTop(.004),sheet=fromTop(.17);
    assert(sole&&gutters.includes(sole.object)&&sole.point.z<eave-.085,'clear gutter sole at '+[x,y]);
    assert(hem&&gutters.includes(hem.object)&&hem.point.z-sole.point.z>.145,'raised flush rim at '+[x,y]);
    assert(sheet&&roofs.includes(sheet.object),'actual roof above rear fold at '+[x,y]);
    assert(!ray(gutters,[x-n[0]*.002,y-n[1]*.002,12],[0,0,-1]),'outside the facade at '+[x,y]);
    for(const [z,expected] of [[eave-.22,shell],[eave-.05,gutters]]){
      const side=ray(all,[x-n[0]*.22,y-n[1]*.22,z],[...n,0],.3);
      assert(side&&expected.includes(side.object)&&close(side.distance,.22,.00001),'wall/rim alignment at '+[x,y,z]);
    }
  }
  const inverse=surface.matrixWorld.clone().invert();
  for(const l of house.lines.filter(l=>l.kind==='roof-seam'))for(const [a,b] of clipRoofSeam(l.points,cuts)){
    const center=new THREE.Vector3(...a).lerp(new THREE.Vector3(...b),.5).applyMatrix4(inverse);
    assert(!ray(gutters,[center.x,center.y,12],[0,0,-1])||ray(roofs,[center.x,center.y,12],[0,0,-1]),'seam in gutter');
  }
  for(const offset of named('outlet-offset-')){
    const [intake]=pipeEnds(offset);
    assert(!ray(all,[intake.x,intake.y,5],[0,0,-1],5-intake.z+.12),'open drain throat '+offset.name);
  }
});

test('each removable plinth hatch reveals the drain inspection plug through the real cladding',()=>{
  for(const [i,cleanout] of named('cleanout-').entries()){
    const nx=i<2?1:0,ny=i===2?1:i===3?-1:0;
    const x=nx?0:cleanout.position.x,y=nx?cleanout.position.y:ny>0?4.21:12.71;
    const door=surface.getObjectByName('rain-service-hatch-door-'+i),plug=surface.getObjectByName('rain-service-hatch-plug-'+i);
    const from=[x-nx*.25,y-ny*.25,.20],inward=[nx,ny,0];
    assert.equal(ray([...shell,door,plug],from,inward,.5).object,door);
    assert.equal(ray([...shell,plug],from,inward,.5).object,plug);
    assert(ray(shell,[from[0]-.11*ny,from[1]+.11*nx,.20],inward,.28),'surrounding solid facade');
  }
});

test('opaque roof vent surrounds an open bore and meets the sanitary overlay at the visible rim',()=>{
  const indoor=createIndoorServices(THREE,interior,data),[x,y,top]=indoor.getObjectByName('soil-vent-to-roof').userData.to;
  const down=[0,0,-1],all=[...roofs,...shell,...vents.children];
  const boot=vents.getObjectByName('soil-vent-weathering-boot'),pipe=vents.getObjectByName('soil-vent-open-pipe');
  assert(vents.visible&&vents.children.every(m=>m.material.depthTest&&!m.material.transparent));
  for(const dx of [-.060,.060])assert(close(ray(all,[x+dx,y,12],down).point.z,top,.00001));
  for(const dx of [-.13,.13])assert.equal(ray(all,[x+dx,y,12],down).object,boot);
  assert.equal(ray(all,[x-.3,y,top-.32],[1,0,0],.5).object,pipe);
  assert(!ray(all,[x,y,top+.1],down,.9),'roof layers and vent bore are open');
});

test('the two ends of every socket match the gutter throat and concealed rectangular downpipe',()=>{
  const gutterVertices=gutters.flatMap(g=>{
    const p=g.geometry.getAttribute('position');
    return Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i));
  });
  for(const pipe of named('downpipe-')){
    const socket=surface.getObjectByName(pipe.name.replace('downpipe','outlet-socket'));
    const vertices=socket.geometry.getAttribute('position');
    const {width,height,depth}=pipe.geometry.parameters;
    const corners=Array.from({length:vertices.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(vertices,i));
    const high=corners.filter(p=>p.z>pipe.position.z+depth/2+.1);
    assert(high.length&&high.every(p=>gutterVertices.some(q=>p.distanceTo(q)<.000002)),socket.name+' throat');
    for(const dx of [-width/2,width/2])for(const dy of [-height/2,height/2]){
      const corner=pipe.position.clone().add(new THREE.Vector3(dx,dy,depth/2));
      const matched=corners.some(p=>corner.distanceTo(p)<.000002);
      assert(matched,pipe.name+' corner '+dx+', '+dy);
    }
  }
});

function checkCrateWallEntry(modules,pipe,segment){
  const bounds=new THREE.Box3();
  for(const crate of modules){
    crate.geometry.computeBoundingBox();
    bounds.union(crate.geometry.boundingBox.clone().translate(crate.position));
  }
  const [from,to]=segment;
  assert(!bounds.containsPoint(from)&&bounds.containsPoint(to),pipe.name+' crosses the field perimeter');
  const direction=to.clone().sub(from).normalize();
  const hit=new THREE.Ray(from,direction).intersectBox(bounds,new THREE.Vector3());
  const axis=close(Math.abs(direction.x),0)?'y':'x',across=axis==='x'?'y':'x';
  assert(hit&&close(direction[across],0),pipe.name+' enters square to the crate wall');
  const radius=pipe.geometry.parameters.radiusTop;
  assert(modules.some(crate=>{
    const {width,height,depth}=crate.geometry.parameters,halfWidth=(axis==='x'?width:height)/2;
    return close(Math.abs(hit[axis]-crate.position[axis]),halfWidth)&&close(hit[across],crate.position[across])&&
      Math.abs(hit.z-crate.position.z)+radius<depth/2;
  }),pipe.name+' passes through the centreline of a single module wall');
}

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
  const discharge=over.at(-1)[1],chamber=rain.getObjectByName('rain-field-inspection');
  assert(close(discharge.x,chamber.position.x)&&close(discharge.y,chamber.position.y));
  const [bottom,top]=pipeEnds(chamber);
  const faces=named('crate-').filter(m=>m.name!=='rain-crate-rib');
  for(let i=0;i<3;i++){
    const feed=named('field-feed-'+i+'-').map(pipeEnds);
    const air=named('field-vent-return-'+i+'-').map(pipeEnds);
    assert(feed.length>=1&&air.length===feed.length);
    for(const [route,k] of [[feed,0],[air,1]]){
      for(const [j,[a,b]] of route.entries()){
        if(j)assert(a.distanceTo(route[j-1][1])<1e-6);
        assert(close((a.z-b.z)/Math.hypot(b.x-a.x,b.y-a.y),.012));
      }
      const port=route[0][0];
      assert(Math.hypot(port.x-bottom.x,port.y-bottom.y)<=chamber.geometry.parameters.radiusTop);
      assert(port.z>bottom.z&&port.z<top.z);
      if(k)assert(port.z>discharge.z);
      else assert(port.z<discharge.z&&close(port.z,named('field-feed-0-').map(pipeEnds)[0][0].z));
      const pipes=named((k?'field-vent-return-':'field-feed-')+i+'-');
      checkCrateWallEntry(faces.filter(m=>m.name.startsWith('rain-crate-'+i+'-')),pipes.at(-1),route.at(-1));
    }
  }
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
const lot=source.variants[0],outline=neighbors.parcels['193'].coordinates;
const obstacles=[...['house','terrace','driveway','entry'].map(key=>lot[key].coordinates),
  ...[...garden.polygons.filter(p=>!['lawn','planting','path'].includes(p.kind)),...garden.objects.filter(p=>p.ring)]
    .map(p=>[p.ring,...p.holes||[]])];
const reservations=rainServiceAccess193(house,iconPlanPoint).map(({ring})=>[ring]);

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
function minimumDistance(ring,other){
  return Math.min(...ring.map(p=>edgeDistance(p,other)),...other.map(p=>edgeDistance(p,ring)));
}
function clearFootprint(polygon){
  assert.equal(clipping.difference(polygon,outline).length,0,'lot boundary');
  for(const obstacle of obstacles)assert.equal(clipping.intersection(polygon,obstacle).length,0,'garden or building obstacle');
}

test('the sealed 6 m³ tank occupies the geographic northeast side strip with access from the terrace',()=>{
  const tank=named('tank-shell')[0],polygon=boxPolygon(tank);
  clearFootprint(polygon);
  const side=world([tank.position.x,tank.position.y]),center=world([7.32,9.065]);
  assert(side[0]>center[0]&&side[1]>center[1]);
  const water=named('tank-water')[0],shellFloor=tank.position.z-tank.geometry.parameters.depth/2+.08;
  assert(close(water.geometry.parameters.width*water.geometry.parameters.height*(water.position.z-shellFloor),6));
  assert(minimumDistance(polygon[0],lot.house.coordinates[0])>=1.35);
  assert(minimumDistance(polygon[0],outline[0])>.68);
  assert.equal(clipping.difference(polygon,...reservations).length,0);
  const fromTerrace=clipping.intersection(lot.terrace.coordinates,clipping.union(...reservations));
  assert(fromTerrace.length,'plant-free access starts at the terrace');
});

test('three separate infiltration beds span the central private lawn clear of paths, tree roots and foundations',()=>{
  const crates=named('crate-').filter(m=>m.name!=='rain-crate-rib');
  const beds=rainFieldFootprints193(house,iconPlanPoint);
  assert.deepEqual(beds.map(b=>b.id),['rain-field-1','rain-field-2','rain-field-3']);
  const privateLawn=clipping.union(...garden.polygons.filter(p=>p.kind==='lawn').map(p=>[p.ring,...p.holes||[]]));
  const allTrees=[...woodParcels.flatMap(p=>p.trees),...garden.trees];
  const gardenSurfaces=garden.polygons.filter(p=>['path','paving','gravel'].includes(p.kind));
  for(const [i,{ring}] of beds.entries()){
    const modules=crates.filter(m=>m.name.startsWith('rain-crate-'+i+'-'));
    assert.equal(modules.length,[8,8,6][i]);
    assert.equal(new Set(modules.map(m=>m.position.z)).size,1);
    assert.equal(clipping.union(...modules.map(m=>boxPolygon(m,.000001))).length,1);
    const footprint=[ring];
    const outside=clipping.difference(footprint,...modules.map(m=>boxPolygon(m,.000001)));
    assert.equal(outside.length,0,'exported bed outline must match the render');
    const local=new THREE.Box2().setFromPoints(ring.map(([x,y])=>{
      const p=new THREE.Vector3(x,y,0).applyMatrix4(rain.matrixWorld.clone().invert());
      return new THREE.Vector2(p.x,p.y);
    })).expandByScalar(.000001);
    for(const m of modules)for(const sign of [-1,1]){
      assert(local.containsPoint(new THREE.Vector2(m.position.x+sign*m.geometry.parameters.width/2,
        m.position.y+sign*m.geometry.parameters.height/2)));
    }
    assert.equal(clipping.difference(footprint,privateLawn).length,0,'outside the private lawn');
    assert.equal(clipping.difference(footprint,...reservations).length,0);
    clearFootprint(footprint);
    const baseDepth=-modules[0].position.z+modules[0].geometry.parameters.depth/2+.10;
    assert(minimumDistance(ring,lot.house.coordinates[0])>=1.5*baseDepth);
    assert(minimumDistance(ring,lot.terrace.coordinates[0])>=4);
    assert(minimumDistance(ring,outline[0])>=6);
    for(const {id,ring:surface} of gardenSurfaces)assert(minimumDistance(ring,surface)>1,'excavation space by '+id);
    for(const t of allTrees)assert(edgeDistance(t.center,ring)>Math.max(3,2*t.crownRadius));
    for(const other of beds.slice(0,i))assert(minimumDistance(ring,other.ring)>3);
  }
  const [branch,vent]=pipeEnds(named('field-air-branch')[0]),[riserBottom,riserTop]=pipeEnds(named('field-air-riser')[0]);
  const chamber=rain.getObjectByName('rain-field-inspection');
  assert(close(branch.x,chamber.position.x)&&close(branch.y,chamber.position.y)&&vent.distanceTo(riserBottom)<1e-6);
  const hood=surface.getObjectByName('rain-field-vent-hood');
  assert(close(hood.position.x,riserTop.x)&&close(hood.position.y,riserTop.y)&&hood.position.z>riserTop.z);
});

test('mulch joins the planted beds around every lid and the vent without covering the terrace or paths',()=>{
  const patches=surface.children.filter(m=>m.name.startsWith('rain-mulch-'));
  const beds=woodParcels.find(p=>p.id==='193').beds.map(b=>[b.ring,...b.holes||[]]);
  const rings=patches.map(mesh=>{
    assert.equal(mesh.material,plantingMaterial);
    const shape=mesh.geometry.parameters.shapes;
    const ring=shape.getPoints(8).map(v=>world([v.x,v.y]));
    const polygon=[ring];
    clearFootprint(polygon);
    assert(clipping.intersection(polygon,clipping.union(...beds)).length>0,'joins an existing bed');
    for(const path of garden.polygons.filter(p=>p.kind==='path'))
      assert.equal(clipping.intersection(polygon,[path.ring]).length,0,path.id);
    return polygon;
  });
  for(const mesh of surface.children.filter(m=>/^rain-cover-(leaf-filter|tank-inspection|field-inspection)$/.test(m.name)||m.name==='rain-field-vent-hood')){
    const r=mesh.geometry.parameters.radiusTop+.12;
    const ring=Array.from({length:32},(_,i)=>world([mesh.position.x+r*Math.cos(i*Math.PI/16),mesh.position.y+r*Math.sin(i*Math.PI/16)]));
    assert.equal(clipping.difference([ring],...rings).length,0,mesh.name+' surrounded by mulch');
    assert.equal(clipping.difference([ring],...reservations).length,0,mesh.name+' remains clear of planting');
    assert(mesh.position.z>patches[0].position.z);
  }
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
    clearFootprint([perimeter]);
    assert.equal(clipping.difference([perimeter],...reservations).length,0,'plant exclusion covers the whole lid');
    const lawnHeight=Math.max(...garden.polygons.filter(p=>p.kind==='lawn').map(p=>p.z))+.01;
    const highestBlade=lawnHeight+.001+.043*1.14;
    assert(cap.position.z+cap.geometry.parameters.height/2>highestBlade);
  }
});
