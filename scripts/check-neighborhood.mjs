import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const directory = new URL('../trzy-domy-3d/', import.meta.url);
const data = JSON.parse(fs.readFileSync(new URL('neighborhood.json', directory)));
const html = fs.readFileSync(new URL('index.html', directory), 'utf8');

test('the standalone model uses the reviewed parcel and roof survey', () => {
  const embedded = html.match(/^const neighborhoodData=(.+);$/m);
  assert.deepEqual(JSON.parse(embedded[1]), data);
  assert.equal(new Set(data.parcels.map(p => p.number)).size, 111);
  const counts = Object.fromEntries(['original','west','south','east'].map(key =>
    [key, data.parcels.filter(p=>p.regions.includes(key)).length]));
  assert.deepEqual(counts,{original:78,west:8,south:21,east:10});
  assert.deepEqual(data.registryOnly.map(b => b.id), ['220508_5.0004.2077_BUD']);
  assert.deepEqual(data.existingModels.map(b => b.id), ['220508_5.0004.2159_BUD']);
  const ids = [...data.buildings, ...data.existingModels, ...data.registryOnly].map(b => b.id);
  assert.equal(new Set(ids).size, 58);
});

test('roof faces cover each source footprint and map into the photographic atlas', () => {
  const ringArea = ring => Math.abs(ring.slice(1).reduce((sum, [x, y], index) => {
    const [ax, ay] = ring[index];
    return sum + ax * y - x * ay;
  }, 0)) / 2;
  for (const b of data.buildings) {
    assert(data.parcels.some(p => p.number === b.parcel), b.id);
    const {vertices, triangles} = b.roof;
    const [us, uo, vs, vo] = b.roofUV;
    for (const [x,y,z] of vertices) {
      assert(z > 0 && z < 15, b.id);
      assert(x*us + uo >= 0 && x*us + uo <= 1 && y*vs + vo >= 0 && y*vs + vo <= 1, b.id);
    }
    for (const quad of b.roof.risers) {
      assert.equal(quad.length,4,b.id);
      assert(quad.every(i=>Number.isInteger(i) && vertices[i]),b.id);
    }
    const area = (b.roofPolygons ?? b.polygons).reduce((sum, [outer, ...holes]) =>
      sum + ringArea(outer) - holes.reduce((a, h) => a + ringArea(h), 0), 0);
    const projected = triangles.reduce((sum, [i,j,k]) => {
      const [a,b,c] = [vertices[i], vertices[j], vertices[k]];
      return sum + ((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])) / 2;
    }, 0);
    assert(Math.abs(projected - area) < area * .001, b.id);
  }
});

test('each modeled structure has its own facade layout and buildable selected walls', () => {
  const types = new Set(['house','garage','barn','shed','pavilion']);
  const tokens = new Set(['window','small','pair','wide','blank','garage','barnDoor','door']);
  assert.equal(data.buildings.length, 56);
  assert.equal(new Set(data.buildings.map(b => b.design.detail)).size, 56);
  for (const b of data.buildings) {
    assert(types.has(b.design.type), b.id);
    assert(Number.isFinite(b.design.frontAz), b.id);
    assert(Object.keys(b.facades).length, b.id);
    for (const side of ['front','right','back','left']) {
      assert(b.design[side].every(t => tokens.has(t)), b.id);
      if (!b.facades[side]) continue;
      assert(b.facades[side].flat().every(Number.isFinite), b.id);
    }
  }
  assert.equal(data.buildings.filter(b=>b.roofPolygons).length, 3);
});

test('mapped fence segments block crossing and leave their ends open for walking', async () => {
  const {neighborhoodFenceObstacles} = await import('../src/model/neighborhood-details.js');
  const {createWalkCollision} = await import('../src/model/walk.js');
  assert.equal(data.fences.length,86);
  for (const fence of data.fences) {
    assert(data.parcels.some(p=>p.number===fence.parcel));
    const [[x,y],[ex,ey]]=fence.path, dx=ex-x, dy=ey-y, length=Math.hypot(dx,dy);
    assert(length>1);
    const solids=neighborhoodFenceObstacles([fence]);
    const collision=createWalkCollision(solids.map(s=>({ring:s.footprint.coordinates[0]})));
    assert(collision.blocked([(x+ex)/2,(y+ey)/2]));
    assert(!collision.blocked([x-dx/length,y-dy/length]));
  }
});

