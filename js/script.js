/* ==========================================================================
   NEUROSENSE — INTERACTION LAYER
   Sections:
   1. Navbar scroll-spy + mobile toggle
   2. Scroll-reveal (IntersectionObserver)
   3. Signature hero element — wireframe hand rig with traveling signal pulses
   4. Dashboard: Chart.js telemetry (dummy data) + score ring + stat animations
   5. Research "Download Paper" dummy action with lightweight toast
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollReveal();
  initHandRig();
  initDashboard();
  initDownloadButton();
});

/* --------------------------------------------------------------------------
   1. NAVBAR — active-link scroll-spy + mobile menu toggle
   -------------------------------------------------------------------------- */
function initNavbar() {
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close mobile menu after choosing a link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Scroll-spy: highlight the nav link matching the section in view
  const sections = document.querySelectorAll('main section[id], header[id]');
  const navMap = {};
  document.querySelectorAll('.nav-links a').forEach(link => {
    navMap[link.dataset.nav] = link;
  });

  const spyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.id;
      const link = navMap[id];
      if (!link) return;
      if (entry.isIntersecting) {
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  sections.forEach(section => spyObserver.observe(section));
}

/* --------------------------------------------------------------------------
   2. SCROLL REVEAL — fade/rise elements into view once, on first intersection
   -------------------------------------------------------------------------- */
function initScrollReveal() {
  const revealEls = document.querySelectorAll('[data-reveal]');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach(el => revealObserver.observe(el));
}

/* --------------------------------------------------------------------------
   3. SIGNATURE ELEMENT — wireframe hand rig with traveling nerve-signal pulses
   Builds an abstract joint-and-bone hand skeleton, then animates small pulses
   travelling from the wrist out to each fingertip, echoing the sensor's own
   job: reading a signal as it moves through the hand.
   -------------------------------------------------------------------------- */
function initHandRig() {
  const svg = document.getElementById('handRig');
  if (!svg) return;

  const linksGroup = svg.querySelector('.rig-links');
  const jointsGroup = svg.querySelector('.rig-joints');
  const pulsesGroup = svg.querySelector('.rig-pulses');

  const wrist = { x: 320, y: 580 };
  const hub   = { x: 320, y: 470 };

  // Each finger is a chain of points from the hub out to the fingertip.
  const chains = {
    thumb:  [hub, { x: 230, y: 520 }, { x: 170, y: 470 }, { x: 128, y: 418 }],
    index:  [hub, { x: 250, y: 460 }, { x: 240, y: 360 }, { x: 232, y: 278 }],
    middle: [hub, { x: 320, y: 410 }, { x: 315, y: 300 }, { x: 310, y: 208 }],
    ring:   [hub, { x: 355, y: 425 }, { x: 358, y: 320 }, { x: 360, y: 233 }],
    pinky:  [hub, { x: 390, y: 450 }, { x: 400, y: 370 }, { x: 408, y: 303 }],
  };

  // Draw wrist -> hub, then hub -> each chain
  const allBones = [[wrist, hub]];
  Object.values(chains).forEach(chain => {
    for (let i = 0; i < chain.length - 1; i++) {
      allBones.push([chain[i], chain[i + 1]]);
    }
  });

  allBones.forEach(([a, b]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    linksGroup.appendChild(line);
  });

  // Joints: wrist, hub, and every point in every chain
  const allJoints = [wrist, hub, ...Object.values(chains).flat()];
  const seen = new Set();
  allJoints.forEach(p => {
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', p === wrist || p === hub ? 5 : 3.4);
    jointsGroup.appendChild(circle);
  });

  // Pulses: small dots that travel wrist -> hub -> fingertip along a chosen chain
  const chainNames = Object.keys(chains);
  const NUM_PULSES = 3;

  for (let i = 0; i < NUM_PULSES; i++) {
    const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulse.setAttribute('r', 4.5);
    pulse.setAttribute('fill', 'var(--color-accent-light)');
    pulse.style.opacity = '0';
    pulsesGroup.appendChild(pulse);
    // Stagger starts so pulses don't move in lockstep
    setTimeout(() => animatePulseLoop(pulse, wrist, chains, chainNames), i * 900);
  }
}

/**
 * Animates one pulse dot repeatedly along wrist -> hub -> a randomly chosen
 * fingertip chain, using requestAnimationFrame for smooth, dependency-free motion.
 */
function animatePulseLoop(pulseEl, wrist, chains, chainNames) {
  const chainName = chainNames[Math.floor(Math.random() * chainNames.length)];
  const path = [wrist, ...chains[chainName]];
  const durationPerSegment = 260; // ms
  let segmentIndex = 0;
  let segmentStart = null;

  function step(timestamp) {
    if (segmentStart === null) segmentStart = timestamp;
    const elapsed = timestamp - segmentStart;
    const t = Math.min(elapsed / durationPerSegment, 1);

    const a = path[segmentIndex];
    const b = path[segmentIndex + 1];
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;

    pulseEl.setAttribute('cx', x);
    pulseEl.setAttribute('cy', y);
    pulseEl.style.opacity = segmentIndex === 0 && t < 0.2 ? String(t / 0.2) : '0.9';

    if (t >= 1) {
      segmentIndex++;
      segmentStart = null;
      if (segmentIndex >= path.length - 1) {
        // Reached the fingertip — fade out, pause, then restart on a new finger
        pulseEl.style.opacity = '0';
        setTimeout(() => animatePulseLoop(pulseEl, wrist, chains, chainNames), 700 + Math.random() * 900);
        return;
      }
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* --------------------------------------------------------------------------
   4. DASHBOARD — Chart.js telemetry + score ring + animated stat values
   All data below is illustrative sample data, clearly not a live sensor feed.
   -------------------------------------------------------------------------- */
function initDashboard() {
  const dashboardSection = document.getElementById('dashboard');
  if (!dashboardSection) return;

  let hasAnimated = false;

  const dashObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        buildTelemetryCharts();
        animateScoreRing(87);
        animateStat('freqValue', 4.6, 1);
        animateStat('stabilityValue', 92, 0);
        document.getElementById('stabilityBar').style.width = '92%';
      }
    });
  }, { threshold: 0.3 });

  dashObserver.observe(dashboardSection);
}

