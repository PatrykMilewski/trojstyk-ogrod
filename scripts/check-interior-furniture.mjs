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
const [, garden, house] = JSON.parse(html.slice(start, html.indexOf(';\nconst landscaping=', start)));
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

test('the custom MADOX-style table seats six around a 135 × 78 cm closed walnut top', () => {
  const get = id => interior.group.getObjectByName(id);
  const top = get('dining-table-solid-top'), table = bounds(top), center = table.getCenter(new THREE.Vector3());
  close(table.max.x-table.min.x, .78, 'Custom width');
  close(table.max.y-table.min.y, 1.35, 'Closed length');
  close(table.max.z, .75, 'Finished height');
  close(table.max.z-table.min.z, .020, 'Veneered top thickness');
  assert.match(top.material.name, /MADOX.*walnut/);
  assert(top.material.map);
  const legs = parts('dining-table').filter(part => part.name.includes('-splayed-leg-'));
  assert.equal(legs.length, 4);
  const stance = new THREE.Box3();
  for (const leg of legs) stance.union(bounds(leg));
  close(stance.min.z, 0, 'Feet meet floor');
  close(stance.max.z, .64, 'Exposed leg height');
  close(stance.max.x-stance.min.x, .75, 'Leg stance across table');
  close(stance.max.y-stance.min.y, 1.24, 'Leg stance along table');
  close(partCenter('dining-table','butterfly-joint').y,center.y,'Joint centered across short axis');
  const bowl=bounds(get('dining-table-pottery-bowl'));
  close(bowl.min.z,table.max.z,'Pottery rests on top',.001);
  for (const axis of ['x','y']) close(bowl.getCenter(new THREE.Vector3())[axis],center[axis],'Centerpiece aligns');
  for (let n=1;n<=3;n++) {
    const lamp=bounds(get('dining-lantern-'+n+'-washi')).getCenter(new THREE.Vector3());
    assert(lamp.x>table.min.x && lamp.x<table.max.x && lamp.y>table.min.y && lamp.y<table.max.y);
  }
  const signatures = {wishbone:'fork-1', cane:'cane-panel', windsor:'fan-spindle-0', ladder:'lower-slat', upholstered:'back', bentwood:'inner-loop'};
  const chairs = data.furniture.filter(item => item.chairStyle);
  assert.deepEqual(chairs.map(item=>item.facing).sort(),['+x','+x','+y','-x','-x','-y']);
  assert.deepEqual(chairs.map(item=>item.chairStyle).sort(),Object.keys(signatures).sort());
  for (const item of chairs) {
    assert(get(item.id+'-'+signatures[item.chairStyle]),item.id+' distinctive back');
    const seat=bounds(get(item.id+'-seat')),back=bounds(get(item.id+'-back'));
    const axis=item.facing[1],positive=item.facing[0]==='+',cross=axis==='x'?'y':'x';
    const tuck=positive?seat.max[axis]-table.min[axis]:table.max[axis]-seat.min[axis];
    assert(tuck>=.10 && tuck<=.15,item.id+' cushion tucks under the top');
    assert(positive?back.max[axis]<table.min[axis]:back.min[axis]>table.max[axis],item.id+' back remains outside the top');
    assert(seat.max.z>.45 && stance.max.z-seat.max.z>.15,item.id+' has thigh clearance below the apron');
    const sideOffset=Math.abs(seat.getCenter(new THREE.Vector3())[cross]-center[cross]);
    if(axis==='y') close(sideOffset,0,'End chair centered');
    else close(sideOffset,.275,'Side pair distributed symmetrically');
    assert.equal(parts(item.id).filter(part=>part.name.includes('-tapered-leg-')).length,4);
  }
  assert(!data.furniture.some(item => item.room === '0.4' && item.type === 'stool'));
  assert(!interior.group.children.some(object => object.name.startsWith('island-stool-')));
  assert(!interior.navigation.obstacles.some(obstacle => obstacle.id.includes('island-stool-')));
});

