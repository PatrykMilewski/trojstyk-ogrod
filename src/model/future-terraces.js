import {streetBatch} from './neighborhood-details.js';

function terraceFrame(terrace) {
  const angle=terrace.angle*Math.PI/180, cs=Math.cos(angle), sn=Math.sin(angle);
  const [cx,cy]=terrace.center;
  return {angle,point:(u,v)=>[cx+u*cs-v*sn,cy+u*sn+v*cs]};
}

function terraceBenches(batch,frame,width,depth,seating,obstacles,parcel) {
  const length=Math.min(seating==='dining'?1.75:1.95,width-.55);
  const spacing=Math.min(.92,(depth-.70)/2), top=seating==='dining'?.77:.45;
  const wood='#ae8057', metal='#494a43';
  const box=(u,v,z,w,d,h,color)=>batch.box(frame,u,v,z+.09,w,d,h,color,'meble tarasowe');
  const block=(x,y,w,d)=>obstacles.push({parcel,footprint:{coordinates:[[
    frame.point(x-w/2,y-d/2),frame.point(x+w/2,y-d/2),
    frame.point(x+w/2,y+d/2),frame.point(x-w/2,y+d/2)
  ]]}});
  const tableWidth=length*(seating==='dining'?.92:.57), tableDepth=seating==='dining'?.70:.44;
  box(0,0,top,tableWidth,tableDepth,.055,wood);
  for(const side of [-1,1]) {
    box(side*tableWidth*.37,0,top/2,.075,tableDepth*.80,top,metal);
    const y=side*spacing;
    for(let slat=-1;slat<=1;slat++) box(0,y+slat*.135,.43,length,.128,.065,wood);
    for(const end of [-1,1]) box(end*length*.39,y,.215,.082,.36,.43,metal);
    if(seating==='lounge') {
      box(0,y,.50,length-.05,.37,.095,'#bbb7aa');
      box(0,y+side*.20,.68,length,.09,.38,wood);
    }
    block(0,y,length,.46);
  }
  block(0,0,tableWidth,tableDepth);
}

export function addGardenTerraces(THREE,group,lots) {
  const furnishings=new THREE.Group(), obstacles=[];
  furnishings.name='Tarasy i miejsca wypoczynku';
  const batch=streetBatch(THREE,furnishings);
  for(const lot of lots) for(const terrace of lot.terraces??[]) {
    const {width,depth,finish,seating}=terrace, frame=terraceFrame(terrace);
    const timber=finish==='timber', count=Math.ceil(depth/(timber?.145:.55)), step=depth/count;
    for(let i=0;i<count;i++) {
      const y=(i+.5)*step-depth/2;
      if(timber) batch.box(frame,0,y,.05,width,step-.004,.08,['#a28261','#aa8967','#ad8d70'][i%3],'deski tarasowe');
      else {
        const columns=Math.ceil(width/.80), tileWidth=width/columns;
        for(let j=0;j<columns;j++) batch.box(frame,(j+.5)*tileWidth-width/2,y,.05,tileWidth-.009,step-.009,.08,
          ['#c0b7a4','#c5bcad','#bcb3a4'][(i+j)%3],'płyty tarasowe');
      }
    }
    terraceBenches(batch,frame,width,depth,seating,obstacles,lot.parcel);
  }
  batch.finish();group.add(furnishings);
  return obstacles;
}
