// =========================================================
// Red Space
// =========================================================

// ---- Helpers ----
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;
// frame-rate independent smoothing (dt = 1 means one 60Hz frame)
const damp = (a, b, rate, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.pow(1 - rate, dt));
function store(key, val) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch (e) {}
  return null;
}
function vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

// ---- Basic setup ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x888888));

// ---- Plane (player) ----
const plane = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
const body = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 8), bodyMat);
body.rotation.x = -Math.PI / 2; // nose points forward (-z)
const wings = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.65), new THREE.MeshStandardMaterial({ color: 0xcc2222 }));
wings.position.z = 0.35;
const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.45), bodyMat);
fin.position.set(0, 0.28, 0.6);
const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
glow.position.z = 0.95;
const shield = new THREE.Mesh(
  new THREE.SphereGeometry(1.3, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.25, depthWrite: false })
);
shield.visible = false;
plane.add(body, wings, fin, glow, shield, new THREE.PointLight(0xff5555, 1, 3));
plane.position.set(0, 1.8, 0);
scene.add(plane);

// ---- Ground grid + stars ----
const grid = new THREE.GridHelper(200, 40, 0xffffff, 0xffffff); // cell size = 5
grid.position.y = -1;
scene.add(grid);

const starGeo = new THREE.BufferGeometry();
const starCount = 800;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) starPositions[i] = (Math.random() - 0.5) * 200;
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.1 });
scene.add(new THREE.Points(starGeo, starMat));

function updateStars(speed, dt) {
  for (let i = 2; i < starPositions.length; i += 3) {
    starPositions[i] += speed * dt;
    if (starPositions[i] > 100) starPositions[i] -= 200;
  }
  starGeo.attributes.position.needsUpdate = true;
}

// ---- Game state ----
const THEMES = [
  { at: 0,   name: '',              sky: 0x87CEEB },
  { at: 100, name: 'SUNSET',        sky: 0xff9b5e },
  { at: 250, name: 'TWILIGHT',      sky: 0x3a1f6e },
  { at: 450, name: 'DEEP SPACE',    sky: 0x05050f },
  { at: 700, name: 'NEON STORM',    sky: 0x2a0a3a }
];
let score = 0, progress = 0, combo = 1;
let gameOver = false, gameStarted = false;
let forwardSpeed = 0.2, timeScale = 1, shake = 0;
let best = parseInt(store('redspace_best'), 10) || 0;
const power = { shield: false, slow: 0, magnet: 0 };
const storm = { left: 0 };
let nextStorm = 300, obsT = 0, ringT = 0, puT = 0, stormT = 0, themeIdx = 0;
const obstacles = [], rings = [], pickups = [];
const skyCur = new THREE.Color(0x87CEEB), skyTarget = new THREE.Color();

const scoreEl = document.getElementById('score');
const finalEl = document.getElementById('finalScore');
const overEl = document.getElementById('gameOver');
const startEl = document.getElementById('startScreen');

// ---- HUD (built here so index.html stays untouched) ----
function mk(id) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; }
const bestEl = mk('best'), comboEl = mk('combo'), puEl = mk('powerups'), bannerEl = mk('banner');
const bestLine = document.createElement('p');
bestLine.id = 'bestLine';
startEl.insertBefore(bestLine, document.getElementById('playBtn'));
bestLine.textContent = best > 0 ? 'Best: ' + best : '';

let bannerTimer = 0;
function banner(text) {
  bannerEl.textContent = text;
  bannerEl.style.opacity = 1;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { bannerEl.style.opacity = 0; }, 1600);
}
function addScore(n) { score += n; scoreEl.textContent = 'Score: ' + score; }
function setCombo(v) { combo = v; comboEl.textContent = combo > 1 ? 'x' + combo + ' COMBO' : ''; }
let puText = '';
function updateHud() {
  const t = [];
  if (power.shield) t.push('SHIELD');
  if (power.slow > 0) t.push('SLOW-MO ' + Math.ceil(power.slow / 60) + 's');
  if (power.magnet > 0) t.push('MAGNET ' + Math.ceil(power.magnet / 60) + 's');
  const s = t.join('   |   ');
  if (s !== puText) { puText = s; puEl.textContent = s; }
}

