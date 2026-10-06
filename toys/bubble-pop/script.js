'use strict';

/* ============================================================
   Bubble Pop · Procedural Sound, Particle Burst & Touch Glide Engine
   ============================================================ */

const bubbleGrid    = document.getElementById('bubbleGrid');
const popCountEl    = document.getElementById('popCount');
const sheetRemEl    = document.getElementById('sheetRemaining');
const replenishBtn  = document.getElementById('replenishBtn');
const soundToggle   = document.getElementById('soundToggle');
const soundIcon     = document.getElementById('soundIcon');
const themeButtons  = document.querySelectorAll('.theme-btn');
const pCanvas       = document.getElementById('particleCanvas');
const pCtx          = pCanvas.getContext('2d');

const COLS = window.innerWidth <= 400 ? 5 : 6;
const ROWS = 8;
const TOTAL_BUBBLES = COLS * ROWS;

let totalPopped = parseInt(localStorage.getItem('bubblepop_total') || '0', 10);
let audioCtx    = null;
let soundMuted  = localStorage.getItem('bubblepop_muted') === 'true';
let isPointerDown = false;
let particles   = [];

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
 * Procedurally synthesise a realistic bubble wrap "pop".
 * Layer 1: Sharp plastic snap (noise burst)
 * Layer 2: Hollow air plop (rapid pitch drop sine wave with filter resonance)
 */
function playBubblePop(pitchMod = 1.0) {
  if (soundMuted) return;
  initAudio();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;
  const jitter = 0.85 + Math.random() * 0.3; // Random pitch variation
  const baseFreq = 340 * pitchMod * jitter;

  // Layer 1: Hollow air cavity resonance (sine plunge)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(70 * jitter, now + 0.08);

  oscGain.gain.setValueAtTime(0.7, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

  osc.connect(oscGain);

  // Layer 2: Crisp snap transient (highpass click)
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = 'triangle';
  clickOsc.frequency.setValueAtTime(1400 * jitter, now);
  clickOsc.frequency.exponentialRampToValueAtTime(300, now + 0.025);

  clickGain.gain.setValueAtTime(0.4, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  clickOsc.connect(clickGain);

  // Master output limiter / compressor
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.ratio.value = 6;

  oscGain.connect(comp);
  clickGain.connect(comp);
  comp.connect(ctx.destination);

  osc.start(now);
  clickOsc.start(now);
  osc.stop(now + 0.09);
  clickOsc.stop(now + 0.03);
}

/**
 * Ascending ripple sound for replenish
 */
function playReplenishSound() {
  if (soundMuted) return;
  initAudio();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;

  [260, 330, 392, 523, 659].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + i * 0.045;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.15);
  });
}

// ── Particle Canvas Engine ───────────────────────────────────
function resizeCanvas() {
  pCanvas.width  = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ConfettiParticle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4.5 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 1.5;
    this.gravity = 0.18;
    this.size = Math.random() * 4 + 2.5;
    this.alpha = 1;
    this.color = color;
    this.decay = Math.random() * 0.04 + 0.025;
    this.shape = Math.random() < 0.5 ? 'circle' : 'star';
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.98;
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

function spawnPopParticles(x, y, color) {
  const count = 10;
  for (let i = 0; i < count; i++) {
    particles.push(new ConfettiParticle(x, y, color));
  }
}

function renderParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw(pCtx);
    if (p.alpha <= 0) particles.splice(i, 1);
  }
  requestAnimationFrame(renderParticles);
}
renderParticles();

// ── Grid Generation ──────────────────────────────────────────
function createGrid() {
  bubbleGrid.innerHTML = '';
  bubbleGrid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const b = document.createElement('div');
      b.className = `bubble row-${r % 8}`;
      b.dataset.index = idx;
      b.dataset.row = r;
      b.dataset.col = c;
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      b.setAttribute('aria-label', `Bubble ${idx + 1}`);

      bubbleGrid.appendChild(b);
    }
  }

  updateStats();
}

function updateStats() {
  popCountEl.textContent = totalPopped;
  const remaining = bubbleGrid.querySelectorAll('.bubble:not(.popped)').length;
  sheetRemEl.textContent = remaining;
}

