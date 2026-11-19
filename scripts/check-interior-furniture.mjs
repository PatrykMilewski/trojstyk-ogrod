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
const inventoryMeshes = interior.group.getObjectsByProperty('isMesh',true);
const parts = id => inventoryMeshes.filter(object => object.userData.furnitureId === id);
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
  assert(bounds(interior.group.getObjectByName(data.projection.wall)).max.x < itemBounds('coffee-table').min.x);
  assert(itemBounds('coffee-table').max.x < itemBounds('sofa').min.x);
});

test('six individual dining chairs tuck under the rounded tabletop and leave walkable aisles', () => {
  const table = bounds(interior.group.getObjectByName('dining-table-solid-top'));
  const chairs = data.furniture.filter(item => item.id.startsWith('dining-') && item.type === 'chair');
  assert.equal(chairs.length, 6);
  close(table.max.x - table.min.x, 1.10, 'Top width', .0001);
  close(table.max.y - table.min.y, 2.60, 'Top length', .0001);
  close(table.min.z, .7045, 'Table underside');
  close(table.max.z, .7815, 'Table surface');
  const top = interior.group.getObjectByName('dining-table-solid-top'), corners = top.geometry.attributes.position;
  let diagonal = Infinity;
  for (let i=0;i<corners.count;i++) {
    const point = new THREE.Vector3().fromBufferAttribute(corners,i).applyMatrix4(top.matrix);
    diagonal = Math.min(diagonal, point.x-table.min.x+point.y-table.min.y);
  }
  close(diagonal, .145*(2-Math.SQRT2), 'Rounded 14.5 cm plan corner', .002);
  const signatures = {wishbone:'fork-1', cane:'cane-panel', windsor:'fan-spindle-0', ladder:'lower-slat', upholstered:'back', bentwood:'inner-loop'};
  assert.deepEqual(chairs.map(chair => chair.chairStyle).sort(), Object.keys(signatures).sort());
  const room = rooms.get('0.4').box, sofa = itemBounds('sofa');
  for (const item of chairs) {
    const get = suffix => interior.group.getObjectByName(item.id+'-'+suffix);
    assert(get(signatures[item.chairStyle]), item.id+' has its own back construction');
    const left = item.facing === '+x', seat = bounds(get('seat')), back = bounds(get('back'));
    const tuck = left ? seat.max.x-table.min.x : table.max.x-seat.min.x;
    assert(tuck >= .23 && tuck <= .26, item.id+' has about half the cushion beneath the top');
    assert(left ? back.max.x < table.min.x-.05 : back.min.x > table.max.x+.05, item.id+' back stays outside top');
    assert(seat.max.z >= .45 && seat.max.z <= .48 && table.min.z-seat.max.z >= .22, item.id+' preserves seated thigh clearance');
    const actual = itemBounds(item.id);
    assert((left ? actual.min.x-sofa.max.x : room[2]-actual.max.x) >= 1.05, item.id+' leaves an aisle behind the chair');
    assert(parts(item.id).filter(part => part.name.includes('-tapered-leg-')).length === 4);
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
    if (a.room.startsWith('1.') !== b.room.startsWith('1.') || !overlaps(a.box, b.box)) continue;
    const tuckedChair = a.id === 'dining-table' ? b : b.id === 'dining-table' ? a : null;
    assert(tuckedChair?.chairStyle, `${a.id} overlaps ${b.id}`);
    for (const chairPart of parts(tuckedChair.id)) for (const tablePart of parts('dining-table')) {
      assert(!bounds(chairPart).intersectsBox(bounds(tablePart)), `${chairPart.name} intersects ${tablePart.name}`);
    }
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

test('reference furniture keeps the tall run and paired coffee tables in scale', () => {
  const box = name => bounds(interior.group.getObjectByName(name));
  close(itemBounds('kitchen-tall').max.z, furniture.get('kitchen-tall').height, 'Tall cabinet stays within its original envelope');
  const larger = box('coffee-table-top-0'), smaller = box('coffee-table-top-1');
  close(larger.max.x - larger.min.x, .78, 'Large coffee tabletop diameter');
  close(smaller.max.x - smaller.min.x, .47, 'Small coffee tabletop diameter');
  assert(smaller.max.z < larger.min.z, 'Smaller table nests below the larger tabletop');
  close(itemBounds('living-rug').min.z, 0, 'Rug rests on the floor');
  assert(furniture.has('media-console') && !furniture.has('projection-screen'));
  assert.equal(parts('sofa').filter(mesh => mesh.name.includes('-scatter-')).length, 2);
  for (const chair of data.furniture.filter(item => item.id.startsWith('dining-') && item.type === 'chair')) {
    const seat = interior.group.getObjectByName(chair.id + '-seat');
    assert.equal(seat.material.color.getHexString(), chair.chairStyle === 'upholstered' ? 'aaa998' : 'ded8c8', 'Dining upholstery follows the linen and sage palette');
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
  const get = name => interior.group.getObjectByName('living-armchair-' + name);
  const hoop = bounds(get('horseshoe-back')), seat = bounds(get('seat'));
  const supports = parts('living-armchair').filter(mesh => mesh.name.includes('-wrapped-support-'));
  assert.equal(supports.length, 3);
  assert(hoop.min.x < seat.min.x && hoop.max.x > seat.max.x && hoop.max.z > seat.max.z + .24);
  for (const support of supports) {
    assert.equal(support.material, get('horseshoe-back').material);
    assert(bounds(support).min.z < .015 && bounds(support).intersectsBox(hoop));
  }
  const ends = [get('rounded-end-0'), get('rounded-end-2')].map(bounds);
  assert(ends.every(end => end.min.y > seat.getCenter(new THREE.Vector3()).y + .10));
  assert(ends[1].min.x - ends[0].max.x > .22, 'Open front between the upholstered supports');
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
  const zone=data.projection, wall=get(zone.wall), face=bounds(wall).max.x;
  const screen=new THREE.Box3(new THREE.Vector3(face,zone.centerY-zone.widthM/2,zone.centerHeightM-zone.heightM/2),
    new THREE.Vector3(face,zone.centerY+zone.widthM/2,zone.centerHeightM+zone.heightM/2));
  close(zone.widthM/zone.heightM,16/9,'Projection image aspect ratio');
  assert(Math.hypot(zone.widthM,zone.heightM)/.0254>=70 && Math.hypot(zone.widthM,zone.heightM)/.0254<=120);
  const paint=wall.material[2];
  assert.equal(paint.color.getHex(),0xffffff);
  assert(paint.roughness===1 && paint.metalness===0 && paint.emissive.getHex()===0);
  assert(!interior.group.children.some(o=>/^(projection-screen-|living-slate-)/.test(o.name)));
  const mount=bounds(get('living-sconce-backplate')),opal=bounds(get('living-sconce-opal'));
  close(mount.min.x,face,'Brass plate mounts on the white plaster');close(mount.max.y-mount.min.y,.258,'Original backplate diameter');
  close(opal.getCenter(new THREE.Vector3()).y,12.78,'Original sconce station');close(opal.getCenter(new THREE.Vector3()).z,1.69,'Original height');
  assert(opal.intersectsBox(mount) && opal.max.x>mount.max.x && opal.max.y<screen.min.y);
  assert(get('sconce-light-living').isPointLight && get('living-sconce-opal').material.emissiveIntensity>0);
  for(const [z,layer] of [[.05,wall],[1.575,wall],[2.76,wall],[3.55,get('upper-main-side')]]){
    for(const y of [12.4,zone.centerY,16.48]){
      const origin=new THREE.Vector3(1,y,z).applyMatrix4(interior.group.matrixWorld);
      const dir=new THREE.Vector3(-1,0,0).transformDirection(interior.group.matrixWorld);
      const hit=new THREE.Raycaster(origin,dir,0,.8).intersectObject(layer)[0];
      assert(hit && layer.material[hit.face.materialIndex]===paint,'White paint across lounge at '+y+', '+z);
    }
  }
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

test('the visible projector toggles the painted wall in walk and orbit cameras after batching', async () => {
  const scene=new THREE.Scene(),model=addIconInterior({THREE,scene,house,data});
  const {batchStaticInteriorDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
  batchStaticInteriorDetails(THREE,model.group);
  scene.updateMatrixWorld(true);
  const lens=model.group.getObjectByName('projector-lens-glass'),center=lens.getWorldPosition(new THREE.Vector3());
  const wall=model.group.getObjectByName(data.projection.wall),paint=wall.material[2];
  const camera=new THREE.PerspectiveCamera(60,1,.1,100),orbit=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);
  const at=(x,y,z)=>model.group.localToWorld(new THREE.Vector3(x,y,z));
  function aim(camera,from){
    camera.position.copy(from);camera.up.set(0,0,1);camera.lookAt(center);camera.updateMatrixWorld();
  }
  aim(camera,at(6.1,14.4,1.8));aim(orbit,at(6.5,14.3,2.1));
  const click=camera=>model.projector.toggleAt({x:0,y:0},camera);
  assert.equal(model.projector.isOn,false);
  assert.equal(click(camera),true);
  assert.equal(model.projector.isOn,true);
  assert.notEqual(wall.material[2],paint);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  wall.material[2].onBeforeCompile(shader);
  const texture=shader.uniforms.lakePrint.value;
  assert.equal(texture.image.width/texture.image.height,16/9);
  assert(texture.isDataTexture && !texture.isVideoTexture && texture.colorSpace===THREE.SRGBColorSpace);
  assert.deepEqual(shader.uniforms.projectionCenter.value.toArray(),[data.projection.centerY,data.projection.centerHeightM]);
  assert.deepEqual(shader.uniforms.projectionScale.value.toArray(),[Math.sign(model.group.matrix.determinant())/data.projection.widthM,1/data.projection.heightM]);
  assert(lens.material.emissive.getHex()>0);
  assert.equal(click(orbit),true);assert.equal(wall.material[2],paint);assert.equal(lens.material.emissive.getHex(),0);

  const obstacle=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),new THREE.MeshBasicMaterial());
  obstacle.position.copy(camera.position).lerp(center,.5);scene.add(obstacle);
  assert.equal(click(camera),false,'An object outside the interior group can conceal the projector');
  obstacle.visible=false;
  assert.equal(click(camera),true,'A hidden obstruction cannot consume the click');
  assert.equal(model.projector.toggleAt({x:.9,y:.9},camera),false);
  aim(camera,at(-1,14.48,2.52));
  assert.equal(click(camera),false,'The real exterior wall occludes the projector');
  model.group.visible=false;
  assert.equal(click(orbit),false,'A hidden house cannot receive projector clicks');
  assert.equal(model.projector.isOn,true);
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

test('the closed painted portal joins the ceiling-height kitchen and admits walking to the garage', () => {
  const door = bounds(interior.group.getObjectByName('kitchen-pantry-closed-leaf'));
  close(door.min.x,1.053,'Left door reveal');
  close(door.max.x,1.947,'Right door reveal');
  close(door.min.z,.008,'Door threshold reveal');close(door.max.z,2.097,'Leaf clears the lintel');
  const run = ['kitchen-pantry','kitchen-back','kitchen-tall'].map(itemBounds);
  for (const section of run) close(section.max.z,data.levels.groundCeiling,'Cabinetry touches slab');
  close(furniture.get('kitchen-island').box[1]-furniture.get('kitchen-back').box[3],1.08,'Island working aisle');
  for(let i=0;i<5;i++) {
    const light = bounds(interior.group.getObjectByName('kitchen-back-upper-'+i));
    const crown = bounds(interior.group.getObjectByName('kitchen-back-crown-'+i));
    assert(light.max.y+.10<crown.max.y && light.min.z>1.55 && crown.max.z>2.79);
  }
  const walk = createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.7 && o.maxZ>0));
  const point = (x,y)=>interior.localToWorld([x,y]).slice(0,2);
  for(const xs of [[1.5,9.8,1.5,7.45],[1.5,7.45,2.1,7.45],[2.1,7.45,2.1,5.5]])
    assert(!walk.pathBlocked(point(xs[0],xs[1]),point(xs[2],xs[3])),'Hidden route '+xs);
  for(const x of [.75,2.15])assert(walk.pathBlocked(point(x,9.7),point(x,8.0)),'Fixed cabinet at '+x);
});

test('the ceiling-height clear vestibule screen admits walking through its leaf only', () => {
  const walk = createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.7 && o.maxZ>0));
  const point = (x,y)=>interior.localToWorld([x,y]).slice(0,2);
  for(const [piece,x,blocked] of [['left',6.78,true],['leaf',7.45,false],['right',8.19,true]]) {
    const prefix='vestibule-screen-'+piece+'-';
    const glass = interior.group.getObjectByName(prefix+'clear-glass');
    assert.equal(glass.material.color.getHex(),0xffffff);
    assert(glass.material.transparent && glass.material.opacity>0 && glass.material.opacity<=.1);
    assert(!glass.castShadow && !glass.material.depthWrite && !glass.geometry.hasAttribute('color'));
    const pane = bounds(glass);
    close(pane.min.y,pane.max.y,'Pane is flat');
    for(const [profile,edge,side,axis] of [['jamb','min','max','x'],['closing-stile','max','min','x'],['shoe','min','max','z'],['head','max','min','z']])
      close(pane[edge][axis],bounds(interior.group.getObjectByName(prefix+profile))[side][axis],profile+' meets the pane');
    assert(pane.min.z<.03 && pane.max.z>2.77);
    assert.equal(walk.pathBlocked(point(x,7.45),point(x,8.46)),blocked);
  }
  for(const side of [-1,1])assert(interior.group.getObjectByName('vestibule-leaf-pull-'+side));
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

test('open wardrobes have usable upper shelves and follow the lining from the eaves to the bedroom wall', () => {
  const skylight = [12.53, 5.13, 13.25, 6.19];
  for (const id of ['master-dressing-left', 'master-dressing-right']) {
    const cap = interior.group.getObjectByName(id+'-sloping-cap');
    const pos = cap.geometry.attributes.position;
    let low = Infinity, high = -Infinity;
    for (let i=0;i<pos.count;i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(cap.matrix);
      const lining = interior.navigation.ceilingHeight(interior.localToWorld([p.x,p.y]));
      assert(lining-p.z >= .006 && lining-p.z <= .036, id+' cap fits slope');
      low = Math.min(low,p.z); high = Math.max(high,p.z);
    }
    assert(high-low>2.7);
    assert(!overlaps(furniture.get(id).box,skylight));
    const shelves = parts(id).filter(m=>m.name.includes('-upper-shelf-'));
    assert(shelves.length>=4);
    for(const shelf of shelves) {
      const b=bounds(shelf);
      assert(b.max.y-b.min.y>.84 && b.max.x-b.min.x>.54, shelf.name+' has full depth and bay width');
    }
    assert.equal(parts(id).filter(m=>m.name.includes('-upper-upright-')).length,4);
    assert.equal(parts(id).filter(m=>m.name.includes('-garment-')).length,6);
  }
  const walk=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<5.0 && o.maxZ>3.25),.30);
  const pt=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  assert(!walk.pathBlocked(pt(13,8.45),pt(13,5.52)),'Central aisle runs from bedroom door to the eaves');
});

test('laundry baskets, hanging cabinets and stocked shelving leave the work aisle clear', () => {
  const baskets=data.furniture.filter(f=>f.type==='laundry-basket');
  assert.equal(baskets.length,3);
  assert.equal(new Set(baskets.map(b=>b.cloth)).size,3);
  for(const item of baskets){
    const body=interior.group.getObjectByName(item.id+'-open-linen-body'),b=bounds(body);
    assert.equal(body.geometry.type,'LatheGeometry');
    const profile=body.geometry.parameters.points;
    assert(profile[0].x<.01 && profile.at(-1).x<.01 && profile.at(-1).y<.05,'Open top, inner wall, raised inner base');
    assert(parts(item.id).filter(m=>m.name.includes('-loop-handle-')).length===2);
    assert(b.max.x-b.min.x>.27 && b.max.y-b.min.y>.36);
  }
  for(const [base,upper,gap] of [['laundry-sink','laundry-wall-sink',.35],['laundry-stack','laundry-wall-dryer',.10],['laundry-storage','laundry-wall-shelves',.019]]){
    const bottom=itemBounds(base),top=itemBounds(upper);
    assert(top.min.z-bottom.max.z>=gap,'Clearance between '+base+' and '+upper);
    assert(top.min.x>=bottom.min.x-.001 && top.max.x<=bottom.max.x+.001 && top.min.y>=bottom.min.y);
    assert(interior.group.getObjectByName(upper+'-middle-shelf'));
  }
  for(const id of ['laundry-wall-sink','laundry-wall-dryer'])assert(parts(id).filter(m=>m.name.includes('-door-')).length===2);
  assert(interior.group.getObjectByName('laundry-wall-shelves-towel-0-1') && interior.group.getObjectByName('laundry-wall-shelves-jar-2'));
  const walk=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<5 && o.maxZ>3.25),.27);
  const pt=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  for(const [x,y,dx,dy] of [[5.6,6.61,8.28,6.61],[7.47,6.61,7.47,6.9],[6.80,6.61,6.80,5.88],[8.15,6.61,8.15,6.22]]){
    assert(!walk.pathBlocked(pt(x,y),pt(dx,dy)),'Access through the door to appliances, baskets and ironing board');
  }
});

