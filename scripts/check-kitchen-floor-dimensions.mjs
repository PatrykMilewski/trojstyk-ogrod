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
  assert.equal(mm(islandTop.min.y - wallTop.max.y), 1140);
});

test('all twelve vestibule front dimensions come from the finished panels on their hinges', () => {
  const {wardrobe} = measureIconKitchen(THREE, interior.group);
  function sizes(columns) {
    return columns.map(({lower, upper}) => [lower, upper].map(({width, height}) =>
      [width, height].map(m => Math.round(m * 10000) / 10)));
  }
  assert.deepEqual(sizes(wardrobe.rear), Array(4).fill([[486.5, 2081], [486.5, 594]]));
  assert.deepEqual(sizes(wardrobe.side), Array(2).fill([[494, 2081], [494, 594]]));
});

test('mirrored floor guide has upright, unmirrored wall text, remains toggleable after batching and ignores picks', () => {
  const text = [], badges = [];
  const ink = {
    scale() {}, translate(x, y) { this.origin = {x, y}; }, rotate() {}, save() {}, restore() {}, beginPath() {},
    moveTo() {}, lineTo() {}, stroke() {}, fillText(value) { text.push(value); }, strokeText() {},
    fillRect(x, y, width, height) {
      badges.push({x: this.origin.x + x, y: this.origin.y + y, width, height});
    },
    measureText(value) { return {width: value.length * 14}; },
  };
  const canvas = {getContext: () => ink};
  globalThis.document = {createElement: () => canvas};
  let guides;
  try {
    guides = createIconKitchenFloorDimensions(THREE, interior.group, false);
  } finally {
    delete globalThis.document;
  }
  batchStaticInteriorDetails(THREE, interior.group);
  const guide = guides.getObjectByName('kitchen-floor-dimensions');
  const entryGuide = guides.getObjectByName('entry-wardrobe-floor-dimensions');
  assert.equal(guides.parent, interior.group);
  assert.ok(!guides.visible && guide.visible && entryGuide.visible);
  guides.visible = true;
  assert.ok(entryGuide.position.z > .0087);
  assert.deepEqual(new THREE.Raycaster().intersectObject(entryGuide), []);
  const expected = ['48,65', '48,65', '48,65', '48,65', '49,4', '49,4'];
  assert.deepEqual(text.slice(-24), expected.flatMap((width, i) => [
    'Dolny ' + (i % 4 + 1), width + ' × 208,1 cm', 'Górny ' + (i % 4 + 1), width + ' × 59,4 cm',
  ]));
  assert.equal(badges.length, 6);
  for (const [i, a] of badges.entries()) {
    assert.ok(a.x > 8.49 && a.y > 4.71 && a.x + a.width < 10.6 && a.y + a.height < 5.71);
    for (const b of badges.slice(i + 1)) {
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x ||
        a.y + a.height <= b.y || b.y + b.height <= a.y, 'Neighbouring wardrobe labels must stay apart');
    }
  }
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
