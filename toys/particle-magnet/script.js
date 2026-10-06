'use strict';

/* ============================================================
   Particle Magnet · Dual Polarity, Multi-Touch & Magnetic Drone Engine
   ============================================================ */

const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const polarityBtn = document.getElementById('polarityBtn');
const polarityIcon= document.getElementById('polarityIcon');
const polarityText= document.getElementById('polarityText');
const soundToggle = document.getElementById('soundToggle');
const soundIcon   = document.getElementById('soundIcon');
const themeBtns   = document.querySelectorAll('.theme-btn');

const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent);
const COUNT     = IS_MOBILE ? 140 : 260;

let W = 0, H = 0;
let particles = [];
let scatterDecay = 0;
let isRepelMode = false; // false = attract, true = repel

// Multi-touch poles map
const activePointers = new Map();

let audioCtx    = null;
let humOsc      = null;
let humGain     = null;
let soundMuted  = localStorage.getItem('magnet_muted') === 'true';

// ── Palettes ─────────────────────────────────────────────────
const PALETTES = {
  neon: {
    bg: 'rgba(9, 9, 15,',
    defaultColors: ['#ff3344', '#3355ff'],
    activeColor: '#00ff88',
    repelColor: '#ff0055',
    activeGlow: 'rgba(0, 255, 136,',
    repelGlow: 'rgba(255, 0, 85,',
  },
  solar: {
    bg: 'rgba(15, 10, 8,',
    defaultColors: ['#ff4400', '#ffaa00'],
    activeColor: '#ffdd00',
    repelColor: '#ff2200',
    activeGlow: 'rgba(255, 221, 0,',
    repelGlow: 'rgba(255, 34, 0,',
  },
  ocean: {
    bg: 'rgba(6, 12, 18,',
    defaultColors: ['#00d4ff', '#0055ff'],
    activeColor: '#00ffcc',
    repelColor: '#7928ca',
    activeGlow: 'rgba(0, 255, 204,',
    repelGlow: 'rgba(121, 40, 202,',
  },
  plasma: {
    bg: 'rgba(12, 8, 16,',
    defaultColors: ['#ff007f', '#7928ca'],
    activeColor: '#c44dff',
    repelColor: '#00f2fe',
    activeGlow: 'rgba(196, 77, 255,',
    repelGlow: 'rgba(0, 242, 254,',
  },
};

let currentPalette = PALETTES.neon;

// ── Audio Engine ─────────────────────────────────────────────
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    humOsc = audioCtx.createOscillator();
    humGain = audioCtx.createGain();

    humOsc.type = 'sawtooth';
    humOsc.frequency.setValueAtTime(60, audioCtx.currentTime);

    // Lowpass filter for warm electrical hum
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, audioCtx.currentTime);

    humGain.gain.setValueAtTime(0, audioCtx.currentTime);

    humOsc.connect(filter);
    filter.connect(humGain);
    humGain.connect(audioCtx.destination);

    humOsc.start();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function updateHum(activePolesCount, isRepelling) {
  if (soundMuted || !audioCtx) return;
  const now = audioCtx.currentTime;

  if (activePolesCount > 0) {
    const targetFreq = isRepelling ? 120 : (75 + activePolesCount * 25);
    const targetVol = isRepelling ? 0.22 : 0.16;
    humOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    humGain.gain.setTargetAtTime(targetVol, now, 0.08);
  } else {
    humGain.gain.setTargetAtTime(0, now, 0.08);
  }
}

