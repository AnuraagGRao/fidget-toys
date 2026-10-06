'use strict';

/* ============================================================
   Flick Targets · Musical Pentatonic Chimes, Combo Streaks & Slice FX
   ============================================================ */

const field       = document.getElementById('field');
const scoreEl     = document.getElementById('score');
const bestEl      = document.getElementById('best');
const comboPill   = document.getElementById('comboPill');
const comboNumEl  = document.getElementById('comboNum');
const soundToggle = document.getElementById('soundToggle');
const soundIcon   = document.getElementById('soundIcon');
const fxCanvas    = document.getElementById('fxCanvas');
const fxCtx       = fxCanvas.getContext('2d');
const floaterTpl  = document.getElementById('floaterTpl');

const TARGET_ORB_COUNT = 6;
const RESPAWN_DELAY_MS = 220;
const SCORE_KEY = 'flickTargets_best';

// Pentatonic Scale Chime Frequencies
const PENTATONIC = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
];

const ORB_COLOURS = [
  '#ff44aa', '#ff6b6b', '#ff9944',
  '#ffd93d', '#4ade80', '#38bdf8',
  '#c084fc', '#2dd4bf',
];

let score = 0;
let best  = parseInt(localStorage.getItem(SCORE_KEY) || '0', 10);
bestEl.textContent = best;

let audioCtx    = null;
let soundMuted  = localStorage.getItem('flick_muted') === 'true';
let comboCount  = 1;
let lastPopTime = 0;
let noteIndex   = 0;

let isSlicing   = false;
let sliceTrail  = [];
let sparks      = [];

// ── Audio Engine ─────────────────────────────────────────────
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Play a bright crystal bell chime
 */
function playChime(freqMultiplier = 1.0) {
  if (soundMuted) return;
  initAudio();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;

  // Pick next note in pentatonic sequence
  const baseFreq = PENTATONIC[noteIndex % PENTATONIC.length];
  noteIndex++;

  const freq = baseFreq * freqMultiplier;

  // Primary crystal tone (sine)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, now);

  gain1.gain.setValueAtTime(0.45, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  // Overtone sparkle (bell harmonic 2.76x)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 2.76, now);

  gain2.gain.setValueAtTime(0.18, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.48);
  osc2.stop(now + 0.25);
}

// ── FX Canvas (Slice Trail & Particles) ──────────────────────
function resizeFx() {
  fxCanvas.width  = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeFx);
resizeFx();

class OrbSpark {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    const spd = Math.random() * 6 + 3;
    this.vx = Math.cos(a) * spd;
    this.vy = Math.sin(a) * spd;
    this.alpha = 1;
    this.color = color;
    this.decay = Math.random() * 0.05 + 0.035;
    this.r = Math.random() * 3 + 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.alpha -= this.decay;
  }
  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function spawnSparks(x, y, color) {
  for (let i = 0; i < 16; i++) {
    sparks.push(new OrbSpark(x, y, color));
  }
}

function renderFX() {
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

  // 1. Draw Slice Ribbon Trail
  if (sliceTrail.length > 1) {
    fxCtx.save();
    fxCtx.beginPath();
    fxCtx.moveTo(sliceTrail[0].x, sliceTrail[0].y);
    for (let i = 1; i < sliceTrail.length; i++) {
      fxCtx.lineTo(sliceTrail[i].x, sliceTrail[i].y);
    }
    fxCtx.lineCap = 'round';
    fxCtx.lineJoin = 'round';
    fxCtx.lineWidth = 4;
    fxCtx.strokeStyle = 'rgba(255, 68, 170, 0.7)';
    fxCtx.shadowColor = '#ff44aa';
    fxCtx.shadowBlur = 12;
    fxCtx.stroke();
    fxCtx.restore();
  }

  // Decay slice trail
  if (sliceTrail.length > 0) {
    sliceTrail.shift();
  }

  // 2. Draw Sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.update();
    s.draw(fxCtx);
    if (s.alpha <= 0) sparks.splice(i, 1);
  }

  requestAnimationFrame(renderFX);
}
renderFX();

// ── Field Helpers ────────────────────────────────────────────
function fieldRect() {
  return field.getBoundingClientRect();
}

function randomSize() {
  return Math.floor(Math.random() * 26) + 32; // 32-58px
}

function randomPosition(size) {
  const rect = fieldRect();
  const margin = size + 20;
  const x = margin + Math.random() * (rect.width - margin * 2);
  const y = margin + Math.random() * (rect.height - margin * 2);
  return { x, y };
}

function isPositionClear(x, y, size) {
  const existing = field.querySelectorAll('.orb:not(.popping)');
  for (const orb of existing) {
    const ox = parseFloat(orb.style.left);
    const oy = parseFloat(orb.style.top);
    const os = parseFloat(orb.style.width);
    const minD = (size + os) * 0.7;
    const dx = ox - x, dy = oy - y;
    if (Math.sqrt(dx * dx + dy * dy) < minD) return false;
  }
  return true;
}

