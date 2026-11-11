'use strict';
(() => {
const GEO = JSON.parse(document.getElementById('geometry-data').textContent);
const pc = polygonClipping;
const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = (value, digits=1) => Number(value).toLocaleString('pl-PL',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const limit = (n,min,max) => Math.max(min,Math.min(max,n));
const add = (a,b) => [a[0]+b[0],a[1]+b[1]];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1]];
const mul = (a,s) => [a[0]*s,a[1]*s];
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const dot = (a,b) => a[0]*b[0]+a[1]*b[1];
const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
const ringArea = (p) => p.reduce((s,a,i)=>s+cross(a,p[(i+1)%p.length]),0)/2;
const polygonArea = (multi) => multi.reduce((sum,polygon)=>sum+Math.abs(ringArea(polygon[0]))-polygon.slice(1).reduce((s,r)=>s+Math.abs(ringArea(r)),0),0);
const closed = (ring) => [...ring,ring[0]];
// A 0.1 mm grid removes near-collinear survey noise before polygon operations.
const polygon = (ring) => [closed(ring.map(p=>p.map(n=>Math.round(n*10000)/10000)))];
const points = (ring) => ring.map(p=>`${p[0]},${-p[1]}`).join(' ');
const linePath = (a,b) => `M${a[0]},${-a[1]}L${b[0]},${-b[1]}`;
const multiPath = (multi) => multi.map(p=>p.map(r=>`M${r.map(v=>`${v[0]},${-v[1]}`).join('L')}Z`).join('')).join('');
const storageKey = 'trojstyk-editor-layout7-v1';
const COLORS = {'193':'#e6d7b7','190':'#dbe7cf','191':'#d5e3e8'};
const presets = {
 trampolina:{name:'Trampolina',w:2.2,h:2.2,color:'#82a59a',category:'urządzenie',shape:'circle'},
 sauna:{name:'Sauna',w:3,h:2.4,color:'#b88b61',category:'budynek'},
 balia:{name:'Balia',w:2.2,h:2.2,color:'#83b6c2',category:'woda',shape:'circle'},
 podest:{name:'Podest',w:1.4,h:2.4,color:'#e4c59c',category:'podłoże'},
 piasek:{name:'Piasek',w:8.8,h:7.5,color:'#eee0af',category:'podłoże'},
 scianka:{name:'Miniścianka',w:2,h:.6,color:'#bf9673',category:'urządzenie'},
 hustawka:{name:'Huśtawka',w:2.2,h:2,color:'#ba936b',category:'urządzenie',safetyW:3,safetyH:7},
 drazki:{name:'Drążki',w:2,h:1.2,color:'#6f8a78',category:'urządzenie'},
 drabinka:{name:'Drabinka',w:.7,h:3,color:'#ad926e',category:'urządzenie'},
 siatka:{name:'Siatka',w:1.5,h:1.5,color:'#b6a98a',category:'urządzenie'},
 baza:{name:'Podbudowa balii',w:2.8,h:2.8,color:'#c9cbbf',category:'podłoże',shape:'circle'},
 strefa:{name:'Własny element',w:3,h:3,color:'#cfb6ce',category:'inne'}
};
function bounds(ring) {
 return {minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),minY:Math.min(...ring.map(p=>p[1])),maxY:Math.max(...ring.map(p=>p[1]))};
}
function center(ring) { const b=bounds(ring);return [(b.minX+b.maxX)/2,(b.minY+b.maxY)/2]; }
function makeObject(kind,x,y,id) {
 const o={id,kind,...clone(presets[kind]),x,y,angle:0,locked:false,shape:presets[kind].shape||'rect'};
 if(kind==='piasek'){o.shape='rounded';o.radius=1.4;}
 if(kind==='sauna')o.parts=[{...clone(presets.podest),kind:'podest',shape:'rect',x:-2.2,y:0,angle:0}];
 if(kind==='balia')o.parts=[{...clone(presets.baza),kind:'baza',shape:'circle',x:0,y:0,angle:0}];
 return o;
}
function groupLegacy(value) {
 for(const o of value.objects)if(o.kind==='trampolina'){o.shape='circle';o.h=o.w;delete o.radius;}
 if(value.grouped)return value;
 for(const [kind,partKind] of [['sauna','podest'],['balia','baza']]) {
  for(const o of value.objects.filter(o=>o.kind===kind)) {
   const part=value.objects.filter(p=>p.kind===partKind&&distance([p.x,p.y],[o.x,o.y])<5).sort((a,b)=>distance([a.x,a.y],[o.x,o.y])-distance([b.x,b.y],[o.x,o.y]))[0];
   if(!part)continue;
   const a=-o.angle*Math.PI/180,d=sub([part.x,part.y],[o.x,o.y]);
   o.parts=[{...part,x:d[0]*Math.cos(a)-d[1]*Math.sin(a),y:d[0]*Math.sin(a)+d[1]*Math.cos(a),angle:part.angle-o.angle}];
   value.objects=value.objects.filter(p=>p!==part);
  }
 }
 for(const o of value.objects)if(o.kind==='piasek'&&o.shape==='rect'){o.shape='rounded';o.radius=1.4;}
 value.grouped=true;return value;
}
function partsWorld(o) {
 const a=o.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return (o.parts||[]).map(p=>({...p,id:o.id+'-part',locked:true,x:o.x+c*p.x-s*p.y,y:o.y+s*p.x+c*p.y,angle:o.angle+p.angle}));
}
function footprint(o) {return pc.union(...[o,...partsWorld(o)].map(p=>polygon(objectRing(p))));}

