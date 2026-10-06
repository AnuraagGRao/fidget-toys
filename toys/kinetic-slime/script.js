'use strict';

/* ============================================================
   Kinetic Slime · Soft-body Spring Mesh & Squelch Audio Engine
   ============================================================ */

const canvas      = document.getElementById('slimeCanvas');
const ctx         = canvas.getContext('2d');
const gravityBtn  = document.getElementById('gravityBtn');
const gravityText = document.getElementById('gravityText');
const jiggleBtn   = document.getElementById('jiggleBtn');
const soundToggle = document.getElementById('soundToggle');
const soundIcon   = document.getElementById('soundIcon');
const themeBtns   = document.querySelectorAll('.theme-btn');

let W = window.innerWidth;
let H = window.innerHeight;

let audioCtx    = null;
let soundMuted  = localStorage.getItem('slime_muted') === 'true';
let hasGravity  = false;

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
 * Procedural slime squelch & squish
 */
function playSquishSound(intensity = 1.0) {
  if (soundMuted) return;
  initAudio();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;
  const clamped = Math.min(Math.max(intensity, 0.2), 2.5);

  // FM synthesis squelch (Modulator -> Carrier)
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const outGain = ctx.createGain();

  const baseFreq = 160 + Math.random() * 80;
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(baseFreq * clamped, now);
  carrier.frequency.exponentialRampToValueAtTime(70, now + 0.12);

  mod.type = 'triangle';
  mod.frequency.setValueAtTime(320 * clamped, now);
  mod.frequency.exponentialRampToValueAtTime(40, now + 0.12);

  modGain.gain.setValueAtTime(140 * clamped, now);
  modGain.gain.exponentialRampToValueAtTime(1, now + 0.12);

  mod.connect(modGain);
  modGain.connect(carrier.frequency);

  outGain.gain.setValueAtTime(0.28 * Math.min(clamped, 1.2), now);
  outGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

  carrier.connect(outGain);
  outGain.connect(ctx.destination);

  carrier.start(now);
  mod.start(now);
  carrier.stop(now + 0.14);
  mod.stop(now + 0.14);
}

/**
 * Wall impact / splat sound
 */
function playSplatSound(speed = 1.0) {
  if (soundMuted || speed < 2) return;
  initAudio();
  if (!audioCtx) return;

  const ctx = audioCtx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110 + Math.random() * 40, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

  const vol = Math.min(speed / 18, 0.45);
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.095);
}

// ── Themes ───────────────────────────────────────────────────
const THEMES = {
  lime: {
    coreColor: '#38ef7d',
    gradStart: '#00ff88',
    gradMid:   '#11998e',
    gradEnd:   '#0a473e',
    glow:      'rgba(0, 255, 136, 0.35)',
    innerGlow: 'rgba(255, 255, 255, 0.6)',
  },
  plasma: {
    coreColor: '#f72585',
    gradStart: '#ff007f',
    gradMid:   '#7209b7',
    gradEnd:   '#240046',
    glow:      'rgba(247, 37, 133, 0.35)',
    innerGlow: 'rgba(255, 255, 255, 0.6)',
  },
  bubblegum: {
    coreColor: '#ff758c',
    gradStart: '#ff8da1',
    gradMid:   '#ff5470',
    gradEnd:   '#7a1628',
    glow:      'rgba(255, 117, 140, 0.35)',
    innerGlow: 'rgba(255, 255, 255, 0.7)',
  },
  mercury: {
    coreColor: '#e2e8f0',
    gradStart: '#ffffff',
    gradMid:   '#94a3b8',
    gradEnd:   '#334155',
    glow:      'rgba(226, 232, 240, 0.3)',
    innerGlow: 'rgba(255, 255, 255, 0.85)',
  },
};

let currentTheme = THEMES.lime;

// ── Slime Soft-Body Physics Model ────────────────────────────
const NUM_POINTS = 36;
const BASE_RADIUS = Math.min(W, H) * 0.18;

class SlimeBlob {
  constructor(cx, cy, radius) {
    this.cx = cx;
    this.cy = cy;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.targetRadius = radius;
    this.points = [];
    this.bubbles = [];

    // Internal floating micro-bubbles
    for (let i = 0; i < 9; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.radius * 0.65);
      this.bubbles.push({
        relX: Math.cos(angle) * dist,
        relY: Math.sin(angle) * dist,
        r: Math.random() * 8 + 4,
        alpha: Math.random() * 0.35 + 0.15,
        wiggle: Math.random() * Math.PI * 2,
      });
    }

