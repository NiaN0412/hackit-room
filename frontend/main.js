// main.js — HackIt Room Entry & Interaction Logic

const API_BASE = 'http://localhost:3001';

// ── DOM refs ─────────────────────────────────────────────────────
const loader       = document.getElementById('loader');
const loaderBar    = document.getElementById('loader-bar');
const loaderHint   = document.getElementById('loader-hint');
const scene        = document.getElementById('scene');
const scanlines    = document.getElementById('scanlines');
const hud          = document.getElementById('hud');
const canvas       = document.getElementById('room-canvas');
const dialog       = document.getElementById('dialog');
const dialogSrc    = document.getElementById('dialog-src');
const dialogBody   = document.getElementById('dialog-body');
const dialogClose  = document.getElementById('dialog-close');
const inputPanel   = document.getElementById('input-panel');
const userInput    = document.getElementById('user-input');
const submitBtn    = document.getElementById('submit-btn');
const cancelBtn    = document.getElementById('cancel-btn');
const submitFeedback = document.getElementById('submit-feedback');
const soundBtn     = document.getElementById('sound-btn');
const termPanel    = document.getElementById('term-panel');
const termBody     = document.getElementById('term-body');
const termClose    = document.getElementById('term-close');

// ── State ────────────────────────────────────────────────────────
let renderer = null;
let animId   = null;
let startT   = null;
let messages = [];
let soundOn  = false;
let audioCtx = null;
let ambientNode = null;

// ── Narrative fragments per object ───────────────────────────────
const OBJECT_META = {
  lamp: {
    label: '燈泡',
    narratives: [
      '它閃爍的頻率，比你的心跳快一點。',
      '有人曾說，燈熄了世界才開始。',
      '光打在牆上的影子從未停在同一個地方。',
      '...照不到的地方，才是真正的地圖。',
    ],
  },
  radio: {
    label: '收音機',
    narratives: null, // loads from API
    fallback: [
      '截獲訊號中... [雜訊]',
      '頻率：XX.X MHz ——「你有沒有想過——」[斷訊]',
      '「這個問題昨天有人也問過——」[雜訊]',
      '收訊不良。有時候這才是最清晰的狀態。',
    ],
  },
  papers: {
    label: '紙張',
    narratives: null, // loads from API (user messages)
    fallback: [
      '這張紙上本來有字，但已經消失了。',
      '（看不清楚——但感覺很重要）',
      '有人在這裡留下了一個問題，卻帶走了答案。',
    ],
  },
  door: {
    label: '門',
    narratives: [
      '這扇門目前無法打開。\n\n或者說，時機還沒到。',
      '門縫裡透出的光，顏色每次都不一樣。',
      '有人曾站在這裡很久，最後還是走了。',
      '...裡面的聲音說：「等一下」。\n那是三年前的事了。',
    ],
  },
  drawer: {
    label: '工作桌',
    isInput: true,
  },
  computer: {
    label: '電腦',
    isTerminal: true,
  },
};

// ── Boot sequence ────────────────────────────────────────────────

async function boot() {
  // Fake loading progress
  const hints = ['初始化空間...', '載入記憶碎片...', '校準頻率...', '準備就緒。'];
  let progress = 0;
  for (let i = 0; i <= 100; i += Math.floor(Math.random() * 12) + 4) {
    progress = Math.min(i, 100);
    loaderBar.style.width = progress + '%';
    if (progress >= 25 && hints.length) loaderHint.textContent = hints.shift() || '';
    await sleep(80 + Math.random() * 120);
  }
  loaderBar.style.width = '100%';
  await sleep(400);

  // Fetch messages in background
  fetchMessages();

  // Fade loader
  loader.classList.add('fade-out');
  await sleep(900);
  loader.style.display = 'none';

  // Init renderer
  renderer = new RoomRenderer(canvas);
  renderer.initParticles();
  scene.classList.add('visible');

  // Staggered reveal
  await sleep(600);
  scanlines.classList.add('visible');
  await sleep(1200);
  hud.classList.add('visible');

  // Start render loop
  requestAnimationFrame(loop);
  setupEvents();
}

function loop(ts) {
  if (!startT) startT = ts;
  const t = (ts - startT) / 1000;
  renderer.render(t);
  animId = requestAnimationFrame(loop);
}

