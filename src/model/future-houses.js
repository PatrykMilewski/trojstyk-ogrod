import {createFutureIntegralShell} from './future-house-integral.js';

// Width runs along local X, depth along local Y. The entrance faces −Y.
export const futureHouseSpecs = {
  barnA: {label:'Stodoła modrzewiowa',width:12.1,depth:9,usableAreaM2:159,groundFloorM2:86,upperFloorM2:73,
    floors:2,roofPitchDeg:42,kneeWallM:1.2,eaveHeightM:4.25,wall:'#aa7952',roof:'#40474a',trim:'#363b3b'},
  barnA200: {recess:{side:'front',width:2.88,depth:.78},label:'Stodoła z galerią',width:14.1,depth:9.8,
    usableAreaM2:200,groundFloorM2:109,upperFloorM2:91,floors:2,roofPitchDeg:41,kneeWallM:1.34,
    eaveHeightM:4.44,wall:'#b79875',roof:'#424b4e',trim:'#3f4848'},
  barnB: {recess:{side:'front',width:2.55,depth:0.76},label:'Stodoła z lukarną',width:13.1,depth:8.4,usableAreaM2:159,groundFloorM2:87,upperFloorM2:72,
    floors:2,roofPitchDeg:45,kneeWallM:1.1,eaveHeightM:4.15,wall:'#e2d3b8',roof:'#945945',trim:'#624b42'},
  barnC: {recess:{side:'back',width:4.5,depth:1.05},label:'Biała stodoła z podcieniem',width:11.6,depth:9.5,usableAreaM2:161,groundFloorM2:87,upperFloorM2:74,
    floors:2,roofPitchDeg:38,kneeWallM:1.35,eaveHeightM:4.4,wall:'#e8e6dc',roof:'#575a56',trim:'#565854'},
  bungalow: {recess:{side:'front',width:2.55,depth:0.91},label:'Parterowy dom z dachem namiotowym',width:14,depth:14,usableAreaM2:160,groundFloorM2:160,upperFloorM2:0,
    floors:1,roofPitchDeg:28,eaveHeightM:3.18,wall:'#dbd2bc',roof:'#6f6b63',trim:'#575347'},
  villa: {recess:{side:'front',width:2.55,depth:0.77},label:'Willa z cofniętym piętrem',width:13.6,depth:12.4,usableAreaM2:239,groundFloorM2:136,upperFloorM2:103,
    floors:2,roofPitchDeg:28,eaveHeightM:6.42,upperWidthM:12,upperDepthM:10.7,wall:'#e5e1d6',roof:'#444d50',trim:'#394548'}
};

const futureGeometryCache = new WeakMap();

function futureSiteRing(home, points) {
  const angle=home.angle*Math.PI/180, c=Math.cos(angle), s=Math.sin(angle);
  return [...points,points[0]].map(([x,y])=>[home.x+c*x-s*y,home.y+s*x+c*y]);
}

export function futureHouseFootprint(home) {
  const {width,depth,recess}=futureHouseSpecs[home.type], x=width/2, y=depth/2;
  const half=(recess?.width ?? 0)/2;
  const front=recess?.side==='front'?
    [[-half,-y],[-half,-y+recess.depth],[half,-y+recess.depth],[half,-y]]:[];
  const back=recess?.side==='back'?
    [[half,y],[half,y-recess.depth],[-half,y-recess.depth],[-half,y]]:[];
  return futureSiteRing(home,[[-x,-y],...front,[x,-y],[x,y],...back,[-x,y]]);
}

export function futureGarageFootprint(home) {
  if (!home.garage) return null;
  const {localCenter:[x,y],width,depth}=home.garage,w=width/2,d=depth/2;
  return futureSiteRing(home,[[x-w,y-d],[x+w,y-d],[x+w,y+d],[x-w,y+d]]);
}

const futureVariations={
  barnA:['przeszklony szczyt','lukarna i francuski balkon'],
  barnB:['szeroka lukarna pulpitowa','dwie lukarny dwuspadowe'],
  barnC:['podcień ogrodowy','podcień i szczyt nad wejściem'],
  bungalow:['dach namiotowy','dach naczółkowy'],
  villa:['piętro z dachem czterospadowym','piętro z dachem dwuspadowym'],
  barnA200:['galeria ogrodowa i lukarna']
};

function futureVariationIndex(home) {
  if (home.type==='barnA200') return 0;
  const number=Number(String(home.parcel ?? '').split('/').at(-1))||0;
  return (number+Math.floor(number/5))%2;
}

export function futureHouseVariant(home) {
  return futureVariations[home.type][futureVariationIndex(home)];
}

function futureArcadeMembers(spec) {
  const y=spec.depth/2;
  const posts=[-2.10,2.10].map(x=>({x,y:y-.085,width:.16,depth:.16,height:3.06,tone:'#9b795a'}));
  const slats=[];
  for (let x=1.42;x<2.09;x+=.135) slats.push({x,y:y-.08,width:.045,depth:.095,height:3.02,tone:'#a98b6b'});
  return {posts,slats};
}

