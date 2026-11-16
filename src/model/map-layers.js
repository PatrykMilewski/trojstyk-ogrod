function mapTexture(THREE, url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      resolve(texture);
    }, undefined, reject);
  });
}

async function mapPlane({THREE, scene, asset, bounds, z, transparent = false, unlit = false, requestDraw}) {
  const texture = await mapTexture(THREE, asset);
  const Material = transparent || unlit ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
  const material = new Material({map: texture, transparent, depthWrite: !transparent, depthTest: !transparent,
    side: THREE.DoubleSide, ...(transparent || unlit ? {toneMapped: false} : {roughness: 1})});
  const [left, bottom, right, top] = bounds;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(right-left, top-bottom), material);
  mesh.position.set((left+right)/2, (bottom+top)/2, z);
  mesh.receiveShadow = !transparent;
  mesh.name = 'map-overlay';
  scene.add(mesh);
  requestDraw();
  return mesh;
}

function utilityCircle(THREE, scene, center, radius) {
  const points = Array.from({length: 129}, (_, i) => {
    const a = i/128*Math.PI*2;
    return new THREE.Vector3(center[0]+Math.cos(a)*radius, center[1]+Math.sin(a)*radius, .16);
  });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({color: '#884d77', dashSize: 1.8, gapSize: 1.2}));
  line.computeLineDistances();
  line.name = 'utilities-150m-boundary';
  scene.add(line);
  return line;
}

function mapControls(container, apply, focus, metadata) {
  container.innerHTML = `<h2>Mapy otoczenia</h2>
    <label class="map-select">Podkład<select id="map-background"><option value="ortho">Ortofotomapa GUGiK</option><option value="height">Wysokości NMT — barwy</option><option value="none">Bez podkładu</option></select></label>
    <div class="map-checks"><label><input id="map-water" type="checkbox"> <span class="water-key">Woda</span></label><label><input id="map-electricity" type="checkbox"> <span class="electricity-key">Prąd</span></label></div>
    <p class="map-note">Media: urzędowy obraz WMS, promień 150 m od styku działek. Brak linii nie potwierdza braku sieci. Linie nie oznaczają głębokości przewodów.</p>
    <div id="height-key" hidden><span class="height-gradient"></span><span id="height-range"></span><p class="map-note">NMT, siatka 1 m. Barwy wysokości bez zmiany płaskiej geometrii sceny.</p></div>
    <button id="map-focus" type="button">Pokaż otoczenie 150 m</button>
    <p class="map-note">Ortofotomapa: GUGiK / Geoportal (indeks 2024 w centrum). Cienie na zdjęciu są stałe. Media: Starosta Kartuski. <a href="map-sources.json" target="_blank" rel="noopener">Źródła i daty danych</a>.</p>`;
  const background = container.querySelector('#map-background');
  const water = container.querySelector('#map-water'), electricity = container.querySelector('#map-electricity');
  const legend = container.querySelector('#height-key');
  container.querySelector('#height-range').textContent = metadata.heightRangeLabel;
  const update = () => {
    legend.hidden = background.value !== 'height';
    apply({background: background.value, water: water.checked, electricity: electricity.checked});
  };
  for (const input of [background, water, electricity]) input.addEventListener('change', update);
  container.querySelector('#map-focus').addEventListener('click', focus);
  update();
  return next => {
    background.value = next.background; water.checked = next.water; electricity.checked = next.electricity;
    legend.hidden = next.background !== 'height';
  };
}

function plainMapGround(THREE, scene, bounds) {
  const [left, bottom, right, top] = bounds;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(right-left, top-bottom),
    new THREE.MeshStandardMaterial({color:'#bec7a5',roughness:1,side:THREE.DoubleSide}));
  ground.position.set((left+right)/2,(bottom+top)/2,-.018);
  ground.name='plain-surrounding-ground'; ground.receiveShadow=true; scene.add(ground);
  return ground;
}

async function setupMapLayers({THREE, scene, requestDraw, container, camera, controls, data, onChange = () => {}}) {
  const shared = {THREE, scene, requestDraw};
  const [ortho, height, water, electricity] = await Promise.all([
    mapPlane({...shared, asset: data.assets.ortho, bounds: data.orthoBounds, z: -.015}),
    mapPlane({...shared, asset: data.assets.height, bounds: data.orthoBounds, z: .025, unlit: true}),
    mapPlane({...shared, asset: data.assets.water, bounds: data.utilityBounds, z: .14, transparent: true}),
    mapPlane({...shared, asset: data.assets.electricity, bounds: data.utilityBounds, z: .145, transparent: true}),
  ]);
  const boundary = utilityCircle(THREE, scene, data.utilityCenter, data.utilityRadiusM);
  const plain = plainMapGround(THREE, scene, data.orthoBounds);
  let state, syncControls;
  function apply(next) {
    state = {...state,...next}; next=state;
    plain.visible = next.background === 'none';
    ortho.visible = next.background === 'ortho'; height.visible = next.background === 'height';
    water.visible = next.water; electricity.visible = next.electricity;
    boundary.visible = next.water || next.electricity;
    for (const id of ['41', '192']) scene.getObjectByName('context-grass-'+id).visible = next.background === 'none';
    if (syncControls) syncControls(state);
    onChange(state);
    requestDraw();
  }
  function focus() {
    const [x,y] = data.utilityCenter;
    controls.target.set(x,y,0); camera.position.set(x,y-.001,350);
    camera.zoom = Math.min((camera.right-camera.left)/(data.utilityRadiusM*2+25),(camera.top-camera.bottom)/(data.utilityRadiusM*2+25));
    camera.updateProjectionMatrix(); controls.update(); requestDraw();
  }
  syncControls = mapControls(container, apply, focus, data);
  return {getState: () => ({...state}), setState: apply, focus, meshes: {ortho,height,water,electricity,boundary,plain}};
}
