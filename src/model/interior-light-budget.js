// The fittings are static. Rank them in world space so both mirrored houses use the same camera distance.
export function createInteriorLightBudget(THREE, groups) {
  const lamps = [];
  for (const group of groups) {
    group.updateWorldMatrix(true, true);
    group.traverse(light => {
      if (!light.isPointLight) return;
      const position = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld);
      lamps.push({ light, position, intensity: light.intensity, distance: 0 });
    });
  }
  const limit = 4;
  const focus = new THREE.Vector3();
  return function update(camera, target) {
    let scale = 1;
    if (camera.isOrthographicCamera) {
      const viewHeight = (camera.top - camera.bottom) / camera.zoom;
      scale = 1 - THREE.MathUtils.smoothstep(viewHeight, 18, 50);
      focus.copy(target);
    } else {
      camera.getWorldPosition(focus);
    }
    if (scale > 0) {
      for (const lamp of lamps) lamp.distance = focus.distanceTo(lamp.position);
      lamps.sort((a, b) => a.distance - b.distance);
    }
    const cutoff = Math.min(lamps[limit]?.distance ?? Infinity, 22);
    for (const [i, lamp] of lamps.entries()) {
      const gain = i < limit && scale > 0 ? scale * THREE.MathUtils.smoothstep(cutoff - lamp.distance, 0, 1.2) : 0;
      lamp.light.visible = gain > 0;
      lamp.light.intensity = lamp.intensity * gain;
    }
  };
}
