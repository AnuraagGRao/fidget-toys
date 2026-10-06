'use strict';

/* ============================================================
   Thock Switch · Advanced Mechanical Audio, CPS & RGB Engine
   ============================================================ */

const keycap      = document.getElementById('keycap');
const keycapSub   = document.getElementById('keycapSub');
const housing     = document.getElementById('housing');
const countEl     = document.getElementById('counterValue');
const cpsEl       = document.getElementById('cpsValue');
const switchSelect= document.getElementById('switchType');
const rgbSelect   = document.getElementById('rgbMode');
const soundToggle = document.getElementById('soundToggle');
const soundIcon   = document.getElementById('soundIcon');
const sceneGlow   = document.getElementById('sceneGlow');
const ledWindow   = document.getElementById('ledWindow');
const sparksCanvas= document.getElementById('sparksCanvas');
const sCtx        = sparksCanvas.getContext('2d');

let audioCtx    = null;
let pressCount  = parseInt(localStorage.getItem('thock_presses') || '0', 10);
let soundMuted  = localStorage.getItem('thock_muted') === 'true';
let currentType = localStorage.getItem('thock_switch') || 'gateron';
let currentRgb  = localStorage.getItem('thock_rgb') || 'reactive';
let pressed     = false;

// CPS Tracking
let clickTimestamps = [];
let sparks = [];

countEl.textContent = pressCount;
switchSelect.value  = currentType;
rgbSelect.value     = currentRgb;
document.body.dataset.switch = currentType;
document.body.dataset.rgb    = currentRgb;

// ── Audio Engine ─────────────────────────────────────────────
function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Procedural Mechanical Keyboard Audio Profiles
 */
function playSwitchDown(type) {
  if (soundMuted) return;
  ensureAudioCtx();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;
  const jitter = 0.95 + Math.random() * 0.1;

  if (type === 'gateron') {
    // Heavy Bass Thock (Ink Black)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(65 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.11);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(450 * jitter, now);
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    clickOsc.connect(clickGain);
    gain.connect(ctx.destination);
    clickGain.connect(ctx.destination);
    osc.start(now);
    clickOsc.start(now);
    osc.stop(now + 0.12);
    clickOsc.stop(now + 0.04);

  } else if (type === 'cherry') {
    // Sharp Clicky Blue Switch (Tactile click leaf snap)
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(2200 * jitter, now);
    click.frequency.exponentialRampToValueAtTime(600, now + 0.025);
    clickGain.gain.setValueAtTime(0.65, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    const bottom = ctx.createOscillator();
    const bottomGain = ctx.createGain();
    bottom.type = 'sine';
    bottom.frequency.setValueAtTime(140 * jitter, now);
    bottomGain.gain.setValueAtTime(0.5, now);
    bottomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    click.connect(clickGain);
    bottom.connect(bottomGain);
    clickGain.connect(ctx.destination);
    bottomGain.connect(ctx.destination);
    click.start(now);
    bottom.start(now);
    click.stop(now + 0.035);
    bottom.stop(now + 0.07);

  } else if (type === 'panda') {
    // Holy Panda Clack (Mid-range snap & bump)
    const clack = ctx.createOscillator();
    const clackGain = ctx.createGain();
    clack.type = 'sine';
    clack.frequency.setValueAtTime(480 * jitter, now);
    clack.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    clackGain.gain.setValueAtTime(0.7, now);
    clackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    clack.connect(clackGain);
    clackGain.connect(ctx.destination);
    clack.start(now);
    clack.stop(now + 0.09);

  } else if (type === 'silent') {
    // Silent Linear (Cushioned velvet thud)
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(80 * jitter, now);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.06);
    thudGain.gain.setValueAtTime(0.35, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.07);
  }
}

function playSwitchUp(type) {
  if (soundMuted) return;
  ensureAudioCtx();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;
  const jitter = 0.95 + Math.random() * 0.1;

  // Upstroke stem top-out clack
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const freq = type === 'silent' ? 120 : (type === 'cherry' ? 980 : 380);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * jitter, now);
  gain.gain.setValueAtTime(type === 'silent' ? 0.15 : 0.32, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}

