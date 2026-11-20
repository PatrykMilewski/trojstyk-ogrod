import assert from 'node:assert/strict';
import {test} from 'node:test';
import clipping from 'polygon-clipping';
import {checkWoodyPlanting} from './check-woody-beds.mjs';

const ids = ['190', '191', '193'];
const ring = (x, width) => [[x, 0], [x + width, 0], [x + width, 10], [x, 10], [x, 0]];
const parcels = Object.fromEntries(ids.map((id, i) => [id, {coordinates: [ring(10 * i, 10)]}]));
const model = [{variants: [{}]}, {polygons: []}, null, {
  parcels, layouts: {}, surfaces: [], gardenAdditions: {polygons: []},
}];

function verify(widths, duplicate = false) {
  const plan = {parcels: ids.map((id, i) => {
    const bed = {ring: ring(i * 10, widths[i]), holes: []};
    return {id, beds: duplicate ? [bed, bed] : [bed], areaM2: 100, plantedAreaM2: widths[i] * 10};
  })};
  checkWoodyPlanting(plan, model, {minimumPercent: 30});
}

test('exactly 30% on every parcel passes', () => verify([3, 3, 3]));
test('extra planting on another parcel cannot cover a shortfall', () => {
  assert.throws(() => verify([4, 2, 3]), /Below 30% on \/191/);
});
test('overlapping beds cannot be credited twice', () => {
  assert.throws(() => verify([3, 3, 3], true), /Area mismatch/);
});

test('each mapped bed contains rendered shrubs within its ground footprint', async (t) => {
  const {readFile} = await import('node:fs/promises');
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const html = await read('../trzy-domy-3d/index.html');
  const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
  const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const three = Buffer.from(imports.three.split(',')[1], 'base64').toString();
  const THREE = await load(three.replaceAll("'three/core'", `'${imports['three/core']}'`));
  const {createWoodyBeds} = await load(await read('../src/model/woody-beds.js'));
  const {createGardenPlantings,surfaceClearance} = await load(await read('../src/model/garden-plantings.js'));
  const {woodyRandom} = await load(await read('../src/model/tree-realism.js'));
  const {parcels} = JSON.parse(await read('../trzy-domy-3d/woodland-plan.json'));
  const {wastewaterServiceAccess193}=await load(await read('../src/model/wastewater.js'));
  const {rainServiceAccess193}=await load(await read('../src/model/rain-services.js'));
  const {iconPlanPoint}=await load(await read('../src/model/roof-windows.js'));
  const marker='const [source,garden,house,neighbors]=';
  const [,garden,house]=JSON.parse(html.slice(html.indexOf(marker)+marker.length,html.indexOf(';\nconst landscaping=')));
  const serviceAccess=[...wastewaterServiceAccess193(),...rainServiceAccess193(house,iconPlanPoint)];
  // GEOS and Three.js evaluate the same shared bed/clearance edges at different floating-point precision.
  const stableRing=ring=>ring.map(p=>p.map(v=>Math.round(v*1e8)/1e8));
  for(const bed of parcels.find(p=>p.id==='193').beds)for(const access of serviceAccess){
    const overlap=clipping.intersection([bed.ring,...bed.holes].map(stableRing),[stableRing(access.ring)]);
    for(const polygon of overlap)for(const ring of polygon){
      const [ox,oy]=ring[0];
      const twiceArea=ring.slice(1).reduce((sum,[x,y],i)=>
        sum+(ring[i][0]-ox)*(y-oy)-(x-ox)*(ring[i][1]-oy),0);
      assert(Math.abs(twiceArea)<1e-7,'service corridor counted as woody planting');
    }
  }
  const canvasContext = new Proxy({}, {get: () => () => {}});
  t.after(() => { delete globalThis.document; });
  globalThis.document = {createElement: () => ({getContext: () => canvasContext})};
  const group = createWoodyBeds(THREE, parcels, {surfaceClearance, woodyRandom, serviceAccess});
  const beds = parcels.flatMap(p => p.beds), occupied = new Set();
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  for (const mesh of group.children.filter(m => m.isInstancedMesh)) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      matrix.decompose(position, orientation, scale);
      const bed = beds.find(b => surfaceClearance(position.x, position.y, b) >= scale.x - 0.00001);
      assert.ok(bed, 'Shrub extends beyond its planted area');
      for(const access of serviceAccess)assert(surfaceClearance(position.x,position.y,access)<-scale.x+.00001,
        'Shrub blocks a service opening or underground system');
      occupied.add(bed);
    }
  }
  assert.equal(occupied.size, beds.length);
  // The hose passes through the original front flower bed as well as the newer woody planting plan.
  const approach=wastewaterServiceAccess193().at(-1);
  const flowers=createGardenPlantings(THREE,garden,serviceAccess,[]);
  const radii={grass:.43,shrub:.39,salvia:.28,coneflower:.28,achillea:.28};
  assert(flowers.children.length>0);
  for(const mesh of flowers.children){
    const radius=radii[mesh.name.slice('garden-'.length)];
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);
      matrix.decompose(position,orientation,scale);
      assert(surfaceClearance(position.x,position.y,approach)<-radius*scale.x,
        'Flower bed obstructs the wastewater service hose');
    }
  }
});
