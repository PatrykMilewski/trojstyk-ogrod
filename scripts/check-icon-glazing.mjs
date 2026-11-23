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
const { mergeInteriorNavigation } = await load(await readFile(new URL('../src/model/walk.js', import.meta.url), 'utf8'));
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

test('living-room upper glazing remains transparent across its full opening', () => {
 const wall=object('garden-gable');
 for(const x of [1.1,2,3,4.25,5.5,6.5,7.4]) {
  const top=x<4.25?3.95+(x-.9)*3.4/3.35:7.35-(x-4.25)*3.4/3.35;
  for(let z=3.3;z<top-.08;z+=.23) assert.equal(hits(wall,[x,17,z],[0,1,0],2).length,0,`Opaque wall blocks window at ${x},${z}`);
 }
});
test('upper living-room glass has exactly the same recess as lower glass', () => {
 const upper=bounds(object('garden-gable-glass-0'));
 const lower=interior.group.children.filter(m=>m.name.startsWith('facade-')&&m.name.includes('-glass-')).map(bounds).find(b=>b.min.y>16);
 assert(lower,'lower garden glazing exists');close(upper.min.y,lower.min.y,'upper/lower glass plane');
});

test('recess keeps the full glass polygon and does not cover it with reveal surfaces', () => {
 const glass=object('garden-gable-glass-0'),outline=bounds(glass);
 close(outline.min.x,.9,'glazing left');close(outline.max.x,7.6,'glazing right');close(outline.min.z,3.2,'glazing sill');close(outline.max.z,7.35,'glazing apex');
 assert(glass.material.transparent);assert.equal(glass.castShadow,false);
 assert(!interior.group.getObjectByName('garden-gable-mullion-0'),'No extra floating half-height mullion between the two original full dividers');
 const reveal=object('garden-gable-reveal-0'),sill=object('garden-window-transom');
 for(const x of [1.1,2,3,4.25,5.5,6.5,7.4]) {
  const top=x<4.25?3.95+(x-.9)*3.4/3.35:7.35-(x-4.25)*3.4/3.35;
  for(let z=3.3;z<top-.08;z+=.23) {
   for(const opaque of [object('garden-gable'),reveal,sill])assert.equal(hits(opaque,[x,16,z],[0,1,0],3).length,0,`${opaque.name} blocks recessed glazing`);
   assert(hits(glass,[x,16,z],[0,1,0],3).length,'Upper glass remains present');
  }
 }
 close(bounds(object('garden-gable')).max.y,18.13,'original gable face preserved');
 for(const x of [3.1,5.4])close(bounds(object('garden-upper-triangle-mullion-'+x)).min.y,outline.min.y-.025,'mullion follows glass');
 close(bounds(sill).max.y,outline.min.y,'transom flush with glazing');close(bounds(sill).min.y,outline.min.y-.12,'transom lies behind glass plane');
 assert.equal(hits(reveal,[4,17.3,3.5],[0,0,-1],.4).length,0,'No duplicate plane atop sill box');
 assert.equal(hits(sill,[4,17.3,3.5],[0,0,-1],.4).length,0,'No projecting shelf in front of glazing');
});

test('lower garden glazing has two fixed sidelights and a framed centre leaf on a parallel track', () => {
 const left=1,right=7.5,width=(right-left)/3;
 const leaf=object('living-garden-slider');
 interior.updateHallDoors(null);interior.group.updateMatrixWorld(true);
 close(leaf.position.x,left+width+.003,'moving panel clears first divider');
 close(leaf.userData.width,width-.006,'centre sash fits between equal bays');
 close(leaf.position.y,16.795,'moving track');
 const glass=object('living-slider-glass');
 assert(glass.material.transparent);assert.equal(glass.castShadow,false);
 for(const i of [0,2]){
  const pane=object('facade-garden-glass-0-pane-'+i),b=bounds(pane);
  close(b.min.x,left+i*width,'fixed panel start');close(b.max.x,left+(i+1)*width,'fixed panel end');
  close(b.min.y,16.86,'fixed glazing recess');close(b.min.z,0,'sill');close(b.max.z,2.35,'head');
  assert(pane.material.transparent);assert.equal(pane.castShadow,false);
 }
 for(const i of [1,2]){
  const b=bounds(object('facade-garden-mullion-0-'+i));
  close((b.min.x+b.max.x)/2,left+i*width,'divider between panels');
  close(b.min.z,0,'divider base');close(b.max.z,2.35,'divider top');
 }
});

