(() => {
  'use strict';

  const canvas      = document.getElementById('canvas');
  const ctx         = canvas.getContext('2d');
  const resetBtn    = document.getElementById('resetBtn');
  const addBtn      = document.getElementById('addBtn');
  const forceSelect = document.getElementById('forceMode');
  const soundToggle = document.getElementById('soundToggle');
  const soundIcon   = document.getElementById('soundIcon');

  let width, height;
  let particles = [];
  let mouse = { x: null, y: null, down: false };
  let currentForce = 'blackhole';

  let audioCtx   = null;
  let soundMuted = localStorage.getItem('shapefall_muted') === 'true';
  let lastBounceSound = 0;

  // Physics constants
  const FRICTION = 0.992;
  const BOUNCE = 0.85;

  const SHAPES = ['circle', 'square', 'triangle', 'star', 'pentagon', 'hexagon', 'diamond'];

  const COLORS = [
    '#ff6b9d', '#c44dff', '#4d9aff',
    '#4dffdf', '#4dff88', '#ffd93d',
    '#ff6e3d', '#ff4d4d',
  ];

  // ── Audio Engine ───────────────────────────────────────────
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playBounceSound(pitch = 1.0) {
    if (soundMuted) return;
    const nowMs = Date.now();
    if (nowMs - lastBounceSound < 40) return;
    lastBounceSound = nowMs;

    initAudio();
    if (!audioCtx) return;

    const ctxA = audioCtx;
    const now = ctxA.currentTime;
    const osc = ctxA.createOscillator();
    const gain = ctxA.createGain();

    const freq = 320 * pitch + (Math.random() * 60 - 30);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctxA.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // ── Particle Class ─────────────────────────────────────────
  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 28 + 20;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.05;
      this.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.scale = 1;
      this.targetScale = 1;
    }

    update() {
      if (mouse.down && mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1) {
          if (currentForce === 'blackhole' && dist < 360) {
            const force = 2.0 * (1 - dist / 360);
            this.vx += (dx / dist) * force;
            this.vy += (dy / dist) * force;
            this.targetScale = 1.15;
          } else if (currentForce === 'supernova' && dist < 320) {
            const force = 3.5 * (1 - dist / 320);
            this.vx -= (dx / dist) * force;
            this.vy -= (dy / dist) * force;
            this.targetScale = 0.85;
          }
        }
      } else {
        this.targetScale = 1;
      }

      this.x += this.vx;
      this.y += this.vy;

      this.vx *= FRICTION;
      this.vy *= FRICTION;

      this.rotation += this.rotationSpeed;

      // Wall collisions
      const half = this.size / 2;
      let bounced = false;

      if (this.x - half < 0) {
        this.x = half;
        this.vx *= -BOUNCE;
        this.rotationSpeed *= -1;
        bounced = true;
      }
      if (this.x + half > width) {
        this.x = width - half;
        this.vx *= -BOUNCE;
        this.rotationSpeed *= -1;
        bounced = true;
      }
      if (this.y - half < 70) { // Keep below header
        this.y = 70 + half;
        this.vy *= -BOUNCE;
        this.rotationSpeed *= -1;
        bounced = true;
      }
      if (this.y + half > height) {
        this.y = height - half;
        this.vy *= -BOUNCE;
        this.rotationSpeed *= -1;
        bounced = true;
      }

      if (bounced) {
        playBounceSound(1.0 + Math.random() * 0.3);
      }

      this.scale += (this.targetScale - this.scale) * 0.15;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);

      ctx.shadowColor = this.color;
      ctx.shadowBlur = (mouse.down && this.targetScale > 1) ? 28 : 14;

      ctx.fillStyle = this.color;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;

      this.drawShape();
      ctx.restore();
    }

    drawShape() {
      const r = this.size / 2;
      ctx.beginPath();

      if (this.shape === 'circle') {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      } else if (this.shape === 'square') {
        ctx.rect(-r, -r, this.size, this.size);
      } else if (this.shape === 'triangle') {
        ctx.moveTo(0, -r);
        ctx.lineTo(r, r);
        ctx.lineTo(-r, r);
        ctx.closePath();
      } else if (this.shape === 'star') {
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const a2 = a + Math.PI / 5;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a2) * (r * 0.45), Math.sin(a2) * (r * 0.45));
        }
        ctx.closePath();
      } else if (this.shape === 'pentagon') {
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
      } else if (this.shape === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI * 2) / 6;
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
      } else if (this.shape === 'diamond') {
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
      }

      ctx.fill();
      ctx.stroke();
    }
  }

  // ── Canvas Setup ───────────────────────────────────────────
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function spawnShapes(count = 25) {
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(Math.random() * (width - 100) + 50, Math.random() * (height - 180) + 90));
    }
  }

  function resetAll() {
    particles = [];
    spawnShapes(25);
  }
  resetAll();

  // ── Render Loop ───────────────────────────────────────────
  function animate() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);

    // Subtle force glow at mouse
    if (mouse.down && mouse.x !== null) {
      const gCol = currentForce === 'supernova' ? 'rgba(255, 68, 68, 0.12)' : 'rgba(196, 77, 255, 0.12)';
      const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 300);
      grd.addColorStop(0, gCol);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, width, height);
    }

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(animate);
  }
  animate();

  // ── Pointer Tracking ───────────────────────────────────────
  function setPos(e) {
    const point = e.touches ? e.touches[0] : e;
    if (point) {
      mouse.x = point.clientX;
      mouse.y = point.clientY;
    }
  }

  canvas.addEventListener('mousedown', (e) => {
    initAudio();
    setPos(e);
    mouse.down = true;
    canvas.classList.add('grabbing');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10); } catch {}
    }
  });

  window.addEventListener('mousemove', setPos);
  window.addEventListener('mouseup', () => {
    mouse.down = false;
    canvas.classList.remove('grabbing');
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    setPos(e);
    mouse.down = true;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10); } catch {}
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    setPos(e);
  }, { passive: false });

  window.addEventListener('touchend', () => {
    mouse.down = false;
  });

  // ── UI Actions ─────────────────────────────────────────────
  forceSelect.addEventListener('change', () => {
    currentForce = forceSelect.value;
  });

  addBtn.addEventListener('click', () => {
    spawnShapes(10);
    playBounceSound(1.5);
  });

  resetBtn.addEventListener('click', () => {
    resetAll();
    playBounceSound(0.8);
  });

  function updateSoundUI() {
    soundIcon.textContent = soundMuted ? '🔇' : '🔊';
    soundToggle.classList.toggle('muted', soundMuted);
  }

  soundToggle.addEventListener('click', () => {
    soundMuted = !soundMuted;
    localStorage.setItem('shapefall_muted', soundMuted);
    updateSoundUI();
    if (!soundMuted) playBounceSound(1.2);
  });
  updateSoundUI();
})();