function groundWalk(extraObstacles=[]) {
  const occupied=interior.navigation.obstacles.filter(o=>o.minZ<1.70 && o.maxZ>.06);
  return createWalkCollision([...occupied,...extraObstacles]);
}
function assertGroundRoute(collision,route) {
  const points=route.map(p=>interior.localToWorld(p).slice(0,2));
  for(let i=1;i<points.length;i++) assert(!collision.pathBlocked(points[i-1],points[i]),'Clear route '+route[i-1]+' to '+route[i]);
}

test('study fits two independent occupied desks, clear of the door, window and opening cabinet fronts', () => {
  assert.equal(rooms.get('0.9').catalogueName,'Gabinet');
  const items=data.furniture.filter(item=>item.room==='0.9');
  assert.equal(items.filter(item=>item.type==='table').length,2);
  assert.equal(items.filter(item=>item.type==='chair').length,2);
  const bookcase=itemBounds('office-bookcase');
  const walk=groundWalk();
  for(const suffix of ['','-window']){
    const desk='office-desk'+suffix,chair='office-chair'+suffix;
    const top=bounds(interior.group.getObjectByName(desk+'-top')),seat=itemBounds(chair);
    close(top.max.x-top.min.x,1.38,'Independent full-width desktop');
    close(top.max.y-top.min.y,.75,'Monitor and keyboard depth');
    close(top.max.z,furniture.get(desk).worktopHeightM,'Desk height matches the finish schedule');
    for(const detail of ['t-foot-','lifting-column-base-','lifting-column-middle-','lifting-column-inner-','motor-']){
      assert.equal(parts(desk).filter(mesh=>mesh.name.startsWith(desk+'-'+detail)).length,2,desk+' '+detail);
    }
    for(const detail of ['control-panel','cable-tray'])assert(interior.group.getObjectByName(desk+'-'+detail));
    assert(seat.max.y<top.min.y && seat.min.x>top.min.x && seat.max.x<top.max.x);
    assert.equal(parts(chair).filter(mesh=>mesh.name.includes('-castor-')).length,5);
    assert(partCenter(chair,'seat').y>partCenter(chair,'back').y,'Chair faces worktop');
    assert(partCenter(desk,'display-0').z>partCenter(desk,'keycaps').z+.24);
    const taskShade=bounds(interior.group.getObjectByName(desk+'-task-lamp-shade'));
    for(const display of parts(desk).filter(mesh=>mesh.name.includes('-display-frame-'))){
      assert(!taskShade.intersectsBox(bounds(display)),'Desk lamp clears monitor bezel');
    }
    assert(partCenter(desk,'display-0').y>partCenter(desk,'keycaps').y);
    assert(seat.min.y-bookcase.max.y>=1.12-.001,'Passage remains behind occupied chairs');
    assert(top.min.x>=9.8+.94-.001,'Space in front of opening under-stair cabinets');
    assert(top.max.x<=13.61,'Worktops clear the side glazing');
    assert(!overlaps(furniture.get(desk).box,[9.89,9.42,10.79,10.32]),'Desk clears door swing');
    const x=seat.getCenter(new THREE.Vector3()).x;
    assertGroundRoute(walk,[[10.32,9.02],[10.32,10.24],[x,10.24],[x,10.48]]);
  }
  assertGroundRoute(walk,[[10.32,9.02],[10.32,11.93]]);
  assertGroundRoute(walk,[[10.32,9.02],[10.32,10.24],[13.76,10.24]]);
});