test('a walker can cross the centre from the garden or living room while the fixed bays block passage', async () => {
 const {createWalkCollision,createWalkMotion}=await load(await readFile(new URL('../src/model/walk.js',import.meta.url),'utf8'));
 const leaf=object('living-garden-slider'),parts=leaf.children;
 const world=(x,y,z=0)=>interior.localToWorld([x,y,z]);
 const pose=eye=>{interior.updateHallDoors(eye&&new THREE.Vector3(...eye));interior.group.updateMatrixWorld(true);};
 const inHouse=mesh=>{
  mesh.geometry.computeBoundingBox();
  const matrix=interior.group.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  return mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
 };
 const fixed=['facade-garden-glass-0-pane-0','facade-garden-glass-0-pane-2','facade-garden-mullion-0-1',
  'facade-garden-mullion-0-2','curtain-living-left','curtain-living-right','curtain-living-track'].map(object);
 const occupied=createWalkCollision(interior.navigation.obstacles.filter(o=>o.minZ<1.7&&o.maxZ>0));
 for(const x of [2.25,6.3])assert(occupied.pathBlocked(world(x,16.3),world(x,17.45)),'fixed bay blocks a walking capsule');
 for(const side of [-1,1]){
  const x=4.7,start=16.785+side*1.4,end=16.785-side*1.4;
  const motion=createWalkMotion(createWalkCollision([]),interior.navigation);
  const a=world(x,start),b=world(x,end),yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);
  motion.reset(a);pose(motion.getState().position);
  assert(hits(object('living-slider-glass'),[x,16.3,1.3],[0,1,0],1).length,'leaf closes at a distance');
  let halfway=false,fullyOpen=false;
  for(let i=0;i<70;i++){
   const position=motion.move(1,0,Math.abs(end-start)/70/2.2,yaw);
   pose(position);
   const travelled=leaf.position.x-leaf.userData.x;
   halfway||=travelled>.01&&travelled<leaf.userData.width-.01;
   fullyOpen||=travelled>=leaf.userData.width;
   const eye=new THREE.Vector3(...position).applyMatrix4(interior.group.matrixWorld.clone().invert());
   for(const part of parts){
    const box=inHouse(part);
    assert(box.max.x<7.5,part.name+' clears right masonry jamb');
    for(const neighbour of fixed)assert(!box.intersectsBox(inHouse(neighbour)),part.name+' clears '+neighbour.name);
    const capsulePoint=new THREE.Vector3(eye.x,eye.y,THREE.MathUtils.clamp(eye.z-.4,box.min.z,box.max.z));
    assert(box.distanceToPoint(capsulePoint)>.28,part.name+' clears walker');
   }
  }
  assert(halfway&&fullyOpen,'leaf slides progressively and parks beside the opening');
  const p=motion.getState().position;close(p[0],b[0],'crossed X');close(p[1],b[1],'crossed Y');
  close(leaf.position.x,leaf.userData.x,'leaf closes behind walker');
 }
 pose(null);
});

test('vertical gable bars touch both the sill and the sloping frame', () => {
 for(const [id,upper] of [['front-gable-mullion-0',(3.9+7.25)/2],['wing-gable-mullion-0',(4.15+7.3)/2],
   ...[3.1,5.4].map(x=>['garden-upper-triangle-mullion-'+x,7.35-Math.abs(x-4.25)*3.4/3.35])]){
  const bar=bounds(object(id));
  close(bar.min.z,3.2,id+' sill');close(bar.max.z,upper,id+' sloped frame');
 }
});

