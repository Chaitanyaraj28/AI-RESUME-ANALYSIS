// ── CUSTOM CURSOR ──────────────────────────────────────
const dot = document.getElementById('cursor-dot');
const canvas = document.getElementById('cursor-trail');
const ctx = canvas.getContext('2d');
let mx = -100, my = -100;
const trails = [];
let trailBoost = 1;

canvas.style.position = 'fixed';
canvas.style.top = '0'; canvas.style.left = '0';
canvas.style.pointerEvents = 'none';
canvas.style.zIndex = '99997';

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  dot.style.left = mx + 'px'; dot.style.top = my + 'px';
  trails.push({ x: mx, y: my, life: 1, size: trailBoost });
  if (trails.length > 24) trails.shift();
});

function animateCursorTrail() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < trails.length; i++) {
    const t = trails[i];
    const alpha = (i / trails.length) * 0.4;
    const size = (i / trails.length) * 6 * t.size;
    ctx.beginPath();
    ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(139,233,255,${alpha})`;
    ctx.fill();
    t.life -= 0.03;
  }
  requestAnimationFrame(animateCursorTrail);
}
animateCursorTrail();

function activateCursorHover() {
  dot.style.transform = 'translate(-50%,-50%) scale(1.5)';
  dot.style.background = '#ffffff';
  trailBoost = 1.45;
}

function deactivateCursorHover() {
  dot.style.transform = 'translate(-50%,-50%) scale(1)';
  dot.style.background = 'var(--accent)';
  trailBoost = 1;
}

document.addEventListener('mouseover', e => {
  if (e.target.closest('button, a, input, textarea, select, .upload-zone')) {
    activateCursorHover();
  }
});

document.addEventListener('mouseout', e => {
  if (!e.target.closest('button, a, input, textarea, select, .upload-zone')) return;
  const related = e.relatedTarget;
  if (related && related.closest && related.closest('button, a, input, textarea, select, .upload-zone')) return;
  deactivateCursorHover();
});

// ── MICRO INTERACTIONS ─────────────────────────────────
const audioEl = document.getElementById('clickSound');
let audioCtx;

function playClickSound() {
  try {
    audioEl.currentTime = 0;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = audioCtx || new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(760, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(480, audioCtx.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.045, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.09);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.09);
  } catch (err) {
    console.warn('Click sound skipped:', err);
  }
}

document.addEventListener('click', e => {
  if (e.target.closest('button')) playClickSound();
});

// ── SCROLL REVEAL ──────────────────────────────────────
const reveals = document.querySelectorAll('.reveal');

function activateReveals() {
  reveals.forEach(el => {
    const top = el.getBoundingClientRect().top;
    if (top < window.innerHeight - 100) {
      el.classList.add('active');
    }
  });
}

window.addEventListener('scroll', activateReveals);
window.addEventListener('load', activateReveals);
activateReveals();

// ── DRAG & DROP ────────────────────────────────────────
const zone = document.getElementById('uploadZone');
const uploadDefaults = {
  icon: '📄',
  title: 'Drag & Drop your resume',
  sub: 'TXT, PDF, or DOCX. Click anywhere here to upload once.',
  buttonLabel: '📎 Choose File',
  meta: ['Single-click upload', 'TXT · PDF · DOCX'],
  stateClass: ''
};

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

bindFileInputChange();

zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', async e => {
  e.preventDefault(); zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) await handleFile(file);
});
zone.addEventListener('click', e => {
  if (e.target.closest('button, input')) return;
  openFilePicker();
});

function openFilePicker(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const currentInput = document.getElementById('fileInput');
  if (!currentInput) return;
  currentInput.value = '';
  currentInput.click();
}

function bindFileInputChange() {
  const currentInput = document.getElementById('fileInput');
  if (!currentInput || currentInput.dataset.bound === 'true') return;
  currentInput.dataset.bound = 'true';
  currentInput.addEventListener('change', async e => {
    if (e.target.files[0]) await handleFile(e.target.files[0]);
  });
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(file) {
  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  return `${ext} imported`;
}

function normalizeResumeText(text = '') {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function getUploadMarkup(config = {}) {
  const merged = { ...uploadDefaults, ...config };
  const stateClass = merged.stateClass ? ` ${merged.stateClass}` : '';
  const buttonDisabled = merged.disabled ? ' disabled' : '';
  const metaItems = merged.meta.map(item => `<span>${escapeHtml(item)}</span>`).join('');
  return `
    <div class="upload-icon">${merged.icon}</div>
    <div class="upload-title">${escapeHtml(merged.title)}</div>
    <div class="upload-sub">${escapeHtml(merged.sub)}</div>
    <button class="upload-btn${stateClass}" type="button" onclick="openFilePicker(event)"${buttonDisabled}>
      ${escapeHtml(merged.buttonLabel)}
    </button>
    <input type="file" id="fileInput" accept=".txt,.pdf,.docx"/>
    <div class="upload-meta">${metaItems}</div>
  `;
}

function renderUploadState(config = {}) {
  zone.classList.remove('uploading', 'uploaded', 'upload-error', 'drag-over');
  if (config.stateClass) zone.classList.add(config.stateClass);
  zone.innerHTML = getUploadMarkup(config);
  bindFileInputChange();
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF reader failed to load. Refresh once and try again.');
  }
  const pdfData = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const pages = [];
  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const lines = content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
    if (lines) pages.push(lines);
  }
  return pages.join('\n\n');
}

async function extractDocxText(file) {
  if (!window.mammoth) {
    throw new Error('DOCX reader failed to load. Refresh once and try again.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'txt') return await file.text();
  if (ext === 'pdf') return await extractPdfText(file);
  if (ext === 'docx') return await extractDocxText(file);
  if (ext === 'doc') {
    throw new Error('Old .doc files do not extract reliably in browser. Save as PDF or DOCX, or paste the text below.');
  }
  return await file.text();
}

async function handleFile(file) {
  renderUploadState({
    icon: '⏳',
    title: 'Extracting resume text',
    sub: `Reading ${file.name}...`,
    buttonLabel: 'Processing...',
    meta: ['Please wait a moment', getFileTypeLabel(file)],
    stateClass: 'uploading',
    disabled: true
  });

  try {
    const extractedText = normalizeResumeText(await extractTextFromFile(file));
    if (!extractedText || extractedText.length < 50) {
      throw new Error('This file did not return enough readable text. Try another file or paste the resume manually.');
    }

    document.getElementById('resumeText').value = extractedText;
    renderUploadState({
      icon: '✅',
      title: file.name,
      sub: 'Resume text imported. Review or edit it below, then run the analysis.',
      buttonLabel: '↺ Replace File',
      meta: [formatFileSize(file.size), getFileTypeLabel(file)],
      stateClass: 'uploaded'
    });
  } catch (error) {
    renderUploadState({
      icon: '⚠️',
      title: 'Could not read that file',
      sub: error.message,
      buttonLabel: 'Try Another File',
      meta: ['Use TXT / PDF / DOCX', 'Or paste text below'],
      stateClass: 'upload-error'
    });
  }
}

// ── ANALYSIS ───────────────────────────────────────────
const ERROR_MESSAGE = 'ERROR! Backend API Key is not ready, so wait until the further update.';
const LOCAL_BACKEND_ENDPOINT = 'http://127.0.0.1:8787/api/analyze';
const loadingSub = document.querySelector('.loading-sub');

function getBackendEndpoint() {
  const configured = window.RESUMEIQ_CONFIG?.apiBaseUrl?.trim() || '';
  const isPlaceholder = !configured || configured.includes('your-render-service');
  const isLocalContext = window.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (!isPlaceholder) return configured;
  if (isLocalContext) return LOCAL_BACKEND_ENDPOINT;
  return '';
}

async function startAnalysis() {
  const text = document.getElementById('resumeText').value.trim();
  const jobRole = document.getElementById('jobRole').value || 'Software Developer';
  const expLevel = document.getElementById('expLevel').value;
  const industry = document.getElementById('industry').value;
  const backendEndpoint = getBackendEndpoint();
  const loadingText = document.getElementById('loadingText');
  const loadingMessages = [
    'Scanning experience...',
    'Detecting skill gaps...',
    'Optimizing for ATS...',
    'Benchmarking against top resumes...',
    'Building your improvement plan...'
  ];

  if (!text || text.length < 50) {
    alert('Please paste your resume text (at least 50 characters).');
    return;
  }

  if (!backendEndpoint) {
    alert(ERROR_MESSAGE);
    return;
  }

  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('loadingState').classList.add('active');
  document.getElementById('results').style.display = 'none';
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
  loadingSub.textContent = 'Secure backend is sending your request to the AI engine.';

  // Animate loading steps
  const steps = ['step1','step2','step3','step4','step5'];
  for (let i = 0; i < steps.length; i++) {
    loadingText.textContent = loadingMessages[i] || loadingMessages[loadingMessages.length - 1];
    await delay(600);
    if (i > 0) document.getElementById(steps[i-1]).classList.remove('active');
    if (i > 0) document.getElementById(steps[i-1]).classList.add('done');
    document.getElementById(steps[i]).classList.add('active');
  }

  try {
    const response = await fetch(backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        jobRole,
        expLevel,
        industry
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const apiMessage = data?.error || data?.message || `Backend request failed with status ${response.status}.`;
      throw new Error(apiMessage);
    }

    const result = data?.result;
    if (!result) throw new Error('Backend returned an empty result.');

    document.getElementById('loadingState').classList.remove('active');
    steps.forEach(s => { document.getElementById(s).classList.remove('active','done'); });
    loadingSub.textContent = 'AI Powered Engine is mapping your resume against hiring signals.';
    renderResults(result);

  } catch(err) {
    document.getElementById('loadingState').classList.remove('active');
    document.getElementById('analyzeBtn').disabled = false;
    steps.forEach(s => { document.getElementById(s).classList.remove('active','done'); });
    document.getElementById('loadingText').textContent = 'Scanning experience...';
    loadingSub.textContent = 'AI Powered Engine is mapping your resume against hiring signals.';
    alert(ERROR_MESSAGE);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function animateNumber(el, end, suffix = '') {
  let start = 0;
  const target = Number(end) || 0;
  const increment = Math.max(1, Math.ceil(target / 40));
  const interval = setInterval(() => {
    start += increment;
    if (start >= target) {
      start = target;
      clearInterval(interval);
    }
    el.textContent = `${start}${suffix}`;
  }, 20);
}

function animateIn(el, delay = 0) {
  if (!el) return;
  el.classList.remove('rise-in');
  void el.offsetWidth;
  el.style.animationDelay = `${delay}s`;
  el.classList.add('rise-in');
}

function animateGroup(elements, startDelay = 0, step = 0.08) {
  Array.from(elements).forEach((el, index) => animateIn(el, startDelay + (index * step)));
}

function renderResults(r) {
  document.getElementById('results').style.display = 'block';
  document.getElementById('analyzeBtn').disabled = false;

  // Score
  const scoreNum = document.getElementById('scoreNum');
  const fill = document.getElementById('scoreFill');
  const circumference = 2 * Math.PI * 52;
  scoreNum.textContent = '0';
  animateNumber(scoreNum, r.overallScore);
  setTimeout(() => {
    fill.style.strokeDashoffset = circumference - (r.overallScore / 100) * circumference;
  }, 100);

  // Color by score
  const color = r.overallScore >= 80 ? '#8be9ff' : r.overallScore >= 60 ? '#97a4ff' : r.overallScore >= 40 ? '#f6c36b' : '#ff6b81';
  fill.style.stroke = color;
  scoreNum.style.color = color;

  // Verdict
  const vtag = document.getElementById('verdictTag');
  vtag.textContent = r.verdict;
  vtag.className = 'verdict-tag ' + (r.overallScore >= 80 ? 'verdict-great' : r.overallScore >= 60 ? 'verdict-good' : r.overallScore >= 40 ? 'verdict-avg' : 'verdict-poor');
  document.getElementById('scoreTitle').textContent = r.title;
  document.getElementById('scoreVerdict').textContent = r.summary;

  // Metrics
  const mg = document.getElementById('metricsGrid');
  mg.innerHTML = r.metrics.map(m => `
    <div class="metric-card">
      <div class="metric-icon">${m.icon}</div>
      <div class="metric-name">${m.name}</div>
      <div class="metric-score" style="color:${m.color}">${m.score}<span style="font-size:1rem;color:var(--muted)">/100</span></div>
      <div class="metric-bar-bg"><div class="metric-bar-fill" style="background:${m.color}" data-width="${m.score}"></div></div>
    </div>
  `).join('');
  setTimeout(() => {
    document.querySelectorAll('.metric-bar-fill').forEach(b => {
      b.style.width = b.dataset.width + '%';
    });
  }, 100);

  // Skills & Gaps
  const ag = document.getElementById('analysisGrid');
  ag.innerHTML = `
    <div class="analysis-card">
      <h3>✅ Present Skills</h3>
      <div class="tag-list">${r.presentSkills.map(s => `<span class="tag tag-green">${s}</span>`).join('')}</div>
      <br>
      <h3>💪 Strong Points</h3>
      <div class="tag-list">${r.strongPoints.map(s => `<span class="tag tag-purple">${s}</span>`).join('')}</div>
    </div>
    <div class="analysis-card">
      <h3>🚨 Missing Skills</h3>
      <div class="tag-list">${r.missingSkills.map(s => `<span class="tag tag-red">${s}</span>`).join('')}</div>
      <br>
      <h3>⚠️ Weak Points</h3>
      <div class="tag-list">${r.weakPoints.map(s => `<span class="tag tag-red">${s}</span>`).join('')}</div>
    </div>
  `;

  // ATS
  const atsCard = document.getElementById('atsCard');
  const atsColor = r.atsScore >= 80 ? '#8be9ff' : r.atsScore >= 60 ? '#f6c36b' : '#ff6b81';
  atsCard.innerHTML = `
    <div class="ats-header">
      <div>
        <div class="ats-title">🤖 ATS Compatibility Check</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">Will your resume pass the robot filter?</div>
      </div>
      <div class="ats-score-badge" style="color:${atsColor}">${r.atsScore}%</div>
    </div>
    <div class="ats-items">
      ${r.atsChecks.map(c => `
        <div class="ats-item">
          <span class="ats-icon">${c.icon}</span>
          <span class="ats-item-text">${c.text}</span>
          <span class="ats-status ${c.status === 'pass' ? 'ats-pass' : c.status === 'fail' ? 'ats-fail' : 'ats-warn'}">
            ${c.status === 'pass' ? '✓ Pass' : c.status === 'fail' ? '✗ Fail' : '⚠ Warn'}
          </span>
        </div>
      `).join('')}
    </div>
  `;

  // Suggestions
  const sc = document.getElementById('suggestionsCard');
  sc.innerHTML = `
    <h3>💡 Top Improvements</h3>
    ${r.suggestions.map((s, i) => `
      <div class="suggestion-item">
        <div class="sug-num">${String(i+1).padStart(2,'0')}</div>
        <div class="sug-content">
          <div class="sug-title">${s.title}</div>
          <div class="sug-text">${s.text}</div>
        </div>
      </div>
    `).join('')}
  `;

  animateIn(document.getElementById('scoreHero'), 0);
  animateGroup(mg.children, 0.08, 0.07);
  animateGroup(ag.children, 0.2, 0.1);
  animateIn(atsCard, 0.36);
  animateIn(sc, 0.44);

  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}

function resetAnalyzer() {
  document.getElementById('resumeText').value = '';
  document.getElementById('jobRole').value = '';
  document.getElementById('results').style.display = 'none';
  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('loadingText').textContent = 'Scanning experience...';
  loadingSub.textContent = 'AI Powered Engine is mapping your resume against hiring signals.';
  renderUploadState(uploadDefaults);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