export function futureHousePorchObstacles(home) {
  if (home.type!=='barnC') return [];
  const {posts,slats}=futureArcadeMembers(futureHouseSpecs[home.type]);
  // The gaps between screen slats are narrower than the walker's diameter.
  const first=slats[0], last=slats[slats.length-1];
  const screen={...first,x:(first.x+last.x)/2,width:last.x-first.x+first.width};
  return [...posts,screen].map(({x,y,width,depth})=>{
    const w=width/2,d=depth/2;
    return futureSiteRing(home,[[x-w,y-d],[x+w,y-d],[x+w,y+d],[x-w,y+d]]);
  });
}

function futureGeometryBuilder(THREE) {
  const buffers = {shell:{positions:[],colors:[]}, glass:{positions:[],colors:[]}};
  const colors = new Map();
  function color(value) {
    if (!colors.has(value)) colors.set(value,new THREE.Color(value));
    return colors.get(value);
  }
  function face(points, tones, surface='shell') {
    const data=buffers[surface];
    for (let i=1;i<points.length-1;i++) {
      for (const index of [0,i,i+1]) {
        const c=color(Array.isArray(tones)?tones[index]:tones);
        data.positions.push(...points[index]);
        data.colors.push(c.r,c.g,c.b);
      }
    }
  }
  function solid(bottom, top, tone) {
    face([...bottom].reverse(),tone);
    face(top,tone);
    for (let i=0;i<bottom.length;i++) {
      const j=(i+1)%bottom.length;
      face([bottom[i],bottom[j],top[j],top[i]],tone);
    }
  }
  function box(x,y,z,width,depth,height,tone) {
    const w=width/2,d=depth/2,h=height/2;
    const bottom=[[x-w,y-d,z-h],[x+w,y-d,z-h],[x+w,y+d,z-h],[x-w,y+d,z-h]];
    solid(bottom,bottom.map(([a,b])=>[a,b,z+h]),tone);
  }
  function beam(start,end,width,height,tone) {
    const direction=new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize();
    const lateral=new THREE.Vector3(-direction.y,direction.x,0);
    if (lateral.lengthSq()<1e-8) lateral.set(1,0,0);
    lateral.normalize();
    const up=new THREE.Vector3().crossVectors(direction,lateral).normalize();
    const section=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([w,h])=>new THREE.Vector3(...p)
      .addScaledVector(lateral,w*width/2).addScaledVector(up,h*height/2).toArray());
    solid(section(start),section(end),tone);
  }
  function finish() {
    const geometries={};
    for (const [key,data] of Object.entries(buffers)) {
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
      g.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
      g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
      geometries[key]=g;
    }
    return geometries;
  }
  return {face,box,beam,finish};
}

function futureElevation(g, side, plane) {
  const alongX=side==='front'||side==='back';
  const sign=side==='front'||side==='left'?-1:1;
  const point=(u,out,z)=>alongX?[u,plane+sign*out,z]:[plane+sign*out,u,z];
  function box(u,out,z,width,depth,height,tone) {
    g.box(...point(u,out,z),alongX?width:depth,alongX?depth:width,height,tone);
  }
  function glass(u,z,w,h,out) {
    const x=w/2, y=h/2;
    const verts=[point(u-x,out,z-y),point(u+x,out,z-y),point(u+x,out,z+y),point(u-x,out,z+y)];
    const tones=['#526568','#596a6d','#a6b4b1','#899b9d'];
    const reverse=side==='back'||side==='left';
    g.face(reverse?verts.reverse():verts,reverse?tones.reverse():tones,'glass');
  }
  return {box,glass,point};
}

function futureWindow(g,side,plane,u,bottom,w,h,panes,trim) {
  if(g.integral?.excludesWindow(side,u,w) && bottom<3.41) return;
  const wall=futureElevation(g,side,plane), z=bottom+h/2;
  wall.box(u,.035,z,w+.10,.08,h+.11,'#c9c6b9');
  wall.box(u,.082,z,w,.055,h,trim);
  const step=(w-.12)/panes;
  for (let i=0;i<panes;i++) {
    const center=u+(i+.5-panes/2)*step;
    wall.glass(center,z,step-.055,h-.14,.116);
  }
  wall.box(u,.076,bottom-.046,w+.14,.18,.068,'#aeafa7');
}

function futureEntrance(g,spec,canopy=false) {
  const recess=spec.recess?.side==='front'?spec.recess.depth:0;
  const f=futureElevation(g,'front',-spec.depth/2+recess);
  f.box(0,.038,1.15,1.42,.11,2.24,spec.trim);
  f.box(-.13,.108,1.15,.93,.06,2.12,'#8e7055');
  f.glass(.50,1.23,.26,1.89,.118);
  f.box(.19,.16,1.07,.045,.065,.36,'#b9b5a6');
  f.box(-.96,.11,1.75,.12,.15,.28,'#494944');
  f.box(-.96,.20,1.75,.086,.04,.19,'#e3dac0');
  f.box(0,recess*.5+.12,.07,1.82,recess+.45,.14,'#b3afa2');
  if (canopy) f.box(0,.21,2.48,2.23,.50,.105,spec.trim);
}

