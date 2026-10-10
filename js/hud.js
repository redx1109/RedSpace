// ---- HUD (built here so index.html stays untouched) ----
function mk(id) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; }
const bestEl = mk('best'), comboEl = mk('combo'), puEl = mk('powerups'), bannerEl = mk('banner');
const rotateEl = mk('rotate');
rotateEl.textContent = 'Rotate your phone to play';
const portrait = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
const bestLine = document.createElement('p');
bestLine.id = 'bestLine';
startEl.insertBefore(bestLine, document.getElementById('playBtn'));
bestLine.textContent = best > 0 ? 'Best: ' + best : '';

// theme button: AUTO (sectors alternate by score) -> SPACE only -> SKY only
const themeBtn = document.createElement('button');
themeBtn.id = 'themeBtn';
const modeLabel = () => 'THEME: ' + MODES[modeIdx].toUpperCase();
themeBtn.textContent = modeLabel();
document.body.appendChild(themeBtn);
themeBtn.addEventListener('click', () => {
  modeIdx = (modeIdx + 1) % MODES.length;
  store('redspace_mode', MODES[modeIdx]);
  themeBtn.textContent = modeLabel();
  themeBtn.blur();
  if (!gameStarted) snapTheme(); // preview on the home screen; in a run it fades in
});

// pause button + menu (the sensitivity slider is saved between visits)
const pauseBtn = document.createElement('button');
pauseBtn.id = 'pauseBtn';
pauseBtn.textContent = 'II';
pauseBtn.setAttribute('aria-label', 'Pause');
document.body.appendChild(pauseBtn);
const pauseMenu = mk('pauseMenu');
pauseMenu.innerHTML =
  '<div class="panel"><h2>PAUSED</h2>' +
  '<label id="sensLabel"></label>' +
  '<input id="sensSlider" type="range" min="0.3" max="2.5" step="0.05">' +
  '<div class="row"><span>Low</span><span>High</span></div>' +
  '<div class="btns"><button id="resumeBtn">Resume</button><button id="pauseRestartBtn">Restart</button></div></div>';
const sensSlider = document.getElementById('sensSlider'), sensLabel = document.getElementById('sensLabel');
function showSens() { sensLabel.textContent = 'Sensitivity: ' + sens.toFixed(2) + 'x'; }
sensSlider.value = sens;
showSens();
sensSlider.addEventListener('input', () => {
  sens = parseFloat(sensSlider.value);
  showSens();
  store('redspace_sens', String(sens));
});
function setPaused(p) {
  if (p === paused || (p && (!gameStarted || gameOver))) return;
  paused = p;
  pauseMenu.style.display = p ? 'flex' : 'none';
  if (p) { joyReset(); clearKeys(); } else last = performance.now();
}
pauseBtn.addEventListener('click', () => { pauseBtn.blur(); setPaused(true); });
document.getElementById('resumeBtn').addEventListener('click', () => setPaused(false));
document.getElementById('pauseRestartBtn').addEventListener('click', () => startGame());
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') setPaused(!paused);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

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

