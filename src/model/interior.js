export function addIconInterior(options) {
 const context = iconInteriorSetup(options);
 iconInteriorFloorsAndPartitions(context);
 iconInteriorFacades(context);
 iconInteriorStairs(context);
 iconInteriorFurnishings(context);
 iconInteriorLightingAndRoof(context);
 const {group,navigation,data,world} = context;
 return {group,navigation,rooms:data.rooms,metadata:data.metadata,localToWorld:world};
}

const iconInteriorContains = (p,r)=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};

function iconInteriorSetup({THREE,scene,house,data}) {
 const group = new THREE.Group(); group.name = 'icon-193-interior';
 const md = house.metadata, M = md.matrix, t = md.translation;
 group.matrixAutoUpdate = false;
 group.matrix.set(-M[0][0],M[0][1],0,M[0][0]*14.64+t[0],-M[1][0],M[1][1],0,M[1][0]*14.64+t[1],0,0,1,0,0,0,0,1);
 scene.add(group);
 const world = p => [M[0][0]*(14.64-p[0])+M[0][1]*p[1]+t[0],M[1][0]*(14.64-p[0])+M[1][1]*p[1]+t[1],p[2]||0];
 const ring = b => [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]];
 const navigation = {obstacles:[],floors:[],ramps:[],entry:world([data.entry.position[0],data.entry.position[1]+.59,0]),entryDirection:[M[0][1],M[1][1]]};
 const material = (color,extra={}) => new THREE.MeshStandardMaterial({color,roughness:.78,side:THREE.DoubleSide,...extra});
 const mats = {wall:material('#e9e3d7'),ceiling:material('#ede8de'),oak:material('#b4936e'),tile:material('#bfb9ac'),dark:material('#343b35'),wood:material('#8a684b'),linen:material('#d9d0bd'),sofa:material('#c2bda9'),counter:material('#d1c8b7'),white:material('#f1ede5'),metal:material('#2f3534',{metalness:.45,roughness:.35}),glass:material('#b9d1ce',{transparent:true,opacity:.16,depthWrite:false,roughness:.08}),rug:material('#a99e86'),lamp:material('#fff0cd',{emissive:'#ffdf99',emissiveIntensity:.7})};
 const mesh = (geometry,mat,name) => {const m=new THREE.Mesh(geometry,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const box = (name,b,z,h,mat=mats.wood) => {const m=mesh(new THREE.BoxGeometry(b[2]-b[0],b[3]-b[1],h),mat,name);m.position.set((b[0]+b[2])/2,(b[1]+b[3])/2,z+h/2);return m;};
 const obstacle = (id,b,minZ,maxZ) => navigation.obstacles.push({id,ring:ring(b).map(p=>world(p).slice(0,2)),minZ,maxZ});
 const floor = (id,b,z) => navigation.floors.push({id,ring:ring(b).map(p=>world(p).slice(0,2)),z});
 const path = points => new THREE.Path(points.map(p=>new THREE.Vector2(...p)));
 const slab = (id,outline,holes,z,depth,mat) => {const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));shape.holes=holes.map(path);const m=mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),mat,id);m.position.z=z;return m;};
 const beam = (id,a,b,r=.025,mat=mats.metal) => {const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),8),mat,id);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;};
 const rail = (id,a,b,z) => {beam(id+'-top',[...a,z+1.05],[...b,z+1.05]);const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(length/.55));for(let i=0;i<=count;i++){const s=i/count,p=[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s];beam(id+'-post-'+i,[...p,z],[...p,z+1.05],.017);}obstacle(id,[Math.min(a[0],b[0])-.04,Math.min(a[1],b[1])-.04,Math.max(a[0],b[0])+.04,Math.max(a[1],b[1])+.04],z,z+1.1);};
 const wall = (id,a,b,z0,z1,thickness,openings=[],profile=null) => {
  const external=id.startsWith('facade-')||id.startsWith('upper-')||id.endsWith('-gable');
  let nx=0,ny=0;if(external){if(Math.abs(a[0]-b[0])<.01)nx=a[0]<.1?-1:1;else ny=a[1]<5?-1:1;a=[a[0]-nx*thickness/2,a[1]-ny*thickness/2];b=[b[0]-nx*thickness/2,b[1]-ny*thickness/2];}
  const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
  const shape=new THREE.Shape((profile||[[0,z0],[L,z0],[L,z1],[0,z1]]).map(p=>new THREE.Vector2(...p)));
  shape.holes=openings.map(o=>path(o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]]));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}),pos=geometry.getAttribute('position');
  for(let i=0;i<pos.count;i++){const u=pos.getX(i),h=pos.getY(i),d=pos.getZ(i)-thickness/2;pos.setXYZ(i,a[0]+ux*u-uy*d,a[1]+uy*u+ux*d,h);}if(id.startsWith('u-'))for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),main=8.3-(8.3-4.07)/4.25*Math.abs(x-4.25),wing=8.3-(8.3-4.07)/4.25*Math.abs(y-8.46),roof=Math.max(x<=8.5?main:-Infinity,y>=4.21&&y<=12.71&&x>=4.25?wing:-Infinity);pos.setZ(i,Math.min(pos.getZ(i),roof-.25));}
  geometry.computeVertexNormals();mesh(geometry,mats.wall,id);
  if(id.startsWith('facade-')||id.startsWith('upper-')||id.endsWith('-gable')){
   const shell=new THREE.ShapeGeometry(shape),sp=shell.getAttribute('position');

   for(let i=0;i<sp.count;i++){const u=sp.getX(i),h=sp.getY(i);sp.setXYZ(i,a[0]+ux*u+nx*(thickness/2+.003),a[1]+uy*u+ny*(thickness/2+.003),h);}shell.computeVertexNormals();mesh(shell,mats.dark,id+'-charred-exterior');
  }
  const cuts=[0,L,...openings.flatMap(o=>[o.start,o.end])].sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){const start=cuts[i-1],end=cuts[i];if(end-start<.001)continue;const opening=openings.find(o=>(start+end)/2>o.start&&(start+end)/2<o.end);const ax=a[0]+ux*start,ay=a[1]+uy*start,bx=a[0]+ux*end,by=a[1]+uy*end,bounds=[Math.min(ax,bx)-Math.abs(uy)*thickness/2,Math.min(ay,by)-Math.abs(ux)*thickness/2,Math.max(ax,bx)+Math.abs(uy)*thickness/2,Math.max(ay,by)+Math.abs(ux)*thickness/2];
   if(!opening)obstacle(id+'-'+i,bounds,z0,z1);else{if(opening.bottom>z0+.01)obstacle(id+'-sill-'+i,bounds,z0,opening.bottom);if(opening.top<z1-.01)obstacle(id+'-header-'+i,bounds,opening.top,z1);}
  }
  for(const [i,o] of openings.entries()){
   const points=o.poly||[[o.start,o.bottom],[o.end,o.bottom],[o.end,o.top],[o.start,o.top]],to3=p=>[a[0]+ux*p[0],a[1]+uy*p[0],p[1]];
   for(let j=0;j<points.length;j++)beam(id+'-opening-'+i+'-frame-'+j,to3(points[j]),to3(points[(j+1)%points.length]),.025,mats.dark);
   if(o.glass){const g=new THREE.ShapeGeometry(new THREE.Shape(points.map(p=>new THREE.Vector2(...p)))),ps=g.getAttribute('position');for(let j=0;j<ps.count;j++){const p=to3([ps.getX(j),ps.getY(j)]);ps.setXYZ(j,...p);}g.computeVertexNormals();mesh(g,mats.glass,id+'-glass-'+i).castShadow=false;
    const mid=(o.start+o.end)/2;if(o.end-o.start>2)beam(id+'-mullion-'+i,to3([mid,o.bottom]),to3([mid,Math.min(o.top,4.0)]),.025,mats.dark);
    obstacle(id+'-glass-barrier-'+i,[Math.min(a[0]+ux*o.start,a[0]+ux*o.end)-.035,Math.min(a[1]+uy*o.start,a[1]+uy*o.end)-.035,Math.max(a[0]+ux*o.start,a[0]+ux*o.end)+.035,Math.max(a[1]+uy*o.start,a[1]+uy*o.end)+.035],o.bottom,o.top);
   }
  }
 };
 const opening = (start,end,bottom=0,top=2.35,glass=true) => ({start,end,bottom,top,glass});
 const contains = iconInteriorContains;
 return {THREE, scene, house, data, group, world, ring, navigation, mats, mesh, box, obstacle, floor, slab, beam, rail, wall, opening, contains};
}