function futureBody(g,s,zTop) {
  if(s.integral) return s.integral.walls(g);
  const {width:w,depth:d,wall}=s;
  if (!s.recess) return g.box(0,0,zTop/2,w,d,zTop,wall);
  const bay=s.recess.width, side=(w-bay)/2;
  const frontRecess=s.recess.side==='front'?s.recess.depth:0;
  const backRecess=s.recess.side==='back'?s.recess.depth:0;
  g.box(-(bay+side)/2,0,zTop/2,side,d,zTop,wall);
  g.box((bay+side)/2,0,zTop/2,side,d,zTop,wall);
  g.box(0,(frontRecess-backRecess)/2,zTop/2,bay,d-frontRecess-backRecess,zTop,wall);
}

function futureGableRoof(g,s,course) {
  const {width:w,depth:d,eaveHeightM:e,roof,roofPitchDeg}=s;
  const slope=Math.tan(roofPitchDeg*Math.PI/180), ridge=e+d*.5*slope;
  if(s.integral && !s.integral.flat) {s.integral.roof(g);return ridge;}
  const x=w/2+.31,y=d/2+.31,z=e-.31*slope;
  for (const direction of [-1,1]) {
    const end=w/2*direction;
    const triangle=[[end,-d/2,e],[end,d/2,e],[end,0,ridge]];
    g.face(direction===1?triangle:triangle.reverse(),s.wall);
    const edge=direction*y;
    const surface=[[-x,edge,z],[x,edge,z],[x,0,ridge],[-x,0,ridge]];
    g.face(direction<0?surface:surface.reverse(),roof);
    g.beam([-x,edge,z-.025],[x,edge,z-.025],.115,.13,s.trim);
    for (const sx of [-x,x]) g.beam([sx,edge,z],[sx,0,ridge],.09,.13,s.trim);
    if (course==='tile') {
      for (let n=.30;n<y;n+=.34) {
        const h=ridge-n*slope;
        g.beam([-x,direction*n,h],[x,direction*n,h],.034,.032,'#824e3f');
      }
    } else {
      for (let u=-x+.30;u<x-.12;u+=.59)
        g.beam([u,edge,z+.011],[u,0,ridge+.011],.021,.027,course==='zinc'?'#656963':'#555c5d');
    }
  }
  g.beam([-x,0,ridge],[x,0,ridge],.15,.115,s.trim);
  return ridge;
}

function futureHipRoof(g,cx,cy,w,d,e,pitch,tone,edge) {
  const x=w/2,y=d/2, rise=Math.min(x,y)*Math.tan(pitch*Math.PI/180);
  const ridge=Math.max(0,x-y), north=[cx+ridge,cy,e+rise],south=[cx-ridge,cy,e+rise];
  const corners=[[cx-x,cy-y,e],[cx+x,cy-y,e],[cx+x,cy+y,e],[cx-x,cy+y,e]];
  for (const [i,j,a,b] of [[0,1,north,south],[1,2,north,north],[2,3,south,north],[3,0,south,south]]) {
    const verts=[corners[i],corners[j],a];
    if (a!==b && ridge>0) verts.push(b);
    g.face(verts,tone);
    g.beam(corners[i],corners[j],.10,.13,edge);
  }
  for (let i=0;i<4;i++) g.beam(corners[i],(i===0||i===3)?south:north,.085,.086,edge);
  if (ridge>.01) g.beam(south,north,.12,.095,edge);
  return e+rise;
}

function futureStack(g,x,y,surfaceZ,tone) {
  if(g.integral && !g.integral.flat) surfaceZ=g.integral.height(x,y);
  g.box(x,y,surfaceZ+.07,.59,.50,1.48,tone);
  g.box(x,y,surfaceZ+.84,.68,.59,.105,'#4e514f');
  g.box(x,y,surfaceZ+.905,.17,.15,.044,'#303738');
}

function futureGableGlass(g,s,right=true) {
  const side=right?'right':'left', plane=(right?1:-1)*s.width/2;
  const f=futureElevation(g,side,plane), half=s.depth*.31;
  const ridge=s.eaveHeightM+s.depth/2*Math.tan(s.roofPitchDeg*Math.PI/180);
  futureWindow(g,side,plane,0,.16,half*2,2.45,4,s.trim);
  const z0=3.27,za=ridge-.50,ze=za-half*Math.tan(s.roofPitchDeg*Math.PI/180);
  const outline=[f.point(-half,.085,z0),f.point(half,.085,z0),f.point(half,.085,ze),f.point(0,.085,za),f.point(-half,.085,ze)];
  const tones=['#53696e','#576f74','#9baaa9','#aebcba','#95a7a7'];
  g.face(right?outline:[...outline].reverse(),right?tones:[...tones].reverse(),'glass');
  for (let i=0;i<outline.length;i++) g.beam(outline[i],outline[(i+1)%outline.length],.085,.095,s.trim);
  for (const u of [-half/2,0,half/2]) {
    const top=za-Math.abs(u)*Math.tan(s.roofPitchDeg*Math.PI/180);
    g.beam(f.point(u,.11,z0),f.point(u,.11,top),.075,.072,s.trim);
  }
}

