import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const load=source=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html=await readFile(new URL('../trzy-domy-3d/index.html',import.meta.url),'utf8');
const imports=JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE=await load(Buffer.from(imports.three.split(',')[1],'base64').toString('utf8').replaceAll("'three/core'",`'${imports['three/core']}'`));
const moduleSource=await readFile(new URL('../src/model/roof-windows.js',import.meta.url),'utf8');
const {roofWindowOpenings,cutRoofGeometry,clipRoofSeam,createRoofWindowGlazing,livingRoofWindow}=await load(moduleSource);
const marker='const [source,garden,house,neighbors]=';
const start=html.indexOf(marker)+marker.length;
const [source,,house,neighbors]=JSON.parse(html.slice(start,html.indexOf(';\nconst landscaping=',start)));
const openings=roofWindowOpenings(house,neighbors,source);
const models=[{...house,parcel:'193'},...neighbors.houses];
const roofs=model=>model.meshes.filter(m=>m.kind==='roof');
function geometry(part){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.vertices.flat(),3));g.setIndex(part.faces.flatMap(f=>f.slice(1,-1).flatMap((_,i)=>[f[0],f[i+1],f[i+2]])));return g;}
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const meshes=(model,cut)=>roofs(model).map(p=>new THREE.Mesh(cut?cutRoofGeometry(THREE,geometry(p),openings.filter(o=>o.parcel===model.parcel)):geometry(p),material));
function hits(objects,p,d=[0,0,-1],far=30){const ray=new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d).normalize(),0,far);return ray.intersectObjects(objects,false);}
const interpolate=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
function sample(opening,u,v){const p=opening.vertices;return interpolate(interpolate(p[0],p[1],u),interpolate(p[3],p[2],u),v);}

test('source regression reproduces opaque roof blockers behind every original rooflight',()=>{
  for(const model of models)for(const opening of openings.filter(o=>o.parcel===model.parcel&&o.id!==livingRoofWindow.id)){
    const p=opening.center;assert(hits(meshes(model,false),[p[0],p[1],p[2]+3]).length,`source overlay was unexpectedly open: /${model.parcel} ${opening.id}`);
  }
});

test('all fourteen roof windows are real openings, with transparent non-shadow-casting glazing',()=>{
  assert.equal(openings.length,14);assert.equal(openings.filter(o=>o.parcel==='193').length,8);
  assert.equal(openings.filter(o=>o.parcel==='191').length,6);assert.equal(openings.filter(o=>o.parcel==='190').length,0);
  for(const model of models){const cut=meshes(model,true),original=meshes(model,false);
    for(const opening of openings.filter(o=>o.parcel===model.parcel)){
      for(const u of [.1,.3,.5,.7,.9])for(const v of [.1,.3,.5,.7,.9]){
        const p=sample(opening,u,v);assert(hits(original,[p[0],p[1],p[2]+2]).length,`${opening.id} extends outside original roof`);assert.equal(hits(cut,[p[0],p[1],p[2]+2]).length,0,`${opening.id} blocked at ${u},${v}`);
      }
      const glass=createRoofWindowGlazing(THREE,opening);assert.equal(glass.castShadow,false);assert(glass.material.transparent);assert(glass.material.opacity<.3);assert.equal(glass.material.depthWrite,false);
    }
  }
});

test('roof remains solid outside openings over a dense XY ray grid',()=>{
  for(const model of models){const original=meshes(model,false),cut=meshes(model,true),own=openings.filter(o=>o.parcel===model.parcel);let solid=0;
    const vertices=roofs(model).flatMap(m=>m.vertices);if(!vertices.length)continue;
    for(let x=Math.min(...vertices.map(p=>p[0]))+.113;x<Math.max(...vertices.map(p=>p[0]));x+=.213)for(let y=Math.min(...vertices.map(p=>p[1]))+.097;y<Math.max(...vertices.map(p=>p[1]));y+=.217){
      const p=[x,y,12],before=hits(original,p).length>0,after=hits(cut,p).length>0;
      const inOpening=own.some(o=>o.ring.every((a,i)=>{const b=o.ring[(i+1)%4];return (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0])>1e-5;}));
      assert.equal(after,before&&!inOpening,`/${model.parcel} unexpected roof change at ${x},${y}`);if(after)solid++;
    }
    assert(solid>100);
  }
});