test('all rendered houses and hedge endpoints produce finite geometry and camera bounds', async () => {
  const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
  const THREE = await import(imports['three/core']);
  const {addNeighborhood} = await import('../src/model/neighborhood.js');
  const canvasContext = {fillRect() {}, beginPath() {}, ellipse() {}, fill() {}};
  globalThis.document = {createElement: () => ({getContext: () => canvasContext})};
  try {
    const {group,openings} = addNeighborhood(THREE,new THREE.Scene(),data,null);
    group.traverse(mesh => {
      const positions = mesh.geometry?.getAttribute('position');
      if (positions) assert(positions.array.every(Number.isFinite),mesh.name);
      if (mesh.isInstancedMesh) assert(mesh.instanceMatrix.array.every(Number.isFinite),mesh.name);
    });
    const bounds = new THREE.Box3().setFromObject(group);
    assert([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));
    for (const b of data.buildings) {
      if (b.design.type === 'pavilion') assert.equal(openings[b.id],0,b.id);
      else assert(openings[b.id] > 0,b.id);
    }
  } finally {
    delete globalThis.document;
  }
});

test('future houses fit vacant parcels and their driveway reaches the entrance and gate', async () => {
  const {layout,vegetation} = JSON.parse(html.match(/^const futureInputs=(.+);$/m)[1]);
  const {futureHouseSpecs} = await import('../src/model/future-houses.js');
  const {createWalkCollision} = await import('../src/model/walk.js');
  const parcels = new Map(data.parcels.map(p => [p.number,p]));
  const occupied = new Set([...data.buildings,...data.existingModels].map(b=>b.parcel));
  const pointDistance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  const ids = new Set();
  for (const h of layout.homes) {
    const spec = futureHouseSpecs[h.type], parcel = parcels.get(h.parcel);
    assert(!ids.has(h.parcel) && !occupied.has(h.parcel) && parcel.areaM2 <= 3000, h.parcel);
    ids.add(h.parcel);
    assert.equal(h.width,spec.width);
    assert.equal(h.depth,spec.depth);
    assert(h.roadDistance >= 5 && h.boundaryDistance >= 3.99,h.parcel);
    const r=h.angle*Math.PI/180, front=[h.x+h.depth*Math.sin(r)/2,h.y-h.depth*Math.cos(r)/2];
    assert(pointDistance(front,h.entry)<.003 && pointDistance(h.centerline.at(-1),h.entry)<.002,h.parcel);
    assert(pointDistance(...h.gate)>4 && h.driveway.length>=4,h.parcel);
    for (const p of h.envelope.slice(0,-1)) {
      const dx=p[0]-h.x, dy=p[1]-h.y;
      assert(Math.abs(Math.abs(dx*Math.cos(r)+dy*Math.sin(r))-(h.width+1)/2)<.003,h.parcel);
      assert(Math.abs(Math.abs(dy*Math.cos(r)-dx*Math.sin(r))-(h.depth+1)/2)<.003,h.parcel);
    }
  }
  assert.deepEqual(new Set(layout.homes.map(h=>h.type)),new Set(Object.keys(futureHouseSpecs)));
  const featured=layout.homes.find(h=>h.parcel==='775/192');
  assert.equal(featured.type,'barnA200');
  assert.equal(futureHouseSpecs[featured.type].usableAreaM2,200);
  assert.equal(featured.road,'775/133');
  assert(Math.hypot(featured.x-36,featured.y+35)<2);
  let enabled=true;
  const collision=createWalkCollision([{ring:featured.footprint,enabled:()=>enabled}]);
  assert(collision.blocked([featured.x,featured.y]));
  enabled=false;assert(!collision.blocked([featured.x,featured.y]));
  assert(vegetation.trees.length>0 && vegetation.trees.every(t=>t.height>0 && t.radius>0 && parcels.has(t.parcel)));
});

