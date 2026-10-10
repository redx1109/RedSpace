// ---- Particles (engine trail, explosions, pickups) ----
const MAXP = 700;
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
const pVel = new Float32Array(MAXP * 3), pBase = new Float32Array(MAXP * 3);
const pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP);
let pHead = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
function glowTex() { // soft round sprite; falls back to plain squares if canvas is unavailable
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (!g) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  } catch (e) { return null; }
}
// sizeAttenuation off = constant pixel size, so sparks never balloon when they pass the camera
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 12, sizeAttenuation: false, map: glowTex(), vertexColors: true,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
}));
particles.frustumCulled = false;
scene.add(particles);
const tmpC = new THREE.Color();

function emit(x, y, z, vx, vy, vz, life, hex) {
  const i = pHead, k = i * 3;
  pHead = (pHead + 1) % MAXP;
  pPos[k] = x; pPos[k + 1] = y; pPos[k + 2] = z;
  pVel[k] = vx; pVel[k + 1] = vy; pVel[k + 2] = vz;
  pLife[i] = pMax[i] = life;
  tmpC.setHex(hex);
  pBase[k] = tmpC.r; pBase[k + 1] = tmpC.g; pBase[k + 2] = tmpC.b;
}
function burst(p, hex, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), s = rand(0.06, 0.26);
    emit(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.sin(b) * Math.sin(a) * s, Math.cos(b) * s, rand(25, 50), hex);
  }
}
function updateParticles(dt) {
  for (let i = 0; i < MAXP; i++) {
    const k = i * 3;
    if (pLife[i] <= 0) { pCol[k] = pCol[k + 1] = pCol[k + 2] = 0; continue; }
    pLife[i] -= dt;
    pPos[k] += pVel[k] * dt; pPos[k + 1] += pVel[k + 1] * dt; pPos[k + 2] += pVel[k + 2] * dt;
    const f = Math.max(pLife[i], 0) / pMax[i];
    pCol[k] = pBase[k] * f; pCol[k + 1] = pBase[k + 1] * f; pCol[k + 2] = pBase[k + 2] * f;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

