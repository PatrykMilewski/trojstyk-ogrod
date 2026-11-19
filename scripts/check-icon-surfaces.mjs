import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../trzy-domy-3d/index.html', import.meta.url), 'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8').replaceAll("'three/core'", `'${imports['three/core']}'`));
const marker = 'const [source,garden,house,neighbors]=';
const start = html.indexOf(marker) + marker.length;
const [, , house] = JSON.parse(html.slice(start, html.indexOf(';\nconst landscaping=', start)));
const { addIconInterior } = await load(await readFile(new URL('../src/model/interior.js', import.meta.url), 'utf8'));
const { joinIconStorySurfaces } = await load(await readFile(new URL('../src/model/story-joints.js', import.meta.url), 'utf8'));
const data = JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json', import.meta.url), 'utf8'));
const interior = addIconInterior({ THREE, scene: new THREE.Scene(), house, data, joinStory: joinIconStorySurfaces });
interior.group.updateMatrixWorld(true);
const object = name => { const mesh = interior.group.getObjectByName(name); assert(mesh, name); return mesh; };
const close = (a, b, message) => assert(Math.abs(a - b) < 1e-5, `${message}: ${a} versus ${b}`);
function hits(mesh, origin, direction, far = 1) {
  const ray = new THREE.Raycaster(new THREE.Vector3(...origin).applyMatrix4(interior.group.matrix), new THREE.Vector3(...direction).transformDirection(interior.group.matrix), 0, far);
  return ray.intersectObject(mesh, false);
}
function bounds(mesh) { mesh.updateMatrix(); mesh.geometry.computeBoundingBox(); return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix); }
const contains = (p, ring) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };

test('open interior doorways match their rendered openings and collision bands', () => {
  for (const wall of data.walls.filter(wall => wall.finish !== 'clear-glass')) {
    const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length, base = wall.level ? 3.2 : 0;
    for (let i = 1; i < 80; i++) for (const h of [.04, 1.1, 2.08, 2.2]) {
      const u = length * i / 80; if (wall.doors.some(door => door.some(edge => Math.abs(edge - u) < 1e-6))) continue; const expected = !wall.doors.some(([lo, hi]) => u > lo && u < hi && h < 2.1);
      const x = wall.a[0] + ux * u, y = wall.a[1] + uy * u;
      if (wall.level && base + h >= interior.navigation.ceilingHeight(interior.localToWorld([x, y])) - .1) continue;
      const visible = hits(object(wall.id), [x + uy * .4, y - ux * .4, base + h], [-uy, ux, 0], .8).length > 0;
      assert.equal(visible, expected, `${wall.id}, u=${u}, h=${h}: visual opening`);
      const p = interior.localToWorld([x, y]);
      const collision = interior.navigation.obstacles.some(o => o.id.startsWith(wall.id + '-') && base + h > o.minZ && base + h < o.maxZ && contains(p, o.ring));
      assert.equal(collision, visible, `${wall.id}: collision agrees with rendered aperture`);
    }
  }
});

test('upper partitions reach the actual roof lining on both faces, including ridges and valleys', () => {
  for (const wall of data.walls.filter(w => w.level)) {
    const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], length = Math.hypot(dx, dy), ux = dx / length, uy = dy / length;
    for (let i = 1; i < 100; i++) for (const side of [-1, 1]) {
      const u = length * i / 100, d = side * wall.thickness / 2, x = wall.a[0] + ux * u - uy * d, y = wall.a[1] + uy * u + ux * d;
      const roof = interior.navigation.ceilingHeight(interior.localToWorld([x, y]));
      assert(hits(object(wall.id), [x - uy * side * .01, y + ux * side * .01, roof - .002], [uy * side, -ux * side, 0], .02).length, `${wall.id} has ceiling gap at ${x},${y}`);
    }
  }
});