function futureDormer(g,s,x,width,frontDistance,headroom,peaked=false) {
  const slope=Math.tan(s.roofPitchDeg*Math.PI/180), ridge=s.eaveHeightM+s.depth/2*slope;
  const front=-frontDistance, base=(g.integral?g.integral.height(x,front):ridge-frontDistance*slope)-.07, eave=base+headroom;
  const join=Math.min(-.25,front+(headroom+.43)/slope), left=x-width/2,right=x+width/2;
  g.box(x,(front+join)/2,(base+eave)/2,width,join-front,eave-base,s.wall);
  if (peaked) {
    const top=eave+.44, over=.11;
    g.face([[left,front,eave],[right,front,eave],[x,front,top]],s.wall);
    for (const side of [left-over,right+over]) {
      g.face([[side,front-over,eave-.05],[side,join,eave-.05],[x,join,top],[x,front-over,top]],s.roof);
      g.beam([side,front-over,eave-.05],[x,front-over,top],.065,.065,s.trim);
    }
  } else {
    g.face([[left-.12,front-.12,eave],[right+.12,front-.12,eave],[right+.12,join,eave+.16],[left-.12,join,eave+.16]],s.roof);
    g.box(x,front-.08,eave,width+.27,.13,.11,s.trim);
  }
  futureWindow(g,'front',front,x,base+.13,width-.39,headroom-.25,width>2.4?3:2,s.trim);
}

function futureRooflight(g,s,x,side,distance,width,length) {
  const slope=Math.tan(s.roofPitchDeg*Math.PI/180), ridge=s.eaveHeightM+s.depth/2*slope;
  const frame=(w,l,lift,tone,surface)=>{
    const a=distance-l/2,b=distance+l/2;
    const pts=[[x-w/2,side*a,ridge-a*slope+lift],[x+w/2,side*a,ridge-a*slope+lift],
      [x+w/2,side*b,ridge-b*slope+lift],[x-w/2,side*b,ridge-b*slope+lift]];
    g.face(side>0?pts:pts.reverse(),tone,surface);
  };
  frame(width,length,.069,s.trim,'shell');
  frame(width-.14,length-.12,.080,'#647579','glass');
}

function futureHalfHip(g,s) {
  const half=s.width/2+.33, depth=s.depth/2+.33, e=s.eaveHeightM;
  const slope=Math.tan(s.roofPitchDeg*Math.PI/180), cut=1.84, peak=e+depth*slope, clipped=peak-cut*slope;
  for(const sign of [-1,1]) {
    const y=sign*depth, mid=sign*cut;
    g.face([[-half,y,e],[half,y,e],[half,mid,clipped],[-half,mid,clipped]],s.roof);
    g.face([[-half,mid,clipped],[half,mid,clipped],[half-cut,0,peak],[-half+cut,0,peak]],s.roof);
    g.beam([-half,y,e],[half,y,e],.11,.13,s.trim);
    const wallX=sign*s.width/2,end=sign*half;
    g.face([[wallX,-s.depth/2,e],[wallX,s.depth/2,e],[wallX,cut,clipped],[wallX,-cut,clipped]],s.wall);
    g.face([[end,-cut,clipped],[end,cut,clipped],[sign*(half-cut),0,peak]],s.roof);
    for(const d of [-1,1]) {
      g.beam([end,d*depth,e],[end,d*cut,clipped],.095,.095,s.trim);
      g.beam([end,d*cut,clipped],[sign*(half-cut),0,peak],.085,.085,s.trim);
    }
    const vent=futureElevation(g,sign>0?'right':'left',wallX);
    vent.box(0,.05,e+1.24,1.08,.11,.43,s.trim);
    for(let j=0;j<4;j++) vent.box(0,.12,e+1.1+j*.09,.96,.042,.027,'#9b9485');
  }
  g.beam([-half+cut,0,peak],[half-cut,0,peak],.095,.09,s.trim);
}

function futureBarnA(g,s) {
  const {width:w,depth:d,trim}=s;
  futureBody(g,s,s.eaveHeightM);
  for (let u=-w/2+.22;u<w/2;u+=.28)
    for (const side of [-1,1]) g.box(u,side*(d/2+.014),s.eaveHeightM/2,.026,.033,s.eaveHeightM,'#917053');
  const ridge=futureGableRoof(g,s,'metal');
  futureEntrance(g,s,true);
  for (const u of [-4.3,-2.23,3.27]) futureWindow(g,'front',-d/2,u,.88,1.23,1.38,1,trim);
  futureWindow(g,'back',d/2,2.83,.16,3.8,2.42,3,trim);
  futureWindow(g,'back',d/2,-3.25,.91,2.48,1.31,2,trim);
  futureGableGlass(g,s,!s.flipGable);
  const other=s.flipGable?'right':'left', sidePlane=(s.flipGable?1:-1)*w/2;
  if(s.alternate) {
    futureDormer(g,s,2.8,2.74,3.15,1.22);
    const balcony=futureElevation(g,other,sidePlane);
    if(!g.integral?.excludesWindow(other,0,2.06)) {
    futureWindow(g,other,sidePlane,0,3.43,1.9,1.96,2,trim);
    balcony.box(0,.29,4.39,2.06,.055,.055,trim);
    for(let u=-.97;u<=1;u+=.24) balcony.box(u,.29,3.94,.033,.045,.88,trim);
    }
  } else futureWindow(g,other,sidePlane,0,4.13,1.83,1.48,2,trim);
  futureWindow(g,other,sidePlane,-1.8,.88,1.35,1.39,1,trim);
  futureStack(g,-3.3,.6,ridge-.6*Math.tan(s.roofPitchDeg*Math.PI/180),'#666865');
}