test('master bath doorway clears the hall partition and closes the slit toward the landing', () => {
 const wall=object('u-suite-front');
 for(const z of [3.32,4.9,5.25]){
  assert(hits(wall,[9.77,8.10,z],[0,-1,0],.35).length,'wall beside the master bathroom');
  assert(!hits(wall,[10.45,8.10,z],[0,-1,0],.35).length,'private bathroom doorway');
 }
 for(const [name,x,y,z] of [
  ['u-laundry-private',8.84,4.85,4.06],['u-private-dressing',11.62,4.85,4.06],
  ['u-private-dressing',11.62,4.72,3.96],['u-suite-hall',9.87,12.20,3.96]
 ])assert(hits(object(name),[x-.2,y,z],[1,0,0],.4).length,name+' closes at the eaves');
});

test('closed office glazing retains the original floor-to-head lights and 50 mm profiles',()=>{
 const wing=data.facades.find(f=>f.id==='facade-wing-end'),opening=wing.openings.find(o=>o.casement);
 const {bottom,top}=opening,start=wing.a[1]+opening.start,end=wing.a[1]+opening.end,mid=(start+end)/2;
 close(end-start,2.14,'Original opening width');close(top-bottom,2.35,'Original full height');close(bottom,0,'Original floor line');
 const fixed=object('facade-wing-end-glass-1'),moving=object('office-window-sash-glass');
 const profiles=interior.group.getObjectsByProperty('isMesh',true).filter(m=>/^office-window-(fixed|frame|sash|gasket)-/.test(m.name)&&m!==moving);
 for(const z of [.10,.51,.96,1.37,2.24]){
  for(const [y,pane] of [[mid-.48,fixed],[mid+.48,moving]]){
   assert(hits(pane,[14,y,z],[1,0,0]).length);
   assert(!profiles.some(m=>hits(m,[14,y,z],[1,0,0]).length),'No opaque transom');
  }
  for(const y of [start,mid,end]){
   for(const offset of [-.020,0,.020])assert(profiles.some(m=>hits(m,[14,y+offset,z],[1,0,0]).length),'Original slim vertical profile');
   for(const offset of [-.026,.026])assert(!profiles.some(m=>hits(m,[14,y+offset,z],[1,0,0]).length),'Clear outside 50 mm profile');
  }
 }
});