test('single upper floor has no holes or extra surfaces across the declared walkable floor', () => {
  const top = object('upper-oak-finish'), base = object('upper-structure');
  for (let x = .11; x < 14.64; x += .21) for (let y = .11; y < 18.13; y += .213) {
    const world = interior.localToWorld([x, y]);
    const expected = interior.navigation.floors.some(f => f.z === 3.2 && contains(world, f.ring));
    const finishHits = hits(top, [x, y, 3.5], [0, 0, -1], .29);
    const edgeDistance=Math.min(...data.exterior.upper.map((a,i)=>{const b=data.exterior.upper[(i+1)%data.exterior.upper.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}));
    if(expected&&edgeDistance<.18)continue;
    assert.equal(finishHits.length > 0, expected, `Accessible floor/nav mismatch at ${x},${y}`);
    if (expected) { close(finishHits[0].point.z, 3.215, 'Oak floor top'); const insideLowerWall=interior.navigation.obstacles.some(o=>o.id.startsWith('facade-')&&o.minZ<2.8&&o.maxZ>=2.8&&contains(world,o.ring));
      if(!insideLowerWall)assert(hits(base, [x, y, 2.7], [0, 0, 1], .11).length, 'Exposed ground ceiling remains continuous'); }
  }
  assert(!interior.group.children.some(mesh => /^upper-(slab|finish)-\d/.test(mesh.name)), 'No coincident per-cell floor surfaces');
});

test('counter tops have no overlapping exposed body faces and exterior walls have one surface', () => {
  for (const item of data.furniture.filter(f => f.type === 'counter')) {
    const body = bounds(object(item.id + '-body')), top = bounds(object(item.id + '-top'));
    close(body.max.z, top.min.z, item.id + ' adjoining solids');
    assert(body.max.z < top.max.z - .049, item.id + ' body is below visible counter surface');
  }
  assert(!interior.group.children.some(mesh => mesh.name.endsWith('-charred-exterior')), 'No extra nearly coplanar exterior shell');
  for (const mesh of interior.group.children.filter(m => m.isMesh)) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) assert(!material.polygonOffset, 'No depth offset masking');
});

test('mirrored lower flight has a right-hand guard and the upper flight protects its open side', () => {
  const s=data.stairs,[sx,sy,ex,ey]=s.box,turn=sy+(s.rises/2-1)*s.tread,half=s.floorHeight/2;
  for(const [id,edge,y,dir,base] of [['lower',sx,sy,1,0],['upper',ex-s.width,turn,-1,half]]){
      const name='stair-'+id+'-left',screen=object(name+'-perforated-infill');
      const removed='stair-'+id+'-right';
      assert(!interior.group.children.some(mesh=>mesh.name.startsWith(removed)),'Removed guard has no visible components');
      assert(!interior.navigation.obstacles.some(o=>o.id.startsWith(removed)),'Removed guard has no collision');
      const ramp=interior.navigation.ramps.find(r=>r.id==='stair-'+id);
      const forward=new THREE.Vector2(...ramp.end).sub(new THREE.Vector2(...ramp.start));
      const atEdge=new THREE.Vector2(...interior.localToWorld([edge,y])).sub(new THREE.Vector2(...ramp.start));
      assert.equal(Math.sign(forward.cross(atEdge)),id==='lower'?-1:1,'Handedness in the mirrored scene');
      const top=object(name+'-top'),material=screen.material,alpha=material.alphaMap;
      assert.equal(material.color.getHex(),top.material.color.getHex());
      assert(material.transparent&&alpha?.isDataTexture&&alpha.generateMipmaps,'Perforations use a filtered alpha mask');
      const values=alpha.image.data.filter((_,i)=>i%4===1);
      assert(values.some(v=>v===0)&&values.some(v=>v===255),'Open and solid portions');
      assert(screen.geometry.attributes.position.count<60,'No per-hole geometry');
      for(let i=0;i<s.rises/2-1;i++){
        const fraction=id==='lower'&&i===0?.75:.5;
        const py=y+dir*(i+fraction)*s.tread,treadZ=base+(i+1)*s.floorHeight/s.rises;
        assert(hits(screen,[edge-.06,py,treadZ+.015],[1,0,0],.12).length,'Infill meets each tread');
        assert(!hits(screen,[edge-.06,py,treadZ-.02],[1,0,0],.12).length,'Infill follows the stair folds');
        const guardZ=base+1.12+half*(i+fraction)/(s.rises/2-1);
        assert(hits(screen,[edge-.06,py,guardZ-.02],[1,0,0],.12).length,'Infill reaches sloping handrail');
        assert(interior.navigation.obstacles.some(o=>o.id===name+'-'+i&&contains(interior.localToWorld([edge,py]),o.ring)));
      }
  }
  const rearWallStart=data.facades.find(facade=>facade.id==='facade-wing-rear').a[0];
  for(const [name,p] of [['lower',[sx,(turn+ey)/2]],['back',[(sx+rearWallStart)/2,ey]]]){
    const across=name==='back'?[0,1,0]:[1,0,0],mesh=object('landing-'+name+'-perforated-infill');
    for(const h of [.02,.55,1.10])assert(hits(mesh,[p[0]-.05*across[0],p[1]-.05*across[1],half+h],across,.10).length);
  }
  const rear=object('landing-back-perforated-infill');
  close(bounds(rear).max.x,rearWallStart,'Landing mesh ends at the wing wall');
  for(const height of [.02,.55,1.10]){
    const above=half+height;
    for(const x of [rearWallStart+.05,ex-.05]){
      assert(hits(object('facade-wing-rear'),[x,ey-.1,above],[0,1,0],.15).length,'The rear wall encloses the landing');
      assert(!hits(rear,[x,ey-.1,above],[0,1,0],.15).length);
      assert(!interior.navigation.obstacles.some(o=>o.id==='landing-back'&&contains(interior.localToWorld([x,ey]),o.ring)));
    }
    assert(hits(object('office-stair-partition'),[ex-.1,(turn+ey)/2,above],[1,0,0],.15).length,'The office wall encloses the side');
  }
  assert(!interior.group.children.some(m=>m.name.startsWith('landing-upper')));
  assert(!interior.navigation.obstacles.some(o=>o.id==='landing-upper'));
  const joint=new THREE.Vector3(sx,turn,half+1.12);
  for(const name of ['stair-lower-left-top','landing-lower-top']){
    const rail=object(name),halfLength=rail.geometry.parameters.height/2;
    const ends=[-halfLength,halfLength].map(v=>new THREE.Vector3(0,v,0).applyMatrix4(rail.matrix));
    assert(ends.some(end=>end.distanceTo(joint)<1e-5),'Handrail joins landing at '+name);
  }
  const support=bounds(object('upper-void-rim'));
  close(support.max.z,s.floorHeight,'Mezzanine rim supports the guard');
  close(support.max.x,sx,'Rim ends at the mezzanine corner');
  for(const post of interior.group.children.filter(m=>m.name.startsWith('upper-void-edge-post-'))){
    const b=bounds(post);
    assert(b.min.x>=support.min.x-.02&&b.max.x<=support.max.x+.02&&b.min.y>=support.min.y-.02&&b.max.y<=support.max.y+.02);
    close(b.min.z,support.max.z,'Mezzanine post bears on rim');
  }
  const oldWing=['upper-stair-edge','upper-stair-rear','upper-stair-rim'];
  assert(!interior.group.children.some(mesh=>oldWing.some(prefix=>mesh.name.startsWith(prefix))));
  assert(!interior.navigation.obstacles.some(o=>oldWing.some(prefix=>o.id.startsWith(prefix))));
  for(const x of [sx-.04,sx+.04])for(const y of [data.void.box[1]+.12,ey-.12]){
    assert(!hits(object('upper-oak-finish'),[x,y,s.floorHeight+.15],[0,0,-1],.25).length,'Former extension lay between two voids');
  }
});

