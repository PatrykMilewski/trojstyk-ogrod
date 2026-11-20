import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=name=>readFile(new URL(name,import.meta.url),'utf8');
const load=src=>import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const html=await read('../trzy-domy-3d/index.html');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'","'"+imports['three/core']+"'"));
const marker='const [source,garden,house,neighbors]=';
const [source,garden,house,neighbors]=JSON.parse(html.slice(html.indexOf(marker)+marker.length,html.indexOf(';\nconst landscaping=')));
const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const wood=JSON.parse(await read('../trzy-domy-3d/woodland-plan.json')).parcels.find(p=>p.id==='193');
const {createRainServices}=await load(await read('../src/model/rain-services.js'));
const {matrix:[[a,b],[c,d]],translation:[x,y]}=house.metadata;
const group=new THREE.Group();
group.matrix.set(-a,b,0,a*14.64+x,-c,d,0,c*14.64+y,0,0,1,0,0,0,0,1);
const rain=createRainServices(THREE,house,{group},data);
rain.updateMatrixWorld(true);
const named=prefix=>rain.children.filter(m=>m.name.startsWith('rain-'+prefix));
const close=(a,b,tol=1e-6)=>Math.abs(a-b)<tol;

test('catchment uses the projected roof triangles and covers a 30 mm event with the tank empty or full',()=>{
  let actual=0;
  for(const roof of house.meshes.filter(o=>o.kind==='roof'))for(const face of roof.faces){
    const [a,b,c]=face.map(i=>roof.vertices[i]);
    actual+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
  }
  const info=rain.userData;
  assert(close(info.projectedRoofM2,actual));
  assert(close(info.stormVolumeM3,actual*.03*.9));
  assert(info.tankUsableM3>=info.stormVolumeM3);
  assert(info.fieldNetM3>=info.stormVolumeM3);
  assert.equal(named('crate-').filter(m=>m.name!=='rain-crate-rib').length,15);
  assert.equal(named('downpipe-').length,4);
});

test('every eaves edge drains to a concealed gutter and every downpipe enters a buried branch',()=>{
  const gutters=named('gutter-').map(m=>{
    m.geometry.computeBoundingBox();return m.geometry.boundingBox.clone().translate(m.position).expandByScalar(.095);
  });
  const inverse=rain.matrixWorld.clone().invert();
  for(const roof of house.meshes.filter(o=>o.kind==='roof'))for(const face of roof.faces){
    const low=face.map(i=>roof.vertices[i]).filter(p=>close(p[2],house.metadata.dimensions.eave));
    if(low.length!==2)continue;
    const [a,b]=low.map(v=>new THREE.Vector3(...v).applyMatrix4(inverse));
    for(let i=0;i<=32;i++)assert(gutters.some(box=>box.containsPoint(a.clone().lerp(b,i/32))),roof.id);
  }
  for(const mesh of named('downpipe-')){
    const foot=mesh.position.clone();foot.z-=mesh.geometry.parameters.depth/2;
    const hasBranch=named('ground-').some(branch=>{
      const end=new THREE.Vector3(0,-branch.geometry.parameters.height/2,0).applyQuaternion(branch.quaternion).add(branch.position);
      return end.distanceTo(foot)<1e-6;
    });
    assert(hasBranch,mesh.name);
  }
  assert.equal(named('valley-').length,2);
});

function contains(ring,x,y){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}

test('rain tank and crates occupy private lawn clear of paths, paving, fire pit and tree beds',()=>{
  const outline=neighbors.parcels['193'].coordinates[0];
  const lot=source.variants[0];
  const obstacles=[lot.house,lot.terrace,lot.driveway,lot.entry].map(item=>({ring:item.coordinates[0]}));
  obstacles.push(...wood.beds,...garden.polygons.filter(p=>p.kind!=='lawn'));
  for(const mesh of [...named('tank-shell'),...named('crate-').filter(m=>m.name!=='rain-crate-rib')]){
    const {width,height}=mesh.geometry.parameters;
    for(const u of [-.5,0,.5])for(const v of [-.5,0,.5]){
      const p=new THREE.Vector3(u*width,v*height,0).applyMatrix4(mesh.matrixWorld);
      assert(contains(outline,p.x,p.y));
      for(const item of obstacles)assert(!contains(item.ring,p.x,p.y)||item.holes?.some(h=>contains(h,p.x,p.y)),item.id||'woody bed');
      for(const t of [...wood.trees,...garden.trees])assert(Math.hypot(t.center[0]-p.x,t.center[1]-p.y)>t.crownRadius);
    }
  }
});
