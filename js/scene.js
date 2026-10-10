// ---- Basic setup ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a1f);
scene.fog = new THREE.Fog(0x070a1f, 10, 100);

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
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe03a4a, metalness: 0.5, roughness: 0.4 });
const body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.0, 6), bodyMat);
body.rotation.x = -Math.PI / 2; // nose points forward (-z)
function wingGeo(s) { // swept delta wing, one triangle
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0.15 * s, 0, -0.2,   1.25 * s, -0.05, 0.9,   0.15 * s, 0, 0.9
  ]), 3));
  g.computeVertexNormals();
  return g;
}
const wingMat = new THREE.MeshStandardMaterial({ color: 0x9a1f2e, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
const wingR = new THREE.Mesh(wingGeo(1), wingMat), wingL = new THREE.Mesh(wingGeo(-1), wingMat);
const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.55), bodyMat);
fin.position.set(0, 0.25, 0.7);
const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8),
  new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x2288aa, emissiveIntensity: 0.8 }));
cockpit.scale.set(1, 0.7, 1.8);
cockpit.position.set(0, 0.2, -0.15);
const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
glow.position.z = 1.05;
const podGeo = new THREE.SphereGeometry(0.1, 6, 6), podMat = new THREE.MeshBasicMaterial({ color: 0x66ddff });
const podR = new THREE.Mesh(podGeo, podMat), podL = new THREE.Mesh(podGeo, podMat);
podR.position.set(1.25, -0.05, 0.9);
podL.position.set(-1.25, -0.05, 0.9);
const shield = new THREE.Mesh(
  new THREE.SphereGeometry(1.3, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.25, depthWrite: false })
);
shield.visible = false;
const shipSpace = new THREE.Group();
shipSpace.add(body, wingR, wingL, fin, cockpit, glow, podR, podL);

// classic airplane for the sky sectors
const airMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
const airBody = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.8, 8), airMat);
airBody.rotation.x = -Math.PI / 2;
const airWings = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 0.65), new THREE.MeshStandardMaterial({ color: 0xcc2222 }));
airWings.position.z = 0.35;
const airFin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.45), airMat);
airFin.position.set(0, 0.28, 0.6);
const airGlow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
airGlow.position.z = 0.95;
const shipAir = new THREE.Group();
shipAir.add(airBody, airWings, airFin, airGlow);
shipAir.visible = false;
function setKind(kind) { shipSpace.visible = kind === 'space'; shipAir.visible = kind === 'sky'; }

plane.add(shipSpace, shipAir, shield, new THREE.PointLight(0xff5555, 1, 3));
plane.position.set(0, 1.8, 0);
scene.add(plane);

// ---- Ground grid (fades in for sky sectors) ----
const grid = new THREE.GridHelper(200, 40, 0xffffff, 0xffffff); // cell size = 5
grid.position.y = -1;
grid.material.transparent = true;
grid.material.opacity = 0;
grid.visible = false;
scene.add(grid);

// ---- Distant planet / star (changes per sector) ----
const planetMat = new THREE.MeshStandardMaterial({ color: 0x3a6ea5, emissive: 0x3a6ea5, emissiveIntensity: 0.45, roughness: 1, fog: false });
const planet = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 24), planetMat);
planet.position.set(-110, -50, -420);
const haloMat = new THREE.MeshBasicMaterial({
  color: 0x3a6ea5, transparent: true, opacity: 0.18, side: THREE.BackSide,
  fog: false, depthWrite: false, blending: THREE.AdditiveBlending
});
planet.add(new THREE.Mesh(new THREE.SphereGeometry(86, 32, 24), haloMat));
scene.add(planet);
const planetT = new THREE.Color();

// ---- Warp streaks (speed lines along the sides) ----
const STREAKS = 140;
const sPos = new Float32Array(STREAKS * 6), sHead = new Float32Array(STREAKS * 3);
function resetStreak(i, anywhere) {
  const k = i * 3;
  sHead[k] = (Math.random() < 0.5 ? -1 : 1) * rand(7, 18);
  sHead[k + 1] = rand(-5, 11);
  sHead[k + 2] = anywhere ? rand(-110, 4) : -110;
}
for (let i = 0; i < STREAKS; i++) resetStreak(i, true);
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
const streaks = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ color: 0x9bb7ff, transparent: true, opacity: 0.5 }));
streaks.frustumCulled = false;
scene.add(streaks);
function updateStreaks(speed, dt) {
  const len = 0.5 + speed * 6;
  for (let i = 0; i < STREAKS; i++) {
    const k = i * 3, j = i * 6;
    sHead[k + 2] += speed * dt;
    if (sHead[k + 2] - len > 6) resetStreak(i, false);
    sPos[j] = sPos[j + 3] = sHead[k];
    sPos[j + 1] = sPos[j + 4] = sHead[k + 1];
    sPos[j + 2] = sHead[k + 2];
    sPos[j + 5] = sHead[k + 2] - len;
  }
  sGeo.attributes.position.needsUpdate = true;
}
updateStreaks(0, 0);

// ---- Stars ----
const starGeo = new THREE.BufferGeometry();
const starCount = 1200;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) starPositions[i] = (Math.random() - 0.5) * 200;
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.8 });
scene.add(new THREE.Points(starGeo, starMat));

function updateStars(speed, dt) {
  for (let i = 2; i < starPositions.length; i += 3) {
    starPositions[i] += speed * dt;
    if (starPositions[i] > 100) starPositions[i] -= 200;
  }
  starGeo.attributes.position.needsUpdate = true;
}