test('playroom keeps the folded sofa, a full pull-out and an approach beside the deployed bed', () => {
  const room=rooms.get('0.8'),sofa=furniture.get('guest-sofa-bed'),unfolded=sofa.unfoldedBox;
  assert.equal(room.catalogueName,'Pokój gościnny');
  assert.equal(sofa.facing,'-x');
  assert.deepEqual(unfolded.slice(1),sofa.box.slice(1),'Frame stays against its catalogue wall');
  close(unfolded[2]-unfolded[0],1.65,'Open frame depth');
  close(unfolded[3]-unfolded[1],2.10,'Open frame length');
  assert.deepEqual(sofa.sleepingSurface,[1.95,1.45]);
  assert(unfolded[0]>=room.box[0] && unfolded[1]>=room.box[1] && unfolded[2]<=room.box[2] && unfolded[3]<=room.box[3]);
  const otherItems=data.furniture.filter(item=>item.room==='0.8' && item.id!==sofa.id);
  for(const item of otherItems){
    assert(!overlaps(unfolded,item.box),item.id+' stays outside the deployed bed');
    assert(!overlaps([11.33,8.39,12.23,9.29],item.box),item.id+' clears the internal door swing');
  }
  close(unfolded[0]-furniture.get('guest-wardrobe').box[2],.79,'Passage beside deployed bed');
  assert(partCenter(sofa.id,'woven-throw').z>partCenter(sofa.id,'upholstered-frame').z);
  assert.equal(parts('guest-wardrobe').filter(o=>o.name.includes('-door-')).length,3);
  assert(partCenter('play-cubbies','basket-0').z<.3);
  assert.equal(parts('play-cubbies').filter(o=>o.name.includes('-stacking-ring-')).length,4);
  const rug=itemBounds('play-mat'),train=itemBounds('play-train');
  assert(train.min.x>rug.min.x && train.max.x<rug.max.x && train.min.y>rug.min.y && train.max.y<rug.max.y);
  assert.equal(parts('play-train').filter(o=>o.name.includes('-wheel-') && !o.name.includes('-groove-')).length,8);
  const [x0,y0,x1,y1]=unfolded;
  const ring=[[x0,y0],[x0,y1],[x1,y1],[x1,y0]].map(p=>interior.localToWorld(p).slice(0,2));
  const walk=groundWalk([{ring}]);
  assertGroundRoute(walk,[[10.90,8.85],[12.12,8.85],[12.12,7.65],[12.08,6.03],[12.08,5.05]]);
});

