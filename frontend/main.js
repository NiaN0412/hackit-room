// main.js — HackIt Room Entry & Interaction Logic

const API_BASE = 'https://hackit-room.onrender.com';

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

// ── Auth DOM ─────────────────────────────────────────────────────
const loginScreen  = document.getElementById('login-screen');
const loginUsername= document.getElementById('login-username');
const loginPassword= document.getElementById('login-password');
const loginError   = document.getElementById('login-error');
const loginSubmit  = document.getElementById('login-submit');
const loginSwitchBtn = document.getElementById('login-switch-btn');
const loginSwitchText = document.getElementById('login-switch-text');
const loginTitle   = document.getElementById('login-title');
const hudUsername  = document.getElementById('hud-username');
const logoutBtn    = document.getElementById('logout-btn');
const trophyBtn    = document.getElementById('trophy-btn');
const achievementsPanel = document.getElementById('achievements-panel');
const achievementsClose = document.getElementById('achievements-close');
const achievementsBody  = document.getElementById('achievements-body');
const toastContainer    = document.getElementById('toast-container');

// ── State ────────────────────────────────────────────────────────
let authToken = localStorage.getItem('hackit_token');
let authUsername = localStorage.getItem('hackit_username');
let isAdmin = localStorage.getItem('hackit_isAdmin') === 'true';
let authMode = 'login';

let renderer = null;
let animId   = null;
let startT   = null;
let messages = [];
let questions = [];
let unlockedAchievements = [];
let clickCounts = { radio: 0, papers: 0, lamp: 0, door: 0, plant: 0 };
let invalidCmdCount = 0;
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
      '一本佈滿灰塵的實體書。',
      '標題模糊不清。',
      '你翻了幾頁，都是空白。'
    ]
  },
  plant: {
    label: '盆栽',
    fallback: [
      '這是一盆不需要陽光也能存活的植物。它正安靜地陪著你。',
      '你澆了一點水。雖然只是虛擬的水，但感覺心裡平靜了些。',
      '葉片上有著細小的紋路，就像記憶的脈絡一樣。',
      '它生長得很慢，但每天都在變化。有些事情急不得的。'
    ]
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
  // Ensure loader is visible (in case coming from login screen)
  loader.style.display = 'flex';
  loader.classList.remove('fade-out');
  
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

  // Fetch messages and questions in background
  fetchMessages();
  fetchQuestions();
  fetchAchievements();

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

async function fetchQuestions() {
  try {
    const res = await fetch(`${API_BASE}/questions`);
    if (res.ok) {
      questions = await res.json();
      populateQuestions();
    }
  } catch {
    questions = [];
  }
}

async function fetchAchievements() {
  try {
    const res = await fetch(`${API_BASE}/achievements`, {
      headers: { 'x-hackit-token': authToken || '' }
    });
    if (res.ok) {
      unlockedAchievements = await res.json();
    }
  } catch { }
}

async function unlockAchievement(id) {
  if (unlockedAchievements.includes(id)) return;
  if (!authToken) return;

  try {
    const res = await fetch(`${API_BASE}/achievements/unlock`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-hackit-token': authToken 
      },
      body: JSON.stringify({ achievementId: id }),
    });
    const data = await res.json();
    if (res.ok && data.success && data.unlocked) {
      unlockedAchievements.push(id);
      showToast(ACHIEVEMENTS[id]);
    }
  } catch { }
}