function futureBarnB(g,s) {
  const {width:w,depth:d,trim}=s;
  futureBody(g,s,s.eaveHeightM);
  const ridge=futureGableRoof(g,s,'tile');
  futureEntrance(g,s);
  futureWindow(g,'front',-d/2,-3.65,.83,2.25,1.51,2,trim);
  futureWindow(g,'front',-d/2,3.58,.86,2,1.48,2,trim);
  for (const u of [-4.35,-1.63,3.18]) futureWindow(g,'back',d/2,u,u<0?.91:.18,u<0?1.50:3.22,u<0?1.4:2.38,u<0?1:3,trim);
  for (const side of ['left','right']) {
    const plane=(side==='left'?-1:1)*w/2;
    futureWindow(g,side,plane,0,4.31,1.68,1.35,2,trim);
    futureWindow(g,side,plane,side==='left'?-1.66:1.57,.89,1.25,1.32,1,trim);
  }
  if (s.alternate) {
    for(const x of [-3.48,3.40]) futureDormer(g,s,x,1.83,2.94,1.18,true);
  } else futureDormer(g,s,-3.35,2.76,2.97,1.31);
  futureStack(g,3.07,-.48,ridge-.48,'#a26650');
}

function futureBarnC(g,s) {
  const {width:w,depth:d,trim}=s;
  futureBody(g,s,s.eaveHeightM);
  const ridge=futureGableRoof(g,s,'zinc');
  futureEntrance(g,s,true);
  futureWindow(g,'front',-d/2,-3.60,1.09,2.47,.99,2,trim);
  futureWindow(g,'front',-d/2,3.89,.75,1.33,1.62,1,trim);
  futureWindow(g,'back',d/2-s.recess.depth,0,.13,3.90,2.43,3,trim);
  const {posts,slats}=futureArcadeMembers(s);
  for (const {x,y,width,depth,height,tone} of [...posts,...slats]) g.box(x,y,1.53,width,depth,height,tone);
  g.box(0,d/2-.51,3.07,s.recess.width,1.06,.17,'#9c7b5a');
  if(s.alternate) futureDormer(g,s,0,3.35,3.87,1.17,true);
  futureGableGlass(g,s,s.flipGable);
  const other=s.flipGable?'left':'right',sidePlane=(s.flipGable?-1:1)*w/2;
  futureWindow(g,other,sidePlane,1.86,.89,1.56,1.43,2,trim);
  futureWindow(g,other,sidePlane,-.47,4.27,1.44,1.39,1,trim);
  futureStack(g,3.35,.45,ridge-.35,'#77776e');
}

function futureBungalow(g,s) {
  const {width:w,depth:d,trim}=s;
  futureBody(g,s,s.eaveHeightM);
  if(!s.integral) futureBody(g,{width:w+.02,depth:d+.02,wall:'#a69e8b',recess:{...s.recess,depth:s.recess.depth+.01}},.22);
  if(s.integral) s.integral.roof(g);
  else if(s.alternate) futureHalfHip(g,s);
  else futureHipRoof(g,0,0,w+.80,d+.80,s.eaveHeightM+.02,s.roofPitchDeg,s.roof,trim);
  futureEntrance(g,s);
  for (const u of [-4.32,4.25]) futureWindow(g,'front',-d/2,u,.65,3.14,1.63,3,trim);
  futureWindow(g,'back',d/2,-2.58,.13,5.24,2.48,4,trim);
  futureWindow(g,'back',d/2,4.36,.82,2.07,1.43,2,trim);
  futureWindow(g,'left',-w/2,-3.02,.86,2.5,1.46,2,trim);
  futureWindow(g,'left',-w/2,2.73,1.43,1.89,.79,2,trim);
  futureWindow(g,'right',w/2,2.56,.68,3.17,1.74,3,trim);
  futureWindow(g,'right',w/2,-3.85,1.42,1.48,.84,1,trim);
  futureStack(g,-2.5,1.13,s.eaveHeightM+(w/2+.4-2.5)*Math.tan(s.roofPitchDeg*Math.PI/180),'#978c7a');
}

