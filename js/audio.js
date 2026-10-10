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

