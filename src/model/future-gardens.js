import {addGardenTerraces} from './future-terraces.js';
import {woodyRandom} from './tree-realism.js';

function gardenFoliageAtlas(THREE) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'), random=woodyRandom(91352);
  function stroke(x,y,ex,ey,color,width) {
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function spray(x,y,width,height,conifer) {
    const lean=(random()-.5)*width*.39;
    const pale=()=>Math.round(168+random()*84);
    stroke(x,y,x+lean,y-height,conifer?'#b5b6a1':'#aca28a',width*.025);
    for (let j=1;j<=7;j++) for (const side of [-1,1]) {
      const t=j/8, reach=side*width*.47*(1-.64*t)*(.86+.24*random());
      const startX=x+lean*t, startY=y-height*t;
      const rise=height*(.09+.09*random()), endX=startX+reach, endY=startY-rise;
      stroke(startX,startY,endX,endY,'#b0af9a',width*.015);
      for (let n=1;n<=5;n++) {
        const f=n/5, px=startX+reach*f, py=startY-rise*f, tone=pale();
        const tilt=Math.atan2(-rise,reach)+(n%2===0?1:-1)*.57;
        ctx.fillStyle='rgb('+tone+','+tone+','+Math.round(tone*.94)+')';
        ctx.beginPath();
        ctx.ellipse(px,py,width*(conifer?.090:.117),width*(conifer?.025:.059),tilt,0,2*Math.PI);
        ctx.fill();
      }
    }
  }
  spray(124,253,209,226,false);
  spray(83,182,122,139,false);
  spray(165,154,115,127,false);
  ctx.fillStyle='#a6ae9e';ctx.fillRect(256,0,256,256);
  ctx.save();ctx.beginPath();ctx.rect(256,0,256,256);ctx.clip();
  for (let row=-1;row<=6;row++) for (let col=-1;col<=6;col++) {
    const x=256+col*46+(row%2)*20+(random()-.5)*13;
    spray(x,row*48+18,60,78,true);
  }
  ctx.restore();
  spray(128,509,213,241,true);
  ctx.fillStyle='#ffffff';ctx.fillRect(256,256,256,256);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

const gardenSolidUV=[.76,.22], gardenLeafUV=[.004,.504,.496,.996], gardenThujaUV=[.504,.504,.996,.996];
const gardenNeedleUV=[.004,.004,.496,.496];

function gardenSpecimen(THREE) {
  const points=[],colors=[],uv=[],indices=[],c=new THREE.Color();
  function face(verts,tone,texture) {
    const start=points.length/3;
    c.set(tone);
    verts.forEach((p,i)=>{
      points.push(...p);colors.push(c.r,c.g,c.b);
      uv.push(...(texture?texture[i]:gardenSolidUV));
    });
    for (let i=1;i<verts.length-1;i++) indices.push(start,start+i,start+i+1);
  }
  function card(origin,yaw,pitch,width,length,tone,cell) {
    const c=Math.cos(yaw),s=Math.sin(yaw),reach=length*Math.cos(pitch);
    const dx=-s*width/2,dy=c*width/2;
    const [x,y,z]=origin, top=[x+c*reach,y+s*reach,z+length*Math.sin(pitch)];
    const [u,v,U,V]=cell;
    face([[x-dx,y-dy,z],[x+dx,y+dy,z],[top[0]+dx,top[1]+dy,top[2]],[top[0]-dx,top[1]-dy,top[2]]],
      tone,[[u,v],[U,v],[U,V],[u,V]]);
  }
  function stem(a,b,w,tone) {
    const dir=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
    const axis=new THREE.Vector3(1,0,0);
    if (Math.abs(dir.x)>.90) axis.set(0,1,0);
    const u=dir.clone().cross(axis).normalize(),v=dir.clone().cross(u);
    const ring=(o,r)=>Array.from({length:6},(_,i)=>new THREE.Vector3(...o)
      .addScaledVector(u,r*Math.cos(i*Math.PI/3)).addScaledVector(v,r*Math.sin(i*Math.PI/3)).toArray());
    const lower=ring(a,w),upper=ring(b,w*.65);
    for(let i=0;i<6;i++) {const j=(i+1)%6;face([lower[i],lower[j],upper[j],upper[i]],tone);}
  }
  function finish() {
    const geometry=new THREE.BufferGeometry();
    let radius=0,height=0;
    for (let i=0;i<points.length;i+=3) {
      radius=Math.max(radius,Math.hypot(points[i],points[i+1]));
      height=Math.max(height,points[i+2]);
    }
    for (let i=0;i<points.length;i+=3) {
      points[i]/=radius;points[i+1]/=radius;points[i+2]=Math.max(0,points[i+2]/height);
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
    return geometry;
  }
  return {face,card,stem,finish};
}

const gardenTreeTraits={
  fruit:{fork:.26,reach:.73,crown:.53,bark:'#786957',leaf:['#729552','#88a663','#79964e']},
  canopy:{fork:.37,reach:.87,crown:.77,bark:'#68604f',leaf:['#597646','#74894e','#849957']},
  deciduous:{fork:.33,reach:.64,crown:.72,bark:'#736954',leaf:['#66884d','#729655','#849e60']},
  ornamental:{fork:.15,reach:.84,crown:.49,bark:'#766b61',leaf:['#936f81','#a58b8b','#8b7975']}
};

function gardenTree(THREE,kind) {
  const g=gardenSpecimen(THREE), t=gardenTreeTraits[kind], random=woodyRandom(Math.round(t.fork*1000));
  const polar=(a,r,z)=>[Math.cos(a)*r,Math.sin(a)*r,z];
  const fork=[.018,-.012,t.fork];
  g.stem([0,0,0],fork,.046,t.bark);
  for (let n=0;n<9;n++) {
    const a=n*2.39996+random()*.3, inner=n>5;
    const reach=t.reach*(inner?.34:.77)*(.84+.22*random());
    const z=t.fork+t.crown*(inner?.93:.59)+random()*.07;
    const elbow=polar(a-.17,reach*.46,t.fork+(z-t.fork)*.46);
    const tip=polar(a,reach,z);
    g.stem(fork,elbow,inner?.030:.024,t.bark);g.stem(elbow,tip,.018,t.bark);
    const lobeWidth=inner?.31:.42,lobeHeight=kind==='deciduous'?.23:.17;
    for (let j=0;j<39;j++) {
      const theta=j*2.39996+a, v=(j+.5)/39, span=Math.sqrt(1-(2*v-1)**2);
      const r=lobeWidth*span*(.27+.49*random()), origin=[tip[0]+r*Math.cos(theta),
        tip[1]+r*Math.sin(theta),tip[2]+lobeHeight*(2*v-1)];
      g.card(origin,theta+(random()-.5)*1.8,(random()-.41)*1.55,.21+random()*.17,
        .14+random()*.16,t.leaf[(n+j)%t.leaf.length],gardenLeafUV);
    }
  }
  return g.finish();
}

function gardenConifer(THREE) {
  const g=gardenSpecimen(THREE), random=woodyRandom(1974);
  g.stem([0,0,0],[0,0,.95],.035,'#745e49');
  for(let tier=0;tier<9;tier++) {
    const z=.23+tier*.085, reach=.90*(1-tier/10), branches=12-tier%3;
    for(let i=0;i<branches;i++) {
      const a=2*Math.PI*i/branches+tier*1.61, cs=Math.cos(a), sn=Math.sin(a);
      const r=reach*(.78+.22*random()), tip=[r*cs,r*sn,z-.048];
      g.stem([0,0,z],tip,.012,'#75644d');
      for(let j=1;j<=5;j++) {
        const f=j/6, origin=[tip[0]*f,tip[1]*f,z-.048*f];
        for(const side of [-1,1]) g.card(origin,a+side*.60,.2+random()*.24,
          .23*reach+.07,.32*reach+.10,['#516e59','#58765c','#728668'][j%3],gardenNeedleUV);
      }
    }
  }
  return g.finish();
}

function gardenThuja(THREE) {
  const g=gardenSpecimen(THREE), random=woodyRandom(3552), count=10;
  const sections=[[.015,.66],[.09,.92],[.23,1],[.47,.95],[.69,.81],[.84,.61],[.95,.24],[1,.025]];
  const rings=sections.map(([z,r],j)=>Array.from({length:count},(_,i)=>{
    const angle=2*Math.PI*i/count+.08*Math.sin(j+i),radius=r*(.91+.09*random());
    return [radius*Math.cos(angle)+.04*z,radius*Math.sin(angle),z];
  }));
  const [u,v,U,V]=gardenThujaUV;
  for (let j=1;j<rings.length;j++) for (let i=0;i<count;i++) {
    const k=(i+1)%count,p=rings[j-1],q=rings[j];
    g.face([p[i],p[k],q[k],q[i]],['#5e845b','#61865b','#66895d','#698b60'][i%4],[[u,v],[U,v],[U,V],[u,V]]);
  }
  for (let i=0;i<28;i++) {
    const fraction=(i+.5)/28, angle=i*2.39996, z=.08+.84*fraction;
    const radius=.95*(1-.46*fraction**1.8)*(.80+.09*random());
    g.card([radius*Math.cos(angle),radius*Math.sin(angle),z],angle+(random()-.5)*.9,
      .43+random()*.61,.31+.18*(1-fraction),.13+.12*random(),'#77936a',gardenNeedleUV);
  }
  const geometry=g.finish(), normals=geometry.attributes.normal;
  const v3=new THREE.Vector3();
  for (let j=1;j<rings.length;j++) for (let i=0;i<count;i++) {
    const start=((j-1)*count+i)*4,k=(i+1)%count;
    [[j-1,i],[j-1,k],[j,k],[j,i]].forEach(([row,slot],offset)=>{
      const [x,y]=rings[row][slot],lo=sections[Math.max(0,row-1)],hi=sections[Math.min(sections.length-1,row+1)];
      const r=Math.hypot(x,y), slope=(hi[1]-lo[1])/(hi[0]-lo[0]);
      v3.set(x/r,y/r,-slope).normalize();normals.setXYZ(start+offset,v3.x,v3.y,v3.z);
    });
  }
  return geometry;
}

function gardenPerennial(THREE,kind) {
  const g=gardenSpecimen(THREE), random=woodyRandom(31141);
  const fern=kind==='fern', lavender=kind==='lavender', count=fern?37:lavender?40:28;
  for(let i=0;i<count;i++) {
    const a=i*2.39996, r=Math.sqrt((i+.5)/count), x=Math.cos(a)*r, y=Math.sin(a)*r;
    const z=(fern?.37:.58)+.30*(1-r*r)+.1*random();
    if(fern) {
      g.card([x*.12,y*.12,.03],a,.78,.37,.60,'#5d8144',gardenLeafUV);
      g.card([x*.55,y*.55,z*.75],a,-.37,.31,.45,'#739456',gardenLeafUV);
    } else {
      g.stem([x*.13,y*.13,0],[x*.78,y*.78,z],lavender?.008:.019,'#77865d');
      g.card([x*.44,y*.44,z*.51],a,.30,lavender?.15:.57,.40,'#648351',gardenLeafUV);
      if(lavender) {
        for(let j=0;j<4;j++) g.card([x*.78,y*.78,z+j*.023],a+j,.87,.09,.075,'#a290c0',gardenLeafUV);
      } else {
        for(let j=0;j<8;j++) {
          const t=j*2.4, dx=.15*Math.cos(t),dy=.15*Math.sin(t);
          const cx=x*.78+dx*.55,cy=y*.78+dy*.55,h=z+.05*Math.sin(j);
          g.face([[cx-dx,cy-dy,h],[cx-.7*dy,cy+.7*dx,h+.05],[cx+dx,cy+dy,h+.02],
            [cx+.7*dy,cy-.7*dx,h-.014]],['#eee1ca','#c8cba7','#dbcbba'][j%3]);
        }
      }
    }
  }
  return g.finish();
}

function gardenBedPlant(THREE,kind) {
  const g=gardenSpecimen(THREE),random=woodyRandom(9461);
  if (kind==='shrub') {
    for (let i=0;i<63;i++) {
      const a=i*2.39996,r=Math.sqrt((i+.5)/63),z=.19+.48*(1-r*r);
      g.card([r*.62*Math.cos(a),r*.62*Math.sin(a),z],a,.13+random()*.95,.65,.35+random()*.35,
        ['#799364','#66895d','#8a9c71'][i%3],gardenLeafUV);
    }
  } else {
    const grass=kind==='grass',blades=grass?37:20;
    for (let i=0;i<blades;i++) {
      const a=i*2.39996,r=.22+.70*random(),h=(1-r*.62)*(.82+.22*random());
      const c=Math.cos(a),s=Math.sin(a),w=grass?.033:.092;
      const base=[c*.06,s*.06,0],l=[c*r*.5-s*w,s*r*.5+c*w,h*.73],mid=[c*r*.5,s*r*.5,h*.80];
      const right=[c*r*.5+s*w,s*r*.5-c*w,h*.73],tip=[c*r,s*r,h*(grass?.90:.64)];
      const tone=['#849354','#799150','#93a25d'][i%3];
      g.face([base,right,mid],tone);g.face([base,mid,l],tone);g.face([l,mid,tip],tone);g.face([mid,right,tip],tone);
    }
    for (let j=0;j<(grass?6:13);j++) {
      const a=j*2.39996,r=.50*Math.sqrt((j+.5)/13),x=Math.cos(a)*r,y=Math.sin(a)*r,h=.80+random()*.18;
      g.stem([x*.35,y*.35,.18],[x,y,h],grass?.010:.012,grass?'#a7986b':'#78905b');
      if (grass) {
        for(let k=0;k<5;k++) g.card([x,y,h+k*.022],k*2.4,.99,.075,.092,'#cdbb8a',gardenNeedleUV);
      } else {
        for(let k=0;k<6;k++) {
          const t=k*Math.PI/3,dx=Math.cos(t)*.14,dy=Math.sin(t)*.14;
          g.face([[x,y,h],[x+dx*.65-dy*.36,y+dy*.65+dx*.36,h+.016],[x+dx,y+dy,h+.039],
            [x+dx*.65+dy*.36,y+dy*.65-dx*.36,h+.014]],j%3?'#d9b2bc':'#e4d6c2');
        }
      }
    }
  }
  return g.finish();
}

function gardenGroundMesh(THREE,group,polygons,z,material,name) {
  const positions=[],uv=[],indices=[];
  for (const polygon of polygons) {
    const rings=polygon.map(ring=>ring.map(([x,y])=>new THREE.Vector2(Math.fround(x),Math.fround(y))));
    const faces=THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)), base=positions.length/3;
    for (const p of rings.flat()) {positions.push(p.x,p.y,z);uv.push(p.x/2,p.y/2);}
    for (const face of faces) indices.push(...face.map(i=>i+base));
  }
  if (!indices.length) return;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);
}

