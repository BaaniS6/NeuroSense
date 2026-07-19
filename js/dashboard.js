/* ==========================================================================
   NEUROSENSE DASHBOARD — SIMULATION & INTERACTION LAYER
   Drives dashboard.html until a real ESP32 + MPU6050 device is connected.
   Every section below is self-contained and reads/writes only the DOM IDs
   defined in dashboard.html. Sections where live serial data should replace
   the simulator are flagged with "REAL SENSOR INTEGRATION POINT".
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     0. SHARED STATE
     A single state object instead of scattered globals. Every module reads
     from / writes to this object, which keeps the simulator and (later) a
     real serial-data source interchangeable.
     ------------------------------------------------------------------------ */
  const state = {
    isRunning: false,
    isPaused: false,
    sessionStartTime: null,
    elapsedBeforePause: 0,

    participantId: null,
    sessionId: null,

    accel: { x: 0, y: 0, z: 9.8 },
    gyro: { x: 0, y: 0, z: 0 },

    accelHistory: { x: [], y: [], z: [] },
    gyroHistory: { x: [], y: [], z: [] },
    accelStats: { max: 0, sum: 0, count: 0 },
    gyroStats: { max: 0, sum: 0, count: 0 },

    tick: 0,
    charts: { accel: null, gyro: null },
  };

  const MAX_CHART_POINTS = 50;
  const SIM_INTERVAL_MS = 100;
  const CLOCK_INTERVAL_MS = 1000;
  const BATTERY_INTERVAL_MS = 4000;
  const NOTE_INTERVAL_MS = 9000;

  /* ------------------------------------------------------------------------
     1. INITIALIZATION
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    initSessionInfo();
    initClock();
    initBatterySimulation();
    initOverviewDefaults();
    initCharts();
    initHandVisualization();
    initSessionControls();
    populateRecentSessions();
    initResearchNotes();
    startSimulationLoop();
    startSession(); // dashboard should look live immediately on load
  });

  /* ------------------------------------------------------------------------
     2. SESSION INFORMATION
     Participant ID, session ID, and connection status. In a live deployment,
     connection status would flip based on the actual serial/BLE link state.
     ------------------------------------------------------------------------ */
  function initSessionInfo() {
    state.participantId = generateParticipantId();
    state.sessionId = generateSessionId();

    setText('participant-id', state.participantId);
    setText('current-session-id', state.sessionId);
    setText('connection-status', '\uD83D\uDFE2 Connected');
  }

  function generateParticipantId() {
    const num = String(Math.floor(Math.random() * 40) + 1).padStart(3, '0');
    return `NS-${num}`;
  }

  function generateSessionId() {
    const stamp = Date.now().toString(36).toUpperCase().slice(-6);
    return `SES-${stamp}`;
  }

  /* ------------------------------------------------------------------------
     3. LIVE CLOCK
     ------------------------------------------------------------------------ */
  function initClock() {
    updateClock();
    setInterval(updateClock, CLOCK_INTERVAL_MS);
  }

  function updateClock() {
    const now = new Date();
    setText('current-time', now.toLocaleTimeString('en-US', { hour12: false }));

    if (state.isRunning && !state.isPaused) {
      const elapsedMs = state.elapsedBeforePause + (Date.now() - state.sessionStartTime);
      setText('session-duration-value', formatDuration(elapsedMs));
    }
  }

  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  /* ------------------------------------------------------------------------
     4. BATTERY SIMULATION
     REAL SENSOR INTEGRATION POINT: replace with the ESP32's reported
     battery telemetry (e.g. a parsed field from the serial payload).
     ------------------------------------------------------------------------ */
  function initBatterySimulation() {
    let battery = 97;
    setText('battery-status', `${battery}%`);

    setInterval(() => {
      battery += (Math.random() - 0.5) * 3;
      battery = Math.min(100, Math.max(85, battery));
      setText('battery-status', `${Math.round(battery)}%`);
    }, BATTERY_INTERVAL_MS);
  }

  /* ------------------------------------------------------------------------
     5. OVERVIEW CARD DEFAULTS
     ------------------------------------------------------------------------ */
  function initOverviewDefaults() {
    setText('stability-score-value', '--');
    setText('tremor-frequency-value', '--');
    setText('rms-motion-value', '--');
    setText('session-duration-value', '00:00');
    setText('motion-classification-value', 'Idle');
    setText('sensor-status-value', 'Healthy');
  }

  /* ------------------------------------------------------------------------
     6. SIMULATED SENSOR SIGNAL
     Smooth, wave-based motion instead of pure randomness so it reads like a
     real hand rather than noise: layered sine/cosine terms plus light jitter.
     REAL SENSOR INTEGRATION POINT: replace generateAccelSample /
     generateGyroSample with values parsed from incoming ESP32 serial frames
     (e.g. "ax,ay,az,gx,gy,gz\n"), keeping the same {x,y,z} shape so nothing
     downstream needs to change.
     ------------------------------------------------------------------------ */
  function generateAccelSample(t) {
    const jitter = () => (Math.random() - 0.5) * 0.15;
    return {
      x: 0.35 * Math.sin(t * 0.12) + 0.12 * Math.sin(t * 0.9) + jitter(),
      y: 0.28 * Math.cos(t * 0.1) + 0.10 * Math.sin(t * 0.7 + 1.2) + jitter(),
      z: 9.8 + 0.18 * Math.sin(t * 0.05 + 0.6) + jitter(),
    };
  }

  function generateGyroSample(t) {
    const jitter = () => (Math.random() - 0.5) * 1.4;
    return {
      x: 8 * Math.sin(t * 0.11 + 0.3) + jitter(),
      y: 6 * Math.cos(t * 0.14) + jitter(),
      z: 4 * Math.sin(t * 0.08 + 2.1) + jitter(),
    };
  }

  function startSimulationLoop() {
    setInterval(() => {
      if (!state.isRunning || state.isPaused) return;

      state.tick += 1;
      state.accel = generateAccelSample(state.tick);
      state.gyro = generateGyroSample(state.tick);

      pushHistory(state.accelHistory, state.accel);
      pushHistory(state.gyroHistory, state.gyro);
      updateRunningStats(state.accelStats, state.accel);
      updateRunningStats(state.gyroStats, state.gyro);

      updateSensorReadouts();
      updateCharts();
      updateOverviewMetrics();
      updateHandVisualization();
    }, SIM_INTERVAL_MS);
  }

  function pushHistory(history, sample) {
    ['x', 'y', 'z'].forEach((axis) => {
      history[axis].push(sample[axis]);
      if (history[axis].length > MAX_CHART_POINTS) history[axis].shift();
    });
  }

  function updateRunningStats(stats, sample) {
    const magnitude = Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2);
    stats.max = Math.max(stats.max, magnitude);
    stats.sum += magnitude;
    stats.count += 1;
  }

  /* ------------------------------------------------------------------------
     7. SENSOR READOUT TEXT (current / max / average / sampling rate)
     ------------------------------------------------------------------------ */
  function updateSensorReadouts() {
    setText('accel-x-value', state.accel.x.toFixed(2));
    setText('accel-y-value', state.accel.y.toFixed(2));
    setText('accel-z-value', state.accel.z.toFixed(2));
    setText('accel-max-value', state.accelStats.max.toFixed(2));
    setText('accel-avg-value', (state.accelStats.sum / state.accelStats.count).toFixed(2));
    setText('accel-sampling-rate', `${Math.round(1000 / SIM_INTERVAL_MS)} Hz`);

    setText('gyro-x-value', state.gyro.x.toFixed(2));
    setText('gyro-y-value', state.gyro.y.toFixed(2));
    setText('gyro-z-value', state.gyro.z.toFixed(2));
    setText('gyro-max-value', state.gyroStats.max.toFixed(2));
    setText('gyro-avg-value', (state.gyroStats.sum / state.gyroStats.count).toFixed(2));
    setText('gyro-sampling-rate', `${Math.round(1000 / SIM_INTERVAL_MS)} Hz`);
  }

  /* ------------------------------------------------------------------------
     8. OVERVIEW METRICS
     Simple, explainable derivations from the current signal window — not a
     diagnostic score, just a readable summary of what the dashboard sees.
     ------------------------------------------------------------------------ */
  function updateOverviewMetrics() {
    const { accelHistory } = state;
    if (accelHistory.x.length < 10) return;

    const variance = sampleVariance(accelHistory.x) + sampleVariance(accelHistory.y);
    const stability = Math.max(0, Math.min(100, 100 - variance * 40));
    const rms = rmsOf(accelHistory.x, accelHistory.y, accelHistory.z);
    const frequency = estimateDominantFrequency(accelHistory.x, 1000 / SIM_INTERVAL_MS);

    setText('stability-score-value', Math.round(stability));
    setText('rms-motion-value', rms.toFixed(2));
    setText('tremor-frequency-value', frequency.toFixed(1));
    setText('motion-classification-value', classifyMotion(stability, frequency));
    setText('sensor-status-value', 'Healthy');
  }

  function sampleVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }

  function rmsOf(...axes) {
    const all = axes.flat();
    const meanSquare = all.reduce((sum, v) => sum + v ** 2, 0) / all.length;
    return Math.sqrt(meanSquare);
  }

  /** Rough dominant-frequency estimate via zero-crossing rate (lightweight
   *  stand-in for a full FFT, adequate for an illustrative UI reading). */
  function estimateDominantFrequency(signal, sampleRateHz) {
    if (signal.length < 4) return 0;
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    let crossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if ((signal[i - 1] - mean) * (signal[i] - mean) < 0) crossings += 1;
    }
    const windowSeconds = signal.length / sampleRateHz;
    return crossings / 2 / windowSeconds;
  }

  function classifyMotion(stability, frequency) {
    if (frequency >= 4 && frequency <= 6 && stability < 70) return 'Mild Tremor';
    if (frequency > 6 && stability < 55) return 'Moderate Tremor';
    if (stability >= 85) return 'Stable Motion';
    return 'Normal';
  }

  /* ------------------------------------------------------------------------
     9. LIVE CHARTS (Chart.js)
     Builds a canvas inside each graph container, since dashboard.html only
     provides an empty div for each — kept generic so a real data feed can
     call the same updateCharts() path.
     ------------------------------------------------------------------------ */
  function initCharts() {
    state.charts.accel = createLineChart('accelerometer-graph', [
      { label: 'X', color: '#0B1F3A' },
      { label: 'Y', color: '#3B82F6' },
      { label: 'Z', color: '#60A5FA' },
    ]);
    state.charts.gyro = createLineChart('gyroscope-graph', [
      { label: 'X', color: '#0B1F3A' },
      { label: 'Y', color: '#3B82F6' },
      { label: 'Z', color: '#60A5FA' },
    ]);
  }

  function createLineChart(containerId, seriesConfig) {
    const container = document.getElementById(containerId);
    if (!container || typeof Chart === 'undefined') return null;

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: Array(MAX_CHART_POINTS).fill(''),
        datasets: seriesConfig.map((series) => ({
          label: series.label,
          data: [],
          borderColor: series.color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 }, // smooth via interpolated data, not per-frame chart animation
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: 'Inter', size: 11 } },
          },
        },
        scales: {
          x: { display: false },
          y: { grid: { color: '#E5EBF3' }, ticks: { font: { family: 'JetBrains Mono', size: 10 } } },
        },
      },
    });
  }

  function updateCharts() {
    syncChartData(state.charts.accel, state.accelHistory);
    syncChartData(state.charts.gyro, state.gyroHistory);
  }

  function syncChartData(chart, history) {
    if (!chart) return;
    chart.data.labels = history.x.map((_, i) => String(i));
    chart.data.datasets[0].data = history.x;
    chart.data.datasets[1].data = history.y;
    chart.data.datasets[2].data = history.z;
    chart.update('none');
  }

  /* ------------------------------------------------------------------------
     10. HAND VISUALIZATION
     Injects a simple animated wireframe hand into the placeholder container
     and rotates it based on the simulated gyroscope signal.
     ------------------------------------------------------------------------ */
  const GESTURES = ['Open Hand', 'Relaxed', 'Grip', 'Pinch', 'Point'];
  let handSvgEl = null;
  let currentGesture = 'Relaxed';
  let gestureHoldTicks = 0;

  function initHandVisualization() {
    const container = document.getElementById('hand-visualization-container');
    if (!container) return;

    container.innerHTML = `
      <svg id="hand-visual-svg" viewBox="0 0 200 200" width="100%" height="100%"
           style="display:block; margin:0 auto; max-width:220px;">
        <g id="hand-visual-rig" transform="rotate(0 100 100)" stroke="#3B82F6" stroke-width="2"
           fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M80 170 C68 170 62 158 62 146 L62 90 C62 82 68 76 74 76 C80 76 86 82 86 90 L86 112"/>
          <path d="M86 112 L86 62 C86 54 92 48 98 48 C104 48 110 54 110 62 L110 108"/>
          <path d="M110 108 L110 48 C110 40 116 34 122 34 C128 34 134 40 134 48 L134 108"/>
          <path d="M134 108 L134 58 C134 51 140 46 146 46 C152 46 156 51 156 58 L156 108"/>
          <path d="M62 130 L44 112 C39 107 39 98 44 93 C49 88 58 88 62 92"/>
          <path d="M62 146 L156 146 C166 146 172 154 172 164 C172 178 160 186 146 186 L88 186 C76 186 68 180 68 170"/>
        </g>
      </svg>
    `;
    handSvgEl = document.getElementById('hand-visual-rig');

    setText('current-gesture-value', currentGesture);
    setText('motion-confidence-value', '97%');
    setText('orientation-value', 'Pitch 0\u00B0 / Roll 0\u00B0 / Yaw 0\u00B0');
  }

  function updateHandVisualization() {
    if (!handSvgEl) return;

    // Rotate the rig gently based on the simulated gyroscope Z-axis reading.
    const rotation = Math.max(-18, Math.min(18, state.gyro.z));
    handSvgEl.setAttribute('transform', `rotate(${rotation.toFixed(1)} 100 100)`);

    const pitch = Math.round(state.gyro.x);
    const roll = Math.round(state.gyro.y);
    const yaw = Math.round(state.gyro.z);
    setText('orientation-value', `Pitch ${pitch}\u00B0 / Roll ${roll}\u00B0 / Yaw ${yaw}\u00B0`);

    const confidence = 95 + Math.round(Math.random() * 4);
    setText('motion-confidence-value', `${confidence}%`);

    // Hold each gesture label for ~1.5s of ticks before considering a change,
    // so the label doesn't flicker every 100ms.
    gestureHoldTicks += 1;
    if (gestureHoldTicks > 15) {
      gestureHoldTicks = 0;
      const magnitude = Math.abs(state.gyro.x) + Math.abs(state.gyro.y) + Math.abs(state.gyro.z);
      currentGesture = pickGestureForMagnitude(magnitude);
      setText('current-gesture-value', currentGesture);
    }
  }

  function pickGestureForMagnitude(magnitude) {
    if (magnitude < 4) return 'Relaxed';
    if (magnitude < 9) return GESTURES[Math.floor(Math.random() * GESTURES.length)];
    return 'Grip';
  }

  /* ------------------------------------------------------------------------
     11. SESSION CONTROLS
     ------------------------------------------------------------------------ */
  function initSessionControls() {
    on('btn-start-session', 'click', startSession);
    on('btn-pause-session', 'click', togglePause);
    on('btn-stop-session', 'click', stopSession);
    on('btn-export-csv', 'click', exportCsv);
    on('btn-generate-report', 'click', generateReport);
    on('btn-reset-dashboard', 'click', resetDashboard);
  }

  function startSession() {
    if (state.isRunning && !state.isPaused) return;
    state.isRunning = true;
    state.isPaused = false;
    state.sessionStartTime = Date.now();
    setText('connection-status', '\uD83D\uDFE2 Connected');
  }

  function togglePause() {
    if (!state.isRunning) return;
    if (!state.isPaused) {
      state.isPaused = true;
      state.elapsedBeforePause += Date.now() - state.sessionStartTime;
    } else {
      state.isPaused = false;
      state.sessionStartTime = Date.now();
    }
  }

  function stopSession() {
    state.isRunning = false;
    state.isPaused = false;
    state.elapsedBeforePause = 0;
    setText('motion-classification-value', 'Idle');
  }

  function exportCsv() {
    const rows = [['tick', 'accel_x', 'accel_y', 'accel_z', 'gyro_x', 'gyro_y', 'gyro_z']];
    const len = state.accelHistory.x.length;
    for (let i = 0; i < len; i++) {
      rows.push([
        i,
        state.accelHistory.x[i].toFixed(4),
        state.accelHistory.y[i].toFixed(4),
        state.accelHistory.z[i].toFixed(4),
        state.gyroHistory.x[i].toFixed(4),
        state.gyroHistory.y[i].toFixed(4),
        state.gyroHistory.z[i].toFixed(4),
      ]);
    }
    const csv = rows.map((r) => r.join(',')).join('\n');
    downloadFile(csv, `${state.sessionId}-sensor-data.csv`, 'text/csv');
  }

  function generateReport() {
    const duration = document.getElementById('session-duration-value')?.textContent || '00:00';
    const lines = [
      'NEUROSENSE — SESSION REPORT',
      '============================',
      `Participant ID: ${state.participantId}`,
      `Session ID: ${state.sessionId}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      `Session Duration: ${duration}`,
      `Stability Score: ${document.getElementById('stability-score-value')?.textContent}`,
      `Tremor Frequency: ${document.getElementById('tremor-frequency-value')?.textContent} Hz`,
      `RMS Motion: ${document.getElementById('rms-motion-value')?.textContent}`,
      `Motion Classification: ${document.getElementById('motion-classification-value')?.textContent}`,
      '',
      'Note: This report summarizes quantitative motion metrics only.',
      'NeuroSense does not diagnose Parkinson\u2019s disease or any neurological condition.',
    ];
    downloadFile(lines.join('\n'), `${state.sessionId}-report.txt`, 'text/plain');
  }

  function resetDashboard() {
    state.isRunning = false;
    state.isPaused = false;
    state.sessionStartTime = null;
    state.elapsedBeforePause = 0;
    state.tick = 0;
    state.accelHistory = { x: [], y: [], z: [] };
    state.gyroHistory = { x: [], y: [], z: [] };
    state.accelStats = { max: 0, sum: 0, count: 0 };
    state.gyroStats = { max: 0, sum: 0, count: 0 };

    initOverviewDefaults();
    initSessionInfo();
    setText('accel-x-value', '--'); setText('accel-y-value', '--'); setText('accel-z-value', '--');
    setText('accel-max-value', '--'); setText('accel-avg-value', '--');
    setText('gyro-x-value', '--'); setText('gyro-y-value', '--'); setText('gyro-z-value', '--');
    setText('gyro-max-value', '--'); setText('gyro-avg-value', '--');
    updateCharts();
    initHandVisualization();
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------------
     12. RECENT SESSIONS TABLE
     ------------------------------------------------------------------------ */
  function populateRecentSessions() {
    const tbody = document.getElementById('recent-sessions-body');
    if (!tbody) return;

    const demoSessions = buildDemoSessions(5);
    tbody.innerHTML = demoSessions.map((s) => `
      <tr>
        <td>${s.participantId}</td>
        <td>${s.date}</td>
        <td>${s.duration}</td>
        <td>${s.avgStability}%</td>
        <td><button type="button" class="session-export-btn" data-session-id="${s.id}">Export</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.session-export-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-session-id');
        downloadFile(`Session export placeholder for ${id}`, `${id}.csv`, 'text/csv');
      });
    });
  }

  function buildDemoSessions(count) {
    const sessions = [];
    for (let i = 0; i < count; i++) {
      const daysAgo = (i + 1) * 2;
      const date = new Date(Date.now() - daysAgo * 86400000);
      sessions.push({
        id: `SES-DEMO${i + 1}`,
        participantId: generateParticipantId(),
        date: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        duration: `${(3 + Math.floor(Math.random() * 6))}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        avgStability: 62 + Math.floor(Math.random() * 32),
      });
    }
    return sessions;
  }

  /* ------------------------------------------------------------------------
     13. RESEARCH NOTES
     ------------------------------------------------------------------------ */
  const OBSERVATIONS = [
    'Participant maintained stable posture.',
    'Minor tremor observed after prolonged extension.',
    'Motion variability increased during rapid movement.',
    'No abnormal oscillations detected.',
    'Grip strength appeared consistent across trials.',
  ];

  function initResearchNotes() {
    const list = document.getElementById('research-notes-list');
    const template = document.getElementById('research-note-template');
    if (!list || !template) return;

    renderNote(template, OBSERVATIONS[0]);
    setInterval(() => {
      const note = template.cloneNode(true);
      note.removeAttribute('id');
      renderNote(note, OBSERVATIONS[Math.floor(Math.random() * OBSERVATIONS.length)]);
      list.prepend(note);
      // Keep the list from growing unbounded
      const notes = list.querySelectorAll('.research-note');
      if (notes.length > 6) notes[notes.length - 1].remove();
    }, NOTE_INTERVAL_MS);
  }

  function renderNote(el, text) {
    const textEl = el.querySelector('.research-note-text');
    const metaEl = el.querySelector('.research-note-meta');
    if (textEl) textEl.textContent = text;
    if (metaEl) metaEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  /* ------------------------------------------------------------------------
     14. DOM HELPERS
     ------------------------------------------------------------------------ */
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }
})();
