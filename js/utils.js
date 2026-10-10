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