test('upper hall guards block the drop and the normal staircase remains walkable both ways', async () => {
  const {createWalkMotion,createWalkCollision}=await load(await readFile(new URL('../src/model/walk.js',import.meta.url),'utf8'));
  const motion=createWalkMotion(createWalkCollision([]),interior.navigation);
  const {box:[sx,sy,ex,ey],width,floorHeight}=data.stairs;
  const lower=sx+width/2,upper=ex-width/2,landingY=ey-data.stairs.landingDepth/2;
  const moveTo=(x,y)=>{
    const [px,py]=motion.getState().position,[tx,ty]=interior.localToWorld([x,y]);
    const dx=tx-px,dy=ty-py;
    return motion.move(1,0,Math.hypot(dx,dy)/2.2,Math.atan2(dx,dy));
  };
  for(const [id,point,axis] of [['upper-stair-hall-side',[sx,sy+.5],0],['upper-stair-hall-front',[lower,sy],1]]){
    const origin=[...point,floorHeight+.6],direction=[0,0,0];
    origin[axis]-=.1;direction[axis]=1;
    assert(interior.group.children.filter(m=>m.name.startsWith(id+'-glass-')).some(m=>hits(m,origin,direction,.2).length));
    assert(interior.navigation.obstacles.some(o=>o.id===id&&o.minZ===floorHeight&&contains(interior.localToWorld(point),o.ring)));
  }
  for(const [start,target] of [[[sx-.5,sy+.5],[sx+.4,sy+.5]],[[lower,sy-.5],[lower,sy+.4]]]){
    motion.reset(interior.localToWorld([...start,floorHeight]));
    const stop=moveTo(...target),destination=interior.localToWorld(target);
    assert(Math.hypot(stop[0]-destination[0],stop[1]-destination[1])>.6);
    close(motion.getState().floorHeightM,floorHeight,'Upper hallway guard prevents falling');
  }
  motion.reset(interior.localToWorld([lower,sy-.5,0]));
  for(const [x,y,z] of [[lower,landingY,floorHeight/2],[upper,landingY,floorHeight/2],[upper,sy-.5,floorHeight],
    [upper,landingY,floorHeight/2],[lower,landingY,floorHeight/2],[lower,sy-.5,0]]){
    const final=moveTo(x,y),expected=interior.localToWorld([x,y]);
    close(final[0],expected[0],'Walk reaches x');close(final[1],expected[1],'Walk reaches y');
    close(motion.getState().floorHeightM,z,'Walk reaches correct floor');
  }
});