    // Build perimeter nodes
    for (let i = 0; i < NUM_POINTS; i++) {
      const angle = (i / NUM_POINTS) * Math.PI * 2;
      this.points.push({
        baseAngle: angle,
        angle,
        x: this.cx + Math.cos(angle) * this.radius,
        y: this.cy + Math.sin(angle) * this.radius,
        targetX: this.cx + Math.cos(angle) * this.radius,
        targetY: this.cy + Math.sin(angle) * this.radius,
        vx: 0,
        vy: 0,
        distFromCenter: this.radius,
      });
    }
  }

  applyForceToPoint(idx, fx, fy) {
    const p = this.points[idx];
    if (p) {
      p.vx += fx;
      p.vy += fy;
    }
  }

  jiggleAll(magnitude = 12) {
    playSquishSound(1.8);
    for (let i = 0; i < NUM_POINTS; i++) {
      const p = this.points[i];
      const dir = (Math.random() - 0.5) * magnitude;
      p.vx += Math.cos(p.angle) * dir;
      p.vy += Math.sin(p.angle) * dir;
    }
    this.vy -= magnitude * 0.5;
  }

  update(pointers) {
    // 1. Center of mass physics
    if (hasGravity) {
      this.vy += 0.42; // Gravity downwards
    }

    // Air drag on center
    this.vx *= 0.985;
    this.vy *= 0.985;

    this.cx += this.vx;
    this.cy += this.vy;

    // Wall bounce for center
    const padding = this.radius * 0.85;
    const bounceDamp = 0.62;

    if (this.cx - padding < 0) {
      this.cx = padding;
      playSplatSound(Math.abs(this.vx));
      this.vx = -this.vx * bounceDamp;
      this.deformEdge(-1, 0, Math.abs(this.vx));
    } else if (this.cx + padding > W) {
      this.cx = W - padding;
      playSplatSound(Math.abs(this.vx));
      this.vx = -this.vx * bounceDamp;
      this.deformEdge(1, 0, Math.abs(this.vx));
    }

    if (this.cy - padding < 0) {
      this.cy = padding;
      playSplatSound(Math.abs(this.vy));
      this.vy = -this.vy * bounceDamp;
      this.deformEdge(0, -1, Math.abs(this.vy));
    } else if (this.cy + padding > H) {
      this.cy = H - padding;
      playSplatSound(Math.abs(this.vy));
      this.vy = -this.vy * bounceDamp;
      this.deformEdge(0, 1, Math.abs(this.vy));
    }

    // 2. Pointer interaction (Drag, Poke, Stretch)
    pointers.forEach(ptr => {
      if (!ptr.active) return;

      const dxCenter = ptr.x - this.cx;
      const dyCenter = ptr.y - this.cy;
      const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);

      // If dragging the whole body
      if (ptr.isDragging) {
        this.vx += (ptr.x - ptr.prevX) * 0.18;
        this.vy += (ptr.y - ptr.prevY) * 0.18;
      }

      // Deform local nodes nearest to the pointer
      for (let i = 0; i < NUM_POINTS; i++) {
        const p = this.points[i];
        const dx = ptr.x - p.x;
        const dy = ptr.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        // Interaction radius around finger/mouse
        const reach = 110;
        if (d < reach) {
          const power = (1 - d / reach);
          if (ptr.isDragging) {
            // Pull points with the pointer
            p.vx += (ptr.x - p.x) * power * 0.22;
            p.vy += (ptr.y - p.y) * power * 0.22;
          } else {
            // Poke / Push inward
            p.vx -= (dx / (d || 1)) * power * 4.5;
            p.vy -= (dy / (d || 1)) * power * 4.5;
          }
        }
      }
    });

    // 3. Spring network physics (Perimeter nodes)
    const springK = 0.085;       // Radial return spring
    const neighborK = 0.12;      // Circumferential smoothing spring
    const damping = 0.89;        // Jelly viscosity

    for (let i = 0; i < NUM_POINTS; i++) {
      const p = this.points[i];

      // Ideal resting position based on current center
      const idealX = this.cx + Math.cos(p.angle) * this.radius;
      const idealY = this.cy + Math.sin(p.angle) * this.radius;

      // Radial spring pulling back toward circular form
      const fRx = (idealX - p.x) * springK;
      const fRy = (idealY - p.y) * springK;

      p.vx += fRx;
      p.vy += fRy;

      // Neighbor springs to maintain smooth continuous surface
      const prev = this.points[(i - 1 + NUM_POINTS) % NUM_POINTS];
      const next = this.points[(i + 1) % NUM_POINTS];

      const fNx = ((prev.x + next.x) * 0.5 - p.x) * neighborK;
      const fNy = ((prev.y + next.y) * 0.5 - p.y) * neighborK;

      p.vx += fNx;
      p.vy += fNy;

      // Viscous damping
      p.vx *= damping;
      p.vy *= damping;

      p.x += p.vx;
      p.y += p.vy;

      // Keep perimeter bounded inside screen
      p.x = Math.max(8, Math.min(W - 8, p.x));
      p.y = Math.max(8, Math.min(H - 8, p.y));
    }
  }

  deformEdge(dirX, dirY, strength) {
    const s = Math.min(strength * 2.5, 30);
    for (let i = 0; i < NUM_POINTS; i++) {
      const p = this.points[i];
      const dot = Math.cos(p.angle) * dirX + Math.sin(p.angle) * dirY;
      if (dot > 0.3) {
        p.vx -= dirX * s * dot;
        p.vy -= dirY * s * dot;
      }
    }
  }

  draw(ctx) {
    if (this.points.length < 3) return;

    ctx.save();

    // 1. Slime Outer Glow
    ctx.shadowColor = currentTheme.glow;
    ctx.shadowBlur = 32;

    // 2. Build smooth Catmull-Rom / Bézier closed polygon
    ctx.beginPath();
    const p0 = this.points[0];
    const pLast = this.points[NUM_POINTS - 1];

    // Midpoint start
    let startX = (pLast.x + p0.x) / 2;
    let startY = (pLast.y + p0.y) / 2;
    ctx.moveTo(startX, startY);

    for (let i = 0; i < NUM_POINTS; i++) {
      const cur = this.points[i];
      const next = this.points[(i + 1) % NUM_POINTS];
      const midX = (cur.x + next.x) / 2;
      const midY = (cur.y + next.y) / 2;
      ctx.quadraticCurveTo(cur.x, cur.y, midX, midY);
    }
    ctx.closePath();

    // 3. Fill with translucent glossy radial gradient
    const grad = ctx.createRadialGradient(
      this.cx - this.radius * 0.3,
      this.cy - this.radius * 0.35,
      this.radius * 0.1,
      this.cx,
      this.cy,
      this.radius * 1.3
    );
    grad.addColorStop(0, currentTheme.gradStart);
    grad.addColorStop(0.45, currentTheme.gradMid);
    grad.addColorStop(1, currentTheme.gradEnd);

    ctx.fillStyle = grad;
    ctx.fill();

    // 4. Subtle membrane border outline
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = currentTheme.coreColor;
    ctx.stroke();

    // 5. Internal floating jelly bubbles
    this.bubbles.forEach(b => {
      b.wiggle += 0.03;
      const bx = this.cx + b.relX + Math.sin(b.wiggle) * 2;
      const by = this.cy + b.relY + Math.cos(b.wiggle) * 2;

      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha})`;
      ctx.fill();
    });

    // 6. Top Specular Jelly Glare (Gloss Highlight)
    ctx.beginPath();
    const glareX = this.cx - this.radius * 0.32;
    const glareY = this.cy - this.radius * 0.38;
    const glareW = this.radius * 0.55;
    const glareH = this.radius * 0.28;

    ctx.ellipse(glareX, glareY, glareW, glareH, -Math.PI / 6, 0, Math.PI * 2);
    const glareGrad = ctx.createLinearGradient(glareX - glareW, glareY - glareH, glareX + glareW, glareY + glareH);
    glareGrad.addColorStop(0, currentTheme.innerGlow);
    glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = glareGrad;
    ctx.fill();

    ctx.restore();
  }
}

// ── Instance & Loop ──────────────────────────────────────────
let slime = new SlimeBlob(W / 2, H / 2, BASE_RADIUS);

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  if (slime) {
    slime.cx = Math.max(slime.radius, Math.min(W - slime.radius, slime.cx));
    slime.cy = Math.max(slime.radius, Math.min(H - slime.radius, slime.cy));
  }
}
window.addEventListener('resize', resize);
resize();

// ── Multi-pointer Input Tracking ─────────────────────────────
const activePointers = new Map();

function updatePointer(id, x, y, isDown) {
  let ptr = activePointers.get(id);
  if (!ptr) {
    ptr = { x, y, prevX: x, prevY: y, active: isDown, isDragging: false };
    activePointers.set(id, ptr);
  } else {
    ptr.prevX = ptr.x;
    ptr.prevY = ptr.y;
    ptr.x = x;
    ptr.y = y;
    ptr.active = isDown;
  }

  // Check if starting a drag inside slime body
  if (isDown && !ptr.isDragging) {
    const dx = x - slime.cx;
    const dy = y - slime.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < slime.radius * 1.15) {
      ptr.isDragging = true;
      playSquishSound(1.1);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(10); } catch {}
      }
    }
  }

  if (!isDown) {
    if (ptr.isDragging) {
      // Release fling impulse
      const flingX = (x - ptr.prevX) * 1.2;
      const flingY = (y - ptr.prevY) * 1.2;
      slime.vx += flingX;
      slime.vy += flingY;
      playSquishSound(1.3);
    }
    ptr.isDragging = false;
  }
}

function removePointer(id) {
  const ptr = activePointers.get(id);
  if (ptr && ptr.isDragging) {
    slime.vx += (ptr.x - ptr.prevX) * 1.2;
    slime.vy += (ptr.y - ptr.prevY) * 1.2;
  }
  activePointers.delete(id);
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
  updatePointer('mouse', e.clientX, e.clientY, true);
});

window.addEventListener('mousemove', (e) => {
  if (activePointers.has('mouse')) {
    updatePointer('mouse', e.clientX, e.clientY, true);
  }
});

window.addEventListener('mouseup', () => {
  updatePointer('mouse', 0, 0, false);
  removePointer('mouse');
});

// Touch events (Multi-touch support)
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    updatePointer(t.identifier, t.clientX, t.clientY, true);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    updatePointer(t.identifier, t.clientX, t.clientY, true);
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    removePointer(t.identifier);
  }
});

window.addEventListener('touchcancel', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    removePointer(t.identifier);
  }
});

// ── UI Actions ───────────────────────────────────────────────
gravityBtn.addEventListener('click', () => {
  hasGravity = !hasGravity;
  gravityText.textContent = hasGravity ? 'Earth-G' : 'Zero-G';
  gravityBtn.classList.toggle('active', hasGravity);
  slime.jiggleAll(8);
});

jiggleBtn.addEventListener('click', () => {
  slime.jiggleAll(16);
});

themeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    themeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const name = btn.dataset.theme;
    if (THEMES[name]) {
      currentTheme = THEMES[name];
      document.body.dataset.theme = name;
      localStorage.setItem('slime_theme', name);
      slime.jiggleAll(10);
    }
  });
});

const savedTheme = localStorage.getItem('slime_theme');
if (savedTheme && THEMES[savedTheme]) {
  const match = document.querySelector(`.theme-btn[data-theme="${savedTheme}"]`);
  if (match) match.click();
}

function updateSoundUI() {
  soundIcon.textContent = soundMuted ? '🔇' : '🔊';
  soundToggle.classList.toggle('muted', soundMuted);
}

soundToggle.addEventListener('click', () => {
  soundMuted = !soundMuted;
  localStorage.setItem('slime_muted', soundMuted);
  updateSoundUI();
  if (!soundMuted) playSquishSound(1.2);
});
updateSoundUI();

// ── Render Loop ─────────────────────────────────────────────
function frame() {
  // Motion trail background
  ctx.fillStyle = '#090a0f';
  ctx.fillRect(0, 0, W, H);

  // Subtle ambient backdrop grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const pointersArray = Array.from(activePointers.values());
  slime.update(pointersArray);
  slime.draw(ctx);

  requestAnimationFrame(frame);
}

frame();
