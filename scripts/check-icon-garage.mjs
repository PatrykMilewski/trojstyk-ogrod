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
const { createWalkCollision, createWalkMotion, mergeInteriorNavigation } = await load(await read('../src/model/walk.js'));
const { addIconInterior } = await load(await read('../src/model/interior.js'));
const data = JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const marker = 'const [source,garden,house,neighbors]=';
const [, , house] = JSON.parse(html.slice(html.indexOf(marker) + marker.length, html.indexOf(';\nconst landscaping=')));
const fittings = [], obstacles = [];
const { group, navigation, garageDoor } = addIconInterior({
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
    for (const obs of obstacles) {
      const bounds = new THREE.Box3().setFromPoints(obs.ring.flatMap(([wx,wy]) => [obs.minZ,obs.maxZ].map(z => new THREE.Vector3(wx,wy,z).applyMatrix4(local))));
      assert(!use.intersectsBox(bounds), obs.id + ' collision overlaps a bay');
    }
  }
  assert(navigation.obstacles.some(o => o.id === 'garage-workbench'));
  assert.equal(group.children.filter(o => o.isGroup && ['garage-tourer','garage-hybrid'].includes(o.name)).length, 2);
  assert(html.includes(moduleSource.replaceAll('export ', '')) && html.includes('fitGarage:addIconGarage'));
});


test('left garage bay contains a white 2018 Astra K hatchback to scale', () => {
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
  assert.equal(group.children.filter(o=>o.userData.kind==='garage-vehicle').length,2);
});


test('the right bay fits the black 2024 Audi A5 Avant with its mirrors extended', () => {
  const spec=data.garageFitout.vehicles[1];
  const audi=group.getObjectByName(spec.id),car=audi.clone();
  car.position.set(0,0,0);car.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(car,true),size=bounds.getSize(new THREE.Vector3());
  const near=(a,b,tolerance=.0001)=>assert(Math.abs(a-b)<tolerance,`${a} vs ${b}`);
  near(size.x,2.099);near(size.y,4.829,.002);near(size.z,1.460,.0005);
  const shell=car.getObjectByName('audi-sculpted-body');
  near(new THREE.Box3().setFromObject(shell,true).getSize(new THREE.Vector3()).x,1.860);
  assert.equal(shell.material.name,'Mythos Black metallic');
  assert.equal(shell.material.color.getHexString(),'212429');
  const wheels=car.children.filter(o=>o.name==='audi-tyre');
  assert.equal(wheels.length,4);
  const axles=[...new Set(wheels.map(o=>o.position.y))];
  near(axles[1]-axles[0],2.892);near(axles[0]-bounds.min.y,.908,.002);
  assert.equal(car.children.filter(o=>o.name==='audi-emblem-ring').length,8);
  for(const feature of ['audi-hatch-glass','audi-avant-roof','audi-singleframe','audi-rear-light-strip'])
    assert(car.getObjectByName(feature));
  const [left,front,right,rear]=data.garageFitout.parkingBays[1];
  const [cx,cy,cz]=audi.position.toArray();near(cz,.008);
  assert(cx+bounds.min.x>left && cx+bounds.max.x<right && cy+bounds.min.y>front && cy+bounds.max.y<rear);
  const astra=group.getObjectByName(data.garageFitout.vehicles[0].id);
  assert(cx+bounds.min.x-astra.position.x-astra.userData.mirrorWidth/2>.42);
});