function gardenShrubRow(row,plants,random) {
  const {path,radius,height}=row;
  for (let i=1;i<path.length;i++) {
    const [ax,ay]=path[i-1],[bx,by]=path[i],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
    if (len<.01) continue;
    const count=Math.max(1,Math.ceil(len/(radius*1.15))),step=len/count;
    for (let j=0;j<count;j++) {
      const t=(j+.5)/count, sway=radius*.085*(random()-.5);
      plants.push({x:ax+dx*t-dy/len*sway,y:ay+dy*t+dx/len*sway,
        radius:Math.min(radius-Math.abs(sway),len/2),height:height*(.955+.045*random())});
    }
  }
}

function gardenMulch(THREE) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),random=woodyRandom(1664);
  ctx.fillStyle='#907c66';ctx.fillRect(0,0,128,128);
  for (let i=0;i<1350;i++) {
    const x=random()*128,y=random()*128,a=random()*Math.PI,len=1+random()*3;
    ctx.strokeStyle=['#806d58','#a38a6f','#766a59','#9c8975'][i%4];
    ctx.lineWidth=.6+random()*1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);ctx.stroke();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({map,color:'#d5c7b7',roughness:1});
}

function gardenPlantGeometry(THREE,kind) {
  if(gardenTreeTraits[kind]) return gardenTree(THREE,kind);
  if(kind==='conifer') return gardenConifer(THREE);
  if(kind==='thuja') return gardenThuja(THREE);
  if(['fern','lavender','hydrangea'].includes(kind)) return gardenPerennial(THREE,kind);
  return gardenBedPlant(THREE,kind);
}

