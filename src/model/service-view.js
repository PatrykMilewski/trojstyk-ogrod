// The floor selector isolates buried networks which would overlap in a roof plan.
export function bindIconServiceView({THREE,indoor,rain,wastewater,camera,controls,walk,refresh}) {
  const button=document.getElementById('installations');
  const panel=document.getElementById('installation-note');
  const system=document.getElementById('service-system');
  const floor=document.getElementById('service-floor');
  const key=document.getElementById('service-key');
  const legend={
    all:'Koralowy – podłogówka · fioletowy – pompa · niebieski, czerwony i malinowy – woda · ochra – ścieki · turkus – deszczówka · zielony – Ethernet · złoty – obwody elektryczne AC',
    underfloor:'Koralowy – pętle grzewcze · bursztynowy – powroty',
    'heat-pump':'Fiolet – zasilanie i powrót · grafit – przewód elektryczny',
    water:'Niebieski – zimna woda · czerwony – ciepła woda · malinowy – powrót cyrkulacji CWU',
    sewer:'Ochra – odpływy do oczyszczalni · turkus przy zbiorniku – odpływ po oczyszczeniu',
    ethernet:'Zielony – gniazda RJ45 w sześciu pokojach i garażu · żółty – rezerwa PoE na dachu · wszystkie przewody wracają do szafy w kotłowni',
    power:'Złoty – zasilanie AC z rozdzielnicy: falownik, wallbox przy rowerach, zmywarka, brama, sterownik i napęd BioDisc, pompa ciepła, pompa ogrodowa, oprawy przy elewacji i lampy wiszące na tarasie · koralowy i szaroniebieski – magazyn DC · grafit – przewód zmywarki',
    rain:'Dwa spusty SW zasilają zagłębiony ogród deszczowy przy garażu. Osobny układ od strony /190 zbiera wodę do zbiornika z pompą. Jego przelew zasila dwa pola pod trawnikiem.'
  };
  let active=false;
  function update(frame) {
    const choice=system.value,level=floor.value,all=choice==='all';
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
        if(backdrop)backdrop.visible=['underfloor','ethernet'].includes(choice)&&level!=='both'&&storey.visible;
        if(category.visible&&storey.visible)layers.push(storey);
      }
    }
    wastewater.visible=active && (all||choice==='sewer') && exterior;
    rain.visible=active && (choice==='rain'||(all&&level==='both'));
    if(wastewater.visible)layers.push(wastewater);
    if(rain.visible)layers.push(rain);
    key.textContent=legend[choice];
    if(active&&frame&&layers.length)frameIconServices(THREE,layers,camera,controls,choice);
    refresh();
  }
  button.addEventListener('click',()=>{
    active=!active;panel.hidden=!active;
    button.setAttribute('aria-pressed',String(active));
    if(active)walk.exit();
    update(active);
  });
  for(const input of [system,floor])input.addEventListener('change',()=>update(true));
  update(false);
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
