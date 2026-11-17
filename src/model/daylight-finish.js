// A small seamless cloud field is sampled in sky directions, so it stays at infinity during a walk.
function daylightCloudTexture(THREE) {
  const size = 256, pixels = new Uint8Array(size * size * 4);
  const lattice = (x, y) => {
    let n = Math.imul(x + 373, 374761393) + Math.imul(y + 127, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  function noise(u, v, cells) {
    const x = u * cells, y = v * cells, i = Math.floor(x), j = Math.floor(y);
    const smooth = t => t * t * (3 - 2 * t);
    const a = smooth(x - i), b = smooth(y - j);
    const sample = (dx, dy) => lattice((i + dx) % cells, (j + dy) % cells);
    return (sample(0, 0) * (1-a) + sample(1, 0) * a) * (1-b)
      + (sample(0, 1) * (1-a) + sample(1, 1) * a) * b;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let density = 0;
    for (let octave = 0; octave < 6; octave++) {
      density += noise(x / size, y / size, 4 << octave) / (2 << octave);
    }
    const i = 4 * (y * size + x);
    pixels[i] = pixels[i+1] = pixels[i+2] = Math.round(255 * density);
    pixels[i+3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.generateMipmaps = true;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Broad outdoor sky and earth reflections for rough surfaces, glazing and painted metal.
function outdoorReflection(THREE) {
  const w = 128, h = 64, pixels = new Uint8Array(w * h * 4);
  const sky = new THREE.Color('#9bbede'), horizon = new THREE.Color('#d5d6c0');
  const ground = new THREE.Color('#746f54'), c = new THREE.Color();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const elevation = Math.sin(Math.PI * ((y + .5) / h - .5));
    const azimuth = x / w * Math.PI * 2;
    const ridge = .016 + .009 * Math.sin(azimuth * 9) + .006 * Math.sin(azimuth * 27);
    if (elevation < ridge) c.copy(ground).multiplyScalar(.68 + .2 * Math.cos(azimuth * 3));
    else c.copy(horizon).lerp(sky, Math.sqrt(elevation));
    const i = 4 * (y * w + x);
    pixels[i] = Math.round(255 * c.r); pixels[i+1] = Math.round(255 * c.g);
    pixels[i+2] = Math.round(255 * c.b); pixels[i+3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, w, h);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