// ── Sparks & RGB Canvas ──────────────────────────────────────
function resizeCanvas() {
  sparksCanvas.width  = window.innerWidth;
  sparksCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Spark {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1;
    this.alpha = 1;
    this.decay = Math.random() * 0.04 + 0.03;
    this.color = color;
    this.size = Math.random() * 3 + 1.5;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.12;
    this.alpha -= this.decay;
  }
  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function spawnSparks() {
  const rect = keycap.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.bottom;
  const colors = {
    gateron: '#38bdf8',
    cherry:  '#3b82f6',
    panda:   '#f59e0b',
    silent:  '#ec4899',
  };
  const c = colors[currentType] || '#38bdf8';
  for (let i = 0; i < 14; i++) {
    sparks.push(new Spark(cx, cy, c));
  }
}

function renderSparks() {
  sCtx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height);
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.update();
    s.draw(sCtx);
    if (s.alpha <= 0) sparks.splice(i, 1);
  }
  requestAnimationFrame(renderSparks);
}
renderSparks();

// ── CPS Gauge Loop ───────────────────────────────────────────
function updateCPS() {
  const now = Date.now();
  clickTimestamps = clickTimestamps.filter(t => now - t <= 1000);
  const cps = clickTimestamps.length;
  cpsEl.textContent = cps.toFixed(1);
}
setInterval(updateCPS, 100);

// ── Press / Release Mechanics ────────────────────────────────
function onPress() {
  if (pressed) return;
  pressed = true;

  keycap.classList.add('pressed');
  keycap.setAttribute('aria-pressed', 'true');
  housing.classList.add('active');

  // Downstroke audio
  playSwitchDown(currentType);

  // Haptic feedback
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(12); } catch {}
  }

  // Sparks & Counter
  spawnSparks();
  pressCount++;
  localStorage.setItem('thock_presses', pressCount);
  countEl.textContent = pressCount;
  countEl.classList.remove('bump');
  void countEl.offsetWidth;
  countEl.classList.add('bump');

  clickTimestamps.push(Date.now());
  updateCPS();
}

function onRelease() {
  if (!pressed) return;
  pressed = false;

  // Upstroke audio
  playSwitchUp(currentType);

  keycap.classList.remove('pressed');
  keycap.setAttribute('aria-pressed', 'false');
  housing.classList.remove('active');
}

// ── Event Wiring ─────────────────────────────────────────────
keycap.addEventListener('mousedown', onPress);
window.addEventListener('mouseup', onRelease);
keycap.addEventListener('mouseleave', () => { if (pressed) onRelease(); });

keycap.addEventListener('touchstart', (e) => {
  e.preventDefault();
  onPress();
}, { passive: false });

window.addEventListener('touchend', onRelease);
window.addEventListener('touchcancel', onRelease);

window.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && !pressed) {
    e.preventDefault();
    onPress();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    onRelease();
  }
});

// ── Controls Selectors ───────────────────────────────────────
switchSelect.addEventListener('change', () => {
  currentType = switchSelect.value;
  document.body.dataset.switch = currentType;
  localStorage.setItem('thock_switch', currentType);
  const labels = {
    gateron: 'THOCK',
    cherry:  'CLICK',
    panda:   'CLACK',
    silent:  'VELVET',
  };
  keycapSub.textContent = labels[currentType] || 'THOCK';
  playSwitchDown(currentType);
});

rgbSelect.addEventListener('change', () => {
  currentRgb = rgbSelect.value;
  document.body.dataset.rgb = currentRgb;
  localStorage.setItem('thock_rgb', currentRgb);
});

function updateSoundUI() {
  soundIcon.textContent = soundMuted ? '🔇' : '🔊';
  soundToggle.classList.toggle('muted', soundMuted);
}

soundToggle.addEventListener('click', () => {
  soundMuted = !soundMuted;
  localStorage.setItem('thock_muted', soundMuted);
  updateSoundUI();
  if (!soundMuted) playSwitchDown(currentType);
});
updateSoundUI();
