// index.js — AI Ethics Advisor Frontend
'use strict';

const SERVER = 'http://localhost:3000';

// ── DOM refs ──────────────────────────────────────────────────
const chatBox    = document.getElementById('chatBox');
const qInput     = document.getElementById('question');
const sendBtn    = document.getElementById('sendBtn');
const voiceBtn   = document.getElementById('voiceBtn');
const charCount  = document.getElementById('charCount');
const sDot       = document.getElementById('sDot');
const sText      = document.getElementById('sText');
const msgCountEl = document.getElementById('msgCountEl');
const locBadge   = document.getElementById('locBadge');
const locText    = document.getElementById('locationText');
const welcome    = document.getElementById('welcomeState');

// ── State ─────────────────────────────────────────────────────
let userLocation = null;
let msgCount     = 0;
let queryCount   = 0;
let ratings      = [];
let speechObj    = null;
const startTime  = Date.now();

// ── Framework labels ──────────────────────────────────────────
const FRAMEWORK_LABELS = {
  general:     'Consequentialism · Deontology · Virtue Ethics',
  ai:          'Fairness · Accountability · Transparency (FAT)',
  business:    'Stakeholder Theory · CSR · Deontology',
  medical:     'Beneficence · Non-maleficence · Autonomy · Justice',
  education:   'Epistemic Justice · Academic Integrity',
  legal:       'GDPR · Right to Privacy · Due Process',
  environmental:'Deep Ecology · Intergenerational Justice',
  social:      'Rawlsian Justice · Intersectionality',
  technology:  'Value-Sensitive Design · Digital Rights',
};

