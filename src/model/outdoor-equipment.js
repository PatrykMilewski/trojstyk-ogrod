export function createOutdoorEquipment({THREE, addMesh, beam, box, cylinder, mat, mats, sphere}) {
  const steel = mat('#434b4b', {metalness:.63, roughness:.42});
  const bright = mat('#acb0a9', {metalness:.78, roughness:.31});
  const enamel = mat('#29322e', {metalness:.44, roughness:.34});
  const rope = mat('#b8a781', {roughness:.98});
  const endGrain = mat('#a18361');
  const ash = mat('#4b4641');
  const char = mat('#352a24');
  const redBoards = ['#9b342a','#aa3b2f','#a3372c','#963326'].map(c=>mat(c));
  const holds = ['#a96644','#788956','#bc9d58','#9b7057'].map(c=>mat(c));

  function lathe(g, profile, material, segments=64) {
    const geo = new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),segments);
    geo.rotateX(Math.PI/2);
    return addMesh(geo,material,g);
  }

  function grill(g,w,d,h) {
    const wide=w>2, left=wide?-w/2-.03:-.99, right=wide?w/2+.03:.8;
    const span=right-left, center=(right+left)/2, top=d+.06, front=-d/2+.035;
    // A recessed plinth, open wood store and louvred cabinet carry the countertop.
    box(center,0,0,span-.18,d-.14,.075,enamel,0,g);
    box(center,0,.075,span-.13,d-.10,.065,mats.concrete,0,g);
    box(center,d/2-.09,.14,span-.13,.09,h-.21,mats.concrete,0,g);
    for(const x of [left+.095,center+.055,right-.095])
      box(x,0,.14,.10,d-.08,h-.21,mats.concrete,0,g);
    const cabX=(center+right)/2, cabW=span/2-.18;
    box(cabX,front+.02,.16,cabW,.04,h-.28,enamel,0,g);
    for(let i=0;i<10;i++)
      box(cabX,front,.17+i*(h-.31)/10,cabW-.026,.024,(h-.31)/10-.009,mats.wood,0,g);
    beam([cabX-.12,front-.026,h-.22],[cabX+.12,front-.026,h-.22],.012,bright,g);
    for(let i=0;i<6;i++){
      const x=left+.18+(i%3)*.13,z=.208+Math.floor(i/3)*.112;
      beam([x,-.17,z],[x+.022,.16,z+.012],.061,i%2?mats.wood:endGrain,g);
    }
    const cookLeft=left+.04, cookRight=wide?-.11:left+.84;
    const cookCenter=(cookLeft+cookRight)/2, cookW=cookRight-cookLeft;
    // Side slabs and the narrow front/back rails leave the cooking well open.
    box((cookRight+right)/2,0,h-.07,right-cookRight,top,.09,mats.frame,0,g);
    box((left+cookLeft)/2,0,h-.07,cookLeft-left,top,.09,mats.frame,0,g);
    for(const y of [-1,1])box(cookCenter,y*(top/2-.055),h-.07,cookW,.11,.09,mats.frame,0,g);
    box(cookCenter,0,h-.12,cookW,.49,.045,enamel,0,g);
    for(let i=0;i<12;i++){
      const x=cookLeft+.04+i*(cookW-.08)/11;
      beam([x,-.22,h+.03],[x,.2,h+.03],.009,bright,g);
      sphere(x,.015*Math.cos(i),h-.047,.032,char,[1,.85,.65],g);
    }
    // Curved splash lid stands open behind the grate.
    const profile=new THREE.Shape();
    profile.moveTo(.155,h+.024);profile.quadraticCurveTo(.245,h+.15,.17,h+.32);
    profile.lineTo(.143,h+.32);profile.quadraticCurveTo(.202,h+.16,.135,h+.024);profile.closePath();
    const lidGeo=new THREE.ExtrudeGeometry(profile,{depth:cookW,bevelEnabled:false,curveSegments:12});
    lidGeo.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)));
    const lid=addMesh(lidGeo,enamel,g);lid.position.x=cookLeft;
    for(const x of [cookLeft+.04,cookRight-.04])
      beam([x,.17,h+.245],[x,.107,h+.247],.012,bright,g);
    beam([cookLeft+.04,.107,h+.247],[cookRight-.04,.107,h+.247],.016,bright,g);
    for(let i=0;i<3;i++){
      const x=cookLeft+.12+i*.17;
      beam([x,-top/2+.035,h-.035],[x,-top/2+.007,h-.035],.029,bright,g);
    }
  }

  function firepit(g,r,depth) {
    const rim=.4+r*.5, bottom=rim-depth;
    for(let i=0;i<3;i++){
      const a=i*2*Math.PI/3, dx=Math.cos(a),dy=Math.sin(a);
      beam([dx*r*.70,dy*r*.70,.121],[dx*r*.43,dy*r*.43,bottom+.054],.021,steel,g);
      cylinder(dx*r*.70,dy*r*.70,.10,.033,.022,steel,g);
    }
    lathe(g,[[.002,bottom],[r*.34,bottom+.025],[r*.59,bottom+.087],[r*.82,bottom+.19],[r,rim-.011],
      [r,rim],[r-.014,rim],[r*.8,bottom+.206],[r*.56,bottom+.108],[r*.31,bottom+.05],[.002,bottom+.032]],enamel);
    cylinder(0,0,bottom+.049,r*.31,.013,ash,g);
    for(let i=0;i<5;i++){
      const a=i*1.19, x=Math.cos(a)*r*.46,y=Math.sin(a)*r*.46,z=bottom+.082+i*.018;
      beam([-x,-y,z],[x,y,z+.026],.047,i%2?char:mats.wood,g);
      beam([x*.87,y*.87,z+.023],[x*1.004,y*1.004,z+.026],.043,i%2?ash:endGrain,g);
    }
  }

  function saunaCladding(g,w,d) {
    const boards=new THREE.Group();g.add(boards);
    for(let i=0;i<24;i++){
      const bw=w/24,x=-w/2+(i+.5)*bw,color=redBoards[i%4];
      box(x,-d/2-.011,0,bw-.005,.022,2,color,0,boards);
      if(Math.abs(x)>1.02)box(x,d/2-.002,0,bw-.005,.024,2,color,0,boards);
      else {
        box(x,d/2-.002,0,bw-.005,.024,.4,color,0,boards);
        box(x,d/2-.002,1.8,bw-.005,.024,.2,color,0,boards);
      }
    }
    const ranges=[[-d/2,-.4,7],[-.4,0,3],[0,.4,3],[.4,d/2,7]];
    for(const [start,end,count] of ranges)for(let i=0;i<count;i++){
      const bw=(end-start)/count,y0=start+i*bw+.0025,y1=y0+bw-.005;
      for(const side of [-1,1]){
        const bottom=side<0&&start>=-.4&&end<=.4?1.90:0;
        const top=y=>2+d/2-Math.abs(y);
        const geo=new THREE.BufferGeometry(),positions=[];
        for(const x of [side*(w/2-.018),side*w/2])
          positions.push(x,y0,bottom,x,y1,bottom,x,y1,top(y1),x,y0,top(y0));
        geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        const faces=[0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
        if(side<0)faces.reverse();
        geo.setIndex(faces);
        geo.computeVertexNormals();addMesh(geo,redBoards[(i+2)%4],boards);
      }
    }
  }

  function tub(g,w,h) {
    const r=w/2;
    lathe(g,[[r-.04,.01],[r-.012,.035],[r-.012,h-.025],[r-.10,h-.025],[r-.11,.07]],mats.wood,64);
    cylinder(0,0,0,r-.035,.06,mats.wood,g);
    for(let i=0;i<40;i++){
      const a=i*Math.PI/20;
      box(Math.cos(a)*(r-.007),Math.sin(a)*(r-.007),.036,.016,r*.151,h-.09,i%4===1?endGrain:mats.wood,a,g);
    }
    for(const z of [.16,h-.24])lathe(g,[[r+.003,z],[r+.006,z+.004],[r+.006,z+.041],[r+.003,z+.045]],steel,64);
    const rim=addMesh(new THREE.TorusGeometry(r-.05,.07,12,64),mats.wood,g);rim.position.z=h;
    const water=cylinder(0,0,h-.10,r-.105,.012,mat('#237fce',{metalness:.12,roughness:.16}),g);
    water.name='hot-tub-blue-water';
    for(let i=0;i<4;i++){
      const wave=addMesh(new THREE.TorusGeometry(.055+i*.057,.0017,4,36,Math.PI*1.47),mat('#67a7c4'),g);
      wave.position.set(.30,-.22,h-.087);wave.rotation.z=i*.6;wave.scale.y=.62;
    }
  }

  function trampolineNet(g,r) {
    // Individual cords share one line geometry. Leave a zippered access slit on the south side.
    const vertices=[],cols=96,rows=16,point=(a,z)=>[Math.cos(a)*r,Math.sin(a)*r,z];
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const a=-Math.PI/2+i*2*Math.PI/cols, z=.052+j*.09, b=a+2*Math.PI/cols;
      if(i===0)continue;
      vertices.push(...point(a,z),...point(b,z+.09),...point(b,z),...point(a,z+.09));
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const net=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#39433e',transparent:true,opacity:.55}));
    net.name='trampoline-woven-net';g.add(net);
    for(const z of [.052,1.495]){
      const tape=addMesh(new THREE.TorusGeometry(r-.007,.007,6,96),enamel,g);tape.position.z=z;
    }
    beam([0,-r+.009,.052],[0,-r+.009,1.492],.009,rope,g);
  }

  function playDetails(g,kind,w,d,h) {
    if(kind==='hustawka'){
      for(const x of [-w/2,w/2]){
        beam([x,-d*.31,h*.37],[x,d*.31,h*.37],.037,mats.wood,g);
        for(const s of [-1,1])beam([x-s*.001,s*.028,h-.095],[x*.81,s*.028,h-.01],.028,steel,g);
      }
      for(const x of [-.28,.28]){
        beam([x,.05,.51],[x,-.10,.53],.015,rope,g);
        beam([x,.05,.51],[x,.18,.53],.015,rope,g);
        beam([x,.025,1.06],[x,-.10,.53],.009,rope,g);
        beam([x,.025,1.06],[x,.18,.53],.009,rope,g);
        const hanger=addMesh(new THREE.TorusGeometry(.035,.009,6,12),bright,g);
        hanger.rotation.x=Math.PI/2;hanger.position.set(x,0,h-.042);
      }
    }else if(kind==='drabinka'){
      for(const sy of [-1,1])for(const sx of [-1,1]){
        beam([sx*w/2,sy*d/2,h-.38],[sx*w/2,sy*(d/2-.36),h-.04],.026,mats.wood,g);
        cylinder(sx*w/2,sy*d/2,.015,.048,.22,steel,g);
      }
    }else if(kind==='drazki'){
      for(const x of [-w/2,0,w/2]){
        cylinder(x,0,.012,.044,.16,steel,g);
        for(const z of [h*.7-.035,h-.052])cylinder(x,0,z,.044,.028,bright,g);
      }
      for(const [cx,z] of [[-w/4,h],[w/4,h*.7]])
        for(const dx of [-.19,.19])beam([cx+dx-.085,0,z],[cx+dx+.085,0,z],.025,enamel,g);
    }else if(kind==='siatka'){
      for(let x=-w/2+.25;x<w/2;x+=.25)for(let z=.1;z<=h;z+=.25)
        sphere(x,0,z,.019,rope,[1,.85,1.16],g);
      for(const x of [-w/2,w/2])for(const z of [.1,h-.085])
        cylinder(x,0,z,.049,.038,steel,g);
    }
  }

  function climbingWall(g,w,h){
    // Each rounded hold is placed within the original 61 mm projection on the panel face.
    for(let i=0;i<10;i++)box(-w/2+(i+.5)*w/10,0,0,w/10-.004,.114,h,mats.wood,0,g);
    for(const x of [-w/2+.023,w/2-.023])box(x,0,0,.046,.12,h,mats.wood,0,g);
    for(let i=0;i<15;i++){
      const row=Math.floor(i/5), col=i%5;
      const x=(col-2)*.345+.045*Math.sin(i*2.4),z=.20+row*.397+.087*Math.cos(i*1.7);
      const hold=sphere(x,.085,z,.06,holds[i%4],[1.18,.6,.79],g);
      hold.rotation.y=.45*Math.sin(i*1.7);
      beam([x,.115,z],[x,.120,z],.008,steel,g);
    }
  }
  return {grill,firepit,saunaCladding,tub,trampolineNet,playDetails,climbingWall,rope};
}
