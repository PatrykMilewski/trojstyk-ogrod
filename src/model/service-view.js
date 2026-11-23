// The floor selector isolates buried networks which would overlap in a roof plan.
export function bindIconServiceView({THREE,interior,indoor,rain,wastewater,camera,controls,walk,refresh}) {
  const button=document.getElementById('installations');
  const panel=document.getElementById('installation-note');
  const system=document.getElementById('service-system');
  const floor=document.getElementById('service-floor');
  const key=document.getElementById('service-key');
  const legend={
    all:'Koralowy – podłogówka · fioletowy – pompa · niebieski, czerwony i malinowy – woda · ochra – ścieki · turkus – deszczówka · zielony – Ethernet · złoty – obwody elektryczne AC',
    underfloor:'Każdy kolor oznacza jedną pętlę od zasilania do powrotu. Spiżarnia ma własną pętlę. Belki rozdzielaczy: koralowa – zasilanie, bursztynowa – powrót.',
    'heat-pump':'Fiolet – zasilanie i powrót · grafit – przewód elektryczny',
    water:'Niebieski – zimna woda · czerwony – ciepła woda · malinowy – powrót cyrkulacji CWU',
    sewer:'Ochra – odpływy do oczyszczalni · turkus przy zbiorniku – odpływ po oczyszczeniu',
    ethernet:'Zielony – gniazda RJ45 w sześciu pokojach i garażu · żółty – rezerwa PoE na dachu · porty PoE 9 i 10 zasilają stację przy furtce i monitor w wiatrołapie · wszystkie przewody wracają do szafy w kotłowni',
    power:'Złoty – zasilanie AC z rozdzielnicy: falownik, wallbox przy rowerach, zmywarka, brama, sterownik i napęd BioDisc, pompa ciepła, pompa ogrodowa, oprawy przy elewacji i lampy wiszące na tarasie · koralowy i szaroniebieski – magazyn DC · grafit – przewód zmywarki i zasilanie switcha PoE',
    rain:'Dwa spusty SW zasilają zagłębiony ogród deszczowy przy garażu. Osobny układ od strony /190 zbiera wodę do zbiornika z pompą. Jego przelew zasila dwa pola pod trawnikiem.'
  };
  const floors=createHeatingInspectionFloors(THREE,interior,indoor);
  const updateHeatingPipes=heatingInspectionPipes(THREE,indoor,floors);
  let active=false,pendingFrame=false;
  function walkStart(){
    return active&&system.value==='underfloor'?floors[floor.value]?.view:undefined;
  }
  function focusWalkFloor(){
    const view=walkStart();
    if(!view)return;
    const state=walk.getState(),source=floors[floor.value].source;
    source.updateWorldMatrix(true,false);
    const eye=new THREE.Vector3(...state.position);
    const down=new THREE.Raycaster(eye,new THREE.Vector3(0,0,-1));
    if(Math.abs(state.floorHeightM-view.position[2])<.05&&down.intersectObject(source,false).length)return;
    walk.enter(view.position,view.target.map((v,i)=>v-view.position[i]));
    walk.look(0,view.pitch);
  }
  function update(frame) {
    const choice=system.value,level=floor.value,all=choice==='all';
    const walking=walk.getState().active,heating=active&&choice==='underfloor';
    updateHeatingPipes(heating,walking);
    const exterior=level==='both'||level==='ground';
    const groundSystem=choice==='heat-pump'||choice==='power';
    floor.parentElement.hidden=choice==='rain'||groundSystem;
    indoor.visible=active && choice!=='rain';
    const layers=[];
    for(const category of indoor.children){
      category.visible=active && (all||category.name===choice);
      for(const storey of category.children){
        storey.visible=groundSystem?storey.userData.level==='ground':level==='both'||storey.userData.level===level;
        const backdrop=storey.getObjectByName('service-floor-backdrop-'+storey.userData.level);
        if(backdrop)backdrop.visible=category.visible&&choice==='ethernet'&&level!=='both'&&storey.visible;
        if(category.visible&&storey.visible)layers.push(storey);
      }
    }
    wastewater.visible=active && (all||choice==='sewer') && exterior;
    rain.visible=active && (choice==='rain'||(all&&level==='both'));
    if(wastewater.visible)layers.push(wastewater);
    if(rain.visible)layers.push(rain);
    key.textContent=legend[choice];
    for(const [id,{plan}] of Object.entries(floors))plan.visible=active&&!walking&&choice==='underfloor'&&id===level;
    if(active&&frame&&layers.length){
      pendingFrame=walking;
      if(walking)focusWalkFloor();
      else frameIconServices(THREE,layers,camera,controls,choice);
    }
    if(!active)pendingFrame=false;
    refresh();
  }
  button.addEventListener('click',()=>{
    active=!active;panel.hidden=!active;
    button.setAttribute('aria-pressed',String(active));
    update(active);
  });
  for(const input of [system,floor])input.addEventListener('change',()=>update(true));
  update(false);
  return {walkStart,cameraChanged(){update(pendingFrame&&!walk.getState().active);}};
}