// ── Popping Logic ────────────────────────────────────────────
function popBubble(bubbleEl) {
  if (!bubbleEl || bubbleEl.classList.contains('popped')) return;

  bubbleEl.classList.add('popped', 'pop-anim');
  bubbleEl.setAttribute('aria-pressed', 'true');

  const rect = bubbleEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Sound with row-based pitch progression
  const row = parseInt(bubbleEl.dataset.row || '0', 10);
  const pitchFactor = 0.9 + (row / ROWS) * 0.4;
  playBubblePop(pitchFactor);

  // Haptic feedback
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(12); } catch {}
  }

  // Particle explosion
  const colors = ['#ff5252', '#ff9100', '#ffd600', '#00e676', '#00b0ff', '#d500f9', '#ffffff'];
  const burstColor = colors[row % colors.length];
  spawnPopParticles(cx, cy, burstColor);

  // Stats bump
  totalPopped++;
  localStorage.setItem('bubblepop_total', totalPopped);
  popCountEl.classList.remove('bump');
  void popCountEl.offsetWidth;
  popCountEl.classList.add('bump');
  setTimeout(() => popCountEl.classList.remove('bump'), 180);

  updateStats();

  setTimeout(() => {
    bubbleEl.classList.remove('pop-anim');
  }, 250);
}

// ── Glide & Swipe Interaction ────────────────────────────────
function handlePointerDown(e) {
  isPointerDown = true;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.bubble');
  if (target) popBubble(target);
}

function handlePointerMove(e) {
  if (!isPointerDown) return;
  // Support both single and multi-point glide
  const touches = e.touches ? Array.from(e.touches) : [{ clientX: e.clientX, clientY: e.clientY }];
  touches.forEach(t => {
    const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('.bubble');
    if (el) popBubble(el);
  });
}

function handlePointerUp() {
  isPointerDown = false;
}

// Desktop mouse & mobile pointer bindings
bubbleGrid.addEventListener('pointerdown', handlePointerDown);
window.addEventListener('pointermove', handlePointerMove);
window.addEventListener('pointerup', handlePointerUp);
window.addEventListener('pointercancel', handlePointerUp);

// Prevent scroll dragging across the bubble sheet on iOS & Android
bubbleGrid.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  if (touch) {
    isPointerDown = true;
    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.bubble');
    if (target) popBubble(target);
  }
}, { passive: false });

bubbleGrid.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isPointerDown) return;
  for (let i = 0; i < e.touches.length; i++) {
    const t = e.touches[i];
    const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('.bubble');
    if (el) popBubble(el);
  }
}, { passive: false });

bubbleGrid.addEventListener('touchend', handlePointerUp);

// Keyboard access
bubbleGrid.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    const active = document.activeElement;
    if (active && active.classList.contains('bubble')) {
      e.preventDefault();
      popBubble(active);
    }
  }
});

// ── Replenish / Reset Action ─────────────────────────────────
function replenishSheet() {
  const container = document.getElementById('sheetContainer');
  container.classList.add('shake');
  setTimeout(() => container.classList.remove('shake'), 400);

  playReplenishSound();

  const bubbles = bubbleGrid.querySelectorAll('.bubble');
  bubbles.forEach((b, idx) => {
    const r = parseInt(b.dataset.row || '0', 10);
    const c = parseInt(b.dataset.col || '0', 10);
    const delay = (r + c) * 22; // Diagonal wave timing

    setTimeout(() => {
      b.classList.remove('popped');
      b.classList.add('replenish-anim');
      setTimeout(() => b.classList.remove('replenish-anim'), 350);
      updateStats();
    }, delay);
  });
}

replenishBtn.addEventListener('click', replenishSheet);

// ── Theme Selector ───────────────────────────────────────────
themeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    themeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const theme = btn.dataset.theme;
    document.body.dataset.theme = theme;
    localStorage.setItem('bubblepop_theme', theme);
  });
});

// Load saved theme
const savedTheme = localStorage.getItem('bubblepop_theme');
if (savedTheme) {
  const matching = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`);
  if (matching) matching.click();
}

// ── Sound Toggle ─────────────────────────────────────────────
function updateSoundUI() {
  soundIcon.textContent = soundMuted ? '🔇' : '🔊';
  soundToggle.classList.toggle('muted', soundMuted);
}

soundToggle.addEventListener('click', () => {
  soundMuted = !soundMuted;
  localStorage.setItem('bubblepop_muted', soundMuted);
  updateSoundUI();
  if (!soundMuted) playBubblePop(1);
});
updateSoundUI();

// ── Boot ─────────────────────────────────────────────────────
createGrid();