function addGardenPlantTiles(THREE,group,kind,items,material,random) {
  const geometry=gardenPlantGeometry(THREE,kind), tiles=new Map();
  const dummy=new THREE.Object3D(), tint=new THREE.Color();
  for(const plant of items) {
    const key=Math.floor(plant.x/64)+','+Math.floor(plant.y/64);
    if(!tiles.has(key)) tiles.set(key,[]);
    tiles.get(key).push(plant);
  }
  for(const plants of tiles.values()) {
    const mesh=new THREE.InstancedMesh(geometry,material,plants.length);
    plants.forEach(({x,y,radius,height},i)=>{
      dummy.position.set(x,y,.032);dummy.rotation.z=random()*Math.PI*2;dummy.scale.set(radius,radius,height);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      tint.setScalar(.86+.14*random());mesh.setColorAt(i,tint);
    });
    mesh.name='garden-'+kind;mesh.castShadow=mesh.receiveShadow=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
  }
}

export function addFutureGardens(THREE,group,data,lawnMaterial) {
  const lawns=new THREE.Group(),plantings=new THREE.Group();
  lawns.name='Trawniki i rabaty';plantings.name='Nasadzenia ogrodowe';
  group.add(lawns,plantings);
  const plants={fruit:[],deciduous:[],ornamental:[],canopy:[],conifer:[],flower:[],shrub:[],grass:[],thuja:[],
    fern:[],lavender:[],hydrangea:[]};
  const beds=[],grass=[],random=woodyRandom(4013193);
  for (const lot of data.lots) {
    grass.push(...lot.lawn);
    for (const bed of lot.beds) {
      beds.push([bed.ring]);
      for(const p of bed.plants) plants[p.kind].push(p);
    }
    for (const tree of lot.trees) plants[tree.kind].push(tree);
    for (const row of lot.thuja) gardenShrubRow(row,plants.thuja,random);
  }
  gardenGroundMesh(THREE,lawns,grass,.014,lawnMaterial,'Trawniki projektowane');
  gardenGroundMesh(THREE,lawns,beds,.032,gardenMulch(THREE),'Rabaty ściółkowane');
  const paths=data.lots.flatMap(lot=>lot.gardenPaths??[]);
  for(const [finish,color] of [['gravel','#baaf99'],['pavers','#b3aca0']]) {
    const polygons=paths.filter(path=>path.finish===finish).map(path=>[path.ring]);
    gardenGroundMesh(THREE,group,polygons,.041,new THREE.MeshStandardMaterial({color,roughness:.98,side:THREE.DoubleSide}),'Ścieżki ogrodowe · '+finish);
  }
  const terraceObstacles=addGardenTerraces(THREE,group,data.lots);
  const material=new THREE.MeshStandardMaterial({map:gardenFoliageAtlas(THREE),vertexColors:true,alphaTest:.37,
    roughness:.95,side:THREE.DoubleSide});
  for (const [kind,items] of Object.entries(plants)) {
    if(items.length) addGardenPlantTiles(THREE,plantings,kind,items,material,random);
  }
  return {lawns,plantings,terraceObstacles};
}
