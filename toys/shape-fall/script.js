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
  let grabbed = null;

  // Physics constants
  const GRAVITY = 1.2; // Super fast gravity
  const FRICTION = 0.98;
  const BOUNCE = 0.65;
  const GRAB_RADIUS = 50;
  const LERP_SPEED = 0.3; // Smooth cursor following

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
      this.vx = (Math.random() - 0.5) * 8;
      this.vy = Math.random() * -5 - 2;
      this.size = Math.random() * 30 + 20;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.1;
      this.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.grabbed = false;
      this.targetX = x;
      this.targetY = y;
      this.scale = 1;
      this.targetScale = 1;
    }

    update() {
      if (this.grabbed) {
        // Smooth lerp to cursor with spring-like effect
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        
        this.x += dx * LERP_SPEED;
        this.y += dy * LERP_SPEED;
        
        this.vx *= 0.8;
        this.vy *= 0.8;
        
        this.targetScale = 1.2;
        this.rotationSpeed *= 0.9;
      } else {
        // Apply gravity
        this.vy += GRAVITY;
        
        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;
        
        // Apply friction
        this.vx *= FRICTION;
        this.vy *= FRICTION;
        
        this.targetScale = 1;
        
        // Rotation
        this.rotation += this.rotationSpeed;
        
        // Wall collisions
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
          
          // Stop if moving slowly
          if (Math.abs(this.vy) < 0.5) {
            this.vy = 0;
            this.rotationSpeed *= 0.95;
          }
        }
        
        // Ceiling collision
        if (this.y - this.size / 2 < 0) {
          this.y = this.size / 2;
          this.vy *= -BOUNCE;
        }
      }
      
      // Smooth scale transition
      this.scale += (this.targetScale - this.scale) * 0.15;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);
      
      // Glow effect
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.grabbed ? 30 : 15;
      
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

    contains(x, y) {
      const dx = x - this.x;
      const dy = y - this.y;
      return Math.sqrt(dx * dx + dy * dy) < this.size / 2 + GRAB_RADIUS;
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
    grabbed = null;
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
    
    // Draw grab radius indicator when hovering
    if (mouse.x !== null && !mouse.down) {
      const hovered = particles.find(p => p.contains(mouse.x, mouse.y));
      if (hovered) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(hovered.x, hovered.y, hovered.size / 2 + GRAB_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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
    
    // Find particle under cursor
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].contains(x, y)) {
        grabbed = particles[i];
        grabbed.grabbed = true;
        grabbed.targetX = x;
        grabbed.targetY = y;
        canvas.classList.add('grabbing');
        
        // Move to end of array (draw on top)
        particles.splice(i, 1);
        particles.push(grabbed);
        break;
      }
    }
  }

  function handlePointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mouse.x = x;
    mouse.y = y;
    
    if (grabbed) {
      grabbed.targetX = x;
      grabbed.targetY = y;
    }
  }

  function handlePointerUp() {
    if (grabbed) {
      grabbed.grabbed = false;
      
      // Add some velocity based on movement
      const dx = mouse.x - grabbed.x;
      const dy = mouse.y - grabbed.y;
      grabbed.vx = dx * 0.5;
      grabbed.vy = dy * 0.5;
      
      grabbed = null;
    }
    
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
