// ---- Shared meshes (no per-spawn allocation) ----
const rockGeo = new THREE.IcosahedronGeometry(0.5, 1);
(function () { // lumpy asteroid: same offset for shared corners so faces stay joined
  const p = rockGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    const f = 0.82 + 0.3 * (n - Math.floor(n));
    p.setXYZ(i, x * f, y * f, z * f);
  }
})();
const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a625c, flatShading: true, roughness: 0.9, emissive: 0x1a0a0a });
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
  pauseBtn.style.display = 'none';
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

