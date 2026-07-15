'use strict';

/* ============================================================
   Audio-Reactive Waveform
   - Idle: animated compound sine wave (looks alive)
   - Active: real-time oscilloscope via getUserMedia + Web Audio
   ============================================================ */

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');
const micBtn  = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const micLabel = document.getElementById('micLabel');
const statusEl = document.getElementById('micStatus');

let W = 0, H = 0;
let analyser   = null;
let audioCtx   = null;
let micStream  = null;
let micActive  = false;
let idleTime   = 0;
let timeData   = null;

// ── Resize ──────────────────────────────────────────────────
function resize () {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

// ── Microphone ───────────────────────────────────────────────
async function startMic () {
  try {
    statusEl.textContent = '';
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();

    analyser  = audioCtx.createAnalyser();
    analyser.fftSize             = 2048;
    analyser.smoothingTimeConstant = 0.80;

    const source = audioCtx.createMediaStreamSource(micStream);
    source.connect(analyser);

    timeData   = new Uint8Array(analyser.fftSize);
    micActive  = true;

    micBtn.classList.add('active');
    micBtn.setAttribute('aria-pressed', 'true');
    micIcon.textContent  = '🔴';
    micLabel.textContent = 'Listening…';
  } catch (err) {
    console.warn('Mic error:', err);
    statusEl.textContent = 'Microphone access denied. Playing idle animation.';
  }
}

function stopMic () {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  analyser   = null;
  timeData   = null;
  micActive  = false;

  micBtn.classList.remove('active');
  micBtn.setAttribute('aria-pressed', 'false');
  micIcon.textContent  = '🎙';
  micLabel.textContent = 'Enable Mic';
}

micBtn.addEventListener('click', () => {
  if (micActive) stopMic();
  else           startMic();
});

// ── Drawing helpers ──────────────────────────────────────────
/**
 * Build a gradient that spans the canvas width.
 * Changes subtly over time so it feels alive even in idle.
 */
function buildGradient (phase) {
  const grd = ctx.createLinearGradient(0, 0, W, 0);
  const a   = (Math.sin(phase) + 1) / 2;             // 0→1 slow oscillation

  grd.addColorStop(0,    `hsl(${156 + a * 40},  100%, 65%)`);
  grd.addColorStop(0.33, `hsl(${200 + a * 30},  100%, 60%)`);
  grd.addColorStop(0.66, `hsl(${260 + a * 40},  80%,  65%)`);
  grd.addColorStop(1,    `hsl(${156 + a * 40},  100%, 65%)`);
  return grd;
}

/**
 * Draw the waveform with a multi-pass glow technique:
 * 1. Wide blurred stroke (glow halo)
 * 2. Medium stroke (soft body)
 * 3. Thin sharp stroke (crisp core)
 */
function drawWaveform (samples) {
  const mid = H / 2;
  const amp = H * 0.38;

  // Build path once, reuse for all passes
  ctx.beginPath();
  const step = W / (samples.length - 1);

  for (let i = 0; i < samples.length; i++) {
    const x = i * step;
    let   y;

    if (micActive) {
      y = mid + ((samples[i] - 128) / 128) * amp;
    } else {
      // Idle compound sine
      const t = (i / samples.length) * Math.PI * 6;
      y = mid
        + Math.sin(t + idleTime * 0.8)  * amp * 0.45
        + Math.sin(t * 1.7 + idleTime * 0.5) * amp * 0.25
        + Math.sin(t * 0.4 + idleTime * 0.3) * amp * 0.18
        + Math.sin(t * 3.1 + idleTime * 1.1) * amp * 0.08;
    }

    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }

  const grd = buildGradient(idleTime * 0.4);

  // Glow pass
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = grd;
  ctx.lineWidth   = 18;
  ctx.stroke();

  // Mid pass
  ctx.globalAlpha = 0.3;
  ctx.lineWidth   = 7;
  ctx.stroke();

  // Core pass
  ctx.globalAlpha = 1.0;
  ctx.lineWidth   = 2.2;
  ctx.strokeStyle = grd;
  ctx.stroke();

  ctx.globalAlpha = 1.0;
}

// ── Render loop ─────────────────────────────────────────────
function frame () {
  // Clear with full-opacity fill (no trails — waveform clarity)
  ctx.fillStyle = '#09090f';
  ctx.fillRect(0, 0, W, H);

  let samples;
  if (micActive && analyser && timeData) {
    analyser.getByteTimeDomainData(timeData);
    samples = timeData;
  } else {
    // Fake 256-sample idle array — actual values generated inside drawWaveform
    if (!timeData || timeData.length !== 256) {
      timeData = new Uint8Array(256).fill(128);
    }
    samples = timeData;
  }

  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';
  drawWaveform(samples);

  idleTime += 0.022;
  requestAnimationFrame(frame);
}

// ── Boot ─────────────────────────────────────────────────────
frame();