// ── Particles ─────────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  const COUNT = 55;
  const particles = [];
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < COUNT; i++) {
    particles.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5, r: Math.random() * 1.5 + 1 });
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99,102,241,0.6)'; ctx.fill();
    });
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(99,102,241,${(1 - d / 120) * 0.2})`; ctx.lineWidth = 0.7; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Theme ─────────────────────────────────────────────────────
(function initTheme() { applyTheme(localStorage.getItem('theme') || 'dark'); })();
function applyTheme(m) {
  document.body.classList.toggle('light', m === 'light');
  const ic = document.getElementById('themeIcon');
  if (ic) ic.className = m === 'light' ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('theme', m);
}
function toggleTheme() { applyTheme(document.body.classList.contains('light') ? 'dark' : 'light'); }

// ── Session timer ─────────────────────────────────────────────
setInterval(() => {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const el = document.getElementById('statTime');
  if (el) el.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}, 1000);

function updateStats() {
  const q = document.getElementById('statQueries');
  const r = document.getElementById('statRating');
  if (q) q.textContent = queryCount;
  if (r) r.textContent = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—';
  if (msgCountEl) msgCountEl.textContent = `${msgCount} message${msgCount !== 1 ? 's' : ''}`;
}

// ── Health check ──────────────────────────────────────────────
async function checkHealth() {
  try {
    const r = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) { sDot.className = 's-dot on'; sText.textContent = 'Server online'; }
    else throw 0;
  } catch { sDot.className = 's-dot off'; sText.textContent = 'Server offline'; }
}
checkHealth();
setInterval(checkHealth, 30000);

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, ms = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// ── Char counter ──────────────────────────────────────────────
qInput.addEventListener('input', () => {
  const l = qInput.value.length;
  charCount.textContent = `${l} / 1000`;
  charCount.classList.toggle('warn', l > 850);
  qInput.style.height = 'auto';
  qInput.style.height = Math.min(qInput.scrollHeight, 140) + 'px';
});

// ── Enter to send ─────────────────────────────────────────────
qInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); getAdvice(); } });

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target === qInput) return;
  if (e.key === '?') { openShortcuts(); return; }
  if (!e.ctrlKey) return;
  if (e.key === 'l' || e.key === 'L') { e.preventDefault(); clearChat(); }
  if (e.key === 'd' || e.key === 'D') { e.preventDefault(); toggleTheme(); }
  if (e.key === 'h' || e.key === 'H') { e.preventDefault(); openHistory(); }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); openFrameworks(); }
  if (e.key === 'p' || e.key === 'P') { e.preventDefault(); exportPDF(); }
});

// ── Category change ───────────────────────────────────────────
function onCategoryChange() {
  const cat = document.getElementById('category').value;
  const tag = document.getElementById('frameworkTagText');
  if (tag) tag.textContent = FRAMEWORK_LABELS[cat] || FRAMEWORK_LABELS.general;
}

// ── Quick chips ───────────────────────────────────────────────
function useChip(btn) { qInput.value = btn.textContent.trim(); qInput.dispatchEvent(new Event('input')); qInput.focus(); }

// ── Hide welcome ──────────────────────────────────────────────
function hideWelcome() { if (welcome) welcome.style.display = 'none'; }

// ── Daily Ethics Fact ─────────────────────────────────────────
async function loadDailyFact() {
  const btn  = document.getElementById('factRefreshBtn');
  const text = document.getElementById('factText');
  if (!text) return;
  if (btn) btn.classList.add('spinning');
  text.textContent = 'Loading insight…';
  try {
    const r    = await fetch(`${SERVER}/api/daily-fact`);
    const data = await r.json();
    if (data.success) {
      text.textContent = data.fact;
      const label = document.querySelector('.fact-label');
      if (label) label.textContent = `💡 ${data.topic.charAt(0).toUpperCase() + data.topic.slice(1)}`;
    } else { text.textContent = 'Could not load insight.'; }
  } catch { text.textContent = 'Start server to load daily ethics insights.'; }
  finally { if (btn) btn.classList.remove('spinning'); }
}

// ── Concept lookup ────────────────────────────────────────────
async function lookupConcept(term) {
  const title = document.getElementById('conceptTitle');
  const body  = document.getElementById('conceptBody');
  const link  = document.getElementById('conceptLink');
  title.textContent = term;
  body.innerHTML = '<p class="concept-extract" style="color:var(--t3)">Loading…</p>';
  openConceptModal();
  try {
    const r    = await fetch(`${SERVER}/api/concept/${encodeURIComponent(term)}`);
    const data = await r.json();
    if (data.success) {
      let html = '';
      if (data.thumbnail) html += `<img src="${data.thumbnail}" class="concept-thumb" alt="${term}" onerror="this.style.display='none'">`;
      html += `<p class="concept-extract">${data.extract}</p>`;
      body.innerHTML = html;
      if (data.pageUrl) { link.href = data.pageUrl; link.style.display = 'inline-flex'; }
      else link.style.display = 'none';
    } else { body.innerHTML = '<p class="concept-extract">Definition not found.</p>'; link.style.display = 'none'; }
  } catch { body.innerHTML = '<p class="concept-extract">Could not fetch definition.</p>'; link.style.display = 'none'; }
}

// ── Books ─────────────────────────────────────────────────────
async function loadBooks(subject = 'ethics') {
  const grid = document.getElementById('booksGrid');
  const icon = document.getElementById('bookRefreshIcon');
  if (!grid) return;
  if (icon) icon.style.animation = 'spin .8s linear infinite';
  grid.innerHTML = '<p class="h-empty" style="font-size:.72rem">Loading books…</p>';
  try {
    const r    = await fetch(`${SERVER}/api/books/${encodeURIComponent(subject)}`);
    const data = await r.json();
    if (data.success && data.books.length) {
      grid.innerHTML = data.books.map(b => `
        <div class="book-card">
          ${b.cover ? `<img src="${b.cover}" class="book-cover" alt="${b.title}" onerror="this.outerHTML='<div class=book-cover-placeholder>📖</div>'">` : '<div class="book-cover-placeholder">📖</div>'}
          <div class="book-info">
            <div class="book-title" title="${b.title}">${b.title}</div>
            <div class="book-author">${b.authors || 'Unknown'}</div>
            <div class="book-year">${b.year}</div>
            <a href="${b.url}" target="_blank" class="book-link">View on Open Library ↗</a>
          </div>
        </div>`).join('');
    } else { grid.innerHTML = '<p class="h-empty" style="font-size:.72rem">No books found.</p>'; }
  } catch { grid.innerHTML = '<p class="h-empty" style="font-size:.72rem">Books unavailable offline.</p>'; }
  finally { if (icon) icon.style.animation = ''; }
}

// ── Format AI response ────────────────────────────────────────
function formatResponse(text) {
  const MAP = {
    'Situation':      { icon: '📋', cls: 'purple' },
    'Principles':     { icon: '🔷', cls: 'cyan'   },
    'Pros':           { icon: '✅', cls: 'green'  },
    'Cons':           { icon: '⚠️',  cls: 'red'    },
    'Risk Level':     { icon: '🚨', cls: 'red'    },
    'Possibility':    { icon: '🎯', cls: 'green'  },
    'Recommendation': { icon: '💡', cls: 'amber'  },
    'Alternatives':   { icon: '🔀', cls: 'purple' },
    'Framework Used': { icon: '⚖️',  cls: 'blue'   },
  };
  let html = '';
  const parts = text.split(/\n(?=(?:Situation|Principles|Pros|Cons|Risk Level|Possibility|Recommendation|Alternatives|Framework Used):)/);
  parts.forEach(part => {
    const m = part.match(/^(Situation|Principles|Pros|Cons|Risk Level|Possibility|Recommendation|Alternatives|Framework Used):\s*([\s\S]*)/);
    if (m) {
      const { icon, cls } = MAP[m[1]] || { icon: '', cls: 'purple' };
      const body = m[2].trim().replace(/\n/g, '<br>');
      html += `<div class="ai-sec"><div class="ai-sec-title ${cls}">${icon} ${m[1]}</div><div class="ai-sec-body">${body}</div></div>`;
    } else {
      const safe = part.trim().replace(/\n/g, '<br>');
      if (safe) html += `<div class="ai-sec"><div class="ai-sec-body">${safe}</div></div>`;
    }
  });
  return html || text.replace(/\n/g, '<br>');
}

// ── Confidence score ──────────────────────────────────────────
function calcConfidence(text) {
  const keys = ['Situation:','Principles:','Pros:','Cons:','Risk Level:','Possibility:','Recommendation:','Alternatives:','Framework Used:'];
  const found = keys.filter(k => text.includes(k)).length;
  return Math.min(98, 55 + found * 5 + Math.floor(Math.random() * 5));
}

// ── Stagger reveal ────────────────────────────────────────────
function staggerReveal(container) {
  container.querySelectorAll('.ai-sec').forEach((s, i) => {
    s.style.opacity = '0'; s.style.transform = 'translateY(8px)';
    setTimeout(() => { s.style.transition = 'opacity .35s ease, transform .35s ease'; s.style.opacity = '1'; s.style.transform = 'none'; }, i * 120);
  });
}

// ── Add message ───────────────────────────────────────────────
function addMsg(text, type, rawText = '') {
  hideWelcome(); msgCount++; updateStats();
  const wrap = document.createElement('div'); wrap.className = `msg ${type}`;
  const meta = document.createElement('div'); meta.className = 'msg-meta';
  const av   = document.createElement('div'); av.className = 'm-av'; av.textContent = type === 'user' ? '👤' : '🧠';
  const name = document.createElement('span'); name.textContent = type === 'user' ? 'You' : 'AI Advisor';
  const time = document.createElement('span'); time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (type === 'user') meta.append(time, name, av); else meta.append(av, name, time);
  const bubble = document.createElement('div'); bubble.className = 'bubble';
  if (type === 'bot') bubble.innerHTML = formatResponse(text); else bubble.textContent = text;
  wrap.append(meta, bubble);
  if (type === 'bot') {
    const score = calcConfidence(text);
    const conf  = document.createElement('div'); conf.className = 'confidence';
    conf.innerHTML = `<span class="conf-label">Ethics Confidence</span><div class="conf-track"><div class="conf-fill" id="cf-${msgCount}" style="width:0%"></div></div><span class="conf-pct">${score}%</span>`;
    wrap.appendChild(conf);
    setTimeout(() => { const f = document.getElementById(`cf-${msgCount}`); if (f) f.style.width = score + '%'; }, 400);
    const rateId  = msgCount;
    const rating  = document.createElement('div'); rating.className = 'rating';
    rating.innerHTML = `<span style="font-size:.68rem;color:var(--t3)">Rate this:</span><button class="rate-btn up" id="up-${rateId}" onclick="rateMsg(${rateId},1)">👍 Helpful</button><button class="rate-btn dn" id="dn-${rateId}" onclick="rateMsg(${rateId},-1)">👎 Not helpful</button>`;
    wrap.appendChild(rating);
    setTimeout(() => staggerReveal(bubble), 50);
  }
  const actions = document.createElement('div'); actions.className = 'm-actions';
  const copyBtn = document.createElement('button'); copyBtn.className = 'm-act';
  copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
  copyBtn.onclick = () => navigator.clipboard.writeText(rawText || text).then(() => toast('✅ Copied!'));
  actions.appendChild(copyBtn);
  if (type === 'bot') {
    const speakBtn = document.createElement('button'); speakBtn.className = 'm-act';
    speakBtn.innerHTML = '<i class="fas fa-volume-up"></i> Speak';
    speakBtn.onclick = () => speakMsg(rawText || text, speakBtn);
    actions.appendChild(speakBtn);
  }
  wrap.appendChild(actions);
  chatBox.appendChild(wrap);
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
  return wrap;
}

// ── Rating ────────────────────────────────────────────────────
function rateMsg(id, val) {
  const up = document.getElementById(`up-${id}`), dn = document.getElementById(`dn-${id}`);
  [up, dn].forEach(b => b && b.classList.remove('selected'));
  if (val === 1 && up) { up.classList.add('selected'); ratings.push(5); toast('👍 Thanks!'); }
  else if (dn)         { dn.classList.add('selected'); ratings.push(1); toast('👎 Noted!'); }
  updateStats();
}

// ── Typing indicator ──────────────────────────────────────────
function showTyping() {
  const wrap = document.createElement('div'); wrap.className = 'msg bot'; wrap.id = 'typingWrap';
  const meta = document.createElement('div'); meta.className = 'msg-meta';
  const av   = document.createElement('div'); av.className = 'm-av'; av.textContent = '🧠';
  const nm   = document.createElement('span'); nm.textContent = 'AI Advisor';
  meta.append(av, nm);
  const bub = document.createElement('div'); bub.className = 'typing-wrap';
  bub.innerHTML = '<span>Analysing…</span><div class="t-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>';
  wrap.append(meta, bub); chatBox.appendChild(wrap);
  chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}
function removeTyping() { const el = document.getElementById('typingWrap'); if (el) el.remove(); }

// ── TTS ───────────────────────────────────────────────────────
function speakMsg(text, btn) {
  if (!('speechSynthesis' in window)) { toast('❌ TTS not supported'); return; }
  if (speechObj) { window.speechSynthesis.cancel(); speechObj = null; if (btn) btn.innerHTML = '<i class="fas fa-volume-up"></i> Speak'; return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.88; u.pitch = 1;
  u.onend = () => { speechObj = null; if (btn) btn.innerHTML = '<i class="fas fa-volume-up"></i> Speak'; };
  speechObj = u; window.speechSynthesis.speak(u);
  if (btn) btn.innerHTML = '<i class="fas fa-stop"></i> Stop';
}

// ── Voice input ───────────────────────────────────────────────
function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('❌ Voice not supported'); return; }
  const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false;
  voiceBtn.classList.add('rec'); voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
  rec.onresult = e => { qInput.value = e.results[0][0].transcript; qInput.dispatchEvent(new Event('input')); toast('🎤 Voice captured!'); };
  rec.onend    = () => { voiceBtn.classList.remove('rec'); voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>'; };
  rec.onerror  = () => { toast('❌ Voice error'); voiceBtn.classList.remove('rec'); voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>'; };
  rec.start();
}

// ── Location ──────────────────────────────────────────────────
async function getLocation() {
  const btn = document.getElementById('locBtn');
  if (!navigator.geolocation) { toast('❌ Geolocation not supported'); return; }
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Fetching…</span>';
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const { latitude: lat, longitude: lon } = pos.coords;
      const r    = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const data = await r.json();
      const addr = data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      userLocation = { latitude: lat, longitude: lon, address: addr };
      locText.textContent = addr; locText.title = addr;
      locBadge.style.display = 'inline';
      btn.classList.add('active'); btn.innerHTML = '<i class="fas fa-location-dot"></i> <span>Active</span>';
      toast('📍 Location saved!');
      fetch(`${SERVER}/api/location`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userLocation) }).catch(() => {});
    } catch { toast('⚠️ Could not get address'); btn.innerHTML = '<i class="fas fa-map-marker-alt"></i><span>Location</span>'; }
  }, () => { toast('❌ Permission denied'); btn.innerHTML = '<i class="fas fa-map-marker-alt"></i><span>Location</span>'; });
}

// ── History ───────────────────────────────────────────────────
function saveHistory(q, a) {
  const key = 'ethicsHistoryV2', hist = JSON.parse(localStorage.getItem(key) || '[]');
  hist.unshift({ q, a, t: Date.now(), cat: document.getElementById('category').value });
  if (hist.length > 30) hist.pop();
  localStorage.setItem(key, JSON.stringify(hist));
}
function openHistory() {
  const hist = JSON.parse(localStorage.getItem('ethicsHistoryV2') || '[]');
  const list = document.getElementById('hList'); list.innerHTML = '';
  if (!hist.length) { list.innerHTML = '<p class="h-empty">No conversations yet.</p>'; }
  else hist.forEach(h => {
    const d = document.createElement('div'); d.className = 'h-item';
    d.innerHTML = `<div>${h.q.slice(0, 75)}${h.q.length > 75 ? '…' : ''}</div><div class="h-time">${new Date(h.t).toLocaleString()} · ${h.cat}</div>`;
    d.onclick = () => { qInput.value = h.q; qInput.dispatchEvent(new Event('input')); closeAll(); qInput.focus(); };
    list.appendChild(d);
  });
  document.getElementById('hPanel').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}
function clearHistory() { localStorage.removeItem('ethicsHistoryV2'); document.getElementById('hList').innerHTML = '<p class="h-empty">No conversations yet.</p>'; toast('🗑️ History cleared'); }

// ── Modals & panels ───────────────────────────────────────────
function openShortcuts()   { document.getElementById('shortcutsModal').classList.add('open'); document.getElementById('overlay').classList.add('open'); }
function openConceptModal(){ document.getElementById('conceptModal').classList.add('open');   document.getElementById('overlay').classList.add('open'); }
function openFrameworks()  { document.getElementById('fwPanel').classList.add('open');        document.getElementById('overlay').classList.add('open'); loadBooks('ethics'); }
function closeAll() {
  ['hPanel','fwPanel'].forEach(id => document.getElementById(id).classList.remove('open'));
  ['shortcutsModal','conceptModal'].forEach(id => document.getElementById(id).classList.remove('open'));
  document.getElementById('overlay').classList.remove('open');
}
function showSection() {}

// ── Clear / Share / Export ────────────────────────────────────
function clearChat() { chatBox.innerHTML = ''; chatBox.appendChild(welcome); welcome.style.display = ''; msgCount = 0; updateStats(); toast('🗑️ Chat cleared'); }
function shareConvo() {
  const msgs = chatBox.querySelectorAll('.msg'); if (!msgs.length) { toast('Nothing to share yet'); return; }
  let txt = '=== AI Ethics Advisor ===\n\n';
  msgs.forEach(m => { const b = m.querySelector('.bubble'); if (b) txt += (m.classList.contains('user') ? 'You' : 'AI Advisor') + ':\n' + b.innerText + '\n\n'; });
  navigator.clipboard.writeText(txt).then(() => toast('✅ Conversation copied!'));
}
function exportPDF() { if (!chatBox.querySelector('.msg')) { toast('Nothing to export yet'); return; } toast('📄 Preparing PDF…'); setTimeout(() => window.print(), 300); }

// ── Main: get advice ──────────────────────────────────────────
async function getAdvice() {
  const question = qInput.value.trim();
  const category = document.getElementById('category').value;
  if (!question) { qInput.focus(); return; }
  addMsg(question, 'user');
  qInput.value = ''; qInput.style.height = ''; qInput.dispatchEvent(new Event('input'));
  sendBtn.disabled = true; voiceBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  showTyping(); queryCount++;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res   = await fetch(`${SERVER}/api/ethics`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, category, location: userLocation }), signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data   = await res.json();
    removeTyping();
    const answer = data.answer || 'No response from AI.';
    addMsg(answer, 'bot', answer);
    saveHistory(question, answer);
  } catch (err) {
    removeTyping();
    const msg = err.name === 'AbortError' ? '❌ Request timed out.' : '❌ Cannot connect — run: npm start';
    addMsg(msg, 'bot'); toast(msg, 3500);
  } finally {
    sendBtn.disabled = false; voiceBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    qInput.focus(); updateStats();
  }
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('load', () => {
  qInput.focus();
  updateStats();
  loadDailyFact();
});