function futureVilla(g,s) {
  const {width:w,depth:d,upperWidthM:uw,upperDepthM:ud,trim}=s;
  const first=3.24, cx=-.49, cy=-.61, upperY=cy+ud/2;
  futureBody(g,s,first);
  if(s.integral) s.integral.roof(g);
  else g.box(0,0,first+.07,w+.24,d+.24,.19,'#a6a79e');
  g.box(cx,cy,(s.eaveHeightM+first)/2,uw,ud,s.eaveHeightM-first,'#e9e6dc');
  if(s.alternate) {
    const roof=futureLocalBuilder(g,cx,cy);
    futureGableRoof(roof,{...s,width:uw,depth:ud,wall:'#c2b5a3'},'metal');
    for(const f of [-3.4,0,3.4]) futureRooflight(roof,{...s,width:uw,depth:ud},f,1,2.35,.83,1.11);
  } else futureHipRoof(g,cx,cy,uw+.45,ud+.45,s.eaveHeightM,s.roofPitchDeg,s.roof,trim);
  futureEntrance(g,s);
  for (const u of [-4.52,3.89]) futureWindow(g,'front',-d/2,u,.73,2.36,1.71,2,trim);
  for (const u of [-3.92,-.48,3.14]) futureWindow(g,'front',cy-ud/2,u,4.07,1.93,1.52,2,trim);
  futureWindow(g,'back',d/2,-2.4,.15,5.65,2.52,4,trim);
  futureWindow(g,'back',d/2,4.16,.76,2.04,1.49,2,trim);
  futureWindow(g,'back',upperY,-2.95,3.45,3.77,2.35,3,trim);
  futureWindow(g,'back',upperY,2.07,4,2.01,1.47,2,trim);
  for (const side of ['left','right']) {
    const sign=side==='left'?-1:1;
    for (const u of [-3.21,2.8]) futureWindow(g,side,sign*w/2,u,.77,2.48,1.56,2,trim);
    futureWindow(g,side,cx+sign*uw/2,-2.14,4.07,2.49,1.48,2,trim);
    futureWindow(g,side,cx+sign*uw/2,1.98,4.07,1.76,1.48,2,trim);
  }
  for (let x=-w/2+.12;x<w/2;x+=1.33) g.box(x,d/2-.10,3.88,.048,.048,1.04,trim);
  g.box(0,d/2-.10,4.39,w-.12,.07,.07,trim);
  const railEnd=d/2-.10, returnDepth=railEnd-upperY;
  for (const x of [-w/2+.11,w/2-.11]) {
    g.box(x,upperY,3.88,.048,.048,1.04,trim);
    g.box(x,railEnd,3.88,.048,.048,1.04,trim);
    g.box(x,upperY+returnDepth/2,4.39,.065,returnDepth,.07,trim);
    for (const z of [3.62,3.85,4.09]) g.box(x,upperY+returnDepth/2,z,.027,returnDepth,.032,'#737d7c');
  }
  for (const z of [3.62,3.85,4.09]) g.box(0,d/2-.10,z,w-.12,.027,.032,'#737d7c');
  const chimneyInset=s.alternate?ud/2-.46:Math.min(uw/2+.225-3.32,ud/2+.225-.46);
  futureStack(g,cx-3.32,cy+.46,s.eaveHeightM+chimneyInset*Math.tan(s.roofPitchDeg*Math.PI/180),'#7d8079');
}

function futureLocalBuilder(g,cx,cy) {
  const point=([x,y,z])=>[cx+x,cy+y,z];
  return {
    box:(x,y,z,...args)=>g.box(cx+x,cy+y,z,...args),
    face:(ring,...args)=>g.face(ring.map(point),...args),
    beam:(a,b,...args)=>g.beam(point(a),point(b),...args)
  };
}

function futureGalleryBarn(g,s) {
  const {width:w,depth:d,trim}=s;
  futureBody(g,s,s.eaveHeightM);
  const ridge=futureGableRoof(g,s,'metal');
  futureEntrance(g,s);
  for (const x of [-4.78,4.87]) futureWindow(g,'front',-d/2,x,.60,2.58,1.78,3,trim);
  for (const side of [-1,1]) {
    const f=futureElevation(g,'front',-d/2);
    for(let n=0;n<7;n++) f.box(side*(1.58+n*.13),.045,1.55,.061,.10,3.08,'#866b51');
  }
  futureDormer(g,s,-3.92,3.02,3.44,1.34);
  for(const x of [2.20,3.42]) futureRooflight(g,s,x,-1,2.45,.98,1.40);
  for(const x of [-3.98,.0,3.98]) futureWindow(g,'back',d/2,x,.16,3.07,2.55,3,trim);
  futureGableGlass(g,s,!s.flipGable);
  const other=s.flipGable?'right':'left', plane=(s.flipGable?1:-1)*w/2;
  futureWindow(g,other,plane,-2.32,.83,1.72,1.51,2,trim);
  futureWindow(g,other,plane,1.85,.83,1.66,1.51,2,trim);
  futureWindow(g,other,plane,0,4.05,2.14,1.63,2,trim);
  futureStack(g,3.40,.58,ridge-.58*Math.tan(s.roofPitchDeg*Math.PI/180),'#636966');
}

const futureGarageFinishes={
  wood:{wall:'#ac8965',roof:'#4b5253',trim:'#4a4e49',leaf:'#96795e',profile:'gable'},
  render:{wall:'#ded5c4',roof:'#8f5d4a',trim:'#695247',leaf:'#75695d',profile:'gable'},
  white:{wall:'#e1dfd5',roof:'#535956',trim:'#575c57',leaf:'#707570',profile:'parapet'},
  stone:{wall:'#d8cbb3',roof:'#68645c',trim:'#57564e',leaf:'#827968',profile:'hip'},
  villa:{wall:'#e2ded2',roof:'#4c5353',trim:'#485351',leaf:'#5e6765',profile:'parapet'}
};
const futureGarageFinishByType={barnA:'wood',barnA200:'wood',barnB:'render',barnC:'white',bungalow:'stone',villa:'villa'};

