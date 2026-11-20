const curbWidth193 = .10, curbRise193 = .035, curbJoint193 = .006;
const curbPoint = (a,b,t) => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t];
const curbDistance = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);

function iconEntryGrade193(ring) {
  const door=ring[0], apron=ring.at(-2);
  const dx=door[0]-apron[0], dy=door[1]-apron[1], squared=dx*dx+dy*dy;
  return (x,y)=>.045+.035*((x-apron[0])*dx+(y-apron[1])*dy)/squared;
}

export function gradeIconEntry193(mesh,ring) {
  const height=iconEntryGrade193(ring), positions=mesh.geometry.attributes.position;
  for (let i=0;i<positions.count;i++) {
    positions.setZ(i,height(positions.getX(i),positions.getY(i))-mesh.position.z);
  }
  positions.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
}

function graniteExposedEdges(ring, boundaries, elevation) {
  const result = [];
  const area = ring.slice(1).reduce((sum,b,i) => sum + ring[i][0]*b[1] - b[0]*ring[i][1],0);
  for (let i=1;i<ring.length;i++) {
    const a=ring[i-1], b=ring[i], length=curbDistance(a,b);
    const ux=(b[0]-a[0])/length, uy=(b[1]-a[1])/length, blocked=[];
    for (const path of boundaries) for (let j=1;j<path.length;j++) {
      const p=path[j-1], q=path[j];
      const off=r => Math.abs((r[0]-a[0])*uy-(r[1]-a[1])*ux);
      if (off(p)>.0001 || off(q)>.0001) continue;
      const project=r => (r[0]-a[0])*ux+(r[1]-a[1])*uy;
      const [lo,hi]=[project(p),project(q)].sort((x,y)=>x-y);
      if (hi>0 && lo<length) blocked.push([Math.max(0,lo),Math.min(length,hi)]);
    }
    let start=0;
    const add=end=>{
      if (end-start>.001) result.push({a:curbPoint(a,b,start/length),b:curbPoint(a,b,end/length),
        normal:[-uy*Math.sign(area),ux*Math.sign(area)],elevation});
    };
    for (const [lo,hi] of blocked.sort((p,q)=>p[0]-q[0])) {
      add(lo); start=Math.max(start,hi);
    }
    add(length);
  }
  return result;
}

function graniteCurbBlocks(edges) {
  const blocks=[];
  for (const edge of edges) {
    const {a,b,normal,elevation}=edge;
    const corner=p=>{
      const other=edges.find(e=>e!==edge && (curbDistance(e.a,p)<.001 || curbDistance(e.b,p)<.001));
      if (!other) return null;
      const n=other.normal, divisor=1+normal[0]*n[0]+normal[1]*n[1];
      return [(normal[0]+n[0])/divisor,(normal[1]+n[1])/divisor];
    };
    const start=corner(a), end=corner(b), length=curbDistance(a,b), count=Math.max(1,Math.round(length/.50));
    for (let i=0;i<count;i++) {
      const lo=i/count+(i || start ? curbJoint193/(2*length) : 0);
      const hi=(i+1)/count-(i+1<count || end ? curbJoint193/(2*length) : 0);
      const crossSection=(t,n)=>{
        const p=curbPoint(a,b,t), z=elevation(...p);
        const point=(offset,height)=>[p[0]+n[0]*offset,p[1]+n[1]*offset,height];
        return [point(0,z-.025),point(0,z+curbRise193-.008),point(.008,z+curbRise193),
          point(curbWidth193-.008,z+curbRise193),point(curbWidth193,z+curbRise193-.008),point(curbWidth193,z-.025)];
      };
      blocks.push([crossSection(lo,i===0 && start || normal),crossSection(hi,i===count-1 && end || normal)]);
    }
  }
  return blocks;
}

export function createIconGraniteCurbs(THREE,plot,gate) {
  const drive=plot.driveway.coordinates[0], entry=plot.entry.coordinates[0], building=plot.house.coordinates[0];
  const edges=[...graniteExposedEdges(drive,[building,entry,gate.points],()=>.045),
    ...graniteExposedEdges(entry,[building,drive,gate.points],iconEntryGrade193(entry))];
  const positions=[], colors=[];
  // Stop short of the sliding gate rail and both posts across its full opening.
  for (const edge of edges) {
    for (const [end,other] of [['a','b'],['b','a']]) {
      if (gate.points.some(p=>curbDistance(p,edge[end])<.001)) {
        edge[end]=curbPoint(edge[end],edge[other],.14/curbDistance(edge.a,edge.b));
      }
    }
  }
  const blocks=graniteCurbBlocks(edges);
  for (const [i,[a,b]] of blocks.entries()) {
    const tint=.88+.12*((i*17%29)/28);
    const triangle=(p,q,r)=>{
      positions.push(...p,...r,...q); colors.push(...Array(9).fill(tint));
    };
    for (let j=0;j<a.length-1;j++) {
      triangle(a[j],b[j],b[j+1]); triangle(a[j],b[j+1],a[j+1]);
    }
    for (let j=1;j<a.length-1;j++) {
      triangle(a[0],a[j],a[j+1]); triangle(b[0],b[j+1],b[j]);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,side:THREE.DoubleSide,vertexColors:true}));
  mesh.name='icon-granite-curb-193';mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={parcel:'193',widthM:curbWidth193,riseM:curbRise193,jointM:curbJoint193,blocks:blocks.length};
  return mesh;
}
