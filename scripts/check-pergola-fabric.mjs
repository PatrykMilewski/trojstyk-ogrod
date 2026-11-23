import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const load = code => import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const html = await read('../trzy-domy-3d/index.html');
const {imports} = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]);
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString().replaceAll("'three/core'", "'" + imports['three/core'] + "'"));
const moduleSource = await read('../src/model/pergola-fabric.js');
const {createPergolaFabric193} = await load(moduleSource);
const {iconVisiblePick, iconTerracePendants} = await load(await read('../src/model/interior.js') + '\nexport {iconVisiblePick, iconTerracePendants};');
const marker = 'const [source,garden,house,neighbors]=';
const [, , house] = JSON.parse(html.slice(html.indexOf(marker) + marker.length, html.indexOf(';\nconst landscaping=')));
const near = (a, b, tolerance = 1e-5) => assert(Math.abs(a - b) < tolerance, a + ' vs ' + b);

function setup() {
  const scene = new THREE.Scene();
  const model = createPergolaFabric193(THREE, scene, roots => iconVisiblePick({THREE, scene}, roots));
  const cloth = model.group.getObjectByName('pergola-sliding-waterproof-fabric');
  return {scene, model, cloth};
}

test('constant-length cloth stacks by the house, clears the lamp rail and drains when taut', () => {
  const {model, cloth} = setup();
  const pos = cloth.geometry.getAttribute('position');
  const at = i => new THREE.Vector3().fromBufferAttribute(pos, i);
  const edgeLength = () => Array.from({length: pos.count / 2 - 1}, (_, i) => at(i * 2).distanceTo(at(i * 2 + 2))).reduce((sum, length) => sum + length);
  const length = edgeLength(), rails = model.group.getObjectsByProperty('name','pergola-moving-crossbar');
  assert.equal(rails.length, 13);
  assert.equal(cloth.material.side, THREE.DoubleSide);
  assert(cloth.castShadow && cloth.material.bumpMap && !cloth.material.transparent);
  near(at(1).y - at(0).y, 4); near(at(pos.count - 2).x - at(0).x, 6); near(at(pos.count - 2).z, 3.17); near(at(0).z, 3.17 + 6 * Math.tan(Math.PI / 120));
  for (let i = 0; i < pos.count - 2; i += 2) {
    const a = at(i), b = at(i + 2);
    near((a.z - b.z) / (b.x - a.x), Math.tan(Math.PI / 120));
    near(a.z, at(i + 1).z);
  }
  for (const state of [false, true, false]) {
    model.setDeployed(state);
    const bounds = cloth.geometry.boundingBox;
    near(bounds.min.x, 8.68); near(bounds.max.x - bounds.min.x, state ? 6 : .78);
    near(edgeLength(), length, .00002);
    assert(bounds.min.z > 2.86 && bounds.min.x > 8.50);
    for (let i = 0; i < rails.length; i++) {
      near(rails[i].position.x, at(i * 6).x);
      near(rails[i].position.z + .023, at(i * 6).z);
    }
  }
});

test('the cloth and every carrier clear the existing pendant rail, lamps and gutter lips throughout travel', () => {
  const group = new THREE.Group(), metal = new THREE.MeshStandardMaterial();
  function box(name, [x0,y0,x1,y1], z, height, material) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(x1-x0, y1-y0, height), material);
    part.position.set((x0+x1)/2, (y0+y1)/2, z+height/2);
    part.name = name; group.add(part); return part;
  }
  iconTerracePendants({THREE,group,box,mats:{metal}}, metal);
  const lamps = new THREE.Box3().setFromObject(group, true), top = lamps.max.z;
  near(top, 2.86);
  // Even a vertical half bay hung at the lowest carrier stays above the fixtures.
  assert(3.17 - Math.hypot(6 / 12, (6 / 12) * Math.tan(Math.PI / 120)) / 2 > top + .05);
  const animated = createPergolaFabric193(THREE, new THREE.Scene(), () => () => true);
  const fabric = animated.group.getObjectByName('pergola-sliding-waterproof-fabric');
  const bars = animated.group.getObjectsByProperty('name','pergola-moving-crossbar');
  const lips = animated.group.children.filter(o => o.name === 'pergola-gutter-lip' || o.name === 'pergola-gutter-end');
  const obstacles = lips.map(o => new THREE.Box3().setFromObject(o, true));
  const gripParts = animated.group.getObjectByName('pergola-manual-pull').children;
  animated.toggleAt();
  const start = performance.now();
  for (let frame = 0; frame <= 240; frame++) {
    animated.update(start + frame * 5);
    assert(fabric.geometry.boundingBox.min.z > top + .16);
    const geometry = fabric.geometry, pos = geometry.getAttribute('position');
    for (const lip of obstacles.filter(lip => lip.intersectsBox(geometry.boundingBox))) {
      for (let i = 0; i < geometry.index.count; i += 3) {
        const tri = new THREE.Triangle(...[i, i + 1, i + 2].map(j => new THREE.Vector3().fromBufferAttribute(pos, geometry.index.getX(j))));
        assert(!lip.intersectsTriangle(tri), 'A cloth fold enters the gutter lip');
      }
    }
    for (const part of gripParts) {
      const bounds = new THREE.Box3().setFromObject(part, true);
      assert(!bounds.intersectsBox(lamps) && obstacles.every(lip => !lip.intersectsBox(bounds)));
    }
    for (const carrier of bars) {
      const bounds = new THREE.Box3().setFromObject(carrier, true);
      assert(bounds.min.z > top && obstacles.every(lip => !lip.intersectsBox(bounds)));
    }
  }
});

