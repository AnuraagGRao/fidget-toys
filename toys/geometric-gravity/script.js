'use strict';

/* ============================================================
   Geometric Gravity · Physical Collisions, Marimba Audio & Tilt Engine
   ============================================================ */

const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const tiltBtn       = document.getElementById('tilt-btn');
const gravitySelect = document.getElementById('gravityMode');
const addShapesBtn  = document.getElementById('addShapesBtn');
const resetBtn      = document.getElementById('resetBtn');
const soundToggle   = document.getElementById('soundToggle');
const soundIcon     = document.getElementById('soundIcon');

let W = 0, H = 0;
let gravityMode = 'down';
let gravity = { x: 0, y: 0.5 };
let shapes  = [];
let sparks  = [];
let dragged = null;
let prevDrag = { x: 0, y: 0 };

let audioCtx    = null;
let soundMuted  = localStorage.getItem('gravity_muted') === 'true';
let lastSoundTime = 0;

const PALETTE = [
  '#ff6b6b','#ff9944','#ffd93d',
  '#4ade80','#38bdf8','#c084fc',
  '#2dd4bf','#f43f5e','#a855f7',
];

const SHAPE_DEFS = [
  { sides: 3 }, { sides: 3 },
  { sides: 4 }, { sides: 4 },
  { sides: 5 }, { sides: 5 },
  { sides: 6 }, { sides: 6 },
  { sides: 7 }, { sides: 8 },
];

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
 * Play a resonant wooden block / marimba strike
 */
function playCollisionSound(speed) {
  if (soundMuted || speed < 1.2) return;
  const nowMs = Date.now();
  if (nowMs - lastSoundTime < 35) return; // Prevent audio congestion
  lastSoundTime = nowMs;

  initAudio();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Scale pitch by speed & slight random jitter
  const baseFreq = 280 + Math.min(speed * 30, 400) + Math.random() * 40;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.08);

  const vol = Math.min(speed / 14, 0.4);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

// ── Sparks Canvas FX ─────────────────────────────────────────
class HitSpark {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    const spd = Math.random() * 4 + 1.5;
    this.vx = Math.cos(a) * spd;
    this.vy = Math.sin(a) * spd;
    this.alpha = 1;
    this.color = color;
    this.decay = Math.random() * 0.05 + 0.04;
    this.r = Math.random() * 2.5 + 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
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
  for (let i = 0; i < 6; i++) {
    sparks.push(new HitSpark(x, y, color));
  }
}

// ── Shape Class ──────────────────────────────────────────────
class Shape {
  constructor(x, y, sides, radius, color) {
    this.x       = x;
    this.y       = y;
    this.vx      = (Math.random() - 0.5) * 3;
    this.vy      = (Math.random() - 0.5) * 3;
    this.sides   = sides;
    this.radius  = radius;
    this.color   = color;
    this.angle   = Math.random() * Math.PI * 2;
    this.angV    = (Math.random() - 0.5) * 0.06;
    this.dragging = false;
  }