test('office casement opens and closes from a visible walking view and the open aperture is clear',()=>{
 const sash=object('office-window-sash'),pane=object('office-window-sash-glass'),control=interior.officeWindow;
 const camera=new THREE.PerspectiveCamera(68,1.4,.05,35);
 const aim=(eye,target)=>{
  camera.up.set(0,0,1);
  camera.position.fromArray(interior.localToWorld(eye));
  camera.lookAt(new THREE.Vector3(...interior.localToWorld(target)));camera.updateMatrixWorld();
 };
 const ndc={x:0,y:0},local=mesh=>mesh.getWorldPosition(new THREE.Vector3()).applyMatrix4(interior.group.matrixWorld.clone().invert()).toArray();
 const eye=[12.15,10.13,1.62];
 const tap=()=>control.toggleAt(ndc,camera);
 const paneCenter=()=>{interior.group.updateMatrixWorld(true);return local(pane);};
 const walking=mergeInteriorNavigation([{parcel:'193',navigation:interior.navigation}]);
 const barrier=walking.obstacles.find(item=>item.id==='193:office-window-moving-barrier');
 const threshold=interior.localToWorld([14.4,11.12,0]);
 assert(contains(threshold,barrier.ring),'Closed leaf blocks passage');
 assert.equal(control.isOpen,false);const closed=paneCenter();
 aim([12.15,8.7,1.62],closed);assert.equal(tap(),false,'Partition blocks taps through walls');
 aim(eye,[14.4,10.10,.55]);assert.equal(tap(),false,'Fixed light is distinct');
 aim(eye,closed);assert.equal(tap(),true);assert.equal(control.isOpen,true);
 control.update(performance.now()+350);const open=paneCenter();
 assert(open[0]<closed[0]-.4&&open[1]<closed[1]-.35);
 assert(!contains(threshold,barrier.ring),'Open leaf frees its half of the opening');
 assert(contains(interior.localToWorld(open),barrier.ring),'Walker collides with the open leaf');
 const aperture=[14,11.18,1.6],direction=[1,0,0];
 assert.equal(hits(pane,aperture,direction,1).length,0);
 assert.equal(hits(object('facade-wing-end-glass-1'),aperture,direction,1).length,0);
 for(const z of [.04,.56,.96,1.65,2.31]){
  assert.equal(hits(pane,[14,11.16,z],direction,1).length,0,'Open all the way down to the floor');
  assert.equal(hits(object('facade-wing-end-glass-1'),[14,11.16,z],direction,1).length,0);
 }
 assert(hits(object('facade-wing-end-glass-1'),[14,10.07,1.65],direction,1).length);
 aim(eye,open);assert.equal(tap(),true);assert.equal(control.isOpen,false);
 control.update(performance.now()+350);const restored=paneCenter();
 restored.forEach((v,i)=>close(v,closed[i],'Closed sash returns to frame'));
 assert(contains(threshold,barrier.ring));
 for(const z of [.04,.56,.96,1.65,2.31])assert(hits(pane,[14,11.16,z],direction,1).length,'Closed moving light seals the whole aperture');
});

test('office sash clears the actual linen folds, desk, chair, dog bed and head through its inward swing',()=>{
 const sash=object('office-window-sash'),inverse=interior.group.matrixWorld.clone().invert();
 const worldBounds=mesh=>{
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
 };
 const furnitureIds=['office-desk-window','office-chair-window','office-pug-bed'];
 const wing=data.facades.find(f=>f.id==='facade-wing-end'),opening=wing.openings.find(o=>o.casement);
 const neighbours=['curtain-study-left','curtain-study-right','curtain-study-track','cast-iron-plant-pot','cast-iron-plant-foliage',
  'office-window-frame-latch','office-window-frame-hinge','office-window-frame-sill','office-window-frame-head',
  ...['latch','hinge','head','sill'].map(id=>'office-window-gasket-'+id)]
  .map(name=>[name,worldBounds(object(name))]);
 interior.group.traverse(mesh=>{
  if(mesh.isMesh&&furnitureIds.includes(mesh.userData.furnitureId))neighbours.push([mesh.name,worldBounds(mesh)]);
 });
 assert(neighbours.length>14);
 const initial=sash.rotation.z;
 try{
  for(let angle=0;angle<=84;angle+=2){
   sash.rotation.z=THREE.MathUtils.degToRad(angle);interior.group.updateMatrixWorld(true);
   for(const moving of sash.children){
    const sweptPart=worldBounds(moving);
    assert(sweptPart.min.y>wing.a[1]+opening.start&&sweptPart.max.y<wing.a[1]+opening.end+.0015,'Clears both wall reveals');
    assert(sweptPart.min.z>opening.bottom&&sweptPart.max.z<opening.top,'Clears the lintel and sill');
    for(const [name,obstacle] of neighbours){
     if(!sweptPart.intersectsBox(obstacle))continue;
     // Transform the obstacle back to the leaf axes to test the two remaining planar separating axes.
     const inversePose=inverse.clone().multiply(moving.matrixWorld).invert();
     assert(!moving.geometry.boundingBox.intersectsBox(obstacle.clone().applyMatrix4(inversePose)),moving.name+' clips '+name+' at '+angle+' degrees');
    }
   }
  }
 }finally{sash.rotation.z=initial;interior.group.updateMatrixWorld(true);}
});
