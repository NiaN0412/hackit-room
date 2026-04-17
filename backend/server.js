require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const crypto   = require('crypto');
const mongoose = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 3001;

const ADMIN_USERS = ['NiaN0412', 'admin', 'q_nnn412'];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── MongoDB Setup ────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

const fs = require('fs');

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await autoImportData();
  })
  .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  id: Number,
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  achievements: [String],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
  id: Number,
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  seed: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

const questionSchema = new mongoose.Schema({
  id: Number,
  content: { type: String, required: true },
  author: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  answered: { type: Boolean, default: false }
});
const Question = mongoose.model('Question', questionSchema);

// ── Auto-Import Logic ────────────────────────────────────────────
async function autoImportData() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) return; // Already imported

    console.log('Database empty, starting auto-import from JSON...');
    const dataDir = path.join(__dirname, 'data');
    
    if (fs.existsSync(path.join(dataDir, 'users.json'))) {
      const usersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
      if (usersData.length > 0) await User.insertMany(usersData);
    }
    if (fs.existsSync(path.join(dataDir, 'messages.json'))) {
      const msgsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'messages.json'), 'utf8'));
      if (msgsData.length > 0) await Message.insertMany(msgsData);
    }
    if (fs.existsSync(path.join(dataDir, 'questions.json'))) {
      const qsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'questions.json'), 'utf8'));
      if (qsData.length > 0) await Question.insertMany(qsData);
    }
    console.log('Auto-import successful!');
  } catch (err) {
    console.error('Auto-import failed:', err);
  }
}

// ── Auth helpers ─────────────────────────────────────────────────

const activeSessions = new Map(); // token → { userId, username, isAdmin }

function hashPass(p) {
  return crypto.createHash('sha256').update(p + 'hackit_room_salt').digest('hex');
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
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '欄位不能為空' });
  if (username.trim().length < 2)
    return res.status(400).json({ error: '使用者名稱至少 2 個字元' });
  if (password.length < 4)
    return res.status(400).json({ error: '通行碼至少 4 個字元' });

  try {
    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({ error: '使用者名稱已存在' });
    }

    const newUser = new User({
      id: Date.now(),
      username: username.trim(),
      password: hashPass(password),
      achievements: ['first_login']
    });
    await newUser.save();

    const token = crypto.randomUUID();
    const isAdmin = ADMIN_USERS.includes(newUser.username);
    activeSessions.set(token, { userId: newUser.id, username: newUser.username, isAdmin });

    res.json({ token, username: newUser.username, isAdmin, achievements: newUser.achievements });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '欄位不能為空' });

  try {
    const user = await User.findOne({ username: username.trim() });
    if (!user || user.password !== hashPass(password)) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const token = crypto.randomUUID();
    const isAdmin = ADMIN_USERS.includes(user.username);
    activeSessions.set(token, { userId: user.id, username: user.username, isAdmin });

    res.json({ token, username: user.username, isAdmin, achievements: user.achievements || [] });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// POST /auth/logout
app.post('/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers['x-hackit-token'];
  activeSessions.delete(token);
  res.json({ success: true });
});

// GET /auth/me
app.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username });
    res.json({ ...req.user, achievements: user?.achievements || [] });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// POST /auth/achievement
app.post('/auth/achievement', authMiddleware, async (req, res) => {
  const { achievementId } = req.body;
  if (!achievementId) return res.status(400).json({ error: '缺少成就 ID' });

  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(404).json({ error: '使用者不存在' });

    if (!user.achievements.includes(achievementId)) {
      user.achievements.push(achievementId);
      await user.save();
    }
    res.json({ achievements: user.achievements });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ── Messages API ─────────────────────────────────────────────────

app.get('/messages', async (req, res) => {
  try {
    const msgs = await Message.find().sort({ timestamp: 1 }).limit(100);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

app.post('/messages', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '空訊息' });

  try {
    const newMsg = new Message({
      id: Date.now(),
      content: content.trim(),
      timestamp: new Date(),
      seed: false
    });
    await newMsg.save();
    
    // limit to 100
    const count = await Message.countDocuments();
    if (count > 100) {
      const oldest = await Message.findOne().sort({ timestamp: 1 });
      if (oldest) await Message.findByIdAndDelete(oldest._id);
    }
    res.json(newMsg);
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ── Questions API ────────────────────────────────────────────────

app.get('/questions', async (req, res) => {
  try {
    const qs = await Question.find().sort({ timestamp: 1 });
    res.json(qs);
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

app.post('/questions', authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: '權限不足' });
  }
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '空問題' });

  try {
    const newQ = new Question({
      id: Date.now(),
      content: content.trim(),
      author: req.user.username,
      timestamp: new Date(),
      answered: false
    });
    await newQ.save();
    res.json(newQ);
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

app.post('/questions/:id/answer', authMiddleware, async (req, res) => {
  const qid = Number(req.params.id);
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '空回覆' });

  try {
    const q = await Question.findOne({ id: qid });
    if (!q) return res.status(404).json({ error: '找不到問題' });
    if (q.answered) return res.status(400).json({ error: '問題已回覆過' });

    // Mark answered
    q.answered = true;
    await q.save();

    // Create a message as the answer
    const newMsg = new Message({
      id: Date.now(),
      content: `[回覆 ${q.author} 的問題] ${content.trim()}`,
      timestamp: new Date(),
      seed: false
    });
    await newMsg.save();

    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// Default fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