// ── API ──────────────────────────────────────────────────────────

async function fetchMessages() {
  try {
    const res = await fetch(`${API_BASE}/messages`);
    if (res.ok) messages = await res.json();
  } catch {
    messages = [];
  }
}

async function postMessage(content) {
  try {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      messages.push(data.message);
    }
  } catch { /* offline fallback — still show feedback */ }
}

// ── Dialog ───────────────────────────────────────────────────────

function showDialog(objectId) {
  const meta = OBJECT_META[objectId];
  if (!meta) return;

  // Door triggers animation, not dialog
  if (objectId === 'door') {
    renderer.openDoor();
    return;
  }

  // Drawer opens input panel instead
  if (meta.isInput) {
    openInputPanel();
    return;
  }

  // Computer opens terminal panel
  if (meta.isTerminal) {
    openTerminal();
    return;
  }

  let text;
  if (objectId === 'papers' && messages.length > 0) {
    // Show a random user message
    const m = messages[Math.floor(Math.random() * messages.length)];
    text = m.content;
    dialogSrc.textContent = '殘留紀錄 #' + String(m.id).slice(-4);
  } else if (objectId === 'radio' && messages.length > 0) {
    // Radio: user messages as garbled signals
    const m = messages[Math.floor(Math.random() * messages.length)];
    text = '[ 截訊 ]\n\n' + garble(m.content);
    dialogSrc.textContent = '頻率 ' + randomFreq();
  } else {
    const pool = (meta.narratives || meta.fallback);
    text = pool[Math.floor(Math.random() * pool.length)];
    dialogSrc.textContent = meta.label;
  }

  dialogBody.textContent = '';
  dialog.classList.remove('hidden');
  typewriterEffect(dialogBody, text, 40);
}

function hideDialog() {
  dialog.classList.add('hidden');
}

// Typewriter effect
function typewriterEffect(el, text, msPerChar) {
  let i = 0;
  el.textContent = '';
  const interval = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) clearInterval(interval);
  }, msPerChar);
}

// Garble text for radio effect
function garble(text) {
  const noise = '░▒▓█■□▪▫';
  return text.split('').map(c => Math.random() < 0.25
    ? noise[Math.floor(Math.random() * noise.length)] : c).join('');
}

function randomFreq() {
  return (88 + Math.random() * 20).toFixed(1) + ' MHz';
}

// ── Input Panel ─────────────────────────────────────────────────

function openInputPanel() {
  userInput.value = '';
  submitFeedback.classList.add('hidden');
  submitBtn.disabled = false;
  submitBtn.textContent = '→ 送出';
  inputPanel.classList.remove('hidden');
  setTimeout(() => userInput.focus(), 100);
}

function closeInputPanel() {
  inputPanel.classList.add('hidden');
}

async function handleSubmit() {
  const content = userInput.value.trim();
  if (!content) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '傳送中...';
  await postMessage(content);

  userInput.value = '';
  submitBtn.textContent = '→ 送出';
  submitFeedback.classList.remove('hidden');

  // Auto close after a moment
  setTimeout(() => {
    closeInputPanel();
    submitFeedback.classList.add('hidden');
  }, 2200);
}

// ── Terminal Panel (Computer) ─────────────────────────────

function openTerminal() {
  termBody.innerHTML = '';
  termPanel.classList.remove('hidden');
  // Header lines
  const header = [
    'HACKIT_OS v0.1.3  [2026]',
    '─'.repeat(30),
    '記憶索引 — 載入中...',
    '',
  ];
  header.forEach(l => appendTermLine(l, '#00e060', 0));

  // Populate with messages
  const pool = messages.length > 0 ? messages : [
    { id: 'SYS001', content: '這裡還沒有區存行。先備查實體決器。', timestamp: '' },
  ];
  pool.forEach((m, i) => {
    const ts = m.timestamp ? m.timestamp.slice(0, 10) : '???';
    const idStr = String(m.id).slice(-6).padStart(6, '0');
    const delay = 120 * (i + 4);
    appendTermLine(`[${ts}] #${idStr}`, '#667788', delay);
    appendTermLine(`  » ${m.content}`, '#d4f0cc', delay + 60);
    appendTermLine('', '#00e060', delay + 60);
  });
}

