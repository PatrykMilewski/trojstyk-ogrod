import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const load = code => import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const html = await read('../trzy-domy-3d/index.html');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString('utf8').replaceAll("'three/core'", "'" + imports['three/core'] + "'"));
const { batchStaticInteriorDetails } = await load(await read('../src/model/static-detail-batches.js'));

test('local batches preserve transformed positions, normals, UVs, winding, material and shadow settings', () => {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const parts = [];
  for (const [i, x] of [1, 2, 8, 9].entries()) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.userData.furnitureId = 'table';
    mesh.position.set(x, 1, 1);
    mesh.rotation.set(.31, .4 * i, -.32);
    mesh.scale.set(.31, .17, .23);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.updateMatrix();
    parts.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));
    group.add(mesh);
  }
  batchStaticInteriorDetails(THREE, group);
  assert.equal(group.children.length, 2);
  for (const [index, batch] of group.children.entries()) {
    assert.equal(batch.material, material);
    assert(batch.castShadow && batch.receiveShadow);
    const sources = parts.slice(index * 2, index * 2 + 2);
    for (const key of ['position', 'normal', 'uv']) {
      assert.deepEqual([...batch.geometry.attributes[key].array], sources.flatMap(g => [...g.attributes[key].array]));
    }
    const count = sources[0].attributes.position.count;
    assert.deepEqual([...batch.geometry.index.array], sources.flatMap((g, n) => [...g.index.array].map(i => i + n * count)));
  }
});

test('transparent, instanced, animated and shader-driven fittings stay independent', () => {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: .08 });
  const shader = material.clone();
  shader.onBeforeCompile = () => {};
  const createMesh = mat => new THREE.Mesh(new THREE.BoxGeometry(), mat);
  for (let i = 0; i < 2; i++) {
    const moving = createMesh(material);
    moving.animations.push(new THREE.AnimationClip());
    const dynamic = createMesh(material);
    dynamic.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    group.add(moving, dynamic, createMesh(glass), createMesh(shader), new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 3));
  }
  for (const mesh of group.children) mesh.userData.furnitureId = 'fixture';
  const before = [...group.children];
  batchStaticInteriorDetails(THREE, group);
  assert.deepEqual(group.children, before);
});

const marker = 'const [source,garden,house,neighbors]=';
const [, , house, neighbors] = JSON.parse(html.slice(html.indexOf(marker) + marker.length, html.indexOf(';\nconst landscaping=')));
const { addIconInterior } = await load(await read('../src/model/interior.js'));
const { addFlorydaInterior } = await load(await read('../src/model/floryda-interior.js'));
for (const [parcel, file, add, building] of [
  ['193', 'interior-data.json', addIconInterior, house],
  ['190', 'floryda-interior-data.json', addFlorydaInterior, neighbors.houses.find(h => h.parcel === '190')],
]) {
  test('parcel /' + parcel + ' keeps its mesh triangle count and walking geometry with fewer draws', async () => {
    const data = JSON.parse(await read('../trzy-domy-3d/' + file));
    const { group, navigation } = add({ THREE, scene: new THREE.Scene(), house: building, data });
    const triangles = () => group.children.filter(o => o.isMesh).reduce((sum, o) =>
      sum + (o.geometry.index?.count ?? o.geometry.attributes.position.count) * (o.isInstancedMesh ? o.count : 1) / 3, 0);
    const triangleCount = triangles(), original = group.children.length, nav = JSON.stringify(navigation);
    batchStaticInteriorDetails(THREE, group, parcel === '190' ? data.furniture : []);
    assert.equal(JSON.stringify(navigation), nav);
    assert.equal(triangles(), triangleCount);
    assert(group.children.length < original * .8, original + ' → ' + group.children.length);
  });
}
