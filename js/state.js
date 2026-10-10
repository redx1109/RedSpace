// ---- Game state ----
// Sectors alternate sky / space and loop forever. planet = big body in the distance (sun, moon or planet),
// px/py = where it sits, stars = star brightness. kind decides ship model, grid and streak style.
const SECTOR_LEN = 120; // progress points per sector (about 20 seconds)
const SECTORS = [
  { name: 'DEEP SPACE',    kind: 'space', sky: 0x070a1f, planet: 0x3a6ea5, px: -110, py: -50, stars: 0.85 },
  { name: 'CLEAR SKIES',   kind: 'sky',   sky: 0x87CEEB, planet: 0xfff2a0, px: 90,   py: 30,  stars: 0 },
  { name: 'NEBULA',        kind: 'space', sky: 0x2d1250, planet: 0xb04fd6, px: -120, py: -20, stars: 0.9 },
  { name: 'SUNSET',        kind: 'sky',   sky: 0xff9b5e, planet: 0xff6a2a, px: 30,   py: -5,  stars: 0 },
  { name: 'STAR DAWN',     kind: 'space', sky: 0x7a3318, planet: 0xffb347, px: -40,  py: 35,  stars: 0.6 },
  { name: 'TWILIGHT',      kind: 'sky',   sky: 0x3a1f6e, planet: 0xdfe8ff, px: -90,  py: 30,  stars: 0.5 },
  { name: 'ICE FIELD',     kind: 'space', sky: 0x0b3b4a, planet: 0x7fe0ff, px: 120,  py: -10, stars: 0.85 },
  { name: 'STORM CLOUDS',  kind: 'sky',   sky: 0x4a5568, planet: 0x9aa5b8, px: 110,  py: 40,  stars: 0 },
  { name: 'CRIMSON STORM', kind: 'space', sky: 0x3d0a16, planet: 0xff3355, px: -90,  py: 20,  stars: 0.85 }
];
const MODES = ['auto', 'space', 'sky']; // auto = sectors alternate, otherwise only that kind
let modeIdx = Math.max(0, MODES.indexOf(store('redspace_mode')));
function sectorAt(p) {
  const list = modeIdx === 0 ? SECTORS : SECTORS.filter(s => s.kind === MODES[modeIdx]);
  return list[Math.floor(p / SECTOR_LEN) % list.length];
}
let score = 0, progress = 0, combo = 1;
let gameOver = false, gameStarted = false;
let forwardSpeed = 0.2, timeScale = 1, shake = 0;
let best = parseInt(store('redspace_best'), 10) || 0;
let sens = clamp(parseFloat(store('redspace_sens')) || 1, 0.3, 2.5); // set in the pause menu, saved
let paused = false;
const power = { shield: false, slow: 0, magnet: 0 };
const storm = { left: 0 };
let nextStorm = 300, obsT = 0, ringT = 0, puT = 0, stormT = 0, curSector = null;
const obstacles = [], rings = [], pickups = [];
const skyCur = new THREE.Color(0x070a1f), skyTarget = new THREE.Color();

const scoreEl = document.getElementById('score');
const finalEl = document.getElementById('finalScore');
const overEl = document.getElementById('gameOver');
const startEl = document.getElementById('startScreen');

