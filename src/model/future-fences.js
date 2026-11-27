import {streetBatch, streetEdge} from './neighborhood-details.js';

const futureFenceFronts = {
  barnA: ['timber-boards', 'timber-on-stone', 'horizontal-steel'],
  barnA200: ['timber-on-stone', 'limestone-slats'],
  barnB: ['brick-pickets', 'timber-boards', 'steel-pickets'],
  barnC: ['horizontal-steel', 'limestone-slats', 'steel-pickets'],
  bungalow: ['timber-boards', 'steel-pickets', 'split-rail'],
  villa: ['limestone-slats', 'brick-pickets', 'timber-on-stone'],
};

const futureFenceStyles = {
  'timber-boards': {height: 1.36, width: .12, bay: 2.25},
  'timber-on-stone': {height: 1.52, width: .29, bay: 2.80, pier: true, plinth: .25},
  'horizontal-steel': {height: 1.43, width: .10, bay: 2.42},
  'limestone-slats': {height: 1.59, width: .32, bay: 2.85, pier: true, plinth: .34},
  'brick-pickets': {height: 1.52, width: .29, bay: 2.53, pier: true, plinth: .23},
  'steel-pickets': {height: 1.29, width: .085, bay: 2.29},
  'split-rail': {height: 1.14, width: .14, bay: 2.67},
  'welded-mesh': {height: 1.47, width: .065, bay: 2.50},
};

const futureFenceColors = [
  {wood:'#a47d57', grain:'#8c694b', metal:'#48514f', stone:'#c2b29a', brick:'#a16c55', cap:'#867f73'},
  {wood:'#9c795e', grain:'#84664f', metal:'#43494a', stone:'#c4c2b8', brick:'#976954', cap:'#8c8d83'},
  {wood:'#97765a', grain:'#ab8967', metal:'#4f5d54', stone:'#b4aa97', brick:'#9a725b', cap:'#847e72'},
  {wood:'#b28e66', grain:'#9a7957', metal:'#535859', stone:'#cfc6af', brick:'#a7745a', cap:'#918a7b'},
];

function futureFenceDesign(home) {
  const hash = Array.from(home.parcel).reduce((sum, c) => Math.imul(sum, 31) + c.charCodeAt(0) >>> 0, 7);
  const fronts = futureFenceFronts[home.type];
  const front = fronts[hash % fronts.length];
  const sides = front.startsWith('timber') || front === 'split-rail'
    ? ['split-rail', 'welded-mesh', 'timber-boards'] : ['welded-mesh', 'steel-pickets', 'welded-mesh'];
  return {front, side:sides[Math.floor(hash / 3) % sides.length],
    palette:futureFenceColors[Math.floor(hash / 7) % futureFenceColors.length], offset:(hash % 5 - 2) * .025};
}

const fencePointKey = ([x, y]) => x + ',' + y;

export function designFutureFences(data) {
  const designs = new Map(data.homes.map(h => [h.parcel, futureFenceDesign(h)]));
  const fences = data.fences.map(fence => {
    const design = designs.get(fence.parcel);
    const front = fence.front ?? (fence.height < 1.35);
    const style = front ? design.front : design.side;
    const spec = futureFenceStyles[style];
    return {...fence, style, front, height:spec.height + design.offset, palette:design.palette,
      collisionHalfWidth:(spec.width + (spec.pier ? .045 : 0)) / 2, gatePosts:[]};
  });
  const ends = fences.flatMap(fence => [0, fence.path.length - 1].map(index => ({fence, index})));
  for (const home of data.homes) {
    const design = designs.get(home.parcel), spec = futureFenceStyles[design.front];
    for (const [x, y] of home.gate) {
      let nearest, best = .85;
      for (const end of ends) {
        const [px, py] = end.fence.path[end.index], distance = Math.hypot(x - px, y - py);
        if (distance < best) { best = distance; nearest = end; }
      }
      if (!nearest) continue;
      const post = {index:nearest.index, style:design.front, palette:design.palette,
        width:spec.pier ? .32 : Math.max(.115, spec.width), height:spec.height + design.offset + .08};
      nearest.fence.gatePosts.push(post);
      nearest.fence.collisionHalfWidth = Math.max(nearest.fence.collisionHalfWidth, (post.width + (spec.pier ? .045 : 0)) / 2);
    }
  }
  return fences;
}

