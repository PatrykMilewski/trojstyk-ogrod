import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = f => readFile(new URL(f,import.meta.url),'utf8');
const load = code => import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const html = await read('../trzy-domy-3d/index.html');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1],'base64').toString().replaceAll("'three/core'","'"+imports['three/core']+"'"));
const {createInteriorLightBudget} = await load(await read('../src/model/interior-light-budget.js'));

test('orbit zoom and walking use nearby lamps across transformed buildings and restore their intensity',()=>{
 const site=new THREE.Group(), groups=[];
 for(const x of [4,54]){
  const g=new THREE.Group();site.add(g);g.position.x=x;g.scale.x=-1;groups.push(g);
  for(const dx of [0,2,4,7,9,12]){
   const lamp=new THREE.PointLight(0xffffff,12,5);g.add(lamp);lamp.position.set(dx,0,2);
  }
 }
 const update=createInteriorLightBudget(THREE,groups),target=new THREE.Vector3(4,0,2);
 const cam=new THREE.OrthographicCamera(-40,40,40,-40);update(cam,target);
 assert(groups.every(g=>g.children.every(l=>!l.visible)));
 cam.zoom=5;update(cam,target);assert.equal(groups[0].children[0].intensity,12);
 const walk=new THREE.PerspectiveCamera();walk.position.set(54,0,2);update(walk,target);
 assert(groups[0].children.every(l=>!l.visible));assert.equal(groups[1].children[0].intensity,12);
 assert.equal(groups[1].children.filter(l=>l.visible).length,4);
 walk.position.x=400;update(walk,target);assert(groups.every(g=>g.children.every(l=>!l.visible)));
});
