// UV finishes retain the source meshes, silhouettes and measured model dimensions.
export function applyFigureFinishes(THREE,scene) {
  const textures=new Map(), finishes=new Map();
  function surface(name,paint) {
    if (textures.has(name)) return textures.get(name);
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='white';
    ctx.fillRect(0,0,256,256);
    paint(ctx);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=THREE.RepeatWrapping;
    textures.set(name,texture);
    return texture;
  }
  function finish(mesh,key,texture,roughness) {
    const id=mesh.material.uuid+'/'+key;
    if (!finishes.has(id)) {
      const material=mesh.material.clone();
      material.map=texture;
      material.roughness=roughness;
      finishes.set(id,material);
    }
    mesh.material=finishes.get(id);
  }
  const cloth=surface('pique',ctx=>{
    ctx.fillStyle='#eeeae0';
    ctx.fillRect(0,0,256,256);
    ctx.fillStyle='#c4bfb5';
    for (let y=0;y<256;y+=4) for (let x=(y%8?2:0);x<256;x+=4) ctx.fillRect(x,y,1,2);
    for (const y of [7,10,244,247]) ctx.fillRect(0,y,256,1);
  });
  const rim=surface('machined-rim',ctx=>{
    ctx.translate(128,128);
    ctx.fillStyle='#596068';
    ctx.beginPath(); ctx.arc(0,0,111,0,2*Math.PI); ctx.fill();
    for (let k=0;k<10;k++) {
      ctx.rotate(Math.PI/5);
      ctx.fillStyle=k%2?'#b9c4c5':'#e4e8e7';
      ctx.beginPath(); ctx.moveTo(-10,30);ctx.lineTo(9,30);ctx.lineTo(26,108);ctx.lineTo(13,107);ctx.fill();
    }
  });
  function fur(isPug) {
    return surface(isPug?'velvet-coat':'feathered-coat',ctx=>{
      let seed=1187;
      const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      for (let i=0;i<4700;i++) {
        const x=rand()*256,y=rand()*256;
        const length=(isPug?3:8)*(1+rand());
        ctx.strokeStyle=isPug?'rgba(150,142,123,.14)':'rgba(146,117,86,.18)';
        ctx.beginPath();ctx.moveTo(x,y);
        ctx.quadraticCurveTo(x+length*.36,y+1,x+length*.48,y+length);ctx.stroke();
      }
    });
  }
  scene.traverse(group=>{
    if (group.userData.figureFinishApplied) return;
    if (group.userData.kind==='person') {
      // The vertically rotated taper is the polo torso; its material also colours the sleeves.
      const torso=group.children.find(m=>m.geometry?.type==='CylinderGeometry'&&m.geometry.parameters.radiusTop!==m.geometry.parameters.radiusBottom);
      if (!torso) return;
      const shirt=torso.material;
      for (const mesh of group.children.filter(m=>m.material===shirt)) finish(mesh,'woven-shirt',cloth,.94);
    } else if (group.userData.kind==='dog') {
      const isPug=group.userData.breed==='white pug';
      for (const mesh of group.children) {
        const rgb=mesh.material.color.getHexString();
        if (['302b25','3a302b','fffdf1'].includes(rgb)) continue;
        finish(mesh,'coat',fur(isPug),.97);
      }
    } else if (group.userData.kind==='car') {
      for (const mesh of group.children) {
        const p=mesh.geometry.parameters;
        if (mesh.geometry.type==='CylinderGeometry'&&p.height===.018) finish(mesh,'spokes',rim,.35);
      }
    } else return;
    group.userData.figureFinishApplied=true;
  });
}