test('the development scenario keeps every eligible plot and retains measured tree coordinates', () => {
  const {layout,vegetation} = JSON.parse(html.match(/^const futureInputs=(.+);$/m)[1]);
  const homes = new Set(layout.homes.map(h=>h.parcel));
  assert.equal(homes.size,61);
  assert.deepEqual(layout.excluded,[]);
  const surveyed = new Map(vegetation.trees.map(t=>[t.id,t]));
  const moved = new Set();
  for (const move of layout.treeMoves) {
    const tree = surveyed.get(move.id);
    assert(tree && !moved.has(move.id) && homes.has(move.parcel));
    assert.equal(move.parcel,tree.parcel);
    assert.deepEqual(move.from,[tree.x,tree.y]);
    assert(Number.isFinite(move.x) && Number.isFinite(move.y));
    assert(Math.hypot(tree.x-move.x,tree.y-move.y)>.1);
    moved.add(move.id);
  }
  for (const parcel of ['733/143','775/75','775/95','775/96']) {
    assert(homes.has(parcel));
    assert(layout.treeMoves.some(move=>move.parcel===parcel),parcel);
  }
  assert.equal(vegetation.otherHighObjects.length,3);
});

test('each proposed home has a garden, and planted screens stay clear of its entrance', async () => {
  const {gardens,layout} = JSON.parse(html.match(/^const futureInputs=(.+);$/m)[1]);
  const {createWalkCollision} = await import('../src/model/walk.js');
  const {designFutureFences} = await import('../src/model/future-fences.js');
  const {neighborhoodFenceObstacles} = await import('../src/model/neighborhood-details.js');
  const homes = new Map(layout.homes.map(h=>[h.parcel,h]));
  assert.equal(gardens.lots.length,homes.size);
  assert.deepEqual(new Set(gardens.lots.map(l=>l.parcel)), new Set(homes.keys()));
  const screens = gardens.lots.filter(lot=>lot.thuja.length);
  assert(screens.length>1 && screens.length<gardens.lots.length);
  const trees = gardens.lots.flatMap(lot=>lot.trees);
  assert(new Set(trees.map(t=>t.kind)).size>=3);

  const fences = designFutureFences(layout);
  assert.deepEqual(fences.map(f=>f.path),layout.fences.map(f=>f.path));
  assert(new Set(fences.map(f=>f.style)).size>=5);
  const hedgePaths = screens.flatMap(lot=>lot.thuja.map(row=>({
    parcel:lot.parcel,path:row.path,collisionHalfWidth:row.radius,
  })));
  const boundaries = neighborhoodFenceObstacles([...fences,...hedgePaths]);
  const collision = createWalkCollision(boundaries.map(o=>({ring:o.footprint.coordinates[0]})));
  for (const lot of gardens.lots) {
    const h = homes.get(lot.parcel);
    assert(lot.lawn.length>0 && lot.lawn.every(([ring])=>ring.length>=4),lot.parcel);
    assert(lot.beds.length || lot.trees.length || lot.thuja.length,lot.parcel);
    for (const hedge of lot.thuja) assert(hedge.height>=1.8 && hedge.height<=2.2,lot.parcel);
    for (const [index,endpoint] of h.centerline.slice(1).entries()) {
      assert(!collision.pathBlocked(h.centerline[index],endpoint),h.parcel);
    }
  }
});


test('garage capacity, habitable area and facade variants match the proposed housing mix', async () => {
  const {layout} = JSON.parse(html.match(/^const futureInputs=(.+);$/m)[1]);
  const {futureHouseSpecs,futureGarageFootprint,futureHouseVariant} = await import('../src/model/future-houses.js');
  const {createWalkCollision} = await import('../src/model/walk.js');
  const counts=[0,0,0], variants=new Set();
  for(const h of layout.homes) {
    assert(!['775/190','775/191','775/193'].includes(h.parcel));
    assert.equal(h.residentialAreaM2,futureHouseSpecs[h.type].usableAreaM2,h.parcel);
    counts[h.garage?.stalls??0]++;
    variants.add(futureHouseVariant(h));
    const ring=futureGarageFootprint(h);
    if(!h.garage) {assert.equal(ring,null); continue;}
    assert(h.fullEnvelope.length>=5 && h.garage.doorWidth>=(h.garage.stalls===2?4.5:2.35),h.parcel);
    const [a,b,c,d]=h.garage.footprint;
    const center=[(a[0]+c[0])/2,(b[1]+d[1])/2];
    assert(createWalkCollision([{ring}]).blocked(center),h.parcel);
    assert(h.garage.apron.length>=4 && h.garage.approach.length>=2);
  }
  assert.deepEqual(counts,[12,31,18]);
  assert(variants.size>8);
  assert.deepEqual(layout.homes.filter(h=>h.residentialAreaM2===200).map(h=>h.parcel),['775/192']);
});

