import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8')
  .replaceAll("'three/core'", `'${imports['three/core']}'`));
const marker = 'const [source,garden,house,neighbors]=';
const start = html.indexOf(marker) + marker.length;
const [, , house] = JSON.parse(html.slice(start, html.indexOf(';\nconst landscaping=', start)));
const { addIconInterior } = await load(await readFile(new URL('../src/model/interior.js', import.meta.url), 'utf8'));
const { createWalkCollision } = await load(await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8'));
const data = JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json', import.meta.url), 'utf8'));
const interior = addIconInterior({ THREE, scene: new THREE.Scene(), house, data });
const furniture = new Map(data.furniture.map(item => [item.id, item]));
const rooms = new Map(data.rooms.map(item => [item.id, item]));
const close = (actual, expected, message, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} vs ${expected}`);
const overlaps = (a, b) => a[0] < b[2] - .001 && a[2] > b[0] + .001 && a[1] < b[3] - .001 && a[3] > b[1] + .001;
const parts = id => interior.group.children.filter(object => object.userData.furnitureId === id);
function bounds(object) {
  assert(object, 'Expected mesh exists'); object.updateMatrix(); object.geometry.computeBoundingBox();
  return object.geometry.boundingBox.clone().applyMatrix4(object.matrix);
}
function itemBounds(id) {
  return parts(id).reduce((result, object) => result.union(bounds(object)), new THREE.Box3());
}
function partCenter(id, suffix) {
  return bounds(interior.group.getObjectByName(id + '-' + suffix)).getCenter(new THREE.Vector3());
}
function facingProjection(item, point) {
  return { '+x': point.x, '-x': -point.x, '+y': point.y, '-y': -point.y }[item.facing];
}

test('every source inventory entry renders inside its room and declared footprint', () => {
  assert.equal(furniture.size, data.furniture.length, 'Unique furniture IDs');
  assert(data.metadata.furnitureCoordinateUncertaintyM >= .15);
  for (const item of data.furniture) {
    assert(data.metadata.furnitureSources[item.source], item.id + ' has source provenance');
    assert(['+x', '-x', '+y', '-y'].includes(item.facing));
    const room = rooms.get(item.room), actual = itemBounds(item.id), [x0, y0, x1, y1] = item.box;
    assert(room && parts(item.id).length, item.id + ' renders in a real room');
    assert(x0 >= room.box[0] - .001 && y0 >= room.box[1] - .001 && x1 <= room.box[2] + .001 && y1 <= room.box[3] + .001, item.id + ' fits room');
    assert(actual.min.x >= x0 - .001 && actual.min.y >= y0 - .001 && actual.max.x <= x1 + .001 && actual.max.y <= y1 + .001, item.id + ' mesh fits footprint');
    assert(actual.min.z >= (item.room.startsWith('1.') ? 3.2 : 0) - .001, item.id + ' stays above floor');
  }
});

test('rendered bed heads and sofa backs follow publisher orientation', () => {
  for (const [id, direction, axis, head] of [
    ['bedroom-one', '+x', 'x', .52], ['bedroom-two', '+x', 'x', .52], ['master-bed', '-y', 'y', 12.26],
  ]) {
    const item = furniture.get(id), bedHead = partCenter(id, 'headboard'), foot = partCenter(id, 'duvet');
    assert.equal(item.facing, direction);
    assert(facingProjection(item, foot) > facingProjection(item, bedHead) + .5, id + ' faces from head to foot');
    close(bedHead[axis], head + (direction.startsWith('+') ? .03 : -.03), id + ' head touches source wall');
  }
  for (const id of ['sofa', 'guest-sofa-bed']) {
    const item = furniture.get(id), back = partCenter(id, 'back'), seat = partCenter(id, 'seat');
    assert.equal(item.facing, '-x');
    assert(facingProjection(item, seat) > facingProjection(item, back), id + ' faces toward -x');
  }
  assert(itemBounds('projection-screen').max.x < itemBounds('coffee-table').min.x);
  assert(itemBounds('coffee-table').max.x < itemBounds('sofa').min.x);
});

test('dining chairs face the table and the kitchen island has no stools', () => {
  const center = itemBounds('dining-table').getCenter(new THREE.Vector3());
  const diningChairs = data.furniture.filter(item => item.id.startsWith('dining-') && item.type === 'chair');
  assert.equal(diningChairs.length, 6, 'User override: exactly six dining chairs');
  const table = furniture.get('dining-table');
  for (const item of diningChairs) {
    close(item.id.startsWith('dining-left-') ? table.box[0] - item.box[2] : item.box[0] - table.box[2], .06, item.id + ' is pulled close to table');
    const back = partCenter(item.id, 'back'), seat = partCenter(item.id, 'seat');
    assert(seat.distanceTo(center) < back.distanceTo(center), item.id + ' faces dining table');
  }
  assert(!data.furniture.some(item => item.room === '0.4' && item.type === 'stool'));
  assert(!interior.group.children.some(object => object.name.startsWith('island-stool-')));
  assert(!interior.navigation.obstacles.some(obstacle => obstacle.id.includes('island-stool-')));
});

test('source wall storage contacts are preserved and cabinet handles face into rooms', () => {
  for (const [id, edge, expected] of [
    ['guest-wardrobe', 'min.x', 11.33], ['entry-wardrobe-rear', 'max.y', 6.31],
    ['entry-wardrobe-side', 'max.x', 11.19], ['bedroom-two-wardrobe-rear', 'max.y', 10.18],
    ['bedroom-two-wardrobe-side', 'max.x', 4.77], ['master-dressing-left', 'min.x', 11.69],
    ['master-dressing-right', 'max.x', 14.14], ['kitchen-tall', 'min.y', 8.65],
    ['laundry-stack', 'max.y', 7.89], ['laundry-storage', 'max.y', 7.89],
  ]) {
    const [side, axis] = edge.split('.'); close(itemBounds(id)[side][axis], expected, id + ' source wall contact');
  }
  for (const item of data.furniture.filter(item => ['cabinet', 'counter'].includes(item.type))) {
    const body = partCenter(item.id, 'body');
    for (const handle of parts(item.id).filter(object => object.name.includes('-handle-'))) {
      assert(facingProjection(item, bounds(handle).getCenter(new THREE.Vector3())) > facingProjection(item, body), item.id + ' handles face outward');
    }
  }
});

test('attic laundry stack, ironing station and bedside drawers fit the mirrored plan', () => {
  const lower=partCenter('laundry-stack','washer-door'),upper=partCenter('laundry-stack','dryer-door');
  close(lower.x,upper.x,'Appliances align');close(lower.y,upper.y,'Doors align');
  close(upper.z-lower.z,.88,'Dryer sits above stacking kit');
  const board=itemBounds('laundry-ironing-board'), stack=itemBounds('laundry-stack');
  assert(board.max.y+1.28 < stack.min.y,'Clear standing space in front of both appliances');
  assert.equal(parts('laundry-ironing-board').filter(mesh=>mesh.name.includes('-leg-')).length,4);
  const door= data.walls.find(w=>w.id==='u-laundry-hall'), [start,end]=door.doors[0];
  const swing=[door.a[0],door.a[1]+start,door.a[0]+end-start,door.a[1]+end];
  for(const item of data.furniture.filter(f=>f.room==='1.5')) assert(!overlaps(swing,item.box),item.id+' leaves full door swing clear');
  const bed=itemBounds('master-bed'), left=itemBounds('master-bedside-left'), right=itemBounds('master-bedside-right');
  close(bed.min.x-left.max.x,.08,'Left nightstand at bedside');close(right.min.x-bed.max.x,.08,'Right nightstand at bedside');
  for(const id of ['master-bedside-left','master-bedside-right']){
    close(itemBounds(id).max.y,bed.max.y,'Nightstand aligns with headboard');
    assert(partCenter(id,'drawer').z>partCenter(id,'shelf').z);
  }
});

test('sanitary fixtures face the usable room and ambiguous fixtures are disclosed', () => {
  for (const item of data.furniture.filter(item => item.type === 'toilet')) {
    assert(facingProjection(item, partCenter(item.id, 'base')) > facingProjection(item, partCenter(item.id, 'cistern')), item.id + ' cistern at back');
  }
  assert.equal(data.furniture.filter(item => item.room === '1.6' && item.type === 'sink').length, 2);
  for (const id of ['private-sink-one', 'private-sink-two']) {
    assert.equal(furniture.get(id).facing, '-x'); close(itemBounds(id).max.x, 11.55, id + ' dressing wall contact');
  }
  for (const id of ['private-shower', 'private-wc']) assert(furniture.get(id).approximation?.includes('rooflight'));
  assert(furniture.has('ground-shower') && furniture.has('upper-shower'));
  const tub = itemBounds('bath-tub');
  assert(tub.max.y - tub.min.y > tub.max.x - tub.min.x, 'Shared bathroom tub runs along side wall');
});

test('furniture does not occupy another furniture footprint or an internal doorway approach', () => {
  const occupied = data.furniture.filter(item => item.type !== 'rug' && !item.support);
  for (let i = 0; i < occupied.length; i++) for (let j = i + 1; j < occupied.length; j++) {
    const a = occupied[i], b = occupied[j];
    if (a.room.startsWith('1.') === b.room.startsWith('1.')) assert(!overlaps(a.box, b.box), `${a.id} overlaps ${b.id}`);
  }
  for (const wall of data.walls) {
    const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], length = Math.hypot(dx, dy);
    const ux = dx / length, uy = dy / length, reach = wall.thickness / 2 + .28;
    for (const [start, end] of wall.doors) {
      const ax = wall.a[0] + ux * start, ay = wall.a[1] + uy * start;
      const bx = wall.a[0] + ux * end, by = wall.a[1] + uy * end;
      const clearance = [Math.min(ax, bx) - Math.abs(uy) * reach, Math.min(ay, by) - Math.abs(ux) * reach,
        Math.max(ax, bx) + Math.abs(uy) * reach, Math.max(ay, by) + Math.abs(ux) * reach];
      for (const item of occupied.filter(item => item.room.startsWith('1.') === Boolean(wall.level) && item.passageWall !== wall.id)) {
        assert(!overlaps(item.box, clearance), `${item.id} obstructs ${wall.id} doorway approach`);
      }
    }
  }
});

test('tall furniture leaves ground glazing clear and source window locations are retained', () => {
  assert.deepEqual(data.facades.find(wall => wall.id === 'facade-main-side').openings.map(item => [item.start, item.end]), [[9.23, 12.23]]);
  const terrace = data.facades.find(wall => wall.id === 'facade-terrace');
  close(terrace.a[1] + terrace.openings[0].start, 13.9, 'Terrace glazing begins');
  close(terrace.a[1] + terrace.openings.at(-1).end, 16.6, 'Terrace glazing ends');
  const tall = data.furniture.filter(item => item.room.startsWith('0.') && itemBounds(item.id).max.z > 1.2);
  for (const wall of data.facades) for (const window of wall.openings.filter(item => item.glass)) {
    const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
    const ux = (wall.b[0] - wall.a[0]) / length, uy = (wall.b[1] - wall.a[1]) / length;
    const ax = wall.a[0] + ux * window.start, ay = wall.a[1] + uy * window.start;
    const bx = wall.a[0] + ux * window.end, by = wall.a[1] + uy * window.end;
    const clearance = [Math.min(ax, bx) - Math.abs(uy) * 1.03, Math.min(ay, by) - Math.abs(ux) * 1.03,
      Math.max(ax, bx) + Math.abs(uy) * 1.03, Math.max(ay, by) + Math.abs(ux) * 1.03];
    for (const item of tall) assert(!overlaps(item.box, clearance), `${item.id} obstructs ${wall.id} window`);
  }
});

test('upper furniture meshes stay below the actual interior roof', () => {
  for (const item of data.furniture.filter(item => item.room.startsWith('1.'))) for (const object of parts(item.id)) {
    object.updateMatrix(); const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrix);
      const world = interior.localToWorld([p.x, p.y]);
      assert(p.z <= interior.navigation.ceilingHeight(world) + .01, `${object.name} intersects roof at ${p.x},${p.y},${p.z}`);
    }
  }
});

test('Room2 has a solid collision wall beside the void; only the hall has a rail', () => {
  const wall = data.walls.find(item => item.id === 'u-room2-void');
  assert.deepEqual([wall.a, wall.b, wall.doors], [[.5, 10.25], [4.91, 10.25], []]);
  const actual = bounds(interior.group.getObjectByName(wall.id));
  close(actual.min.y, 10.18, 'Room2 wall inner face'); close(actual.max.y, 10.32, 'Room2 wall outer face');
  const guard = bounds(interior.group.getObjectByName('upper-void-edge-top'));
  close(guard.min.x, 4.91, 'Rail starts at hall'); close(guard.max.x, 7.94, 'Rail ends at stair');
  const collision = createWalkCollision(interior.navigation.obstacles.filter(item => item.id.startsWith('u-room2-void-')));
  assert(collision.pathBlocked(interior.localToWorld([3, 9.9]).slice(0, 2), interior.localToWorld([3, 10.6]).slice(0, 2)));
  const rear = data.walls.find(item => item.id === 'u-suite-front');
  assert(rear.doors.every(door => rear.a[0] + door[0] > 8.77), 'No invented rear laundry doorway');
});

test('furniture collision boxes follow real rendered heights and mirror only once', () => {
  for (const item of data.furniture.filter(item => item.type !== 'rug' && !item.support)) {
    const collider = interior.navigation.obstacles.find(obstacle => obstacle.id === 'furniture-' + item.id);
    assert(collider, item.id + ' has collision geometry');
    close(collider.maxZ, itemBounds(item.id).max.z, item.id + ' collision height');
    const center = itemBounds(item.id).getCenter(new THREE.Vector3());
    const actual = center.clone().applyMatrix4(interior.group.matrix), { matrix: m, translation: t } = house.metadata;
    close(actual.x, m[0][0] * (14.64 - center.x) + m[0][1] * center.y + t[0], item.id + ' mirrored world x');
    close(actual.y, m[1][0] * (14.64 - center.x) + m[1][1] * center.y + t[1], item.id + ' mirrored world y');
  }
});

test('mirrored vestibule dimensions and office storage follow the supplied ground plan', () => {
  const entry = rooms.get('0.6'), office = rooms.get('0.9');
  const [a,b,c,d,e] = entry.outline;
  close(b[0]-a[0],4.61,'Entry width');
  close(c[1]-b[1],1.60,'Shallow wardrobe alcove');
  close(e[0]-a[0],1.91,'Entry leg width');
  close(e[1]-a[1],3.17,'Entry leg depth');
  close(entry.area,10.29,'Entry schedule');
  close(office.area,13.45,'Office schedule');
  const cabinets=data.furniture.filter(item=>item.id.startsWith('office-under-stair-'));
  const [sx,sy,ex]=data.stairs.box, run=8*data.stairs.tread, half=data.stairs.floorHeight/2;
  close(office.box[2]-ex,4.34,'Clear office width');
  close(office.box[3]-office.box[1],2.85,'Office depth');
  let y=office.box[1];
  for(const item of cabinets){
    const [x0,y0,x1,y1]=item.box;
    close(y0,y,'Continuous run');
    close(x1,ex,'Front at edge of upper flight');
    close(x1-x0,.76,'Cabinet depth');
    assert(x0>sx+data.stairs.width && item.facing==='+x');
    assert(itemBounds(item.id).max.z < (y1>sy+run ? half-.15 : 3.2-half/9-.22-(y1-sy)*half/9/data.stairs.tread));
    assert(parts(item.id).some(mesh=>mesh.name.includes('-door-')));
    y=y1;
  }
  close(y,12.23,'Run reaches actual back wall');
  close(y-office.box[1],2.81,'Built cabinet length');
});

test('each entry wardrobe door has an accessible handle and space to open beside the return', () => {
  for (const [id, otherId, count, axis] of [
    ['entry-wardrobe-side', 'entry-wardrobe-rear', 2, 'y'],
    ['entry-wardrobe-rear', 'entry-wardrobe-side', 4, 'x'],
  ]) {
    const doors = parts(id).filter(mesh => mesh.name.includes('-door-'));
    const handles = parts(id).filter(mesh => mesh.name.includes('-handle-'));
    assert.equal(doors.length, count);
    assert.equal(handles.length, count);
    doors.forEach((mesh, index) => {
      const door = bounds(mesh), handle = partCenter(id, 'handle-' + index);
      close(handle[axis], (door.min[axis] + door.max[axis]) / 2, 'Handle sits on its door');
      const leafWidth = door.max[axis] - door.min[axis];
      const clearance = [door.min.x, door.min.y, door.max.x, door.max.y];
      clearance[axis === 'y' ? 0 : 1] -= leafWidth;
      assert(!overlaps(clearance, furniture.get(otherId).box), mesh.name + ' can swing clear of the other cabinet');
      if (axis === 'y') assert(door.min.y >= 4.71 && door.max.y <= 5.71);
    });
  }
});

test('opaque office backing seals the gap above the cabinets up to the flight, landing and rear wall', () => {
  const segments = interior.group.children.filter(mesh => mesh.name.startsWith('office-backing-'));
  const group = new THREE.Group();
  for (const segment of segments) group.add(segment.clone());
  group.updateMatrixWorld(true);
  function hits(y, z) {
    const ray = new THREE.Raycaster(new THREE.Vector3(10.20, y, z), new THREE.Vector3(-1, 0, 0), 0, 1.55);
    return ray.intersectObjects(group.children).length > 0;
  }
  assert(hits(10.50, 1.90), 'Office-to-stair sightline above cabinet is blocked');
  assert(hits(11.92, 1.42), 'Wall meets landing underside');
  assert(hits(12.22, 2.60), 'Short infill closes the room at the facade');
  assert(!hits(11.92, 1.65), 'Backing stays below the landing walking surface');
  for (const segment of segments) {
    const actual = bounds(segment);
    close(actual.max.x, 9.04, 'Backing contacts the cabinet rear');
    assert(interior.navigation.obstacles.some(obstacle => obstacle.id === segment.name));
  }
});

test('office privacy partition and fitted fascia close the stair view above each usable cabinet', () => {
  const wall = interior.group.getObjectByName('office-stair-partition');
  const cabinets = data.furniture.filter(item => item.id.startsWith('office-under-stair-'));
  const group = new THREE.Group();
  group.add(wall.clone(), ...cabinets.map(item => interior.group.getObjectByName(item.id + '-filler').clone()));
  group.updateMatrixWorld(true);
  function hits(y, z) {
    return new THREE.Raycaster(new THREE.Vector3(10.20,y,z), new THREE.Vector3(-1,0,0), 0,1.55).intersectObjects(group.children);
  }
  assert.equal(hits(10.65,2.58)[0].object.name, wall.name);
  close(bounds(wall).min.x,data.stairs.box[2],'Partition stays outside the stair walking width');
  close(bounds(wall).max.z,data.levels.groundCeiling,'Partition meets the ceiling');
  for (const item of cabinets) {
    const y = (item.box[1]+item.box[3])/2;
    assert(hits(y, item.height+.04).length, 'Fascia closes gap immediately above ' + item.id);
    assert(hits(y, 2.78).length, 'Closed at ceiling ' + item.id);
    assert.equal(hits(y,item.height-.03).length,0,'Cabinet door remains accessible');
  }
});

test('plaster return finishes flush with the vestibule wardrobe and keeps the passage clear', () => {
  const returnWall = bounds(interior.group.getObjectByName('bath-left'));
  const cabinet = itemBounds('entry-wardrobe-rear');
  close(returnWall.min.x,8.49,'Finished passage face');
  close(returnWall.max.x,cabinet.min.x,'Carcass butts against plaster');
  close(returnWall.min.y,cabinet.min.y,'Return meets the cabinet front');
  assert(returnWall.max.y > cabinet.max.y,'Return continues to bathroom');
  close(returnWall.max.z,2.80,'Full-height plaster');
  const collider = createWalkCollision(interior.navigation.obstacles.filter(wall=>wall.id.startsWith('bath-left-')));
  const point = (x,y) => interior.localToWorld([x,y]).slice(0,2);
  assert(collider.pathBlocked(point(8.12,5.93),point(8.78,5.93)));
  assert(!collider.pathBlocked(point(7.4,5.25),point(7.4,8.1)));
});

test('reference furniture keeps the stone returns, paired coffee tables and floating media console in scale', () => {
  const box = name => bounds(interior.group.getObjectByName(name));
  const island = furniture.get('kitchen-island'), top = box('kitchen-island-top');
  const returns = parts(island.id).filter(mesh => mesh.name.includes('-waterfall-'));
  assert.equal(returns.length, 2);
  for (const panel of returns) {
    const side = bounds(panel);
    close(side.max.z, top.min.z, 'Waterfall returns meet underside of top');
    close(side.max.y - side.min.y, island.box[3] - island.box[1], 'Waterfall wraps the full island depth');
  }
  close(itemBounds('kitchen-tall').max.z, furniture.get('kitchen-tall').height, 'Tall cabinet stays within its original envelope');
  const larger = box('coffee-table-top-0'), smaller = box('coffee-table-top-1');
  close(larger.max.x - larger.min.x, .78, 'Large coffee tabletop diameter');
  close(smaller.max.x - smaller.min.x, .47, 'Small coffee tabletop diameter');
  assert(smaller.max.z < larger.min.z, 'Smaller table nests below the larger tabletop');
  close(itemBounds('living-rug').min.z, 0, 'Rug rests on the floor');
  assert(itemBounds('media-console').min.z > .20, 'Media console floats clear of floor');
  assert.equal(parts('sofa').filter(mesh => mesh.name.includes('-scatter-')).length, 3);
  for (const chair of data.furniture.filter(item => item.id.startsWith('dining-') && item.type === 'chair')) {
    const seat = interior.group.getObjectByName(chair.id + '-seat');
    assert.equal(seat.material.color.getHexString(), 'ded8c8', 'Dining seats have ivory upholstery');
  }
});

test('garden-end chaise and separate club chair leave a continuous route to the open terrace panel', () => {
  const sofa = itemBounds('sofa'), chaise = itemBounds('chaise'), chair = itemBounds('living-armchair');
  const table = itemBounds('coffee-table'), island = itemBounds('kitchen-island');
  close(chaise.max.y, sofa.max.y, 'Chaise aligns with the garden end of the sofa');
  close(chaise.max.x, sofa.min.x, 'Chaise joins the front of the sofa');
  assert(partCenter('sofa', 'arm').y < sofa.min.y + .15, 'Sofa arm finishes the opposite end');
  assert(chaise.min.y - table.max.y >= .35 && sofa.min.x - table.max.x >= .40);
  assert(chair.min.y - island.max.y >= .85 && chair.max.x < sofa.min.x && chair.max.y < table.min.y);
  assert.equal(parts('living-armchair').filter(mesh => mesh.name.includes('-rolled-arm-')).length, 2);
  assert(partCenter('living-armchair', 'scatter').z > partCenter('living-armchair', 'seat').z);
  const collision = createWalkCollision(interior.navigation.obstacles.filter(o => o.minZ < 1.85 && o.maxZ > .04), .40);
  const route = [[4.55,12.5],[4.55,16.08],[7.65,16.08],[8.65,15.95]].map(xy => interior.localToWorld(xy).slice(0,2));
  for (let i = 1; i < route.length; i++) assert(!collision.pathBlocked(route[i-1], route[i]), '80 cm wide terrace route');
});

function projectionFrustum(lens,screen) {
  const center = screen.getCenter(new THREE.Vector3()), view = lens.clone().lerp(center,.5);
  const corners = [[screen.min.y,screen.min.z],[screen.max.y,screen.min.z],[screen.max.y,screen.max.z],[screen.min.y,screen.max.z]]
    .map(([y,z]) => new THREE.Vector3(screen.max.x,y,z));
  const sides = corners.map((corner,i) => {
    const side = new THREE.Plane().setFromCoplanarPoints(lens,corner,corners[(i+1)%corners.length]);
    return side.distanceToPoint(view) < 0 ? side.negate() : side;
  });
  return new THREE.Frustum(...sides, new THREE.Plane(new THREE.Vector3(1,0,0),-screen.max.x-.001),
    new THREE.Plane(new THREE.Vector3(-1,0,0),lens.x-.001));
}

function triangleInFrustum(vertices, frustum) {
  for (const plane of frustum.planes) {
    const clipped = [];
    for (let i=0; i<vertices.length; i++) {
      const a=vertices[i], b=vertices[(i+1)%vertices.length], da=plane.distanceToPoint(a), db=plane.distanceToPoint(b);
      if (da >= 0) clipped.push(a);
      if ((da >= 0) !== (db >= 0)) clipped.push(a.clone().lerp(b,da/(da-db)));
    }
    if (!clipped.length) return false;
    vertices = clipped;
  }
  return true;
}

function meshBlocksProjection(mesh,frustum) {
  const geometry=mesh.geometry, positions=geometry.attributes.position, index=geometry.index;
  mesh.updateMatrix(); geometry.computeBoundingBox();
  for (let i=0; i<(mesh.isInstancedMesh ? mesh.count : 1); i++) {
    const matrix=mesh.matrix.clone();
    if (mesh.isInstancedMesh) {
      const instance=new THREE.Matrix4(); mesh.getMatrixAt(i,instance); matrix.multiply(instance);
    }
    if (!frustum.intersectsBox(geometry.boundingBox.clone().applyMatrix4(matrix))) continue;
    for (let n=0; n<(index?.count ?? positions.count); n+=3) {
      const vertices=[n,n+1,n+2].map(k => new THREE.Vector3().fromBufferAttribute(positions,index ? index.getX(k) : k).applyMatrix4(matrix));
      if (triangleInFrustum(vertices,frustum)) return true;
    }
  }
  return false;
}

test('wall-mounted projector aims at a matte white 16:9 surface with the entire image cone clear', () => {
  const get = name => interior.group.getObjectByName(name);
  assert(!interior.group.children.some(object => /living-stove|^tv-/.test(object.name)));
  assert(!interior.navigation.obstacles.some(obstacle => /stove|furniture-tv/.test(obstacle.id)));
  const surface=get('projection-screen-surface'), screen=bounds(surface), size=screen.getSize(new THREE.Vector3());
  close(size.y/size.z,16/9,'Projection image aspect ratio');
  const inches=Math.hypot(size.y,size.z)/.0254;
  assert(inches>=70 && inches<=120);
  assert(surface.material.roughness >= .95 && surface.material.metalness === 0);
  assert(Math.min(...surface.material.color.toArray())>.88 && surface.material.emissive.getHex()===0);
  const lens=get('projector-lens-glass'), axis=new THREE.Vector3(-1,0,0).applyQuaternion(lens.quaternion);
  const origin=lens.position.clone().addScaledVector(axis,lens.geometry.parameters.height/2);
  const hit=origin.clone().addScaledVector(axis,(screen.max.x-origin.x)/axis.x);
  close(hit.y,screen.getCenter(new THREE.Vector3()).y,'Horizontal optical axis');
  close(hit.z,screen.getCenter(new THREE.Vector3()).z,'Vertical optical axis');
  const plate=bounds(get('projector-anchor-plate'));
  assert(plate.min.z > 2.35 && plate.max.z < 2.8, 'Fixing plate is entirely on the solid terrace header');
  close(plate.max.x,bounds(get('facade-terrace')).min.x,'Plate bears directly on the inner wall face');
  for (const [a,b] of [['anchor-plate','wall-arm'],['wall-arm','tilt-pivot'],['tilt-pivot','case']])
    assert(bounds(get('projector-'+a)).intersectsBox(bounds(get('projector-'+b))),a+' connected to '+b);
  const frustum=projectionFrustum(origin,screen);
  const testObstruction=new THREE.Mesh(new THREE.SphereGeometry(.03,8,6));
  testObstruction.position.copy(origin).lerp(hit,.5);
  assert(meshBlocksProjection(testObstruction,frustum), 'An obstruction wholly inside the beam is detected');
  const blockers=interior.group.children.filter(object => object.isMesh && meshBlocksProjection(object,frustum));
  assert.deepEqual(blockers.map(o=>o.name),[],'No interior mesh intersects the optical volume between lens and screen');
});

test('upper rooms have layered beds, usable workstations and fitted dressing-room storage', () => {
  const get = name => interior.group.getObjectByName(name);
  for (const id of ['bedroom-one','bedroom-two','master-bed']) {
    for (const detail of ['head-pad-0','mattress','duvet','turnback','throw','pillow-0']) assert(get(id+'-'+detail));
  }
  for (const id of ['bedroom-one','bedroom-two']) {
    const desk = furniture.get(id+'-desk'), chair = furniture.get(id+'-chair');
    for (const detail of ['task-light','notebook','drawer-2','pencil-cup']) assert(get(desk.id+'-'+detail));
    close(bounds(get(desk.id+'-top')).max.z-3.2,.752,'Writing height');
    assert(facingProjection(chair,partCenter(desk.id,'top'))>facingProjection(chair,partCenter(chair.id,'seat')));
    assert(parts(chair.id).filter(mesh=>mesh.name.includes('-back-upright-')).length===2);
  }
  for (const id of ['master-dressing-left','master-dressing-right']) {
    assert.equal(parts(id).filter(mesh=>mesh.name.includes('-garment-')).length,6);
    for (const detail of ['rail-0','rail-1','drawer-2','shelf-1.12']) assert(get(id+'-'+detail));
  }
  for (const id of ['upper-bath','private-sink-one','private-sink-two']) {
    for (const detail of ['bowl','drain','mirror','tap','vanity']) assert(get(id+'-'+detail));
    assert(get(id+'-bowl').geometry.type==='LatheGeometry');
  }
  assert(get('gallery-chair-scatter') && get('gallery-reading-lamp-diffuser'));
  const collision = createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<5.12 && o.maxZ>3.25),.40);
  const route = [[5.54,4.40],[5.54,8.42],[6.17,8.48],[7.54,8.78],[8.33,8.78]].map(p=>interior.localToWorld(p).slice(0,2));
  for (let i=1;i<route.length;i++) assert(!collision.pathBlocked(route[i-1],route[i]),'80 cm clear to gallery and stair');
});

test('mezzanine collar frames follow the crossed roof and leave the catalogue rooflights free', () => {
  const timbers = interior.group.children.filter(o=>o.name.startsWith('gallery-truss-'));
  assert.equal(timbers.filter(o=>o.name.includes('-rafter-')).length,6);
  assert.equal(timbers.filter(o=>o.name.includes('-collar-')).length,3);
  assert.equal(timbers.filter(o=>o.name.includes('-valley-')).length,2);
  const asWorld = p => new THREE.Vector3(...interior.localToWorld(p));
  interior.group.updateMatrixWorld(true);
  const apertures = [[7.15,1.78,.524,.36],[1.04,4.72,.524,.36],[1.04,7.10,.524,.36],[1.04,8.02,.524,.36],
    [1.04,8.94,.524,.36],[8.25,5.66,.36,.524],[10.47,5.66,.36,.524],[12.89,5.66,.36,.524]];
  for(const [x,y,rx,ry] of apertures) for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++) {
    const at=asWorld([x+rx*i/2,y+ry*j/2,8.8]);
    assert.equal(new THREE.Raycaster(at,new THREE.Vector3(0,0,-1),0,5.6).intersectObjects(timbers).length,0);
  }
  for(const mesh of timbers){
    const verts=mesh.geometry.attributes.position;
    for(let i=0;i<verts.count;i++){
      const [x,y,z]=new THREE.Vector3().fromBufferAttribute(verts,i).toArray();
      assert(z<=interior.navigation.ceilingHeight(interior.localToWorld([x,y]).slice(0,2))+.001,mesh.name+' remains under lining');
    }
  }
  const collar=interior.group.getObjectByName('gallery-truss-collar-1');
  assert(bounds(collar).min.z-3.2>3.7);
  for(const eye of [[6.18,9.49,4.82],[5.30,13.20,1.62]]){
    const start=asWorld(eye),aim=asWorld(bounds(collar).getCenter(new THREE.Vector3()).toArray());
    const ray=new THREE.Raycaster(start,aim.clone().sub(start).normalize(),0,start.distanceTo(aim)+.5);
    const hit=ray.intersectObjects(interior.group.children.filter(o=>o.isMesh))[0];
    assert(hit?.object.name.startsWith('gallery-truss-'),'Exposed timber visible from '+eye+'; first hit '+hit?.object.name);
  }
});

test('the closed walnut portal joins the ceiling-height kitchen and admits walking to the garage', () => {
  const door = bounds(interior.group.getObjectByName('kitchen-pantry-closed-leaf'));
  close(door.min.x,1.053,'Left veneer reveal');
  close(door.max.x,1.947,'Right veneer reveal');
  assert(door.min.z<.01 && door.max.z>2.1);
  const run = ['kitchen-pantry','kitchen-back','kitchen-tall'].map(itemBounds);
  for (const section of run) close(section.max.z,data.levels.groundCeiling,'Cabinetry touches slab');
  close(furniture.get('kitchen-island').box[1]-furniture.get('kitchen-back').box[3],1.08,'Island working aisle');
  for(let i=0;i<5;i++) {
    const light = bounds(interior.group.getObjectByName('kitchen-back-upper-'+i));
    const crown = bounds(interior.group.getObjectByName('kitchen-back-walnut-crown-'+i));
    assert(light.max.y+.10<crown.max.y && light.min.z>1.55 && crown.max.z>2.79);
  }
  const walk = createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.7 && o.maxZ>0));
  const point = (x,y)=>interior.localToWorld([x,y]).slice(0,2);
  for(const xs of [[1.5,9.8,1.5,7.45],[1.5,7.45,2.1,7.45],[2.1,7.45,2.1,5.5]])
    assert(!walk.pathBlocked(point(xs[0],xs[1]),point(xs[2],xs[3])),'Hidden route '+xs);
  for(const x of [.75,2.15])assert(walk.pathBlocked(point(x,9.7),point(x,8.0)),'Fixed cabinet at '+x);
});

test('the ceiling-height reeded vestibule screen admits walking through its leaf only', () => {
  const walk = createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.7 && o.maxZ>0));
  const point = (x,y)=>interior.localToWorld([x,y]).slice(0,2);
  for(const [piece,x,blocked] of [['left',6.78,true],['leaf',7.45,false],['right',8.19,true]]) {
    const glass = interior.group.getObjectByName('vestibule-screen-'+piece+'-reeded-glass');
    assert(glass.material.transparent && !glass.castShadow && glass.geometry.attributes.position.count>100);
    const pane = bounds(glass);
    assert(pane.min.z<.03 && pane.max.z>2.77 && pane.max.y-pane.min.y>.003);
    assert.equal(walk.pathBlocked(point(x,7.45),point(x,8.46)),blocked);
  }
  assert(!walk.pathBlocked(point(7.45,4.83),point(7.45,8.46)));
  assert(!walk.pathBlocked(point(7.45,5.52),point(5.7,5.52)));
});

test('the garage return closes the entry corner to the slab beside the main door and its two windows', () => {
  interior.group.updateMatrixWorld(true);
  const object = name => interior.group.getObjectByName(name);
  const hit = (name,origin,direction,limit) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(...origin).applyMatrix4(interior.group.matrix),
      new THREE.Vector3(...direction).transformDirection(interior.group.matrix),0,limit);
    return ray.intersectObject(object(name),false).length>0;
  };
  for(const y of [4.235,4.445,4.675,4.70])for(const z of [.08,1.3,2.33,2.78]) {
    assert(hit('entry-garage-jamb-return',[6.30,y,z],[1,0,0],.14),'Garage face '+y+','+z);
    if(z<2.35||y>4.69)assert(hit('entry-garage-jamb-return',[6.98,y,z],[-1,0,0],.09),'Door reveal '+y+','+z);
  }
  assert(hit('upper-structure',[6.67,4.46,2.72],[0,0,1],.09),'Soffit meets the jamb');
  assert(hit('entry-main-door-leaf',[7.4,3.9,1.3],[0,1,0],.60),'Visible front leaf');
  for(const [i,x] of [[1,9.5],[2,12.5]]) {
    assert(hit('facade-front-wing-glass-'+i,[x,3.9,1.3],[0,1,0],.60));
    assert(!hit('facade-front-wing',[x,3.9,1.3],[0,1,0],.9));
  }
  const walk = createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.7 && o.maxZ>0));
  const point=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  assert(!walk.pathBlocked(point(7.4,3.5),point(7.4,5.3)),'Main entrance');
  for(const x of [6.72,8.16,9.50,12.5])
    assert(walk.pathBlocked(point(x,3.5),point(x,5.3)),'Solid jamb, pier or window '+x);
});