/** Generates a smooth, semi-random dummy waveform for chart sample data. */
function generateSampleSeries(points, base, amplitude, seed) {
  const series = [];
  for (let i = 0; i < points; i++) {
    const noise = Math.sin(i * 0.4 + seed) * amplitude + Math.sin(i * 1.3 + seed) * (amplitude * 0.3);
    series.push(Number((base + noise).toFixed(2)));
  }
  return series;
}

function buildTelemetryCharts() {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}`);

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: 'Inter', size: 11 }, color: '#5B6B84' }
      },
      tooltip: {
        backgroundColor: '#0B1F3A',
        titleFont: { family: 'JetBrains Mono', size: 11 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: { display: false },
      y: {
        grid: { color: '#E5EBF3' },
        ticks: { font: { family: 'JetBrains Mono', size: 10 }, color: '#93A2B8' }
      }
    },
    elements: {
      point: { radius: 0, hoverRadius: 4 },
      line: { tension: 0.4, borderWidth: 2 }
    }
  };

  new Chart(document.getElementById('accelChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'X', data: generateSampleSeries(24, 0.2, 0.8, 0), borderColor: '#0B1F3A', backgroundColor: 'transparent' },
        { label: 'Y', data: generateSampleSeries(24, 0.1, 0.6, 2), borderColor: '#3B82F6', backgroundColor: 'transparent' },
        { label: 'Z', data: generateSampleSeries(24, 9.8, 0.3, 4), borderColor: '#60A5FA', backgroundColor: 'transparent' }
      ]
    },
    options: sharedOptions
  });

  new Chart(document.getElementById('gyroChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'X', data: generateSampleSeries(24, 2, 12, 1), borderColor: '#0B1F3A', backgroundColor: 'transparent' },
        { label: 'Y', data: generateSampleSeries(24, -1, 9, 3), borderColor: '#3B82F6', backgroundColor: 'transparent' },
        { label: 'Z', data: generateSampleSeries(24, 0.5, 6, 5), borderColor: '#60A5FA', backgroundColor: 'transparent' }
      ]
    },
    options: sharedOptions
  });
}

/** Animates the circular Neuromotor Score ring and its numeric readout. */
function animateScoreRing(targetPercent) {
  const circumference = 2 * Math.PI * 86; // matches r=86 in the SVG
  const ring = document.getElementById('scoreRingFill');
  ring.style.strokeDasharray = String(circumference);
  const offset = circumference - (targetPercent / 100) * circumference;
  requestAnimationFrame(() => { ring.style.strokeDashoffset = String(offset); });
  animateStat('scoreValue', targetPercent, 0);
}

/** Counts a numeric readout up from 0 to a target value over ~1.2s. */
function animateStat(elementId, target, decimals) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const duration = 1200;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = target * eased;
    el.textContent = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* --------------------------------------------------------------------------
   5. RESEARCH — dummy "Download Paper" action with a lightweight toast
   -------------------------------------------------------------------------- */
function initDownloadButton() {
  const btn = document.getElementById('downloadPaperBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    showToast('This is a prototype — the manuscript isn\u2019t published yet.');
  });
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
}
