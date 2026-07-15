'use strict';

/* ============================================================
   Geometric Gravity Sandbox
   - Colourful polygon pieces tumble under gravity
   - Desktop: click-drag to throw pieces
   - Mobile: DeviceOrientation tilts the gravity vector
   ============================================================ */

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const tiltBtn = document.getElementById('tilt-btn');

let W = 0, H = 0;
let gravity = { x: 0, y: 0.5 };   // normalised direction × magnitude
let shapes  = [];
let dragged = null;
let prevDrag = { x: 0, y: 0 };     // for computing throw velocity

const PALETTE = [
  '#ff6b6b','#ff9944','#ffd93d',
  '#6bcb77','#4d96ff','#c77dff',
  '#2ec4b6','#e63946','#ff4d6d',
];

const SHAPE_DEFS = [
  { sides: 3 }, { sides: 3 },
  { sides: 4 }, { sides: 4 }, { sides: 4 },
  { sides: 5 }, { sides: 5 },
  { sides: 6 }, { sides: 6 },
  { sides: 7 },
  { sides: 8 },
  { sides: 3 },
];

// ── Shape class ──────────────────────────────────────────────
class Shape {
  constructor (x, y, sides, radius, color) {
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

  update (shapes) {
    if (this.dragging) return;

    // Gravity
    this.vx += gravity.x * 0.35;
    this.vy += gravity.y * 0.35;

    // Air resistance
    this.vx *= 0.982;
    this.vy *= 0.982;

    this.x += this.vx;
    this.y += this.vy;

    // Visual spin influenced by horizontal velocity
    this.angV += this.vx * 0.001;
    this.angV *= 0.97;
    this.angle += this.angV;

    const bounce = 0.55;
    const r      = this.radius;

    // Wall collisions
    if (this.x - r < 0) {
      this.x  = r;
      this.vx = Math.abs(this.vx) * bounce;
      this.angV = this.vy * 0.03;
    } else if (this.x + r > W) {
      this.x  = W - r;
      this.vx = -Math.abs(this.vx) * bounce;
      this.angV = -this.vy * 0.03;
    }

    if (this.y - r < 0) {
      this.y  = r;
      this.vy = Math.abs(this.vy) * bounce;
    } else if (this.y + r > H) {
      this.y  = H - r;
      this.vy = -Math.abs(this.vy) * bounce;
      // Ground friction
      this.vx *= 0.82;
      this.angV = this.vx * 0.025;
    }

    // Shape ↔ shape collision (circle approximation)
    for (const other of shapes) {
      if (other === this || other.dragging) continue;
      const dx   = other.x - this.x;
      const dy   = other.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const minD = (this.radius + other.radius) * 0.9;   // *0.9 = allow slight overlap for realism

      if (dist < minD) {
        const nx  = dx / dist;
        const ny  = dy / dist;
        const overlap = (minD - dist) * 0.5;

        // Push apart
        this.x  -= nx * overlap;
        this.y  -= ny * overlap;
        other.x += nx * overlap;
        other.y += ny * overlap;

        // Velocity exchange along collision normal
        const dvx = this.vx - other.vx;
        const dvy = this.vy - other.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          const imp = dot * 0.65;
          this.vx  -= imp * nx;
          this.vy  -= imp * ny;
          other.vx += imp * nx;
          other.vy += imp * ny;
          // Transfer some spin
          this.angV  += (dvy * nx - dvx * ny) * 0.04;
          other.angV -= (dvy * nx - dvx * ny) * 0.04;
        }
      }
    }
  }

  draw () {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Build polygon path
    ctx.beginPath();
    for (let i = 0; i < this.sides; i++) {
      const a = (i / this.sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * this.radius;
      const py = Math.sin(a) * this.radius;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Fill with radial gradient for subtle depth
    const grd = ctx.createRadialGradient(0, -this.radius * 0.2, 0, 0, 0, this.radius);
    grd.addColorStop(0, this.color + 'dd');
    grd.addColorStop(1, this.color + '88');
    ctx.fillStyle   = grd;
    ctx.fill();

    // Stroke
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Drag highlight
    if (this.dragging) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Init ────────────────────────────────────────────────────
function resize () {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

function spawnShapes () {
  shapes = SHAPE_DEFS.map((def, i) => {
    const radius = Math.random() * 22 + 22;   // 22–44 px
    const x = radius + Math.random() * (W - radius * 2);
    const y = radius + Math.random() * (H * 0.5);
    const color = PALETTE[i % PALETTE.length];
    return new Shape(x, y, def.sides, radius, color);
  });
}

function init () {
  resize();
  spawnShapes();
}

// ── Render loop ─────────────────────────────────────────────
function frame () {
  ctx.clearRect(0, 0, W, H);

  // Subtle background
  ctx.fillStyle = '#09090f';
  ctx.fillRect(0, 0, W, H);

  for (const s of shapes) s.update(shapes);
  for (const s of shapes) s.draw();

  requestAnimationFrame(frame);
}

// ── Drag helpers ────────────────────────────────────────────
function pointerXY (e) {
  if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function findShape (x, y) {
  // Reverse order so top-drawn shapes are picked first
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s  = shapes[i];
    const dx = s.x - x, dy = s.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < s.radius + 12) return s;
  }
  return null;
}

function onDown (e) {
  const { x, y } = pointerXY(e);
  const s = findShape(x, y);
  if (s) {
    dragged = s;
    dragged.dragging = true;
    dragged.vx = 0;
    dragged.vy = 0;
    prevDrag = { x, y };
    canvas.classList.add('grabbing');
  }
}

function onMove (e) {
  if (!dragged) return;
  const { x, y } = pointerXY(e);
  // Store velocity so we can throw on release
  dragged.vx = (x - prevDrag.x) * 0.6;
  dragged.vy = (y - prevDrag.y) * 0.6;
  dragged.x  = x;
  dragged.y  = y;
  prevDrag   = { x, y };
}

function onUp () {
  if (dragged) {
    dragged.dragging = false;
    dragged.angV     = dragged.vx * 0.04;
    dragged = null;
  }
  canvas.classList.remove('grabbing');
}

canvas.addEventListener('mousedown',  onDown);
canvas.addEventListener('mousemove',  onMove);
canvas.addEventListener('mouseup',    onUp);
canvas.addEventListener('mouseleave', onUp);

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('touchend',   (e) => { e.preventDefault(); onUp();    }, { passive: false });

// ── DeviceOrientation / accelerometer ───────────────────────
function handleOrientation (e) {
  // gamma = left/right tilt (−90 to 90)
  // beta  = front/back  tilt (−180 to 180)
  const gx = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
  const gy = Math.max(-1, Math.min(1, (e.beta  || 0) / 45));
  gravity.x = gx * 0.7;
  gravity.y = gy * 0.7;
}

function setupAccelerometer () {
  if (typeof DeviceOrientationEvent === 'undefined') return;

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS 13+ — needs button click
    tiltBtn.classList.remove('hidden');
    tiltBtn.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission()
        .then(res => {
          if (res === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
          tiltBtn.classList.add('hidden');
        })
        .catch(() => tiltBtn.classList.add('hidden'));
    });
  } else {
    // Android / non-iOS — just listen
    window.addEventListener('deviceorientation', handleOrientation);
  }
}

window.addEventListener('resize', () => {
  resize();
  // Clamp shapes to new bounds
  for (const s of shapes) {
    s.x = Math.max(s.radius, Math.min(W - s.radius, s.x));
    s.y = Math.max(s.radius, Math.min(H - s.radius, s.y));
  }
});

// ── Boot ─────────────────────────────────────────────────────
init();
setupAccelerometer();
frame();