test('ground-floor shower admits a walker through its open end and stops them at the fixed glass', () => {
  const boundsOf=name=>bounds(interior.group.getObjectByName(name));
  const glass=boundsOf('ground-shower-glass'), tray=boundsOf('ground-shower-tray'), mirror=boundsOf('ground-bath-mirror');
  close(tray.max.y-glass.max.y,.70,'Clear shower entry');
  assert(glass.max.z>2 && mirror.min.z>boundsOf('ground-bath-bowl').max.z+.12);
  assert(boundsOf('ground-wc-flush-large').min.z>boundsOf('ground-wc-seat').max.z+.32);
  const p=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  const collision=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.70 && o.maxZ>.06));
  const approach=[p(9.83,8.38),p(9.83,7.52),p(8.97,7.52),p(8.97,6.84)];
  for(let i=1;i<approach.length;i++)assert(!collision.pathBlocked(approach[i-1],approach[i]),'Walk into the shower');
  assert(collision.pathBlocked(p(9.68,6.95),p(8.97,6.95)),'Fixed glass blocks a direct crossing');
});


test('walnut veneer is confined to two small day-zone accents', () => {
  const accents=interior.group.children.filter(mesh=>mesh.material?.name === 'Oiled walnut veneer');
  assert.deepEqual(accents.map(mesh=>mesh.name).sort(),[...data.metadata.finishSchedule.veneerApplications].sort());
  assert.equal(accents.length,2);
  for(const mesh of accents) assert.equal(furniture.get(mesh.userData.furnitureId).room,'0.4');
});