const fenceWood = 'drewno ogrodzeń', fenceSteel = 'stal ogrodzeń', fenceStone = 'mury ogrodzeń';

function futureFencePost(batch, edge, u, height, width, style, palette) {
  const spec = futureFenceStyles[style];
  if (spec.pier) {
    const brick = style === 'brick-pickets', color = brick ? palette.brick : palette.stone;
    const courses = Math.max(3, Math.round((height - .055) / (brick ? .094 : .205)));
    const courseHeight = (height - .055) / courses;
    batch.box(edge,u,0,(height-.055)/2,width-.012,width-.012,height-.055,palette.cap,fenceStone);
    for (let i = 0; i < courses; i++) {
      batch.box(edge,u,0,(i+.5)*courseHeight,width,width,courseHeight-.009,color,fenceStone);
    }
    batch.box(edge,u,0,height-.0275,width+.045,width+.045,.055,palette.cap,fenceStone);
  } else {
    const wood = style === 'split-rail' || style === 'timber-boards';
    batch.box(edge,u,0,height/2,width,width,height,wood ? palette.grain : palette.metal,wood ? fenceWood : fenceSteel);
  }
}

function addFutureWirePanel(wires, edge, lo, hi, bottom, top, color) {
  const base = wires.positions.length / 3;
  for (const [u,z] of [[lo,bottom],[hi,bottom],[hi,top],[lo,top]]) {
    wires.positions.push(...edge.point(u),z);
    wires.uvs.push(u/.103,z/.185);
    wires.colors.push(color.r,color.g,color.b);
  }
  wires.indices.push(base,base+1,base+2,base,base+2,base+3);
}

function futureFenceBay(batch, wires, edge, lo, hi, fence, paint) {
  if (hi <= lo) return;
  const {style, height, palette} = fence, spec = futureFenceStyles[style];
  const span = hi-lo, mid = (hi+lo)/2;
  const rail = (z, d, h, color, surface, offset=0) => batch.box(edge,mid,offset,z,span,d,h,color,surface);
  if (spec.plinth) {
    rail(spec.plinth/2,.19,spec.plinth,palette.stone,fenceStone);
    rail(spec.plinth+.018,.215,.036,palette.cap,fenceStone);
  }
  const bottom = (spec.plinth || .03)+.06, top = height-.065, panelHeight = top-bottom;
  if (style === 'welded-mesh') {
    addFutureWirePanel(wires,edge,lo,hi,bottom,top,paint.set(palette.metal));
    for (const z of [bottom+.04,top-.09,top]) rail(z,.021,.019,palette.metal,fenceSteel);
  } else if (style === 'split-rail') {
    for (const z of [.33,.68,.95]) rail(height*z,.073,.088,palette.wood,fenceWood);
  } else if (['horizontal-steel','limestone-slats','timber-on-stone'].includes(style)) {
    const wood = style === 'timber-on-stone', count = wood ? 7 : 9;
    for (let n=0; n<count; n++) {
      const z = bottom + panelHeight * (n+.5)/count;
      rail(z,wood ? .048 : .035,panelHeight/count*(wood ? .72 : .62),
        wood ? (n%4 ? palette.wood : palette.grain) : palette.metal,wood ? fenceWood : fenceSteel);
    }
  } else {
    const wood = style === 'timber-boards';
    for (const z of [.22,.77]) rail(bottom+panelHeight*z,.033,.050,wood ? palette.grain : palette.metal,
      wood ? fenceWood : fenceSteel,-.019);
    const count = Math.max(1,Math.floor(span/(wood ? .15 : .135)));
    for (let n=0; n<count; n++) {
      const u=lo+span*(n+.5)/count, h=panelHeight-(wood && n%4===0 ? .016 : 0);
      batch.box(edge,u,.014,bottom+h/2,Math.min(wood ? .108 : .023,span/count*.78),wood ? .030 : .023,h,
        wood ? (n%5 ? palette.wood : palette.grain) : palette.metal,wood ? fenceWood : fenceSteel);
    }
  }
}