test('an 80 cm walking route circles the dining table with all six chairs tucked in', () => {
  const walk = createWalkCollision(interior.navigation.obstacles.filter(o => o.minZ < 1.85 && o.maxZ > .04), .40);
  const route = [[4.72,12.39], [7.42,12.39], [7.42,15.95], [4.72,15.95], [4.72,12.39]]
    .map(point => interior.localToWorld(point).slice(0,2));
  for (let i = 1; i < route.length; i++) assert(!walk.pathBlocked(route[i-1], route[i]));
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
    const direction=item.id==='kitchen-island'?{facing:'-y'}:item;
    for (const handle of parts(item.id).filter(object => object.name.includes('-handle-'))) {
      assert(facingProjection(direction, bounds(handle).getCenter(new THREE.Vector3())) > facingProjection(direction, body), item.id + ' handles face outward');
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

test('plant equipment fits room 0.3, with both service sides reachable around its open garage door', () => {
  const signature = {
    'dhw-cylinder':['insulated-vessel','access-cover','top-union-1'],
    'heat-pump-module':['hydronic-casing','controller-display','encoder','tank-connection-1'],
    'utility-water-meter':['meter-body','totalizer','isolation-1'],
    'utility-softener':['brine-cabinet','salt-lid','valve-head'],
    'utility-hrv':['counterflow-casing','filter-drawer','condensate-outlet'],
    'utility-pv-inverter':['heat-sink','indicator-window','cable-gland-3'],
    'utility-network-rack':['perforated-door-insert','vented-side-1','router','ethernet-switch','patch-panel','patch-lead-3'],
  };
  assert.deepEqual(data.furniture.filter(item=>item.room==='0.3').map(item=>item.id).sort(),Object.keys(signature).sort());
  for(const [id,details] of Object.entries(signature)){
    for(const suffix of details)assert(interior.group.getObjectByName(id+'-'+suffix)?.isMesh);
    assert(itemBounds(id).max.x<=6.44+.001,'Equipment stays clear of the room-side face of the eastern partition');
  }
  const get=name=>interior.group.getObjectByName(name);
  assert(get('utility-network-rack-perforated-door-insert').material.alphaMap);
  assert.equal(parts('utility-network-rack').filter(o=>o.name.startsWith('utility-network-rack-rj45-')).length,20);
  for(let i=0;i<4;i++)close(bounds(get('utility-hrv-air-duct-'+i)).max.z,2.8,'Four duct runs meet ceiling',.002);
  close(itemBounds('dhw-cylinder').min.z,.008,'Vessel plinth rests on tiled floor');
  close(itemBounds('utility-softener').min.z,.008,'Softener base rests on tiled floor');
  const pivot=get('hall-flush-garage-utility'),openMatrix=new THREE.Matrix4().makeRotationZ(pivot.userData.closedYaw+pivot.userData.swing*Math.PI/2);
  openMatrix.setPosition(pivot.position);
  const door=pivot.children.reduce((result,mesh)=>result.union(bounds(mesh).applyMatrix4(openMatrix)),new THREE.Box3());
  const ring=[[door.min.x,door.min.y],[door.max.x,door.min.y],[door.max.x,door.max.y],[door.min.x,door.max.y]].map(p=>interior.localToWorld(p).slice(0,2));
  const walk=groundWalk([{ring}]);
  assertGroundRoute(walk,[[5.10,6.25],[5.10,7.45],[4.64,7.41],[4.67,7.19]]);
  assertGroundRoute(walk,[[5.10,7.45],[5.20,7.66],[5.36,7.77],[5.53,7.77],[5.68,7.74],[5.77,7.72],[5.84,7.66],[5.88,7.60],[5.90,7.50]]);
});

test('the Thermatec outdoor unit faces the unobstructed road side of the garage',()=>{
  const outdoor=data.outdoorHeatPump,piece=suffix=>interior.group.getObjectByName(outdoor.id+'-'+suffix);
  const cabinet=bounds(piece('weatherproof-cabinet')).union(bounds(piece('intake-surround-front')));
  const feet=bounds(piece('mounting-rail-0'));
  const grille=bounds(piece('discharge-louvres')),intake=bounds(piece('rear-exchanger-fins'));
  close(cabinet.max.y-cabinet.min.y,1.167,'Thermatec casing width',.001);
  close(intake.max.x-grille.min.x,.407,'Thermatec casing depth',.001);
  close(cabinet.max.z-feet.min.z,.795,'Thermatec overall equipment height',.001);
  const hub=partCenter(outdoor.id,'fan-hub');
  assert(hub.y>=rooms.get('1.2').box[1] && hub.y<=rooms.get('1.2').box[3],'Fan aligns with upper bathroom');
  assert(-intake.max.x>.50 && feet.min.z>.30,'Rear intake and height above grade exceed manual clearances');
  assert(grille.max.x<bounds(piece('fan-hub')).min.x && piece('fan-blade-2').isMesh);
  assert(piece('weatherproof-cabinet').material.name.includes('matte black'));
  interior.group.updateMatrixWorld(true);
  const towardSide=new THREE.Vector3(0,1,0).transformDirection(interior.group.matrixWorld);
  const sideHit=z=>{
    const eye=new THREE.Vector3(-.70,outdoor.box[1]-.20,z).applyMatrix4(interior.group.matrixWorld);
    return new THREE.Raycaster(eye,towardSide,0,.5).intersectObjects(parts(outdoor.id))[0];
  };
  const rib=sideHit(.718),gap=sideHit(.725);
  assert.equal(rib?.object,piece('side-intake-fins'),'Side louvres are visible from outside the cabinet');
  assert.equal(gap?.object,piece('intake-plenum'),'Intake opening shows the recessed plenum between fins');
  assert(gap.distance-rib.distance>.015,'Side intake has a real recess');
  const frame=interior.group.matrix.clone().invert();
  const strip=new THREE.Box3(new THREE.Vector3(grille.min.x-1.50,cabinet.min.y,-.01),
    new THREE.Vector3(grille.min.x,cabinet.max.y,.01));
  const local=([x,y])=>new THREE.Vector3(x,y,0).applyMatrix4(frame);
  for(const bed of garden.polygons.filter(item=>item.kind==='planting')){
    const ring=bed.ring.map(local);
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],direction=b.clone().sub(a);
      assert(!strip.containsPoint(a),'No planting in front of the grille');
      if(direction.lengthSq()===0)continue;
      const hit=new THREE.Ray(a,direction.clone().normalize()).intersectBox(strip,new THREE.Vector3());
      assert(!hit||a.distanceToSquared(hit)>direction.lengthSq(),'Discharge strip stays outside planting beds');
    }
  }
  const facade=data.facades.find(wall=>wall.id==='facade-main-side');
  assert(facade.openings.every(o=>o.end<cabinet.min.y-1 || o.start>cabinet.max.y+1));
  const exterior=itemBounds(outdoor.id);
  assert(exterior.max.x<=.001 && exterior.min.x>=outdoor.box[0] && exterior.max.y<6.53);
  assert(interior.navigation.obstacles.some(o=>o.id===outdoor.id));
  close(bounds(piece('rubber-foot-0')).min.z,bounds(piece('precast-support-0')).max.z,'Isolators bear on concrete');
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
  close(guard.min.x, 4.91, 'Rail starts at hall'); close(guard.max.x, data.rails.find(r=>r.id==='upper-void-edge').b[0], 'Rail ends at inset corner');
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

test('five under-stair doors and their fitted fascias share a continuous figured veneer', () => {
  const cabinets = data.furniture.filter(item => item.id.startsWith('office-under-stair-'));
  const leaves = cabinets.flatMap(item => parts(item.id).filter(mesh => mesh.name.includes('-door-')));
  const fascias = cabinets.map(item => interior.group.getObjectByName(item.id + '-filler'));
  assert.equal(leaves.length, 5);
  const veneer = leaves[0].material;
  assert.match(veneer.userData.source, /sekcja 05/);
  assert.equal(veneer.map.wrapS, THREE.MirroredRepeatWrapping);
  const { data: pixels, width, height } = veneer.map.image;
  assert.ok(width >= 128 && height >= 256);
  const tones = new Set();
  for (let i = 0; i < pixels.length; i += 4) tones.add(pixels[i]);
  assert.ok(Math.min(...tones) < 50 && Math.max(...tones) > 215 && tones.size >= 15);
  for (const face of [...leaves, ...fascias]) {
    assert.equal(face.material, veneer);
    const { position, normal, uv } = face.geometry.attributes;
    let visibleVertices = 0;
    for (let i = 0; i < position.count; i++) {
      if (normal.getX(i) < .99) continue;
      close(uv.getX(i) * 1.78, face.position.y + position.getY(i), 'Grain continues across leaves');
      close(uv.getY(i) * 2.84, face.position.z + position.getZ(i), 'Grain continues up fitted fascia');
      visibleVertices++;
    }
    assert.ok(visibleVertices >= 3, face.name + ' presents veneer toward office');
  }
  for (const item of cabinets) {
    const leaf = parts(item.id).find(mesh => mesh.name.includes('-door-'));
    const handle = parts(item.id).find(mesh => mesh.name.includes('-handle-'));
    close(bounds(leaf).max.x, bounds(interior.group.getObjectByName(item.id + '-filler')).max.x, 'Flush scribed front');
    close(bounds(handle).max.x, item.box[2], 'Pull stays within cabinet footprint');
  }
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

test('the kitchen tower beside the pantry houses the Qrevo and opens without blocking its floor-level route', () => {
  const {group,robotCabinet,navigation}=interior,get=name=>group.getObjectByName(name);
  const part=name=>bounds(get(name)),shell=part('kitchen-robot-curv-dock-shell').union(part('kitchen-robot-wash-tray'));
  const robot=part('kitchen-robot-robot-bumper').union(part('kitchen-robot-robot-base')).union(part('kitchen-robot-robot-lid'));
  for(const [box,dims] of [[shell,[.45,.45,.45]],[robot,[.35,.352,.0798]]])
    box.getSize(new THREE.Vector3()).toArray().forEach((v,i)=>close(v,dims[i],'Appliance envelope'));
  assert(!inventoryMeshes.some(mesh=>mesh.name.startsWith('landing-service')||mesh.name.startsWith('landing-av')));
  assert(!navigation.obstacles.some(o=>o.id.startsWith('landing-service')));
  const left=part('kitchen-pantry-robot-side-left'),right=part('kitchen-pantry-robot-side-right');
  const shelf=part('kitchen-pantry-robot-shelf-0'),door=get('kitchen-pantry-left-front'),doorBox=bounds(door);
  const mid=shell.getCenter(new THREE.Vector3()).x,front=doorBox.max.y;
  assert.equal(door.material,get('kitchen-pantry-closed-leaf').material);
  assert(doorBox.max.x<part('kitchen-pantry-closed-leaf').min.x);
  close(right.min.x-left.max.x,.514,'Clear tower width');
  close(left.max.z,2.8,'Full-height tower');
  close(shell.min.z,0,'Directly on kitchen floor');
  assert(shell.min.x>left.max.x && shell.max.x<right.min.x && shell.max.y<front-.021);
  assert(shelf.min.z>=.9 && shelf.min.z-shell.max.z>=.45,'Clearance above the dock for tank access');
  const shelfHeights=data.furniture.find(item=>item.id==='kitchen-pantry').robotCabinet.shelfHeightsM;
  for(const [i,height] of shelfHeights.entries())close(part('kitchen-pantry-robot-shelf-'+i).min.z,height,'Open shelving');
  const slotLeft=part('kitchen-pantry-robot-slot-left'),slotRight=part('kitchen-pantry-robot-slot-right');
  close(slotRight.min.x-slotLeft.max.x,.48,'Front opening width');
  close(doorBox.min.z,.135,'Floor-level opening height');
  const camera=new THREE.PerspectiveCamera(52,1,.02,10);camera.up.set(0,0,1);
  const world=p=>new THREE.Vector3(...interior.localToWorld(p));
  function rays(from,dir,length){
    group.updateWorldMatrix(true,true);
    return new THREE.Raycaster(world(from),new THREE.Vector3(...dir).transformDirection(group.matrixWorld),.00001,length)
      .intersectObjects(group.children,true);
  }
  function aim(eye,target){
    camera.position.copy(world(eye));camera.lookAt(world(target));camera.updateMatrixWorld(true);
    return robotCabinet.toggleAt(new THREE.Vector2(0,0),camera);
  }
  for(const x of [mid-.234,mid-.174,mid,mid+.174,mid+.234])for(const z of [.006,.089,.128])
    assert.equal(rays([x,shell.max.y+.002,z],[0,1,0],1.20).length,0,'Continuous passage past the closed front');
  for(const x of [mid-.195,mid+.195])for(const y of [shell.min.y+.04,shell.max.y-.04])
    assert.equal(rays([x,y,shell.max.z+.002],[0,0,1],.448).length,0,'Tanks lift clear');
  const obstacle=navigation.obstacles.find(o=>o.id==='kitchen-robot-cabinet-door'),closed=structuredClone(obstacle.ring);
  const target=[mid,front,1.0],eye=[mid+.12,10.65,1.34],dockTarget=shell.getCenter(new THREE.Vector3());
  function visible(p){
    const start=new THREE.Vector3(...eye),direction=p.clone().sub(start);
    return rays(eye,direction.clone().normalize().toArray(),direction.length()+.03)[0]?.object;
  }
  assert.equal(visible(dockTarget),door,'Closed door conceals the tanks');
  assert(!aim([mid,front-.78,1.34],target),'Pantry wall prevents clicking through from behind');
  assert(!aim([mid,front+.12,1.5],target),'Leaf cannot sweep through the viewer');
  assert(aim(eye,target) && robotCabinet.isOpen,'The visible yellow door opens on click');
  assert.notDeepEqual(obstacle.ring,closed,'Walk collision follows the real door');
  assert.equal(visible(dockTarget),get('kitchen-robot-curv-dock-shell'));
  for(const z of [.15,.50,.85])for(const x of [mid-.229,mid,mid+.229])
    assert.equal(rays([x,shell.max.y+.002,z],[0,1,0],1.2-.45).length,0,'Manufacturer approach envelope with door open');
  assert(aim([1.18,10.45,1.25],[.516,9.56,1.0]) && !robotCabinet.isOpen,'The visible open door closes on tap');
  assert.deepEqual(obstacle.ring,closed);
});

test('the robot tower and adjacent walking door operate independently in the batched scene', async () => {
  const scene=new THREE.Scene(),model=addIconInterior({THREE,scene,house,data});
  const {batchStaticInteriorDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
  batchStaticInteriorDetails(THREE,model.group);scene.updateMatrixWorld(true);
  const camera=new THREE.PerspectiveCamera(55,1,.02,30);camera.up.set(0,0,1);
  const world=p=>new THREE.Vector3(...model.localToWorld(p));
  const pantry=model.group.getObjectByName('concealed-pantry-door');
  function tap(eye,target){
    camera.position.copy(world(eye));camera.lookAt(world(target));camera.updateMatrixWorld();
    model.updateHallDoors(camera.position);scene.updateMatrixWorld(true);
    return model.robotCabinet.toggleAt({x:0,y:0},camera);
  }
  assert(!tap([1.46,10.65,1.40],[1.85,9.19,1.05]),'The pantry passage does not toggle the robot cabinet');
  assert(tap([1.10,10.65,1.34],[.775,9.191,1.0]) && model.robotCabinet.isOpen);
  model.updateHallDoors(world([1.50,9.30,1.60]));
  close(pantry.rotation.z,Math.PI/2,'Walking to the pantry opens the independent passage');
  assert(model.robotCabinet.isOpen);
  assert(tap([1.18,10.45,1.25],[.516,9.56,1.0]) && !model.robotCabinet.isOpen);
});

test('Apple TV 4K sits in a separate holder on the projector wall mount side', () => {
  const get=id=>interior.group.getObjectByName('projector-'+id),av=bounds(get('apple-tv-4k'));
  av.getSize(new THREE.Vector3()).toArray().forEach((v,i)=>close(v,[.031,.093,.093][i],'Apple TV in portrait holder'));
  const cradle=bounds(get('apple-tv-cradle')),bracket=bounds(get('apple-tv-bracket'));
  close(cradle.max.z,av.min.z,'Holder supports the bottom edge');
  close(bracket.min.x,av.max.x,'Player sits against the mounting plate');
  close(bracket.max.x,bounds(get('anchor-plate')).max.x,'Holder bears on same solid wall as projector');
  assert.equal(get('apple-tv-4k').parent.name,'living-room-projector');
  assert(get('apple-tv-hdmi') && get('apple-tv-power'));
  assert(av.min.y>bounds(get('case')).max.y && av.min.z>2.5);
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
  close(Math.max(...segments.map(s=>bounds(s).max.y)),data.stairs.box[3],'Backing reaches the rear wall');
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
    for (const detail of ['bowl','drain','tap','vanity']) assert(get(id+'-'+detail));
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

test('Samsung columns preserve product envelopes, removable shelves, drawers and door bins', () => {
  const get=id=>interior.group.getObjectByName(id);
  for(const [i,id,model,shelves,drawers,bins] of [
    [0,'fridge','BRR29703EWW/EF',4,3,4],[1,'freezer','BRZ22700EWW/EF',2,5,0],
  ]){
    const body=get('kitchen-'+id+'-body'),door=get('kitchen-'+id+'-door'),prefix='kitchen-tall-'+id+'-';
    assert.equal(body.userData.appliance,id);assert.equal(door.userData.model,model);
    assert.equal(body.parent,interior.group);assert.equal(door.parent,interior.group);
    const casing=bounds(get(prefix+'back')),skin=bounds(get(prefix+'door-white-skin'));
    close(casing.max.x-casing.min.x,.54,'540 mm appliance width');
    close(casing.max.z-casing.min.z,1.775,'1775 mm appliance height');
    close(skin.max.y-casing.min.y,.55,'550 mm appliance depth');
    const list=body.getObjectsByProperty('isMesh',true);
    assert.equal(list.filter(o=>/shelf-\d+$/.test(o.name)).length,shelves);
    assert.equal(list.filter(o=>/drawer-\d+-front$/.test(o.name)).length,drawers);
    const moving=door.getObjectsByProperty('isMesh',true);
    assert.equal(moving.filter(o=>/bin-\d+-front$/.test(o.name)).length,bins);
    assert(moving.every(o=>o.userData.dynamic));
    const face=bounds(get('kitchen-tall-'+id)),x=(face.min.x+face.max.x)/2;
    const upper=bounds(get('kitchen-back-upper-4')),crown=bounds(get('kitchen-back-crown-4'));
    close(face.max.z,upper.max.z,'Appliance fronts share the 2.10 m kitchen seam');
    close(bounds(get('kitchen-tall-crown-'+i)).min.z,crown.min.z,'Upper cabinet doors align');
    close(face.max.x-face.min.x,.594,'Two 3 mm edge reveals in each nominal 600 mm module');
    close(x,5.55+i*.60,'600 mm column centres');
    const shelf=bounds(get(prefix+'dry-shelf')),roof=bounds(get(prefix+'dry-ceiling'));
    assert(shelf.min.z>skin.max.z && roof.min.z-shelf.max.z>=.15);
    close(shelf.max.x-shelf.min.x,.573,'Dry shelf clears the outer cheek and centre divider');
    assert(shelf.max.y-shelf.min.y>=.50);
    const direction=new THREE.Vector3(0,-1,0).transformDirection(interior.group.matrix);
    const first=z=>{
      const origin=new THREE.Vector3(...interior.localToWorld([x,10.15,z]));
      return new THREE.Raycaster(origin,direction,0,2).intersectObjects(interior.group.children,true)[0].object;
    };
    const shelfOpening=(shelf.max.z+roof.min.z)/2,applianceLeaf=get('kitchen-tall-'+id);
    interior.group.updateMatrixWorld(true);
    assert.equal(first(1.749),applianceLeaf,'Closed slab hides the cooled chamber');
    assert.equal(first(shelfOpening),applianceLeaf,'The same front closes the dry shelf');
    close(door.rotation.z,0,'Closed position');
    door.rotation.z=door.userData.openYaw;interior.group.updateMatrixWorld(true);
    assert.equal(Math.sign(door.rotation.z),i?-1:1);
    assert.equal(first(1.749),get(prefix+'metal-duct'),'Open door reveals the back of the cooled chamber');
    assert.equal(first(shelfOpening),get(prefix+'dry-back'),'Open door gives full-depth access to the dry shelf');
    door.rotation.z=0;interior.group.updateMatrixWorld(true);
    assert.equal(first(1.749),applianceLeaf,'Closing restores the appliance front');
    assert.equal(first(shelfOpening),applianceLeaf,'Closing covers the dry shelf');
  }
  const counter=bounds(get('kitchen-back-top')),sink=itemBounds('kitchen-sink');
  close(counter.max.x-counter.min.x,3.20,'Full 3.10 m original counter plus 100 mm released from the two columns');
  close(counter.max.x-sink.max.x,1.25,'125 cm of counter to the right of the sink');
  close(sink.min.x-counter.min.x,1.25,'125 cm to the left');
  close(counter.max.x,furniture.get('kitchen-tall').box[0],'Perimeter counter meets the first column');
});

test('every kitchen cabinet and concealed pantry door has the same matte yellow slab front', () => {
  const get=id=>interior.group.getObjectByName(id);
  const aisle=parts('kitchen-island').filter(o=>o.name.includes('-working-drawer-'));
  assert.equal(aisle.length,10);
  const portal=get('kitchen-pantry-closed-leaf'),yellow=portal.material;
  assert.equal(yellow.color.getHex(),0xe5c368);
  assert(yellow.roughness>=.6 && !yellow.map);
  const perimeter=['kitchen-pantry','kitchen-back','kitchen-tall'].flatMap(parts).filter(o=>
    /-(closed-leaf|left-front|right-front|dishwasher-front|front-\d-\d|crown-\d|upper-\d|fridge|freezer)$/.test(o.name));
  assert.equal(perimeter.length,28);
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

test('a single 595 mm built-in oven has a separate bay facing the work aisle beside the extractor', () => {
  const get=id=>interior.group.getObjectByName('kitchen-island-oven-'+id);
  const oven=get('window'),glass=bounds(oven),rail=bounds(get('lower-trim')),handle=bounds(get('handle'));
  const ovenTop=bounds(get('fascia')).max.z,hob=bounds(interior.group.getObjectByName('hob-glass'));
  const island=furniture.get('kitchen-island'),center=glass.getCenter(new THREE.Vector3());
  const hobCenter=hob.getCenter(new THREE.Vector3()),sinkCenter=itemBounds('kitchen-sink').getCenter(new THREE.Vector3());
  const world=p=>new THREE.Vector3(...interior.localToWorld([p.x,p.y,0]));
  const forward=world(hobCenter).sub(world(sinkCenter)).normalize(),right=forward.cross(new THREE.Vector3(0,0,1));
  assert(world(center).sub(world(hobCenter)).dot(right)>.60,'Oven is to the viewer’s right when facing the island from the sink');
  close(hob.min.x-(center.x+.595/2),.2025,'Oven fits the adjacent 60 cm column outside the shared hob bay');
  close(ovenTop-rail.min.z,.595,'Oven has full 595 mm height');
  close(glass.max.x-glass.min.x+.05,.595,'Full-sized 595 mm front including 25 mm jambs');
  assert(ovenTop<hob.min.z-.06 && handle.max.y<glass.min.y && handle.min.y>island.box[1]);
  assert(oven.material.transparent && get('fan-ring') && get('rack-wire-0-0') && get('rack-wire-1-0'));
  assert.equal(inventoryMeshes.filter(m=>/^kitchen-.*oven-window/.test(m.name)).length,1);
  assert(!inventoryMeshes.some(m=>/^kitchen-.*microwave|^kitchen-back-oven/.test(m.name)));
  for(const drawer of parts(island.id).filter(m=>m.name.includes('working-drawer-'))){
    const b=bounds(drawer);assert(b.max.x<=center.x-.30 || b.min.x>=center.x+.30);
  }
});

test('six equal columns frame a centered hob with a low rail support and eleven usable island drawers', () => {
  const get=id=>interior.group.getObjectByName(id),island=furniture.get('kitchen-island'),hob=bounds(get('hob-glass'));
  const [x0,y0,x1,y1]=island.box,mid=(x1+x0)/2;
  close(hob.min.x+hob.max.x,2*mid,'Hob centered across the island');
  close(hob.min.y+hob.max.y,y0+y1,'Hob centered front to back');
  const equipment=['hob-blower','hob-chassis','kitchen-island-nyttig-coupling','kitchen-island-nyttig-riser',
    'kitchen-island-nyttig-plinth-duct','kitchen-island-oven-enamel-floor'].map(id=>bounds(get(id)));
  const spine=bounds(get('kitchen-island-side-3'));
  assert(spine.max.z<equipment[0].min.z && equipment.every(item=>!spine.intersectsBox(item)));
  for(let i=0;i<6;i++){
    const center=mid+(i-2.5)*.60,oven=i===1,paired=i===2||i===3;
    for(let row=0;row<(oven?1:2);row++){
      const id=i+'-'+row,part=type=>get('kitchen-island-'+type);
      const drawer=part('pullout-'+id),frontMesh=part(oven?'oven-tray-drawer':'working-drawer-'+id);
      assert.equal(frontMesh.parent,drawer);
      const front=bounds(frontMesh),pull=bounds(part(oven?'oven-tray-pull':'working-pull-'+id));
      close(front.max.x-front.min.x,.595,'595 mm face on a 600 mm column');
      close((front.max.x+front.min.x)/2,center,'Mirror-symmetric front grid');
      close((pull.max.x+pull.min.x)/2,center,'Centered edge grip');close(pull.max.y,front.min.y,'Aisle-facing grip');
      close(front.min.z,row===0?.122:.497,'Aligned horizontal seams');
      for(const side of ['floor','back','left','right']){
        const mesh=part('drawer-box-'+id+'-'+side),box=bounds(mesh);
        assert.equal(mesh.parent,drawer);
        assert(box.max.z<front.max.z && box.min.x>front.min.x && box.max.x<front.max.x);
        for(const fraction of [0,.25,.50,.75,1]){
          const projected=box.clone().translate(new THREE.Vector3(0,-((paired?.40:.50)-.01)*fraction,0));
          assert(equipment.every(e=>!projected.intersectsBox(e)),'Drawer clears the hob, oven and duct over its stroke');
        }
        if(side==='floor'){
          close(box.min.y,front.max.y,'Floor meets the inside face');
          close(box.max.y-box.min.y,paired?.40:.50,'Box depth');
        }
      }
    }
  }
});

test('TÄCKNAN glass, four marked zones and open grilles sit over a dedicated NYTTIG service bay', () => {
  const get=id=>interior.group.getObjectByName(id),glass=bounds(get('hob-glass'));
  const slab=get('kitchen-island-top'),top=bounds(slab),outlet=bounds(get('kitchen-island-nyttig-outlet'));
  const riser=bounds(get('kitchen-island-nyttig-riser')),oven=bounds(get('kitchen-island-oven-window'));
  close(glass.max.x-glass.min.x,.8,'Glass width');close(glass.max.y-glass.min.y,.515,'Glass depth');
  close(glass.max.z-glass.min.z,.004,'Glass thickness');close(glass.min.z,top.max.z,'Top-mounted glass');
  close(top.max.z-top.min.z,.038,'Worktop sits within the 18–40 mm installation range');
  const down=(object,x,y)=>{
    object.updateMatrix();object.matrixWorld.copy(object.matrix);
    return new THREE.Raycaster(new THREE.Vector3(x,y,1.20),new THREE.Vector3(0,0,-1)).intersectObject(object,false);
  };
  const {x,y}=glass.getCenter(new THREE.Vector3());
  for(const [dx,dy] of [[.379,0],[-.379,0],[0,.244],[0,-.244]])assert.equal(down(slab,x+dx,y+dy).length,0);
  for(const [dx,dy] of [[.381,0],[-.381,0],[0,.246],[0,-.246]])assert(down(slab,x+dx,y+dy).length);
  for(const [row,diameter] of [['front',.16],['rear',.22]])for(const side of ['left','right']){
    const zone=bounds(get('hob-induction-zone-'+row+'-'+side));
    close(zone.max.x-zone.min.x,diameter,'Catalogue zone marking span');
  }
  const slotY=glass.min.y+.124;
  for(const id of ['hob-glass','hob-extractor-grille','hob-chassis'])assert.equal(down(get(id),x,slotY).length,0,id+' leaves a real intake opening');
  assert(down(get('hob-filter-bed'),x,slotY).length && get('hob-touch-keys') && get('hob-red-display'));
  close(outlet.max.x-outlet.min.x,.46,'NYTTIG outlet width');close(outlet.max.z-outlet.min.z,.077,'Outlet height');
  close(riser.max.x-riser.min.x,.22,'Riser width');close(riser.max.y-riser.min.y,.055,'Riser depth');
  assert(oven.max.x<riser.min.x && riser.min.z<riser.max.z && outlet.min.y<riser.min.y);
  const cutHeight=glass.max.z-outlet.min.z;assert(cutHeight>=.849 && cutHeight<=.935);
  for(const mesh of parts('kitchen-island').filter(part=>/-(side-\d|support-\d|body)$/.test(part.name)))
    assert(!bounds(mesh).intersectsBox(riser),mesh.name+' clears the recirculation duct');
});

test('black recessed twin socket opens on the window-side panel, leaving the top continuous', () => {
  const get=id=>interior.group.getObjectByName('kitchen-island-'+id);
  const panel=get('waterfall-left'),slab=get('top'),lid=get('socket-lid'),bezel=get('socket-bezel');
  const rim=bounds(bezel),face=bounds(panel).min.x;
  close(face,2.10,'Window-side end');close(rim.min.x,face,'Flush side mount');
  close(rim.max.y-rim.min.y,.270,'270 mm wide');close(rim.max.z-rim.min.z,.120,'120 mm high');
  assert.equal(lid.material,bezel.material);assert.equal(lid.material.color.getHex(),0x232323);
  assert(bounds(get('socket-housing')).max.x<face+.07);
  const center=rim.getCenter(new THREE.Vector3()),point=interior.localToWorld([face,center.y,center.z]);
  const camera=new THREE.PerspectiveCamera(45,1,.01,10);
  camera.up.set(0,0,1);camera.position.set(...interior.localToWorld([face-.8,center.y,center.z]));
  camera.lookAt(...point);camera.updateMatrixWorld();interior.group.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster();ray.setFromCamera({x:0,y:0},camera);
  assert.equal(ray.intersectObject(panel,false).length,0,'Cutout in the waterfall');
  assert(ray.intersectObject(lid,false).length>0);
  assert(interior.appliances.toggleAt({x:0,y:0},camera));interior.appliances.update(performance.now()+500);
  assert(lid.rotation.y>Math.PI/2);
  assert(get('socket-outlet--0.06')&&get('socket-outlet-0.06'));
  camera.lookAt(...interior.localToWorld([face,center.y-.133,center.z]));camera.updateMatrixWorld();
  assert(interior.appliances.toggleAt({x:0,y:0},camera));interior.appliances.update(performance.now()+500);
  close(lid.rotation.y,0,'Retracts with another tap');
  const above=interior.localToWorld([face+.32,slab.position.y+.31,1.15]);
  ray.set(new THREE.Vector3(...above),new THREE.Vector3(0,0,-1));
  assert(ray.intersectObject(slab,false).length,'No residual hole on the countertop');
});

test('the black Magnifica Evo sits near the worktop end with access to its tank, wand and controls',()=>{
 const get=name=>interior.group.getObjectByName('kitchen-back-'+name);
 const machine=parts('kitchen-back').filter(m=>m.name.includes('-magnifica-'));
 const envelope=machine.reduce((box,m)=>box.union(bounds(m)),new THREE.Box3()),size=envelope.getSize(new THREE.Vector3());
 close(size.x,.240,'Machine width');close(size.y,.440,'Machine depth');close(size.z,.360,'Machine height');
 const counter=bounds(get('top')),tiles=bounds(get('glazed-tiles')),upper=bounds(get('upper-0'));
 close(envelope.min.z,counter.max.z,'Feet on the worktop');
 assert(envelope.min.x-bounds(get('niche-end-trim')).max.x>.065&&envelope.min.x-counter.min.x<.11);
 assert(envelope.min.y-tiles.max.y>.05&&counter.max.y-envelope.max.y>.08);
 assert(upper.min.z-envelope.max.z>.26,'Bean lid clearance');
 assert(itemBounds('kitchen-sink').min.x-envelope.max.x>.90,'Continuous free preparation surface');
 for(const name of ['touch-panel','hopper-lid','steam-wand','dispensing-head','spout-0','spout-1','drip-grille'])assert(get('magnifica-'+name),name);
 const body=get('magnifica-rear-body');
 assert.equal(body.material.name,'DeLonghi Magnifica Evo ECAM290.21.B black ABS');
 assert(Math.max(body.material.color.r,body.material.color.g,body.material.color.b)<.03);
});

test('the 70 cm single bowl is let into the worktop below the full-width mosaic', () => {
  const get=id=>interior.group.getObjectByName(id);
  const bowl=get('kitchen-sink-basin'),slab=get('kitchen-back-top'),drain=get('kitchen-sink-basket-strainer');
  const rim=bounds(bowl),stone=bounds(slab),tile=bounds(get('kitchen-back-glazed-tiles'));
  close(rim.max.x-rim.min.x,.70,'Overall sink width including rim');
  const dividers=[0,1,2,3].map(i=>bounds(get('kitchen-back-cabinet-divider-'+i)));
  const face=bounds(get('kitchen-back-front-2-0'));
  const cabinetEdges=[stone.min.x,...dividers.slice(0,3).map(box=>box.getCenter(new THREE.Vector3()).x),
    bounds(get('kitchen-back-dishwasher-front')).max.x+.0025,stone.max.x];
  close(dividers[3].min.x-dividers[2].max.x,.600,'600 mm clear appliance niche');
  const modules=cabinetEdges.slice(1).map((x,i)=>Math.round((x-cabinetEdges[i])*1000));
  assert.deepEqual(modules,[600,600,800,600,600],'Carcass partitions center the sink between two 600 mm cabinets on each side');
  close(face.max.x-face.min.x,.795,'800 mm sink cabinet door with two 2.5 mm reveals');
  assert(!get('kitchen-back-front-2-1'),'One full-height sink front');
  for(const [edge,divider] of [['min',dividers[1]],['max',dividers[2]]])
    close(Math.abs(face[edge].x-divider.getCenter(new THREE.Vector3()).x),.0025,'Front terminates at side partition');
  close(dividers[2].min.x-dividers[1].max.x,.782,'Clear sink cabinet width');
  close(rim.min.x-dividers[1].max.x,.041,'Left basin rim clearance');
  close(dividers[2].min.x-rim.max.x,.041,'Right basin rim clearance');
  assert(dividers.every(panel=>!panel.intersectsBox(rim)));
  const [cutout]=slab.geometry.parameters.shapes.holes;
  const hole=cutout.getPoints(8).map(p=>new THREE.Vector3(p.x,p.y,0).applyMatrix4(slab.matrix));
  const opening=new THREE.Box3().setFromPoints(hole);
  close(opening.max.x-opening.min.x,.682,'Worktop cut-out width');
  close(opening.min.x-dividers[1].max.x,.050,'Cut-out clearance on the left');
  close(dividers[2].min.x-opening.max.x,.050,'Cut-out clearance on the right');
  const shell=new THREE.Mesh(bowl.geometry,bowl.material),box=bowl.geometry.boundingBox;
  const center=box.getCenter(new THREE.Vector3());
  center.z=box.max.z-.000001;
  for(const [axis,size] of [['x',.662],['y',.373]]){
    const direction=new THREE.Vector3();direction[axis]=1;
    const ray=new THREE.Raycaster(center,direction);
    const positive=ray.intersectObject(shell)[0].distance;
    ray.ray.direction.negate();
    close(positive+ray.intersectObject(shell)[0].distance,size,'Clear bowl opening along '+axis);
  }
  const tap=get('kitchen-sink-arched-spout').material;
  for(const name of ['tap-foot','tap-aerator','mixer-lever'])assert.equal(get('kitchen-sink-'+name).material,tap);
  const {r,g,b}=tap.color;
  assert(Math.min(r,g,b)>.5 && Math.max(r,g,b)-Math.min(r,g,b)<.05 && tap.metalness>.5,'Neutral silver faucet');
  assert(Math.max(bowl.material.color.r,bowl.material.color.g,bowl.material.color.b)<.03 && bowl.material.roughness>.5,'Matte black bowl and lip');
  close(rim.max.z-stone.max.z,.005,'Raised edge on worktop');
  assert(bounds(drain).max.z<stone.max.z-.19 && bounds(get('kitchen-sink-tap-aerator')).min.z>stone.max.z+.20);
  interior.group.updateMatrixWorld(true);
  for(const x of [rim.min.x+.10,rim.max.x-.39,rim.max.x-.10]){
    const ray=new THREE.Raycaster(new THREE.Vector3(...interior.localToWorld([x,9.03,1.08])),
      new THREE.Vector3(0,0,-1),0,.55);
    const hit=ray.intersectObjects([...parts('kitchen-back'),...parts('kitchen-sink')])[0];
    assert.equal(hit.object,bowl,'Open worktop and cabinet reveal the continuous basin at '+x);
    assert(hit.distance>.29 && hit.distance<.34,'Floor of the bowl is recessed across its width');
  }
  close(tile.min.x,bounds(get('kitchen-back-niche-end-trim')).max.x+.0009,'Mosaic begins at trim');
  close(tile.max.x,stone.max.x-.0009,'Mosaic meets appliance column');
  close(tile.min.z,stone.max.z+.0009,'Mosaic starts at the slab');
  close(tile.max.z,bounds(get('kitchen-back-upper-0')).min.z-.0009,'Mosaic finishes under the upper cabinets');
  assert(!data.electrical.points.some(point=>point.support==='kitchen-back-slab-backsplash'));
  assert(!interior.group.children.some(mesh=>mesh.userData.support==='kitchen-back-slab-backsplash'));
  const ray=new THREE.Raycaster(new THREE.Vector3(...interior.localToWorld([3.23,9.15,1.17])),
    new THREE.Vector3(0,-1,0).transformDirection(interior.group.matrix),0,.6);
  assert.equal(ray.intersectObjects(interior.group.children,true)[0].object.name,'kitchen-back-glazed-tiles');
});

test('the symmetrical cabinet layout preserves the shortened fridge-side end and the passage', () => {
  const get=id=>interior.group.getObjectByName('kitchen-island-'+id);
  const slab=bounds(get('top')),drawer=bounds(get('working-drawer-5-0')),first=bounds(get('working-drawer-0-0'));
  close(slab.min.x,2.10,'Window-side end stays anchored');
  close(6.45-slab.max.x,.527,'One 527 mm fridge-side cabinet removed');
  close(slab.max.x-drawer.max.x,.114,'End allowance with a half reveal');
  close(first.min.x-slab.min.x,slab.max.x-drawer.max.x,'Matching end panels at both ends');
  const walk=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.85 && o.maxZ>.04));
  const acrossEnd=x=>[9.90,11.75].map(y=>interior.localToWorld([x,y]).slice(0,2));
  assert(!walk.pathBlocked(...acrossEnd(6.25)),'Walk past the fridge end in the released floor area');
  assert(walk.pathBlocked(...acrossEnd(5.90)),'The retained cabinet still blocks walking');
});

test('the smoked walnut laminate follows the 382.3 × 105 cm island, its folded ends and the back counter', async () => {
  const get=id=>interior.group.getObjectByName(id);
  const skin=get('kitchen-island-figured-veneer-salon'),top=get('kitchen-island-top'),hob=get('hob-glass');
  const texture=skin.material.map,{position,normal,uv}=skin.geometry.attributes;
  assert(skin.material.roughness>.5 && skin.material.metalness===0);
  assert(!get('kitchen-island-palet-cladding') && !get('kitchen-island-tile-backing-salon'));
  const {data:pixels,width,height}=texture.image;
  let slate=0,ash=0,across=0,along=0;
  for(let y=0;y<height-1;y+=3)for(let x=0;x<width-1;x+=3){
    const i=4*(y*width+x),red=pixels[i],blue=pixels[i+2];
    if(blue-red>28 && red<100)slate++;
    if(red>175 && red-blue>4)ash++;
    across+=Math.abs(red-pixels[i+4]);
    along+=Math.abs(red-pixels[i+4*width]);
  }
  const samples=Math.ceil((height-1)/3)*Math.ceil((width-1)/3);
  assert(slate>samples*.20 && ash>samples*.20,'Both dyed slate and pale ash grain are visible');
  assert(across>2*along,'The grain runs predominantly up the panels');
  const surface=bounds(skin),slab=bounds(top);
  close(slab.max.x-slab.min.x,3.823,'Island length');
  close(slab.max.y-slab.min.y,1.05,'Island depth');
  close(slab.max.z,.96,'Island height');
  close(slab.min.y,10.35,'Working edge retained');
  for(const fixture of [hob,get('kitchen-island-oven-enamel-back')]){
    const b=bounds(fixture);
    assert(b.min.x>slab.min.x && b.max.x<slab.max.x && b.min.y>slab.min.y && b.max.y<slab.max.y);
  }
  assert.equal(top.material,get('kitchen-back-top').material);
  assert.notEqual(top.material,skin.material);
  close(bounds(hob).min.z,slab.max.z,'Hob sits on worktop');
  const {applyRealisticSurfaces}=await load(await readFile(new URL('../src/model/surface-realism.js',import.meta.url),'utf8'));
  const bytes=await readFile(new URL('../src/model/surface-scans/kitchen_worktop_smoked_walnut.webp',import.meta.url));
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  const source='data:image/webp;base64,'+bytes.toString('base64'),scan=new THREE.Texture();
  class Loader{async loadAsync(url){assert.equal(url,source);return scan;}}
  const group=new THREE.Group();
  const material=top.material.clone(),surfaces=['kitchen-island-top','kitchen-island-waterfall-left','kitchen-island-waterfall-right','kitchen-back-top'];
  for(const name of surfaces){
    const copy=get(name).clone();copy.material=material;group.add(copy);
  }
  await applyRealisticSurfaces({THREE:{...THREE,TextureLoader:Loader},scene:group,mats:{},
    renderer:{capabilities:{getMaxAnisotropy:()=>4}},scans:{kitchenWorktopSmokedWalnut:[source]}});
  assert.equal(material.map,scan);assert.equal(scan.colorSpace,THREE.SRGBColorSpace);
  assert.equal(scan.wrapS,THREE.MirroredRepeatWrapping);assert.equal(scan.wrapT,THREE.MirroredRepeatWrapping);
  assert.equal(top.material.color.getHex(),0x5c4a3b,'Untextured finish matches the mean sample colour');
  assert.equal(material.color.getHex(),0xffffff);assert.equal(material.bumpMap,null);
  assert(material.roughness>.8 && material.specularIntensity<=.15 && material.metalness===0);
  const sampleDepth=1.05,sampleLength=sampleDepth*1642/1528;
  for(const counter of [top,get('kitchen-back-top')]){
    const {position,normal,uv,bandDistance}=counter.geometry.attributes;
    const thickness=bounds(counter).max.z-bounds(counter).min.z;
    for(let i=0;i<position.count;i++){
      if(normal.getZ(i)>.99){
        close(uv.getX(i),position.getX(i)/sampleLength,'Walnut grain runs along the slab');
        close(uv.getY(i),position.getY(i)/sampleDepth,'Photograph keeps its aspect ratio');
        assert(bandDistance.getX(i)>.0015,'Face carries the photographic print');
      }
      if(Math.abs(normal.getY(i))>.99){
        close(bandDistance.getX(i),thickness-position.getZ(i),'Brown edge line follows the slab surface');
      }
    }
  }
  close(surface.max.z,slab.min.z,'Veneer meets the underside of the slab');
  close(surface.min.y,surface.max.y,'Veneer only on the long salon plane');
  close(slab.max.y-surface.max.y,.018,'Worktop overhang at salon face');
  for(const [end,outer,inner] of [['left','min','max'],['right','max','min']]){
    const panel=get('kitchen-island-waterfall-'+end),b=bounds(panel);
    assert.equal(panel.material,top.material);
    close(b.min.z,0,'End reaches floor');close(b.max.z,slab.min.z,'End meets top');
    for(const edge of ['min','max'])close(b[edge].y,slab[edge].y,'End closes the entire depth');
    close(b[outer].x,slab[outer].x,'Flush outer face');
    close(b[inner].x,surface[outer].x,'Veneer terminates against the waterfall');
    const seamU=object=>{
      const {position,normal,uv}=object.geometry.attributes;
      for(let i=0;i<position.count;i++)if(normal.getX(i)*(end==='left'?-1:1)>.99 &&
        Math.abs(position.getZ(i)+object.position.z-slab.min.z)<1e-6)return uv.getX(i);
      assert.fail('Outer seam has texture coordinates');
    };
    close(seamU(top),seamU(panel),'Decor flows over each bend');
    const panelWidth=b.max.x-b.min.x,outerX=end==='left'?0:slab.max.x-slab.min.x;
    const coords=panel.geometry.attributes;
    for(let i=0;i<coords.position.count;i++){
      const drop=slab.max.z-coords.position.getZ(i);
      if(Math.abs(coords.normal.getY(i))>.99 || coords.normal.getX(i)*(end==='left'?-1:1)>.99){
        close(coords.uv.getX(i),(outerX+(end==='left'?-drop:drop))/sampleLength,'Grain descends both the exposed side and its narrow return');
      }
      if(Math.abs(coords.normal.getY(i))>.99){
        const inset=Math.abs(coords.position.getX(i)-outerX);
        assert(inset<=panelWidth+.00001);
        close(coords.bandDistance.getX(i),inset,'Return has the same thin edge line');
      }
    }
  }
  assert.equal(position.count,24,'Six full-height panels');
  for(let i=0;i<position.count;i+=4){
    close(position.getZ(i),.018,'Veneer clears floor');
    close(position.getZ(i+1),slab.min.z,'Full height sheet');
    close(normal.getY(i),1,'Facing the living room');
    close(uv.getX(i),uv.getX(i+1),'Vertical veneer axis');
    close(uv.getY(i),0,'Bottom of veneer');close(uv.getY(i+1),1,'Top of veneer');
    if(i)close(position.getX(i)-position.getX(i-2),.002,'Two millimetre vertical joint');
  }
});

test('three room plants fit their floor and clear the projection, curtains and furniture', () => {
  const get=name=>interior.group.getObjectByName(name);
  const curtains=inventoryMeshes.filter(o=>/^curtain-.*-(left|right)$/.test(o.name));
  assert(curtains.length>=6);
  for(const [id,roomId,floor] of [['parlour-palm','0.4',0],['cast-iron-plant','0.9',0],['prayer-plant','1.1',3.215]]){
    const crown=get(id+'-foliage'),canopy=bounds(crown),pot=bounds(get(id+'-pot')),room=rooms.get(roomId).box;
    close(pot.min.z,floor,'Pot sits on finish');
    const soil=bounds(get(id+'-soil'));
    assert(canopy.min.z<soil.max.z && canopy.max.z>pot.max.z+.2);
    assert(crown.material.vertexColors && crown.geometry.index.count/3<12000,'Single bounded foliage mesh');
    assert(interior.navigation.obstacles.some(o=>o.id===id+'-pot' && o.minZ===floor));
    assert(canopy.min.x>=room[0] && canopy.min.y>=room[1] && canopy.max.x<=room[2] && canopy.max.y<=room[3]);
    for(const it of furniture.values()){
      if(it.room===roomId && it.type!=='rug')assert(!itemBounds(it.id).intersectsBox(canopy),id+' clears '+it.id);
    }
    if(id==='cast-iron-plant'){
      const wing=data.facades.find(f=>f.id==='facade-wing-end'),window=wing.openings.find(o=>o.casement);
      assert(canopy.min.y>wing.a[1]+window.end,'Leaves stand beyond the full-height opening');
      assert(canopy.min.y-itemBounds('office-pug-bed').max.y>.75,'Clearance from the dog bed');
    }
    if(id==='parlour-palm'){
      assert(canopy.max.z>1.7 && canopy.max.x-canopy.min.x>1);
      assert(canopy.max.y<data.projection.centerY-data.projection.widthM/2,'Palm stays outside the image');
    }
    for(const m of curtains)assert(!bounds(m).intersectsBox(canopy),id+' clears '+m.name);
  }
});

test('flowering tabletop plants rest on their furniture and have an open sightline to glazing', () => {
  const get=id=>interior.group.getObjectByName(id);
  interior.group.updateMatrixWorld(true);
  for(const [id,support,topName,windowName] of [
    ['african-violet','play-cubbies','shelf-0.618','facade-wing-end-glass-0'],
    ['moth-orchid','master-bedside-right','top','wing-gable-glass-0']
  ]){
    const top=bounds(get(support+'-'+topName)),pot=bounds(get(id+'-pot')),leaves=get(id+'-foliage');
    close(pot.min.z,top.max.z,id+' sits directly on furniture');
    for(const axis of ['x','y'])assert(pot.min[axis]>top.min[axis] && pot.max[axis]<top.max[axis],id+' pot fits the top');
    const canopy=bounds(leaves),tri=new THREE.Triangle(),g=leaves.geometry;
    assert(canopy.max.z>pot.max.z+.06 && !interior.navigation.obstacles.some(o=>o.id===id+'-pot'));
    for(const decor of parts(support).filter(part=>bounds(part).min.z>=top.max.z-.00001)){
      const b=bounds(decor);assert(!b.intersectsBox(pot),id+' pot clears '+decor.name);
      if(!b.intersectsBox(canopy))continue;
      for(let i=0;i<g.index.count;i+=3){
        for(const [j,v] of [tri.a,tri.b,tri.c].entries())v.fromBufferAttribute(g.attributes.position,g.index.getX(i+j)).applyMatrix4(leaves.matrix);
        assert(!b.intersectsTriangle(tri),id+' leaves and blooms clear '+decor.name);
      }
    }
    const pane=bounds(get(windowName)),to=pane.getCenter(new THREE.Vector3());
    to.y=pane.min.y+(pane.max.y-pane.min.y)*.34;
    const start=canopy.getCenter(new THREE.Vector3()).applyMatrix4(interior.group.matrixWorld),end=to.applyMatrix4(interior.group.matrixWorld);
    const dir=end.sub(start),ray=new THREE.Raycaster(start,dir.clone().normalize(),0,dir.length()+.005);
    const hit=ray.intersectObjects(inventoryMeshes.filter(o=>!o.name.startsWith(id+'-')),false)[0];
    assert.equal(hit?.object.name,windowName,id+' receives light directly from the window');
    const colors=g.attributes.color;
    assert(Array.from({length:colors.count},(_,i)=>colors.getX(i)-colors.getY(i)).filter(delta=>delta>.07).length>28,id+' has blossoms among the leaves');
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

test('media wall decor rests on its supports, with the floor vase tucked behind the cabinet front', () => {
  const decor=id=>bounds(interior.group.getObjectByName('media-decor-'+id));
  const cabinet=itemBounds('media-console'),base=decor('indigo-folio-back-cover'),upper=decor('linen-folio-back-cover'),dish=decor('footed-dish');
  close(base.min.z,cabinet.max.z,'Lower book rests on cabinet');
  close(upper.min.z,decor('indigo-folio-front-cover').max.z,'Books are stacked');
  close(dish.min.z,decor('linen-folio-front-cover').max.z,'Dish rests on upper cover');
  for(const piece of [base,upper,dish]){
    assert(piece.min.x>cabinet.min.x && piece.max.x<cabinet.max.x && piece.min.y>cabinet.min.y && piece.max.y<cabinet.max.y);
    assert(piece.max.z<data.projection.centerHeightM-data.projection.heightM/2-.25);
  }
  const vase=decor('floor-amphora').union(decor('amphora-handle--1')).union(decor('amphora-handle-1'));
  close(vase.min.z,0,'Floor vase rests on floor');
  assert(vase.max.z>cabinet.max.z && vase.max.z<.7 && vase.min.x>cabinet.min.x && vase.max.x<cabinet.max.x);
  assert(vase.max.y<cabinet.min.y-.12 && vase.min.y>bounds(interior.group.getObjectByName('living-sconce-backplate')).max.y);
  const point=(x,y)=>interior.localToWorld([x,y]).slice(0,2);
  const walk=createWalkCollision(interior.navigation.obstacles.filter(o=>o.id==='media-floor-amphora'));
  const center=vase.getCenter(new THREE.Vector3());
  assert(walk.pathBlocked(point(1.4,center.y),point(center.x,center.y)));
  assert(!walk.pathBlocked(point(1.35,center.y-.5),point(1.35,center.y+.5)));
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

test('powder blue modules and garden chaise carry two accent pillows above the pink and yellow lounge rug', () => {
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
  const map=get('living-rug-woven-face').material.map;
  let pink=0,gold=0;
  for(let x=0;x<50;x++)for(let y=0;y<50;y++){
    const [r,g,b]=sample(map,(x+.5)/50,(y+.5)/50);
    if(r>g+20 && b>g && g>120)pink++;
    if(r>g+10 && g>b+45)gold++;
  }
  assert(pink>500 && gold>500,'Both pink and golden bands occupy the living rug');
});

test('four photographic rugs fit the rooms, frame the bed and keep the terrace threshold free', () => {
  for(const [id,w,d] of [['living-rug',2,3],['play-mat',1.2,1.8],['master-rug',3,2],['terrace-dog-rug',.95,1.60]]){
    const footprint=itemBounds(id);
    close(footprint.max.x-footprint.min.x,w,id+' width');
    close(footprint.max.y-footprint.min.y,d,id+' depth');
    assert(!interior.navigation.obstacles.some(o=>o.id==='furniture-'+id));
    const {data:pixels}=interior.group.getObjectByName(id+'-woven-face').material.map.image;
    if(id==='terrace-dog-rug')assert.equal(pixels[3],0,'The transparent corner follows the dog silhouette');
  }
  const bed=itemBounds('master-bed'),rug=itemBounds('master-rug');
  const oak=bounds(interior.group.getObjectByName('upper-oak-finish'));
  close(rug.min.z,oak.max.z,'Bedroom rug rests on the finished wood surface');
  close(rug.max.z-oak.max.z,.012,'Bedroom rug face clears the flooring');
  for(const side of ['left','right'])close(itemBounds('master-foot-pouf-'+side).min.z,rug.max.z,'Pouf rests on the rug');
  close(bed.min.x-rug.min.x,.50,'Carpet visible at left of bed');
  close(rug.max.x-bed.max.x,.50,'Carpet visible at right of bed');
  const dog=itemBounds('terrace-dog-rug');
  assert(dog.min.x>itemBounds('dining-right-1').max.x && dog.max.x<=7.901);
});

test('the private double vanity has two open inset basins and one orange segmented mirror', () => {
  const get=id=>interior.group.getObjectByName(id),mirror=bounds(get('bath-private-vanity-mirror'));
  assert(get('upper-bath-mirror'));
  for(const id of ['private-sink-one','private-sink-two']){
    const sink=bounds(get(id+'-bowl')),counter=get(id+'-counter'),center=partCenter(id,'bowl');
    assert(sink.min.z<bounds(counter).max.z-.10);
    assert(Math.abs(sink.max.z-bounds(counter).max.z)<.008);
    assert(center.y>mirror.min.y && center.y<mirror.max.y);
    const ray=new THREE.Raycaster(new THREE.Vector3(...interior.localToWorld([center.x,center.y,4.24])),new THREE.Vector3(0,0,-1));
    interior.group.updateMatrixWorld(true);
    assert(!ray.intersectObject(counter).length,'Open stone cutout at basin centre');
    assert(ray.intersectObject(get(id+'-drain')).length);
  }
  const frame=interior.group.children.filter(o=>o.name.startsWith('bath-private-tangerine-frame-'));
  assert.equal(frame.length,4);assert(frame.every(o=>o.material.clearcoat>.7));
  assert.equal(get('bath-private-paint-double-vanity').material.name,'Sepia tigers and tropical fronds on ivory');
  assert(get('private-shower-screen').material.transparent);
  assert.equal(get('private-shower-screen').material.name,'Pressed sage glass with square relief');
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

test('BROR base frames, folded steel decks and wall combination match the IKEA module sizes', () => {
  const rackIds=['pantry-bror-85','pantry-bror-65','pantry-bror-return'];
  for(const [index,id] of rackIds.entries()){
    const item=furniture.get(id),pieces=parts(id);
    assert.equal(item.shelfLevelsM.length,index?6:5);
    const post=pieces.find(piece=>piece.name.endsWith('pierced-post-0'));
    assert.equal(post.material.color.getHex(),0x303234);
    assert.equal(post.geometry.parameters.shapes.holes.length,17);
    assert.equal(pieces.filter(piece=>piece.name.includes('-cross-brace-')).length,2);
    const frame=pieces.filter(piece=>piece.name.includes('-post-') || piece.name.includes('-foot-cap-'))
      .reduce((box,piece)=>box.union(bounds(piece)),new THREE.Box3());
    const dimensions=frame.getSize(new THREE.Vector3());
    close(Math.max(dimensions.x,dimensions.y),index?.65:.85,'BROR frame width');
    close(Math.min(dimensions.x,dimensions.y),.55,'BROR frame depth');
    close(dimensions.z,1.90,'BROR uprights including feet');
    for(const [i,z] of item.shelfLevelsM.entries()){
      const deck=bounds(interior.group.getObjectByName(id+'-shelf-'+i+'-deck'));
      close(deck.max.z,z+item.elevation,'Shelf elevation');
      close(Math.min(deck.max.x-deck.min.x,deck.max.y-deck.min.y),.54,'54 cm usable shelf');
      const onDeck=pieces.filter(piece=>/-(?:tub|can|glass|packet|carton-\d+)$/.test(piece.name))
        .map(bounds).filter(box=>Math.abs(box.min.z-deck.max.z)<.001);
      assert(onDeck.length>0,'Every deck carries stock');
      for(const stock of onDeck)for(const axis of ['x','y']){
        assert(stock.min[axis]>=deck.min[axis]-.001 && stock.max[axis]<=deck.max[axis]+.001,'Stock fits inside shelf edges');
      }
    }
  }
  const id='pantry-bror-bench',top=bounds(interior.group.getObjectByName(id+'-pine-plywood'));
  close(top.max.x-top.min.x,.55,'Bench depth');close(top.max.y-top.min.y,1.10,'Bench width');
  close(top.max.z-furniture.get(id).elevation,.88,'Pine plywood working height');
  const grocerySpace=top.clone();grocerySpace.min.z=top.max.z+.001;grocerySpace.max.z=top.max.z+.50;
  assert(parts(id).every(piece=>!grocerySpace.intersectsBox(bounds(piece))),'Entire worktop available for unloading');
  const shelves=parts(id).filter(piece=>piece.name.includes('-wall-shelf-'));
  assert.equal(shelves.length,4);
  for(const shelf of shelves){
    const size=bounds(shelf).getSize(new THREE.Vector3());
    close(size.x,.40,'Wall deck depth');close(size.y,.85,'Wall deck width');
  }
  assert(data.metadata.furnitureSources[furniture.get(id).wallShelfSource].includes('09571854'));
});

test('deep BROR pantry fittings leave both doors and electrical controls accessible', () => {
  const stocks=data.furniture.filter(item=>item.room==='0.2').map(item=>itemBounds(item.id));
  const controls = data.electrical.points.filter(point=>point.room==='0.2');
  for(const point of controls){
    const switchZone=new THREE.Vector3(point.alongM,6.81,point.heightM);
    assert(stocks.every(stock=>stock.distanceToPoint(switchZone)>.15),'Approach to pantry electrical control');
  }
  const inverse=interior.group.matrix.clone().invert();
  for(const id of ['hall-flush-garage-pantry','concealed-pantry-door']){
    const pivot=interior.group.getObjectByName(id);
    for(let i=0;i<=24;i++){
      pivot.rotation.z=pivot.userData.closedYaw+i/24*pivot.userData.swing*Math.PI/2;
      interior.group.updateMatrixWorld(true);
      pivot.traverse(piece=>{
        if(!piece.isMesh)return;
        piece.geometry.computeBoundingBox();
        const sweep=piece.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(piece.matrixWorld));
        assert(stocks.every(stock=>!stock.intersectsBox(sweep)),piece.name+' clears all storage throughout its swing');
      });
    }
    pivot.rotation.z=pivot.userData.closedYaw;
  }
  interior.group.updateMatrixWorld(true);
});

test('both moving doors clear a continuous kitchen–pantry–garage walking route', () => {
  const doors=['kitchen-pantry-closed-leaf','hall-flush-garage-pantry-leaf'].map(name=>interior.group.getObjectByName(name));
  const collision=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.7 && o.maxZ>.03),.36);
  const local=[[1.50,9.81],[1.50,7.98],[1.90,7.93],[2.07,7.59],[2.12,7.25],[2.12,6.03]];
  const route=local.map(p=>new THREE.Vector3(...interior.localToWorld([...p,1.30])));
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i];
    assert(!collision.pathBlocked(a.toArray().slice(0,2),b.toArray().slice(0,2)),'72 cm body clears walls and stock');
    for(let t=0;t<=20;t++){
      const walker=a.clone().lerp(b,t/20);
      interior.updateHallDoors(walker);interior.group.updateMatrixWorld(true);
      for(const leaf of doors){
        leaf.geometry.computeBoundingBox();
        assert(leaf.geometry.boundingBox.distanceToPoint(leaf.worldToLocal(walker.clone()))>.36,leaf.name+' clears walking body');
      }
    }
  }
  interior.updateHallDoors(null);
});

test('the integrated dishwasher folds down on a visible click, exposing both racks and reserving its swing',async()=>{
  const model=addIconInterior({THREE,scene:new THREE.Scene(),house,data}),{group,appliances}=model;
  const get=name=>group.getObjectByName(name),pivot=get('kitchen-dishwasher-door'),panel=get('kitchen-back-dishwasher-front');
  const basin=get('kitchen-back-dishwasher-back'),racks=[0,1].map(i=>get('kitchen-back-dishwasher-rack-'+i+'-bar-0'));
  close(bounds(panel).min.x,4.0525,'adjacent to sink');
  close(bounds(basin).getSize(new THREE.Vector3()).x,.596,'appliance body width');
  assert(racks.every(r=>r&&bounds(r).max.y<bounds(panel).min.y));
  const {batchStaticInteriorDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
  batchStaticInteriorDetails(THREE,group);
  const camera=new THREE.PerspectiveCamera(60,1,.02,50);camera.up.set(0,0,1);
  const world=p=>group.localToWorld(new THREE.Vector3(...p));
  const tap=(eye,target)=>{camera.position.copy(world(eye));camera.lookAt(world(target));return appliances.toggleAt({x:0,y:0},camera);};
  const target=[4.35,9.205,.48],eye=[3.65,9.89,1.32];
  const obstacle=model.navigation.obstacles.find(o=>o.id===pivot.name),closed=structuredClone(obstacle.ring);
  assert(!tap([4.35,9.81,1.60],target),'walker within the opening arc');
  assert(tap(eye,target));appliances.update(performance.now()+400);
  close(pivot.rotation.x,-Math.PI/2,'fully lowered');
  assert.notDeepEqual(obstacle.ring,closed);
  const drawerEye=[5.05,9.47,1.30],drawerTarget=[4.69,10.395,.28];
  assert(!tap(drawerEye,drawerTarget),'opposing lower drawer cannot enter the open door');
  assert(tap(eye,[4.35,9.80,.16]));appliances.update(performance.now()+400);
  close(pivot.rotation.x,0,'closed');assert.deepEqual(obstacle.ring,closed);
  assert(tap(drawerEye,drawerTarget),'opposing drawer releases after the door is closed');
});

test('dishwasher hoses and power lead end on the modeled valve, trap, adjacent cupboard plug and appliance ports',async()=>{
 const {createIndoorServices}=await load(await readFile(new URL('../src/model/indoor-services.js',import.meta.url),'utf8'));
 const services=createIndoorServices(THREE,interior,data),get=id=>services.getObjectByName('dishwasher-'+id);
 const fitting=(id,point)=>{
  const mesh=interior.group.getObjectByName('kitchen-back-dishwasher-'+id);
  assert(bounds(mesh).distanceToPoint(new THREE.Vector3(...point))<.001,id);
 };
 for(const [id,from,to] of [['inlet-hose','isolation-valve','inlet'],['drain-hose','outlet','trap-spigot'],['power-cord','plug','power-inlet']]){
  const line=get(id),physical=interior.group.getObjectByName('dishwasher-fitted-'+id);
  fitting(from,line.userData.from);fitting(to,line.userData.to);
  assert.equal(physical.geometry,line.geometry);
  assert(physical.material.depthTest&&!services.visible);
 }
 assert.deepEqual(get('stop-valve').userData.from,services.getObjectByName('kitchen-feed-cold').userData.to);
 assert.deepEqual(get('stop-valve').userData.to,get('inlet-hose').userData.from);
 assert.deepEqual(get('drain-hose').userData.to,get('trap-connection').userData.from);
 assert.deepEqual(get('trap-connection').userData.to,services.getObjectByName('kitchen-sink-drain').userData.from);
 assert(get('drain-hose').geometry.attributes.position.array.some((v,i)=>i%3===2&&v>.74));
 assert.equal(get('power-cord').parent.name,'power-ground');
});

test('every island drawer opens and closes on its own visible front after static batching', async () => {
  const scene=new THREE.Scene(),model=addIconInterior({THREE,scene,house,data}),{group,appliances}=model;
  const {batchStaticInteriorDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
  batchStaticInteriorDetails(THREE,group);
  const camera=new THREE.PerspectiveCamera(62,1,.03,100);
  camera.up.set(0,0,1);
  const world=xyz=>group.localToWorld(new THREE.Vector3(...xyz));
  const get=id=>group.getObjectByName('kitchen-island-'+id);
  function tap(eye,target){
    camera.position.copy(world(eye));camera.lookAt(world(target));
    return appliances.toggleAt({x:0,y:0},camera);
  }
  for(let column=0;column<6;column++)for(let row=0;row<(column===1?1:2);row++){
    const suffix=column+'-'+row,front=bounds(get(column===1?'oven-tray-drawer':'working-drawer-'+suffix));
    const x=(front.min.x+front.max.x)/2,z=(front.min.z+front.max.z)/2,eye=[x,9.55,1.57];
    const drawer=get('pullout-'+suffix),runner=get('telescoping-slides-'+suffix);
    const obstacle=model.navigation.obstacles.find(o=>o.id===drawer.name),closed=structuredClone(obstacle.ring);
    const travel=column===2||column===3?-.39:-.49;
    assert(!tap([x,10.10,1.57],[x,front.min.y,z]),'Opening stroke protects the walker');
    assert(tap(eye,[x,front.min.y,z]),drawer.name+' opens from the aisle');
    appliances.update(performance.now()+400);
    close(drawer.position.y,travel,'Runner stroke');close(runner.position.y,travel/2,'Middle rail stroke');
    assert.notDeepEqual(obstacle.ring,closed);
    assert(tap(eye,[x,front.min.y+travel,z]),drawer.name+' closes on its extended front');
    appliances.update(performance.now()+400);
    close(drawer.position.y,0,'Returns flush');assert.deepEqual(obstacle.ring,closed);
  }
});

test('the full-height sink drawer slides around the fixed waste and leaves a walkable aisle', async () => {
  const scene=new THREE.Scene(),model=addIconInterior({THREE,scene,house,data}),{group,appliances}=model;
  const get=name=>group.getObjectByName(name),drawer=get('kitchen-sink-pullout'),runners=get('kitchen-sink-telescoping-slides');
  const front=get('kitchen-back-front-2-0'),pull=get('kitchen-back-drawer-pull-2-0');
  const tray=drawer.children.filter(part=>part.name.includes('sink-tray-'));
  assert.equal(front.parent,drawer);assert.equal(pull.parent,drawer);assert(tray.length>=10);
  const fixed=['kitchen-sink-basin','kitchen-back-top','kitchen-back-sink-waste-trap','kitchen-back-sink-waste-coupling'].map(name=>bounds(get(name)));
  const rails=['left','right'].map(side=>[0,1,2].map(i=>bounds(get('kitchen-back-sink-slide-'+side+'-'+i))));
  const {batchStaticInteriorDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
  batchStaticInteriorDetails(THREE,group);
  const world=v=>group.localToWorld(new THREE.Vector3(...v)),yaw=new THREE.Vector3(0,0,1);
  const camera=new THREE.PerspectiveCamera(62,1,.03,100);camera.up.copy(yaw);
  const eye=[4.12,10.02,1.58],face=bounds(front),cx=(face.max.x+face.min.x)/2;
  function tap(from,to){camera.position.copy(world(from));camera.lookAt(world(to));return appliances.toggleAt({x:0,y:0},camera);}
  const target=[cx,face.max.y,.62],ring=model.navigation.obstacles.find(o=>o.id===drawer.name).ring;
  const closedRing=structuredClone(ring);
  const blocker=new THREE.Mesh(new THREE.BoxGeometry(.36,.18,.32),new THREE.MeshBasicMaterial());
  blocker.position.copy(world(eye).lerp(world(target),.5));scene.add(blocker);
  assert(!tap(eye,target),'Opaque nearer geometry consumes the hit');scene.remove(blocker);
  assert(!tap([cx,9.61,1.58],target),'A standing viewer within the slide stroke blocks opening');
  const surfaceAt=(x,y)=>{
    scene.updateMatrixWorld(true);
    return new THREE.Raycaster(world([x,y,1.33]),new THREE.Vector3(0,0,-1),0,1).intersectObjects(group.children,true)[0].point.z;
  };
  const locations=[[cx-.20,9.03],[cx+.44,9.03]],initial=locations.map(([x,y])=>surfaceAt(x,y));
  assert(tap(eye,target),'The closed full-height front opens from the aisle');assert.notDeepEqual(ring,closedRing);
  const start=performance.now();
  for(const elapsed of [0,85,170,255,350]){
    appliances.update(start+elapsed);
    const delta=new THREE.Vector3(0,drawer.position.y,0);
    for(const part of tray){
      const box=bounds(part).translate(delta);
      assert(fixed.every(obstacle=>!box.intersectsBox(obstacle)),part.name+' clears basin, counter and waste throughout the stroke');
    }
    close(runners.position.y,delta.y/2,'Intermediate slide moves at half speed');
    for(const [outer,mid,inner] of rails){
      const center=mid.clone().translate(delta.clone().multiplyScalar(.5)),end=inner.clone().translate(delta);
      assert(outer.max.y-center.min.y>.22 && center.max.y-end.min.y>.22,'Adjacent rail stages remain engaged');
    }
  }
  close(drawer.position.y,.45,'The complete pull-out travels 45 cm');
  locations.forEach(([x,y],i)=>close(surfaceAt(x,y),initial[i],'Bowl and worktop remain fixed'));
  const walk=createWalkCollision(model.navigation.obstacles.filter(o=>o.minZ<1.70&&o.maxZ>.04),.28);
  const point=(x,y)=>model.localToWorld([x,y]).slice(0,2);
  assert(walk.blocked(point(cx,9.55)),'The open drawer has a walk collider');
  assert(!walk.pathBlocked(point(3.12,10.01),point(4.76,10.01)),'A 56 cm walking envelope passes the fully open drawer');
  assert(tap(eye,[cx,face.max.y+drawer.position.y,.62]),'Tapping the extended front closes it');
  appliances.update(performance.now()+400);
  close(drawer.position.y,0,'Returns flush');assert.deepEqual(ring,closedRing);
  assert(!walk.blocked(point(cx,9.62)),'Closing releases the aisle');
  assert(tap(eye,target));appliances.update(performance.now()+400);
  const side=get('kitchen-back-sink-tray-side-right'),sidePoint=bounds(side).getCenter(new THREE.Vector3());
  sidePoint.y+=drawer.position.y;
  assert(tap([4.65,9.89,1.58],sidePoint.toArray()),'The visible storage box also closes the drawer');
  appliances.update(performance.now()+400);close(drawer.position.y,0,'Tray and front return together');
});

test('the two kitchen appliance doors toggle independently from the aisle after batching', async () => {
  const scene = new THREE.Scene(), model = addIconInterior({ THREE, scene, house, data });
  const { batchStaticInteriorDetails } = await load(await readFile(new URL('../src/model/static-detail-batches.js', import.meta.url), 'utf8'));
  batchStaticInteriorDetails(THREE, model.group);
  scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(62, 1, .03, 100);
  const state = id => model.group.getObjectByName('kitchen-' + id + '-door');
  const world = (x, y, z) => model.group.localToWorld(new THREE.Vector3(x, y, z));
  function tap(id, targetHeight=1.24) {
    const x = id === 'fridge' ? 5.55 : 6.15;
    camera.position.copy(world(x, 9.99, 1.58));
    camera.up.set(0, 0, 1);
    camera.lookAt(world(x, 9.235, targetHeight));
    return model.appliances.toggleAt({ x:0, y:0 }, camera);
  }
  function finish() {
    assert.equal(model.appliances.update(performance.now() + 500), false);
  }
  for (const id of ['fridge', 'freezer']) {
    const compartment = model.group.getObjectByName('kitchen-' + id + '-body');
    assert.equal(compartment.visible, false);
    assert(tap(id));
    finish();
    assert.equal(compartment.visible, true);
    close(state(id).rotation.z, state(id).userData.openYaw, id + ' reaches its hinge stop');
  }
  assert(tap('fridge'));
  finish();
  close(state('fridge').rotation.z, 0, 'Fridge closes when tapping its visible compartment');
  close(state('freezer').rotation.z, state('freezer').userData.openYaw, 'Freezer stays open');
  assert(tap('freezer'));
  finish();
  close(state('freezer').rotation.z, 0, 'Freezer closes');
  for (const id of ['fridge','freezer']) {
    assert(tap(id,2.015),'Clicking the upper extension opens the '+id);
    finish();
    assert(tap(id,2.015),'Clicking inside its dry shelf closes the '+id);
    finish();
    close(state(id).rotation.z,0,id+' returns to its closed position');
  }
  const blocker = new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42), new THREE.MeshBasicMaterial());
  blocker.position.copy(world(5.55, 9.65, 1.45));
  scene.add(blocker);
  assert.equal(tap('fridge'), false, 'Opaque obstruction prevents opening the fridge');
});


test('pantry printing reads left to right from the aisle in the default mirrored house', () => {
  interior.group.updateMatrixWorld(true);
  const labels=inventoryMeshes.filter(mesh=>mesh.name.startsWith('pantry-')&&mesh.name.endsWith('-label'));
  assert(labels.length>=10);
  for(const label of labels){
    const {position,normal,uv}=label.geometry.attributes;
    const vertex=i=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(label.matrixWorld);
    const front=new THREE.Vector3().fromBufferAttribute(normal,0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(label.matrixWorld));
    const right=new THREE.Vector3(0,0,1).cross(front);
    const reading=vertex(1).sub(vertex(0)).multiplyScalar(uv.getX(1)-uv.getX(0));
    assert(reading.dot(right)>0,label.name+' reads from left to right');
  }
});

test('the reclining adult rests on the sectional within its walk footprint', () => {
  const get = suffix => interior.group.getObjectByName('lounge-reader-' + suffix);
  const adult = parts('lounge-reader');
  assert(adult.length > 0 && adult.every(piece => piece.userData.pose === 'reclining'));
  const sofa = itemBounds('sofa'), figure = itemBounds('lounge-reader');
  for (const axis of ['x','y']) {
    assert(figure.min[axis] >= sofa.min[axis] && figure.max[axis] <= sofa.max[axis], 'Figure fits inside the sofa on '+axis);
  }
  const seat = bounds(interior.group.getObjectByName('sofa-seat')), cushion = bounds(get('head-pillow'));
  const face = bounds(get('face')), hip = bounds(get('trousers-seat'));
  assert(cushion.min.z <= seat.max.z && cushion.max.z > seat.max.z + .10);
  assert(cushion.intersectsBox(face) && face.min.z > seat.max.z + .07);
  assert(Math.abs(hip.min.z - seat.max.z) < .022, 'Hips bear on the seat');
  const legs = [0,1].map(i => bounds(get('trouser-leg-'+i)));
  assert(legs[1].max.z > legs[0].max.z + .11, 'One knee is raised');
  for(const i of [0,1]) {
    assert(Math.abs(bounds(get('sock-'+i)).min.z - seat.max.z) < .022, 'Socks rest on the cushion');
  }
  const extent = bounds(get('sock-0')).max.y - face.min.y;
  assert(extent > 1.70 && extent < 1.90, 'Adult head-to-foot length in the reclined pose');
  assert(figure.max.z < sofa.max.z + .02, 'Figure stays under the backrest silhouette');
  assert(adult.reduce((sum,piece) => sum + piece.geometry.index.count / 3,0) < 35000);
  assert(!interior.navigation.obstacles.some(obstacle => obstacle.id.includes('lounge-reader')));
});
