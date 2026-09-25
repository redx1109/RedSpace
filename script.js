// ---- Basic setup ----
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 10, 100);
 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 4); // behind + above plane
 
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
 
// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x888888));
 
// ---- Plane (player) ----
const plane = new THREE.Mesh(
  new THREE.ConeGeometry(0.5, 1.5, 8),
  new THREE.MeshStandardMaterial({ color: 0xff5555 })
);
plane.add(new THREE.PointLight(0xff5555, 1, 3));
plane.rotation.x = Math.PI / 2; // point forward (-z)
scene.add(plane);
 
// ---- Controls ----
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);
 
const moveSpeed = 0.15;
const bounds = { x: 5, y: 4, yMin: 0.5 };
 
function updateControls() {
  if (keys['ArrowLeft'])  plane.position.x -= moveSpeed;
  if (keys['ArrowRight']) plane.position.x += moveSpeed;
  if (keys['ArrowUp'])    plane.position.y += moveSpeed;
  if (keys['ArrowDown'])  plane.position.y -= moveSpeed;
  plane.position.x += joyX * moveSpeed;
  plane.position.y -= joyY * moveSpeed;

  plane.position.x = THREE.MathUtils.clamp(plane.position.x, -bounds.x, bounds.x);
  plane.position.y = THREE.MathUtils.clamp(plane.position.y, bounds.yMin, bounds.y);
 
  // tilt effect on turn
  plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, keys['ArrowLeft'] ? 0.5 : keys['ArrowRight'] ? -0.5 : 0, 0.1);
}
 
// ---- Forward world illusion: move ground/sky markers toward camera ----
// (placeholder ground grid so movement feels 3D)
const grid = new THREE.GridHelper(200, 40, 0xffffff, 0xffffff);
grid.position.y = -1;
scene.add(grid);
 
let forwardSpeed = 0.2;
 
function animate() {
  requestAnimationFrame(animate);
  if (gameOver) return;

  if (gameStarted) {
    updateControls();
    updateObstacles();
    updateRings();
    grid.position.z += forwardSpeed;
    if (grid.position.z > 10) grid.position.z = 0;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, plane.position.x, 0.1);
    camera.lookAt(plane.position.x, plane.position.y, plane.position.z - 5);
  } else {
        plane.rotation.y += 0.01; // slow spin on home screen
        grid.position.z += 0.05; // slow idle drift
        if (grid.position.z > 10) grid.position.z = 0;
    }

  renderer.render(scene, camera); // always render, even before start
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Stars background ----
const starGeo = new THREE.BufferGeometry();
const starCount = 800;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 200;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 }));
scene.add(stars);

// ---- Obstacles ----
const obstacles = [];
let score = 0;
let gameOver = false;
let gameStarted = false;
const scoreEl = document.getElementById('score');

function spawnObstacle() {
  const gapX = (Math.random() - 0.5) * 6; // safe gap position
  for (let x = -6; x <= 6; x += 2) {
    if (Math.abs(x - gapX) < 1.5) continue; // leave gap to dodge through
    const obs = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true, roughness: 0.9 })
    );
    obs.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
    obs.position.set(x, Math.random() * 3.5 + 0.5, plane.position.z - 60);
    scene.add(obs);
    obstacles.push(obs);
  }
}

setInterval(() => { if (gameStarted) spawnObstacle(); }, 800);

function updateObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += forwardSpeed;
        
        // collision check
        if (obs.position.distanceTo(plane.position) < 0.9) {
            camera.position.x += (Math.random() - 0.5) * 0.5;
            camera.position.y += (Math.random() - 0.5) * 0.5;
            document.getElementById('finalScore').textContent = 'Score: ' + score;
            document.getElementById('gameOver').style.display = 'block';
            gameOver = true;
            return;
        }
    
        // passed player -> remove + score
        if (obs.position.z > plane.position.z + 5) {
            scene.remove(obs);
            obstacles.splice(i, 1);
            score++;
            new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3').play().catch(()=>{});
            scoreEl.textContent = 'Score: ' + score;
            if (forwardSpeed < 0.8) {
                forwardSpeed += 0.001;
            } else {}
        }
    }
}

// ---- Rings (bonus points) ----
const rings = [];

function spawnRing() {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.15, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x554400 })
  );
  ring.position.set((Math.random() - 0.5) * 8, Math.random() * 3 + 1, plane.position.z - 70);
  scene.add(ring);
  rings.push(ring);
}
setInterval(() => { if (gameStarted) spawnRing(); }, 1400);

function updateRings() {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.position.z += forwardSpeed;
    r.rotation.z += 0.02;

    if (r.position.distanceTo(plane.position) < 1.2) {
      scene.remove(r);
      rings.splice(i, 1);
      score += 5;
      scoreEl.textContent = 'Score: ' + score;
      continue;
    }
    if (r.position.z > plane.position.z + 5) {
      scene.remove(r);
      rings.splice(i, 1);
    }
  }
}

const zone = document.getElementById('joystickZone');
const stick = document.getElementById('joystickStick');
let joyActive = false, joyX = 0, joyY = 0;
let joyCenterX = 0, joyCenterY = 0;

document.addEventListener('touchstart', e => {
  if (!gameStarted || gameOver) return;
  const touch = e.touches[0];
  joyCenterX = touch.clientX;
  joyCenterY = touch.clientY;
  zone.style.left = (joyCenterX - 50) + 'px';
  zone.style.top = (joyCenterY - 50) + 'px';
  zone.style.display = 'block';
  joyActive = true;
});

document.addEventListener('touchmove', e => {
  if (!joyActive) return;
  const touch = e.touches[0];
  let dx = touch.clientX - joyCenterX;
  let dy = touch.clientY - joyCenterY;
  const maxDist = 35;
  const dist = Math.min(Math.hypot(dx, dy), maxDist);
  const angle = Math.atan2(dy, dx);
  dx = Math.cos(angle) * dist;
  dy = Math.sin(angle) * dist;
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  joyX = dx / maxDist;
  joyY = dy / maxDist;
});

document.addEventListener('touchend', e => {
  joyActive = false; joyX = 0; joyY = 0;
  zone.style.display = 'none';
  stick.style.transform = `translate(0px, 0px)`;
});

document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('joystickZone').style.display = 'block';
  document.getElementById('score').style.display = 'block';
  document.getElementById('startScreen').style.display = 'none';

  obstacles.forEach(o => scene.remove(o));
  obstacles.length = 0;
  rings.forEach(r => scene.remove(r));
  rings.length = 0;

  plane.position.set(0, 2, 0);
  score = 0;
  forwardSpeed = 0.2;
  scoreEl.textContent = 'Score: 0';

  gameOver = false;
  gameStarted = true;
});

document.getElementById('playBtn').addEventListener('click', () => {
  document.getElementById('joystickZone').style.display = 'block';
  document.getElementById('score').style.display = 'block';
  document.getElementById('startScreen').style.display = 'none';
  gameStarted = true;
});
animate();
