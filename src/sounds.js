// Лёгкие звуковые эффекты через Web Audio API — без внешних аудиофайлов
// (значит, не увеличивают размер сборки и не требуют лишних сетевых запросов).

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep({ freq = 440, duration = 0.12, type = 'sine', volume = 0.15, delay = 0 }) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

let enabled = true;
try {
  enabled = localStorage.getItem('soundOn') !== 'false';
} catch (e) {}

export function isSoundOn() {
  return enabled;
}

export function setSoundOn(v) {
  enabled = v;
  try { localStorage.setItem('soundOn', v ? 'true' : 'false'); } catch (e) {}
}

export function playCardSound() {
  if (!enabled) return;
  beep({ freq: 520, duration: 0.09, type: 'triangle', volume: 0.14 });
}

export function drawCardSound() {
  if (!enabled) return;
  beep({ freq: 300, duration: 0.1, type: 'sawtooth', volume: 0.1 });
}

export function turnSound() {
  if (!enabled) return;
  beep({ freq: 660, duration: 0.1, type: 'sine', volume: 0.16 });
  beep({ freq: 880, duration: 0.12, type: 'sine', volume: 0.14, delay: 0.1 });
}

export function winSound() {
  if (!enabled) return;
  [523, 659, 784, 1046].forEach((f, i) => beep({ freq: f, duration: 0.18, type: 'triangle', volume: 0.16, delay: i * 0.1 }));
}

export function loseRoundSound() {
  if (!enabled) return;
  beep({ freq: 220, duration: 0.25, type: 'sawtooth', volume: 0.12 });
}