test('roof joins are checked against actual lining triangles, and exterior inner faces reach them', () => {
  const roof = interior.group.children.filter(m => m.name.startsWith('interior-roof-lining-'));
  for (const wall of data.walls.filter(w => w.level)) {
    const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1];
    for (const t of [.07, .23, .51, .78, .94]) {
      const x = wall.a[0] + dx * t, y = wall.a[1] + dy * t;
      const intersections = roof.flatMap(mesh => hits(mesh, [x, y, 9], [0, 0, -1], 6)).sort((a, b) => a.distance - b.distance);
      assert(intersections.length, 'Roof lining above ' + wall.id);
      close(intersections[0].point.z, interior.navigation.ceilingHeight(interior.localToWorld([x, y])), wall.id + ' roof matches source mesh');
    }
  }
  for (const [name, x, y, direction] of [['upper-main-side', .36, 2, [-1, 0, 0]], ['upper-front-wing', 12, 4.57, [0, -1, 0]], ['upper-rear-wing', 12, 12.35, [0, 1, 0]], ['upper-garage-side', 8.14, 2, [1, 0, 0]], ['upper-terrace-side', 8.14, 15, [1, 0, 0]]]) {
    const ceiling = interior.navigation.ceilingHeight(interior.localToWorld([x, y]));
    assert(hits(object(name), [x - direction[0] * .01, y - direction[1] * .01, ceiling - .002], direction, .02).length, name + ' closes wedge under sloped roof');
  }
});

test('shared glazing edges and guardrail junctions have one exposed cylinder each', () => {
  const seen = new Map();
  for (const mesh of interior.group.children.filter(m => m.geometry?.type === 'CylinderGeometry')) {
    const b = bounds(mesh), key = [...b.min.toArray(), ...b.max.toArray()].map(n => n.toFixed(5)).join(',');
    assert(!seen.has(key), `${mesh.name} duplicates ${seen.get(key)}`); seen.set(key, mesh.name);
  }
  for (const item of data.furniture.filter(f => ['counter', 'cabinet', 'appliance'].includes(f.type))) {
    const body = bounds(object(item.id + '-body'));
    for (const handle of interior.group.children.filter(m => m.name.startsWith(item.id + '-handle-'))) {
      const h = bounds(handle);
      assert(h.max.x > body.max.x + .02 || h.min.x < body.min.x - .02 || h.max.y > body.max.y + .02 || h.min.y < body.min.y - .02, item.id + ' handle projects beyond cabinet face');
    }
  }
});

test('collinear cylinders never contain even a partial duplicate span', () => {
  const cylinders = interior.group.children.filter(m => m.geometry?.type === 'CylinderGeometry').map(mesh => {
    const {radialSegments,heightSegments}=mesh.geometry.parameters;
    const positions=mesh.geometry.getAttribute('position');
    mesh.updateMatrix();
    const ringCenter=start=>{
      const sum=new THREE.Vector3();
      for(let i=0;i<radialSegments;i++)sum.add(new THREE.Vector3().fromBufferAttribute(positions,start+i));
      return sum.divideScalar(radialSegments).applyMatrix4(mesh.matrix);
    };
    const top=ringCenter(0),base=ringCenter(heightSegments*(radialSegments+1));
    const rim=new THREE.Vector3().fromBufferAttribute(positions,0).applyMatrix4(mesh.matrix);
    return {mesh,axis:top.clone().sub(base).normalize(),center:top.clone().lerp(base,.5),
      height:top.distanceTo(base),radius:top.distanceTo(rim)};
  });
  for (let i = 0; i < cylinders.length; i++) for (let j = i + 1; j < cylinders.length; j++) {
    const a = cylinders[i], b = cylinders[j];
    if (Math.abs(a.radius - b.radius) > 1e-7 || Math.abs(a.axis.dot(b.axis)) < 1 - 1e-7) continue;
    const delta = b.center.clone().sub(a.center), projection = delta.dot(a.axis);
    if (delta.clone().addScaledVector(a.axis, -projection).length() > 1e-5) continue;
    const overlap = Math.min(a.height / 2, projection + b.height / 2) - Math.max(-a.height / 2, projection - b.height / 2);
    assert(overlap <= 1e-5, `${a.mesh.name} partially overlaps ${b.mesh.name} by ${overlap}m`);
  }
});

test('furniture boxes have no duplicate exposed coplanar faces, including beds, chairs and sinks', () => {
  for (const item of data.furniture) {
    const boxes = interior.group.children.filter(m => m.userData.furnitureId === item.id && m.geometry?.type === 'BoxGeometry');
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = bounds(boxes[i]), b = bounds(boxes[j]);
      for (const axis of ['x', 'y', 'z']) for (const side of ['min', 'max']) {
        if (Math.abs(a[side][axis] - b[side][axis]) > 1e-5) continue;
        const overlap = ['x', 'y', 'z'].filter(v => v !== axis).every(v => Math.min(a.max[v], b.max[v]) - Math.max(a.min[v], b.min[v]) > 1e-5);
        assert(!overlap, `${boxes[i].name} and ${boxes[j].name} duplicate exposed ${side}.${axis} faces`);
      }
    }
  }
});