function appendTermLine(text, color, delay) {
  setTimeout(() => {
    if (termPanel.classList.contains('hidden')) return;
    const row = document.createElement('div');
    row.className = 'term-row';
    row.style.color = color;
    row.textContent = text;
    termBody.appendChild(row);
    termBody.scrollTop = termBody.scrollHeight;
  }, delay);
}

function closeTerminal() {
  termPanel.classList.add('hidden');
}

// ── Terminal command processor ─────────────────────────────

function processCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  appendTermLine(`> ${cmd}`, '#00e060', 0);

  const lo = cmd.toLowerCase();
  if (lo === 'hack into it') {
    appendTermLine('', '#00e060', 0);
    appendTermLine('連線中...', '#ff6eb4', 80);
    appendTermLine('驗證權限... ██████████ 100%', '#ff6eb4', 260);
    appendTermLine('入侵成功。歡迎回家。', '#ffffff', 500);
    setTimeout(() => triggerFireworks(), 650);
  } else if (lo === 'help') {
    const cmds = [
      ['ls',          '列出記憶碎片'],
      ['cat <id>',    '讀取內容'],
      ['whoami',      '查詢身份'],
      ['clear',       '清除画面'],
      ['hack into it','███████'],
    ];
    appendTermLine('可用指令：', '#667788', 0);
    cmds.forEach(([c, d], i) =>
      appendTermLine(`  ${c.padEnd(12)} — ${d}`, '#d4f0cc', 60 * (i+1)));
  } else if (lo === 'ls') {
    appendTermLine('記憶碎片列表：', '#667788', 0);
    const pool = messages.length > 0 ? messages.slice(0, 8) : [{ id:'SYS', content:'空' }];
    pool.forEach((m, i) => {
      const name = `memory_${String(i).padStart(3,'0')}.frag`;
      appendTermLine(`  ${name}`, '#d4f0cc', 60 * (i+1));
    });
  } else if (lo === 'whoami') {
    appendTermLine('', '#00e060', 0);
    appendTermLine('unknown_visitor', '#ffc940', 80);
    appendTermLine('但你在這裡。這已經足夾。', '#d4f0cc', 200);
  } else if (lo === 'clear') {
    termBody.innerHTML = '';
  } else if (lo.startsWith('cat ')) {
    const idx = parseInt(lo.split(' ')[1]) || 0;
    const m = messages[idx];
    if (m) {
      appendTermLine(`[${m.timestamp?.slice(0,10) ?? '???'}]`, '#667788', 0);
      appendTermLine(m.content, '#d4f0cc', 80);
    } else {
      appendTermLine('檔案不存在。', '#554455', 0);
    }
  } else {
    appendTermLine(`未知指令: ${cmd}`, '#554455', 0);
    appendTermLine('輸入 help 查看可用指令', '#334455', 80);
  }
}

// ── Fireworks easter egg ────────────────────────────────

