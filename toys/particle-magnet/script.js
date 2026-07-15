'use strict';

/* ============================================================
   Particle Magnet
   - Red / blue particles drift randomly
   - On hold: all turn green and gravitate to cursor / touch
   - On release: revert colors, scatter with impulse
   ============================================================ */

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// Reduce count on low-end / mobile devices
const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent);
const COUNT     = IS_MOBILE ? 100 : 200;

const BG_COLOR        = 'rgba(9,9,15,';
const COLORS_DEFAULT  = ['#ff3344', '#3355ff'];
const COLOR_ACTIVE    = '#00ff88';
const GLOW_ACTIVE     = 'rgba(0,255,136,';

let W = 0, H = 0;
let particles = [];
let pointer   = { x: 0, y: 0, active: false };
let scatterDecay = 0;   // frames remaining for post-release scatter emphasis

// ── Particle class ──────────────────────────────────────────
class Particle {
  constructor () {
    this.x       = Math.random() * W;
    this.y       = Math.random() * H;
    this.vx      = (Math.random() - 0.5) * 1.8;
    this.vy      = (Math.random() - 0.5) * 1.8;
    this.radius  = Math.random() * 2 + 1.2;
    this.colorIndex = Math.floor(Math.random() * 2); // 0=red, 1=blue
  }

  update () {
    if (pointer.active) {
      const dx   = pointer.x - this.x;
      const dy   = pointer.y - this.y;
      const dSq  = dx * dx + dy * dy;
      const dist = Math.sqrt(dSq) || 0.001;
      // Force inversely proportional to distance (capped)
      const force = Math.min(4000 / (dSq + 80), 4.5);
      this.vx += (dx / dist) * force * 0.07;
      this.vy += (dy / dist) * force * 0.07;
    }

    // Gentle drag
    this.vx *= 0.975;
    this.vy *= 0.975;

    this.x += this.vx;
    this.y += this.vy;

    // Seamless wrap
    if (this.x < -10)       this.x = W + 10;
    else if (this.x > W + 10) this.x = -10;
    if (this.y < -10)       this.y = H + 10;
    else if (this.y > H + 10) this.y = -10;
  }

  draw () {
    const r = this.radius;

    if (pointer.active) {
      // Glow core (additive-style via layering)
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = GLOW_ACTIVE + '0.12)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_ACTIVE;
      ctx.fill();
    } else {
      const color = COLORS_DEFAULT[this.colorIndex];
      // Soft outer halo
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color + '28'; // ~16% opacity hex
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

// ── Init ────────────────────────────────────────────────────
function resize () {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function init () {
  resize();
  particles = Array.from({ length: COUNT }, () => new Particle());
}

// ── Render loop ─────────────────────────────────────────────
function frame () {
  // Persistent fade creates motion trails
  const fadeAlpha = pointer.active ? 0.18 : (scatterDecay > 0 ? 0.35 : 0.22);
  ctx.fillStyle = BG_COLOR + fadeAlpha + ')';
  ctx.fillRect(0, 0, W, H);

  // Magnetic-field glow at pointer when active
  if (pointer.active) {
    const grd = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 220);
    grd.addColorStop(0,   'rgba(0,255,136,0.09)');
    grd.addColorStop(1,   'rgba(0,255,136,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }

  for (const p of particles) {
    p.update();
    p.draw();
  }

  if (scatterDecay > 0) scatterDecay--;

  requestAnimationFrame(frame);
}

// ── Pointer helpers ──────────────────────────────────────────
function getXY (e) {
  if (e.changedTouches && e.changedTouches.length) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function onDown (e) {
  const { x, y } = getXY(e);
  pointer.x = x;
  pointer.y = y;
  pointer.active = true;
}

function onMove (e) {
  if (!pointer.active) return;
  const { x, y } = getXY(e);
  pointer.x = x;
  pointer.y = y;
}

function onUp () {
  pointer.active = false;
  scatterDecay = 45;
  // Impulse burst
  for (const p of particles) {
    p.vx += (Math.random() - 0.5) * 5;
    p.vy += (Math.random() - 0.5) * 5;
  }
}

// Mouse
canvas.addEventListener('mousedown',  onDown);
canvas.addEventListener('mousemove',  onMove);
canvas.addEventListener('mouseup',    onUp);
canvas.addEventListener('mouseleave', onUp);

// Touch (passive:false so we can prevent scroll)
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('touchend',   (e) => { e.preventDefault(); onUp();    }, { passive: false });

// Resize
window.addEventListener('resize', () => {
  resize();
  // Keep particles in-bounds
  for (const p of particles) {
    if (p.x > W) p.x = Math.random() * W;
    if (p.y > H) p.y = Math.random() * H;
  }
});

// ── Boot ─────────────────────────────────────────────────────
init();
frame();
