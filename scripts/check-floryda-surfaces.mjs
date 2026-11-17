import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const load=source=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html=await readFile(new URL('../trzy-domy-3d/index.html',import.meta.url),'utf8');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'",`'${imports['three/core']}'`));
const marker='const [source,garden,house,neighbors]=';
const start=html.indexOf(marker)+marker.length;
const [,,,neighbors]=JSON.parse(html.slice(start,html.indexOf(';\nconst landscaping=',start)));
const house=neighbors.houses.find(h=>String(h.parcel)==='190');
const source=await readFile(new URL('../src/model/floryda-interior.js',import.meta.url),'utf8');
const data=JSON.parse(await readFile(new URL('../trzy-domy-3d/floryda-interior-data.json',import.meta.url),'utf8'));
const {addFlorydaInterior}=await load(source);
const {createWalkCollision,createWalkMotion}=await load(await readFile(new URL('../src/model/walk.js',import.meta.url),'utf8'));
const {navigation,localToWorld,group}=addFlorydaInterior({THREE,scene:new THREE.Scene(),house,data});

const furnitureNames=new Set(data.furniture.map(f=>'floryda-'+f.id+'-'));
const visibleParts=group.children.filter(m=>m.isMesh&&([...furnitureNames].some(prefix=>m.name.startsWith(prefix))||m.name.includes('-finish')||m.name.startsWith('floryda-tile-')));
function clip(subject,edgeA,edgeB) {
 const cross=p=>(edgeB[0]-edgeA[0])*(p[1]-edgeA[1])-(edgeB[1]-edgeA[1])*(p[0]-edgeA[0]);
 const output=[];
 for(let i=0;i<subject.length;i++) {
  const a=subject[i],b=subject[(i+1)%subject.length],ca=cross(a),cb=cross(b);
  if(ca>=-1e-8)output.push(a);
  if((ca>1e-8&&cb< -1e-8)||(ca< -1e-8&&cb>1e-8)){const t=ca/(ca-cb);output.push(a.map((v,j)=>v+(b[j]-v)*t));}
 }
 return output;
}
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
function coplanarOverlaps(meshes) {
 const planes=new Map(),overlaps=[];
 for(const mesh of meshes) {
  mesh.updateMatrix();const g=mesh.geometry,index=g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i),position=g.attributes.position;
  for(let i=0;i<index.length;i+=3) {
   const vertices=Array.from({length:3},(_,j)=>new THREE.Vector3().fromBufferAttribute(position,index[i+j]).applyMatrix4(mesh.matrix));
   const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize(),axis=[0,1,2].find(a=>Math.abs(normal.getComponent(a))>.99999);
   if(axis===undefined)continue;
   const axes=[0,1,2].filter(a=>a!==axis),sign=Math.sign(normal.getComponent(axis)),height=vertices[0].getComponent(axis),key=[axis,sign,Math.round(height*1e5)].join(':');
   let polygon=vertices.map(v=>axes.map(a=>v.getComponent(a)));
   const signed=polygon.reduce((sum,a,j)=>{const b=polygon[(j+1)%3];return sum+a[0]*b[1]-b[0]*a[1];},0);if(signed<0)polygon.reverse();
   const bucket=planes.get(key)??[];
   for(const other of bucket) {
    if(other.name===mesh.name)continue;
    let intersection=polygon;for(let j=0;j<3&&intersection.length;j++)intersection=clip(intersection,other.polygon[j],other.polygon[(j+1)%3]);
    if(intersection.length&&area(intersection)>.000001)overlaps.push([mesh.name,other.name,key,area(intersection)]);
   }
   bucket.push({name:mesh.name,polygon});planes.set(key,bucket);
  }
 }
 return overlaps;
}
test('rendered furniture and finish meshes have no overlapping top or upright coplanar faces',()=>{
 assert.deepEqual([...new Set(coplanarOverlaps(visibleParts).filter(o=>!o[2].startsWith('2:-1:')).map(o=>o.slice(0,3).join(' / ')))],[]);
});
test('coplanar regression detects intentionally duplicated countertop geometry',()=>{
 const original=group.getObjectByName('floryda-kitchen-island-top'),duplicate=original.clone();duplicate.name='intentional-duplicate';
 assert(coplanarOverlaps([original,duplicate]).length>0);
});
test('each stair rail post lands on rendered floor, tread or landing geometry',()=>{
 const supports=group.children.filter(m=>m.isMesh&&(/floryda-stair-(lower|upper|landing)/.test(m.name)||m.name.endsWith('-finish')));
 group.updateMatrixWorld(true);
 const posts=group.children.filter(m=>m.userData.railAnchor);assert(posts.length>120);
 for(const post of posts) {
  const anchor=post.userData.railAnchor.position,p=localToWorld(anchor),ray=new THREE.Raycaster(new THREE.Vector3(p[0],p[1],p[2]+.003),new THREE.Vector3(0,0,-1),0,.012);
  assert(ray.intersectObjects(supports,false).length,`Unsupported visible post ${post.name}: ${anchor}`);
 }
});
test('both sides of each flight join the landing rails without gaps',()=>{
 const rail=id=>group.getObjectByName('floryda-handrail-'+id).userData.rail;
 for(const [left,right,endpoint] of [['lower-outer','landing-low','a'],['upper-outer','landing-high','b'],['lower-inner','turn','a'],['upper-inner','turn','b']])assert.deepEqual(rail(left).b,rail(right)[endpoint]);
 assert.deepEqual(rail('upper-floor-edge').b,rail('upper-floor-return').a);assert.deepEqual(rail('upper-floor-return').b,rail('upper-inner').a);
 assert.deepEqual(rail('landing-low').b,rail('landing-end').a);assert.deepEqual(rail('landing-end').b,rail('landing-high').a);
 for(const id of ['lower-outer','lower-inner','upper-outer','upper-inner']) {
  const posts=group.children.filter(m=>m.userData.railAnchor?.support===id);assert(posts.length>=13);
  for(let i=1;i<posts.length;i++)assert(new THREE.Vector3(...posts[i].userData.railAnchor.position).distanceTo(new THREE.Vector3(...posts[i-1].userData.railAnchor.position))<.25);
 }
});
const polygonArea=polygon=>area(polygon);
function meshArea(mesh) {
 const p=mesh.geometry.attributes.position,index=mesh.geometry.index?.array??Array.from({length:p.count},(_,i)=>i);let total=0;
 for(let i=0;i<index.length;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,index[i]),b=new THREE.Vector3().fromBufferAttribute(p,index[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,index[i+2]);total+=b.sub(a).cross(c.sub(a)).length()/2;}return total;
}
test('floor finish triangles exactly cover each envelope except the stair hole',()=>{
 for(const level of [0,1]) {
  const name=level?'upper':'ground',finish=group.getObjectByName('floryda-'+name+'-finish');
  const tiles=data.rooms.filter(r=>r.level===level&&r.finish==='tile').map(r=>group.getObjectByName('floryda-tile-'+r.id));
  const hole=level?polygonArea(data.stairs.opening):0;
  assert(Math.abs(meshArea(finish)+tiles.reduce((sum,m)=>sum+meshArea(m),0)-polygonArea(data.exterior[name])+hole)<.0001,`Invalid ${name} finish tessellation`);
 }
});
test('window glass is framed by four complete nonoverlapping bars',()=>{
 for(const o of data.openings.filter(o=>o.kind!=='door')) {
  const frame=['left','right','top','bottom'].map(side=>group.getObjectByName(o.id+'-frame-'+side));assert(frame.every(Boolean));
  assert.deepEqual(coplanarOverlaps(frame),[]);assert(group.getObjectByName(o.id+'-glass'));
 }
 assert(!data.openings.some(o=>o.id==='kitchen-side'),'Solid source kitchen cabinetry wall must have no invented glazing');
});
test('independent source corrections render missing furniture, desk faces and double vanity',()=>{
 for(const id of ['master-open-dressing-long','living-left-return','master-bedside-a','master-bedside-b','child17-bedside','child18-bedside'])assert(data.furniture.some(f=>f.id===id));
 assert(!data.walls.some(w=>w.id==='u-master-child'),'Furniture front must not close the dressing room');
 for(const id of ['office-desk','child18-desk']){const m=group.getObjectByName('floryda-'+id+'-monitor');assert(m.geometry.parameters.width<m.geometry.parameters.height);}
 for(const id of ['master-armchair-0','master-armchair-1'])assert.equal(Math.abs(group.getObjectByName('floryda-'+id+'-back').rotation.z),Math.PI/4);
 for(const i of [0,1])assert(group.getObjectByName('floryda-master-vanity-water-'+i));
});
test('structural floor edges close flush with finishes without duplicate upper caps',()=>{
 for(const level of [0,1]) {
  const floor=group.getObjectByName('floryda-'+(level?'upper':'ground')+'-floor'),p=floor.geometry.attributes.position,z=level?data.metadata.levels.upper:0;
  let highest=-Infinity;
  for(let i=0;i<p.count;i+=3){const heights=[0,1,2].map(j=>p.getZ(i+j)+floor.position.z);highest=Math.max(highest,...heights);assert(!heights.every(h=>Math.abs(h-z)<.000001),'Duplicate floor cap beneath finish');}
  assert(Math.abs(highest-z)<.000001,'Visible slab-edge air gap');
 }
});
test('rendered unequal stair flights preserve eighteen source rises and clear the service doorway',()=>{
 const lower=group.getObjectByName('floryda-stair-lower-flight'),upper=group.getObjectByName('floryda-stair-upper-flight');
 assert.equal(lower.userData.stair.rises,12);assert.equal(upper.userData.stair.rises,6);assert.equal(lower.userData.stair.top,2.23);assert.equal(upper.userData.stair.top,3.35);
 const doorway=data.walls.find(w=>w.id==='g-utility-stair-door');assert(doorway.openings.some(o=>o.open&&o.end-o.start>.9&&o.top===2.05));
});
test('rail cylinders have neither exact nor partial coaxial duplicate spans',()=>{
 const cylinders=group.children.filter(m=>m.geometry?.type==='CylinderGeometry').map(mesh=>({mesh,axis:new THREE.Vector3(0,1,0).applyQuaternion(mesh.quaternion),center:mesh.position,height:mesh.geometry.parameters.height,radius:mesh.geometry.parameters.radiusTop}));
 for(let i=0;i<cylinders.length;i++)for(let j=i+1;j<cylinders.length;j++) {
  const a=cylinders[i],b=cylinders[j];if(Math.abs(a.radius-b.radius)>1e-7||Math.abs(a.axis.dot(b.axis))<1-1e-7)continue;
  const delta=b.center.clone().sub(a.center),projection=delta.dot(a.axis);if(delta.clone().addScaledVector(a.axis,-projection).length()>1e-5)continue;
  const overlap=Math.min(a.height/2,projection+b.height/2)-Math.max(-a.height/2,projection-b.height/2);
  assert(overlap<=1e-5,`${a.mesh.name} overlaps ${b.mesh.name} by ${overlap}m`);
 }
});
test('the lower flight final riser closes continuously into the landing',()=>{
 const s=data.stairs,landing=group.getObjectByName('floryda-stair-landing'),lastTread=s.landingHeight*(s.lowerRises-1)/s.lowerRises;
 group.updateMatrixWorld(true);
 for(let i=1;i<10;i++) {
  const z=lastTread+(s.landingHeight-lastTread)*i/10,p=localToWorld([s.landingStart-.03,s.box[1]+s.width/2,z]),end=localToWorld([s.landingStart+1,s.box[1]+s.width/2,z]);
  const direction=new THREE.Vector3(...end).sub(new THREE.Vector3(...p)).normalize(),ray=new THREE.Raycaster(new THREE.Vector3(...p),direction,0,.05);
  assert(ray.intersectObject(landing,false).length,`Open final riser at ${z}m`);
 }
});
