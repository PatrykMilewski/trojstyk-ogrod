export function woodyRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Each cutout is a branching spray with individual pointed leaves and a lighter midrib.
function woodySprayTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = woodyRandom(37431);
  function stroke(x, y, endX, endY, width, color) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function leaf(x, y, angle, length) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(length * .22, -length * .31, length * .67, -length * .27, length, 0);
    ctx.bezierCurveTo(length * .63, length * .34, length * .25, length * .30, 0, 0);
    ctx.fillStyle = ['#b2c975', '#95b05d', '#bdce89', '#9cb66c', '#adc47b'][Math.floor(random() * 5)];
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(length * .25, length * .30, length * .63, length * .34, length, 0);
    ctx.fillStyle = 'rgba(40,70,28,.15)';
    ctx.fill();
    for (const fraction of [.27,.47,.67]) {
      const reach = length * .16 * Math.sin(fraction * Math.PI);
      for (const side of [-1,1]) stroke(length*fraction, 0, length*fraction+reach, side*reach, .65, '#98a86b');
    }
    stroke(0, 0, length * .9, 0, .8, '#bace8c');
    ctx.restore();
  }
  const stems = [[122,245,119,168],[119,168,85,112],[85,112,44,65],
    [85,112,90,51],[119,168,153,109],[153,109,187,60],[153,109,141,46],
    [119,168,171,163],[171,163,212,122],[119,168,76,167],[76,167,36,133]];
  for (const [x,y,ex,ey] of stems) {
    stroke(x,y,ex,ey,1.6,'#8e8766');
    const yaw=Math.atan2(ey-y,ex-x);
    for (let k=0;k<4;k++) {
      const t=.27+.21*k, side=k%2 ? -1 : 1;
      const a=yaw+side*(.65+random()*.71);
      leaf(x+(ex-x)*t,y+(ey-y)*t,a,19+random()*14);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function woodyPlantBatches(THREE, group, records, name) {
  if (!records.length) return;
  const branches = [], sprays = [];
  const tau = Math.PI * 2;
  function build(record) {
    const [x, y] = record.center, h = record.height, r = record.crownRadius;
    const random = woodyRandom(Math.imul(Math.round(x * 100), 73856093) ^ Math.imul(Math.round(y * 100), 19349663));
    const phase = tau * random(), startingBranch = branches.length, startingSpray = sprays.length;
    const point = (a, radius, z) => new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z);
    const branch = (start, end, width) => branches.push({start, end, width});
    const barkWidth = Math.min(h * .021, r * .097);
    const tint = new THREE.Color(record.color || ['#a7b584','#afbf90','#b9bf86','#a8bc90'][Math.floor(random()*4)]);
    const garden = name === 'garden';
    const root = point(phase,0,0);
    const fork = point(phase+.4,r*(garden ? .035 : .09),h*(garden ? .09 : .30));
    branch(root,fork,barkWidth*(garden ? .86 : 1.08));
    const leaders = garden ? 3 : 4;
    for (let leader=0;leader<leaders;leader++) {
      const heading=phase+leader*tau/leaders+(random()-.5)*.40;
      const lean=(.27+.18*random())*r;
      const leaderTop=h*(leader===0 ? .95 : .74+.19*random());
      let joint=fork;
      const levels=garden ? 5 : 6;
      for (let n=0;n<levels;n++) {
        const t=(n+1)/levels;
        const next=point(heading+.16*Math.sin(t*4+leader),lean*Math.sin(t*1.8),
          fork.z+(leaderTop-fork.z)*t);
        branch(joint,next,barkWidth*(garden ? .66 : .61)*(1-.87*n/levels));
        joint=next;
        for (let j=0;j<2;j++) {
          const a=heading+(j ? -1 : 1)*(.25+random()*1.23);
          const reach=r*(.33+.36*Math.sin(t*Math.PI))*(.72+.5*random());
          const elbow=joint.clone().add(point(a-.17,reach*.50,h*(.02+.05*random())));
          const twig=elbow.clone().add(point(a+.23,reach*.50,h*(.015+.06*random())));
          branch(joint,elbow,barkWidth*(.23-.095*t));
          branch(elbow,twig,barkWidth*(.14-.055*t));
          for (let k=0;k<7;k++) {
            const fan=a+(random()-.5)*3.2, pitch=(random()-.48)*1.65;
            const width=r*(.41+.26*random());
            const length=r*(.40+.21*random());
            const across=point(fan+Math.PI/2,width,0);
            const up=point(fan,length*Math.cos(pitch),length*Math.sin(pitch));
            const roll=(random()-.5)*1.9;
            across.applyAxisAngle(up.clone().normalize(),roll);
            const origin=elbow.clone().lerp(twig,.20+.85*random()).addScaledVector(across,-.5);
            const color=tint.clone().multiplyScalar(1.08+.15*t+.25*random());
            sprays.push({origin,across,up,color});
          }
        }
      }
    }
    // Normalize the actual spray corners so asymmetry never changes the specified crown envelope.
    let radial = 0, top = 0;
    for (let i = startingSpray; i < sprays.length; i++) {
      const {origin,across,up} = sprays[i];
      for (const u of [0,1]) for (const v of [0,1]) {
        const p = origin.clone().addScaledVector(across,u).addScaledVector(up,v);
        radial = Math.max(radial,Math.hypot(p.x,p.y)); top = Math.max(top,p.z);
      }
    }
    const scale = new THREE.Vector3(r/radial,r/radial,h/top), offset = new THREE.Vector3(x,y,0);
    for (let i=startingBranch; i<branches.length; i++) {
      const item=branches[i];
      branches[i] = {start:item.start.clone().multiply(scale).add(offset),end:item.end.clone().multiply(scale).add(offset),width:item.width};
    }
    for (let i=startingSpray; i<sprays.length; i++) {
      const item=sprays[i];
      item.origin.multiply(scale).add(offset); item.across.multiply(scale); item.up.multiply(scale);
    }
  }
  records.forEach(build);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.70,1,1,8),
    new THREE.MeshStandardMaterial({color:'#685b4e',roughness:1}),branches.length);
  const dummy = new THREE.Object3D(), axis = new THREE.Vector3(0,1,0);
  branches.forEach(({start,end,width},i) => {
    const d = end.clone().sub(start);
    dummy.position.copy(start).lerp(end,.5); dummy.scale.set(width,d.length()+width*.34,width);
    dummy.quaternion.setFromUnitVectors(axis,d.normalize()); dummy.updateMatrix();
    stems.setMatrixAt(i,dummy.matrix);
  });
  const card = new THREE.PlaneGeometry(1,1);
  card.translate(.5,.5,0);
  const leafMaterial=new THREE.MeshStandardMaterial({
    map:woodySprayTexture(THREE),side:THREE.DoubleSide,alphaTest:.32,roughness:1
  });
  // Soft transmission through a thin blade scales with actual sunlight, including at dusk.
  leafMaterial.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float backlit = max(0.0, -dot(normal, directionalLights[0].direction));
        reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * (0.065 + 0.12 * backlit);
      #endif`);
  };
  const foliage=new THREE.InstancedMesh(card,leafMaterial,sprays.length);
  const matrix = new THREE.Matrix4();
  sprays.forEach(({origin,across,up,color},i) => {
    const normal = new THREE.Vector3().crossVectors(across,up).normalize();
    matrix.makeBasis(across,up,normal).setPosition(origin);
    foliage.setMatrixAt(i,matrix); foliage.setColorAt(i,color);
  });
  stems.name=name+'-trunks'; foliage.name=name+'-deciduous-crowns';
  for (const mesh of [stems,foliage]) {
    mesh.castShadow = mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  }
}

export function addRealisticTrees(THREE, group, records, name) {
  woodyPlantBatches(THREE, group, records, name);
}