function makeHouse(n) {
 const ring=GEO.houses[n],b=bounds(ring),c=center(ring);
 return {id:`dom-${n}`,kind:'dom',name:`Dom /${n}`,x:c[0],y:c[1],w:b.maxX-b.minX,h:b.maxY-b.minY,angle:0,locked:true,shape:'polygon',category:'dom',color:'#fffdf8',vertices:ring.map(p=>[(p[0]-c[0])/(b.maxX-b.minX),(p[1]-c[1])/(b.maxY-b.minY)])};
}
function initialState() {
 return validateImport(JSON.parse(document.getElementById('default-layout').textContent));
}
function project(p,a,b) {
 const d=sub(b,a),den=dot(d,d);const t=den?limit(dot(sub(p,a),d)/den,0,1):0;
 const point=add(a,mul(d,t));return {point,t,distance:distance(p,point)};
}
function nearestEdge(point,ring) {
 let best={distance:Infinity};ring.forEach((a,i)=>{const p=project(point,a,ring[(i+1)%ring.length]);if(p.distance<best.distance)best={...p,edge:i};});return best;
}
function touches(a,b,c,d) {
 const ab=sub(b,a),cd=sub(d,c),den=cross(ab,cd),ac=sub(c,a),eps=1e-8;
 if(Math.abs(den)>eps){const t=cross(ac,cd)/den,u=cross(ac,ab)/den;return t>=-eps&&t<=1+eps&&u>=-eps&&u<=1+eps;}
 if(Math.abs(cross(ac,ab))>eps)return false;
 return Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))+eps && Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))+eps;
}
function validRing(ring) {
 if(!Array.isArray(ring)||ring.length<3||ring.length>100)return false;
 if(ring.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!finite(v)||Math.abs(v)>2000)))return false;
 if(Math.abs(ringArea(ring))<.1)return false;
 for(let i=0;i<ring.length;i++) {
  if(distance(ring[i],ring[(i+1)%ring.length])<.15)return false;
  for(let j=i+1;j<ring.length;j++) {
   if(j===i+1||(i===0&&j===ring.length-1))continue;
   if(touches(ring[i],ring[(i+1)%ring.length],ring[j],ring[(j+1)%ring.length]))return false;
  }
 }
 return true;
}
function objectRing(object,override) {
 const w=override?.w||object.w,h=override?.h||object.h;
 let local;
 if(object.shape==='circle')local=Array.from({length:96},(_,i)=>[Math.cos(i*Math.PI/48)*w/2,Math.sin(i*Math.PI/48)*h/2]);
 else if(object.shape==='rounded'){
  const radius=Math.min(object.radius??1.4,w/2,h/2);local=[];
  for(let k=0;k<4;k++){
   const r=object.corners?.[k]===false?0:radius,a=k*Math.PI/2;
   const cx=(k===0||k===3?1:-1)*(w/2-r),cy=(k<2?1:-1)*(h/2-r);
   if(r===0){local.push([cx,cy]);continue;}
   for(let j=0;j<=16;j++){const t=a+j*Math.PI/32;local.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]);}
  }
 }
 else if(object.shape==='polygon')local=object.vertices.map(p=>[p[0]*w,p[1]*h]);
 else local=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
 const angle=object.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 return local.map(([x,y])=>[object.x+c*x-s*y,object.y+s*x+c*y]);
}
function gateInfo(gate,ring=state.fence) {
 const a=ring[gate.edge],b=ring[(gate.edge+1)%ring.length],len=distance(a,b),width=Math.min(gate.width,Math.max(.1,len-.02));
 const t=limit(gate.t,width/(2*len),1-width/(2*len));
 const u=mul(sub(b,a),1/len),normal=mul([u[1],-u[0]],ringArea(ring)>0?1:-1),mid=add(a,mul(u,t*len));
 return {a:add(mid,mul(u,-width/2)),b:add(mid,mul(u,width/2)),mid,u,normal,len,width,t,from:t*len-width/2,to:t*len+width/2};
}
function mergeIntervals(values) {
 const out=[];
 [...values].sort((a,b)=>a[0]-b[0]).forEach(v=>{const last=out.at(-1);if(last&&v[0]<=last[1])last[1]=Math.max(last[1],v[1]);else out.push([...v]);});return out;
}
function gateIntervals() {return state.fence.map((_,i)=>mergeIntervals(state.gates.filter(g=>g.edge===i).map(g=>{const d=gateInfo(g);return [d.from,d.to];})));}
function validateImport(value) {
 if(!value||value.version!==1||!validRing(value.fence)||!Array.isArray(value.objects)||value.objects.length>200||!Array.isArray(value.gates)||value.gates.length>100)throw Error('Nieprawidłowy plik układu.');
 const ids=new Set();
 for(const o of value.objects) {
  if(!o||typeof o.id!=='string'||ids.has(o.id)||!presets[o.kind]&&o.kind!=='dom'||typeof o.name!=='string'||o.name.length>80)throw Error('Nieprawidłowy element.');
  ids.add(o.id);
  for(const k of ['x','y','w','h','angle'])if(!finite(o[k]))throw Error('Nieprawidłowe wymiary elementu.');
  if(Math.abs(o.x)>2000||Math.abs(o.y)>2000||o.w<.2||o.h<.2||o.w>100||o.h>100||Math.abs(o.angle)>36000)throw Error('Wymiary poza zakresem.');
  if(!['rect','circle','polygon','rounded'].includes(o.shape))throw Error('Nieznany kształt.');
  if(o.shape==='polygon'&&(!Array.isArray(o.vertices)||!validRing(o.vertices.map(p=>[p[0]*o.w,p[1]*o.h]))))throw Error('Nieprawidłowy obrys domu.');
  if(typeof o.color!=='string'||!/^#[0-9a-f]{6}$/i.test(o.color))throw Error('Nieprawidłowy kolor.');
  if(o.corners!==undefined&&(!Array.isArray(o.corners)||o.corners.length!==4||o.corners.some(v=>typeof v!=='boolean')))throw Error('Nieprawidłowe narożniki.');
  if(o.radius!==undefined&&(!finite(o.radius)||o.radius<0||o.radius>100))throw Error('Nieprawidłowe zaokrąglenie.');
  if(o.parts!==undefined){
   if(!Array.isArray(o.parts)||o.parts.length>4)throw Error('Nieprawidłowy zestaw.');
   for(const p of o.parts){if(!['podest','baza'].includes(p.kind)||p.parts)throw Error('Nieprawidłowy składnik.');validateImport({version:1,fence:value.fence,gates:[],objects:[{...p,id:'part',name:p.name||'Podłoże'}]});}
  }
  for(const key of ['safetyW','safetyH'])if(o[key]!==undefined&&(!finite(o[key])||o[key]<.2||o[key]>100))throw Error('Nieprawidłowa rezerwa ruchu.');
 }
 for(const g of value.gates) {
  if(g?.kind!==undefined&&!['gate','wicket'].includes(g.kind))throw Error('Nieprawidłowy typ bramy / furtki.');
  if(!g||typeof g.id!=='string'||ids.has(g.id)||typeof g.name!=='string'||g.name.length>80||!Number.isInteger(g.edge)||g.edge<0||g.edge>=value.fence.length||!finite(g.t)||g.t<0||g.t>1||!finite(g.width)||g.width<.3||g.width>20)throw Error('Nieprawidłowa brama.');ids.add(g.id);
 }
 const result={version:1,fence:clone(value.fence),objects:clone(value.objects),gates:clone(value.gates),grouped:value.grouped===true};
 if(value.walkway!==undefined){
  const w=value.walkway;
  if(!w||!finite(w.x)||!finite(w.y)||Math.abs(w.x)>2000||Math.abs(w.y)>2000||!finite(w.width)||w.width<.2||w.width>10||!Array.isArray(w.gateIds)||w.gateIds.length>100||w.gateIds.some(id=>typeof id!=='string')||new Set(w.gateIds).size!==w.gateIds.length)throw Error('Nieprawidłowy chodnik.');
  if(w.bends!==undefined&&(!Array.isArray(w.bends)||w.bends.length>100||new Set(w.bends.map(b=>b?.gateId)).size!==w.bends.length||w.bends.some(b=>!b||typeof b.gateId!=='string'||!finite(b.dx)||!finite(b.dy)||Math.abs(b.dx)>2000||Math.abs(b.dy)>2000)))throw Error('Nieprawidłowe punkty chodnika.');
  result.walkway=clone(w);
 }
 return groupLegacy(result);
}
let state=initialState(),selection=null,mode='select',view={x:-10,y:-14,w:30,h:28},drag=null,space=false;
let lastFenceClick=null;
let history=[],future=[],renderQueued=false,saveTimer=null,toastTimer=null,lastMetrics=null;
try{const saved=localStorage.getItem(storageKey);if(saved)state=validateImport(JSON.parse(saved));}catch{$('save-status').textContent='Stan startowy';}
const initial=initialState();
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
function persist() {
 clearTimeout(saveTimer);$('save-status').textContent='Zapisywanie…';
 saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));$('save-status').textContent='Zapisano w przeglądarce';}catch{$('save-status').textContent='Zapisz kopię JSON';}},350);
}
function pushHistory(before) {if(JSON.stringify(before)===JSON.stringify(state))return;try{validateImport(state);}catch{state=before;toast('Zmiana wykracza poza obsługiwany zakres. Przywrócono poprzedni układ.');return;}history.push(before);if(history.length>100)history.shift();future=[];persist();updateHistory();}
function updateHistory() {$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function commit(action) {const before=clone(state);action();pushHistory(before);render();}
function undo() {if(!history.length)return;future.push(clone(state));state=history.pop();selection=null;persist();render();}
function redo() {if(!future.length)return;history.push(clone(state));state=future.pop();selection=null;persist();render();}
function findSelected() {return selection?.type==='object'?state.objects.find(o=>o.id===selection.id):selection?.type==='gate'?state.gates.find(g=>g.id===selection.id):null;}
function formatArea(value){return `${number(value)} m²`;}
function walkwayBranches() {
 const w=state.walkway;if(!w)return [];
 return state.gates.filter(g=>w.gateIds.includes(g.id)).map(g=>{
  const start=[w.x,w.y],end=gateInfo(g).mid,mid=mul(add(start,end),.5);
  const bend=w.bends?.find(b=>b.gateId===g.id),offset=bend?[bend.dx,bend.dy]:[0,0];
  return {id:g.id,start,end,mid,handle:add(mid,offset),control:add(mid,mul(offset,2))};
 });
}
function walkwayGeometry() {
 const w=state.walkway;if(!w)return [];
 const shapes=[],r=w.width/2;
 const disk=p=>polygon(Array.from({length:32},(_,i)=>add(p,[r*Math.cos(i*Math.PI/16),r*Math.sin(i*Math.PI/16)])));
 for(const branch of walkwayBranches()){
  const {start,end,control}=branch;
  const steps=limit(Math.ceil((distance(start,control)+distance(control,end))/.3),16,120);
  let previous=start;
  for(let i=1;i<=steps;i++){
   const t=i/steps,q=add(add(mul(start,(1-t)**2),mul(control,2*(1-t)*t)),mul(end,t*t)),d=sub(q,previous),len=distance(q,previous);
   if(len>.00001){
    const angle=Math.atan2(d[1],d[0]),capsule=[];
    for(let j=0;j<=16;j++){const t=angle-Math.PI/2+j*Math.PI/16;capsule.push(add(q,[r*Math.cos(t),r*Math.sin(t)]));}
    for(let j=0;j<=16;j++){const t=angle+Math.PI/2+j*Math.PI/16;capsule.push(add(previous,[r*Math.cos(t),r*Math.sin(t)]));}
    shapes.push(polygon(capsule));
   }previous=q;
  }
 }
 if(!shapes.length)return [];
 shapes.push(disk([w.x,w.y]));
 return pc.intersection(pc.union(...shapes),polygon(state.fence));
}
function walkwayHandles() {
 if(!state.walkway)return '';
 return walkwayBranches().map(b=>`<g data-walkway-bend="${esc(b.id)}" data-walkway-handle="true" style="cursor:move"><title>Przeciągnij, aby płynnie wygiąć odnogę</title><circle cx="${b.handle[0]}" cy="${-b.handle[1]}" r=".23" fill="#fffdf8" stroke="#8b7957" stroke-width=".07"/><circle cx="${b.handle[0]}" cy="${-b.handle[1]}" r=".06" fill="#8b7957" pointer-events="none"/></g>`).join('');
}
function walkwayDrawing() {
 const w=state.walkway;if(!w)return '';
 const area=walkwayGeometry();
 return `<g data-walkway="true" style="cursor:move"><path d="${multiPath(area)}" fill="#c8bd9f" fill-opacity=".48" stroke="#8b7957" stroke-width=".04" stroke-dasharray=".15 .1" fill-rule="evenodd"/>${walkwayPeople()}<circle cx="${w.x}" cy="${-w.y}" r=".25" fill="#8b7957" stroke="#fffdf8" stroke-width=".05"/>${label(w.x,w.y+.5,`Chodnik · ${number(w.width)} m`,.3,'#665431','paint-order="stroke" stroke="#fffdf8" stroke-width=".1"')}</g>`;
}
function compute() {
 const zone=polygon(state.fence),total=Math.abs(ringArea(state.fence));
 const shares=Object.entries(GEO.parcels).map(([id,ring])=>({id,area:polygonArea(pc.intersection(zone,polygon(ring))),parcelArea:Math.abs(ringArea(ring))}));
 const parcelUnion=pc.union(...Object.values(GEO.parcels).map(polygon));
 const outside=pc.difference(zone,parcelUnion);
 const rings=state.objects.map(footprint);
 const union=rings.length?pc.union(...rings):[];
 const occupied=union.length?polygonArea(pc.intersection(zone,union)):0;
 const perimeter=state.fence.reduce((s,p,i)=>s+distance(p,state.fence[(i+1)%state.fence.length]),0);
 const gateLength=gateIntervals().flat().reduce((s,[a,b])=>s+b-a,0);
 const gateSum=state.gates.reduce((s,g)=>s+gateInfo(g).width,0);
 const houseCollision=state.objects.filter(o=>o.kind==='dom').reduce((s,o)=>s+polygonArea(pc.intersection(zone,footprint(o))),0);
 const outsideObjects=state.objects.filter(o=>o.kind!=='dom'&&polygonArea(pc.difference(footprint(o),zone))>.05).map(o=>o.name);
 const walkway=walkwayGeometry(),walkwayArea=polygonArea(walkway);
 const walkwayOverlap=walkway.length&&union.length?polygonArea(pc.intersection(walkway,union)):0;
 const violations=[];
 if(walkwayOverlap>.05)violations.push(`Wirtualny chodnik nakłada się na elementy: ${formatArea(walkwayOverlap)}.`);
 if(polygonArea(outside)>.01)violations.push(`${number(polygonArea(outside))} m² wspólnej części poza trzema działkami.`);
 if(shares.find(s=>s.id==='193').area/total>.50001)violations.push('Udział /193 przekracza 50%.');
 if(houseCollision>.01)violations.push(`Wspólna część nachodzi na dom: ${formatArea(houseCollision)}.`);
 if(gateSum-gateLength>.01)violations.push('Bramy nakładają się. Długość płotu uwzględnia wspólny otwór tylko raz.');
 if(state.gates.some(g=>g.width>gateInfo(g).width+.01))violations.push('Co najmniej jedna brama jest szersza od odcinka płotu; jej światło zostało ograniczone.');
 if(outsideObjects.length)violations.push(`Elementy poza wspólną częścią: ${outsideObjects.join(', ')}.`);
 for(const swing of state.objects.filter(o=>o.kind==='hustawka')) {
  const reserve=polygon(objectRing({...swing,shape:'rect'},{w:swing.safetyW||3,h:swing.safetyH||7}));
  if(polygonArea(pc.difference(reserve,zone))>.01)violations.push('Rezerwa ruchu huśtawki wychodzi poza ogrodzenie.');
  const blockers=state.objects.filter(o=>o.id!==swing.id&&o.category!=='podłoże'&&polygonArea(pc.intersection(reserve,footprint(o)))>.01);
  if(blockers.length)violations.push(`Rezerwa huśtawki koliduje: ${blockers.map(o=>o.name).join(', ')}.`);
 }
 return {total,shares,outside,occupied,walkwayArea,walkwayOverlap,free:Math.max(0,total-occupied),perimeter,gateLength,fenceLength:perimeter-gateLength,violations};
}
function renderMetrics(metrics) {
 $('total-area').textContent=number(metrics.total);
 $('shares').innerHTML=metrics.shares.map(s=>`<tr><td><span class="dot" style="background:${COLORS[s.id]}"></span>/${s.id}</td><td>${number(s.area)}</td><td>${number(s.area/metrics.total*100)}%</td></tr>`).join('');
 $('sharebar').innerHTML=metrics.shares.map(s=>`<span style="width:${s.area/metrics.total*100}%;background:${COLORS[s.id]}"></span>`).join('');
 const rows=[['Chodnik wirtualny (osobno)',formatArea(metrics.walkwayArea)],['Zagospodarowane (bez powtórzeń)',formatArea(metrics.occupied)],['Wolne w obrębie płotu',formatArea(metrics.free)],['Cały obwód',`${number(metrics.perimeter)} m`],['Płot stały',`${number(metrics.fenceLength)} m`],['Otwory bram / furtek',`${number(metrics.gateLength)} m`]];
 $('metrics').innerHTML=rows.map(([a,b])=>`<div class="statline"><span>${a}</span><b>${b}</b></div>`).join('');
 $('warnings').innerHTML=metrics.violations.map(s=>`<div class="warning bad">${esc(s)}</div>`).join('');
 $('parcel-balance').innerHTML=metrics.shares.map(s=>`<div class="statline"><span>/${s.id} cała działka</span><b>${formatArea(s.parcelArea)}</b></div><div class="statline"><span>/${s.id} prywatne</span><b>${formatArea(s.parcelArea-s.area)}</b></div>`).join('');
}
function label(x,y,text,size=.32,color='#203b35',extra='') {return `<text x="${x}" y="${-y}" fill="${color}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" ${extra}>${esc(text)}</text>`;}
function worldLine(a,b,color,width=.04,extra=''){return `<path d="${linePath(a,b)}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;}
function renderParcels() {
 let html='';
 for(const [id,ring] of Object.entries(GEO.parcels)) {
  html+=`<polygon points="${points(ring)}" fill="${COLORS[id]}" fill-opacity=".6" stroke="#839087" stroke-width=".06"/>`;
  const pos={'193':[-20,-22],'190':[-18,27],'191':[24,12]}[id];html+=label(...pos,`775/${id}`,1.1,'#758177','font-weight="bold"');
  for(const field of ['terraces','driveways'])html+=`<polygon points="${points(GEO[field][id])}" fill="${field==='terraces'?'#d9c4a3':'#d3d6ce'}" stroke="#b9bdb2" stroke-width=".025"/>`;
 }
 return html;
}
function personDrawing(x,y,angle=0,scale=1,color='#bd7658',pose='standing') {
 const swimming=pose==='water',seated=pose==='seated';
 return `<g data-person="${pose}" transform="translate(${x},${y}) rotate(${angle}) scale(${scale})" pointer-events="visiblePainted" stroke="#fffaf0" stroke-width=".025" stroke-linecap="round" stroke-linejoin="round">
 <ellipse cx=".025" cy=".04" rx=".29" ry=".23" fill="#203b35" fill-opacity=".12" stroke="none"/>
 ${swimming?'':`<path d="M-.11 .05l-.025 ${seated?'.24':'.16'}M.11 .05l.025 ${seated?'.24':'.16'}" stroke="#394d52" stroke-width=".12"/>`}
 <ellipse cx="0" cy=".025" rx=".255" ry=".145" fill="${swimming?'#d9ad86':color}"/>
 <path d="M-.22 .02l-.09 ${seated?'-.14':'.12'}M.22 .02l.09 ${seated?'-.14':'.12'}" stroke="#d9ad86" stroke-width=".09"/>
 <circle cx="0" cy="-.025" r=".125" fill="#d9ad86"/>
 <path d="M-.105 -.065Q0 -.19 .105 -.065" fill="#514236" stroke="none"/>
 ${swimming?'<path d="M-.29 .22Q0 .29 .29 .22" fill="none" stroke="#e4f6f6" stroke-width=".035"/>':''}</g>`;
}
function objectPeople(o) {
 const child=.72;
 switch(o.kind){
  case 'sauna':return personDrawing(-o.w*.29,-o.h*.23,0,1,'#d8b394','seated')+personDrawing(o.w*.27,-o.h*.23,20,1,'#c58b72','seated');
  case 'balia':return personDrawing(-o.w*.23,-o.h*.14,30,.9,'#d9ad86','water')+personDrawing(o.w*.22,o.h*.17,210,.9,'#d9ad86','water')+personDrawing(o.w/2+.55,.15,-60,1,'#faf3db');
  case 'trampolina':return personDrawing(0,-o.h*.24,20,child,'#e6ac4e');
  case 'hustawka':return personDrawing(0,-1.65*Math.sin(35*Math.PI/180),0,child,'#ca7657','seated');
  case 'siatka':return personDrawing(-o.w*.22,-o.h*.22,-30,child,'#7c9cbd');
  case 'drabinka':return personDrawing(0,-o.h*.24,0,child,'#e6ac4e');
  case 'drazki':return personDrawing(-o.w*.25,-o.h*.2,180,.85,'#7c9cbd');
  case 'scianka':return personDrawing(-o.w*.2,o.h/2+.2,180,child,'#c77b65');
  default:return '';
 }
}
function walkwayPeople() {
 return walkwayBranches().map((b,i)=>{
  const t=.66,q=add(add(mul(b.start,(1-t)**2),mul(b.control,2*(1-t)*t)),mul(b.end,t*t));
  const tangent=add(mul(sub(b.control,b.start),1-t),mul(sub(b.end,b.control),t));
  const angle=90-Math.atan2(tangent[1],tangent[0])*180/Math.PI;
  return personDrawing(q[0],-q[1],angle,1,['#bd7658','#6b8f83','#778da8'][i%3]);
 }).join('');
}
function dimensionText(o) {return o.shape==='circle'?`Ø ${number(o.w,2)} m`:`${number(o.w,2)} × ${number(o.h,2)} m`;}
function renderDimensions() {
 const shown=$('element-dimensions').checked;
 $('dimension-panel').hidden=!shown;
 const objects=state.objects.flatMap(o=>[o,...partsWorld(o)]);
 $('dimension-list').innerHTML=objects.map(o=>`<div class="statline"><span>${esc(o.name)}</span><b>${dimensionText(o)}</b></div>`).join('');
}
function objectDrawing(o) {
 const selected=selection?.type==='object'&&selection.id===o.id;
 const ring=objectRing(o),stroke=selected?'#bc562c':'#53665b';
 let html=partsWorld(o).map(p=>objectDrawing(p).replace(/data-object="[^"]*"/g,`data-object="${esc(o.id)}"`).replace('object locked','object')).join('');
 html+=`<g class="object ${o.locked?'locked':''}" data-object="${esc(o.id)}"><polygon points="${points(ring)}" fill="${esc(o.color)}" fill-opacity="${o.kind==='piasek'?'.85':'1'}" stroke="${stroke}" stroke-width="${selected?.09:.035}"/>`;
 const local=`transform="translate(${o.x},${-o.y}) rotate(${-o.angle})"`;
 html+=`<g ${local} pointer-events="none" stroke="#655d4e" stroke-width=".035" fill="none">`;
 if(o.kind==='podest')for(let y=-o.h/2+.15;y<o.h/2;y+=.2)html+=`<path d="M${-o.w/2},${y}H${o.w/2}" stroke-opacity=".5"/>`;
 if(o.kind==='drabinka')for(let y=-o.h/2+.2;y<o.h/2;y+=.3)html+=`<path d="M${-o.w/2},${y}H${o.w/2}"/>`;
 if(o.kind==='siatka') {for(let x=-o.w/2+.2;x<o.w/2;x+=.25)html+=`<path d="M${x},${-o.h/2}V${o.h/2}"/>`;for(let y=-o.h/2+.2;y<o.h/2;y+=.25)html+=`<path d="M${-o.w/2},${y}H${o.w/2}"/>`;}
 if(o.kind==='drazki')html+=`<path d="M${-o.w/2},${-o.h/2}H${o.w/2}M${-o.w/2},${o.h/2}H${o.w/2}" stroke-width=".09"/>`;
 if(o.kind==='scianka')for(let i=0;i<5;i++)html+=`<circle cx="${-o.w*.4+i*o.w*.2}" cy="${i%2?o.h*.2:-o.h*.2}" r=".055" fill="#786e5f"/>`;
 if(o.kind==='hustawka'){
  const offset=1.65*Math.sin(35*Math.PI/180);
  html+=`<path d="M${-o.w/2},${-o.h/2}V${o.h/2}M${o.w/2},${-o.h/2}V${o.h/2}M${-o.w/2},0H${o.w/2}" stroke-width=".08"/><path d="M-.24 0V${-offset}M.24 0V${-offset}" stroke="#66716a" stroke-width=".045"/><rect x="-.3" y="${-offset-.13}" width=".6" height=".26" fill="#b88b61"/>`;
 }
 if(o.kind==='trampolina'){
  html+=`<circle r="${o.w*.39}" fill="#364c48" stroke="#d4e4dc" stroke-width=".04"/><circle r="${o.w*.46}" stroke-dasharray=".07 .06"/>`;
 }
 if(o.kind==='sauna')html+=`<path d="M${-o.w*.4},${o.h*.25}H${o.w*.3}V${-o.h*.3}" stroke="#e7cdaa" stroke-width=".3"/>`;
 if(o.kind==='balia')html+=`<ellipse cx="0" cy="0" rx="${o.w*.42}" ry="${o.h*.42}" stroke="#ecf8f8"/>`;
 html+=objectPeople(o);html+='</g>';
 const textSize=o.kind==='dom'?.6:o.kind==='piasek'?.44:.32;
 if(o.kind!=='baza'){const y=o.y+(o.kind==='piasek'?o.h/2-.45:0);html+=label(o.x,y,o.name,textSize,'#203b35','font-weight="bold" paint-order="stroke" stroke="#fffdf8" stroke-width=".1" stroke-linejoin="round"');if($('element-dimensions').checked)html+=label(o.x,y-.38,dimensionText(o),o.kind==='podest'?.2:.27,'#a84a26','data-element-dimension="true" paint-order="stroke" stroke="#fffdf8" stroke-width=".11" stroke-linejoin="round"');}
 html+='</g>';
 if(o.kind==='hustawka')html+=`<polygon points="${points(objectRing({...o,shape:'rect'},{w:o.safetyW||3,h:o.safetyH||7}))}" fill="none" stroke="#bc562c" stroke-width=".035" stroke-dasharray=".14 .12" pointer-events="none"/>`;

 return html;
}
function objectHandles(o) {
 const ring=objectRing({...o,shape:'rect'}),corner=ring[2],angle=o.angle*Math.PI/180;
 const rotate=[o.x-Math.sin(angle)*(o.h/2+1),o.y+Math.cos(angle)*(o.h/2+1)];
 const upper=[o.x-Math.sin(angle)*o.h/2,o.y+Math.cos(angle)*o.h/2];
 return worldLine(upper,rotate,'#bc562c',.035)+`<circle data-rotate="${esc(o.id)}" class="rotator" cx="${rotate[0]}" cy="${-rotate[1]}" r=".28" fill="#bc562c" stroke="#fffdf8" stroke-width=".05"/><rect data-resize="${esc(o.id)}" class="handle" x="${corner[0]-.15}" y="${-corner[1]-.15}" width=".3" height=".3" fill="#bc562c" stroke="#fffdf8" stroke-width=".04"/>`;
}
function fenceDrawing() {
 let html='',intervals=gateIntervals();
 state.fence.forEach((a,i)=>{
  const b=state.fence[(i+1)%state.fence.length],len=distance(a,b),u=mul(sub(b,a),1/len);let start=0;
  for(const [from,to] of [...intervals[i],[len,len]]){if(from>start)html+=worldLine(add(a,mul(u,start)),add(a,mul(u,from)),'#203b35',.12);start=to;}
  html+=`<path d="${linePath(a,b)}" class="hit" data-edge="${i}" stroke="transparent" stroke-width=".65" fill="none"/>`;
  if($('dimensions').checked) {
   const n=mul([u[1],-u[0]],ringArea(state.fence)>0?1:-1),p=add(mul(add(a,b),.5),mul(n,.55));
   html+=label(...p,`${number(len,2)} m`,.28,'#526b63','paint-order="stroke" stroke="#fffdf8" stroke-width=".12" stroke-linejoin="round"');
  }
 });
 for(const gate of state.gates) {
  const d=gateInfo(gate),selected=selection?.type==='gate'&&selection.id===gate.id;
  html+=`<g data-gate="${esc(gate.id)}" class="hit">`;
  html+=worldLine(d.a,d.b,'transparent',.7);
  if(gate.open)for(const p of gate.kind==='wicket'?[d.a]:[d.a,d.b])html+=worldLine(p,add(p,mul(d.normal,gate.kind==='wicket'?d.width:d.width/2)),'#bc562c',.1);
  else html+=worldLine(d.a,d.b,'#bc562c',selected?.18:.12);
  html+=`<circle cx="${d.mid[0]}" cy="${-d.mid[1]}" r=".14" fill="#bc562c" stroke="#fffdf8" stroke-width=".04"/>`;
  html+=label(...add(d.mid,mul(d.normal,gate.open?(gate.kind==='wicket'?d.width:d.width/2)+.35:.3)),`${gate.name} · ${number(d.width,2)} m`,.26,'#a84a26','paint-order="stroke" stroke="#fffdf8" stroke-width=".1"');html+='</g>';
 }
 if(mode==='point'||mode==='fence'||selection?.type==='fence'||selection?.type==='vertex')state.fence.forEach((p,i)=>{
  html+=`<circle class="handle" data-vertex="${i}" cx="${p[0]}" cy="${-p[1]}" r=".2" fill="${selection?.type==='vertex'&&selection.index===i?'#bc562c':'#fffdf8'}" stroke="#bc562c" stroke-width=".07"/>`;
  html+=label(p[0]+.32,p[1]+.33,String(i+1),.24,'#a84a26');
 });
 return html;
}
function draw() {
 const svg=$('board');svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
 const metrics=lastMetrics;
 let content=`<defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#879684" stroke-opacity=".16" stroke-width=".02"/></pattern><pattern id="outside" width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M0 .5L.5 0" stroke="#ad3934" stroke-width=".06"/></pattern></defs><rect x="-2100" y="-2100" width="4200" height="4200" fill="#f5f2e9"/>`;
 content+=renderParcels();content+=`<rect x="-2100" y="-2100" width="4200" height="4200" fill="url(#grid)" pointer-events="none"/>`;
 content+=`<polygon data-zone="true" points="${points(state.fence)}" fill="#fffdf8" fill-opacity=".38"/>`;
 if(metrics?.outside.length)content+=`<path d="${multiPath(metrics.outside)}" fill="url(#outside)" fill-rule="evenodd" pointer-events="none"/>`;
 const priority=o=>o.kind==='dom'?0:o.category==='podłoże'?1:2;
 const sorted=[...state.objects].sort((a,b)=>priority(a)-priority(b));
 content+=walkwayDrawing();content+=sorted.map(objectDrawing).join('');
 content+=fenceDrawing();content+=walkwayHandles();const selectedObject=findSelected();if(selection?.type==='object'&&selectedObject&&!selectedObject.locked)content+=objectHandles(selectedObject)+sandCornerLabels(selectedObject);content+=`<path d="M-.3 0H.3M0 -.3V.3" stroke="#9e5471" stroke-width=".05"/>`+label(.5,-.5,'T',.35,'#9e5471');
 const north=[view.x+view.w-2.5,-view.y-2.8],end=add(north,mul(GEO.north,1.5));
 content+=worldLine(north,end,'#203b35',.07)+label(...add(end,mul(GEO.north,.4)),'N',.38,'#203b35','font-weight="bold"');
 svg.innerHTML=content+'<g id="fence-hover"></g>';
}
function field(label,key,value,options={}) {
 const type=options.type||'number';return `<label class="${options.full?'full':''}">${esc(label)}<input data-field="${key}" type="${type}" value="${esc(type==='number'?Number(value.toFixed(3)):value)}" ${type==='number'?`step="${options.step||.1}" min="${options.min??-2000}" max="${options.max??2000}"`:''} ${options.disabled?'disabled':''}></label>`;
}
function cornerControls(o) {
 if(o.kind!=='piasek')return '';
 return `<div class="full"><b>Narożniki piasku</b><p class="quiet">Zaznaczony = zaokrąglony, odznaczony = kanciasty. Numery odpowiadają oznaczeniom na planszy i obracają się z piaskiem.</p></div>`+[0,1,2,3].map(i=>`<label class="check"><input type="checkbox" data-field="corner-${i}" ${o.corners?.[i]!==false?'checked':''} ${o.locked?'disabled':''}>${i+1} · zaokrąglony</label>`).join('');
}
function sandCornerLabels(o) {
 if(o.kind!=='piasek')return '';
 const a=o.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return [0,1,2,3].map(i=>{
  const x=(i===0||i===3?1:-1)*(o.w/2+.35),y=(i<2?1:-1)*(o.h/2+.35);
  return label(o.x+c*x-s*y,o.y+s*x+c*y,String(i+1),.34,'#bc562c','data-corner-label="true" font-weight="bold" paint-order="stroke" stroke="#fffdf8" stroke-width=".12"');
 }).join('');
}
function inspector() {
 const pane=$('inspector'),o=findSelected();
 if(selection?.type==='walkway'&&state.walkway){
  const w=state.walkway;
  pane.innerHTML=`<h2>Wirtualny chodnik</h2><div class="fields">${field('Szerokość · m','pathWidth',w.width,{min:.2,max:10})}${field('Skrzyżowanie X · m','pathX',w.x)}${field('Skrzyżowanie Y · m','pathY',w.y)}</div><p class="quiet">Środkowa kropka przesuwa skrzyżowanie. Białe kropki na trzech odnogach wyginają je w płynne łuki. Odnogi automatycznie łączą go z furtkami. Obrys jest przycięty do płotu. Pole chodnika liczone osobno, bez dodawania do zagospodarowania — to wirtualna rezerwa przejścia. Furtki zachowują własną szerokość.</p>`;return;
 }
 if(selection?.type==='vertex') {
  const p=state.fence[selection.index];if(!p){selection=null;return inspector();}
  pane.innerHTML=`<h2>Narożnik ${selection.index+1}</h2><div class="fields">${field('X · m','vx',p[0])}${field('Y · m','vy',p[1])}</div><div class="row"><button data-action="delete-vertex" class="danger">Usuń narożnik</button></div><p class="quiet">Dwuklik na linii płotu dodaje następny narożnik. Włącz „Do granic”, aby przyciągać go do EGiB.</p>`;return;
 }
 if(selection?.type==='fence') {
  pane.innerHTML=`<h2>Obrys wspólnej części</h2><p class="quiet">${state.fence.length} narożników. Przeciągnij kropki lub dodaj nową dwuklikiem na płocie.</p><div class="row"><button data-action="add-point">＋ Dodaj punkt płotu</button><button data-action="move-zone">Przesuń całą strefę</button><button data-action="all-gates">Otwórz / zamknij przejścia</button></div><p class="quiet">Przesunięcie strefy zabiera wyposażenie. Domy pozostają na miejscu.</p>`;return;
 }
 if(!o){pane.innerHTML='<h2>Twój układ, Twoje decyzje.</h2><p class="quiet">Kliknij wyposażenie, płot lub bramę. Wybierz „Kształt ogrodzenia”, aby zmienić jego obrys.</p>';return;}
 if(selection.type==='gate') {
  const d=gateInfo(o),wicket=o.kind==='wicket';pane.innerHTML=`<h2>${esc(o.name)}</h2><div class="fields">${field('Nazwa','name',o.name,{type:'text',full:true})}<label class="full">Typ przejścia<select data-field="kind"><option value="wicket" ${wicket?'selected':''}>Furtka — jedno skrzydło</option><option value="gate" ${!wicket?'selected':''}>Brama — dwa skrzydła</option></select></label>${field('Światło · m','width',o.width,{min:.3,max:20})}${field('Pozycja na odcinku · %','position',d.t*100,{min:0,max:100,step:1})}<label class="full">Odcinek płotu<select data-field="edge">${state.fence.map((_,i)=>`<option value="${i}" ${o.edge===i?'selected':''}>${i+1} → ${(i+1)%state.fence.length+1}</option>`).join('')}</select></label><label class="full check"><input type="checkbox" data-field="open" ${o.open?'checked':''}>${wicket?'Furtka otwarta':'Brama otwarta'}</label></div><p class="quiet">Rzeczywiste światło: ${number(d.width,2)} m. ${wicket?`Jedno skrzydło ${number(d.width,2)} m`:`Dwa skrzydła po ${number(d.width/2,2)} m`}, otwierane na zewnątrz. Zmiana typu ustawia szerokość 1,2 m / 3 m; możesz ją potem dopasować.</p><div class="row"><button data-action="duplicate">Powiel</button><button data-action="delete" class="danger">Usuń</button></div>`;return;
 }
 const disabled=o.locked;
 const rotationButtons=`<div class="row"><button data-action="rotate-left" ${disabled?'disabled':''}>↶ 15°</button><button data-action="rotate-right" ${disabled?'disabled':''}>↷ 15°</button><button data-action="rotate-quarter" ${disabled?'disabled':''}>↶ 90°</button></div><p class="quiet">Obracaj przyciskami, uchwytem nad elementem lub wpisz kąt. Skrót: R / Shift+R.${o.kind==='piasek'?' Piasek przesuwa i obraca niezablokowane urządzenia, których środek jest na piasku. Każde urządzenie możesz też przesuwać osobno.':''}</p>`;
 pane.innerHTML=`<h2>${esc(o.name)}</h2>${rotationButtons}<div class="fields">${field('Nazwa','name',o.name,{type:'text',full:true})}${field('X · m','x',o.x,{disabled})}${field('Y · m','y',o.y,{disabled})}${field(o.shape==='circle'?'Średnica · m':'Szerokość · m','w',o.w,{min:.2,max:100,disabled})}${o.shape==='circle'?'':field('Głębokość · m','h',o.h,{min:.2,max:100,disabled})}${o.shape==='rounded'?field('Zaokrąglenie · m','radius',o.radius||1.4,{min:.2,max:100,disabled}):''}${cornerControls(o)}${o.parts?.some(p=>p.kind==='podest')?field('Podest: szerokość od ściany · m','deck',o.parts.find(p=>p.kind==='podest').w,{min:.2,max:10,disabled})+field('Podest: długość wzdłuż ściany · m','deckLength',o.parts.find(p=>p.kind==='podest').h,{min:.2,max:100,disabled}):''}${field('Obrót · °','angle',o.angle,{min:-360,max:360,step:5,disabled})}<label class="full check"><input type="checkbox" data-field="locked" ${o.locked?'checked':''}>Zablokuj przesuwanie</label>${o.kind==='hustawka'?field('Rezerwa szer. · m','safetyW',o.safetyW||3,{min:.2,max:100})+field('Rezerwa długość · m','safetyH',o.safetyH||7,{min:.2,max:100}):''}</div><p class="quiet">Ślad elementu: ${formatArea(polygonArea(footprint(o)))}. We wspólnej części: ${formatArea(polygonArea(pc.intersection(footprint(o),polygon(state.fence))))}.</p><div class="row"><button data-action="duplicate">Powiel</button><button data-action="delete" class="danger" ${o.locked?'disabled':''}>Usuń</button></div>`;
}
function renderList() {
 $('object-list').innerHTML=[...state.objects.map(o=>({type:'object',id:o.id,name:o.name,detail:`${o.locked?'▣ ':''}${number(polygonArea(footprint(o)),1)} m²`})),...(state.walkway?[{type:'walkway',id:'walkway',name:'Wirtualny chodnik',detail:formatArea(polygonArea(walkwayGeometry()))}]:[]),...state.gates.map(g=>({type:'gate',id:g.id,name:g.name,detail:`${number(gateInfo(g).width,2)} m`}))].map(o=>`<button class="object-row ${selection?.id===o.id?'selected':''}" data-select="${esc(o.id)}" data-type="${o.type}"><span>${esc(o.name)}</span><span>${o.detail}</span></button>`).join('');
}
function render({panel=true}={}) {
 try{lastMetrics=compute();renderMetrics(lastMetrics);}catch(e){toast('Nie udało się przeliczyć geometrii. Cofnij ostatnią zmianę.');console.error(e);}
 draw();if(panel)inspector();renderList();renderDimensions();updateHistory();
}
function scheduleRender() {if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;render({panel:false});});}
function setMode(next) {
 mode=next;document.body.className=`mode-${mode}`;updateCursor();
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 $('hint').innerHTML={point:'Kliknij linię płotu, aby dodać punkt. Potem przeciągnij punkt, aby załamać ogrodzenie.',select:'Przeciągaj elementy. <strong>Kropka</strong> obraca, <strong>kwadrat</strong> zmienia wymiary.',fence:'Najedź na płot i kliknij <strong>+</strong>, aby dodać punkt. Przeciągaj narożniki. <strong>Dwuklik na płocie</strong> dodaje narożnik. Delete usuwa zaznaczony.',gate:'Kliknij odcinek płotu, aby dodać furtkę. Typ zmienisz w panelu. Przeciągaj ją wzdłuż ogrodzenia.',group:'Przeciągnij wspólną część. <strong>Płot, bramy i wyposażenie</strong> przesuną się razem; domy zostają.',pan:'Przeciągnij mapę. Kółko myszy przybliża i oddala.'}[mode];
 if(mode==='point'||mode==='fence'||mode==='group'){selection={type:'fence'};inspector();}draw();
}
function mapPoint(event) {
 const p=new DOMPoint(event.clientX,event.clientY).matrixTransform($('board').getScreenCTM().inverse());return [p.x,-p.y];
}
function snapPoint(p,boundary=false) {
 let q=$('snap').checked?p.map(n=>Math.round(n*10)/10):[...p];
 if(boundary&&$('magnet').checked){let best={distance:.35};for(const ring of Object.values(GEO.parcels)){const e=nearestEdge(p,ring);if(e.distance<best.distance)best=e;}if(best.point)q=best.point;}
 return q;
}
function fit(rings) {
 const b=bounds(rings.flat()),rect=$('board').getBoundingClientRect(),ratio=rect.width/Math.max(rect.height,1);
 const w=b.maxX-b.minX+8,h=b.maxY-b.minY+8;
 view.w=Math.max(w,h*ratio);view.h=view.w/ratio;view.x=(b.minX+b.maxX-view.w)/2;view.y=-(b.minY+b.maxY+view.h)/2;draw();
}
function zoom(factor,point) {
 const anchor=point||[view.x+view.w/2,-view.y-view.h/2];
 const newW=limit(view.w*factor,8,220),f=newW/view.w;
 view.x=anchor[0]-(anchor[0]-view.x)*f;view.y=-anchor[1]-(-anchor[1]-view.y)*f;view.w=newW;view.h*=f;draw();
}
function addObject(kind) {if(state.objects.length>=200){toast('Limit 200 elementów.');return;}const p=center(state.fence);commit(()=>{const o=makeObject(kind,...p,`obj-${cryptoId()}`);state.objects.push(o);selection={type:'object',id:o.id};});setMode('select');}
function cryptoId(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function remapGates(oldRing) {
 const positions=state.gates.map(g=>gateInfo(g,oldRing).mid);
 state.gates.forEach((g,i)=>{const e=nearestEdge(positions[i],state.fence);g.edge=e.edge;g.t=e.t;});
}
function deleteVertex() {
 if(selection?.type!=='vertex'||state.fence.length<=3){toast('Ogrodzenie musi mieć co najmniej 3 narożniki.');return;}
 const old=clone(state.fence),next=old.filter((_,i)=>i!==selection.index);
 if(!validRing(next)){toast('Usunięcie utworzyłoby przecinający się obrys.');return;}
 commit(()=>{state.fence=next;remapGates(old);selection={type:'fence'};});
}
function removeSelected() {
 if(selection?.type==='vertex')return deleteVertex();
 const o=findSelected();if(!o)return;
 if(o.locked){toast('Najpierw odblokuj element.');return;}
 commit(()=>{if(selection.type==='object')state.objects=state.objects.filter(x=>x.id!==o.id);else state.gates=state.gates.filter(g=>g.id!==o.id);selection=null;});
}
function duplicate() {
 const o=findSelected();if(!o)return;const limitHit=selection.type==='object'?state.objects.length>=200:state.gates.length>=100;if(limitHit){toast('Osiągnięto limit elementów.');return;}commit(()=>{const copy=clone(o);copy.id=cryptoId();copy.name=copy.name.slice(0,72)+' — kopia';if(selection.type==='object'){copy.x+=1;copy.y-=1;copy.locked=false;state.objects.push(copy);}else{copy.t=limit(copy.t+.2,0,1);state.gates.push(copy);}selection.id=copy.id;});
}
function insertFencePoint(point) {
 const near=nearestEdge(point,state.fence),next=clone(state.fence);next.splice(near.edge+1,0,near.point);
 if(!validRing(next))return;
 commit(()=>{const old=state.fence;state.fence=next;remapGates(old);selection={type:'vertex',index:near.edge+1};});
}
function clearFenceHover() {const layer=$('fence-hover');if(layer)layer.replaceChildren();}
function showFenceHover(event,point) {
 const layer=$('fence-hover');if(!layer)return;
 if(space||drag||['gate','pan','group'].includes(mode)||event.pointerType==='touch'){clearFenceHover();return;}
 const target=event.target.closest('[data-edge],[data-add-point]');
 if(!target){clearFenceHover();return;}
 const edge=Number(target.dataset.edge??target.dataset.addPoint),a=state.fence[edge],b=state.fence[(edge+1)%state.fence.length];
 const near=project(point,a,b),length=distance(a,b),along=near.t*length;
 if(distance(near.point,a)<.3||distance(near.point,b)<.3||gateIntervals()[edge].some(([from,to])=>along>=from-.2&&along<=to+.2)){clearFenceHover();return;}
 const radius=view.w/Math.max($('board').getBoundingClientRect().width,1)*11;
 layer.innerHTML=`<g data-add-point="${edge}" transform="translate(${near.point[0]},${-near.point[1]})" style="cursor:pointer"><title>Dodaj punkt płotu</title><circle r="${radius}" fill="#bc562c" stroke="#fffdf8" stroke-width="${radius*.15}"/><path d="M${-radius*.45} 0H${radius*.45}M0 ${-radius*.45}V${radius*.45}" stroke="#fffdf8" stroke-width="${radius*.15}" pointer-events="none"/></g>`;
}
function beginDrag(event) {
 if(event.button!==0&&event.button!==1)return;
 const point=mapPoint(event),target=event.target,base={before:clone(state),start:point,client:[event.clientX,event.clientY],view:clone(view),moved:false};
 if(!space&&event.button===0&&target.closest('[data-object],[data-walkway],[data-walkway-bend]'))setMode('select');
 if(!space&&event.button===0&&target.closest('[data-add-point]')){setMode('fence');insertFencePoint(point);event.preventDefault();return;}
 clearFenceHover();
 if(mode==='point'&&target.dataset.edge!==undefined&&!space){insertFencePoint(point);setMode('fence');event.preventDefault();return;}
 if(mode==='fence'&&target.dataset.edge!==undefined&&!space){
  if(lastFenceClick&&event.timeStamp-lastFenceClick.time<450&&distance(point,lastFenceClick.point)<.4){insertFencePoint(point);lastFenceClick=null;event.preventDefault();return;}
  lastFenceClick={time:event.timeStamp,point};
 }else lastFenceClick=null;
 if(space||mode==='pan'||event.button===1){drag={...base,type:'pan'};}
 else if(target.closest('[data-walkway-bend]')){selection={type:'walkway'};drag={...base,type:'walkway-bend',id:target.closest('[data-walkway-bend]').dataset.walkwayBend};}
 else if(target.closest('[data-walkway]')){selection={type:'walkway'};drag={...base,type:'walkway'};}
 else if(mode==='group'&&target.closest('[data-zone],[data-inactive],[data-edge],[data-gate]'))drag={...base,type:'group'};
 else if(target.dataset.vertex!==undefined){selection={type:'vertex',index:Number(target.dataset.vertex)};drag={...base,type:'vertex',index:selection.index};}
 else if(target.dataset.rotate){selection={type:'object',id:target.dataset.rotate};drag={...base,type:'rotate',id:selection.id};}
 else if(target.dataset.resize){selection={type:'object',id:target.dataset.resize};drag={...base,type:'resize',id:selection.id};}
 else if(target.closest('[data-gate]')){selection={type:'gate',id:target.closest('[data-gate]').dataset.gate};drag={...base,type:'gate',id:selection.id};}
 else if(target.dataset.edge!==undefined&&mode==='gate') {
  if(state.gates.length>=100){toast('Limit 100 bram.');return;}
  commit(()=>{const e=nearestEdge(point,state.fence),g={id:cryptoId(),name:'Furtka',kind:'wicket',edge:e.edge,t:e.t,width:1.2,open:false};state.gates.push(g);selection={type:'gate',id:g.id};});setMode('select');return;
 } else if(target.dataset.edge!==undefined){selection={type:'fence'};setMode('fence');}
 else if(target.closest('[data-object]')&&mode==='select') {
  selection={type:'object',id:target.closest('[data-object]').dataset.object};const o=findSelected();if(!o.locked)drag={...base,type:'object',id:o.id};
 } else if(target.dataset.zone){selection={type:'fence'};if(mode==='fence')drag={...base,type:'fence-move'};}
 else selection=null;
 updateCursor();
 if(drag)$('board').setPointerCapture(event.pointerId);
 event.preventDefault();render();
}
function onSand(point,ring) {
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
  const a=ring[i],b=ring[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function moveSandContents(before,o) {
 if(o.kind!=='piasek')return;
 const old=before.objects.find(p=>p.id===o.id),ring=objectRing(old);
 const angle=(o.angle-old.angle)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 for(const original of before.objects) {
  if(original.id===o.id||original.locked||original.kind==='dom'||original.category==='podłoże'||!onSand([original.x,original.y],ring))continue;
  const item=state.objects.find(p=>p.id===original.id),dx=original.x-old.x,dy=original.y-old.y;
  item.x=o.x+c*dx-s*dy;item.y=o.y+s*dx+c*dy;item.angle=original.angle+o.angle-old.angle;
 }
}
function rotateSelected(degrees) {
 const o=findSelected();if(selection?.type!=='object'||!o||o.locked)return;
 const before=clone(state);
 commit(()=>{o.angle=((o.angle+degrees)%360+360)%360;moveSandContents(before,o);});
}
function syncParts(o) {
 for(const p of o.parts||[]){if(p.kind==='podest'){p.x=-o.w/2-p.w/2;p.y=0;p.angle=0;}else if(p.kind==='baza'){p.w=o.w+.6;p.h=o.h+.6;}}
}
function moveDrag(event) {
 const point=mapPoint(event);$('cursor-pos').textContent=`X ${number(point[0],2)} m · Y ${number(point[1],2)} m · T = trójstyk`;
 if(!drag){showFenceHover(event,point);return;}
 if(distance([event.clientX,event.clientY],drag.client)<2&&!drag.moved)return;
 drag.moved=true;
 if(drag.type==='pan'){const p=mapPoint(event),delta=sub(p,drag.start);view.x-=delta[0];view.y+=delta[1];draw();return;}
 const delta=sub(point,drag.start);
 if(drag.type==='walkway-bend'){const b=walkwayBranches().find(b=>b.id===drag.id),q=snapPoint(point),offset=sub(q,b.mid);state.walkway.bends=(state.walkway.bends||[]).filter(b=>b.gateId!==drag.id);state.walkway.bends.push({gateId:drag.id,dx:offset[0],dy:offset[1]});
 } else if(drag.type==='walkway'){const q=snapPoint(add([drag.before.walkway.x,drag.before.walkway.y],delta));state.walkway.x=q[0];state.walkway.y=q[1];
 } else if(drag.type==='object'){
  const original=drag.before.objects.find(o=>o.id===drag.id),o=state.objects.find(o=>o.id===drag.id),q=snapPoint(add([original.x,original.y],delta));o.x=q[0];o.y=q[1];moveSandContents(drag.before,o);
 } else if(drag.type==='vertex'){
  const next=clone(state.fence);next[drag.index]=snapPoint(point,true);
  if(validRing(next))state.fence=next;else $('hint').textContent='Ten ruch przecinałby płot. Narożnik pozostaje w ostatnim poprawnym miejscu.';
 } else if(drag.type==='gate'){
  const near=nearestEdge(point,state.fence),g=state.gates.find(g=>g.id===drag.id);g.edge=near.edge;g.t=near.t;
 } else if(drag.type==='rotate'){
  const o=state.objects.find(o=>o.id===drag.id);let angle=Math.atan2(point[1]-o.y,point[0]-o.x)*180/Math.PI-90;o.angle=$('snap').checked?Math.round(angle/5)*5:angle;moveSandContents(drag.before,o);
 } else if(drag.type==='resize'){
  const o=state.objects.find(o=>o.id===drag.id),r=-o.angle*Math.PI/180,d=sub(point,[o.x,o.y]);
  let w=2*Math.abs(d[0]*Math.cos(r)-d[1]*Math.sin(r)),h=2*Math.abs(d[0]*Math.sin(r)+d[1]*Math.cos(r));
  if($('snap').checked){w=Math.round(w*10)/10;h=Math.round(h*10)/10;}o.w=limit(w,.2,100);o.h=o.shape==='circle'?o.w:limit(h,.2,100);syncParts(o);
 } else if(drag.type==='group'||drag.type==='fence-move'){
  const d=snapPoint(delta);state.fence=drag.before.fence.map(p=>add(p,d));if(state.walkway){state.walkway.x=drag.before.walkway.x+d[0];state.walkway.y=drag.before.walkway.y+d[1];}
  if(drag.type==='group')state.objects.forEach((o,i)=>{if(o.kind!=='dom'){o.x=drag.before.objects[i].x+d[0];o.y=drag.before.objects[i].y+d[1];}});
 }
 scheduleRender();
}
function endDrag(event) {
 if(!drag)return;const previous=drag;drag=null;updateCursor();
 if($('board').hasPointerCapture(event.pointerId))$('board').releasePointerCapture(event.pointerId);
 if(previous.type!=='pan')pushHistory(previous.before);
 render();
}
function updateField(event) {
 const input=event.target,key=input.dataset.field;if(!key)return;
 if(selection?.type==='walkway'&&state.walkway){const value=Number(input.value);if(!finite(value))return;const k={pathWidth:'width',pathX:'x',pathY:'y'}[key];if(k)commit(()=>state.walkway[k]=limit(value,k==='width'?.2:-2000,k==='width'?10:2000));return;}
 if(selection?.type==='vertex') {
  const value=Number(input.value);if(!finite(value))return;const next=clone(state.fence);next[selection.index][key==='vx'?0:1]=value;
  if(!validRing(next)){toast('Narożnik tworzy nieprawidłowy obrys.');inspector();return;}commit(()=>state.fence=next);return;
 }
 const o=findSelected();if(!o)return;
 if(/^corner-[0-3]$/.test(key)){if(selection.type==='object'&&o.kind==='piasek'&&!o.locked)commit(()=>{o.corners=o.corners||[true,true,true,true];o.corners[Number(key.slice(-1))]=input.checked;});return;}
 const before=clone(state);
 const value=input.type==='checkbox'?input.checked:key==='name'?input.value.slice(0,80):key==='kind'?input.value:Number(input.value);
 if(typeof value==='number'&&!finite(value)){inspector();return;}
 commit(()=>{
  if(selection.type==='gate') {
   if(key==='kind'){if(!['gate','wicket'].includes(value))return;o.kind=value;o.width=value==='wicket'?1.2:3;o.name=o.name.replace(/^(Brama|Furtka)/,value==='wicket'?'Furtka':'Brama');}else if(key==='position')o.t=limit(value/100,0,1);else if(key==='edge'){o.edge=limit(Math.round(value),0,state.fence.length-1);o.t=.5;}else if(key==='width')o.width=limit(value,.3,20);else if(['name','open'].includes(key))o[key]=value;
  } else {
   if(key==='locked'||key==='name')o[key]=value;
   else if(!o.locked){if(key==='deck'||key==='deckLength'){const p=o.parts?.find(p=>p.kind==='podest');if(p)p[key==='deck'?'w':'h']=limit(value,.2,key==='deck'?10:100);}else if(['w','h','safetyW','safetyH','radius'].includes(key))o[key]=limit(value,.2,100);else if(key==='angle')o.angle=((value+180)%360+360)%360-180;else if(['x','y'].includes(key))o[key]=limit(value,-2000,2000);if(o.shape==='circle'&&['w','h'].includes(key))o.w=o.h=limit(value,.2,100);if(['w','h','deck','deckLength'].includes(key))syncParts(o);if(['x','y','angle'].includes(key))moveSandContents(before,o);}
  }
 });
}
function download(filename,content,type) {
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportSvg() {
 const oldSelection=selection,oldMode=mode;selection=null;mode='select';draw();const copy=$('board').cloneNode(true);selection=oldSelection;mode=oldMode;draw();
 copy.setAttribute('width','1600');copy.setAttribute('height',String(Math.round(1600*view.h/view.w)));
 copy.querySelectorAll('[data-edge],#fence-hover,[data-walkway-handle]').forEach(e=>e.remove());
 copy.insertAdjacentHTML('afterbegin',`<title>Trójstyk — ${number(lastMetrics.total)} m² wspólne</title><style>text{font-family:Trebuchet MS,sans-serif}</style>`);
 download('moj-ogrod.svg',new XMLSerializer().serializeToString(copy),'image/svg+xml');
}
async function importFile(event) {
 const file=event.target.files[0];event.target.value='';if(!file)return;
 if(file.size>2000000){toast('Plik jest za duży. Limit 2 MB.');return;}
 try{const next=validateImport(JSON.parse(await file.text()));commit(()=>{state=next;selection=null;});fit([state.fence]);toast('Układ został wczytany.');}catch(error){toast(error.message||'Nie można wczytać pliku.');}
}
function updateCursor() {
 if(space)clearFenceHover();
 document.body.classList.toggle('space-pan',space);
 document.body.classList.toggle('panning',drag?.type==='pan');
}
function keydown(event) {
 if(event.target.closest('input,select,textarea'))return;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
 if(event.code==='Space'){space=true;updateCursor();event.preventDefault();return;}
 if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeSelected();return;}
 if(event.key==='Escape'){selection=null;setMode('select');render();return;}
 const o=findSelected();if(!o||selection.type!=='object'||o.locked)return;
 const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]},d=steps[event.key];
 if(d){event.preventDefault();const before=clone(state);commit(()=>{o.x+=d[0]*(event.shiftKey?1:.1);o.y+=d[1]*(event.shiftKey?1:.1);moveSandContents(before,o);});}
 if(event.key.toLowerCase()==='r')rotateSelected(event.shiftKey?-15:15);
}
function bind() {
 $('palette').innerHTML=Object.entries(presets).filter(([key])=>key!=='baza').map(([key,p])=>`<button data-add="${key}"><b>＋</b>${p.name}</button>`).join('');
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
 $('palette').onclick=e=>{const b=e.target.closest('[data-add]');if(b)addObject(b.dataset.add);};
 $('inspector').addEventListener('change',updateField);
 $('inspector').onclick=e=>{const action=e.target.dataset.action;const handlers={'rotate-left':()=>rotateSelected(15),'rotate-right':()=>rotateSelected(-15),'rotate-quarter':()=>rotateSelected(90),'add-point':()=>setMode('point'),'delete':removeSelected,'duplicate':duplicate,'delete-vertex':deleteVertex,'move-zone':()=>setMode('group'),'all-gates':()=>commit(()=>{const open=state.gates.some(g=>!g.open);state.gates.forEach(g=>g.open=open);})};handlers[action]?.();};
 $('object-list').onclick=e=>{const b=e.target.closest('[data-select]');if(b){selection={type:b.dataset.type,id:b.dataset.select};setMode('select');render();}};
 $('board').addEventListener('pointerdown',beginDrag);$('board').addEventListener('pointermove',moveDrag);$('board').addEventListener('pointerup',endDrag);$('board').addEventListener('pointercancel',endDrag);$('board').addEventListener('pointerleave',clearFenceHover);

 $('board').addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(limit(e.deltaY,-150,150)*.003),mapPoint(e));},{passive:false});
 $('undo').onclick=undo;$('redo').onclick=redo;$('fit-zone').onclick=()=>fit([state.fence]);$('fit-all').onclick=()=>fit(Object.values(GEO.parcels));$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);$('dimensions').onchange=draw;$('element-dimensions').onchange=()=>{draw();renderDimensions();};
 $('save-json').onclick=()=>download('moj-ogrod.json',JSON.stringify(state,null,2),'application/json');$('load-json').onclick=()=>$('file-input').click();$('file-input').onchange=importFile;$('export-svg').onclick=exportSvg;
 $('reset').onclick=()=>{if(confirm('Przywrócić układ startowy? Możesz potem cofnąć tę zmianę.')){commit(()=>{state=clone(initial);selection=null;});fit([state.fence]);}};
 document.addEventListener('keydown',keydown);document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;updateCursor();}});window.addEventListener('blur',()=>{space=false;if(drag?.type==='pan')drag=null;updateCursor();});
}
bind();render();fit([state.fence]);
window.gardenEditor={snapshot:()=>clone(state),metrics:()=>clone(compute()),validate:validateImport,ringArea,polygonArea,objectRing,footprint,walkwayGeometry,walkwayBranches,initialState,geometry:clone(GEO)};
})();