function iconInteriorFloorsAndPartitions(context) {
 const {data, navigation, ring, world, floor, slab, mats, obstacle, wall, opening, contains} = context;
 slab('ground-floor',data.exterior.ground,[],-.12,.12,mats.oak);
 const stairHole=ring(data.stairs.box),livingHole=ring(data.void.box);

 navigation.floors.push({id:'ground',ring:data.exterior.ground.map(p=>world(p).slice(0,2)),z:0});
 const xs=[...new Set([0,.5,7.94,8.5,9.8,14.64])].sort((a,b)=>a-b),ys=[0,4.21,9.23,10.3,12.21,12.71,17.63,18.13];
 for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){const b=[xs[i-1],ys[j-1],xs[i],ys[j]],p=[(b[0]+b[2])/2,(b[1]+b[3])/2];if(contains(p,data.exterior.upper)&&!contains(p,stairHole)&&!contains(p,livingHole)){floor('upper-'+i+'-'+j,b,3.2);slab('upper-slab-'+i+'-'+j,ring(b),[],2.8,.4,mats.ceiling);slab('upper-finish-'+i+'-'+j,ring(b),[],3.2,.015,mats.oak);obstacle('upper-slab-'+i+'-'+j,b,2.8,3.2);navigation.obstacles[navigation.obstacles.length-1].kind='slab';}}
 for(const room of data.rooms){const z=room.id.startsWith('1.')?3.218:.018;if(room.finish==='tile')slab('finish-'+room.id,ring(room.box),[],z,.008,mats.tile);}
 for(const w of data.walls){const z=w.level?3.2:0,top=w.level?5.86:2.8;wall(w.id,w.a,w.b,z,top,w.thickness,w.doors.map(d=>opening(d[0],d[1],z,z+2.1,false)));}
}