test('the built frame supports both guides, the outer gutter and the downpipe stay alongside the retained post', () => {
  const {scene, model, cloth} = setup(), {matrix, translation, dimensions} = house.metadata;
  const local = ([x, y, z]) => {
    const east = x - translation[0], north = y - translation[1];
    return new THREE.Vector3(dimensions.width - east * matrix[0][0] - north * matrix[1][0],
      east * matrix[0][1] + north * matrix[1][1], z);
  };
  const fixed = name => new THREE.Box3().setFromPoints(house.meshes.filter(m => m.id.startsWith('terrace-pergola-' + name + '-')).flatMap(m => m.vertices.map(local)));
  const front = fixed('frame-front'), rear = fixed('frame-rear'), side = fixed('frame-side'), post = fixed('post');
  const pipe = model.group.getObjectByName('pergola-post-downpipe');
  const parts = model.group.children.filter(o => o.name === 'pergola-guide-bracket');
  for (const part of parts) {
    const box = new THREE.Box3().setFromObject(part, true), beam = part.position.y < 15 ? front : rear;
    near(box.min.z, beam.max.z);
    assert(box.min.y >= beam.min.y && box.max.y <= beam.max.y);
  }
  const box = new THREE.Box3().setFromObject(pipe, true);
  for (const existing of [front, rear, side, post]) assert(!box.intersectsBox(existing), 'Downpipe crosses fixed frame');
  assert(box.max.y < post.min.y && post.min.y - box.max.y < .03);
  const gutter = model.group.getObjectByName('pergola-gutter-outlet'), capture = new THREE.Box3().setFromObject(gutter, true);
  const pos = cloth.geometry.getAttribute('position'), hem = new THREE.Vector3().fromBufferAttribute(pos, pos.count - 1);
  const frontHem = new THREE.Vector3().fromBufferAttribute(pos, pos.count - 2);
  assert(hem.x > capture.min.x && hem.x < capture.max.x && hem.z > capture.max.z);
  assert(frontHem.y > capture.min.y && hem.y < capture.max.y, 'Gutter captures the full four-metre hem');
  const moving = model.group.getObjectsByProperty('name','pergola-moving-crossbar').at(-1);
  const bar = new THREE.Box3().setFromObject(moving, true);
  for (const lip of model.group.children.filter(o => o.name === 'pergola-gutter-lip'))
    assert(!bar.intersectsBox(new THREE.Box3().setFromObject(lip, true)), 'Moving edge strikes the gutter');
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(pipe.position.x, pipe.position.y, 3.25), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(gutter).length, 0, 'Gutter outlet must be open above the downpipe');
  ray.ray.origin.y -= .12; assert(ray.intersectObject(gutter).length > 0, 'Gutter floor collects water next to outlet');
  const points = gutter.geometry.getAttribute('position');
  for (let i = 0; i < points.count; i += 3) {
    const triangle = new THREE.Triangle(...[i,i+1,i+2].map(j => new THREE.Vector3().fromBufferAttribute(points, j)));
    const middle = triangle.getMidpoint(new THREE.Vector3()), normal = triangle.getNormal(new THREE.Vector3());
    assert(normal.z > 0);
    near(normal.x / normal.z, -Math.sign(middle.x - pipe.position.x) * .01, .00003);
    near(normal.y / normal.z, -Math.sign(middle.y - pipe.position.y) * .005, .00003);
  }
  const obstructions = model.group.getObjectsByProperty('isMesh',true).filter(o => o !== cloth && o !== moving);
  ray.ray.origin.set(pipe.position.x, pipe.position.y, capture.max.z + .001);
  assert.equal(ray.intersectObjects(obstructions).length, 0, 'Clear drain bore from the gutter through the deck');
});