function triggerFireworks() {
  const fw = document.getElementById('fireworks-canvas');
  fw.width  = window.innerWidth;
  fw.height = window.innerHeight;
  fw.style.display = 'block';
  const ctx = fw.getContext('2d');

  const COLORS = ['#00e5cc','#ffc940','#ff6eb4','#9b7fff','#ffffff','#6680ff'];
  const particles = [];

  // Create 10 burst origins with staggered timing
  const bursts = Array.from({ length: 10 }, (_, i) => ({
    x:     fw.width  * (0.15 + Math.random() * 0.70),
    y:     fw.height * (0.08 + Math.random() * 0.55),
    color: COLORS[i % COLORS.length],
    delay: i * 220,
    fired: false,
  }));

  let startT = null;
  function animFW(ts) {
    if (!startT) startT = ts;
    const elapsed = ts - startT;

    // Fire bursts on schedule
    bursts.forEach(b => {
      if (!b.fired && elapsed >= b.delay) {
        b.fired = true;
        for (let p = 0; p < 28; p++) {
          const angle = (p / 28) * Math.PI * 2;
          const spd   = 4 + Math.random() * 6;
          particles.push({
            x: b.x, y: b.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 1,
            color: b.color,
            alpha: 1,
            size:  2 + Math.random() * 2,
          });
        }
      }
    });

    ctx.clearRect(0, 0, fw.width, fw.height);

    // Big center text
    const textSec = elapsed / 1000;
    if (textSec < 1.8) {
      const a = textSec < 0.4 ? textSec / 0.4 : Math.max(0, 1 - (textSec - 0.8) / 1.0);
      ctx.globalAlpha = a;
      ctx.font = `bold 36px 'Press Start 2P', monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00e5cc';
      ctx.shadowBlur  = 30;
      ctx.fillStyle   = '#00e5cc';
      ctx.fillText('HACK INTO IT', fw.width / 2, fw.height / 2 - 20);
      ctx.font = `14px 'Press Start 2P', monospace`;
      ctx.fillStyle = '#ffc940';
      ctx.fillText('你找到彩蛋了', fw.width / 2, fw.height / 2 + 24);
      ctx.shadowBlur  = 0;
      ctx.textAlign   = 'left';
      ctx.globalAlpha = 1;
    }

    // Draw particles
    particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.12;   // gravity
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.alpha -= 0.014;
      if (p.alpha <= 0) return;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
    });
    ctx.globalAlpha = 1;

    if (elapsed < 5000) {
      requestAnimationFrame(animFW);
    } else {
      ctx.clearRect(0, 0, fw.width, fw.height);
      fw.style.display = 'none';
    }
  }
  requestAnimationFrame(animFW);
}

// ── Sound ────────────────────────────────────────────────────────

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startAmbient() {
  if (!audioCtx) return;
  if (ambientNode) return;

  // Low drone: two slightly detuned oscillators + filter
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc1.type = 'sawtooth';
  osc1.frequency.value = 60;
  osc2.type = 'sawtooth';
  osc2.frequency.value = 62.5;

  filter.type = 'lowpass';
  filter.frequency.value = 280;
  filter.Q.value = 8;

  gain.gain.value = 0.04;

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start();
  osc2.start();
  ambientNode = { osc1, osc2, gain };
}

function stopAmbient() {
  if (!ambientNode) return;
  const { osc1, osc2, gain } = ambientNode;
  gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
  setTimeout(() => { osc1.stop(); osc2.stop(); }, 600);
  ambientNode = null;
}

function toggleSound() {
  initAudio();
  soundOn = !soundOn;
  soundBtn.classList.toggle('active', soundOn);
  soundBtn.textContent = soundOn ? '♪' : '×';
  if (soundOn) startAmbient(); else stopAmbient();
}

// Click SFX
function playClick(color) {
  if (!audioCtx || !soundOn) return;
  const freqMap = {
    lamp:     440,
    radio:    330,
    papers:   520,
    door:     220,
    drawer:   590,
    computer: 480,
  };
  const osc = audioCtx.createOscillator();
  const g   = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freqMap[color] || 400;
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
}

// ── Events ───────────────────────────────────────────────────────

function setupEvents() {
  // Canvas hover
  canvas.addEventListener('mousemove', (e) => {
    if (!renderer) return;
    const hit = renderer.hitTest(e.clientX, e.clientY);
    renderer.hoverId = hit;
    canvas.classList.toggle('cursor-pointer', !!hit);
    document.getElementById('hud-hint').textContent =
      hit ? `[ ${OBJECT_META[hit]?.label || hit} ]` : '點擊物件探索';
  });

  // Canvas click
  canvas.addEventListener('click', (e) => {
    if (!renderer) return;
    const hit = renderer.hitTest(e.clientX, e.clientY);
    if (hit) {
      playClick(hit);
      showDialog(hit);
    }
  });

  // Dialog close
  dialogClose.addEventListener('click', hideDialog);

  // Input panel
  submitBtn.addEventListener('click', handleSubmit);
  cancelBtn.addEventListener('click', closeInputPanel);
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  // Sound toggle
  soundBtn.addEventListener('click', toggleSound);

  // ESC closes panels
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideDialog();
      closeInputPanel();
      closeTerminal();
    }
  });

  // Terminal close button
  termClose.addEventListener('click', closeTerminal);

  // Terminal input — process commands on Enter
  const termInput = document.getElementById('term-input');
  if (termInput) {
    termInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        processCommand(termInput.value);
        termInput.value = '';
      }
    });
  }
}

// ── Utils ────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Start ────────────────────────────────────────────────────────
boot();
