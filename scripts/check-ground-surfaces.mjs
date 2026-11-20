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
const [site,garden,house,neighbors] = JSON.parse(html.slice(start,html.indexOf(';\nconst landscaping=',start)));
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

test('Icon floors use 592 × 148 mm Dąb Virgin vinyl at the existing heights and wet rooms and Floryda keep their finishes',async()=>{
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
  const heights=[ground,upper].map(mesh=>({origin:mesh.position.z,vertices:Array.from(mesh.geometry.attributes.position.array)}));
  const maps=[new THREE.Texture(),new THREE.Texture()];
  class Loader {async loadAsync(index){return maps[index];}}
  await applyRealisticSurfaces({THREE:{...THREE,TextureLoader:Loader},scene,mats:{},
    renderer:{capabilities:{getMaxAnisotropy:()=>4}},scans:{virginOakVinyl:[0,1]}});
  // Four plank lengths cross the texture diagonal per axis (16 widths at 45 degrees).
  const repeat=4*.592*Math.SQRT2;
  for(const [index,mesh] of [ground,upper].entries()){
    assert.equal(mesh.material.name,'virginOakVinyl');
    assert.equal(mesh.material.color.getHex(),0xffffff);
    assert.equal(mesh.material.bumpScale,.00065);
    assert.equal(mesh.position.z,heights[index].origin);
    assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),heights[index].vertices);
    assert.equal(mesh.material.map,maps[0]);assert.equal(mesh.material.bumpMap,maps[1]);
    const {uv,position,normal}=mesh.geometry.attributes;
    let vertices=0;
    for(let i=0;i<uv.count;i++){
      if(normal.getZ(i)<.99)continue;
      assert(Math.abs(uv.getX(i)*repeat-position.getX(i))<1e-5);
      assert(Math.abs(uv.getY(i)*repeat-position.getY(i))<1e-5);
      vertices++;
    }
    assert(vertices>=3,'Each floor has a horizontal vinyl surface');
  }
  assert.equal(wet.material.name,'tile');assert.equal(other.material.name,'oak');
  const images=await Promise.all(['.webp','-relief.webp'].map(async suffix=>{
    const bytes=await readFile(new URL('../src/model/surface-scans/virgin_oak_click'+suffix,import.meta.url));
    return 'data:image/webp;base64,'+bytes.toString('base64');
  }));
  assert(html.includes('"virginOakVinyl": ["'+images.join('", "')+'"]'),'Standalone viewer embeds the current vinyl and its registered relief');
});

test('the two /193 paved surfaces share metric granite fans and adjacent parcels retain their finishes',async()=>{
  const source=await readFile(new URL('../src/model/surface-realism.js',import.meta.url),'utf8');
  const {applyRealisticSurfaces}=await load(source);
  const plot=site.variants.find(item=>item.id==='aktualny'),scene=new THREE.Scene();
  const surface=(ring,name,parcel)=>{
    const shape=new THREE.Shape(ring.map(([x,y])=>new THREE.Vector2(x,y)));
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial());
    mesh.name='surface-'+name;mesh.userData.parcel=parcel;scene.add(mesh);return mesh;
  };
  const driveway=surface(plot.driveway.coordinates[0],'driveway','193');
  const entry=surface(plot.entry.coordinates[0],'entry','193');
  const others=neighbors.surfaces.filter(p=>p.kind==='driveway'||p.kind==='entryPaving')
    .map(p=>surface(p.geometry.coordinates[0],p.kind,p.parcel));
  const angle=site.rotation*Math.PI/180;
  await applyRealisticSurfaces({THREE,scene,mats:{},renderer:{capabilities:{getMaxAnisotropy:()=>8}},siteRotation:angle});
  assert.equal(driveway.material.name,'graniteFan');
  assert.equal(entry.material.map,driveway.material.map);
  for(const other of others)assert.equal(other.material.name,'pavers');
  const radius=.832,repeat=[2*Math.sqrt(3)*radius,2*radius];
  for(const mesh of [entry,driveway]){
    const {uv,position}=mesh.geometry.attributes;
    for(let i=0;i<uv.count;i++){
      const x=position.getX(i),y=position.getY(i);
      assert(Math.abs(uv.getX(i)*repeat[0]-x*Math.cos(angle)-y*Math.sin(angle))<.00001);
      assert(Math.abs(uv.getY(i)*repeat[1]+x*Math.sin(angle)-y*Math.cos(angle))<.00001);
    }
  }
  const image=entry.material.bumpMap.image;
  const relief=(x,y)=>{
    const pixel=(n,span,limit)=>Math.floor(((n/span%1+1)%1)*limit);
    return image.data[(pixel(y,repeat[1],image.height)*image.width+pixel(x,repeat[0],image.width))*4];
  };
  for(const [cx,cy] of [[0,0],[radius*Math.sqrt(3)/2,radius/2]]){
    for(let ring=2;ring<=7;ring++){
      let seam=0,face=0;
      for(let i=0;i<31;i++){
        const a=(i/30-.5)*.58;
        seam+=relief(cx+Math.sin(a)*ring*.104,cy+Math.cos(a)*ring*.104);
        face+=relief(cx+Math.sin(a)*(ring+.5)*.104,cy+Math.cos(a)*(ring+.5)*.104);
      }
      assert(seam/31<110 && face/31>141,'Split-face stones have recessed concentric joints');
    }
  }
});

