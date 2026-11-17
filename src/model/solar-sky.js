const SOLAR_DISK_RADIUS_DEG = .53;
const SOLAR_DISK_RADIUS = SOLAR_DISK_RADIUS_DEG * Math.PI / 180;
const skyClamp = value => Math.max(0, Math.min(1, value));
const skySmooth = (a, b, value) => {
  const t = skyClamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
function skyColorMix(a, b, amount) {
  return [16, 8, 0].reduce((color, shift) => color | Math.round(
    ((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount) << shift, 0);
}

export function solarAppearance(elevationDeg) {
  if (!Number.isFinite(elevationDeg)) throw new RangeError('Solar elevation must be finite.');
  const day = skySmooth(-9, 10, elevationDeg);
  const sunset = skySmooth(-8, -1, elevationDeg) * (1 - skySmooth(2, 18, elevationDeg));
  return {
    sunColor: skyColorMix(0xff5426, 0xfff5e8, skySmooth(0, 22, elevationDeg)),
    diskColor: skyColorMix(0xff632c, 0xfff9e9, skySmooth(0, 16, elevationDeg)),
    zenithColor: skyColorMix(0x101a31, 0x5799d0, day),
    horizonColor: skyColorMix(skyColorMix(0x263047, 0xd5e9f4, day), 0xf49a69, sunset * .85),
    lowerColor: skyColorMix(0x151c2a, 0xa5b2b5, day),
    diskVisibility: skySmooth(-SOLAR_DISK_RADIUS_DEG, 0, elevationDeg),
    sunset,
    sunIntensityFactor: .45 + .55 * skySmooth(0, 18, elevationDeg),
    ambientIntensityFactor: .35 + .65 * day,
  };
}

const solarSkyVertex = `
  varying vec2 skyUv;
  void main() {
    skyUv = uv;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`;
const solarSkyFragment = `
  varying vec2 skyUv;
  uniform mat4 inverseProjection;
  uniform mat3 cameraRotation;
  uniform bool orthographic;
  uniform vec3 sunDirection;
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  uniform vec3 lowerColor;
  uniform vec3 diskColor;
  uniform float diskVisibility;
  uniform float diskRadius;
  uniform float sunset;
  void main() {
    vec4 farPoint = inverseProjection * vec4(skyUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 cameraRay = orthographic ? vec3(0.0, 0.0, -1.0) : normalize(farPoint.xyz / farPoint.w);
    vec3 ray = normalize(cameraRotation * cameraRay);
    float height = clamp(ray.z, 0.0, 1.0);
    vec3 color = mix(horizonColor, zenithColor, pow(height, 0.55));
    color = mix(color, lowerColor, (1.0 - smoothstep(-0.16, 0.0, ray.z)));
    float alignment = dot(ray, sunDirection);
    float distanceToSun = length(cross(ray, sunDirection));
    float aboveHorizon = smoothstep(-0.0002, 0.0002, ray.z);
    float towardSun = step(0.0, alignment);
    float halo = exp(-distanceToSun * distanceToSun / 0.0025) * towardSun;
    color = mix(color, diskColor, halo * (0.09 + sunset * 0.17) * diskVisibility * aboveHorizon);
    float edge = max(fwidth(distanceToSun), 0.00004);
    float disk = (1.0 - smoothstep(diskRadius - edge, diskRadius + edge, distanceToSun))
      * towardSun * diskVisibility * aboveHorizon;
    color = mix(color, diskColor, disk);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function solarSkyUniforms(THREE) {
  return {
    inverseProjection: { value: new THREE.Matrix4() },
    cameraRotation: { value: new THREE.Matrix3() },
    orthographic: { value: false },
    sunDirection: { value: new THREE.Vector3(0, 0, 1) },
    ...Object.fromEntries(['zenithColor', 'horizonColor', 'lowerColor', 'diskColor']
      .map(key => [key, { value: new THREE.Color() }])),
    diskVisibility: { value: 0 }, diskRadius: { value: SOLAR_DISK_RADIUS }, sunset: { value: 0 },
  };
}

// Render this separate background pass after clear(), then clearDepth() before the world.
export function setupSolarSky({ THREE }) {
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const uniforms = solarSkyUniforms(THREE);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: solarSkyVertex,
    fragmentShader: solarSkyFragment, depthTest: false, depthWrite: false, toneMapped: false });
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  scene.add(quad);
  let disposed = false;
  return {
    render(renderer, viewCamera, state) {
      if (disposed || !state?.active) return false;
      const appearance = solarAppearance(state.elevationDeg);
      viewCamera.updateWorldMatrix(true, false);
      uniforms.inverseProjection.value.copy(viewCamera.projectionMatrixInverse);
      uniforms.cameraRotation.value.setFromMatrix4(viewCamera.matrixWorld);
      uniforms.orthographic.value = Boolean(viewCamera.isOrthographicCamera);
      uniforms.sunDirection.value.fromArray(state.direction).normalize();
      for (const key of ['zenithColor', 'horizonColor', 'lowerColor', 'diskColor']) {
        uniforms[key].value.setHex(appearance[key]);
      }
      uniforms.diskVisibility.value = appearance.diskVisibility;
      uniforms.sunset.value = appearance.sunset;
      const autoClear = renderer.autoClear;
      const shadowNeedsUpdate = renderer.shadowMap?.needsUpdate;
      renderer.autoClear = false;
      try { renderer.render(scene, camera); }
      finally {
        renderer.autoClear = autoClear;
        if (renderer.shadowMap) renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
      }
      return true;
    },
    dispose() { disposed = true; geometry.dispose(); material.dispose(); },
  };
}

export function setupSolarAtmosphere({ sun, hemi }) {
  const baseline = { sunColor: sun.color.clone(), sunIntensity: sun.intensity,
    hemiColor: hemi?.color.clone(), groundColor: hemi?.groundColor.clone(), hemiIntensity: hemi?.intensity };
  return {
    update(state) {
      if (!state) return;
      const appearance = state.active ? solarAppearance(state.elevationDeg) : null;
      sun.color.copy(baseline.sunColor);
      if (appearance) sun.color.setHex(appearance.sunColor);
      sun.intensity = state.daylight ? baseline.sunIntensity * (appearance?.sunIntensityFactor ?? 1) : 0;
      if (hemi) {
        hemi.color.copy(baseline.hemiColor);
        hemi.groundColor.copy(baseline.groundColor);
        hemi.intensity = baseline.hemiIntensity * (appearance?.ambientIntensityFactor ?? 1);
      }
    },
  };
}