// ---- Sound (synthesized, no downloads) ----
let actx = null;
function audioInit() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { actx = null; }
}
function tone(freq, dur, type, vol, slideTo) {
  if (!actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 20), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(t); o.stop(t + dur);
}
function noise(dur, vol) {
  if (!actx) return;
  const n = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource(), g = actx.createGain();
  g.gain.value = vol; src.buffer = buf; src.connect(g); g.connect(actx.destination);
  src.start();
}
const sfx = {
  ring(c)  { tone(500 + c * 110, 0.16, 'triangle', 0.14, 1000 + c * 140); },
  power()  { tone(380, 0.3, 'sine', 0.18, 1100); },
  block()  { noise(0.25, 0.18); tone(320, 0.2, 'sawtooth', 0.08, 80); },
  crash()  { noise(0.7, 0.35); tone(160, 0.6, 'sawtooth', 0.2, 35); },
  storm()  { tone(300, 0.6, 'sine', 0.15, 900); }
};

// ---- Particles (engine trail, explosions, pickups) ----
const MAXP = 700;
const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
const pVel = new Float32Array(MAXP * 3), pBase = new Float32Array(MAXP * 3);
const pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP);
let pHead = 0;
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
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

// ---- Controls ----
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

const moveSpeed = 0.15;
const TOUCH_SPEED = 0.7; // lower = calmer on phone
const bounds = { x: 5, y: 4, yMin: 0.5 };

function updateControls(dt) {
  const kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  const ky = (keys.arrowup || keys.w ? 1 : 0) - (keys.arrowdown || keys.s ? 1 : 0);
  plane.position.x += (kx * moveSpeed + joyX * Math.abs(joyX) * moveSpeed * TOUCH_SPEED) * dt;
  plane.position.y += (ky * moveSpeed - joyY * Math.abs(joyY) * moveSpeed * TOUCH_SPEED) * dt;
  plane.position.x = clamp(plane.position.x, -bounds.x, bounds.x);
  plane.position.y = clamp(plane.position.y, bounds.yMin, bounds.y);

  // bank + yaw into the turn
  const steer = kx || joyX;
  plane.rotation.z = damp(plane.rotation.z, -steer * 0.7, 0.12, dt);
  plane.rotation.y = damp(plane.rotation.y, -steer * 0.35, 0.12, dt);
}

// ---- Touch joystick (floating, tracks one finger) ----
const zone = document.getElementById('joystickZone');
const stick = document.getElementById('joystickStick');
let joyId = null, joyX = 0, joyY = 0;
let joyCenterX = 0, joyCenterY = 0;
const JOY_MAX = 37;
const JOY_DEAD = 0.12;

function joyAxis(v) {
  const a = Math.abs(v);
  if (a < JOY_DEAD) return 0;
  return Math.sign(v) * (a - JOY_DEAD) / (1 - JOY_DEAD);
}
function joyReset() {
  joyId = null; joyX = 0; joyY = 0;
  zone.style.display = 'none';
  stick.style.transform = 'translate(0px, 0px)';
}
function joyTouch(list) {
  for (const t of list) if (t.identifier === joyId) return t;
  return null;
}
document.addEventListener('touchstart', e => {
  if (!gameStarted || gameOver || joyId !== null) return;
  if (e.target.closest && e.target.closest('button')) return;
  const t = e.changedTouches[0];
  joyId = t.identifier;
  joyCenterX = t.clientX;
  joyCenterY = t.clientY;
  zone.style.display = 'block';
  zone.style.left = (joyCenterX - zone.offsetWidth / 2) + 'px';
  zone.style.top = (joyCenterY - zone.offsetHeight / 2) + 'px';
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (joyId === null) return;
  const t = joyTouch(e.changedTouches);
  if (!t) return;
  e.preventDefault();
  let dx = t.clientX - joyCenterX;
  let dy = t.clientY - joyCenterY;
  const dist = Math.min(Math.hypot(dx, dy), JOY_MAX);
  const angle = Math.atan2(dy, dx);
  dx = Math.cos(angle) * dist;
  dy = Math.sin(angle) * dist;
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  joyX = joyAxis(dx / JOY_MAX);
  joyY = joyAxis(dy / JOY_MAX);
}, { passive: false });
function joyEnd(e) {
  if (joyId !== null && joyTouch(e.changedTouches)) joyReset();
}
document.addEventListener('touchend', joyEnd);
document.addEventListener('touchcancel', joyEnd);