function futureGarageRoof(g,w,d,e,s) {
  const x=w/2+.17,y=d/2+.17;
  if(s.profile==='hip') {
    // Garage widths can be shorter than their depth. Rotate the local hip so its ridge runs along the long side.
    const turn=([x,y,z])=>[-y,x,z];
    const roof=d>w?{face:(p,...args)=>g.face(p.map(turn),...args),beam:(a,b,...args)=>g.beam(turn(a),turn(b),...args)}:g;
    futureHipRoof(roof,0,0,Math.max(w,d)+.30,Math.min(w,d)+.30,e,19,s.roof,s.trim);
  } else if(s.profile==='parapet') {
    g.box(0,0,e+.035,w+.22,d+.22,.15,s.trim);
    g.box(0,0,e+.135,w-.15,d-.15,.06,s.roof);
    for(const sy of [-1,1]) g.box(0,sy*(d/2+.04),e+.19,w+.20,.13,.17,s.wall);
    for(const sx of [-1,1]) g.box(sx*(w/2+.04),0,e+.19,.13,d-.05,.17,s.wall);
    for(const sy of [-1,1]) g.box(0,sy*(d/2+.04),e+.292,w+.24,.18,.038,s.trim);
    for(const sx of [-1,1]) g.box(sx*(w/2+.04),0,e+.292,.18,d-.06,.038,s.trim);
  } else {
    const slope=.35, ridge=e+w/2*slope,z=e-.17*slope;
    for(const sy of [-1,1])g.face([[-w/2,sy*d/2,e],[w/2,sy*d/2,e],[0,sy*d/2,ridge]],s.wall);
    for(const sx of [-1,1]) {
      g.face([[sx*x,-y,z],[sx*x,y,z],[0,y,ridge],[0,-y,ridge]],s.roof);
      g.beam([sx*x,-y,z],[sx*x,y,z],.080,.094,s.trim);
      for(const sy of [-1,1])g.beam([sx*x,sy*y,z],[0,sy*y,ridge],.072,.10,s.trim);
      for(let v=-y+.29;v<y-.14;v+=.54)g.beam([sx*x,v,z+.012],[0,v,ridge+.012],.026,.030,s.trim);
    }
    g.beam([0,-y,ridge],[0,y,ridge],.12,.096,s.trim);
  }
}

function futureSectionalDoor(g,d,offset,opening,stalls,s) {
  const front=-d/2, h=2.30, panelY=front+.18;
  for(const sx of [-1,1]) g.box(offset+sx*(opening/2+.034),front+.071,h/2,.065,.15,h,s.trim);
  g.box(offset,front+.071,h+.036,opening+.13,.15,.07,s.trim);
  g.box(offset,panelY+.058,h/2,opening-.012,.078,h-.018,'#3b423e');
  for(let row=0;row<6;row++){
    const band=(h-.032)/6;
    g.box(offset,panelY,.017+(row+.5)*band,opening-.045,.057,band-.014,s.leaf);
    g.box(offset,panelY-.035,.024+row*band,opening-.065,.018,.014,s.trim);
  }
  const frontPlane=futureElevation(g,'front',panelY-.033), count=stalls===2?4:2;
  for(let col=0;col<count;col++){
    const u=offset+(col-(count-1)/2)*opening*.73/count,glassW=Math.min(.55,opening*.55/count);
    frontPlane.box(u,.010,1.75,glassW+.076,.055,.21,s.trim);
    frontPlane.glass(u,1.75,glassW,.143,.043);
  }
  for(let i=0;i<stalls;i++) frontPlane.box(offset+(i-(stalls-1)/2)*1.7,.045,.69,.18,.052,.032,'#3a423d');
  g.box(offset,front+.03,.021,opening,.23,.042,'#a7a397');
}

function futureGarage(g,garage,s,doorX) {
  const {width:w,depth:d,doorWidth:opening,stalls}=garage, thick=.18,e=2.84;
  const lo=-w/2,hi=w/2,front=-d/2,left=doorX-opening/2,right=doorX+opening/2;
  for(const x of [lo+thick/2,hi-thick/2]) g.box(x,0,e/2,thick,d,e,s.wall);
  g.box(0,d/2-thick/2,e/2,w-2*thick,thick,e,s.wall);
  const wall=(a,b,base,top)=>{if(b>a)g.box((a+b)/2,front+thick/2,(base+top)/2,b-a,thick,top-base,s.wall);};
  wall(lo+thick,left,0,e);wall(right,hi-thick,0,e);wall(left,right,2.30,e);
  g.box(0,0,.025,w,d,.05,'#b7b5a9');
  futureSectionalDoor(g,d,doorX,opening,stalls,s);
  futureGarageRoof(g,w,d,e,s);
  futureWindow(g,'back',d/2,0,1.25,1.45,.79,2,s.trim);
  for(const side of ['left','right']) futureWindow(g,side,(side==='left'?-1:1)*w/2,1.12,1.51,1.29,.49,2,s.trim);
  for(const sx of [-1,1]) {
    const x=doorX+sx*(opening/2+.10);
    g.box(x,front-.040,1.89,.094,.089,.26,s.trim);
    g.box(x,front-.095,1.89,.066,.032,.155,'#d7d2ad');
  }
}

