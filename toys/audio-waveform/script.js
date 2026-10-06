'use strict';

/* ============================================================
   Audio Waveform · Theremin Synth Pad, Radial Mandala & Oscilloscope
   ============================================================ */

const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');
const micBtn      = document.getElementById('micBtn');
const micIcon     = document.getElementById('micIcon');
const micLabel    = document.getElementById('micLabel');
const statusEl    = document.getElementById('micStatus');
const modeSelect  = document.getElementById('waveMode');
const paletteSel  = document.getElementById('colorPalette');

let W = 0, H = 0;
let analyser   = null;
let audioCtx   = null;
let micStream  = null;
let micActive  = false;
let idleTime   = 0;
let timeData   = null;
let freqData   = null;

// Theremin Synth Pad
let thereminOsc  = null;
let thereminGain = null;
let thereminFilter = null;
let isTouchingPad = false;

let visualMode   = 'wave';
let currentTheme = 'emerald';

// ── Themes ───────────────────────────────────────────────────
const THEMES = {
  emerald: {
    start: 'hsl(156, 100%, 65%)',
    mid:   'hsl(180, 100%, 60%)',
    end:   'hsl(210, 100%, 65%)',
    glow:  '#44ffaa',
  },
  cyber: {
    start: 'hsl(320, 100%, 65%)',
    mid:   'hsl(280, 100%, 65%)',
    end:   'hsl(190, 100%, 65%)',
    glow:  '#ff44aa',
  },
  solar: {
    start: 'hsl(35, 100%, 65%)',
    mid:   'hsl(15, 100%, 60%)',
    end:   'hsl(45, 100%, 65%)',
    glow:  '#ffaa44',
  },
  violet: {
    start: 'hsl(260, 100%, 70%)',
    mid:   'hsl(290, 100%, 65%)',
    end:   'hsl(220, 100%, 70%)',
    glow:  '#c44dff',
  },
};

// ── Audio Engine ─────────────────────────────────────────────
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;

    timeData = new Uint8Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);

    // Setup Theremin Synth Nodes
    thereminOsc = audioCtx.createOscillator();
    thereminFilter = audioCtx.createBiquadFilter();
    thereminGain = audioCtx.createGain();

    thereminOsc.type = 'sine';
    thereminOsc.frequency.setValueAtTime(220, audioCtx.currentTime);

    thereminFilter.type = 'lowpass';
    thereminFilter.frequency.setValueAtTime(800, audioCtx.currentTime);

    thereminGain.gain.setValueAtTime(0, audioCtx.currentTime);

    thereminOsc.connect(thereminFilter);
    thereminFilter.connect(thereminGain);

    // Route to analyser AND speakers
    thereminGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    thereminOsc.start();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function updateTheremin(x, y, active) {
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  if (active) {
    // X axis -> Frequency (130Hz to 680Hz)
    const normX = Math.max(0, Math.min(1, x / W));
    const freq = 130 + Math.pow(normX, 1.4) * 550;
    thereminOsc.frequency.setTargetAtTime(freq, now, 0.05);

    // Y axis -> Filter cutoff & Volume
    const normY = 1 - Math.max(0, Math.min(1, y / H));
    const cutoff = 400 + normY * 2400;
    thereminFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
    thereminGain.gain.setTargetAtTime(0.22, now, 0.04);
  } else {
    thereminGain.gain.setTargetAtTime(0, now, 0.06);
  }
}

// ── Microphone Mode ──────────────────────────────────────────
async function startMic() {
  try {
    statusEl.textContent = '';
    initAudio();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const source = audioCtx.createMediaStreamSource(micStream);
    source.connect(analyser);

    micActive = true;
    micBtn.classList.add('active');
    micIcon.textContent  = '🔴';
    micLabel.textContent = 'Listening';
  } catch (err) {
    console.warn('Mic error:', err);
    statusEl.textContent = 'Microphone access denied. Touch canvas to play theremin.';
    setTimeout(() => { statusEl.textContent = ''; }, 4000);
  }
}

function stopMic() {
  if (micStream) {
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  micActive = false;
  micBtn.classList.remove('active');
  micIcon.textContent  = '🎙';
  micLabel.textContent = 'Mic';
}

micBtn.addEventListener('click', () => {
  if (micActive) stopMic();
  else startMic();
});

// ── Resize ──────────────────────────────────────────────────
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ── Visual Drawing Modes ─────────────────────────────────────
function buildGradient() {
  const t = THEMES[currentTheme] || THEMES.emerald;
  const grd = ctx.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, t.start);
  grd.addColorStop(0.5, t.mid);
  grd.addColorStop(1, t.end);
  return grd;
}