test('walk across both car bodies and mirrors with the cabinet and garage door still solid', () => {
  const world=(x,y)=>new THREE.Vector3(x,y,0).applyMatrix4(group.matrix).toArray();
  function route(from,to){
    const a=world(...from),b=world(...to),walk=createWalkMotion(createWalkCollision([]),navigation);
    walk.reset(a);const dx=b[0]-a[0],dy=b[1]-a[1];
    const [x,y]=walk.move(1,0,Math.hypot(dx,dy)/2.2,Math.atan2(dx,dy));
    return Math.hypot(x-b[0],y-b[1]);
  }
  for(const y of [2.36,3.09])assert(route([1.37,y],[6.08,y])<.001);
  assert(route([3.60,5.40],[3.60,6.35])>.50);
  assert(route([4.81,.82],[4.81,-.40])>.50);
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

test('the sectional door follows both curved rails and clears the entrance in the live merged walkthrough', () => {
  const world=(x,y,z=0)=>new THREE.Vector3(x,y,z).applyMatrix4(group.matrix);
  function cameraAt(eye,target){
    const camera=new THREE.PerspectiveCamera(55,1,.01,100);
    camera.up.set(0,0,1);camera.position.copy(world(...eye));camera.lookAt(world(...target));camera.updateMatrixWorld();
    return camera;
  }
  const merged=mergeInteriorNavigation([{parcel:'193',navigation}]);
  function route(x,start,end){
    const a=world(x,start),b=world(x,end),walk=createWalkMotion(createWalkCollision([]),merged);
    walk.reset(a.toArray());
    const dx=b.x-a.x,dy=b.y-a.y;
    const [px,py]=walk.move(1,0,Math.hypot(dx,dy)/2.2,Math.atan2(dx,dy));
    return Math.hypot(px-b.x,py-b.y);
  }
  function throughOpening(){
    const a=world(3.5,-.80,1.65),b=world(3.5,1.18,1.65);
    const ray=new THREE.Raycaster(a,b.clone().sub(a).normalize(),0,a.distanceTo(b));
    group.updateWorldMatrix(true,true);
    return ray.intersectObject(group,true).filter(({object})=>object.visible&&object.isMesh);
  }
  const sections=group.children.filter(o=>o.name.startsWith('garage-door-section-'));
  assert.equal(sections.length,6);
  assert.equal(group.children.filter(o=>o.name==='garage-door-track-hanger').length,4);
  for(const section of sections)assert(Math.abs(section.rotation.x)<1e-7);
  assert(throughOpening().some(({object})=>object.name==='garage-door-insulated-panel'));
  assert(route(3.5,-.75,1.35)>.70);
  const seals=group.children.filter(o=>/^garage-door-(jamb|header)-seal$/.test(o.name));
  assert.equal(seals.length,3);
  for(const seal of seals){
    const box=new THREE.Box3().setFromObject(seal.clone());
    assert(box.min.y<=.5&&box.max.y>=.575-.023,'rubber crosses the recess to the closed door skin');
    if(seal.name.includes('jamb')){
      assert(box.min.z<=.001&&box.max.z>=2.349);
      assert([1.06,6.06].some(x=>box.min.x<=x&&box.max.x>=x));
    }else{
      assert(box.min.x<=1.06&&box.max.x>=6.06&&box.min.z<2.35&&box.max.z>2.35);
    }
  }
  const ndc=new THREE.Vector2();
  const outside=cameraAt([3.5,-2,1.55],[3.5,.575,1.20]);
  assert(garageDoor.toggleAt(ndc,outside));
  garageDoor.update(performance.now()+1250);
  assert(sections.some(o=>o.rotation.x<-.02&&o.rotation.x>Math.PI/(-2)+.02));
  assert(sections.some(o=>o.rotation.x<Math.PI/(-2)+.001));
  assert(sections.some(o=>Math.abs(o.rotation.x)<.001));
  const inside=cameraAt([3.5,1.12,1.65],[3.5,.575,1.65]);
  assert(garageDoor.toggleAt(ndc,inside),'clicking a moving section inside reverses the motor');
  const before=garageDoor.openFraction;
  garageDoor.update(performance.now()+275);
  assert(garageDoor.openFraction<before);
  assert(garageDoor.toggleAt(ndc,outside));
  garageDoor.update(performance.now()+5000);
  assert.equal(garageDoor.openFraction,1);
  for(const section of sections){
    assert(Math.abs(section.rotation.x+Math.PI/2)<1e-6);
    assert(section.position.y>.65&&section.position.z>2.5&&section.position.z<data.levels.groundCeiling-.04);
  }
  assert.deepEqual(throughOpening().map(({object})=>object.name),[],'No stationary facade or leaf remains across the open portal');
  for(const x of [1.54,3.5,5.59]){
    assert(route(x,-.8,1.4)<.001);
    assert(route(x,1.4,-.8)<.001);
  }
  const openUnderside=cameraAt([3.5,.96,1.60],[3.5,1.35,2.65]);
  assert(garageDoor.toggleAt(ndc,openUnderside),'clicking a section overhead closes it');
  garageDoor.update(performance.now()+5000);
  assert.equal(garageDoor.openFraction,0);
  const outsideSwitch=cameraAt([.89,-1.5,1.17],[.89,-.03,1.17]);
  assert(garageDoor.toggleAt(ndc,outsideSwitch));
  garageDoor.update(performance.now()+5000);
  assert(garageDoor.toggleAt(ndc,outsideSwitch),'the exterior switch remains reachable when open');
  const walker=cameraAt([3.5,.58,1.70],[3.5,1.5,1.70]);
  garageDoor.update(performance.now()+5000,walker);
  garageDoor.update(performance.now()+9000,walker);
  assert.equal(garageDoor.openFraction,1,'a pedestrian in the closing path reopens the door');
  assert(garageDoor.toggleAt(ndc,outsideSwitch));
  const upstairs=cameraAt([3.5,.58,data.levels.upper+1.70],[3.5,1.5,data.levels.upper+1.70]);
  garageDoor.update(performance.now()+5000,upstairs);
  assert.equal(garageDoor.openFraction,0,'a walker upstairs does not trip the ground-floor sensor');
  assert(route(3.5,-.75,1.35)>.70);
});

test('the full garage threshold has a mineral finish up to the driveway', () => {
  const facade=data.facades.find(f=>f.id==='facade-garage'),door=facade.openings[0];
  const oak=group.getObjectByName('ground-floor'),tile=group.getObjectByName('finish-0.1');
  const sill=group.getObjectByName('garage-threshold');
  const down=new THREE.Vector3(0,0,-1);
  group.updateMatrixWorld(true);
  assert.equal(sill.material,tile.material);
  for(const x of [door.start+.01,(door.start+door.end)/2,door.end-.01]){
    for(const y of [.001,facade.thickness/2,facade.thickness-.001,facade.thickness+.001]){
      const origin=new THREE.Vector3(x,y,.15).applyMatrix4(group.matrix);
      const ray=new THREE.Raycaster(origin,down,0,.25);
      const first=ray.intersectObjects([oak,sill,tile],false)[0];
      assert.equal(first?.object,y<facade.thickness?sill:tile);
      assert(Math.abs(first.distance-.142)<1e-5);
      if(y<facade.thickness)assert.equal(ray.intersectObject(oak).length,0);
    }
  }
  assert.equal(group.getObjectByName('facade-garage-opening-0-frame-0'),undefined);
});