test('the downstairs bath finishes are confined to its own walls and keep the hall entrance clear', () => {
  const get=id=>interior.group.getObjectByName(id);
  const walkWall=bounds(get('bath-ground-plaster-hall-left')),farWall=bounds(get('bath-ground-plaster-hall-right'));
  close(farWall.min.x-walkWall.max.x,.90,'Bathroom doorway clear width');
  close(bounds(get('bath-ground-plaster-lintel')).min.z,2.10,'Bathroom doorway clear height');
  const tiles=get('bath-ground-wc-relief-glaze'),finish=tiles.material;
  assert(finish.map && finish.bumpMap && finish.roughness<.3);
  const tileBox=bounds(tiles),wc=bounds(get('ground-wc-flush-plate')),lamp=bounds(get('light-fixture-bath-sunburst-opal'));
  assert(tileBox.max.z<lamp.min.z && tileBox.max.z>wc.max.z && tileBox.min.x>wc.min.x);
  close(tileBox.min.x-wc.min.x,.0060,'Control plate projects beyond tile',.001);
  assert(!get('bath-ground-star-splash'));
  assert.equal(get('finish-0.7').material.name,'Limestone and clay terrazzo');
  assert.equal(get('finish-1.2').material.name,'Ochre and petrol compass-star porcelain');
  assert.equal(get('finish-1.6').material.name,'Honed shell-limestone porcelain');
  const room=rooms.get('0.7').box;
  for(const wall of interior.group.children.filter(o=>o.name.startsWith('bath-ground-plaster-'))){
    const b=bounds(wall);
    assert(b.min.x>=room[0] && b.max.x<=room[2] && b.min.y>=room[1] && b.max.y<=room[3]);
  }
});

test('every kitchen cabinet and concealed pantry door has the same matte yellow slab front', () => {
  const get=id=>interior.group.getObjectByName(id);
  const aisle=parts('kitchen-island').filter(o=>o.name.includes('-working-drawer-'));
  assert.equal(aisle.length,10);
  const portal=get('kitchen-pantry-closed-leaf'),yellow=portal.material;
  assert.equal(yellow.color.getHex(),0xe5c368);
  assert(yellow.roughness>=.6 && !yellow.map);
  const perimeter=['kitchen-pantry','kitchen-back','kitchen-tall'].flatMap(parts).filter(o=>
    /-(closed-leaf|left-front|right-front|front-\d-\d|crown-\d|upper-\d|oven-upper|oven-base|fridge)$/.test(o.name));
  assert.equal(perimeter.length,30);
  for(const door of [...perimeter,...aisle]){
    const face=bounds(door);
    close(face.max.y-face.min.y,.021,'Unframed 21 mm slab door');
    assert.equal(door.geometry.type,'BoxGeometry');
    assert.equal(door.material,yellow,door.name);
  }
  const grip=bounds(get('kitchen-island-working-pull-2-0')),drawer=bounds(get('kitchen-island-working-drawer-2-0'));
  close(grip.max.y,drawer.min.y,'Grip bears on upper edge of drawer');
  close(grip.max.z,drawer.max.z,'Top edge grip');
  assert(grip.min.y<drawer.min.y-.018);
});

