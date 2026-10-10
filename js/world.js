// ---- Sky theme by progress ----
function applySky() { scene.background.copy(skyCur); scene.fog.color.copy(skyCur); }
const streakT = new THREE.Color();
function updateTheme(dt) {
  const th = sectorAt(progress);
  if (th !== curSector) { // new sector (score milestone or theme button)
    if (!curSector || curSector.kind !== th.kind) setKind(th.kind);
    curSector = th;
    banner(th.name);
  }
  const sky = th.kind === 'sky';
  skyTarget.setHex(th.sky);
  skyCur.lerp(skyTarget, 1 - Math.pow(0.985, dt));
  applySky();
  starMat.opacity = damp(starMat.opacity, th.stars, 0.03, dt);

  planetT.setHex(th.planet); // planet / sun drifts and changes colour per sector
  planetMat.color.lerp(planetT, 1 - Math.pow(0.99, dt));
  planetMat.emissive.copy(planetMat.color);
  haloMat.color.copy(planetMat.color);
  planet.position.x = damp(planet.position.x, th.px, 0.01, dt);
  planet.position.y = damp(planet.position.y, th.py, 0.01, dt);

  streakT.setHex(sky ? 0xffffff : 0x9bb7ff);
  streaks.material.color.lerp(streakT, 0.05 * dt);
  streaks.material.opacity = damp(streaks.material.opacity, sky ? 0.3 : 0.5, 0.05, dt);
  grid.material.opacity = damp(grid.material.opacity, sky ? 0.35 : 0, 0.05, dt);
  grid.visible = grid.material.opacity > 0.02;
}
// jump straight to the sector for progress 0 (menus, new run, theme button on the home screen)
function snapTheme() {
  const th = sectorAt(0), sky = th.kind === 'sky';
  curSector = th;
  setKind(th.kind);
  skyCur.setHex(th.sky); applySky();
  starMat.opacity = th.stars;
  planetMat.color.setHex(th.planet);
  planetMat.emissive.copy(planetMat.color);
  haloMat.color.copy(planetMat.color);
  planet.position.set(th.px, th.py, -420);
  streaks.material.color.setHex(sky ? 0xffffff : 0x9bb7ff);
  streaks.material.opacity = sky ? 0.3 : 0.5;
  grid.material.opacity = sky ? 0.35 : 0;
  grid.visible = sky;
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

