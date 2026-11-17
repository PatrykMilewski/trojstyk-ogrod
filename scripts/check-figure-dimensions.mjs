import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const load = source => import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const html = await read('../trzy-domy-3d/index.html');
const {imports} = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]);
const THREE = await load(Buffer.from(imports.three.split(',')[1],'base64').toString().replaceAll("'three/core'", "'"+imports['three/core']+"'"));
const registry = JSON.parse(await read('../trzy-domy-3d/model-dimensions.json'));
const [, , , neighbors] = JSON.parse(html.split('const [source,garden,house,neighbors]=')[1].split(';\nconst landscaping=')[0]);
const {addCars} = await load(await read('../src/model/cars.js'));
const {addPeopleAndDogs} = await load(await read('../src/model/people-dogs.js'));

test('vehicles and figures keep their previous local envelopes and site placements', () => {
  const scene = new THREE.Scene();
  addCars({THREE,scene,placements:neighbors.cars,dimensionsByKind:neighbors.vehicleTypes});
  addPeopleAndDogs({THREE,scene,placements:neighbors.figurePlacements});
  for (const entity of [...registry.people,...registry.dogs,...registry.cars]) {
    const group = scene.getObjectByName(entity.id);
    assert(group, entity.id);
    assert.deepEqual(group.position.toArray(), entity.groundPosition, entity.id+' placement');
    assert.equal(group.rotation.z, entity.rotationRad ?? entity.angleRad, entity.id+' heading');
    group.position.set(0,0,0);
    group.quaternion.identity();
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group,true);
    const expected = entity.boundsLocalM ?? entity.measuredLocalBounds;
    for (const side of ['min','max']) for (const [i,value] of bounds[side].toArray().entries()) {
      assert(Math.abs(value-expected[side][i])<1e-5, entity.id+' '+side+' axis '+i);
    }
  }
});