test('Palet island tiles wrap three faces at physical scale with one draw and clear the aisle', () => {
  const get=id=>interior.group.getObjectByName(id);
  const skin=get('kitchen-island-palet-rain-cladding'),top=get('kitchen-island-top'),hob=get('hob-glass');
  const texture=skin.material.map,{position,normal,uv}=skin.geometry.attributes;
  assert.equal(skin.material.name,'Palet Rain 51 / 49');
  assert.equal(texture.wrapS,THREE.RepeatWrapping);assert.equal(texture.wrapT,THREE.RepeatWrapping);
  close(1/(texture.repeat.x*4),.149+.002,'Four 149 mm tiles with 2 mm grout per repeat');
  close(texture.repeat.x,texture.repeat.y,'Square tiles');
  const surface=bounds(skin),slab=bounds(top),drawers=bounds(get('kitchen-island-working-drawer-2-0'));
  assert.equal(top.material,get('kitchen-back-top').material);
  assert.notEqual(top.material,skin.material);
  close(bounds(hob).min.z,slab.max.z,'Hob sits on worktop');
  close(surface.max.z,slab.min.z,'Cladding reaches stone underside');
  close(surface.min.y,drawers.min.y,'Tile ends terminate at the drawer face');
  close(slab.max.y-surface.max.y,.018,'Stone overhang at salon face');
  assert.equal(position.count,12);assert.equal(skin.geometry.index.count,18);
  for(let face=0;face<3;face++){
    const i=face*4,xyz=j=>new THREE.Vector3().fromBufferAttribute(position,j);
    const direction=[[-1,0,0],[0,1,0],[1,0,0]][face];
    assert(new THREE.Vector3().fromBufferAttribute(normal,i).distanceTo(new THREE.Vector3(...direction))<.001);
    close(uv.getX(i+3)-uv.getX(i),xyz(i+3).distanceTo(xyz(i)),'Horizontal unwrapped metres');
    close(uv.getY(i+1)-uv.getY(i),xyz(i+1).distanceTo(xyz(i)),'Vertical unwrapped metres');
    if(i)close(uv.getX(i),uv.getX(i-1),'Pattern continues around corner');
  }
});

test('Yoffers cabinet has catalogue dimensions, curved tambour ends, a plain back and four inset oak legs', () => {
  const get=id=>interior.group.getObjectByName('media-console-'+id);
  const all=itemBounds('media-console'),size=all.getSize(new THREE.Vector3()),top=bounds(get('top'));
  close(size.y,1.60,'Catalogue width');close(size.x,.45,'Catalogue depth');close(size.z,.48,'Catalogue height');
  close(all.getCenter(new THREE.Vector3()).y,data.projection.centerY,'Cabinet centered under the image');
  assert(top.max.z<data.projection.centerHeightM-data.projection.heightM/2-.4,'Image clears the cabinet');
  const slats=get('body'),back=bounds(get('plain-back')),p=slats.geometry.attributes.position;
  assert(slats.material.map && slats.material.vertexColors);
  const r=size.x/2,front=[],ends=[];
  for(let i=0;i<p.count;i+=2){
    const x=p.getX(i),y=p.getY(i);
    if(x>r+.006 && x<size.y-r-.006)front.push(y);
    if(x<r-.01 || x>size.y-r+.01)ends.push(y);
  }
  assert(Math.max(...front)-Math.min(...front)>.004 && Math.max(...front)-Math.min(...front)<.008);
  assert(front.length>160 && Math.max(...ends)-Math.min(...ends)>.43,'Continuous physical fluting wraps both ends');
  close(back.max.y-back.min.y,1.60-.45,'Straight back between capsule ends');
  for(const leg of parts('media-console').filter(o=>o.name.includes('dowel-leg'))){
    const b=bounds(leg);
    close(b.min.z,0,'Leg bears on floor');close(b.max.z,bounds(get('bottom-rim')).min.z,'Leg supports lower shelf');
    assert(b.min.x>all.min.x+.04 && b.max.x<all.max.x-.04 && b.min.y>all.min.y+.14 && b.max.y<all.max.y-.14);
  }
  assert.equal(parts('media-console').filter(o=>o.name.includes('dowel-leg')).length,4);
  assert.equal(parts('media-console').filter(o=>o.name.includes('side-stretcher')).length,2);
  const point=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  const walk=createWalkCollision(interior.navigation.obstacles.filter(o=>o.id==='furniture-media-console'));
  assert(walk.pathBlocked(point(1.35,14.48),point(.66,14.48)));
});

