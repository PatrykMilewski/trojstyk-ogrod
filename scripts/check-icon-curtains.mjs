import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read=file=>readFile(new URL(file,import.meta.url),'utf8');
const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const html=await read('../trzy-domy-3d/index.html');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'","'"+imports['three/core']+"'"));
const marker='const [source,garden,house,neighbors]=';
const [, , house]=JSON.parse(html.slice(html.indexOf(marker)+marker.length,html.indexOf(';\nconst landscaping=')));
const data=JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const {addIconInterior}=await load(await read('../src/model/interior.js'));
const {group,navigation}=addIconInterior({THREE,scene:new THREE.Scene(),data,house});
function geometry(name){
 const part=group.getObjectByName(name);
 assert(part,name);
 return part.geometry;
}
function bounds(name) {
 const part=group.getObjectByName(name),g=geometry(name);
 part.updateWorldMatrix(true,false);g.computeBoundingBox();
 return g.boundingBox.clone().applyMatrix4(group.matrixWorld.clone().invert().multiply(part.matrixWorld));
}
const rooms=[
 ['living','facade-garden-glass-0-pane-0','facade-garden-glass-0-pane-2',0,-1],
 ['playroom','facade-front-wing-glass-2','facade-front-wing-glass-2',0,1],
 ['study','facade-wing-end-glass-1','office-window-frame-latch',1,-1],
 ['bedroom-one','front-gable-glass-0','front-gable-glass-0',0,1],
 ['master','wing-gable-glass-0','wing-gable-glass-0',1,-1]
];

test('open linen panels gather beside the jambs, inside the glass and clear of the furniture',()=>{
 for(const [name,first,last,axis,inward] of rooms){
  const a=bounds(first),b=bounds(last),min=a.min.getComponent(axis),max=(name==='study'?b.min:b.max).getComponent(axis);
  const prefix='curtain-'+name,panels=['left','right'].map(side=>bounds(prefix+'-'+side));
  const clear=Math.min(max,panels[1].min.getComponent(axis))-Math.max(min,panels[0].max.getComponent(axis));
  assert(clear/(max-min)>=.78,name+' clear glass span '+clear/(max-min));
  for(const [i,panel] of panels.entries()){
   assert(panel.min.z>a.min.z+.015 && panel.min.z<a.min.z+.055,name+' hem above sill');
   const edge=i===0?panel.min:panel.max;
   assert(Math.abs(edge.getComponent(axis)-(i===0?min:max))<.24,name+' outer edge near jamb');
   const depth=1-axis,plane=a.min.getComponent(depth);
   for(const side of [panel.min,panel.max])assert((side.getComponent(depth)-plane)*inward>.075,name+' on interior side');
   assert(panel.max.getComponent(depth)-panel.min.getComponent(depth)>.073,name+' genuine folds');
   const mesh=group.getObjectByName(prefix+(i===0?'-left':'-right'));
   assert.equal(mesh.material.transparent,false);
   assert(mesh.geometry.getAttribute('normal').count>100);
   assert(mesh.geometry.index.count/3<1000,name+' fixed geometry budget');
   for(const item of data.furniture){
    const floor=item.room.startsWith('1.')?data.levels.upper:data.levels.ground;
    if(Math.abs(floor-a.min.z)>.1)continue;
    const [x0,y0,x1,y1]=item.box;
    assert(panel.max.x<x0||panel.min.x>x1||panel.max.y<y0||panel.min.y>y1,name+' clips '+item.id);
   }
  }
 }
});

