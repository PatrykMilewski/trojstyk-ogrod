function terrainByteReader(base64) {
  const bytes = atob(base64);
  let index = 0;
  return {
    more: () => index < bytes.length,
    integer() {
      let value = 0, factor = 1, byte;
      do {
        if (index >= bytes.length || factor > 0x1000000) throw new Error('Invalid terrain encoding');
        byte = bytes.charCodeAt(index++);
        value += (byte & 127) * factor;
        factor *= 128;
      } while (byte & 128);
      return value;
    },
  };
}

function terrainSamples(data) {
  const natural = new Int16Array(data.width * data.height);
  const source = terrainByteReader(data.natural), edits = terrainByteReader(data.grading);
  const signed = n => (n & 1) ? -(n+1)/2 : n/2;
  let i=0;
  for (let r=0;r<data.height;r++) {
    let previous=0;
    for (let c=0;c<data.width;c++) {
      previous += signed(source.integer());
      natural[i++]=previous;
    }
  }
  if (source.more()) throw new Error('Unexpected terrain samples');
  const datumCm=Math.round(data.datum*100), graded=Int16Array.from(natural,v=>v-datumCm);
  let at=0;
  while (edits.more()) {
    at+=edits.integer();
    const end=at+edits.integer();
    if (end>graded.length) throw new Error('Invalid terrain grade extent');
    while (at<end) graded[at++]+=signed(edits.integer());
  }
  return {natural,graded};
}