test('lining cuts work through transformed local geometry and transmit oblique sun rays',()=>{
  const model=models[0],own=openings.filter(o=>o.parcel==='193');
  const matrix=new THREE.Matrix4().makeRotationZ(.78);matrix.setPosition(12,-6,0);const inverse=matrix.clone().invert();
  const lining=roofs(model).map(part=>{const local=geometry(part);local.applyMatrix4(new THREE.Matrix4().makeTranslation(0,0,-.045));local.applyMatrix4(inverse);const m=new THREE.Mesh(cutRoofGeometry(THREE,local,own,matrix),material);m.applyMatrix4(matrix);m.updateMatrixWorld();return m;});
  for(const opening of own){const p=opening.center;assert.equal(hits(lining,[p[0],p[1],p[2]+1],[0,0,-1],3).length,0,opening.id);
    const origin=[p[0]-.25,p[1]-.2,p[2]+1];assert.equal(hits(lining,origin,[.25,.2,-1],2).length,0,`${opening.id} oblique lining ray`);
  }
});

test('actual Icon interior lining callback opens every window through both real roof layers',async()=>{
  const {addIconInterior}=await load(await readFile(new URL('../src/model/interior.js',import.meta.url),'utf8'));
  const data=JSON.parse(await readFile(new URL('../trzy-domy-3d/interior-data.json',import.meta.url),'utf8'));
  const own=openings.filter(o=>o.parcel==='193');let calls=0;
  const original=addIconInterior({THREE,scene:new THREE.Scene(),house,data});
  const cut=addIconInterior({THREE,scene:new THREE.Scene(),house,data,cutRoof:(geometry,matrix)=>{
    calls++;return cutRoofGeometry(THREE,geometry,own,matrix);
  }});
  original.group.updateMatrixWorld(true);cut.group.updateMatrixWorld(true);
  const linings=interior=>interior.group.children.filter(m=>m.name.startsWith('interior-roof-lining-'));
  assert.equal(calls,roofs(models[0]).length);assert.equal(linings(cut).length,calls);
  const combined=[...meshes(models[0],true),...linings(cut)];
  for(const opening of own){const p=opening.center;
    assert(hits(linings(original),[p[0],p[1],p[2]+1],[0,0,-1],2).length,`${opening.id}: original actual lining did not block`);
    for(const [offset,direction] of [[[0,0,1],[0,0,-1]],[[-.25,-.2,1],[.25,.2,-1]],[[.25,.2,1],[-.25,-.2,-1]]]){
      const origin=p.map((v,i)=>v+offset[i]);
      assert.equal(hits(combined,origin,direction,2).length,0,`${opening.id}: actual roof or lining blocks sun`);
    }
  }
  assert(html.includes('cutRoof:(geometry,matrix)=>cutRoofGeometry(THREE,geometry,roofOpenings.filter(o=>o.parcel==="193"),matrix)'),
    'generated model must pass the real lining cut callback');
});

test('new 1.14 by 1.40 m window sits on livingroom west-facing slope and seams avoid all apertures',()=>{
  const o=openings.find(o=>o.id===livingRoofWindow.id);assert.deepEqual(o.localCenter,[6.25,14.4]);assert(o.localCenter[0]>4.25&&o.localCenter[0]<8.5);assert(o.localCenter[1]>10.3&&o.localCenter[1]<18.13);
  assert(o.outwardHorizontal[0]<-.6);const trueNorthAngle=.3584748670196551*Math.PI/180;
  const west=[-Math.cos(trueNorthAngle),-Math.sin(trueNorthAngle)];assert(o.outwardHorizontal[0]*west[0]+o.outwardHorizontal[1]*west[1]>.6);
  const length=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));assert(Math.abs(length(o.vertices[0],o.vertices[1])-1.4)<1e-9);assert(Math.abs(length(o.vertices[1],o.vertices[2])-1.14)<1e-9);
  for(const model of models)for(const seam of (model.lines||[]).filter(l=>l.kind==='roof-seam'))for(const segment of clipRoofSeam(seam.points,openings.filter(w=>w.parcel===model.parcel))){
    const p=interpolate(...segment,.5);assert(!openings.filter(w=>w.parcel===model.parcel).some(w=>w.ring.every((a,i)=>{const b=w.ring[(i+1)%4];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>1e-6;})),'seam crosses aperture');
  }
});

test('generated standalone model embeds the exact roof-window implementation',()=>{
  assert(html.includes(moduleSource.replaceAll('export ','')));
});


test('all roof-window positions and dimensions match the frozen registry',async()=>{
 const registry=JSON.parse(await readFile(new URL('../trzy-domy-3d/model-dimensions.json',import.meta.url),'utf8'));
 assert.deepEqual(registry.roofWindows.openings,openings);
});