// 1. Classic Wave
function drawWave(samples) {
  const mid = H / 2;
  const amp = H * 0.38;
  const grd = buildGradient();

  ctx.beginPath();
  const step = W / (samples.length - 1);

  for (let i = 0; i < samples.length; i++) {
    const x = i * step;
    let y;
    if (micActive || isTouchingPad) {
      y = mid + ((samples[i] - 128) / 128) * amp;
    } else {
      const t = (i / samples.length) * Math.PI * 6;
      y = mid
        + Math.sin(t + idleTime * 0.9) * amp * 0.45
        + Math.sin(t * 1.8 + idleTime * 0.6) * amp * 0.22
        + Math.sin(t * 3.2 + idleTime * 1.2) * amp * 0.1;
    }
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }

  // Multi-pass glow
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = grd;
  ctx.lineWidth = 18;
  ctx.stroke();

  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.globalAlpha = 1.0;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

// 2. Radial Mandala Ring
function drawMandala(samples) {
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.22;
  const amp = Math.min(W, H) * 0.18;
  const grd = buildGradient();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(idleTime * 0.2);

  ctx.beginPath();
  const len = Math.min(samples.length, 360);

  for (let i = 0; i < len; i++) {
    const angle = (i / len) * Math.PI * 2;
    let val;
    if (micActive || isTouchingPad) {
      val = ((samples[i] - 128) / 128) * amp;
    } else {
      val = Math.sin(angle * 6 + idleTime * 2) * (amp * 0.4);
    }
    const r = baseR + val;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();

  ctx.lineWidth = 3;
  ctx.strokeStyle = grd;
  ctx.shadowColor = THEMES[currentTheme].glow;
  ctx.shadowBlur = 24;
  ctx.stroke();

  ctx.restore();
}

// 3. Neon Laser Ribbon
function drawRibbon(samples) {
  const mid = H / 2;
  const amp = H * 0.32;
  const grd = buildGradient();

  [-18, 0, 18].forEach((offset, idx) => {
    ctx.beginPath();
    const step = W / (samples.length - 1);
    for (let i = 0; i < samples.length; i++) {
      const x = i * step;
      let y;
      if (micActive || isTouchingPad) {
        y = mid + offset + ((samples[i] - 128) / 128) * amp;
      } else {
        const t = (i / samples.length) * Math.PI * 5;
        y = mid + offset + Math.sin(t + idleTime + idx) * amp * 0.35;
      }
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineWidth = idx === 1 ? 3 : 1.5;
    ctx.strokeStyle = grd;
    ctx.globalAlpha = idx === 1 ? 0.9 : 0.45;
    ctx.stroke();
  });
  ctx.globalAlpha = 1.0;
}

// 4. Frequency Spectrum Bars
function drawBars(freqs) {
  const barCount = 48;
  const barWidth = (W * 0.8) / barCount;
  const startX = (W - W * 0.8) / 2;
  const bottom = H * 0.78;
  const maxHeight = H * 0.45;

  for (let i = 0; i < barCount; i++) {
    const x = startX + i * barWidth;
    let normVal;
    if (micActive || isTouchingPad) {
      normVal = (freqs[i * 2] || 0) / 255;
    } else {
      normVal = (Math.sin(i * 0.4 + idleTime * 3) + 1) * 0.35;
    }
    const h = Math.max(6, normVal * maxHeight);

    ctx.fillStyle = buildGradient();
    ctx.shadowColor = THEMES[currentTheme].glow;
    ctx.shadowBlur = 12;
    ctx.fillRect(x + 2, bottom - h, barWidth - 4, h);
  }
}

// ── Render Loop ─────────────────────────────────────────────
function frame() {
  ctx.fillStyle = '#09090f';
  ctx.fillRect(0, 0, W, H);

  let samples;
  let freqs;

  if (analyser && (micActive || isTouchingPad)) {
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);
    samples = timeData;
    freqs = freqData;
  } else {
    if (!timeData) timeData = new Uint8Array(256).fill(128);
    if (!freqData) freqData = new Uint8Array(128).fill(0);
    samples = timeData;
    freqs = freqData;
  }

  if (visualMode === 'wave') drawWave(samples);
  else if (visualMode === 'mandala') drawMandala(samples);
  else if (visualMode === 'ribbon') drawRibbon(samples);
  else if (visualMode === 'bars') drawBars(freqs);

  idleTime += 0.024;
  requestAnimationFrame(frame);
}
frame();

// ── Theremin Pointer Tracking ────────────────────────────────
function handlePointerDown(e) {
  if (e.target.closest && (e.target.closest('.back-btn') || e.target.closest('.audio-header'))) return;
  isTouchingPad = true;
  updateTheremin(e.clientX, e.clientY, true);
}

function handlePointerMove(e) {
  if (!isTouchingPad) return;
  updateTheremin(e.clientX, e.clientY, true);
}

function handlePointerUp() {
  isTouchingPad = false;
  updateTheremin(0, 0, false);
}

canvas.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

canvas.addEventListener('touchstart', (e) => {
  if (e.target.closest && (e.target.closest('.back-btn') || e.target.closest('.audio-header'))) return;
  e.preventDefault();
  const t = e.touches[0];
  if (t) {
    isTouchingPad = true;
    updateTheremin(t.clientX, t.clientY, true);
  }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!isTouchingPad) return;
  const t = e.touches[0];
  if (t) updateTheremin(t.clientX, t.clientY, true);
}, { passive: false });

window.addEventListener('touchend', handlePointerUp);

// ── Controls UI ──────────────────────────────────────────────
modeSelect.addEventListener('change', () => {
  visualMode = modeSelect.value;
});

paletteSel.addEventListener('change', () => {
  currentTheme = paletteSel.value;
  document.body.dataset.palette = currentTheme;
});
