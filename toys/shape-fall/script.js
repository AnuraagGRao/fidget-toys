(() => {
  'use strict';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const resetBtn = document.getElementById('resetBtn');
  const addBtn = document.getElementById('addBtn');
  const hint = document.getElementById('hint');

  let width, height;
  let particles = [];
  let mouse = { x: null, y: null, down: false };

  // Physics constants
  const FRICTION = 0.995; // Very low friction for continuous movement
  const BOUNCE = 0.85;
  const BLACK_HOLE_STRENGTH = 1.5; // Strength of black hole gravity pull
  const BLACK_HOLE_RADIUS = 300; // Range of black hole effect

  // Shape types
  const SHAPES = ['circle', 'square', 'triangle', 'star', 'pentagon', 'hexagon', 'diamond'];
  
  // Color palette
  const COLORS = [
    '#ff6b9d', // Pink
    '#c44dff', // Purple
    '#4d9aff', // Blue
    '#4dffdf', // Cyan
    '#4dff88', // Green
    '#ffd93d', // Yellow
    '#ff6e3d', // Orange
    '#ff4d4d', // Red
  ];

  // ═══════════════════════════════════════════════════════════
  // PARTICLE CLASS
  // ═══════════════════════════════════════════════════════════
  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      // Random velocity in all directions for free-floating movement
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = Math.random() * 30 + 20;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.05;
      this.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.scale = 1;
      this.targetScale = 1;
    }

    update() {
      // Black hole gravity effect when mouse is down
      if (mouse.down && mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < BLACK_HOLE_RADIUS && dist > 1) {
          // Strong pull toward cursor (black hole effect)
          const force = BLACK_HOLE_STRENGTH * (1 - dist / BLACK_HOLE_RADIUS);
          this.vx += (dx / dist) * force;
          this.vy += (dy / dist) * force;
          
          // Visual feedback when being pulled
          this.targetScale = 1.1;
          this.rotationSpeed += (dx / dist) * 0.02;
        }
      } else {
        this.targetScale = 1;
      }
      
      // Apply velocity
      this.x += this.vx;
      this.y += this.vy;
      
      // Apply friction (very minimal for continuous motion)
      this.vx *= FRICTION;
      this.vy *= FRICTION;
      
      // Rotation
      this.rotation += this.rotationSpeed;
      
      // Wall collisions - bounce and maintain velocity
      if (this.x - this.size / 2 < 0) {
        this.x = this.size / 2;
        this.vx *= -BOUNCE;
        this.rotationSpeed *= -1;
      }
      if (this.x + this.size / 2 > width) {
        this.x = width - this.size / 2;
        this.vx *= -BOUNCE;
        this.rotationSpeed *= -1;
      }
      
      // Floor collision
      if (this.y + this.size / 2 > height) {
        this.y = height - this.size / 2;
        this.vy *= -BOUNCE;
        this.rotationSpeed *= -1;
      }
      
      // Ceiling collision
      if (this.y - this.size / 2 < 0) {
        this.y = this.size / 2;
        this.vy *= -BOUNCE;
        this.rotationSpeed *= -1;
      }
      
      // Smooth scale transition
      this.scale += (this.targetScale - this.scale) * 0.15;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);
      
      // Glow effect (stronger when being pulled by black hole)
      ctx.shadowColor = this.color;
      ctx.shadowBlur = (mouse.down && this.targetScale > 1) ? 30 : 15;
      
      ctx.fillStyle = this.color;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      
      // Draw shape
      this.drawShape();
      
      ctx.restore();
    }

    drawShape() {
      const r = this.size / 2;
      
      switch (this.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
          
        case 'square':
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.strokeRect(-r, -r, r * 2, r * 2);
          break;
          
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.866, r * 0.5);
          ctx.lineTo(-r * 0.866, r * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
          
        case 'star':
          this.drawStar(0, 0, 5, r, r * 0.5);
          break;
          
        case 'pentagon':
          this.drawPolygon(0, 0, 5, r);
          break;
          
        case 'hexagon':
          this.drawPolygon(0, 0, 6, r);
          break;
          
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.6, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
      }
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    drawPolygon(cx, cy, sides, radius) {
      const angle = (Math.PI * 2) / sides;
      
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const x = cx + radius * Math.cos(i * angle - Math.PI / 2);
        const y = cy + radius * Math.sin(i * angle - Math.PI / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════
  function init() {
    resize();
    createParticles(15);
    animate();
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function createParticles(count) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.3 - 100;
      particles.push(new Particle(x, y));
    }
  }

  function clearParticles() {
    particles = [];
  }

  // ═══════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════
  function animate() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);
    
    // Update and draw particles
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    
    // Draw black hole radius when active
    if (mouse.down && mouse.x !== null && mouse.y !== null) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, BLACK_HOLE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw center point
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    requestAnimationFrame(animate);
  }

  // ═══════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════
  function handlePointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mouse.down = true;
    mouse.x = x;
    mouse.y = y;
    
    canvas.classList.add('grabbing');
  }

  function handlePointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mouse.x = x;
    mouse.y = y;
  }

  function handlePointerUp() {
    mouse.down = false;
    canvas.classList.remove('grabbing');
  }

  function handlePointerLeave() {
    handlePointerUp();
    mouse.x = null;
    mouse.y = null;
  }

  // ═══════════════════════════════════════════════════════════
  // BUTTON HANDLERS
  // ═══════════════════════════════════════════════════════════
  resetBtn.addEventListener('click', () => {
    clearParticles();
    createParticles(15);
    
    // Visual feedback
    resetBtn.style.transform = 'scale(0.9)';
    setTimeout(() => resetBtn.style.transform = '', 100);
  });

  addBtn.addEventListener('click', () => {
    createParticles(5);
    
    // Visual feedback
    addBtn.style.transform = 'scale(0.9)';
    setTimeout(() => addBtn.style.transform = '', 100);
  });

  // ═══════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  window.addEventListener('resize', resize);

  // ═══════════════════════════════════════════════════════════
  // START
  // ═══════════════════════════════════════════════════════════
  init();
})();