function futureIntegralGarageDetails(g,garage,s) {
  const [cx,cy]=garage.localCenter, side=Math.sign(cx),w=garage.width,d=garage.depth;
  const local=futureLocalBuilder(g,cx,cy),doorX=garage.doorLocal[0]-cx;
  const finish={...s,leaf:s.wall==='#aa7952'?'#987d60':'#746e61'};
  futureSectionalDoor(local,d,doorX,garage.doorWidth,garage.stalls,finish);
  futureWindow(local,side>0?'right':'left',side*w/2,.84,1.38,1.53,.62,2,s.trim);
  futureWindow(local,'back',d/2,0,1.20,1.32,.81,2,s.trim);
  local.box(0,0,.025,w,d,.05,'#b7b5a9');
  if(s.wall==='#aa7952') {
    const front=-d/2, opening=garage.doorWidth, roof=s.integral;
    for(let x=-w/2+.12;x<w/2-.08;x+=.28) {
      const z=roof.height(cx+x,cy+front),bottom=Math.abs(x-doorX)<opening/2+.03?2.36:0;
      local.box(x,front-.016,(bottom+z)/2,.026,.034,z-bottom,'#917053');
    }
  }
}

const futureHouseBuilders={barnA:futureBarnA,barnA200:futureGalleryBarn,barnB:futureBarnB,barnC:futureBarnC,bungalow:futureBungalow,villa:futureVilla};

function futureResidenceParts(home) {
  const alternate=Boolean(futureVariationIndex(home)),type=home.type;
  const glazedRight=type==='barnA'||type==='barnA200';
  const glazedEnd=glazedRight?1:-1,garage=home.garage;
  const flipGable=Boolean(garage&&(glazedRight||type==='barnC')&&Math.sign(garage.localCenter[0])===glazedEnd);
  const spec={...futureHouseSpecs[type],alternate,flipGable};
  const integrated=garage?.integration==='integral';
  const key=['home',type,Number(alternate),Number(flipGable)];
  if(integrated)key.push('integral',garage.width,garage.depth,garage.doorWidth,...garage.localCenter,...garage.doorLocal);
  return {key:key.join('/'),label:spec.label,type,variant:futureHouseVariant(home),
    integralGarageStalls:integrated?garage.stalls:0,x:home.x,y:home.y,build:g=>{
      if(integrated) g.integral=spec.integral=createFutureIntegralShell(spec,garage,type);
      futureHouseBuilders[type](g,spec);
      if(integrated)futureIntegralGarageDetails(g,garage,spec);
    }};

}

function futureGarageParts(home) {
  const garage=home.garage,finish=futureGarageFinishByType[home.type],offset=garage.doorLocal[0]-garage.localCenter[0];
  const [x,y]=futureSiteRing(home,[garage.localCenter])[0];
  return {key:['garage',finish,garage.stalls,garage.width,garage.depth,garage.doorWidth,offset].join('-'),
    label:'Garaż '+garage.stalls+'-stanowiskowy',stalls:garage.stalls,x,y,
    build:g=>futureGarage(g,garage,futureGarageFinishes[finish],offset)};
}

export function addFutureHouses(THREE,group,homes) {
  let cache=futureGeometryCache.get(THREE);
  if (!cache) {
    cache={types:new Map(),materials:{
      shell:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87,side:THREE.DoubleSide}),
      glass:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.25,metalness:.14,side:THREE.DoubleSide})
    }};
    futureGeometryCache.set(THREE,cache);
  }
  const batches=new Map();
  for(const home of homes) {
    const parts=[futureResidenceParts(home)];
    if(home.garage && home.garage.integration!=='integral') parts.push(futureGarageParts(home));
    for(const part of parts) {
      if(!batches.has(part.key)) batches.set(part.key,{part,instances:[]});
      batches.get(part.key).instances.push({x:part.x,y:part.y,angle:home.angle,parcel:home.parcel});
    }
  }
  const meshes=[], matrix=new THREE.Matrix4();
  for(const {part,instances} of batches.values()) {
    if(!cache.types.has(part.key)) {
      const g=futureGeometryBuilder(THREE);part.build(g);cache.types.set(part.key,g.finish());
    }
    for(const [surface,geometry] of Object.entries(cache.types.get(part.key))) {
      const mesh=new THREE.InstancedMesh(geometry,cache.materials[surface],instances.length);
      mesh.name='Zabudowa hipotetyczna · '+part.label+' · '+surface;
      if(part.type) {mesh.userData.futureHouseType=part.type;mesh.userData.futureHouseVariant=part.variant;}
      if(part.stalls) mesh.userData.futureGarageStalls=part.stalls;
      if(part.integralGarageStalls) mesh.userData.integralGarageStalls=part.integralGarageStalls;
      mesh.userData.parcels=instances.map(home=>home.parcel);
      mesh.castShadow=surface==='shell';mesh.receiveShadow=true;
      instances.forEach((place,i)=>{
        matrix.makeRotationZ(place.angle*Math.PI/180).setPosition(place.x,place.y,0);mesh.setMatrixAt(i,matrix);
      });
      mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);
    }
  }
  return meshes;
}