function heatingInspectionPipes(THREE,indoor,floors){
  const pipes=[],palettes=new Map(),guides=[];
  indoor.getObjectByName('underfloor').traverse(mesh=>{
    if(mesh.isLineSegments)guides.push(mesh);
    if(!mesh.userData.from)return;
    const color=mesh.userData.loopColor,key=color??mesh.material.uuid;
    if(!palettes.has(key)){
      const plan=color?mesh.material.clone():mesh.material;
      if(color)plan.color.set(color);
      const walk=plan.clone();
      walk.depthTest=true;
      palettes.set(key,{plan,walk});
    }
    pipes.push({mesh,normal:mesh.material,geometry:mesh.geometry,palette:palettes.get(key),
      floorZ:floors[mesh.parent.userData.level].view.position[2]});
  });
  return (heating,walking)=>{
    for(const guide of guides)guide.visible=!(heating&&walking);
    for(const pipe of pipes){
      const {mesh,palette}=pipe;
      if(heating&&walking){
        pipe.surface??=heatingWalkProjection(pipe.geometry,pipe.floorZ);
        mesh.geometry=pipe.surface;mesh.material=palette.walk;
      }else{
        mesh.geometry=pipe.geometry;mesh.material=heating?palette.plan:pipe.normal;
      }
    }
  };
}

// Lift buried tube cross-sections against the finished floor for the walk-camera overlay.
function heatingWalkProjection(geometry,floorZ){
  const surface=geometry.clone(),positions=surface.getAttribute('position');
  for(let start=0;start<positions.count;start+=8){
    const centerZ=(positions.getZ(start)+positions.getZ(start+4))/2;
    const lift=Math.max(0,floorZ+.044-centerZ);
    for(let i=start;i<start+8;i++)positions.setZ(i,positions.getZ(i)+lift);
  }
  surface.computeBoundingSphere();
  surface.computeBoundingBox();
  return surface;
}

function createHeatingInspectionFloors(THREE,interior,indoor){
  const floors={};
  for(const [level,base,hall] of [['ground','ground-floor','0.5'],['upper','upper-oak-finish','1.4']]){
    const source=interior.group.getObjectByName(base),plan=new THREE.Group();
    plan.name='heating-floor-plan-'+level;
    const hallway=interior.rooms.find(room=>room.id===hall);
    const [w,s,e,n]=hallway.box;
    const x=(w+(level==='upper'?hallway.outline[1][0]:e))/2,y=(s+n)/2;
    const z=level==='ground'?0:source.position.z;
    const position=interior.localToWorld([x,y,z]);
    const target=interior.localToWorld([e-w>n-s?e:x,e-w>n-s?y:n,z]);
    floors[level]={source,plan,view:{position,target,pitch:-.67}};
    const tiles=interior.rooms.filter(r=>r.finish==='tile'&&r.id[0]===hall[0]).map(r=>'finish-'+r.id);
    const names=[base,...tiles,...(level==='ground'?['entry-mitred-tile-border']:[])];
    for(const name of names){
      const finish=interior.group.getObjectByName(name),material=finish.material;
      const preview=new THREE.Mesh(finish.geometry,new THREE.MeshBasicMaterial({
        color:material.color,map:material.map,side:THREE.FrontSide,transparent:true,
        depthTest:false,depthWrite:false,toneMapped:false
      }));
      finish.updateMatrix();
      preview.applyMatrix4(finish.matrix);
      preview.name='heating-plan-'+name;
      preview.renderOrder=name===base?226:name.startsWith('finish-')?227:228;
      preview.raycast=()=>{};
      plan.add(preview);
    }
    indoor.getObjectByName('underfloor-'+level).add(plan);
  }
  return floors;
}

function frameIconServices(THREE,layers,camera,controls,choice) {
  const bounds=new THREE.Box3();
  for(const layer of layers){
    layer.updateWorldMatrix(true,true);
    bounds.expandByObject(layer);
  }
  if(bounds.isEmpty())return;
  const center=bounds.getCenter(new THREE.Vector3()),span=bounds.getSize(new THREE.Vector3());
  const plan=['underfloor','water','sewer','ethernet','power'].includes(choice);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(0,plan?-.8:-28,plan?65:52));
  const height=plan?span.y:span.y*.89+span.z*.48;
  camera.zoom=Math.min((camera.right-camera.left)/(span.x+4),(camera.top-camera.bottom)/(height+5));
  camera.updateProjectionMatrix();controls.update();
}