test('granite curbs follow only the garden edges, with clear gates, thresholds and transition',async()=>{
  const {createIconGraniteCurbs}=await load(await readFile(new URL('../src/model/granite-curbs.js',import.meta.url),'utf8'));
  const {iconPlanPoint}=await load(await readFile(new URL('../src/model/roof-windows.js',import.meta.url),'utf8'));
  const plot=site.variants.find(item=>item.id==='aktualny');
  const curb=createIconGraniteCurbs(THREE,plot,garden.lines.find(l=>l.kind==='drive_gate'));
  const hitAt=(x,y)=>{
    const ray=new THREE.Raycaster(new THREE.Vector3(...iconPlanPoint(house.metadata,x,y,1)),new THREE.Vector3(0,0,-1));
    return ray.intersectObject(curb)[0];
  };
  for(const [x,y,z] of [[.66,-2.711,.080],[6.46,-3.811,.080],[7.314,-1.15,.080],[8.45,-.411,.080],[8.45,2.711,.080+.035*2.711/4.21]]){
    const hit=hitAt(x,y);
    assert(hit && Math.abs(hit.point.z-z)<.0001,'Granite edging at '+[x,y]);
  }
  for(let x=.614;x<6.51;x+=.038)assert(!hitAt(x,-4.999) && !hitAt(x,-4.875),'Full sliding gate opening');
  for(let x=.72;x<6.9;x+=.08)assert(!hitAt(x,-.005),'Garage facade and threshold');
  for(let x=6.91;x<8.39;x+=.08){
    assert(!hitAt(x,.001) && !hitAt(x,-.001),'Driveway-to-entry join');
    assert(!hitAt(x,4.205),'Front door');
  }
  for(let y=.05;y<4.2;y+=.09)assert(!hitAt(6.91,y),'Wall along entry');
  assert(!hitAt(.58,-2) && !hitAt(6.52,-2) && !hitAt(8.52,2.5),'Edgings stay inside the paved outlines');
  assert(curb.userData.blocks>=30 && curb.userData.blocks<=35);
});

test('standalone scene installs the Icon granite paving and edging',async()=>{
  const curbSource=await readFile(new URL('../src/model/granite-curbs.js',import.meta.url),'utf8');
  assert(html.includes(curbSource.replaceAll('export function','function').trim()));
  assert.match(html,/region\(plot\.entry,[^;]*'entry','193'\)/);
  assert.match(html,/region\(plot\.driveway,[^;]*'driveway','193'\)/);
  assert.match(html,/scene\.add\(createIconGraniteCurbs\(THREE,plot,/);
});

test('entry pavers meet the driveway at grade across the entire joint and rise continuously to the front door',async()=>{
  const {gradeIconEntry193}=await load(await readFile(new URL('../src/model/granite-curbs.js',import.meta.url),'utf8'));
  const {iconPlanPoint}=await load(await readFile(new URL('../src/model/roof-windows.js',import.meta.url),'utf8'));
  const plot=site.variants.find(item=>item.id==='aktualny');
  const paving=(kind,z)=>{
    const ring=plot[kind].coordinates[0], shape=new THREE.Shape(ring.map(p=>new THREE.Vector2(...p)));
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    mesh.position.z=z;
    if(kind==='entry')gradeIconEntry193(mesh,ring);
    mesh.updateMatrixWorld();return mesh;
  };
  const entry=paving('entry',.08),drive=paving('driveway',.045);
  for(const x of [6.901,7.2,7.7,8.15,8.499])for(const y of [-.001,.001,.4,1.6,3.7,4.209]){
    const origin=new THREE.Vector3(...iconPlanPoint(house.metadata,x,y,1));
    const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1)).intersectObjects([drive,entry]);
    const expected=.045+.035*Math.max(0,y)/4.21;
    assert(hits.length>0 && Math.abs(hits[0].point.z-expected)<.000001,`Missing paved grade at ${x},${y}`);
  }
  // A near-horizontal ray from either side of the old 35 mm open riser strikes the continuous surface.
  for(const [from,to] of [[-.12,.12],[.12,-.12]]){
    const origin=new THREE.Vector3(...iconPlanPoint(house.metadata,7.75,from,.065));
    const end=new THREE.Vector3(...iconPlanPoint(house.metadata,7.75,to,.030));
    const hits=new THREE.Raycaster(origin,end.clone().sub(origin).normalize(),0,end.distanceTo(origin)).intersectObjects([drive,entry]);
    assert(hits.length,'No view through the raised edge');
  }
});
