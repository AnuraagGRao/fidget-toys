'use strict';

/* ============================================================
   Flick Targets
   - Soft-glowing orbs appear randomly
   - Tap / click to pop them with a burst animation
   - Score counter; best score saved to localStorage
   ============================================================ */

const field       = document.getElementById('field');
const scoreEl     = document.getElementById('score');
const bestEl      = document.getElementById('best');
const floaterTpl  = document.getElementById('floaterTpl');

const TARGET_ORB_COUNT = 4;
const RESPAWN_DELAY_MS = 280;
const SCORE_KEY = 'flickTargets_best';

const ORB_COLOURS = [
  '#ff44aa','#ff6b6b','#ff9944',
  '#ffd93d','#6bcb77','#44aaff',
  '#c77dff','#2ec4b6',
];

let score = 0;
let best  = parseInt(localStorage.getItem(SCORE_KEY) || '0', 10);
bestEl.textContent = best;

// ── Orb management ───────────────────────────────────────────
function fieldRect () {
  return field.getBoundingClientRect();
}

function randomSize () {
  return Math.floor(Math.random() * 30) + 28; // 28–57 px
}

function randomPosition (size) {
  const rect    = fieldRect();
  const margin  = size;
  const x = margin + Math.random() * (rect.width  - margin * 2);
  const y = margin + Math.random() * (rect.height - margin * 2);
  return { x, y };
}

/**
 * Check that the proposed position doesn't overlap existing orbs too heavily.
 */
function isPositionClear (x, y, size) {
  const existing = field.querySelectorAll('.orb:not(.popping)');
  for (const orb of existing) {
    const ox   = parseFloat(orb.style.left);
    const oy   = parseFloat(orb.style.top);
    const os   = parseFloat(orb.style.width);
    const minD = (size + os) * 0.6;
    const dx   = ox - x, dy = oy - y;
    if (Math.sqrt(dx * dx + dy * dy) < minD) return false;
  }
  return true;
}

function spawnOrb () {
  const size   = randomSize();
  const color  = ORB_COLOURS[Math.floor(Math.random() * ORB_COLOURS.length)];

  // Try a few times to find a clear spot
  let pos;
  for (let attempt = 0; attempt < 10; attempt++) {
    const p = randomPosition(size);
    if (isPositionClear(p.x, p.y, size)) { pos = p; break; }
  }
  if (!pos) pos = randomPosition(size);   // fallback: just place it

  const orb = document.createElement('div');
  orb.className = 'orb';
  orb.style.cssText = `
    left: ${pos.x}px;
    top:  ${pos.y}px;
    width:  ${size}px;
    height: ${size}px;
    --c: ${color};
  `;
  orb.setAttribute('role', 'button');
  orb.setAttribute('tabindex', '0');
  orb.setAttribute('aria-label', 'Pop this orb');

  orb.addEventListener('click',      () => popOrb(orb, pos));
  orb.addEventListener('touchstart', (e) => { e.preventDefault(); popOrb(orb, pos); }, { passive: false });
  orb.addEventListener('keydown',    (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); popOrb(orb, pos); }});

  field.appendChild(orb);
}

function popOrb (orb, pos) {
  if (orb.classList.contains('popping')) return;
  orb.classList.add('popping');
  orb.setAttribute('aria-label', 'Popped!');

  // Score
  score++;
  scoreEl.textContent = score;
  bumpEl(scoreEl);

  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem(SCORE_KEY, best);
    bumpEl(bestEl);
  }

  // Floating +1
  showFloater(pos.x, pos.y + fieldRect().top);

  // Remove after animation and spawn a replacement
  orb.addEventListener('animationend', () => {
    orb.remove();
    setTimeout(spawnOrb, RESPAWN_DELAY_MS);
  }, { once: true });
}

function bumpEl (el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  el.addEventListener('transitionend', () => el.classList.remove('bump'), { once: true });
}

function showFloater (x, y) {
  const clone = floaterTpl.content.cloneNode(true);
  const el    = clone.querySelector('.floater');
  el.style.left = (x - 12) + 'px';
  el.style.top  = (y - 16) + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ── Ensure TARGET_ORB_COUNT orbs always on screen ────────────
function maintainOrbs () {
  const alive = field.querySelectorAll('.orb:not(.popping)').length;
  const needed = TARGET_ORB_COUNT - alive;
  for (let i = 0; i < needed; i++) spawnOrb();
}

// ── Boot ─────────────────────────────────────────────────────
// Wait one frame so fieldRect() has correct dimensions
requestAnimationFrame(() => {
  for (let i = 0; i < TARGET_ORB_COUNT; i++) {
    setTimeout(spawnOrb, i * 120);
  }
});

// Keep the board full after browser resize
window.addEventListener('resize', maintainOrbs);
