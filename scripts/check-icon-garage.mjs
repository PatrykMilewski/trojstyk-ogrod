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

test('fixed garage fittings leave two complete adjacent 2.50 × 5.00 m bays aligned with the door', () => {
  const { parkingBays } = data.garageFitout;
  assert.equal(parkingBays.length, 2);
  const door = data.facades.find(f => f.id === 'facade-garage').openings[0];
  assert.equal(parkingBays[0][0], door.start);
  assert.equal(parkingBays[0][2], parkingBays[1][0]);
  assert.equal(parkingBays[1][2], door.end);
  const local = group.matrix.clone().invert();
  const near = (a,b) => Math.abs(a-b) < 1e-5;
  const fitBoxes = fittings.filter(o => !o.isLight && o.userData.kind !== 'garage-vehicle').map(o => new THREE.Box3().setFromObject(o.clone(), true));
  for (const [x, y, right, back] of parkingBays) {
    assert(near(right-x, 2.5) && near(back-y, 5));
    const use = new THREE.Box3(new THREE.Vector3(x, .06, .03), new THREE.Vector3(right, back, 2.08));
    for (const box of fitBoxes) assert(!use.intersectsBox(box), 'Installed fitting projects into the parking or approach volume');
    for (const obs of obstacles.filter(o => !o.id.startsWith('garage-opel-astra'))) {
      const bounds = new THREE.Box3().setFromPoints(obs.ring.flatMap(([wx,wy]) => [obs.minZ,obs.maxZ].map(z => new THREE.Vector3(wx,wy,z).applyMatrix4(local))));
      assert(!use.intersectsBox(bounds), obs.id + ' collision overlaps a bay');
    }
  }
  assert(navigation.obstacles.some(o => o.id === 'garage-workbench'));
  assert.equal(group.children.filter(o => o.isGroup && ['garage-tourer','garage-hybrid'].includes(o.name)).length, 2);
  assert(html.includes(moduleSource.replaceAll('export ', '')) && html.includes('fitGarage:addIconGarage'));
});


test('left garage bay contains a white 2018 Astra K hatchback to scale with the right bay free', () => {
  const astra = group.getObjectByName('garage-opel-astra-k-2018'), [left,front,right,rear] = data.garageFitout.parkingBays[0];
  const [cx,cy,cz] = astra.position.toArray(), car = astra.clone();
  car.position.set(0,0,0);car.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(car,true);
  const near = (a,b,tolerance=.0001) => assert(Math.abs(a-b)<tolerance,`${a} vs ${b}`);
  const size = bounds.getSize(new THREE.Vector3());
  near(size.x,2.042);near(size.y,4.370,.002);near(size.z,1.485);
  near(bounds.min.z,0);near(cz,.008);
  const shell = new THREE.Box3().setFromObject(car.getObjectByName('astra-sculpted-body'),true);
  near(shell.max.x-shell.min.x,1.809);
  assert.equal(car.getObjectByName('astra-sculpted-body').material.name,'Astra Olympic White');
  const axles = [...new Set(car.children.filter(o=>o.name==='astra-tyre').map(o=>o.position.y))];
  near(axles[1]-axles[0],2.662);near(axles[0]-bounds.min.y,.960,.002);
  assert(cx+bounds.min.x>left && cx+bounds.max.x<right && cy+bounds.min.y>front && cy+bounds.max.y<rear);
  assert(navigation.obstacles.some(o=>o.id===astra.name));
  assert.equal(group.children.filter(o=>o.userData.kind==='garage-vehicle').length,1);
});


test('both Opel badges expose the chrome ring and Blitz in front of the grille and hatch', () => {
  const car = group.getObjectByName('garage-opel-astra-k-2018').clone();
  car.position.set(0,0,0);car.updateMatrixWorld(true);
  for (const end of [-1,1]) {
    const z=end<0?.64:.83,dir=new THREE.Vector3(0,-end,0);
    const first=(x,h)=>new THREE.Raycaster(new THREE.Vector3(x,end*2.3,z+h),dir,0,.25)
      .intersectObject(car,true)[0]?.object.name;
    let rings=0;
    for (let i=0;i<32;i++) {
      const a=(i+.375)*Math.PI/16;
      const name=first(.045*Math.cos(a),.045*Math.sin(a));
      assert(['astra-opel-ring','astra-opel-blitz'].includes(name),'Badge is obscured by '+name);
      if(name==='astra-opel-ring')rings++;
    }
    assert(rings>=28,'Chrome circle remains visible around the Blitz');
    for(const [x,h] of [[-.052,.007],[-.02,.005],[.02,-.004],[.05,-.004]])
      assert.equal(first(-end*x,h),'astra-opel-blitz');
  }
});
