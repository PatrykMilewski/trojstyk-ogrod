import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const html = await read('../trzy-domy-3d/index.html');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8')
  .replaceAll("'three/core'", "'" + imports['three/core'] + "'"));
const moduleSource = await read('../src/model/icon-garage.js');
const { addIconGarage } = await load(moduleSource);
const { addIconInterior } = await load(await read('../src/model/interior.js'));
const data = JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const marker = 'const [source,garden,house,neighbors]=';
const [, , house] = JSON.parse(html.slice(html.indexOf(marker) + marker.length, html.indexOf(';\nconst landscaping=')));
const fittings = [], obstacles = [];
const { group, navigation } = addIconInterior({
  THREE, scene: new THREE.Scene(), house, data, fitGarage(context) {
    const count = context.group.children.length, initial = context.navigation.obstacles.length;
    addIconGarage(context);
    fittings.push(...context.group.children.slice(count));
    obstacles.push(...context.navigation.obstacles.slice(initial));
  },
});

test('installed garage fittings leave two complete adjacent 2.50 × 5.00 m bays aligned with the door', () => {
  const { parkingBays } = data.garageFitout;
  assert.equal(parkingBays.length, 2);
  const door = data.facades.find(f => f.id === 'facade-garage').openings[0];
  assert.equal(parkingBays[0][0], door.start);
  assert.equal(parkingBays[0][2], parkingBays[1][0]);
  assert.equal(parkingBays[1][2], door.end);
  const local = group.matrix.clone().invert();
  const near = (a,b) => Math.abs(a-b) < 1e-5;
  const fitBoxes = fittings.filter(o => !o.isLight).map(o => new THREE.Box3().setFromObject(o.clone(), true));
  for (const [x, y, right, back] of parkingBays) {
    assert(near(right-x, 2.5) && near(back-y, 5));
    const use = new THREE.Box3(new THREE.Vector3(x, .06, .03), new THREE.Vector3(right, back, 2.08));
    for (const box of fitBoxes) assert(!use.intersectsBox(box), 'Installed fitting projects into the parking or approach volume');
    for (const obs of obstacles) {
      const bounds = new THREE.Box3().setFromPoints(obs.ring.flatMap(([wx,wy]) => [obs.minZ,obs.maxZ].map(z => new THREE.Vector3(wx,wy,z).applyMatrix4(local))));
      assert(!use.intersectsBox(bounds), obs.id + ' collision overlaps a bay');
    }
  }
  assert(navigation.obstacles.some(o => o.id === 'garage-workbench'));
  assert.equal(group.children.filter(o => o.isGroup && o.name.startsWith('garage-')).length, 2);
  assert(html.includes(moduleSource.replaceAll('export ', '')) && html.includes('fitGarage:addIconGarage'));
});