test('folded indigo steel follows all 18 rises, with thin treads and risers closing both runs', () => {
  const s=data.stairs,[sx,sy,ex]=s.box,steps=s.rises/2-1,run=steps*s.tread,half=s.floorHeight/2,rise=s.floorHeight/s.rises;
  for(const [id,x,front,dir,base] of [['lower',sx+s.width/2,sy,1,0],['upper',ex-s.width/2,sy+run,-1,half]]){
    const flight=object('stair-'+id+'-folded-flight');
    assert.equal(flight.material.color.getHex(),0x414a89);
    assert(flight.material.metalness>0&&flight.material.roughness>.4);
    close(bounds(flight).max.x-bounds(flight).min.x,s.width,'Flight width');
    for(let i=0;i<=steps;i++){
      const y=front+dir*i*s.tread,z=base+(i+1)*rise;
      const riser=hits(flight,[x,y-dir*.04,z-rise*.5],[0,dir,0],.09);
      assert(riser.length>=2,'Both surfaces of riser '+i);
      close(riser.at(-1).distance-riser[0].distance,.009,'Sheet thickness across riser');
      if(i===steps)continue;
      const tread=hits(flight,[x,y+dir*.13,z+.035],[0,0,-1],.09);
      close(tread[0].point.z,z,'Tread height');close(tread.at(-1).point.z,z-.009,'Open underside');
    }
    close(bounds(flight).min.z,base,'First riser reaches floor or landing');
    close(bounds(flight).max.z,base+half,'Last riser reaches landing or floor');
  }
  const landing=bounds(object('stair-landing'));
  close(landing.min.y,sy+run,'Landing at turn');close(landing.max.z,half,'Intermediate landing top');
  assert(!interior.group.children.some(mesh=>mesh.name.startsWith('stair-stringer-')));
});

test('the kitchen and hall share terracotta paint on the real kitchen soffit', () => {
  const ceiling=object('kitchen-terracotta-ceiling');
  assert.equal(ceiling.material,object('hall-terracotta-ceiling').material);
  for(const [x,y] of [[.55,8.70],[4,9.65],[6.48,10.25],[6.73,9.24],[7.4,9.8],[7.91,10.27]]){
    const from=[x,y,2.72],up=[0,0,1];
    assert(hits(ceiling,from,up,.11).length);
    assert(hits(object('upper-structure'),from,up,.11).length);
  }
  for(const [x,y] of [[4,10.35],[4,11.5],[4,14],[1.5,8.20],[7.4,8.6],[7.4,9.18],[7.4,10.33],[7.97,9.8],[8,10.1]])
    assert.equal(hits(ceiling,[x,y,2.72],[0,0,1],.11).length,0);
});

