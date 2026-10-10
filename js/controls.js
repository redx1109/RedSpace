// ---- Controls ----
const keys = {};
const NAV_KEYS = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'];
const mouse = { x: 0, y: 0, active: false }; // active = mouse is steering
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k.startsWith('arrow') && e.target.tagName !== 'INPUT') e.preventDefault();
  if (NAV_KEYS.indexOf(k) >= 0) mouse.active = false;
  keys[k] = true;
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
function clearKeys() { for (const k in keys) keys[k] = false; }
window.addEventListener('blur', clearKeys);

const moveSpeed = 0.15;
const bounds = { x: 5, y: 4, yMin: 0.5 };
let velX = 0, velY = 0;

// ---- Mouse: the ship flies toward the cursor ----
const reticle = mk('reticle');
window.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return; // touch has its own joystick
  if (!gameStarted || gameOver || paused) return;
  const nx = clamp(((e.clientX / window.innerWidth) - 0.5) * 2.4, -1, 1);  // edges of the screen reach the edges of the play area
  const ny = clamp(((e.clientY / window.innerHeight) - 0.5) * 2.4, -1, 1);
  mouse.x = nx * bounds.x;
  mouse.y = bounds.yMin + (1 - (ny + 1) / 2) * (bounds.y - bounds.yMin);
  mouse.active = true;
  reticle.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px)';
});
function updateAim() { // hide the system cursor and show the ring while the mouse is steering
  document.body.classList.toggle('aiming', mouse.active && gameStarted && !gameOver && !paused);
}

function updateControls(dt) {
  let kx = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
  let ky = (keys.arrowup || keys.w ? 1 : 0) - (keys.arrowdown || keys.s ? 1 : 0);
  const kl = Math.hypot(kx, ky);
  if (kl > 1) { kx /= kl; ky /= kl; }
  velX = damp(velX, clamp(kx + joyX, -1, 1), 0.25, dt);
  velY = damp(velY, clamp(ky - joyY * 0.6, -1, 1), 0.25, dt);
  plane.position.x += velX * moveSpeed * sens * dt;
  plane.position.y += velY * moveSpeed * sens * dt;
  let mdx = 0;
  if (mouse.active) { // ease toward the cursor, speed and snappiness follow the sensitivity slider
    const gain = Math.min(0.2 * sens, 0.6), maxStep = moveSpeed * sens * 2;
    mdx = mouse.x - plane.position.x;
    const mdy = mouse.y - plane.position.y;
    plane.position.x += clamp(mdx * gain, -maxStep, maxStep) * dt;
    plane.position.y += clamp(mdy * gain, -maxStep, maxStep) * dt;
  }
  plane.position.x = clamp(plane.position.x, -bounds.x, bounds.x);
  plane.position.y = clamp(plane.position.y, bounds.yMin, bounds.y);

  // bank + yaw into the turn
  const steer = Math.abs(velX) > 0.05 ? velX : clamp(mdx * 0.6, -1, 1);
  plane.rotation.z = damp(plane.rotation.z, -steer * 0.7, 0.12, dt);
  plane.rotation.y = damp(plane.rotation.y, -steer * 0.35, 0.12, dt);
}

// ---- Touch joystick (floating, tracks one finger) ----
const zone = document.getElementById('joystickZone');
const stick = document.getElementById('joystickStick');
let joyId = null, joyX = 0, joyY = 0;
let joyCenterX = 0, joyCenterY = 0;
const JOY_MAX = 50;
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
  mouse.active = false;
  if (joyId !== null && !joyTouch(e.touches)) joyReset();
  if (!gameStarted || gameOver || paused || joyId !== null) return;
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
  const raw = Math.hypot(dx, dy);
  if (raw > JOY_MAX) { // center follows the thumb so reversing is instant
    const k = (raw - JOY_MAX) / raw;
    joyCenterX += dx * k; joyCenterY += dy * k;
    zone.style.left = (joyCenterX - zone.offsetWidth / 2) + 'px';
    zone.style.top = (joyCenterY - zone.offsetHeight / 2) + 'px';
    dx = t.clientX - joyCenterX; dy = t.clientY - joyCenterY;
  }
  const dist = Math.min(Math.hypot(dx, dy), JOY_MAX);
  const angle = Math.atan2(dy, dx);
  dx = Math.cos(angle) * dist;
  dy = Math.sin(angle) * dist;
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  const m = Math.pow(joyAxis(dist / JOY_MAX), 2);
  const s = dist > 0 ? m / dist : 0;
  joyX = dx * s; joyY = dy * s;
}, { passive: false });
function joyEnd(e) {
  if (joyId !== null && joyTouch(e.changedTouches)) joyReset();
}
document.addEventListener('touchend', joyEnd);
document.addEventListener('touchcancel', joyEnd);
