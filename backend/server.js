const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3001;

const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');
const USERS_FILE    = path.join(__dirname, 'data', 'users.json');
const QUESTIONS_FILE= path.join(__dirname, 'data', 'questions.json');

const ADMIN_USERS = ['NiaN0412', 'admin', 'q_nnn412'];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Auth helpers ─────────────────────────────────────────────────

const activeSessions = new Map(); // token → { userId, username, isAdmin }

function hashPass(p) {
  return crypto.createHash('sha256').update(p + 'hackit_room_salt').digest('hex');
}

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) { fs.writeFileSync(USERS_FILE, '[]'); return []; }
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch { return []; }
}

function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-hackit-token'];
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: '需要登入' });
  }
  req.user = activeSessions.get(token);
  next();
}

// POST /auth/register
app.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '欄位不能為空' });
  if (username.trim().length < 2)
    return res.status(400).json({ error: '使用者名稱至少 2 個字元' });
  if (password.length < 4)
    return res.status(400).json({ error: '通行碼至少 4 個字元' });

  const users = readUsers();
  if (users.find(u => u.username === username.trim()))
    return res.status(409).json({ error: '使用者名稱已存在' });

  const isAdmin = ADMIN_USERS.includes(username.trim());

  const user = {
    id: Date.now(),
    username: username.trim(),
    password: hashPass(password),
    achievements: [],
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);

  const token = crypto.randomBytes(20).toString('hex');
  activeSessions.set(token, { userId: user.id, username: user.username, isAdmin });
  res.json({ success: true, token, username: user.username, isAdmin });
});

// POST /auth/login
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '欄位不能為空' });

  const users = readUsers();
  const user  = users.find(u =>
    u.username === username.trim() && u.password === hashPass(password));
  if (!user)
    return res.status(401).json({ error: '帳號或通行碼錯誤' });

  const isAdmin = ADMIN_USERS.includes(user.username);
  const token = crypto.randomBytes(20).toString('hex');
  activeSessions.set(token, { userId: user.id, username: user.username, isAdmin });
  res.json({ success: true, token, username: user.username, isAdmin });
});

// POST /auth/logout
app.post('/auth/logout', (req, res) => {
  const token = req.headers['x-hackit-token'];
  if (token) activeSessions.delete(token);
  res.json({ success: true });
});

// ── Seed data ────────────────────────────────────────────────────

const SEED_MESSAGES = [
  { id: 1,  content: '有人曾在這裡想到一個點子，但沒有說出來。',   timestamp: '2025-01-01T00:00:00Z', seed: true },
  { id: 2,  content: '也許門的另一邊什麼都沒有。也許有。',         timestamp: '2025-01-01T01:00:00Z', seed: true },
  { id: 3,  content: '收音機接收的，不一定是廣播。',               timestamp: '2025-01-01T02:00:00Z', seed: true },
  { id: 4,  content: '這張紙上本來有字，但你看不到。',             timestamp: '2025-01-01T03:00:00Z', seed: true },
  { id: 5,  content: '燈泡閃爍的頻率，像摩斯密碼。',              timestamp: '2025-01-01T04:00:00Z', seed: true },
  { id: 6,  content: '有人把一個未完成的問題放在這裡。',           timestamp: '2025-01-01T05:00:00Z', seed: true },
  { id: 7,  content: '如果你不做任何事，這個空間還是會改變。',     timestamp: '2025-01-01T06:00:00Z', seed: true },
  { id: 8,  content: '不是所有的想法都需要被完成。',               timestamp: '2025-01-01T07:00:00Z', seed: true },
  { id: 9,  content: '這裡的時間和外面不一樣。',                   timestamp: '2025-01-01T08:00:00Z', seed: true },
  { id: 10, content: '你剛才想到什麼了嗎？',                       timestamp: '2025-01-01T09:00:00Z', seed: true },
  { id: 11, content: '...訊號斷了。請稍後再試。',                  timestamp: '2025-01-01T10:00:00Z', seed: true },
  { id: 12, content: '有個聲音說：這不重要。但我覺得它重要。',     timestamp: '2025-01-01T11:00:00Z', seed: true },
];

function readMessages() {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(SEED_MESSAGES, null, 2));
      return SEED_MESSAGES;
    }
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch { return SEED_MESSAGES; }
}

function writeMessages(data) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
}

// ── Questions Storage ────────────────────────────────────────────
function readQuestions() {
  try {
    if (!fs.existsSync(QUESTIONS_FILE)) { fs.writeFileSync(QUESTIONS_FILE, '[]'); return []; }
    return JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
  } catch { return []; }
}

function writeQuestions(data) {
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(data, null, 2));
}

// ── Message & Question routes ────────────────────────────────────

// GET /messages — public (anyone can read)
app.get('/messages', (req, res) => {
  const data = readMessages();
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  res.json(shuffled.slice(0, 8));
});

// POST /messages — requires login
app.post('/messages', authMiddleware, (req, res) => {
  const { content, questionId } = req.body;
  if (!content || content.trim().length === 0)
    return res.status(400).json({ error: '內容不能為空' });

  const data = readMessages();
  const newMsg = {
    id: Date.now(),
    content: content.trim().slice(0, 200),
    timestamp: new Date().toISOString(),
    author: req.user.username,
    seed: false,
    questionId: questionId || null
  };
  data.push(newMsg);
  writeMessages(data);
  res.json({ success: true, message: newMsg });
});

// GET /questions — public
app.get('/questions', (req, res) => {
  res.json(readQuestions());
});

// POST /questions — admin only
app.post('/questions', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: '權限不足' });
  }
  const { content } = req.body;
  if (!content || content.trim().length === 0)
    return res.status(400).json({ error: '內容不能為空' });

  const questions = readQuestions();
  const newQ = {
    id: Date.now(),
    content: content.trim().slice(0, 200),
    author: req.user.username,
    timestamp: new Date().toISOString()
  };
  questions.push(newQ);
  writeQuestions(questions);
  res.json({ success: true, question: newQ });
});

// ── Achievements routes ────────────────────────────────────────

// GET /achievements — requires login
app.get('/achievements', authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  
  res.json(user.achievements || []);
});

// POST /achievements/unlock — requires login
app.post('/achievements/unlock', authMiddleware, (req, res) => {
  const { achievementId } = req.body;
  if (!achievementId) return res.status(400).json({ error: '缺少成就 ID' });

  const users = readUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: '使用者不存在' });

  user.achievements = user.achievements || [];
  
  if (user.achievements.includes(achievementId)) {
    return res.json({ success: true, alreadyUnlocked: true });
  }

  user.achievements.push(achievementId);
  writeUsers(users);
  res.json({ success: true, unlocked: achievementId });
});

app.listen(PORT, () => {
  console.log(`HackIt Room API → http://localhost:${PORT}`);
});
