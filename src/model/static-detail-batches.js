function mergeStaticSiblings(THREE, parent, meshes, name) {
  const first = meshes[0], attributes = Object.entries(first.geometry.attributes);
  const total = meshes.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0);
  const geometry = new THREE.BufferGeometry(), indices = [];
  for (const [key, attribute] of attributes) {
    geometry.setAttribute(key, new THREE.BufferAttribute(new Float32Array(total * attribute.itemSize), attribute.itemSize));
  }
  let offset = 0;
  for (const mesh of meshes) {
    if (mesh.matrixAutoUpdate) mesh.updateMatrix();
    const source = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    for (const [key, attribute] of Object.entries(source.attributes)) {
      geometry.attributes[key].array.set(attribute.array, offset * attribute.itemSize);
    }
    const count = source.attributes.position.count;
    for (let i = 0; i < (source.index?.count ?? count); i++) indices.push(offset + (source.index?.getX(i) ?? i));
    offset += count;
  }
  geometry.setIndex(indices);
  const batch = new THREE.Mesh(geometry, first.material);
  batch.name = name;
  batch.castShadow = first.castShadow;
  batch.receiveShadow = first.receiveShadow;
  batch.layers.mask = first.layers.mask;
  batch.renderOrder = first.renderOrder;
  batch.frustumCulled = first.frustumCulled;
  parent.remove(...meshes);
  parent.add(batch);
}

function batchStaticSiblings(THREE, parent, clusterFor, name = '') {
  const batches = new Map();
  for (const child of parent.children) {
    if (!child.isMesh || child.isInstancedMesh || child.children.length) continue;
    if (Array.isArray(child.material) || child.material.transparent || child.material.wireframe) continue;
    const cluster = clusterFor(child);
    if (cluster === null) continue;
    const attrs = Object.entries(child.geometry.attributes);
    if (!attrs.every(([, a]) => a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute)) continue;
    const layout = attrs.map(([key, a]) => key + a.itemSize).sort().join(',');
    const key = [cluster, child.material.uuid, child.castShadow, child.receiveShadow, child.layers.mask, child.renderOrder, child.frustumCulled, layout].join('|');
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(child);
  }
  for (const meshes of batches.values()) if (meshes.length > 1) mergeStaticSiblings(THREE, parent, meshes, name);
}

export function batchStaticDetails(THREE, roots) {
  function visit(parent) {
    for (const child of parent.children) if (child.isGroup && !child.name) visit(child);
    batchStaticSiblings(THREE, parent, child => child.name || Object.keys(child.userData).length ? null : '');
  }
  for (const root of roots) visit(root);
}

function staticInteriorMesh(THREE, mesh) {
  if (mesh.type !== 'Mesh' || !mesh.visible || mesh.animations.length || mesh.userData.dynamic) return false;
  const { geometry, material } = mesh;
  if (Object.keys(geometry.morphAttributes).length || geometry.drawRange.start || geometry.drawRange.count !== Infinity) return false;
  if (Object.values(geometry.attributes).some(attribute => attribute.usage !== THREE.StaticDrawUsage)) return false;
  if (mesh.customDepthMaterial || mesh.customDistanceMaterial || !material.isMeshStandardMaterial ||
      material.transmission || material.displacementMap || material.normalMap && material.normalMapType === THREE.ObjectSpaceNormalMap) return false;
  if (material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || material.onBeforeRender !== THREE.Material.prototype.onBeforeRender) return false;
  return ['onBeforeRender', 'onAfterRender', 'onBeforeShadow', 'onAfterShadow'].every(hook => mesh[hook] === THREE.Object3D.prototype[hook]);
}

export function batchStaticInteriorDetails(THREE, group, furniture = []) {
  const prefixes = furniture.map(item => 'floryda-' + item.id + '-');
  const detail = /^(?:projector-|garage-workbench-|stair-(?:lower|upper)-(?:tread|baluster)-|gallery-frame-|light-fixture-|floryda-light-)/;
  const center = new THREE.Vector3();
  function clusterFor(mesh) {
    if (!mesh.userData.furnitureId && !detail.test(mesh.name) && !prefixes.some(prefix => mesh.name.startsWith(prefix))) return null;
    if (!staticInteriorMesh(THREE, mesh)) return null;
    if (mesh.matrixAutoUpdate) mesh.updateMatrix();
    if (mesh.matrix.determinant() <= 0) return null;
    const { geometry } = mesh;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    geometry.boundingBox.getCenter(center).applyMatrix4(mesh.matrix);
    return [Math.floor(center.x / 4), Math.floor(center.y / 4), Math.floor(center.z / 3.2)].join(',');
  }
  batchStaticSiblings(THREE, group, clusterFor, 'static-interior-details');
}
