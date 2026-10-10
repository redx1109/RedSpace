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

  updateStreaks(forwardSpeed, wdt);
  grid.position.z = (grid.position.z + forwardSpeed * wdt) % 5;
  updateStars(forwardSpeed * 0.6, wdt);
  updateTheme(dt);
  updateHud();

  if (!gameOver) { // engine trail
    for (let i = 0; i < 2; i++) {
      emit(plane.position.x + rand(-0.12, 0.12), plane.position.y + rand(-0.12, 0.12), plane.position.z + 1,
        rand(-0.01, 0.01), rand(-0.01, 0.01), forwardSpeed * timeScale + 0.04, 22,
        curSector && curSector.kind === 'sky' ? (Math.random() < 0.5 ? 0xffffff : 0xbbbbbb) : (Math.random() < 0.5 ? 0xff7733 : 0xffcc55));
    }
  }
}

let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  updateAim();
  if (portrait.matches) { last = now || performance.now(); return; }
  if (paused) { last = now || performance.now(); renderer.render(scene, camera); return; }
  now = now || performance.now();
  const dt = Math.min((now - last) / 16.667, 2); // 1 = one 60Hz frame, any refresh rate
  last = now;

  if (gameStarted && !gameOver) tick(dt);
  else if (!gameStarted) { // home screen idle
    plane.rotation.z += 0.02 * dt;
    updateStreaks(0.05, dt);
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
  if (window.matchMedia('(pointer: coarse)').matches) { // phones: fullscreen + landscape where the browser allows it
    try {
      const el = document.documentElement;
      (el.requestFullscreen ? el.requestFullscreen() : Promise.reject())
        .then(() => screen.orientation.lock('landscape')).catch(() => {});
    } catch (e) {}
  }
  clearList(obstacles); clearList(rings); clearList(pickups);
  pLife.fill(0);
  plane.position.set(0, 2, 0);
  plane.rotation.set(0, 0, 0);
  plane.visible = true;
  score = 0; progress = 0; forwardSpeed = 0.2; timeScale = 1; shake = 0;
  power.shield = false; power.slow = 0; power.magnet = 0; shield.visible = false;
  storm.left = 0; nextStorm = 300; obsT = 0; ringT = 0; puT = 0;
  snapTheme();
  camX = 0; camY = 2; camera.fov = 75; camera.updateProjectionMatrix();
  scoreEl.textContent = 'Score: 0';
  scoreEl.style.display = 'block';
  setCombo(1); updateHud();
  bestEl.textContent = 'Best ' + best; bestEl.style.display = 'block';
  joyReset();
  mouse.active = false;
  velX = 0; velY = 0;
  paused = false; pauseMenu.style.display = 'none'; pauseBtn.style.display = 'block';
  overEl.style.display = 'none';
  startEl.style.display = 'none';
  last = performance.now();
  gameOver = false;
  gameStarted = true;
}
snapTheme();
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

animate();