test('study library and matching striped pug nests retain their floor space and access', () => {
  const library=itemBounds('office-bookcase');
  close(library.max.x-library.min.x,2.15,'Fitted width');
  close(library.max.z,2.76,'Fitted height');
  close(library.max.y,9.68,'Storage front');
  const ground=itemBounds('office-pug-bed'),upper=itemBounds('master-pug-bed'),human=itemBounds('master-bed');
  const ids=data.furniture.filter(f=>f.type==='pet-bed').map(f=>f.id).sort();
  assert.deepEqual(ids,['master-pug-bed','office-pug-bed']);
  const officeParts=parts('office-pug-bed'),bedroomParts=parts('master-pug-bed');
  assert.equal(officeParts.length,bedroomParts.length);
  for(const office of officeParts){
    const other=bedroomParts.find(mesh=>mesh.name===office.name.replace('office-','master-'));
    assert(other && office.material===other.material);
    const a=office.geometry.attributes.position.array,b=other.geometry.attributes.position.array;
    assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++)close(a[i],b[i],'Matching local fabric form');
  }
  const bolster=officeParts.find(part=>part.name.endsWith('-radial-panel-bolster'));
  const nest=officeParts.find(part=>part.name.endsWith('-nesting-cushion'));
  assert(bounds(bolster).max.z-bounds(nest).max.z>.06, 'Dog rests inside a deep padded rim');
  const stripe=bolster.material.map.image,at=u=>{
    const i=(Math.floor(stripe.height*.5)*stripe.width+Math.floor(u*stripe.width))*4;
    return Array.from(stripe.data.slice(i,i+3));
  };
  const red=at(.25),blue=at(.75);
  assert(red[0]>red[2]+90 && blue[2]>blue[0]+25);
  close(bolster.material.map.repeat.x,12,'Twelve tomato and blue pairs around each ring');
  close(ground.min.z,0,'Office bed on floor');
  close(upper.min.z,3.20,'Bedroom bed on floor');
  close(upper.max.z-upper.min.z,.18,'Low rounded bed');
  close(human.min.x-upper.max.x,.04,'Against side of master bed');
  close(upper.min.x-rooms.get('1.8').box[0],.65,'Passable beside pet bed');
  close(itemBounds('master-bedside-left').min.y-upper.max.y,.49,'Nightstand approach');
  const curtain=bounds(interior.group.getObjectByName('curtain-study-left'));
  assert(!curtain.intersectsBox(ground),'Study drape falls clear of bed');
  const office=groundWalk();
  assertGroundRoute(office,[[10.32,9.02],[10.32,10.24],[13.72,10.24]]);
  const master=createWalkCollision(interior.navigation.obstacles.filter(o=>o.maxZ>3.24 && o.minZ<4.85));
  for(const route of [
    [[9.47,8.68],[10.31,8.68],[10.265,9.45],[10.265,11.57]],
    [[10.31,8.68],[12.98,8.68],[13.66,9.41],[13.66,11.54]],
    [[10.31,8.68],[10.45,8.40],[10.45,7.55]],
    [[12.98,8.68],[12.98,7.50]]
  ])assertGroundRoute(master,route);
});


test('each room has a Loft light switch and a grounded or covered outlet fixed to a solid surface', () => {
  const {points,frameDiameterM}=data.electrical;
  close(frameDiameterM,.081,'Single round JLM frame diameter');
  for(const room of rooms.keys()){
    const mounts=points.filter(m=>m.room===room);
    assert(mounts.some(m=>m.type==='switch'),room+' switch');
    assert(mounts.some(m=>m.type==='socket'||m.type==='covered'),room+' outlet');
  }
  interior.group.updateWorldMatrix(true,true);
  for(const [i,mount] of points.entries()){
    const frame=interior.group.getObjectByName('loft-fixture-'+i+'-frame');
    const support=interior.group.getObjectByName(mount.support);
    const axis=mount.normal[1],along=axis==='x'?'y':'x',sign=mount.normal[0]==='+'?1:-1;
    const dir=new THREE.Vector3();dir[axis]=sign;
    const frameBox=bounds(frame),center=frameBox.getCenter(new THREE.Vector3());
    close(frameBox.max[along]-frameBox.min[along],frameDiameterM,'Frame width '+i,.0005);
    close(center[along],mount.alongM,'Tangential position '+i,.001);
    close(center.z,mount.heightM+(mount.room.startsWith('1.')?data.levels.upper:0),'Installed height '+i,.001);
    for(const edge of [-.034,0,.034]){
      const start=center.clone().addScaledVector(dir,.085);
      start[along]+=edge;
      const ray=new THREE.Raycaster(start.applyMatrix4(interior.group.matrixWorld),dir.clone().negate().transformDirection(interior.group.matrixWorld),0,.12);
      const hits=ray.intersectObject(support,false);
      assert(hits.length,'Frame '+i+' needs a solid support at '+mount.support+', offset '+edge);
      const others=interior.group.children.filter(obj=>obj.isMesh && obj!==support && !obj.name.startsWith('loft-fixture-'));
      const inFront=ray.intersectObjects(others,false).find(hit=>hit.distance<hits[0].distance-.010);
      assert(!inFront,'Frame '+i+' obscured by '+inFront?.object.name+' at '+mount.support);
    }
  }
});