test('coral faces and ceiling stay within the ground hall and both concealed doors swing clear', () => {
  const paint=object('hall-terracotta-ceiling').material;
  for(const wall of ['guest-inner','guest-office','hall-front','garage-hall']){
    const mesh=object(wall);
    assert.deepEqual(mesh.geometry.groups.map(g=>g.materialIndex),[0,1],'One draw group per paint color');
  }
  const requestedFace=(name,x,y,dx,dy,z=1.4)=>{
    const hit=hits(object(name),[x,y,z],[dx,dy,0],.45)[0];assert(hit,name+' surface');
    return Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material;
  };
  for(const probe of [['guest-inner',11.10,8.21,1,0],['guest-office',10.9,9.15,0,1],['hall-front',8.88,8.18,0,-1]])
    assert.equal(requestedFace(...probe),paint);
  for(const probe of [['guest-inner',11.46,8.21,-1,0],['guest-inner',11.10,6.9,1,0],['guest-office',12.9,9.11,0,1],['hall-front',8.88,7.72,0,1]])
    assert.notEqual(requestedFace(...probe),paint);
  const ceiling=object('hall-terracotta-ceiling');
  for(const [x,y,expected] of [[9.2,8.55,true],[10.5,9.25,true],[7.3,8.22,true],[10.2,7.7,false],[11.45,8.7,false],[10.3,9.6,false],[5.8,8.9,false],[8.2,9.45,false]])
    assert.equal(hits(ceiling,[x,y,2.70],[0,0,1],.12).length>0,expected,'Hall ceiling at '+[x,y]);
  for(const [id,wall,x,y,dx,dy] of [['office','guest-office',10.34,9.13,0,1],['playroom','guest-inner',11.04,8.84,1,0]]){
    const leaf=object('hall-flush-'+id+'-leaf'),door=leaf.parent;
    const side=door.userData.side;
    assert.equal(leaf.material[side===1?2:3],paint);
    assert.equal(leaf.material[side===1?3:2].color.getHex(),0xe9e3d7);
    const ray=()=>hits(leaf,[x,y,1.25],[dx,dy,0],.32);
    interior.updateHallDoors(null);interior.group.updateMatrixWorld(true);
    assert(ray().length,'Closed door covers the aperture');
    close(ray()[0].distance,.15,'Leaf and hallway plaster are flush');
    const observer=new THREE.Vector3(...interior.localToWorld([x,y,1.7]));
    interior.updateHallDoors(observer);interior.group.updateMatrixWorld(true);
    close(Math.abs(door.rotation.z-door.userData.closedYaw),Math.PI/2,'Opens inward');
    assert(!ray().length,'Open door clears pedestrian approach');
    const hinge=door.position,along=new THREE.Vector3(Math.cos(door.userData.closedYaw),Math.sin(door.userData.closedYaw),0);
    const inward=new THREE.Vector3(along.y*side,-along.x*side,0);
    for(const direction of [-1,1])for(const metres of [.60,.75,.90]){
      const local=hinge.clone().addScaledVector(along,.44).addScaledVector(inward,direction*metres);
      const walker=new THREE.Vector3(...interior.localToWorld([local.x,local.y,1.70]));
      interior.updateHallDoors(walker);interior.group.updateMatrixWorld(true);
      const insideDoor=door.worldToLocal(walker.clone()),nearestX=THREE.MathUtils.clamp(insideDoor.x,0,door.userData.width);
      assert(Math.hypot(insideDoor.x-nearestX,insideDoor.y)>.28+.044,'Swing clears walking capsule on both approaches');
      if(direction===1)close(Math.abs(door.rotation.z-door.userData.closedYaw),Math.PI/2,'Held open throughout the inward swing area');
    }
    assert(!interior.group.children.some(m=>m.name.startsWith(wall+'-opening-')),'No projecting trim');
    interior.updateHallDoors(null);interior.group.updateMatrixWorld(true);
  }
});

test('all thirteen panel doors use their plan handing, room finishes and usable walking openings on the correct floor', async () => {
  const {createWalkCollision}=await load(await readFile(new URL('../src/model/walk.js',import.meta.url),'utf8'));
  const expected=[
    ['garage-pantry',1,0,1],['garage-utility',-1,0,1],['garage-entry',1,1,0],
    ['ground-bath',-1,0,1],['playroom',-1,1,0],['office',1,0,1],
    ['bedroom-one',-1,0,-1],['family-bath',1,1,0],['bedroom-two',-1,-1,0],
    ['laundry',1,-1,0],['private-bath',1,1,0],['dressing',-1,-1,0],['main-bedroom',1,-1,0],
  ];
  const items=data.walls.flatMap(wall=>(wall.doorLeaves??[]).map((spec,i)=>({wall,spec,opening:wall.doors[i]})));
  assert.deepEqual(items.map(i=>i.spec.id).sort(),expected.map(([id])=>id).sort());
  const paints={wall:0xe9e3d7,coral:0xc77d59,garage:0x505b57,oat:0xddd4c5,linen:0xc8c2b5,
    familyBath:0xc8bca9,privateBath:0xb59e87,groundBath:0x81462f};
  for(const [id,hand,openX,openY] of expected){
    const {wall,spec,opening:[lo,hi]}=items.find(item=>item.spec.id===id),base=wall.level?data.levels.upper:0;
    const [x,y]=wall.a,tangent=new THREE.Vector2(...wall.b).sub(new THREE.Vector2(x,y)).normalize();
    const normal=new THREE.Vector2(-tangent.y,tangent.x),mid=new THREE.Vector2(x,y).addScaledVector(tangent,(lo+hi)/2);
    const door=object('hall-flush-'+id),leaf=object(door.name+'-leaf'),{width,closedYaw}=door.userData;
    close(door.position.z,base,id+' storey');close(Math.cos(closedYaw)*tangent.x+Math.sin(closedYaw)*tangent.y,hand,id+' hinge');
    const near=(offset,z)=>[mid.x+normal.x*offset,mid.y+normal.y*offset,z];
    const walk=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<base+1.7&&o.maxZ>base+.00001));
    const crossing=[-.31,.31].map(offset=>interior.localToWorld(near(offset,base)).slice(0,2));
    assert(!walk.pathBlocked(...crossing),id+' capsule crosses the full partition');
    interior.updateHallDoors(null);interior.group.updateMatrixWorld(true);
    for(const face of [-1,1]){
      const hit=hits(leaf,near(face*.2,base+1.42),[-face*normal.x,-face*normal.y,0],.4)[0];
      assert(hit,id+' closed');const finish=face===1?spec.leftFinish:spec.rightFinish;
      assert.equal(hit.object.material[hit.face.materialIndex].color.getHex(),paints[finish],id+' room facing '+finish);
    }
    const feet=leaf.position.z-leaf.geometry.parameters.depth/2;
    assert(feet>(wall.level?.023:.008)&&feet<.04,'Undercut over finished floor');
    for(const offset of [-.31,-.12,0,.12,.31]){
      const eye=new THREE.Vector3(...interior.localToWorld(near(offset,base+1.7)));
      interior.updateHallDoors(eye);interior.group.updateMatrixWorld(true);
      if(spec.slide){
        close((door.position.x-door.userData.x)/(width+.006),openX,id+' pocket direction X');
        close((door.position.y-door.userData.y)/(width+.006),openY,id+' pocket direction Y');
      }else{
        close(Math.cos(door.rotation.z),openX,id+' open leaf X');close(Math.sin(door.rotation.z),openY,id+' open leaf Y');
      }
      const p=leaf.worldToLocal(eye.clone());leaf.geometry.computeBoundingBox();
      assert(leaf.geometry.boundingBox.distanceToPoint(p)>.28,id+' moving panel clears walker');
    }
    interior.updateHallDoors(new THREE.Vector3(...interior.localToWorld(near(0,wall.level?1.7:4.9))));
    close(door.rotation.z,closedYaw,id+' closed on other storey');close(door.position.x,door.userData.x,'Other floor X');close(door.position.y,door.userData.y,'Other floor Y');
  }
  interior.updateHallDoors(null);
});

