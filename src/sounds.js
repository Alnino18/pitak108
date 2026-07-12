// Звуковые эффекты через Web Audio API — без внешних аудиофайлов
// (не увеличивают размер сборки, не требуют сетевых запросов).

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

function tone({ freq = 440, duration = 0.12, type = 'sine', volume = 0.15, delay = 0 }) {
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

// Короткий "щелчок/шелест" картона — белый шум, пропущенный через полосовой фильтр
// с быстрым затуханием. Звучит гораздо ближе к настоящей карте, чем чистый тон.
function cardSnap({ duration = 0.09, freq = 2200, q = 1.2, volume = 0.5, delay = 0 }) {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + delay;

  const bufferSize = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // шум с линейным затуханием
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.Q.value = q;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(t0);
  noise.stop(t0 + duration + 0.02);
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

// Карта ложится на стол — короткий чёткий щелчок повыше тоном.
export function playCardSound() {
  if (!enabled) return;
  cardSnap({ duration: 0.07, freq: 2600, q: 1.6, volume: 0.5 });
}

// Карта берётся из колоды — шелест чуть длиннее и глуше (будто карта скользит).
export function drawCardSound() {
  if (!enabled) return;
  cardSnap({ duration: 0.11, freq: 1400, q: 0.9, volume: 0.4 });
  cardSnap({ duration: 0.06, freq: 2200, q: 1.4, volume: 0.25, delay: 0.03 });
}

export function turnSound() {
  if (!enabled) return;
  tone({ freq: 660, duration: 0.1, type: 'sine', volume: 0.14 });
  tone({ freq: 880, duration: 0.12, type: 'sine', volume: 0.12, delay: 0.1 });
}

export function winSound() {
  if (!enabled) return;
  [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, duration: 0.18, type: 'triangle', volume: 0.16, delay: i * 0.1 }));
}

export function loseRoundSound() {
  if (!enabled) return;
  tone({ freq: 220, duration: 0.25, type: 'sawtooth', volume: 0.12 });
}

// Раздача карт в начале раунда — несколько щелчков подряд, будто карты сдают одну за другой.
export function dealSound(count = 6) {
  if (!enabled) return;
  for (let i = 0; i < count; i++) {
    cardSnap({ duration: 0.06, freq: 2000 + Math.random() * 600, q: 1.3, volume: 0.32, delay: i * 0.07 });
  }
}
