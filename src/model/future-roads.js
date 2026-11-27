function roadGravelTexture(THREE) {
  const size = 96, pixels = new Uint8Array(size*size*4);
  let seed = 17401;
  for (let i=0;i<pixels.length;i+=4) {
    seed = (1664525*seed+1013904223)>>>0;
    const value = (seed>>>23)/511, speck = value<.10 ? -28 : value>.88 ? 23 : 0;
    pixels[i] = 191+14*value+speck;
    pixels[i+1] = 181+14*value+speck;
    pixels[i+2] = 162+13*value+speck;
    pixels[i+3] = 255;
  }
  const texture = new THREE.DataTexture(pixels,size,size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function roadGeometry(THREE, polygons, terrain, tile, fades) {
  const points = ring => ring.slice(0,-1).map(([x,y])=>new THREE.Vector2(x,y));
  const shapes = polygons.map(([outer,...holes])=>{
    const shape = new THREE.Shape(points(outer));
    shape.holes = holes.map(ring=>new THREE.Path(points(ring)));
    return shape;
  });
  const flat = new THREE.ShapeGeometry(shapes);
  const geometry = terrain ? terrain.drape(flat) : flat;
  if (geometry!==flat) flat.dispose();
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  const color = fades.length ? new Float32Array(position.count*4) : null;
  for (let i=0;i<position.count;i++) {
    const x=position.getX(i), y=position.getY(i);
    uv.setXY(i,x/tile,y/tile);
    if (color) {
      let alpha=1;
      for (const [cap,inward] of fades) {
        if (Math.hypot(x-cap[0],y-cap[1])>7) continue;
        const dx=inward[0]-cap[0],dy=inward[1]-cap[1];
        const along=((x-cap[0])*dx+(y-cap[1])*dy)/Math.hypot(dx,dy);
        alpha=Math.min(alpha,THREE.MathUtils.smoothstep(along,.1,5.5));
      }
      color.set([1,1,1,alpha],4*i);
    }
  }
  if (color) geometry.setAttribute('color',new THREE.BufferAttribute(color,4));
  return geometry;
}

export function addRoadLinks(THREE,scene,roadData,terrain) {
  const group=new THREE.Group();
  group.name='Połączenia drogi 775/133';
  const road=scene.getObjectByName('surface-road');
  const gravel=roadGravelTexture(THREE);
  const stone=new THREE.MeshStandardMaterial({map:gravel,bumpMap:gravel,bumpScale:.025,
    roughness:.97,vertexColors:true,transparent:true,alphaTest:.025,side:THREE.DoubleSide});
  const shoulder=stone.clone();
  shoulder.color.set('#c8bca8');
  const asphalt=road?.material ?? new THREE.MeshStandardMaterial({color:'#777a73',roughness:.96,side:THREE.DoubleSide});
  const cap=new THREE.MeshStandardMaterial({color:'#938e80',roughness:.97,side:THREE.DoubleSide});
  const z=road?.position.z ?? -.01;
  function surface(name,polygons,material,tile,lift,fades=[]) {
    if (!polygons.length) return;
    const mesh=new THREE.Mesh(roadGeometry(THREE,polygons,terrain,tile,fades),material);
    mesh.name=name;
    mesh.position.z=z+lift;
    mesh.receiveShadow=true;
    group.add(mesh);
  }
  surface('Drogi żwirowe z ortofotomapy',roadData.observed,stone,3.0,.016,roadData.fadeEnds);
  surface('Pobocza połączeń',roadData.shoulders,shoulder,2.4,.008,roadData.fadeEnds);
  surface('Zjazdy z 775/133',roadData.links,asphalt,7.5,.005);
  surface('Krawędzie nieprzelotowe przy 774/8',roadData.deadEnds.flatMap(s=>s.polygons),cap,1,.022);
  scene.add(group);
  const surfaces=[road,...group.children].filter(Boolean).map(mesh=>({mesh,base:mesh.position.z}));
  return {group,mask:roadData.mask,setBackground(background) {
    // Raise road ink just over the coloured height overlay in the NMT view.
    for(const {mesh,base} of surfaces) mesh.position.z=base+(background==='height'?.05:0);
  }};
}