test('both wall flashings carry runoff over the cloth and their drip edges clear its moving parts', () => {
  const {scene, model, cloth} = setup();
  scene.updateMatrixWorld(true);
  const inspect = (name, axis, wall, clothEdge) => {
    const mesh = model.group.getObjectByName(name), pos = mesh.geometry.getAttribute('position');
    for (const offset of [0, 4]) {
      const [upstand, wallBend, outerBend, drip] = Array.from({length: 4}, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, offset + i));
      assert(Math.abs(upstand[axis] - wall) < .005 && upstand.z > wallBend.z);
      assert(wallBend[axis] < outerBend[axis] && wallBend.z > outerBend.z && outerBend.z > drip.z);
      assert(drip[axis] - clothEdge > .05 && drip[axis] - clothEdge < .09);
    }
    return mesh;
  };
  const head = inspect('pergola-slider-head-flashing', 'x', 8.5, 8.68);
  const side = inspect('pergola-side-wall-flashing', 'y', 12.71, 12.89);
  const ray = new THREE.Raycaster();
  const level = (mesh, x, y) => {
    ray.set(new THREE.Vector3(x, y, 5), new THREE.Vector3(0, 0, -1));
    return ray.intersectObject(mesh)[0].point.z;
  };
  assert(level(head, 8.70, 12.8) > level(side, 8.70, 12.8));
  // Runoff leaving the head lands on either the side flashing or the extended fabric.
  for (let y = 12.72; y < 16.89; y += .05) {
    const receiver = y < 12.945 ? side : cloth;
    assert(level(head, 8.749, y) > level(receiver, 8.75, y));
  }
  for (let x = 8.75; x < 14.64; x += .05) {
    assert(level(side, x, 12.944) > level(cloth, x, 12.945));
  }
  const hardware = ['pergola-moving-crossbar', 'pergola-fabric-guide'].flatMap(name => model.group.getObjectsByProperty('name',name));
  for (const state of [true, false]) {
    model.setDeployed(state); scene.updateMatrixWorld(true);
    for (const moving of hardware) {
      const b = new THREE.Box3().setFromObject(moving, true), x = Math.max(8.51, Math.min(14.63, b.getCenter(new THREE.Vector3()).x));
      if (b.min.y < 12.945 && b.min.x < 14.64) {
        const y = (Math.max(12.715, b.min.y) + Math.min(12.944, b.max.y)) / 2;
        assert(level(side, x, y) > level(moving, x, y) + .015);
      }
    }
    const belowHead = level(cloth, 8.749, 15);
    assert(level(head, 8.749, 15) - .020 > belowHead);
  }
});

test('the downpipe continues below the deck and reaches the sloping east rainwater collector upstream of the filter', async () => {
  const {rainHydraulics193, createRainServices, createRainSurface} = await load(await read('../src/model/rain-services.js'));
  const {pergola, east, eastTrunk, eastIn} = rainHydraulics193(), {model} = setup();
  const pipe = model.group.getObjectByName('pergola-post-downpipe');
  const data = JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
  const rain = createRainServices(THREE, house, {group: model.group}, data);
  const facade = createRainSurface(THREE, house, {group: model.group});
  const bounds = o => new THREE.Box3().setFromObject(o, true);
  const roofGutters = facade.children.filter(o => /^rain-(gutter|outlet-socket)-[67]$/.test(o.name) || o.name === 'rain-outlet-socket-3');
  for (const sheet of model.group.children.filter(o => o.name.endsWith('flashing'))) {
    const enclosure = bounds(sheet);
    for (const gutter of roofGutters) {
      const vertices = gutter.geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i += 3) {
        const tri = new THREE.Triangle(...[i, i + 1, i + 2].map(v => new THREE.Vector3().fromBufferAttribute(vertices, v)));
        assert(!enclosure.intersectsTriangle(tri), sheet.name + ' intersects ' + gutter.name);
      }
    }
  }
  const box = bounds(pipe);
  near(pipe.position.x, pergola[0][0]); near(pipe.position.y, pergola[0][1]); near(box.min.z, pergola[0][2]);
  for (const [index, point] of pergola.slice(1).entries()) {
    const previous = pergola[index], length = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    const segment = rain.getObjectByName('rain-pergola-collector-' + (index + 1));
    const half = segment.geometry.parameters.height / 2;
    for (const [dist, expected] of [[-half, previous], [half, point]]) {
      const actual = segment.localToWorld(new THREE.Vector3(0, dist, 0));
      near(actual.distanceTo(new THREE.Vector3(...expected)), 0);
    }
    assert(point[2] < previous[2]);
    if (length) near((previous[2] - point[2]) / length, .018);
  }
  const [a, b] = east[1].slice(1, 3), mouth = pergola.at(-1), t = (mouth[0] - a[0]) / (b[0] - a[0]);
  assert(t > 0 && t < 1); near(mouth[1], a[1]); near(mouth[2], a[2] + (b[2] - a[2]) * t);
  assert.deepEqual(east[1].at(-1), eastTrunk[0]); assert.deepEqual(eastTrunk.at(-1), eastIn);
  assert(eastIn[2] < mouth[2]);
});