function finishFutureWires(THREE, group, wires) {
  if (!wires.indices.length) return;
  const size=32, texels=new Uint8Array(size*size*4);
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
    const i=4*(y*size+x);
    texels.set([255,255,255,(x===0 || x===31 || y===0 || y===31) ? 255 : 0],i);
  }
  const map=new THREE.DataTexture(texels,size,size);
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.magFilter=THREE.LinearFilter; map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=true; map.needsUpdate=true;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(wires.positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(wires.colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(wires.uvs,2));
  geometry.setIndex(wires.indices); geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map,vertexColors:true,side:THREE.DoubleSide,
    alphaTest:.2,roughness:.66,metalness:.26}));
  mesh.name='Przęsła z siatki zgrzewanej'; mesh.receiveShadow=true; group.add(mesh);
}

function futureFenceEnds(fences) {
  const junctions=new Map();
  for (const fence of fences) {
    const spec=futureFenceStyles[fence.style];
    fence.path.forEach((point,index) => {
      const key=fencePointKey(point), gate=fence.gatePosts.find(post=>post.index===index);
      const current=junctions.get(key);
      const post=gate || {width:spec.width, height:fence.height, style:fence.style, palette:fence.palette};
      const incident = index > 0 && index < fence.path.length-1 ? 2 : 1;
      if (!current) junctions.set(key,{post,gate,count:incident});
      else {
        current.count += incident;
        if (gate || (!current.gate && post.width>current.post.width)) Object.assign(current,{post,gate});
      }
    });
  }
  return junctions;
}

export function addFutureFences(THREE, group, fences, homes) {
  if (!homes.length || !fences.length) return;
  const scenery=new THREE.Group();
  scenery.name='Projektowane ogrodzenia'; group.add(scenery);
  const batch=streetBatch(THREE,scenery), seen=new Set(), junctions=futureFenceEnds(fences);
  const wires={positions:[],colors:[],uvs:[],indices:[]}, paint=new THREE.Color();
  for (const fence of fences) {
    const spec=futureFenceStyles[fence.style];
    for (let i=1;i<fence.path.length;i++) {
      const a=fence.path[i-1], b=fence.path[i], edge=streetEdge([a,b]);
      if (edge.length<.04) continue;
      const bays=Math.max(1,Math.ceil(edge.length/spec.bay)), span=edge.length/bays;
      const offsets=[a,b].map((point,side)=>{
        const key=fencePointKey(point), junction=junctions.get(key), post=junction.post;
        const cap=futureFenceStyles[post.style].pier ? .045 : 0;
        const half=(post.width+cap)/2, inset=junction.count===1 ? half : 0;
        if (!seen.has(key)) {
          futureFencePost(batch,edge,side ? edge.length-inset : inset,post.height,post.width,post.style,post.palette);
          seen.add(key);
        }
        return inset + post.width/2;
      });
      for (let n=0;n<bays;n++) {
        const lo=n*span+(n===0 ? offsets[0] : spec.width/2);
        const hi=(n+1)*span-(n===bays-1 ? offsets[1] : spec.width/2);
        if (n) futureFencePost(batch,edge,n*span,fence.height,spec.width,fence.style,fence.palette);
        futureFenceBay(batch,wires,edge,lo,hi,fence,paint);
      }
    }
  }
  batch.finish();
  for (const mesh of scenery.children) {
    const steel=mesh.name.endsWith(fenceSteel), wood=mesh.name.endsWith(fenceWood);
    mesh.material.roughness=steel ? .54 : wood ? .88 : .94;
    mesh.material.metalness=steel ? .38 : 0;
  }
  finishFutureWires(THREE,scenery,wires);
}
