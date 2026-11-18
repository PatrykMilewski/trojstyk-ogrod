import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const load = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../trzy-domy-3d/index.html',import.meta.url),'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'",`'${imports['three/core']}'`));
const groundSource = await readFile(new URL('../src/model/ground-surfaces.js',import.meta.url),'utf8');
const {interiorGroundRings,groundSurfaceGeometry,mapGroundGeometry} = await load(groundSource);
const {createWalkDepthGuard} = await load(await readFile(new URL('../src/model/walk.js',import.meta.url),'utf8'));
const marker = 'const [source,garden,house,neighbors]=';
const start = html.indexOf(marker)+marker.length;
const [,,house,neighbors] = JSON.parse(html.slice(start,html.indexOf(';\nconst landscaping=',start)));
const footprints = interiorGroundRings(house,neighbors);
const rayHit = (geometry,point) => new THREE.Raycaster(new THREE.Vector3(...point,1),new THREE.Vector3(0,0,-1))
  .intersectObject(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))).length > 0;
const polygonArea = ring => Math.abs(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2);
function geometryArea(geometry) {
  const p=geometry.attributes.position,index=geometry.index;let area=0;
  for(let i=0;i<index.count;i+=3) {
    const a=new THREE.Vector3().fromBufferAttribute(p,index.getX(i));
    const b=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+1));
    const c=new THREE.Vector3().fromBufferAttribute(p,index.getX(i+2));
    area+=b.sub(a).cross(c.sub(a)).length()/2;
  }
  return area;
}
test('parcel turf removes exact interior footprints while preserving cadastral outline',()=>{
  for(const {parcel,ring} of footprints) {
    const polygon=neighbors.parcels[parcel].coordinates[0];
    const geometry=groundSurfaceGeometry(THREE,{ring:polygon,exclusions:[ring]});
    assert(Math.abs(geometryArea(geometry)-(polygonArea(polygon)-polygonArea(ring)))<.001,parcel);
    const floor=new THREE.ShapeGeometry(new THREE.Shape(ring.map(p=>new THREE.Vector2(...p))));
    let samples=0;
    for(let x=Math.min(...ring.map(p=>p[0]))+.137;x<Math.max(...ring.map(p=>p[0]));x+=.43) {
      for(let y=Math.min(...ring.map(p=>p[1]))+.173;y<Math.max(...ring.map(p=>p[1]));y+=.43) {
        if(!rayHit(floor,[x,y]))continue;samples++;
        assert(!rayHit(geometry,[x,y]),`Turf overlaps /${parcel} floor at ${x},${y}`);
      }
    }
    assert(samples>100);
  }
});
test('map cutouts preserve world-aligned texture UV and never cover interior floors',()=>{
  const bounds=[-180,-180,180,180],rings=footprints.map(item=>item.ring);
  const geometry=mapGroundGeometry(THREE,bounds,rings),p=geometry.attributes.position,uv=geometry.attributes.uv;
  assert(Math.abs(geometryArea(geometry)-(360*360-rings.reduce((sum,r)=>sum+polygonArea(r),0)))<.01);
  for(let i=0;i<p.count;i++) {
    assert(Math.abs(uv.getX(i)-(p.getX(i)+180)/360)<1e-6);
    assert(Math.abs(uv.getY(i)-(p.getY(i)+180)/360)<1e-6);
  }
  assert(rayHit(geometry,[170,170]));
});
test('walking depth range covers scene from near and distant viewpoints without a 5km far plane',()=>{
  const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(360,360,12),new THREE.MeshBasicMaterial());scene.add(mesh);
  const camera=new THREE.PerspectiveCamera(),fit=createWalkDepthGuard(THREE,camera,scene);
  camera.position.set(0,0,1.7);fit();assert.equal(camera.near,.12);assert(camera.far<300);
  for(const x of [0,250,2000]) {
    camera.position.set(x,-x,1.7);fit();
    for(const a of [-180,180])for(const b of [-180,180])for(const z of [-6,6]) {
      assert(new THREE.Vector3(a,b,z).distanceTo(camera.position)<camera.far);
    }
  }
});
test('published ground surface implementation matches source',()=>{
  assert(html.includes(groundSource.replaceAll('export ','')));
});

test('Icon wooden floors share the measured parquet scan while wet rooms and Floryda keep their own finishes',async()=>{
  const source=await readFile(new URL('../src/model/surface-realism.js',import.meta.url),'utf8');
  const {applyRealisticSurfaces}=await load(source);
  const scene=new THREE.Scene(),icon=new THREE.Group(),floryda=new THREE.Group();
  icon.name='icon-193-interior';floryda.name='floryda-190-interior';scene.add(icon,floryda);
  const floor=(parent,name,color)=>{
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(3.4,3.4),new THREE.MeshStandardMaterial({color}));
    mesh.name=name;parent.add(mesh);return mesh;
  };
  const {addIconInterior}=await load(await readFile(new URL('../src/model/interior.js',import.meta.url),'utf8'));
  const data=JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json',import.meta.url),'utf8'));
  const model=addIconInterior({THREE,scene:new THREE.Scene(),house,data});
  const [ground,upper,wet]=['ground-floor','upper-oak-finish','finish-0.1'].map(name=>model.group.getObjectByName(name));
  icon.add(ground,upper,wet);
  const other=floor(floryda,'ground-floor',0xb9956c);
  const maps=[new THREE.Texture(),new THREE.Texture()];
  class Loader {async loadAsync(index){return maps[index];}}
  await applyRealisticSurfaces({THREE:{...THREE,TextureLoader:Loader},scene,mats:{},
    renderer:{capabilities:{getMaxAnisotropy:()=>4}},scans:{parquet:[0,1]}});
  for(const mesh of [ground,upper]){
    assert.equal(mesh.material.map,maps[0]);assert.equal(mesh.material.bumpMap,maps[1]);
    const {uv,position,normal}=mesh.geometry.attributes;
    let vertices=0;
    for(let i=0;i<uv.count;i++){
      if(normal.getZ(i)<.99)continue;
      assert(Math.abs(uv.getX(i)*3.4-position.getX(i))<1e-5);
      assert(Math.abs(uv.getY(i)*3.4-position.getY(i))<1e-5);
      vertices++;
    }
    assert(vertices>=3,'Each floor has a horizontal parquet surface');
  }
  assert.equal(wet.material.name,'tile');assert.equal(other.material.name,'oak');
  assert(html.includes('"parquet": ["data:image/webp;base64,'),'Standalone viewer contains the floor texture');
});