test('the hand grip travels with the leading bar, responds in both positions and respects occlusion', () => {
  const {scene, model, cloth} = setup(), camera = new THREE.PerspectiveCamera(50, 1, .02, 50);
  const grip = model.group.getObjectByName('pergola-pull-grip'), center = new THREE.Vector2(0, 0);
  function aimAtGrip() {
    const at = grip.getWorldPosition(new THREE.Vector3());
    camera.up.set(0, 0, 1); camera.position.copy(at).add(new THREE.Vector3(-2, 0, 0)); camera.lookAt(at);
    return at;
  }
  const extended = aimAtGrip();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(.1, .4, .6), new THREE.MeshStandardMaterial());
  wall.position.copy(extended).x -= .7; scene.add(wall);
  assert.equal(model.toggleAt(center, camera), false);
  wall.visible = false;
  assert(model.toggleAt(center, camera)); assert.equal(model.deployed, false);
  model.update(performance.now() + 600);
  assert(cloth.geometry.boundingBox.max.x > 10 && cloth.geometry.boundingBox.max.x < 13);
  model.update(performance.now() + 1300); near(cloth.geometry.boundingBox.max.x, 9.46);
  near(extended.x - aimAtGrip().x, 6 - .78);
  assert(model.toggleAt(center, camera)); model.update(performance.now() + 1300);
  near(cloth.geometry.boundingBox.max.x, 14.68); assert.equal(model.deployed, true);
  assert.equal(model.update(performance.now() + 1400), false);
});

test('winter removal stops travel, removes all removable parts, and reinstalls them parked', () => {
  const {model} = setup(), all = () => {
    const visible = new Set();
    model.group.traverseVisible(object => visible.add(object.name));
    return visible;
  };
  const removable = ['pergola-manual-pull', 'pergola-moving-crossbar', 'pergola-sliding-waterproof-fabric'];
  const fixed = ['pergola-fabric-guide', 'pergola-gutter-outlet', 'pergola-post-downpipe'];
  for (const name of removable) assert(all().has(name));
  const camera = new THREE.PerspectiveCamera(50, 1, .02, 50), center = new THREE.Vector2();
  camera.up.set(0,0,1); camera.position.set(13,14,1); camera.lookAt(13,14,3.2);
  assert(model.toggleAt(center, camera)); model.update(performance.now()+200);
  model.setInstalled(false);
  for (const name of fixed) assert(all().has(name));
  for (const name of removable) assert(!all().has(name));
  assert(!model.installed && !model.deployed && !model.toggleAt(center, camera));
  assert.equal(model.update(performance.now()+2000), false);
  model.setDeployed(true); assert(!model.deployed);
  model.setInstalled(true);
  assert(model.installed && !model.deployed);
  for (const name of removable) assert(all().has(name));
  near(model.group.getObjectByName('pergola-sliding-waterproof-fabric').geometry.boundingBox.max.x, 9.46);
  model.setDeployed(true); assert(model.deployed);
});

test('the published scene carries the interactive model and the retained frame without the old louvres', () => {
  assert(html.includes(moduleSource.replaceAll('export ', '')));
  assert(html.includes('pergolaFabric.toggleAt(') && html.includes('pergolaFabric?.update('));
  assert(html.includes('id="pergola-season"') && html.includes('shade.setInstalled(!shade.installed)'));
  assert.equal(house.meshes.filter(m => m.kind === 'pergola-louver').length, 0);
  const fixed = house.meshes.filter(m => /^terrace-pergola-(frame-|post-)/.test(m.id));
  assert.equal(fixed.length, 30);
  assert(fixed.every(m => m.material === 'pergolaFrame'));
  const {model} = setup();
  model.group.traverse(part => {
    if (part.isMesh) assert(Math.max(...part.material.color.toArray()) < .04, part.name + ' has a light finish');
  });
});
