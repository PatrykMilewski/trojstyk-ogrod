// Wall coordinates are measured along a footprint edge, outwards from it and above local ground.
export function streetEdge([a, b]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
  return {length, angle, point(u, out = 0) {
    return [a[0] + (dx * u + dy * out) / length, a[1] + (dy * u - dx * out) / length];
  }};
}

const hedgeCrown = [[-.76,0],[-.96,.16],[-1,.51],[-.93,.80],[-.70,.95],
  [-.32,.99],[.22,1],[.65,.96],[.91,.84],[1,.57],[.97,.21],[.76,0]];

function streetLeafTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  let seed = 493783;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = '#36452c';
  ctx.fillRect(0,0,256,256);
  const palette = ['#4d6540','#587343','#68834c','#70894c','#819856','#92a563','#59733f'];
  for (let i=0;i<4700;i++) {
    const x=random()*256, y=random()*256, radius=2+3.1*random(), angle=random()*Math.PI;
    ctx.fillStyle = palette[Math.floor(random()*palette.length)];
    for (const dx of x<6 ? [0,256] : x>250 ? [0,-256] : [0]) {
      for (const dy of y<6 ? [0,256] : y>250 ? [0,-256] : [0]) {
        ctx.beginPath();
        ctx.ellipse(x+dx,y+dy,radius,radius*.46,angle,0,Math.PI*2);
        ctx.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function addStreetHedge(foliage, edge, height) {
  const [x,y] = edge.point(0), phase=x*.73+y*1.13;
  const steps=Math.max(4,Math.ceil(edge.length/.31)), count=hedgeCrown.length;
  const start=foliage.points.length/3;
  for (let i=0;i<=steps;i++) {
    const u=edge.length*i/steps, end=Math.max(0,Math.min(1,u/.5,(edge.length-u)/.5));
    const rounding=.15+.85*Math.sqrt(end*(2-end));
    const wave=Math.sin(u*1.39+phase)*.024+Math.sin(u*3.76-phase*.61)*.013;
    let arc=0;
    for (let j=0;j<count;j++) {
      const [side,level]=hedgeCrown[j], grain=Math.sin(phase+u*5.3+j*2.4);
      const width=Math.min(.4,.373+wave+grain*.009)*rounding;
      const [px,py]=edge.point(u,side*width);
      const z=level*height*(.83+.17*rounding+wave+grain*.013);
      if (j) arc+=Math.hypot(.38*(side-hedgeCrown[j-1][0]),height*(level-hedgeCrown[j-1][1]));
      foliage.points.push(px,py,z);
      foliage.uv.push(u/.79+phase*.13, arc/.79+.12*Math.sin(u*.60+phase));
      const shade=.57+.34*level+.055*Math.sin(phase*.2+u*.81)+grain*.025;
      foliage.colors.push(shade,shade,shade*.96);
      if (!i || !j) continue;
      const d=start+i*count+j, a=d-count-1;
      foliage.faces.push(a,a+1,d, a,d,d-1);
    }
  }
  for (let j=1;j<count-1;j++) {
    const last=start+steps*count;
    foliage.faces.push(start,start+j,start+j+1,last,last+j+1,last+j);
  }
}

function finishStreetHedges(THREE, group, foliage) {
  if (!foliage.faces.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(foliage.points,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(foliage.uv,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(foliage.colors,3));
  geometry.setIndex(foliage.faces);
  geometry.computeVertexNormals();
  const map=streetLeafTexture(THREE);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map, vertexColors:true,
    roughness:.95, side:THREE.DoubleSide, bumpMap:map, bumpScale:.014}));
  mesh.name='Otoczenie · zieleń';
  mesh.castShadow=mesh.receiveShadow=true;
  group.add(mesh);
}

export function streetBatch(THREE, group) {
  const batches = new Map(), transform = new THREE.Object3D(), paint = new THREE.Color();
  const foliage = {points: [], uv: [], colors: [], faces: []};
  return {
    hedge(edge, height) { addStreetHedge(foliage,edge,height); },
    box(edge, u, out, z, w, d, h, color, surface = 'paint') {
      const [x, y] = edge.point(u, out);
      transform.position.set(x, y, z);
      transform.rotation.z = edge.angle;
      transform.scale.set(w, d, h);
      transform.updateMatrix();
      if (!batches.has(surface)) batches.set(surface, []);
      batches.get(surface).push([transform.matrix.clone(), color]);
    },
    finish() {
      finishStreetHedges(THREE,group,foliage);
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      for (const [surface, items] of batches) {
        const material = new THREE.MeshStandardMaterial({roughness: surface === 'glass' ? .21 : .83,
          metalness: surface === 'glass' ? .24 : .06});
        const mesh = new THREE.InstancedMesh(geometry, material, items.length);
        mesh.name = 'Otoczenie · ' + surface;
        items.forEach(([matrix, color], i) => {
          mesh.setMatrixAt(i, matrix);
          mesh.setColorAt(i, paint.set(color));
        });
        mesh.castShadow = surface !== 'glass';
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
  };
}

function streetEave(roof, [x, y]) {
  let distance = Infinity, height = 0;
  for (const [i, j] of roof.boundaryEdges) {
    const a = roof.vertices[i], b = roof.vertices[j];
    const dx = b[0]-a[0], dy = b[1]-a[1];
    const t = Math.min(1, Math.max(0, ((x-a[0])*dx + (y-a[1])*dy) / (dx*dx + dy*dy || 1)));
    const error = (a[0]+dx*t-x)**2 + (a[1]+dy*t-y)**2;
    if (error < distance) {distance = error; height = a[2] + t*(b[2]-a[2]);}
  }
  return height;
}

export function streetRoofHeight(building, point) {
  const roof = building.roof;
  if (building.roofPolygons) {
    const [x,y] = point;
    for (const face of roof.triangles) {
      const [a,b,c] = face.map(i=>roof.vertices[i]);
      const dx=b[0]-a[0], dy=b[1]-a[1], ex=c[0]-a[0], ey=c[1]-a[1];
      const area=dx*ey-dy*ex;
      if (Math.abs(area)<1e-9) continue;
      const u=((x-a[0])*ey-(y-a[1])*ex)/area, v=(dx*(y-a[1])-dy*(x-a[0]))/area;
      if (u>=-.0001 && v>=-.0001 && u+v<=1.0001) return a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]);
    }
  }
  return streetEave(roof, point);
}

function streetWindow(batch, edge, u, width, base, height, token, trim) {
  const box = (du, out, z, w, d, h, color, material) =>
    batch.box(edge, u+du, out, z, w, d, h, color, material);
  const center = base+height/2;
  box(0, .034, center, width+.16, .09, height+.15, '#d9d5c9');
  box(0, .085, center, width, .055, height, trim);
  const panes = token === 'wide' ? 3 : token === 'pair' ? 2 : 1;
  const innerWidth = width-.11, step = innerWidth/panes, innerHeight = height-.12;
  const direction = Math.cos(edge.angle-.5);
  const glass = direction > .35 ? '#71828a' : direction < -.35 ? '#52636a' : '#63747b';
  for (let i=0; i<panes; i++) {
    const x = step*(i+.5)-innerWidth/2;
    const pane = step-(panes>1 ? .046 : 0);
    box(x, .117, center, pane, .025, innerHeight, glass, 'glass');
    // The upper pane reflects more sky; leave a small clear strip at the jamb.
    box(x, .133, center+innerHeight*.30, pane-.024, .01, innerHeight*.34,
      direction > 0 ? '#8e9c9e' : '#78888b', 'glass');
    if (pane>.67) box(x-pane*.42, .134, center, .025, .01, innerHeight*.88, '#a4aba8', 'glass');
  }
  box(0,.10,base-.043,width+.17,.245,.075,'#b9b8b0');
}

function streetDoor(batch, edge, u, width, height, token, trim, porch) {
  const box = (du, out, z, w, d, h, color, material) =>
    batch.box(edge,u+du,out,z,w,d,h,color,material);
  box(0,.034,height/2,width+.13,.085,height+.1,'#d9d5c9');
  box(0,.084,height/2,width,.052,height,trim);
  box(0,.12,height/2-.026,width-.10,.045,height-.10,token==='barnDoor'?'#806d58':'#535b5c');
  if (token === 'door') {
    box(-width*.17,.15,height*.66,width*.29,.028,height*.45,'#708387','glass');
    box(-width*.17,.168,height*.80,width*.26,.012,height*.12,'#9eaaaa','glass');
    box(width*.34,.19,1.01,.043,.065,.27,'#c1b8a4');
    box(0,.22,.052,width+.18,.46,.105,'#aaa79d');
    if (porch) {
      for (const side of [-1,1])
        box(side*width*.43,.20,height+.085,.055,.39,.125,trim);
      box(0,.43,height+.18,width+.49,.94,.095,trim);
      box(0,.43,height+.24,width+.53,.96,.035,'#9d9c93');
    }
  } else if (token === 'barnDoor') {
    box(0,.151,height/2,.048,.025,height-.11,'#514838');
    for (const side of [-1,1]) box(width*side*.245,.158,height*.63,width*.44,.04,.066,trim);
  } else {
    for (let z=.43;z<height-.15;z+=.43) box(0,.15,z,width-.11,.017,.024,'#444c4f');
  }
}

const streetWindowWidths = {small:.74, window:1.19, wide:2.55, pair:1.68};
const streetDoorWidths = {door:1.02, garage:3.05, barnDoor:2.6};

function streetSecondaryTokens(design, side, length) {
  if (design.type!=='house' || length<2.55) return [];
  const windows = design[side].filter(token=>token in streetWindowWidths);
  const limit = Math.min(windows.length, Math.max(1,Math.floor(length/2.65)));
  return windows.slice(0,limit);
}

function streetOpenings(batch, building, edge, side, secondary=false) {
  const design = building.design;
  const tokens = secondary ? streetSecondaryTokens(design,side,edge.length) : design[side];
  if (!tokens.length) return 0;
  const spacing = edge.length/tokens.length;
  let count = 0;
  for (const [i,token] of tokens.entries()) {
    if (token==='blank') continue;
    const door = token in streetDoorWidths, u = (i+.5)*spacing;
    const width = Math.min((door ? streetDoorWidths : streetWindowWidths)[token],spacing*.81);
    if (width<.48) continue;
    const ceiling = Math.min(...[-.5,0,.5].map(t=>streetRoofHeight(building,edge.point(u+t*width))))-.12;
    if (door && ceiling>=1.8 && width>=(token==='garage' ? 1.85 : .72)) {
      const height = Math.min(ceiling,token==='door' ? 2.14 : 2.46);
      const porch = design.porch && side==='front' && ceiling>=height+.29;
      streetDoor(batch,edge,u,width,height,token,design.trim,porch);
      count++;
    }
    const upperToken = token==='garage' || token==='barnDoor' ? 'pair' : 'window';
    for (let floor=door ? 1 : 0;floor<design.floors;floor++) {
      const glassType = door ? upperToken : token;
      const base = .85+floor*2.75+(glassType==='small' ? .43 : 0);
      const height = Math.min(ceiling-base,glassType==='small' ? .68 : 1.33);
      if (height<.5) continue;
      streetWindow(batch,edge,u,Math.min(width,streetWindowWidths[glassType]),base,height,glassType,design.trim);
      count++;
    }
  }
  return count;
}

function streetSetbackWindow(batch, building, opening) {
  const {vertices,risers} = building.roof;
  const [x,y] = opening.center, bearing = opening.outAz*Math.PI/180;
  for (const ids of risers) {
    const [a,b,c,d] = ids.map(i=>vertices[i]);
    const dx=c[0]-a[0], dy=c[1]-a[1], length=Math.hypot(dx,dy);
    if (length<opening.width+.3) continue;
    const u=((x-a[0])*dx+(y-a[1])*dy)/length;
    const offset=((x-a[0])*dy-(y-a[1])*dx)/length;
    const margin=opening.width/2+.15;
    if (Math.abs(offset)>.09 || u<margin || u>length-margin) continue;
    const lowSide=(dy*Math.sin(bearing)-dx*Math.cos(bearing))/length;
    if (Math.abs(lowSide)<.96) continue;
    const fractions=[(u-margin)/length,(u+margin)/length];
    const lerp=(z0,z1,t)=>z0+(z1-z0)*t;
    const bottom=Math.max(...fractions.map(t=>lerp(Math.min(a[2],b[2]),Math.min(c[2],d[2]),t)));
    const top=Math.min(...fractions.map(t=>lerp(Math.max(a[2],b[2]),Math.max(c[2],d[2]),t)));
    if (opening.sill<bottom+.15 || opening.sill+opening.height>top-.15) continue;
    const edge=streetEdge(lowSide>0?[a,c]:[c,a]);
    streetWindow(batch,edge,lowSide>0?u:length-u,opening.width,opening.sill,
      opening.height,opening.token,building.design.trim);
    return 1;
  }
  return 0;
}

function streetChimneys(batch, building) {
  if (!building.design.chimney) return;
  const surface = {roof:building.roof, roofPolygons:building.roofPolygons ?? building.polygons};
  for (const stack of building.design.chimneyStacks ?? []) {
    const {x,y,width,depth,height,color} = stack;
    const angle = stack.angle*Math.PI/180;
    const edge = streetEdge([[x,y],[x+Math.cos(angle),y+Math.sin(angle)]]);
    const corners = [-.5,.5].flatMap(u=>[-.5,.5].map(v=>streetRoofHeight(surface,edge.point(width*u,depth*v))));
    const base = Math.min(...corners)-.07, top = Math.max(...corners)+height;
    batch.box(edge,0,0,(base+top)/2,width,depth,top-base,color);
    batch.box(edge,0,0,top+.04,width+.095,depth+.095,.09,'#56524e');
    const outlets = width>1 ? 3 : 1;
    for (let i=0;i<outlets;i++)
      batch.box(edge,((i+.5)/outlets-.5)*width,0,top+.09,.13,.13,.02,'#333432');
  }
}

function streetPavilion(batch, b) {
  for (const [ring] of b.polygons) {
    const corners = ring.slice(0,-1), stride = Math.max(1,Math.ceil(corners.length/8));
    for (let i=0;i<corners.length;i+=stride) {
      const p = corners[i], next = corners[(i+stride)%corners.length];
      if (next===p) continue;
      const edge = streetEdge([p,next]), h = streetEave(b.roof,p);
      batch.box(edge,0,0,h/2,.13,.13,h,b.design.trim);
    }
  }
}

export function streetFences(batch, fences) {
  for (const {path, height, style} of fences) {
    for (let i=1;i<path.length;i++) {
      const edge = streetEdge([path[i-1],path[i]]), length = edge.length;
      if (length<.05) continue;
      const bays = Math.max(1,Math.ceil(length/2.5));
      if (style==='hedge') {
        batch.hedge(edge,height);
        continue;
      }
      const slats=style==='slat', mesh=style==='mesh', color=mesh ? '#68716a' : slats ? '#68605a' : '#74695b';
      for (let n=i===1 ? 0 : 1;n<=bays;n++)
        batch.box(edge,n*length/bays,0,height/2,.09,.09,height,color,'płoty');
      const rails = slats ? 8 : mesh ? 7 : 3;
      const span=length/bays;
      for(let bay=0;bay<bays;bay++) for(let n=0;n<rails;n++)
        batch.box(edge,(bay+.5)*span,0,height*(n+.55)/rails,span,.045,slats ? height*.082 : mesh ? .014 : .075,color,'płoty');
      if (mesh) for (let u=.25;u<length;u+=.25)
        batch.box(edge,u,0,height*.5,.014,.019,height*.91,color,'płoty');
    }
  }
}

export function neighborhoodDetails(THREE, group, data) {
  const batch = streetBatch(THREE, group), openings = {};
  for (const b of data.buildings) {
    openings[b.id] = 0;
    if (b.design.type==='pavilion' || b.volumeType==='attached-cover') {streetPavilion(batch,b); continue;}
    for (const [side, ends] of Object.entries(b.facades)) {
      const edge = streetEdge(ends);
      batch.box(edge,edge.length/2,.015,.14,edge.length,.07,.28,b.design.trim);
      openings[b.id] += streetOpenings(batch,b,edge,side);
    }
    for (const {side,ends} of b.secondaryFacades ?? []) {
      const edge = streetEdge(ends);
      openings[b.id] += streetOpenings(batch,b,edge,side,true);
    }
    for (const opening of b.design.setbackWindows ?? []) openings[b.id] += streetSetbackWindow(batch,b,opening);
    streetChimneys(batch,b);
  }
  streetFences(batch,data.fences);
  batch.finish();
  return openings;
}

export function neighborhoodFenceObstacles(fences) {
  return fences.flatMap(({path, style, parcel, collisionHalfWidth}) => path.slice(1).map((end,i) => {
    const edge = streetEdge([path[i],end]), half = collisionHalfWidth ?? (style==='hedge' ? .4 : .045);
    const ring = [edge.point(0,half),edge.point(edge.length,half),edge.point(edge.length,-half),edge.point(0,-half)];
    return {parcel,footprint:{coordinates:[ring]}};
  }));
}
