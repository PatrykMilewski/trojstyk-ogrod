import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const html = await read('../trzy-domy-3d/index.html');
const imports = JSON.parse(html.split('<script type="importmap">')[1].split('</script>')[0]).imports;
const THREE = await load(Buffer.from(imports.three.split(',')[1], 'base64').toString()
  .replaceAll("'three/core'", "'" + imports['three/core'] + "'"));
const [, , house] = JSON.parse(html.split('const [source,garden,house,neighbors]=')[1].split(';\nconst landscaping=')[0]);
const data = JSON.parse(await read('../trzy-domy-3d/interior-data.json'));
const {addIconInterior} = await load(await read('../src/model/interior.js'));
const {batchStaticInteriorDetails} = await load(await read('../src/model/static-detail-batches.js'));
const {measureIconKitchen, createIconKitchenFloorDimensions} = await load(await read('../src/model/kitchen-floor-dimensions.js'));
const interior = addIconInterior({THREE, house, data, scene: new THREE.Scene()});
const mm = metres => Math.round(metres * 1000);
const widths = segments => segments.map(({end, start}) => mm(end - start));

test('floor dimensions measure finished faces, both worktop edges and the clear aisle', () => {
  const {base, upper, island, wallTop, islandTop} = measureIconKitchen(THREE, interior.group);
  assert.deepEqual(widths(base), [544, 894, 94, 595, 595, 795, 595, 595, 594, 594]);
  assert.deepEqual(widths(upper), [635, 635, 635, 635, 635]);
  assert.deepEqual(widths(island), [595, 595, 595, 595, 595, 595]);
  assert.equal(island[1].caption, 'piekarnik');
  assert.equal(base[5].caption, 'pod zlewem');
  assert.equal(base[3].caption, 'zmywarka');
  assert.equal(mm(islandTop.max.x - islandTop.min.x), 3823);
  assert.equal(mm(islandTop.max.y - islandTop.min.y), 1050);
  assert.equal(mm(islandTop.min.y - wallTop.max.y), 1080);
});

test('mirrored floor guide has upright, unmirrored wall text, remains toggleable after batching and ignores picks', () => {
  const ink = {
    scale() {}, translate() {}, rotate() {}, save() {}, restore() {}, beginPath() {},
    moveTo() {}, lineTo() {}, stroke() {}, fillText() {}, strokeText() {},
    measureText(value) { return {width: value.length * 14}; },
  };
  const canvas = {getContext: () => ink};
  globalThis.document = {createElement: () => canvas};
  let guide;
  try {
    guide = createIconKitchenFloorDimensions(THREE, interior.group, false);
  } finally {
    delete globalThis.document;
  }
  batchStaticInteriorDetails(THREE, interior.group);
  assert.equal(interior.group.getObjectByName('kitchen-floor-dimensions'), guide);
  assert.equal(guide.visible, false);
  guide.visible = true;
  assert.equal(guide.material.depthTest, true);
  assert.equal(guide.material.depthWrite, false);
  assert.equal(guide.castShadow, false);
  assert.deepEqual(new THREE.Raycaster().intersectObject(guide), []);
  guide.updateWorldMatrix(true, false);
  const {position, uv} = guide.geometry.attributes;
  function vertex(u, v) {
    for (let i = 0; i < uv.count; i++) {
      if (uv.getX(i) === u && uv.getY(i) === v)
        return new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(guide.matrixWorld);
    }
    assert.fail('Expected UV corner');
  }
  const origin = vertex(0, 0), glyphUp = vertex(0, 1).sub(origin).normalize();
  const glyphRight = vertex(1, 0).sub(origin).normalize(), vertical = new THREE.Vector3(0, 0, 1);
  const towardWall = new THREE.Vector3(0, -1, 0).transformDirection(interior.group.matrixWorld);
  assert.ok(glyphUp.dot(towardWall) > .999);
  assert.ok(glyphRight.dot(towardWall.cross(vertical)) > .999);
});
