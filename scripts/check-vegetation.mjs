import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../trzy-domy-3d/index.html', import.meta.url),'utf8');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const code = Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'", `'${imports['three/core']}'`);
const THREE = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const treeSource=fs.readFileSync(new URL('../src/model/tree-realism.js',import.meta.url),'utf8');
const source=treeSource+'\n'+fs.readFileSync(new URL('../src/model/vegetation.js',import.meta.url),'utf8');
const {addSurroundingVegetation}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data=JSON.parse(fs.readFileSync(new URL('../trzy-domy-3d/vegetation-data.json',import.meta.url)));
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
const scene=new THREE.Scene();
const vegetation=addSurroundingVegetation({THREE,scene,data});
assert.equal(vegetation.trees.children.length,2);
assert.equal(vegetation.meta.treeCount,5);
assert(vegetation.meta.grainClumps>25000 && vegetation.meta.grainClumps<45000);
const crowns=vegetation.trees.children[1], matrix=new THREE.Matrix4();
const pos=crowns.geometry.getAttribute('position');
const heights=[];
const perTree=crowns.count/data.trees.length;
assert(Number.isInteger(perTree));
assert(crowns.material.alphaTest>0 && crowns.material.map);
for(let tree=0;tree<data.trees.length;tree++) {
  let top=-Infinity, radius=0;
  for(let crown=0;crown<perTree;crown++) {
    crowns.getMatrixAt(tree*perTree+crown,matrix);
    for(let i=0;i<pos.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);
      top=Math.max(top,p.z);
      radius=Math.max(radius,Math.hypot(p.x-data.trees[tree].center[0],p.y-data.trees[tree].center[1]));
    }
  }
  assert(Math.abs(top-data.trees[tree].height)<0.00001);
  assert(Math.abs(radius-data.trees[tree].crownRadius)<.00001);
  heights.push(top);
}
for(const mesh of vegetation.crops.children) assert.equal(mesh.castShadow,false);
for(const mesh of vegetation.trees.children) assert.equal(mesh.castShadow,true);
vegetation.setCropsVisible(false); assert.equal(vegetation.crops.visible,false);
vegetation.setCropsVisible(true); assert.equal(vegetation.crops.visible,true);
const result={...vegetation.meta,actualGeometryTopsM:heights,cropDrawCalls:vegetation.crops.children.length,treeDrawCalls:2};
console.log(result);