function playBurstSound() {
  if (soundMuted) return;
  initAudio();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// ── Particle Class ───────────────────────────────────────────
class Particle {
  constructor() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.radius = Math.random() * 2.2 + 1.2;
    this.colorIndex = Math.floor(Math.random() * 2);
  }

  update(poles) {
    if (poles.length > 0) {
      poles.forEach(p => {
        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const dSq = dx * dx + dy * dy;
        const dist = Math.sqrt(dSq) || 0.001;

        if (p.isRepel) {
          // Repulsion blast
          const force = Math.min(8000 / (dSq + 100), 7.0);
          this.vx -= (dx / dist) * force * 0.14;
          this.vy -= (dy / dist) * force * 0.14;
        } else {
          // Attraction vortex
          const force = Math.min(4500 / (dSq + 80), 5.0);
          this.vx += (dx / dist) * force * 0.08;
          this.vy += (dy / dist) * force * 0.08;
        }
      });
    }

    // Drag
    this.vx *= 0.975;
    this.vy *= 0.975;

    this.x += this.vx;
    this.y += this.vy;

    // Seamless wrap
    if (this.x < -10) this.x = W + 10;
    else if (this.x > W + 10) this.x = -10;
    if (this.y < -10) this.y = H + 10;
    else if (this.y > H + 10) this.y = -10;
  }

  draw(hasPoles, isRepel) {
    const r = this.radius;

    if (hasPoles) {
      const col = isRepel ? currentPalette.repelColor : currentPalette.activeColor;
      const glow = isRepel ? currentPalette.repelGlow : currentPalette.activeGlow;

      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow + '0.12)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    } else {
      const color = currentPalette.defaultColors[this.colorIndex];
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color + '28';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

// ── Init ────────────────────────────────────────────────────
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function init() {
  resize();
  particles = Array.from({ length: COUNT }, () => new Particle());
}
window.addEventListener('resize', resize);
init();

// ── Render Loop ─────────────────────────────────────────────
function frame() {
  const poles = Array.from(activePointers.values()).filter(p => p.active);
  const hasActivePoles = poles.length > 0;
  const anyRepel = poles.some(p => p.isRepel);

  // Persistent fade creates fluid motion trails
  const fadeAlpha = hasActivePoles ? 0.2 : (scatterDecay > 0 ? 0.35 : 0.22);
  ctx.fillStyle = currentPalette.bg + fadeAlpha + ')';
  ctx.fillRect(0, 0, W, H);

  // Draw magnetic field radial glow for each active pole
  poles.forEach(p => {
    const glowCol = p.isRepel ? currentPalette.repelGlow : currentPalette.activeGlow;
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.isRepel ? 280 : 220);
    grd.addColorStop(0, glowCol + '0.14)');
    grd.addColorStop(1, glowCol + '0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  });

  for (const p of particles) {
    p.update(poles);
    p.draw(hasActivePoles, anyRepel);
  }

  if (scatterDecay > 0) scatterDecay--;

  requestAnimationFrame(frame);
}
frame();

// ── Pointer Helpers ──────────────────────────────────────────
function setPole(id, x, y, isRepel) {
  initAudio();
  activePointers.set(id, { x, y, active: true, isRepel });
  updateHum(activePointers.size, isRepel);
}

function removePole(id) {
  if (activePointers.has(id)) {
    activePointers.delete(id);
    playBurstSound();
    scatterDecay = 40;
    // Impulse burst
    for (const p of particles) {
      p.vx += (Math.random() - 0.5) * 5.5;
      p.vy += (Math.random() - 0.5) * 5.5;
    }
  }
  updateHum(activePointers.size, isRepelMode);
}

// Mouse controls
canvas.addEventListener('mousedown', (e) => {
  const isRightClick = e.button === 2;
  const repel = isRightClick || isRepelMode;
  setPole('mouse', e.clientX, e.clientY, repel);
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(10); } catch {}
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // Suppress default right-click context menu
});

window.addEventListener('mousemove', (e) => {
  const pole = activePointers.get('mouse');
  if (pole && pole.active) {
    pole.x = e.clientX;
    pole.y = e.clientY;
  }
});

window.addEventListener('mouseup', () => removePole('mouse'));

// Touch controls (Multi-touch support)
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    setPole(t.identifier, t.clientX, t.clientY, isRepelMode);
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(10); } catch {}
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const pole = activePointers.get(t.identifier);
    if (pole) {
      pole.x = t.clientX;
      pole.y = t.clientY;
    }
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    removePole(e.changedTouches[i].identifier);
  }
});

window.addEventListener('touchcancel', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    removePole(e.changedTouches[i].identifier);
  }
});

// ── UI Controls ──────────────────────────────────────────────
polarityBtn.addEventListener('click', () => {
  isRepelMode = !isRepelMode;
  polarityIcon.textContent = isRepelMode ? '💥' : '🧲';
  polarityText.textContent = isRepelMode ? 'Repel' : 'Attract';
  polarityBtn.classList.toggle('active', isRepelMode);
  playBurstSound();
});

themeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    themeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const name = btn.dataset.theme;
    if (PALETTES[name]) {
      currentPalette = PALETTES[name];
      document.body.dataset.theme = name;
      localStorage.setItem('magnet_theme', name);
    }
  });
});

const savedTheme = localStorage.getItem('magnet_theme');
if (savedTheme && PALETTES[savedTheme]) {
  const match = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`);
  if (match) match.click();
}

function updateSoundUI() {
  soundIcon.textContent = soundMuted ? '🔇' : '🔊';
  soundToggle.classList.toggle('muted', soundMuted);
}

soundToggle.addEventListener('click', () => {
  soundMuted = !soundMuted;
  localStorage.setItem('magnet_muted', soundMuted);
  updateSoundUI();
  if (soundMuted && humGain) humGain.gain.setValueAtTime(0, audioCtx.currentTime);
});
updateSoundUI();