test('bespoke front, glass, pantry and garden leaves carry their hardware and clear their fixed neighbours', () => {
  const route=[
    ['front-entry-door','entry-main-door-leaf','entry-main-pull-1',[7.4,4.45],[0,1]],
    ['vestibule-glass-door','vestibule-screen-leaf-clear-glass','vestibule-leaf-pull-1',[7.45,7.95],[0,1]],
    ['concealed-pantry-door','kitchen-pantry-closed-leaf','kitchen-pantry-leaf-pull',[1.5,9.18],[0,1]],
    ['garden-terrace-slider','terrace-slider-glass','terrace-slider-pull',[8.205,15.93],[1,0]],
  ];
  for(const [id,leafName,handleName,[x,y],[nx,ny]] of route){
    const door=object(id),leaf=object(leafName),pull=object(handleName);
    assert(door.getObjectById(pull.id)&&door.getObjectById(leaf.id),id+' hardware travels with the leaf');
    const scan=()=>hits(leaf,[x-.35*nx,y-.35*ny,1.3],[nx,ny,0],.7);
    interior.updateHallDoors(null);interior.group.updateMatrixWorld(true);
    assert(scan().length,id+' visible when closed');
    for(const approach of [-.35,0,.35]){
      const observer=new THREE.Vector3(...interior.localToWorld([x+approach*nx,y+approach*ny,1.7]));
      interior.updateHallDoors(observer);interior.group.updateMatrixWorld(true);
      assert(!scan().length,id+' opens the pedestrian route from either side');
    }
  }
  interior.updateHallDoors(null);interior.group.updateMatrixWorld(true);
});

test('both living room roof slopes have uninterrupted smooth white plaster and retain the timber ties', () => {
  const linings=interior.group.children.filter(m=>m.name.startsWith('interior-roof-lining-'));
  for(const x of [1.65,6.70])for(const y of [10.6,12.3,15,16.98]){
    const hit=linings.flatMap(mesh=>hits(mesh,[x,y,3.25],[0,0,1],6))[0];
    assert(hit,'Roof above '+[x,y]);
    const paint=hit.object.material;
    assert.equal(paint.color.getHex(),0xf7f6f1);
    assert.equal(paint.map,null);assert.equal(paint.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);
    assert(paint.roughness>.9);
  }
  const adjacent=linings.flatMap(mesh=>hits(mesh,[2,7,3.25],[0,0,1],6))[0];
  assert.equal(adjacent.object.material.color.getHex(),0xede8df);
  for(const y of [11.45,12.95,14.45,15.95])assert(object('living-collar-tie-'+y).material!==linings[0].material);
});

