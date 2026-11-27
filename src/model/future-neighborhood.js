import {frameNeighborhood} from './neighborhood.js';
import {neighborhoodFenceObstacles} from './neighborhood-details.js';
import {addFutureGardens} from './future-gardens.js';
import {designFutureFences, addFutureFences} from './future-fences.js';
import {addNeighborhoodTrees} from './neighborhood-trees.js';
import {addFutureHouses, futureHouseFootprint, futureGarageFootprint, futureHousePorchObstacles} from './future-houses.js';

function addFutureDriveways(THREE, group, homes) {
  const positions = [];
  for (const home of homes) {
    const contour = home.driveway.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
    for (const triangle of THREE.ShapeUtils.triangulateShape(contour, [])) {
      for (const i of triangle) positions.push(contour[i].x, contour[i].y, .047);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color:'#b8afa1',roughness:.96,side:THREE.DoubleSide}));
  mesh.receiveShadow = true;
  mesh.name = 'Proponowane podjazdy';
  group.add(mesh);
}

function gardenWalkObstacles(lots) {
  const obstacles = [];
  for (const {parcel, trees, thuja} of lots) {
    obstacles.push(...neighborhoodFenceObstacles(thuja.map(row => ({
      parcel, path:row.path, collisionHalfWidth:row.radius,
    }))));
    for (const tree of trees) {
      const r = Math.min(.15, tree.radius*.08);
      const ring = Array.from({length:8}, (_,i) => {
        const angle = i*Math.PI/4;
        return [tree.x+r*Math.cos(angle), tree.y+r*Math.sin(angle)];
      });
      obstacles.push({parcel,footprint:{coordinates:[ring]}});
    }
  }
  return obstacles;
}

export function addFutureNeighborhood(THREE, scene, data, gardenData) {
  const group = new THREE.Group();
  group.name = 'Przyszła zabudowa';
  addFutureHouses(THREE, group, data.homes);
  addFutureDriveways(THREE, group, data.homes);
  const fences = designFutureFences(data);
  addFutureFences(THREE, group, fences, data.homes);
  const {lawns, plantings, terraceObstacles} = addFutureGardens(THREE, group, gardenData, scene.getObjectByName('context-grass-192').material);
  scene.add(group);
  const obstacles = [...data.homes.flatMap(h => [futureHouseFootprint(h), ...futureHousePorchObstacles(h), futureGarageFootprint(h)].filter(Boolean)
    .map(ring => ({parcel:h.parcel, footprint:{coordinates:[ring]}}))),
    ...terraceObstacles, ...neighborhoodFenceObstacles(fences), ...gardenWalkObstacles(gardenData.lots)].map(item => ({...item, enabled: () => group.visible}));
  return {group, gardens:lawns, plantings, fences, gardenData, data, obstacles};
}

export function focusFutureHouse(camera, controls, home) {
  const bearing = (home.angle + 28) * Math.PI / 180;
  const frame = [...home.envelope, ...(home.garage?.envelope??[])];
  const xs = frame.map(p=>p[0]), ys = frame.map(p=>p[1]);
  const cx = (Math.min(...xs)+Math.max(...xs))/2, cy = (Math.min(...ys)+Math.max(...ys))/2;
  const span = 2*Math.max(...frame.map(([x,y])=>Math.hypot(x-cx,y-cy)));
  controls.target.set(cx, cy, 2.2);
  camera.position.set(cx + 39 * Math.sin(bearing), cy - 39 * Math.cos(bearing), 21);
  camera.zoom = Math.min((camera.right-camera.left)/(span+16), (camera.top-camera.bottom)/30);
  camera.updateProjectionMatrix();
  controls.update();
}

export function focusFutureGarden(THREE, camera, controls, lot) {
  const perimeter = lot.lawn.flatMap(([outer]) => outer);
  const xs = perimeter.map(p => p[0]), ys = perimeter.map(p => p[1]);
  frameNeighborhood(THREE, camera, controls, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
}

export function addScenarioTrees(THREE, scene, vegetation, moves = [], terrain) {
  const observed = new THREE.Group(), original = new THREE.Group(), proposed = new THREE.Group();
  const byId = new Map(moves.map(move => [move.id, move]));
  const moving = vegetation.trees.filter(t => byId.has(t.id));
  const stationary = vegetation.trees.filter(t => !byId.has(t.id));
  observed.name = 'Drzewa i słupy według pomiarów GUGiK';
  original.name = 'Zadrzewienie przed zabudową';
  proposed.name = 'Proponowane położenie drzew';
  addNeighborhoodTrees(THREE, observed, {...vegetation, trees:stationary},terrain);
  addNeighborhoodTrees(THREE, original, {trees:moving, otherHighObjects:[]},terrain);
  addNeighborhoodTrees(THREE, proposed, {trees:moving.map(t => ({...t, x:byId.get(t.id).x, y:byId.get(t.id).y})), otherHighObjects:[]},terrain);
  observed.add(original, proposed);
  scene.add(observed);
  function setScenario(active) {
    original.visible = !active;
    proposed.visible = active;
  }
  setScenario(true);
  return {group:observed, original, proposed, setScenario};
}