function spawnOrb() {
  const size  = randomSize();
  const color = ORB_COLOURS[Math.floor(Math.random() * ORB_COLOURS.length)];

  let pos;
  for (let attempt = 0; attempt < 12; attempt++) {
    const p = randomPosition(size);
    if (isPositionClear(p.x, p.y, size)) { pos = p; break; }
  }
  if (!pos) pos = randomPosition(size);

  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.style.cssText = `
    left: ${pos.x}px;
    top:  ${pos.y}px;
    width:  ${size}px;
    height: ${size}px;
    --c: ${color};
  `;
  orb.dataset.color = color;
  orb.setAttribute('role', 'button');
  orb.setAttribute('tabindex', '0');
  orb.setAttribute('aria-label', 'Pop this orb');

  orb.addEventListener('click', (e) => {
    e.stopPropagation();
    popOrb(orb, pos);
  });

  field.appendChild(orb);
}

// ── Popping Logic & Combos ───────────────────────────────────
function popOrb(orb, pos) {
  if (!orb || orb.classList.contains('popping')) return;
  orb.classList.add('popping');
  orb.setAttribute('aria-label', 'Popped!');

  const now = Date.now();
  if (now - lastPopTime <= 1200) {
    comboCount = Math.min(comboCount + 1, 8);
  } else {
    comboCount = 1;
    noteIndex = 0; // Reset scale
  }
  lastPopTime = now;

  // Sound with combo pitch bend
  const comboMultiplier = 1 + (comboCount - 1) * 0.08;
  playChime(comboMultiplier);

  // Haptic feedback
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(12); } catch {}
  }

  // Update Score
  const pts = comboCount;
  score += pts;
  scoreEl.textContent = score;
  bumpEl(scoreEl);

  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem(SCORE_KEY, best);
    bumpEl(bestEl);
  }

  // Combo UI
  if (comboCount > 1) {
    comboPill.removeAttribute('hidden');
    comboNumEl.textContent = `x${comboCount}`;
  } else {
    comboPill.setAttribute('hidden', 'true');
  }

  // Floating score
  const fText = comboCount > 1 ? `+${pts} (x${comboCount})` : `+1`;
  showFloater(pos.x, pos.y + fieldRect().top, fText);

  // Sparks burst
  const c = orb.dataset.color || '#ff44aa';
  spawnSparks(pos.x, pos.y + fieldRect().top, c);

  // Cleanup & Respawn
  setTimeout(() => {
    orb.remove();
    spawnOrb();
  }, RESPAWN_DELAY_MS);
}

function bumpEl(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 180);
}

function showFloater(x, y, text = '+1') {
  const clone = floaterTpl.content.cloneNode(true);
  const el = clone.querySelector('.floater');
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

// ── Slice / Swipe Gesture ────────────────────────────────────
function checkSliceAtPoint(x, y) {
  sliceTrail.push({ x, y });
  if (sliceTrail.length > 8) sliceTrail.shift();

  // Find orbs under slice point
  const orbs = field.querySelectorAll('.orb:not(.popping)');
  const fR = fieldRect();
  const relX = x;
  const relY = y - fR.top;

  orbs.forEach(orb => {
    const ox = parseFloat(orb.style.left);
    const oy = parseFloat(orb.style.top);
    const r = parseFloat(orb.style.width) / 2;
    const dx = ox - relX;
    const dy = oy - relY;
    if (Math.sqrt(dx * dx + dy * dy) <= r + 10) {
      popOrb(orb, { x: ox, y: oy });
    }
  });
}

field.addEventListener('pointerdown', (e) => {
  isSlicing = true;
  checkSliceAtPoint(e.clientX, e.clientY);
});

window.addEventListener('pointermove', (e) => {
  if (!isSlicing) return;
  checkSliceAtPoint(e.clientX, e.clientY);
});

window.addEventListener('pointerup', () => {
  isSlicing = false;
  sliceTrail = [];
});

window.addEventListener('pointercancel', () => {
  isSlicing = false;
  sliceTrail = [];
});

// ── Combo Reset Timer ────────────────────────────────────────
setInterval(() => {
  if (Date.now() - lastPopTime > 1300 && comboCount > 1) {
    comboCount = 1;
    comboPill.setAttribute('hidden', 'true');
  }
}, 200);

// ── Boot ─────────────────────────────────────────────────────
for (let i = 0; i < TARGET_ORB_COUNT; i++) {
  setTimeout(spawnOrb, i * 80);
}

function updateSoundUI() {
  soundIcon.textContent = soundMuted ? '🔇' : '🔊';
  soundToggle.classList.toggle('muted', soundMuted);
}

soundToggle.addEventListener('click', () => {
  soundMuted = !soundMuted;
  localStorage.setItem('flick_muted', soundMuted);
  updateSoundUI();
  if (!soundMuted) playChime();
});
updateSoundUI();
