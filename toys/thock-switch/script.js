'use strict';

/* ============================================================
   Thock Switch
   - Highly detailed mechanical keyboard switch visual
   - CSS box-shadow animation simulates travel distance
   - Procedurally synthesised "thock" via Web Audio API
   ============================================================ */

const keycap  = document.getElementById('keycap');
const housing = keycap.closest('.switch-wrapper').querySelector('.housing');
const countEl = document.getElementById('counterValue');

let audioCtx = null;
let pressCount = 0;
let pressed    = false;

// ── Audio synthesis ─────────────────────────────────────────
function ensureAudioCtx () {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume suspended context (autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Synthesise a bass-heavy mechanical keyboard "thock".
 * Layered waveforms:
 *  1. 65 Hz sine — the low body resonance
 *  2. 200 Hz sine — mid-range housing ring
 *  3. White noise — the plastic click transient
 *  4. 1 200 Hz decaying tone — the tactile click
 * All passed through a DynamicsCompressor for punchiness.
 */
function playThock () {
  ensureAudioCtx();
  const ctx  = audioCtx;
  const now  = ctx.currentTime;
  const sr   = ctx.sampleRate;

  // Build PCM buffer (120 ms)
  const duration = 0.12;
  const buf  = ctx.createBuffer(1, Math.floor(sr * duration), sr);
  const data = buf.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const body  = Math.sin(2 * Math.PI * 65  * t) * Math.exp(-t * 22);         // low thump
    const mid   = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 45)  * 0.28; // housing ring
    const click = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 90) * 0.22; // click
    const noise = (Math.random() * 2 - 1)          * Math.exp(-t * 95) * 0.18; // transient noise
    data[i] = (body + mid + click + noise) * 0.72;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  // Compressor for that punchy, typewriter character
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value      =  8;
  comp.ratio.value     =  5;
  comp.attack.value    =  0.001;
  comp.release.value   =  0.06;

  src.connect(comp);
  comp.connect(ctx.destination);
  src.start(now);
}

// ── Visual helpers ───────────────────────────────────────────
function spawnRipple () {
  const rect = keycap.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;

  const el   = document.createElement('div');
  el.className = 'ripple';
  el.style.left = cx + 'px';
  el.style.top  = cy + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function bumpCounter () {
  countEl.classList.remove('bump');
  // Force reflow to restart animation
  void countEl.offsetWidth;
  countEl.classList.add('bump');
  countEl.addEventListener('transitionend', () => countEl.classList.remove('bump'), { once: true });
}

// ── Press / release ──────────────────────────────────────────
function onPress () {
  if (pressed) return;
  pressed = true;

  keycap.classList.add('pressed');
  keycap.setAttribute('aria-pressed', 'true');
  housing.classList.add('active');
}

function onRelease () {
  if (!pressed) return;
  pressed = false;

  // Sound fires at bottom-out (when fully pressed, on release)
  playThock();
  spawnRipple();

  pressCount++;
  countEl.textContent = pressCount;
  bumpCounter();

  keycap.classList.remove('pressed');
  keycap.setAttribute('aria-pressed', 'false');
  housing.classList.remove('active');
}

// ── Event wiring ─────────────────────────────────────────────
keycap.addEventListener('mousedown',  onPress);
keycap.addEventListener('mouseup',    onRelease);
keycap.addEventListener('mouseleave', () => { if (pressed) onRelease(); });

keycap.addEventListener('touchstart', (e) => { e.preventDefault(); onPress();   }, { passive: false });
keycap.addEventListener('touchend',   (e) => { e.preventDefault(); onRelease(); }, { passive: false });

// Keyboard support (Space / Enter)
keycap.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && !pressed) {
    e.preventDefault();
    onPress();
  }
});
keycap.addEventListener('keyup', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    onRelease();
  }
});