test('room fixtures are suspended from the slab or the actual sloped lining, with walking headroom', () => {
 const names=['hall','guest','office','upper-hall','upper-one','upper-two','upper-master'];
 for(const id of names){
  const name='light-fixture-'+id+'-',shade=object(name+'shade'),canopy=object(name+'canopy');
  assert.equal(shade.geometry.type,'LatheGeometry');
  const up=new THREE.Vector3(0,1,0).applyQuaternion(canopy.quaternion);
  const anchor=canopy.position.clone().addScaledVector(up,.0125);
  const upper=id.startsWith('upper-');
  const roof=upper?interior.navigation.ceilingHeight(interior.localToWorld([anchor.x,anchor.y])):data.levels.groundCeiling;
  close(anchor.z,roof,id+' mounting height');
  const cord=bounds(object(name+'drop')),collar=bounds(object(name+'collar'));
  assert(cord.min.z<=collar.max.z && cord.max.z>=roof-.011,id+' connected drop');
  assert(bounds(shade).min.z-(upper?data.levels.upper:0)>2.30,id+' clear height');
 }
 const lights=interior.group.children.filter(child=>child.isPointLight);
 assert.equal(lights.length,9+5);
 for(const id of ['entry','family-basin','private-basins','ground-bath','living']){
  const lamp=object('sconce-light-'+id);
  const globe=object(id==='living'?'living-sconce-opal':id==='ground-bath'?'light-fixture-bath-sunburst-opal':'light-fixture-mood-'+id+'-opal');
  assert(lamp.isPointLight && lamp.intensity>0 && lamp.distance>=3);
  assert(lamp.position.distanceTo(globe.position)<.15);
 }
});

test('play mat rests on the floor and the train track rests on the mat', () => {
  close(bounds(object('play-mat-woven-edge')).min.z, data.levels.ground, 'mat base');
  close(bounds(object('play-train-beech-track')).min.z, bounds(object('play-mat-woven-face')).max.z, 'track base');
});

test('surface projection and static batching preserve plaster continuity and independent door movement', async () => {
  const {applyRealisticSurfaces}=await load(await readFile(new URL('../src/model/surface-realism.js',import.meta.url),'utf8'));
  const {batchStaticInteriorDetails}=await load(await readFile(new URL('../src/model/static-detail-batches.js',import.meta.url),'utf8'));
  const scene=new THREE.Scene(),model=addIconInterior({THREE,scene,house,data}),get=name=>model.group.getObjectByName(name);
  const bespoke=['kitchen-pantry-closed-leaf','entry-main-door-leaf','vestibule-screen-leaf-clear-glass','terrace-slider-glass'];
  const authored=bespoke.map(name=>get(name).material);
  await applyRealisticSurfaces({THREE,scene,mats:{},renderer:{capabilities:{getMaxAnisotropy:()=>1}}});
  batchStaticInteriorDetails(THREE,model.group);
  for(const [i,name] of bespoke.entries())assert.equal(get(name).material,authored[i],name+' keeps its authored finish');
  const plaster=get('guest-office').material[0],coral=get('guest-office').material[1];
  assert(plaster.map&&plaster.bumpMap,'Wall has projected plaster');
  for(const [id,axis] of [['office','x'],['playroom','y']]){
    const leaf=get('hall-flush-'+id+'-leaf'),door=leaf.parent,side=door.userData.side;
    assert.equal(leaf.material[side===1?2:3],coral);assert.equal(leaf.material[side===1?3:2],plaster);
    const {position,normal,uv}=leaf.geometry.attributes;
    for(let i=0;i<position.count;i++){
      if(Math.abs(normal.getY(i))<.99)continue;
      const point=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(leaf.matrix).applyMatrix4(door.matrix);
      close(uv.getX(i),point[axis]/2.5,id+' aligns with plaster along the wall');
      close(uv.getY(i),point.z/2.5,id+' aligns with plaster height');
    }
  }
  const doors=model.group.children.filter(o=>o.userData.kind==='walk-door');
  assert.equal(doors.length,17);
  for(const door of doors){
    const {x,y,ux,uy,width,slide,closedYaw}=door.userData;
    model.updateHallDoors(new THREE.Vector3(...model.localToWorld([x+ux*width/2,y+uy*width/2,door.position.z+1.7])));
    if(slide)assert(Math.hypot(door.position.x-x,door.position.y-y)>=width);
    else close(Math.abs(door.rotation.z-closedYaw),Math.PI/2,door.name+' still swings after batching');
    model.updateHallDoors(null);
  }
});

test('the house can omit the optional pantry cabinet and retain its walking doors', () => {
  const noPantry={...data,furniture:data.furniture.filter(item=>item.id!=='kitchen-pantry')};
  const model=addIconInterior({THREE,scene:new THREE.Scene(),house,data:noPantry});
  assert(!model.group.getObjectByName('concealed-pantry-door'));
  assert.equal(model.group.children.filter(o=>o.userData.kind==='walk-door').length,16);
  model.updateHallDoors(new THREE.Vector3(...model.localToWorld([1.5,8.52,1.7])));
  model.updateHallDoors(null);
});