function iconInteriorFacades(context) {
 const {wall, opening, box, obstacle, mats, beam} = context;
 wall('facade-garage',[0,0],[6.9,0],0,2.8,.48,[opening(1.06,6.06,0,2.35,false)]);
 box('garage-sectional-door',[1.08,-.05,6.04,.05],0,2.32,mats.dark);obstacle('garage-door',[1.06,-.1,6.06,.1],0,2.35);
 wall('facade-garage-side',[6.9,0],[6.9,4.21],0,2.8,.48);
 wall('facade-front-wing',[6.9,4.21],[14.64,4.21],0,2.8,.48,[opening(0,1,0,2.35,false),opening(1.6,3.6),opening(4.8,6.3)]);
 wall('facade-wing-end',[14.64,4.21],[14.64,12.71],0,2.8,.48,[opening(4.29,4.99),opening(5.25,7.39)]);
 wall('facade-wing-rear',[8.5,12.71],[14.64,12.71],0,2.8,.48);
 wall('facade-terrace',[8.5,12.71],[8.5,17.09],0,2.8,.48,[opening(.29,1.79,0,2.35,true),opening(1.79,3.39,0,2.35,false)]);
 wall('facade-garden',[0,17.09],[8.5,17.09],0,2.8,.48,[opening(.74,7.76,0,2.35,true)]);
 wall('facade-main-side',[0,0],[0,17.09],0,2.8,.48,[opening(10.3,13.3)]);
 // These three walls include the upper gable and its asymmetrical glazing.
 wall('front-gable',[0,0],[8.5,0],2.8,8.3,.36,[{...opening(.9,4.25,3.2,7.25),poly:[[.9,3.2],[4.25,3.2],[4.25,7.25],[.9,3.9]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 wall('garden-gable',[0,18.13],[8.5,18.13],2.8,8.3,.36,[{...opening(.9,7.6,3.2,7.35),poly:[[.9,3.2],[7.6,3.2],[7.6,3.95],[4.25,7.35],[.9,3.95]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 for(const x of [3.1,5.4])beam('garden-upper-triangle-mullion-'+x,[x,18.13-.18,3.2],[x,18.13-.18,7.35-Math.abs(x-4.25)],.025,mats.dark);
 wall('wing-gable',[14.64,4.21],[14.64,12.71],2.8,8.3,.36,[{...opening(4.25,7.39,3.2,7.3),poly:[[4.25,3.2],[7.39,3.2],[7.39,4.15],[4.25,7.3]]}],[[0,2.8],[8.5,2.8],[8.5,4.07],[4.25,8.3],[0,4.07]]);
 for(const [id,a,b] of [['upper-main-side',[0,0],[0,18.13]],['upper-front-wing',[8.5,4.21],[14.64,4.21]],['upper-rear-wing',[8.5,12.71],[14.64,12.71]],['upper-garage-side',[8.5,0],[8.5,4.21]],['upper-terrace-side',[8.5,12.71],[8.5,18.13]]])wall(id,a,b,2.8,4.07,.36);
}

function iconInteriorStairs(context) {
 const {data, box, mats, floor, navigation, world, beam, rail, obstacle} = context;
 const s=data.stairs,[sx,sy,ex,ey]=s.box,run=8*s.tread,half=s.floorHeight/2;
 for(let i=0;i<8;i++){
  box('stair-lower-tread-'+i,[sx,sy+i*s.tread,sx+s.width,sy+(i+1)*s.tread],i*half/9,half/9,mats.oak);
  box('stair-upper-tread-'+i,[ex-s.width,sy+(7-i)*s.tread,ex,sy+(8-i)*s.tread],half+i*half/9,half/9,mats.oak);
 }
 box('stair-lower-riser-9',[sx,sy+run-.015,sx+s.width,sy+run],8*half/9,half/9,mats.oak);
 box('stair-upper-riser-18',[ex-s.width,sy,ex,sy+.015],half+8*half/9,half/9,mats.oak);
 box('stair-landing',[sx,sy+run,ex,ey],half-.15,.15,mats.oak);floor('stair-landing',[sx,sy+run,ex,ey],half);
 navigation.ramps.push({id:'stair-lower',start:world([sx+s.width/2,sy]).slice(0,2),end:world([sx+s.width/2,sy+run]).slice(0,2),width:s.width,z0:0,z1:half},{id:'stair-upper',start:world([ex-s.width/2,sy+run]).slice(0,2),end:world([ex-s.width/2,sy]).slice(0,2),width:s.width,z0:half,z1:3.2});
 for(const [id,x,z0,z1] of [['lower',sx,0,half],['upper',ex,3.2,half]])beam('stair-handrail-'+id,[x,sy,z0+1.02],[x,sy+run,z1+1.02],.025);
 rail('landing-back',[sx,ey],[ex,ey],half);rail('upper-void-edge',[.5,10.3],[7.94,10.3],3.2);rail('upper-stair-edge',[7.94,10.3],[7.94,12.21],3.2);
 obstacle('stair-divider',[sx+s.width,sy,sx+s.width+s.gap,sy+run],0,3.2);
}

function iconInteriorFurnishings(context) {
 const {THREE, box, mats, beam, mesh} = context;
 // Furniture uses simple recognisable parts, leaving doors and circulation clear.
 const chair=(id,x,y,z=0)=>{box(id+'-seat',[x-.22,y-.22,x+.22,y+.22],z+.43,.07,mats.linen);box(id+'-back',[x-.22,y+.17,x+.22,y+.24],z+.5,.42,mats.wood);for(const dx of [-.17,.17])for(const dy of [-.17,.17])box(id+'-leg',[x+dx-.025,y+dy-.025,x+dx+.025,y+dy+.025],z,.43,mats.dark);};
 const table=(id,b,z=0,height=.73)=>{box(id+'-top',b,z+height,.06,mats.wood);for(const x of [b[0]+.12,b[2]-.12])for(const y of [b[1]+.12,b[3]-.12])box(id+'-leg',[x-.04,y-.04,x+.04,y+.04],z,height,mats.dark);};
 const bed=(id,x,y,z,width=1.6)=>{box(id+'-frame',[x,y,x+width,y+2],z+.15,.23,mats.wood);box(id+'-mattress',[x+.04,y+.03,x+width-.04,y+1.98],z+.38,.21,mats.white);box(id+'-duvet',[x+.04,y+.5,x+width-.04,y+1.98],z+.59,.09,mats.linen);for(const dx of [.08,width/2+.03])box(id+'-pillow',[x+dx,y+.1,x+dx+width/2-.12,y+.48],z+.6,.09,mats.white);box(id+'-headboard',[x-.03,y-.09,x+width+.03,y],z,.95,mats.wood);};
 const cabinet=(id,b,z=0,h=2.2)=>{box(id,b,z,h,mats.wood);for(let x=b[0]+.42;x<b[2];x+=.6)box(id+'-handle-'+x,[x,b[1]-.025,x+.025,b[1]-.005],z+Math.min(1,h*.55),Math.min(.3,h*.25),mats.dark);};
 const sink=(id,x,y,z=0)=>{box(id+'-vanity',[x,y,x+.9,y+.5],z,.8,mats.wood);box(id+'-bowl',[x+.12,y+.05,x+.78,y+.43],z+.8,.1,mats.white);beam(id+'-tap',[x+.45,y+.38,z+.9],[x+.45,y+.38,z+1.15],.025);};
 const toilet=(id,x,y,z=0)=>{box(id+'-base',[x,y,x+.38,y+.62],z,.42,mats.white);box(id+'-cistern',[x-.02,y+.48,x+.4,y+.68],z+.42,.4,mats.white);};
 const shower=(id,x,y,z=0)=>{box(id+'-tray',[x,y,x+.9,y+.9],z,.05,mats.white);box(id+'-screen',[x+.88,y,x+.9,y+.9],z+.05,1.95,mats.glass).castShadow=false;beam(id+'-head',[x+.1,y+.85,z+2],[x+.55,y+.85,z+2],.035);};
 cabinet('kitchen-back',[2.2,8.65,6.4,9.27],0,.91);box('kitchen-counter',[2.15,8.6,6.45,9.3],.91,.055,mats.counter);sink('kitchen-sink',3.5,8.7,.05);
 cabinet('kitchen-island',[2.1,10.45,6.25,11.45],0,.9);box('island-counter',[2.02,10.39,6.33,11.52],.9,.065,mats.counter);box('hob',[3.2,10.55,4.1,11.1],.969,.02,mats.dark);for(let i=0;i<4;i++)chair('island-stool-'+i,2.45+i*.95,11.85);
 cabinet('kitchen-tall',[.55,7.15,1.15,8.3]);cabinet('pantry-shelf',[.6,6.92,1.05,8.28],0,2.1);cabinet('pantry-shelf2',[2.95,6.92,3.45,8.25],0,2.1);
 cabinet('utility-plant',[4.2,7.7,5.2,8.22],0,1.6);box('heat-pump-module',[5.45,7.6,6.2,8.25],0,1.8,mats.white);
 box('living-rug',[1.05,13,4.6,16.1],.026,.015,mats.rug);box('sofa-base',[1.2,13.1,3.05,16.0],.1,.35,mats.sofa);box('sofa-back',[1.2,13.1,1.55,16.0],.45,.5,mats.sofa);for(let i=0;i<3;i++)box('sofa-cushion-'+i,[1.55,13.15+i*.91,3,14+i*.91],.45,.16,mats.linen);box('chaise',[3.05,13.1,3.8,14.15],.1,.48,mats.sofa);table('coffee-table',[3.3,14.65,4.5,15.4],0,.45);box('media-console',[.5,14.2,.9,16],0,.55,mats.wood);box('tv',[.53,14.25,.6,15.85],.7,.95,mats.dark);
 table('dining-table',[5.55,13,6.65,15.6]);for(let i=0;i<3;i++){chair('dining-left-'+i,5.2,13.35+i*.9);chair('dining-right-'+i,7.0,13.35+i*.9);}
 table('office-desk',[10.8,10.2,12.8,11.0]);chair('office-chair',11.7,11.45);box('office-monitor',[11.35,10.55,12.1,10.65],.82,.5,mats.dark);cabinet('office-books',[13.5,9.6,14.05,11.9]);
 bed('guest-bed',12.35,5.1,0,1.35);table('guest-desk',[11.5,7.15,12.65,7.75]);chair('guest-chair',12.0,6.6);cabinet('guest-wardrobe',[13.55,7.4,14.05,9.0]);cabinet('entry-wardrobe',[8.6,4.75,10.85,5.4]);box('entry-bench',[7.3,6.6,7.8,7.6],0,.45,mats.wood);
 sink('ground-bath',9.2,6.4);toilet('ground-wc',10.3,7.1);
 bed('bedroom-one',1.25,.8,3.2,1.4);table('bedroom-one-desk',[6.5,1.05,7.7,1.7],3.2);chair('bedroom-one-chair',6.9,2.1,3.2);cabinet('bedroom-one-wardrobe',[5.25,.6,7.8,1.05],3.2,1.8);
 bed('bedroom-two',1.2,6.35,3.2,1.2);table('bedroom-two-desk',[3.3,8.7,4.4,9.4],3.2);chair('bedroom-two-chair',3.7,8.3,3.2);cabinet('bedroom-two-books',[.6,8.7,1.15,9.8],3.2,1.5);
 bed('master-bed',11.25,9.1,3.2,1.8);for(const x of [10.65,13.25])box('master-bedside',[x,9.1,x+.45,9.65],3.2,.5,mats.wood);cabinet('master-dressing',[12.05,5.35,13.9,5.95],3.2);cabinet('master-dressing2',[13.5,6.1,14,7.65],3.2);
 sink('upper-bath',3.2,3.9,3.2);toilet('upper-wc',1.4,4.05,3.2);box('bath-tub',[.7,4.5,2.4,5.4],3.2,.55,mats.white);shower('private-shower',9.1,5.4,3.2);sink('private-sink',10.3,6.2,3.2);toilet('private-wc',10.7,5.4,3.2);
 for(let i=0;i<2;i++){box('laundry-machine-'+i,[6.65+i*.7,5.35,7.25+i*.7,5.98],3.2,.87,mats.white);const drum=mesh(new THREE.CylinderGeometry(.22,.22,.035,24),mats.dark,'washing-machine-drum-'+i);drum.rotation.x=Math.PI/2;drum.position.set(6.95+i*.7,5.335,3.65);}cabinet('laundry-store',[8.15,6.0,8.65,7.2],3.2,1.8);
}

function iconInteriorLightingAndRoof(context) {
 const {THREE, group, box, mats, navigation, contains, data, house, mesh} = context;
 for(const [id,x,y,z] of [['living',4.4,14,2.5],['kitchen',4.3,10.5,2.55],['hall',8.3,8.4,2.55],['guest',12.6,7,2.55],['office',12,10.9,2.55],['upper-hall',5.6,7.5,5.6],['upper-one',4.3,2,5.6],['upper-two',3.2,7.6,5.6],['upper-master',11.7,10,5.6]]){const lamp=new THREE.PointLight('#fff0d6',12,5,2);lamp.position.set(x,y,z);lamp.castShadow=false;group.add(lamp);box('light-fixture-'+id,[x-.12,y-.12,x+.12,y+.12],z+.05,.04,mats.lamp);}
 const inverse=group.matrix.clone().invert();
 navigation.ceilingHeight = worldXY => {
  const p=new THREE.Vector3(worldXY[0],worldXY[1],0).applyMatrix4(inverse);
  if(!contains([p.x,p.y],data.exterior.upper))return Infinity;
  const slope=(8.3-4.07)/4.25,heights=[];
  if(p.x>=0&&p.x<=8.5)heights.push(8.3-slope*Math.abs(p.x-4.25));
  if(p.x>=4.25&&p.y>=4.21&&p.y<=12.71)heights.push(8.3-slope*Math.abs(p.y-8.46));
  return Math.max(...heights)-.045;
 };
 for(const part of house.meshes.filter(m=>m.kind==='roof')){
  const vertices=part.vertices.map(v=>{const p=new THREE.Vector3(...v).applyMatrix4(inverse);return [p.x,p.y,p.z-.045];});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geometry.setIndex(part.faces.flatMap(f=>f.slice(1,-1).flatMap((_,i)=>[f[0],f[i+1],f[i+2]])));geometry.computeVertexNormals();mesh(geometry,mats.ceiling,'interior-roof-lining-'+part.id).castShadow=false;
 }
 group.userData={kind:'walkable-interior',rooms:data.rooms.length,stairRises:18,source:data.metadata,groundFloor:0,upperFloor:3.2};
}