test('the vestibule routes clear the new console, ottoman and fitted wardrobes', () => {
  const point=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  const collider=createWalkCollision(interior.navigation.obstacles.filter(o=>o.maxZ>.08 && o.minZ<1.75));
  for(const [id,a,b] of [
   ['outer threshold through glazed vestibule door',[7.45,4.30],[7.45,8.34]],
   ['front to garage',[7.45,5.44],[6.22,5.44]],
   ['cross the pocket in front of wardrobes',[7.45,5.18],[10.27,5.18]],
   ['stand in front of console',[7.45,6.97],[7.81,6.97]],
  ]){
   assert(!collider.pathBlocked(point(...a),point(...b)),id);
  }
  const [consoleBox,pouf]=['entry-console','entry-pouf'].map(id=>furniture.get(id).box);
  close(consoleBox[0]-pouf[2],1.08,'Clear across opposing furniture');
  const border=interior.group.getObjectByName('entry-mitred-tile-border');
  const pos=border.geometry.getAttribute('position'),uv=border.geometry.getAttribute('uv');
  assert.equal(pos.count,36);
  for(let edge=0;edge<6;edge++){
   const next=(edge+1)%6, i=edge*6,j=next*6;
   close(pos.getX(i+1),pos.getX(j),'closed outer x');
   close(pos.getY(i+1),pos.getY(j),'closed outer y');
   close(pos.getX(i+2),pos.getX(j+5),'closed inner x');
   close(pos.getY(i+2),pos.getY(j+5),'closed inner y');
   close(uv.getX(i+1)%1,0,'continuous integer number of rosettes');
  }
  assert.equal(parts('entry-console').filter(m=>m.name.includes('-hemisphere-')).length,4);
  assert.equal(parts('entry-console').filter(m=>m.name.includes('-slab-support-')).length,2);
  assert.equal(parts('entry-pouf').filter(m=>m.name.endsWith('-padded-seat')).length,1);
  const floor=interior.group.getObjectByName('finish-0.6').material.map.image;
  const sample=(u,v)=>floor.data[(Math.floor(v*floor.height)*floor.width+Math.floor(u*floor.width))*4];
  assert(sample(.5,.5)>200 && sample(.02,.02)>200 && sample(.26,.31)<65);
  assert(sample(.31,.5)>200 && sample(.19,.5)<65);
});

test('powder blue modules and garden chaise carry two accent pillows above a carmine Persian carpet', () => {
  const get = name => interior.group.getObjectByName(name);
  const cover=get('sofa-seat').material;
  const sample=(map,u,v)=>{
    const {width,height,data}=map.image,idx=4*(Math.floor(v*height)*width+Math.floor(u*width));
    return Array.from(data.slice(idx,idx+3));
  };
  const powder=sample(cover.map,.5,.5);
  assert(powder[2]>powder[0]+22 && powder[0]>135 && cover.roughness>.8);
  for(const part of [...parts('sofa'),...parts('chaise')].filter(m=>!m.name.includes('-scatter-') && !m.name.endsWith('recessed-foot'))){
    assert.equal(part.material,cover,part.name);
    assert(part.geometry.hasAttribute('uv'),part.name+' has fabric coordinates');
  }
  for(const id of ['sofa','chaise']){
    const deck=bounds(get(id+'-upholstered-deck')),plinth=bounds(get(id+'-recessed-foot'));
    assert.equal(get(id+'-upholstered-deck').material,cover);
    assert(deck.min.z<.02 && deck.max.z>.2 && plinth.max.z<deck.min.z+.02);
    assert(deck.min.x<plinth.min.x-.11 && deck.max.x>plinth.max.x+.11);
    assert(deck.min.y<plinth.min.y-.11 && deck.max.y>plinth.max.y+.11);
  }
  const deck=bounds(get('sofa-upholstered-deck'));
  for(const id of ['sofa-seat-0','sofa-seat','sofa-seat-2'])assert(deck.intersectsBox(bounds(get(id))));
  assert.equal(get('sofa-upholstered-backing').material,cover);
  const striped=get('sofa-scatter-striped'),olive=get('sofa-scatter-round-olive');
  const cream=sample(striped.material.map,.075,.51),wine=sample(striped.material.map,.180,.51);
  assert(cream[0]>200 && cream[1]>175 && wine[0]>wine[1]*1.8 && wine[0]<135);
  const green=sample(olive.material.map,.5,.5);
  assert(green[0]>green[2]+25 && green[1]>green[2]+25);
  const round=bounds(olive).getSize(new THREE.Vector3());
  assert(round.y>2*round.x*.8 && Math.abs(round.z-round.y)<.07, 'Olive pillow has a round face');
  const rug=get('living-rug-woven'),map=rug.material.map;
  const counts={carmine:0,black:0,cream:0,gold:0};
  for(let x=0;x<100;x++)for(let y=0;y<100;y++){
    const u=(x+.5)/100,v=(y+.5)/100,[r,g,b]=sample(map,u,v);
    const edge=Math.min(u,1-u,v,1-v);
    if(edge>.19 && r>g*1.70 && r>b*1.35)counts.carmine++;
    if(edge<.13 && r<75 && g<68 && b<68)counts.black++;
    if(edge<.16 && r>167 && g>135 && b>100)counts.cream++;
    if(edge>.19 && r>145 && g>92 && b<g*.90)counts.gold++;
  }
  assert(counts.carmine>950 && counts.black>350 && counts.cream>450 && counts.gold>200,JSON.stringify(counts));
  const fringe=bounds(get('living-rug-knotted-fringe')),field=bounds(rug);
  assert(fringe.min.y<field.min.y && fringe.max.y>field.max.y,'Fringe extends beyond both short ends');
});

test('the private bath ledge blocks walking and vessels sit on the exposed family bath shelf', () => {
  const collider=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<4.70 && o.maxZ>3.26));
  const point=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  assert(collider.pathBlocked(point(11,5.83),point(11,5.14)));
  const shelf=bounds(interior.group.getObjectByName('bath-family-tub-shelf'));
  const wall=bounds(interior.group.getObjectByName('upper-main-side'));
  for(const name of ['bath-family-ochre-jar','bath-family-pale-bud-vase']){
    const vase=bounds(interior.group.getObjectByName(name));
    assert(vase.min.x>wall.max.x && vase.max.x<=shelf.max.x);
    close(vase.min.z,shelf.max.z,'Vessel is supported by shelf');
  }
});