test('the nine detailed gardens have seating and paths, with varied multi-sided planting elsewhere', () => {
  const {gardens} = JSON.parse(html.match(/^const futureInputs=(.+);$/m)[1]);
  const priority=[159,162,163,176,179,180,182,183,192].map(n=>'775/'+n);
  const terraces=gardens.lots.filter(lot=>lot.terraces?.length);
  assert.deepEqual(terraces.map(lot=>lot.parcel).sort(),priority.sort());
  for(const lot of terraces) {
    assert(lot.gardenPaths?.length && lot.beds.length>=2,lot.parcel);
    for(const t of lot.terraces) assert(t.width>=2.5 && t.depth>=2.5 && ['dining','lounge'].includes(t.seating),lot.parcel);
  }
  const screens=gardens.lots.filter(lot=>lot.thuja.length);
  const sideCounts=screens.map(lot=>new Set(lot.thuja.map(row=>row.side)).size);
  assert(sideCounts.every(n=>n>=2));
  assert.deepEqual(new Set(sideCounts),new Set([2,3,4]));
  const trees=gardens.lots.flatMap(lot=>lot.trees);
  assert(trees.filter(t=>t.height>=8).length>=50);
  assert(trees.filter(t=>t.height>=4 && t.height<8).length>=100);
});

test('the 1 m terrain spans the imagery and the four central parcels remain level', async () => {
  const {createNeighborhoodTerrain}=await import('../src/model/terrain.js');
  const terrainData=JSON.parse(html.match(/^const terrainData=(.+);$/m)[1]);
  const terrain=createNeighborhoodTerrain(null,terrainData);
  const {width,height,bounds,spacing}=terrainData;
  assert.equal(width*spacing,bounds[2]-bounds[0]);
  assert.equal(height*spacing,bounds[3]-bounds[1]);
  assert(terrain.range[1]-terrain.range[0]>11.9);
  const parcels=data.parcels.filter(p=>/^775\/19[0-3]$/.test(p.number));
  const measured=new Set();
  assert.equal(parcels.length,4);
  for(const p of parcels) for(const [ring] of p.polygons) {
    const center=ring.reduce(([x,y],[a,b])=>[x+a/ring.length,y+b/ring.length],[0,0]);
    for(const [i,a] of ring.slice(0,-1).entries()) for(let j=0;j<=8;j++){
      const t=j/8,b=ring[i+1],x=a[0]*(1-t)+b[0]*t,y=a[1]*(1-t)+b[1]*t;
      assert.equal(terrain.z(x,y),0,p.number);
      assert.equal(terrain.z((center[0]+x)/2,(center[1]+y)/2),0,p.number);
      measured.add(terrain.elevation(x,y).toFixed(1));
    }
  }
  assert(measured.size>3);
  const {layout}=JSON.parse(html.match(/^const futureInputs=(.+);$/m)[1]);
  for(const h of layout.homes) for(const [x,y] of h.fullEnvelope)
    assert(Math.abs(terrain.z(x,y)-terrain.padZ(h.parcel))<.001,h.parcel);
  assert(layout.homes.some(h=>terrain.padZ(h.parcel)<-1));
});

test('29 garages share a shell, while the house on 775/192 keeps its garage wing', () => {
  const {homes}=JSON.parse(html.match(/^const futureInputs=(.+);$/m)[1]).layout;
  assert.equal(homes.filter(h=>h.garage?.integration==='integral').length,29);
  assert.equal(homes.filter(h=>h.garage?.integration==='wing').length,20);
  assert.equal(homes.find(h=>h.parcel==='775/192').garage.integration,'wing');
  const roads=JSON.parse(html.match(/^const roadData=(.+);$/m)[1]);
  assert.deepEqual(roads.connected.map(r=>r.id).sort(),['south','west']);
  assert(roads.connected.every(r=>r.capContactM>9.9 && r.widthM>4 && r.lengthM>12));
  assert.equal(roads.deadEnds.length,2);
});