// ---- Shared meshes (no per-spawn allocation) ----
const rockGeo = new THREE.IcosahedronGeometry(0.5, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true, roughness: 0.9, emissive: 0x1a0a0a });
const laserGeo = new THREE.BoxGeometry(12, 0.22, 0.22);
const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
const spinGeo = new THREE.BoxGeometry(5, 0.3, 0.3);
const spinMat = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xaa4400 });
const ringGeo = new THREE.TorusGeometry(1, 0.15, 8, 24);
const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x554400 });
const puGeo = new THREE.OctahedronGeometry(0.6);
const PU = { shield: { color: 0x44aaff }, slow: { color: 0xaa66ff }, magnet: { color: 0x44ff88 } };
for (const k in PU) PU[k].mat = new THREE.MeshStandardMaterial({ color: PU[k].color, emissive: PU[k].color, emissiveIntensity: 0.6 });

function spawnZ() { return plane.position.z - 70 - forwardSpeed * 30; }

// ---- Obstacles ----
function addObs(mesh, kind, value, extra) {
  mesh.userData = Object.assign({ kind, value, bx: mesh.position.x }, extra);
  scene.add(mesh);
  obstacles.push(mesh);
}
function spawnRocks(moving) {
  const gapX = (Math.random() - 0.5) * 6, z = spawnZ(), ph = Math.random() * 6.28;
  for (let x = -6; x <= 6; x += 2) {
    if (Math.abs(x - gapX) < 1.5) continue; // leave a gap to dodge through
    const o = new THREE.Mesh(rockGeo, rockMat);
    o.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    o.position.set(x, Math.random() * 3.5 + 0.5, z);
    addObs(o, moving ? 'mover' : 'rock', 1, { ph });
  }
}
function spawnLaser() {
  const o = new THREE.Mesh(laserGeo, laserMat);
  o.position.set(0, rand(1.2, 3.6), spawnZ());
  addObs(o, 'laser', 3);
}
function spawnSpinner() {
  const o = new THREE.Mesh(spinGeo, spinMat);
  o.position.set(rand(-2, 2), 2.2, spawnZ());
  o.rotation.z = Math.random() * 3;
  addObs(o, 'spinner', 3, { spin: (Math.random() < 0.5 ? -1 : 1) * 0.035 });
}
function spawnPattern() {
  const r = Math.random();
  if (progress >= 110 && r < 0.2) return spawnSpinner();
  if (progress >= 60 && r < 0.4) return spawnRocks(true);
  if (progress >= 25 && r < 0.6) return spawnLaser();
  spawnRocks(false);
}
function hits(o) {
  const u = o.userData, p = plane.position, dz = o.position.z - p.z;
  if (u.kind === 'laser') return Math.abs(dz) < 0.6 && Math.abs(o.position.y - p.y) < 0.5;
  if (u.kind === 'spinner') {
    if (Math.abs(dz) > 0.6) return false;
    const dx = p.x - o.position.x, dy = p.y - o.position.y;
    const c = Math.cos(o.rotation.z), s = Math.sin(o.rotation.z);
    return Math.abs(dx * c + dy * s) < 2.8 && Math.abs(-dx * s + dy * c) < 0.55;
  }
  return o.position.distanceTo(p) < 0.9;
}
// returns true if the hit was absorbed by the shield, false if the run is over
function crash(o) {
  if (power.shield) {
    power.shield = false; shield.visible = false;
    burst(o.position, 0x44aaff, 40);
    sfx.block(); vib(40); shake = Math.max(shake, 0.5);
    return true;
  }
  gameOver = true;
  joyReset();
  burst(plane.position, 0xff8844, 90);
  burst(plane.position, 0xffdd88, 40);
  plane.visible = false;
  sfx.crash(); vib([80, 40, 120]); shake = 1.2;
  const isNew = score > best;
  if (isNew) { best = score; store('redspace_best', String(best)); }
  finalEl.textContent = 'Score: ' + score + '   Best: ' + best + (isNew ? '  (new!)' : '');
  setTimeout(() => { overEl.style.display = 'block'; }, 900);
  return false;
}
function updateObstacles(wdt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i], u = o.userData;
    o.position.z += forwardSpeed * wdt;
    if (u.kind === 'mover') { u.ph += 0.035 * wdt; o.position.x = u.bx + Math.sin(u.ph) * 1.5; }
    if (u.kind === 'rock' || u.kind === 'mover') o.rotation.x += 0.01 * wdt;
    if (u.kind === 'spinner') o.rotation.z += u.spin * wdt;

    if (hits(o)) {
      if (!crash(o)) return;
      scene.remove(o); obstacles.splice(i, 1);
      continue;
    }
    if (o.position.z > plane.position.z + 5) { // passed player
      scene.remove(o); obstacles.splice(i, 1);
      progress += u.value;
      addScore(u.value);
    }
  }
}