function terrainColorTexture(THREE, data, natural) {
  const colors = [[35,93,97],[103,155,132],[197,207,157],[226,196,128],[153,104,74]];
  const [lo,hi]=data.range, {width,height}=data, pixels=new Uint8Array(width*height*4);
  for (let i=0;i<natural.length;i++) {
    const t=Math.max(0,Math.min(4,(natural[i]/100-lo)/(hi-lo)*4));
    const j=Math.min(3,Math.floor(t)), mix=t-j;
    const pixel=((height-1-Math.floor(i/width))*width+i%width)*4;
    for (let c=0;c<3;c++) pixels[pixel+c]=Math.round(colors[j][c]*(1-mix)+colors[j+1][c]*mix);
    pixels[pixel+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,width,height);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter; texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true; texture.needsUpdate=true;
  return texture;
}

function terrainClip(poly, signedDistance) {
  if (!poly.length) return poly;
  const out=[];
  let a=poly[poly.length-1], ad=signedDistance(a);
  for (const b of poly) {
    const bd=signedDistance(b);
    if ((bd>=0)!==(ad>=0)) {
      const t=ad/(ad-bd);
      out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
    }
    if (bd>=0) out.push(b);
    a=b; ad=bd;
  }
  return out;
}

function terrainSpan(poly, axis) {
  let low=Infinity, high=-Infinity;
  for (const p of poly) {low=Math.min(low,p[axis]); high=Math.max(high,p[axis]);}
  return [Math.floor(low+1e-8),Math.ceil(high-1e-8)];
}

// Cut each source triangle by the same metre grid and diagonals used for the base map.
// Each resulting face belongs to one terrain plane, including faces along holes and coloured borders.
function terrainDrapeGeometry(THREE, geometry, field) {
  const p=geometry.getAttribute('position'), sourceIndex=geometry.getIndex();
  const attrs=Object.entries(geometry.attributes).filter(([key])=>!['position','normal','tangent'].includes(key))
    .map(([name,attribute])=>({name,attribute,size:attribute.itemSize,values:[]}));
  const positions=[],indices=[],result=new THREE.BufferGeometry();
  const width=field.width+2, {cacheKey,cacheIdx}=field;
  const element=i=>sourceIndex ? sourceIndex.getX(i) : i;
  function face(i) {
    const src=[element(i),element(i+1),element(i+2)];
    const points=src.map(k=>[p.getX(k)-field.x0,p.getY(k)-field.y0]);
    const [[ax,ay],[bx,by],[cx,cy]]=points;
    const abx=bx-ax,aby=by-ay,acx=cx-ax,acy=cy-ay;
    const det=abx*acy-aby*acx;
    if (Math.abs(det)<1e-10) return;
    const za=p.getZ(src[0]), zb=p.getZ(src[1])-za, zc=p.getZ(src[2])-za;
    const channels=attrs.map(a=>Array.from({length:a.size},(_,c)=>{
      const f=k=>a.attribute.getComponent(src[k],c), start=f(0);
      return [start,f(1)-start,f(2)-start];
    }));
    const serial=++field.serial;
    function vertex(x,y) {
      const ix=Math.round(x), iy=Math.round(y);
      const cacheable=Math.abs(x-ix)<1e-8 && Math.abs(y-iy)<1e-8 && ix>=-1 && iy>=-1
        && ix<=field.width && iy<=field.height;
      const key=(iy+1)*width+ix+1;
      if (cacheable && cacheKey[key]===serial) return cacheIdx[key];
      const s=((x-ax)*acy-(y-ay)*acx)/det, t=(abx*(y-ay)-aby*(x-ax))/det;
      const id=positions.length/3;
      positions.push(x+field.x0,y+field.y0,za+s*zb+t*zc+field.visualGrid(x,y));
      for (let k=0;k<channels.length;k++) {
        for (const [v,ds,dt] of channels[k]) attrs[k].values.push(v+s*ds+t*dt);
      }
      if (cacheable) {cacheKey[key]=serial;cacheIdx[key]=id;}
      return id;
    }
    function polygon(poly) {
      if (poly.length<3) return;
      const a=poly[0];
      const ai=vertex(a[0],a[1]);
      for (let k=1;k+1<poly.length;k++) {
        const b=poly[k],c=poly[k+1];
        if (Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-8) continue;
        indices.push(ai,vertex(b[0],b[1]),vertex(c[0],c[1]));
      }
    }
    function fullCell(x,y,divisions) {
      const stride=divisions+1, ids=[];
      for (let r=0;r<=divisions;r++) for (let c=0;c<=divisions;c++) ids.push(vertex(x+c/divisions,y+r/divisions));
      for (let r=0;r<divisions;r++) for (let c=0;c<divisions;c++) {
        const k=r*stride+c,a=ids[k],b=ids[k+1],d=ids[k+stride],cc=ids[k+stride+1];
        if (det>0) indices.push(a,b,cc,a,cc,d);
        else indices.push(a,cc,b,a,d,cc);
      }
    }
    function partialCell(poly,x,y,n) {
      for (let r=0;r<n;r++) {
        const sy=y+r/n;
        const strip=n===1 ? poly : terrainClip(terrainClip(poly,h=>h[1]-sy),h=>sy+1/n-h[1]);
        if (strip.length<3) continue;
        for (let c=0;c<n;c++) {
          const sx=x+c/n;
          const sub=n===1 ? strip : terrainClip(terrainClip(strip,h=>h[0]-sx),h=>sx+1/n-h[0]);
          polygon(terrainClip(sub,h=>h[0]-sx-h[1]+sy));
          polygon(terrainClip(sub,h=>h[1]-sy-h[0]+sx));
        }
      }
    }
    function inside(u,v) {
      const s=((u-ax)*acy-(v-ay)*acx)/det, t=(abx*(v-ay)-aby*(u-ax))/det;
      return s>=-1e-10 && t>=-1e-10 && s+t<=1+1e-10;
    }
    const [first,last]=terrainSpan(points,1);
    for (let y=first;y<last;y++) {
      const strip=terrainClip(terrainClip(points,h=>h[1]-y),h=>y+1-h[1]);
      const [left,right]=terrainSpan(strip,0);
      for (let x=left;x<right;x++) {
        const divisions=field.splits(x,y);
        if (inside(x,y) && inside(x+1,y) && inside(x,y+1) && inside(x+1,y+1)) fullCell(x,y,divisions);
        else partialCell(terrainClip(terrainClip(strip,h=>h[0]-x),h=>x+1-h[0]),x,y,divisions);
      }
    }
  }
  const count=sourceIndex ? sourceIndex.count : p.count;
  const groups=geometry.groups.length ? geometry.groups : [{start:0,count,materialIndex:0}];
  for (const group of groups) {
    const start=indices.length;
    for (let i=group.start;i<Math.min(count,group.start+group.count);i+=3) face(i);
    if (geometry.groups.length) result.addGroup(start,indices.length-start,group.materialIndex);
  }
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  for (const a of attrs) result.setAttribute(a.name,new THREE.Float32BufferAttribute(a.values,a.size));
  result.setIndex(indices);result.computeVertexNormals();
  return result;
}

export function createNeighborhoodTerrain(THREE, data) {
  const {natural,graded}=terrainSamples(data), {width,height,bounds}=data;
  const x0=bounds[0]+.5, y0=bounds[1]+.5;
  const refinement=new Uint8Array(width*height);
  for (let r=1;r<height;r++) for (let c=0;c<width-1;c++) {
    const k=r*width+c;
    const cross=Math.abs(graded[k]-graded[k+1]+graded[k+1-width]-graded[k-width]);
    refinement[k]=cross<=6 ? 1 : cross<=24 ? 2 : cross<=96 ? 4 : 8;
  }
  function grid(grid,x,y,triangle) {
    const gx=Math.max(0,Math.min(width-1,x)),gy=Math.max(0,Math.min(height-1,y));
    const i=Math.min(width-2,Math.floor(gx)),j=Math.min(height-2,Math.floor(gy));
    const dx=gx-i,dy=gy-j, at=(height-1-j)*width+i;
    const a=grid[at], b=grid[at+1], c=grid[at+1-width], d=grid[at-width];
    const bilinear=(a+(b-a)*dx)*(1-dy)+(d+(c-d)*dx)*dy;
    if (!triangle) return bilinear/100;
    const n=refinement[at],u=(dx*n)%1,v=(dy*n)%1;
    return (bilinear+(a-b+c-d)*(Math.min(u,v)-u*v)/(n*n))/100;
  }
  function splits(x,y) {
    return x>=0 && x<width-1 && y>=0 && y<height-1 ? refinement[(height-1-y)*width+x] : 1;
  }
  const visualGrid=(x,y)=>grid(graded,x,y,true);
  const nodeCount=(width+2)*(height+2);
  const field={width,height,x0,y0,visualGrid,splits,serial:0,cacheKey:new Int32Array(nodeCount),cacheIdx:new Int32Array(nodeCount)};
  return {
    bounds,range:data.range,datum:data.datum,
    z:(x,y)=>visualGrid(x-x0,y-y0),
    elevation:(x,y)=>grid(natural,x-x0,y-y0,false),
    padZ:id=>data.pads[id],
    drape:geometry=>terrainDrapeGeometry(THREE,geometry,field),
    heightTexture:()=>terrainColorTexture(THREE,data,natural),
  };
}
