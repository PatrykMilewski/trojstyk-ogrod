// Merge only static siblings. The placement, material, UVs and shadow flags of each fixture remain independent.
export function batchStaticDetails(THREE, roots) {
  function merge(parent, meshes) {
    const attributes = Object.keys(meshes[0].geometry.attributes);
    const buffers = new Map(), indices = [];
    const total = meshes.reduce((sum,m) => sum + m.geometry.attributes.position.count,0);
    for (const key of attributes) {
      const size = meshes[0].geometry.attributes[key].itemSize;
      buffers.set(key,new Float32Array(total*size));
    }
    let offset = 0;
    for (const mesh of meshes) {
      mesh.updateMatrix();
      const geo = mesh.geometry.clone().applyMatrix4(mesh.matrix);
      for (const key of attributes) {
        const attr=geo.attributes[key];
        buffers.get(key).set(attr.array,offset*attr.itemSize);
      }
      const count=geo.attributes.position.count;
      for(let i=0;i<(geo.index?.count??count);i++)indices.push(offset+(geo.index?.getX(i)??i));
      offset+=count;
    }
    const geometry = new THREE.BufferGeometry();
    for(const [name,array] of buffers)geometry.setAttribute(name,new THREE.BufferAttribute(array,meshes[0].geometry.attributes[name].itemSize));
    geometry.setIndex(indices);
    const first=meshes[0], batch=new THREE.Mesh(geometry,first.material);
    batch.castShadow=first.castShadow;
    batch.receiveShadow=first.receiveShadow;
    parent.remove(...meshes);
    parent.add(batch);
  }

  function visit(parent) {
    const batches=new Map();
    for(const child of parent.children){
      if(child.isGroup&&!child.name)visit(child);
      if(!child.isMesh||child.isInstancedMesh||child.name||child.children.length||Object.keys(child.userData).length)continue;
      if(Array.isArray(child.material)||child.material.transparent||child.material.wireframe)continue;
      const attrs=Object.entries(child.geometry.attributes);
      if(!attrs.every(([,a])=>a.array instanceof Float32Array&&!a.normalized))continue;
      const layout=attrs.map(([k,a])=>k+a.itemSize).sort().join(',');
      const key=[child.material.uuid,child.castShadow,child.receiveShadow,layout].join('|');
      if(!batches.has(key))batches.set(key,[]);
      batches.get(key).push(child);
    }
    for(const meshes of batches.values())if(meshes.length>1)merge(parent,meshes);
  }
  for(const root of roots)visit(root);
}