// ---- Rings (bonus points + combo) ----
function makeRing(x, y, value) {
  const r = new THREE.Mesh(ringGeo, ringMat);
  r.position.set(x, y, spawnZ());
  r.userData = { value };
  scene.add(r); rings.push(r);
}
function updateRings(wdt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    if (power.magnet > 0 && r.position.distanceTo(plane.position) < 10) r.position.lerp(plane.position, 0.1 * wdt);
    r.position.z += forwardSpeed * wdt;
    r.rotation.z += 0.03 * wdt;
    if (r.position.distanceTo(plane.position) < 1.2) {
      addScore(r.userData.value * combo);
      sfx.ring(combo); vib(12);
      burst(r.position, 0xffd700, 18);
      setCombo(Math.min(combo + 1, 5));
      scene.remove(r); rings.splice(i, 1);
      continue;
    }
    if (r.position.z > plane.position.z + 5) {
      scene.remove(r); rings.splice(i, 1);
      setCombo(1); // missed one
    }
  }
}

// ---- Power-ups ----
function spawnPickup() {
  const types = Object.keys(PU), type = types[Math.floor(Math.random() * types.length)];
  const p = new THREE.Mesh(puGeo, PU[type].mat);
  p.position.set(rand(-4, 4), rand(1, 3.5), spawnZ());
  p.userData = { type };
  scene.add(p); pickups.push(p);
}
function collect(type) {
  sfx.power(); vib(20);
  if (type === 'shield') { power.shield = true; shield.visible = true; banner('SHIELD'); }
  if (type === 'slow') { power.slow = 300; banner('SLOW-MO'); }
  if (type === 'magnet') { power.magnet = 480; banner('MAGNET'); }
}
function updatePickups(wdt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.position.z += forwardSpeed * wdt;
    p.rotation.y += 0.05 * wdt; p.rotation.x += 0.03 * wdt;
    if (p.position.distanceTo(plane.position) < 1.3) {
      collect(p.userData.type);
      burst(p.position, PU[p.userData.type].color, 25);
      scene.remove(p); pickups.splice(i, 1);
      continue;
    }
    if (p.position.z > plane.position.z + 5) { scene.remove(p); pickups.splice(i, 1); }
  }
}

// ---- Spawner (time measured in 60Hz frames, scaled by slow-mo) ----
function spawner(wdt) {
  if (storm.left > 0) {
    // ring storm: no obstacles, a snake of rings to chase
    storm.left -= wdt; stormT += wdt; ringT += wdt;
    if (ringT >= 10) {
      ringT = 0;
      makeRing(Math.sin(stormT * 0.03) * 3.6, 2.4 + Math.cos(stormT * 0.025) * 1.4, 2);
    }
    if (storm.left <= 0) {
      storm.left = 0; obsT = 0; ringT = 0;
      nextStorm = progress + 300;
      banner('STORM OVER');
    }
  } else {
    obsT += wdt; ringT += wdt;
    if (obsT >= Math.max(34, 48 - progress * 0.04)) { obsT = 0; spawnPattern(); }
    if (ringT >= 84) { ringT = 0; makeRing(rand(-4, 4), rand(1, 4), 5); }
    if (progress >= nextStorm) { storm.left = 480; stormT = 0; ringT = 0; banner('RING STORM'); sfx.storm(); }
  }
  puT += wdt;
  if (puT >= 720) { puT = 0; spawnPickup(); }
}