  update(shapes) {
    if (this.dragging) return;

    // Apply active gravity vector
    if (gravityMode === 'repel') {
      const dx = this.x - W / 2;
      const dy = this.y - H / 2;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      this.vx += (dx / d) * 0.35;
      this.vy += (dy / d) * 0.35;
    } else {
      this.vx += gravity.x * 0.35;
      this.vy += gravity.y * 0.35;
    }

    // Air resistance
    this.vx *= 0.982;
    this.vy *= 0.982;

    this.x += this.vx;
    this.y += this.vy;

    this.angV += this.vx * 0.001;
    this.angV *= 0.97;
    this.angle += this.angV;

    const bounce = 0.58;
    const r = this.radius;

    // Wall collisions
    if (this.x - r < 0) {
      this.x  = r;
      playCollisionSound(Math.abs(this.vx));
      spawnSparks(this.x, this.y, this.color);
      this.vx = Math.abs(this.vx) * bounce;
      this.angV = this.vy * 0.03;
    } else if (this.x + r > W) {
      this.x  = W - r;
      playCollisionSound(Math.abs(this.vx));
      spawnSparks(this.x, this.y, this.color);
      this.vx = -Math.abs(this.vx) * bounce;
      this.angV = -this.vy * 0.03;
    }

    if (this.y - r < 70) { // Keep below header
      this.y  = 70 + r;
      playCollisionSound(Math.abs(this.vy));
      spawnSparks(this.x, this.y, this.color);
      this.vy = Math.abs(this.vy) * bounce;
    } else if (this.y + r > H) {
      this.y  = H - r;
      playCollisionSound(Math.abs(this.vy));
      spawnSparks(this.x, this.y, this.color);
      this.vy = -Math.abs(this.vy) * bounce;
      this.vx *= 0.84;
      this.angV = this.vx * 0.025;
    }

    // Shape ↔ shape collisions
    for (const other of shapes) {
      if (other === this || other.dragging) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const minD = (this.radius + other.radius) * 0.92;

      if (dist < minD) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minD - dist) * 0.5;

        this.x  -= nx * overlap;
        this.y  -= ny * overlap;
        other.x += nx * overlap;
        other.y += ny * overlap;

        const dvx = this.vx - other.vx;
        const dvy = this.vy - other.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          const imp = dot * 0.65;
          playCollisionSound(dot);
          spawnSparks((this.x + other.x) / 2, (this.y + other.y) / 2, this.color);

          this.vx  -= imp * nx;
          this.vy  -= imp * ny;
          other.vx += imp * nx;
          other.vy += imp * ny;
          this.angV  += (dvy * nx - dvx * ny) * 0.04;
          other.angV -= (dvy * nx - dvx * ny) * 0.04;
        }
      }
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.beginPath();
    for (let i = 0; i < this.sides; i++) {
      const a = (i / this.sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * this.radius;
      const py = Math.sin(a) * this.radius;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();

    const grd = ctx.createRadialGradient(0, -this.radius * 0.2, 0, 0, 0, this.radius);
    grd.addColorStop(0, this.color + 'ee');
    grd.addColorStop(1, this.color + '88');
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.strokeStyle = this.dragging ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = this.dragging ? 2.5 : 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

// ── Init ────────────────────────────────────────────────────
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function spawnShapes(count = 18) {
  for (let i = 0; i < count; i++) {
    const def = SHAPE_DEFS[i % SHAPE_DEFS.length];
    const radius = Math.random() * 26 + 24;
    const x = radius + Math.random() * (W - radius * 2);
    const y = 80 + radius + Math.random() * (H * 0.4);
    const color = PALETTE[i % PALETTE.length];
    shapes.push(new Shape(x, y, def.sides, radius, color));
  }
}

function resetAll() {
  shapes = [];
  sparks = [];
  spawnShapes(18);
}

resize();
resetAll();

// ── Render Loop ─────────────────────────────────────────────
function frame() {
  ctx.fillStyle = '#09090f';
  ctx.fillRect(0, 0, W, H);

  for (const s of shapes) s.update(shapes);
  for (const s of shapes) s.draw();

  // Draw sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const sp = sparks[i];
    sp.update();
    sp.draw(ctx);
    if (sp.alpha <= 0) sparks.splice(i, 1);
  }

  requestAnimationFrame(frame);
}
frame();

// ── Drag Helpers ────────────────────────────────────────────
function pointerXY(e) {
  if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function findShape(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const dx = s.x - x, dy = s.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < s.radius + 14) return s;
  }
  return null;
}

function onDown(e) {
  initAudio();
  const { x, y } = pointerXY(e);
  const s = findShape(x, y);
  if (s) {
    dragged = s;
    dragged.dragging = true;
    dragged.vx = 0;
    dragged.vy = 0;
    prevDrag = { x, y };
    canvas.classList.add('grabbing');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10); } catch {}
    }
  }
}

function onMove(e) {
  if (!dragged) return;
  const { x, y } = pointerXY(e);
  dragged.vx = (x - prevDrag.x) * 0.65;
  dragged.vy = (y - prevDrag.y) * 0.65;
  dragged.x  = x;
  dragged.y  = y;
  prevDrag   = { x, y };
}

function onUp() {
  if (dragged) {
    dragged.dragging = false;
    dragged.angV = dragged.vx * 0.04;
    dragged = null;
  }
  canvas.classList.remove('grabbing');
}

canvas.addEventListener('mousedown', onDown);
window.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  onDown(e);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (dragged) {
    e.preventDefault();
    onMove(e);
  }
}, { passive: false });

window.addEventListener('touchend', onUp);

// ── Gravity Mode Switcher ────────────────────────────────────
gravitySelect.addEventListener('change', () => {
  gravityMode = gravitySelect.value;
  if (gravityMode === 'down') gravity = { x: 0, y: 0.5 };
  else if (gravityMode === 'zero') gravity = { x: 0, y: 0 };
  else if (gravityMode === 'up') gravity = { x: 0, y: -0.5 };
  else if (gravityMode === 'repel') gravity = { x: 0, y: 0 };
});

addShapesBtn.addEventListener('click', () => {
  spawnShapes(5);
  playCollisionSound(5);
});

resetBtn.addEventListener('click', () => {
  resetAll();
  playCollisionSound(8);
});

// ── DeviceOrientation / Tilt ─────────────────────────────────
function handleOrientation(e) {
  if (gravityMode !== 'down') return;
  const gx = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
  const gy = Math.max(-1, Math.min(1, (e.beta  || 0) / 45));
  gravity.x = gx * 0.7;
  gravity.y = gy * 0.7;
}

if (typeof DeviceOrientationEvent !== 'undefined') {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    tiltBtn.classList.remove('hidden');
    tiltBtn.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission().then(res => {
        if (res === 'granted') window.addEventListener('deviceorientation', handleOrientation);
        tiltBtn.classList.add('hidden');
      }).catch(() => tiltBtn.classList.add('hidden'));
    });
  } else {
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

function updateSoundUI() {
  soundIcon.textContent = soundMuted ? '🔇' : '🔊';
  soundToggle.classList.toggle('muted', soundMuted);
}

soundToggle.addEventListener('click', () => {
  soundMuted = !soundMuted;
  localStorage.setItem('gravity_muted', soundMuted);
  updateSoundUI();
  if (!soundMuted) playCollisionSound(6);
});
updateSoundUI();