test('the kitchen linen stacks and direct-mounted track fit the reveal with an open central view',()=>{
 const glass=bounds('facade-main-side-glass-0'),mullion=bounds('facade-main-side-mullion-0');
 const wallFace=bounds('facade-main-side').max.x,floor=bounds('ground-floor').max.z;
 const island=data.furniture.find(f=>f.id==='kitchen-island');
 const rail=bounds('curtain-kitchen-track'),panels=['left','right'].map(side=>bounds('curtain-kitchen-'+side));
 assert(!group.children.some(m=>m.name.startsWith('blind-kitchen-')));
 assert(navigation.obstacles.some(o=>o.id==='facade-main-side-glass-barrier-0'));
 for(const part of [rail,...panels]){
  assert(part.min.x>mullion.max.x+.01 && part.max.x<wallFace-.01,'entirely inside the reveal, in front of the mullion');
  assert(part.min.y>glass.min.y+.009 && part.max.y<glass.max.y-.009,'clear of both jambs');
  assert(part.min.z>floor+.018 && part.max.z<=glass.max.z+.00001,'above the floor and below the lintel');
  assert(island.box[0]-part.max.x>1.45,'island aisle');
 }
 assert(Math.abs(rail.max.z-glass.max.z)<.00001,'screwed directly to the lintel');
 assert(rail.max.x-rail.min.x<.035 && rail.max.z-rail.min.z<.025,'slim track');
 assert(rail.max.y-rail.min.y>glass.max.y-glass.min.y-.04,'track spans the opening');
 assert(panels[0].min.y-glass.min.y<.045 && glass.max.y-panels[1].max.y<.045,'gathered against opposite jambs');
 const clear=panels[1].min.y-panels[0].max.y;
 assert(clear/(glass.max.y-glass.min.y)>.86,'uncovered central span');
 for(const [i,panel] of panels.entries()){
  assert(Math.abs(panel.max.z-rail.min.z)<.00001 && panel.min.z<floor+.05,'floor-length panels hang from the track');
  assert(panel.max.x-panel.min.x>.10,'folds have visible depth');
  const side=i===0?'left':'right',mesh=group.getObjectByName('curtain-kitchen-'+side);
  assert(mesh.material.map && mesh.material.roughness>.9 && mesh.material.side===THREE.DoubleSide,'matte woven fabric');
  assert.equal(mesh.geometry.attributes.uv.count,mesh.geometry.attributes.position.count,'fabric texture covers every vertex');
 }
 const door=group.getObjectByName('concealed-pantry-door');
 const {closedYaw,swing}=door.userData;
 for(let step=0;step<=18;step++){
  door.rotation.z=closedYaw+swing*Math.PI/2*step/18;
  door.updateMatrixWorld(true);
  for(const name of ['kitchen-pantry-closed-leaf','kitchen-pantry-leaf-pull']){
   const hardware=bounds(name);
   assert(panels.every(p=>hardware.min.x-p.max.x>.55),'pantry door and pull throughout swing');
  }
 }
 door.rotation.z=closedYaw;door.updateMatrixWorld(true);
});

test('garden curtain and its rail fit the recessed transom below the upper glass and clear the terrace door',()=>{
 const glass=bounds('garden-gable-glass-0'),transom=group.getObjectByName('garden-window-transom');
 transom.updateMatrix();
 const front=bounds(transom.name).min.y;
 const door=data.facades.find(f=>f.id==='facade-terrace').openings.find(o=>!o.glass);
 const doorEnd=data.facades.find(f=>f.id==='facade-terrace').a[1]+door.end;
 const rail=bounds('curtain-living-track');
 assert(Math.abs(rail.max.y-front)<.001,'brackets touch interior face of transom');
 for(const part of ['track','left','right']){
  const b=bounds('curtain-living-'+part);
  assert(b.max.z<glass.min.z-.5 && b.max.z<=2.45);
  assert(b.min.y>doorEnd && b.max.y<glass.min.y);
 }
 assert(rail.min.x>.99 && rail.max.x<7.51,'track stays inside lower frame');
});

test('bedroom tracks follow the asymmetrical gables and both dressings remain below the roof',()=>{
 const slope=(data.levels.ridge-data.levels.eave)/4.25;
 for(const [room,pane,,axis] of rooms.slice(-2)){
  const glass=geometry(pane).getAttribute('position'),head=new Map();
  for(let i=0;i<glass.count;i++){
   const u=glass.getComponent(i,axis);
   head.set(u,Math.max(head.get(u)??-Infinity,glass.getZ(i)));
  }
  const [[u0,z0],[u1,z1]]=[...head].sort(([a],[b])=>a-b);
  const expected=u=>z0+(z1-z0)*(u-u0)/(u1-u0);
  for(const side of ['track','left','right']){
   const pos=geometry('curtain-'+room+'-'+side).getAttribute('position');
   let caps=0;
   for(let i=0;i<pos.count;i++){
    const u=pos.getComponent(i,axis),z=pos.getZ(i);
    const roof=data.levels.ridge-slope*Math.abs(u-(axis===0?4.25:8.46))-.045;
    assert(z<roof-.02,room+' fits below the slope');
    const above=z-expected(u);
    assert(above<.14,room+' fabric fits the frame');
    if(above>0)caps++;
   }
   assert(caps>=4,room+' follows sloping glass head');
  }
 }
});