// ---- Sky theme by progress ----
function applySky() { scene.background.copy(skyCur); scene.fog.color.copy(skyCur); }
function updateTheme(dt) {
  let idx = 0;
  for (let i = 0; i < THEMES.length; i++) if (progress >= THEMES[i].at) idx = i;
  if (idx !== themeIdx) { themeIdx = idx; if (THEMES[idx].name) banner(THEMES[idx].name); }
  skyTarget.setHex(THEMES[idx].sky);
  skyCur.lerp(skyTarget, 1 - Math.pow(0.985, dt));
  applySky();
  const lum = skyCur.r * 0.3 + skyCur.g * 0.59 + skyCur.b * 0.11;
  starMat.opacity = clamp((0.55 - lum) * 2.2, 0.1, 1);
}

// ---- Camera ----
let camX = 0, camY = 2;
function updateCamera(dt) {
  camX = damp(camX, plane.position.x, 0.1, dt);
  camY = damp(camY, 2 + (plane.position.y - 2) * 0.35, 0.1, dt);
  camera.position.set(camX + (Math.random() - 0.5) * shake, camY + (Math.random() - 0.5) * shake, 4);
  camera.lookAt(plane.position.x, plane.position.y, plane.position.z - 5);
  const fov = 75 + (forwardSpeed - 0.2) * 25; // speed feel
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 0.05, dt); camera.updateProjectionMatrix(); }
  shake *= Math.pow(0.9, dt);
  if (shake < 0.005) shake = 0;
}

// ---- Main tick ----
function tick(dt) {
  timeScale = damp(timeScale, power.slow > 0 ? 0.5 : 1, 0.1, dt);
  const wdt = dt * timeScale; // world time (slow-mo affects the world, not your hands)
  forwardSpeed = Math.min(0.2 + progress * 0.0008, 0.75);
  if (power.slow > 0) power.slow -= dt;
  if (power.magnet > 0) power.magnet -= dt;

  updateControls(dt);
  spawner(wdt);
  updateObstacles(wdt);
  updateRings(wdt);
  updatePickups(wdt);

  grid.position.z = (grid.position.z + forwardSpeed * wdt) % 5;
  updateStars(forwardSpeed * 0.6, wdt);
  updateTheme(dt);
  updateHud();

  if (!gameOver) { // engine trail
    for (let i = 0; i < 2; i++) {
      emit(plane.position.x + rand(-0.12, 0.12), plane.position.y + rand(-0.12, 0.12), plane.position.z + 1,
        rand(-0.01, 0.01), rand(-0.01, 0.01), forwardSpeed * timeScale + 0.04, 22, Math.random() < 0.5 ? 0xff7733 : 0xffcc55);
    }
  }
}

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  now = now || performance.now();
  const dt = Math.min((now - last) / 16.667, 2); // 1 = one 60Hz frame, any refresh rate
  last = now;

  if (gameStarted && !gameOver) tick(dt);
  else if (!gameStarted) { // home screen idle
    plane.rotation.z += 0.02 * dt;
    grid.position.z = (grid.position.z + 0.05 * dt) % 5;
    updateStars(0.03, dt);
  }
  if (gameStarted) { updateParticles(dt); updateCamera(dt); }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Start / restart ----
function clearList(list) { list.forEach(m => scene.remove(m)); list.length = 0; }
function startGame() {
  audioInit();
  clearList(obstacles); clearList(rings); clearList(pickups);
  pLife.fill(0);
  plane.position.set(0, 2, 0);
  plane.rotation.set(0, 0, 0);
  plane.visible = true;
  score = 0; progress = 0; forwardSpeed = 0.2; timeScale = 1; shake = 0;
  power.shield = false; power.slow = 0; power.magnet = 0; shield.visible = false;
  storm.left = 0; nextStorm = 300; obsT = 0; ringT = 0; puT = 0; themeIdx = 0;
  skyCur.setHex(THEMES[0].sky); applySky(); starMat.opacity = 0.1;
  camX = 0; camY = 2; camera.fov = 75; camera.updateProjectionMatrix();
  scoreEl.textContent = 'Score: 0';
  scoreEl.style.display = 'block';
  setCombo(1); updateHud();
  bestEl.textContent = 'Best ' + best; bestEl.style.display = 'block';
  joyReset();
  overEl.style.display = 'none';
  startEl.style.display = 'none';
  last = performance.now();
  gameOver = false;
  gameStarted = true;
}
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

animate();