async function postQuestion(content) {
  try {
    const res = await fetch(`${API_BASE}/questions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-hackit-token': authToken || ''
      },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      questions.push(data.question);
      populateQuestions();
      return true;
    }
    return false;
  } catch { return false; }
}

async function postMessage(content, questionId = null) {
  try {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-hackit-token': authToken || ''
      },
      body: JSON.stringify({ content, questionId }),
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

  // Track clicks for achievements
  if (clickCounts[objectId] !== undefined) {
    clickCounts[objectId]++;
    if (objectId === 'door' && clickCounts.door >= 10) unlockAchievement('futile_effort');
    if (objectId === 'radio' && clickCounts.radio >= 5) unlockAchievement('listener');
    if (objectId === 'papers' && clickCounts.papers >= 5) unlockAchievement('clue_finder');
    if (objectId === 'lamp' && clickCounts.lamp >= 5) unlockAchievement('light_toggle');
    if (objectId === 'plant' && clickCounts.plant >= 5) unlockAchievement('green_thumb');
  }

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

const questionSelectContainer = document.getElementById('question-selector-container');
const questionSelect = document.getElementById('question-select');
const inputTitle = document.getElementById('input-title');
const inputSub = document.getElementById('input-sub');

function populateQuestions() {
  if (questions.length === 0) {
    questionSelectContainer.classList.add('hidden');
    return;
  }
  questionSelectContainer.classList.remove('hidden');
  
  // Keep the first option (free text)
  const firstOpt = questionSelect.options[0];
  questionSelect.innerHTML = '';
  questionSelect.appendChild(firstOpt);
  
  questions.slice().reverse().forEach(q => {
    const opt = document.createElement('option');
    opt.value = q.id;
    opt.textContent = q.content.length > 20 ? q.content.slice(0, 20) + '...' : q.content;
    questionSelect.appendChild(opt);
  });
}

function openInputPanel() {
  userInput.value = '';
  submitFeedback.classList.add('hidden');
  submitBtn.disabled = false;
  submitBtn.textContent = '→ 送出';
  inputPanel.classList.remove('hidden');
  
  // Reset select
  questionSelect.value = "";
  updateInputPrompt();
  
  setTimeout(() => userInput.focus(), 100);
}

function updateInputPrompt() {
  const qid = questionSelect.value;
  if (!qid) {
    inputTitle.textContent = '留下你的想法';
    inputSub.textContent = '不評分・不強制・只是留下';
  } else {
    const q = questions.find(q => q.id == qid);
    if (q) {
      inputTitle.textContent = '回答問題';
      inputSub.textContent = q.content;
    }
  }
}

questionSelect.addEventListener('change', updateInputPrompt);

function closeInputPanel() {
  inputPanel.classList.add('hidden');
}

async function handleSubmit() {
  const content = userInput.value.trim();
  if (!content) return;

  const qid = questionSelect.value || null;

  submitBtn.disabled = true;
  submitBtn.textContent = '傳送中...';
  await postMessage(content, qid);
  
  unlockAchievement('leave_mark');
  if (qid) unlockAchievement('inquirer');

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
    setTimeout(() => {
      triggerFireworks();
      unlockAchievement('hacker_spirit');
    }, 650);
  } else if (lo.startsWith('ask ')) {
    if (!isAdmin) {
      appendTermLine('[系統] 權限不足。僅限管理員發布問題。', '#ff4040', 0);
    } else {
      const qContent = cmd.slice(4).trim();
      if (qContent) {
        appendTermLine('發布問題中...', '#667788', 0);
        postQuestion(qContent).then(success => {
          if (success) {
            appendTermLine('[系統] 問題已廣播至空間。', '#00e060', 400);
          } else {
            appendTermLine('[錯誤] 無法發布問題。', '#ff4040', 400);
          }
        });
      }
    }
  } else if (lo === 'help') {
    const cmds = [
      ['ls',          '列出記憶碎片'],
      ['cat <id>',    '讀取內容'],
      ['whoami',      '查詢身份'],
      ['clear',       '清除畫面'],
      ['ask <問題>',  '發布問題 (管理員)'],
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
    appendTermLine(`USER_ID: ${authUsername || 'unknown'}`, '#ffc940', 80);
    appendTermLine(`ROLE: ${isAdmin ? 'ADMINISTRATOR' : 'GUEST'}`, '#d4f0cc', 160);
    appendTermLine('但你在這裡。這已經足夠。', '#d4f0cc', 240);
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
    invalidCmdCount++;
    if (invalidCmdCount >= 3) unlockAchievement('lost_direction');
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
  if (soundOn) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startAmbient();
  } else {
    stopAmbient();
    unlockAchievement('silence');
  }
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
      achievementsPanel.classList.add('hidden');
    }
  });

  // Terminal close button
  termClose.addEventListener('click', closeTerminal);
  
  // Trophy UI
  trophyBtn.addEventListener('click', openAchievements);
  achievementsClose.addEventListener('click', () => achievementsPanel.classList.add('hidden'));

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

// ── Achievements Display ─────────────────────────────────────────

function openAchievements() {
  achievementsBody.innerHTML = '';
  
  Object.keys(ACHIEVEMENTS).forEach(id => {
    const meta = ACHIEVEMENTS[id];
    const isUnlocked = unlockedAchievements.includes(id);
    
    const card = document.createElement('div');
    card.className = `achieve-card ${isUnlocked ? 'unlocked' : ''}`;
    
    card.innerHTML = `
      <div class="achieve-icon">${isUnlocked ? meta.icon : '🔒'}</div>
      <div class="achieve-info">
        <div class="achieve-name">${isUnlocked ? meta.name : '???'}</div>
        <div class="achieve-desc">${isUnlocked ? meta.desc : '未解鎖'}</div>
      </div>
    `;
    achievementsBody.appendChild(card);
  });
  
  achievementsPanel.classList.remove('hidden');
}

function showToast(achievementMeta) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">${achievementMeta.icon}</div>
    <div class="toast-text">
      <div class="toast-title">達成成就</div>
      <div class="toast-name">${achievementMeta.name}</div>
    </div>
  `;
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4500);
}

// ── Start & Auth ─────────────────────────────────────────────────

function setupAuthEvents() {
  loginSwitchBtn.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    if (authMode === 'register') {
      loginTitle.textContent = '申請通行證';
      loginSubmit.textContent = '[ CREATE → ]';
      loginSwitchText.textContent = '已有通行證？';
      loginSwitchBtn.textContent = '登入';
    } else {
      loginTitle.textContent = '身份驗證系統';
      loginSubmit.textContent = '[ CONNECT → ]';
      loginSwitchText.textContent = '尚無通行證？';
      loginSwitchBtn.textContent = '申請';
    }
    loginError.textContent = '';
  });

  loginSubmit.addEventListener('click', async () => {
    const user = loginUsername.value.trim();
    const pass = loginPassword.value;
    if (!user || !pass) {
      loginError.textContent = '欄位不能為空';
      return;
    }
    
    loginSubmit.disabled = true;
    loginSubmit.textContent = '連線中...';
    loginError.textContent = '';
    
    try {
      const ep = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_BASE}${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        localStorage.setItem('hackit_token', data.token);
        localStorage.setItem('hackit_username', data.username);
        localStorage.setItem('hackit_isAdmin', data.isAdmin ? 'true' : 'false');
        authToken = data.token;
        authUsername = data.username;
        isAdmin = !!data.isAdmin;
        
        unlockAchievement('first_login');
        
        loginScreen.classList.add('fade-out');
        setTimeout(() => {
          loginScreen.classList.add('hidden');
          hudUsername.textContent = 'USER: ' + authUsername;
          boot();
        }, 700);
      } else {
        loginError.textContent = data.error || '連線失敗';
        loginSubmit.disabled = false;
        loginSubmit.textContent = authMode === 'login' ? '[ CONNECT → ]' : '[ CREATE → ]';
      }
    } catch (err) {
      loginError.textContent = '無法連線到伺服器';
      loginSubmit.disabled = false;
      loginSubmit.textContent = authMode === 'login' ? '[ CONNECT → ]' : '[ CREATE → ]';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    if (authToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'x-hackit-token': authToken }
        });
      } catch (e) {}
    }
    localStorage.removeItem('hackit_token');
    localStorage.removeItem('hackit_username');
    localStorage.removeItem('hackit_isAdmin');
    location.reload();
  });
}

function initApp() {
  setupAuthEvents();
  if (authToken) {
    loginScreen.classList.add('hidden');
    hudUsername.textContent = 'USER: ' + authUsername;
    boot();
  } else {
    loader.classList.add('fade-out');
    setTimeout(() => loader.style.display = 'none', 800);
  }
}

initApp();
