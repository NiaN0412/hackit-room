// server_local.js — 本機測試版（使用 JSON 檔案，無需 MongoDB）
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = 3001;

const DATA_DIR       = path.join(__dirname, 'data');
const MESSAGES_FILE  = path.join(DATA_DIR, 'messages.json');
const USERS_FILE     = path.join(DATA_DIR, 'users.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const ANNOUNCE_FILE  = path.join(DATA_DIR, 'announcements.json');

const ADMIN_USERS = ['NiaN0412', 'admin', 'q_nnn412', 'amai', 'kindle1126'];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ── JSON helpers ────────────────────────────────────────────────
function readJSON(file, def = []) {
  try {
    if (!fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify(def, null, 2)); return def; }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return def; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── Auth helpers ────────────────────────────────────────────────
const activeSessions = new Map();

function hashPass(p) {
  return crypto.createHash('sha256').update(p + 'hackit_room_salt').digest('hex');
}
function authMiddleware(req, res, next) {
  const token = req.headers['x-hackit-token'];
  if (!token || !activeSessions.has(token)) return res.status(401).json({ error: '需要登入' });
  req.user = activeSessions.get(token);
  next();
}

// POST /auth/register
app.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '欄位不能為空' });
  if (username.trim().length < 2) return res.status(400).json({ error: '使用者名稱至少 2 個字元' });
  if (password.length < 4) return res.status(400).json({ error: '通行碼至少 4 個字元' });

  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username === username.trim())) return res.status(409).json({ error: '使用者名稱已存在' });

  const newUser = {
    id: Date.now(), username: username.trim(),
    password: hashPass(password), achievements: ['first_login']
  };
  users.push(newUser);
  writeJSON(USERS_FILE, users);

  const token = crypto.randomUUID();
  const isAdmin = ADMIN_USERS.includes(newUser.username);
  activeSessions.set(token, { userId: newUser.id, username: newUser.username, isAdmin });
  res.json({ success: true, token, username: newUser.username, isAdmin, achievements: newUser.achievements });
});

// POST /auth/login
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '欄位不能為空' });

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username.trim());
  if (!user || user.password !== hashPass(password)) return res.status(401).json({ error: '帳號或密碼錯誤' });

  const token = crypto.randomUUID();
  const isAdmin = ADMIN_USERS.includes(user.username);
  activeSessions.set(token, { userId: user.id, username: user.username, isAdmin });
  res.json({ success: true, token, username: user.username, isAdmin, achievements: user.achievements || [] });
});

// POST /auth/logout
app.post('/auth/logout', authMiddleware, (req, res) => {
  activeSessions.delete(req.headers['x-hackit-token']);
  res.json({ success: true });
});

// GET /auth/me
app.get('/auth/me', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === req.user.username);
  res.json({ ...req.user, achievements: user?.achievements || [] });
});

// POST /auth/achievement
app.post('/auth/achievement', authMiddleware, (req, res) => {
  const { achievementId } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  if (!user.achievements) user.achievements = [];
  if (!user.achievements.includes(achievementId)) user.achievements.push(achievementId);
  writeJSON(USERS_FILE, users);
  res.json({ achievements: user.achievements });
});

// GET /achievements — 回傳登入使用者的成就清單
app.get('/achievements', authMiddleware, (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === req.user.username);
  res.json(user?.achievements || []);
});

// POST /achievements/unlock — 解鎖成就並回傳 unlocked: true/false
app.post('/achievements/unlock', authMiddleware, (req, res) => {
  const { achievementId } = req.body;
  if (!achievementId) return res.status(400).json({ error: '缺少成就 ID' });
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  if (!user.achievements) user.achievements = [];
  if (user.achievements.includes(achievementId)) {
    return res.json({ success: true, unlocked: false, achievements: user.achievements });
  }
  user.achievements.push(achievementId);
  writeJSON(USERS_FILE, users);
  res.json({ success: true, unlocked: true, achievements: user.achievements });
});

// ── Messages ────────────────────────────────────────────────────
app.get('/messages', (req, res) => res.json(readJSON(MESSAGES_FILE)));

app.post('/messages', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '空訊息' });
  const msgs = readJSON(MESSAGES_FILE);
  const newMsg = { id: Date.now(), content: content.trim(), timestamp: new Date().toISOString(), seed: false };
  msgs.push(newMsg);
  if (msgs.length > 100) msgs.shift();
  writeJSON(MESSAGES_FILE, msgs);
  res.json(newMsg);
});

// ── Questions ───────────────────────────────────────────────────
app.get('/questions', (req, res) => res.json(readJSON(QUESTIONS_FILE)));

app.post('/questions', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: '權限不足' });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '空問題' });
  const qs = readJSON(QUESTIONS_FILE);
  const newQ = { id: Date.now(), content: content.trim(), author: req.user.username, timestamp: new Date().toISOString(), answered: false };
  qs.push(newQ);
  writeJSON(QUESTIONS_FILE, qs);
  res.json({ success: true, question: newQ });
});

app.post('/questions/:id/answer', authMiddleware, (req, res) => {
  const qid = Number(req.params.id);
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '空回覆' });
  const qs = readJSON(QUESTIONS_FILE);
  const q = qs.find(q => q.id === qid);
  if (!q) return res.status(404).json({ error: '找不到問題' });
  q.answered = true;
  writeJSON(QUESTIONS_FILE, qs);
  const msgs = readJSON(MESSAGES_FILE);
  const newMsg = { id: Date.now(), content: `[回覆] ${content.trim()}`, timestamp: new Date().toISOString(), seed: false };
  msgs.push(newMsg);
  writeJSON(MESSAGES_FILE, msgs);
  res.json({ success: true, message: newMsg });
});

// ── Announcements ───────────────────────────────────────────────
app.get('/announcements', (req, res) => {
  const items = readJSON(ANNOUNCE_FILE);
  res.json(items.slice().reverse());
});

app.post('/announcements', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: '權限不足' });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '公告內容不得為空' });
  const items = readJSON(ANNOUNCE_FILE);
  const newA = { id: Date.now(), content: content.trim(), author: req.user.username, timestamp: new Date().toISOString() };
  items.push(newA);
  writeJSON(ANNOUNCE_FILE, items);
  res.json({ success: true, announcement: newA });
});

// Default fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

app.listen(PORT, () => console.log(`[LOCAL DEV] Server on http://localhost:${PORT}`));
