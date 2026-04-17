const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Seed data — pre-loaded narrative fragments
const SEED_MESSAGES = [
  { id: 1, content: "有人曾在這裡想到一個點子，但沒有說出來。", timestamp: "2025-01-01T00:00:00Z", seed: true },
  { id: 2, content: "也許門的另一邊什麼都沒有。也許有。", timestamp: "2025-01-01T01:00:00Z", seed: true },
  { id: 3, content: "收音機接收的，不一定是廣播。", timestamp: "2025-01-01T02:00:00Z", seed: true },
  { id: 4, content: "這張紙上本來有字，但你看不到。", timestamp: "2025-01-01T03:00:00Z", seed: true },
  { id: 5, content: "燈泡閃爍的頻率，像摩斯密碼。", timestamp: "2025-01-01T04:00:00Z", seed: true },
  { id: 6, content: "有人把一個未完成的問題放在這裡。", timestamp: "2025-01-01T05:00:00Z", seed: true },
  { id: 7, content: "如果你不做任何事，這個空間還是會改變。", timestamp: "2025-01-01T06:00:00Z", seed: true },
  { id: 8, content: "不是所有的想法都需要被完成。", timestamp: "2025-01-01T07:00:00Z", seed: true },
  { id: 9, content: "這裡的時間和外面不一樣。", timestamp: "2025-01-01T08:00:00Z", seed: true },
  { id: 10, content: "你剛才想到什麼了嗎？", timestamp: "2025-01-01T09:00:00Z", seed: true },
  { id: 11, content: "...訊號斷了。請稍後再試。", timestamp: "2025-01-01T10:00:00Z", seed: true },
  { id: 12, content: "有個聲音說：這不重要。但我覺得它重要。", timestamp: "2025-01-01T11:00:00Z", seed: true },
];

function readMessages() {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(SEED_MESSAGES, null, 2));
      return SEED_MESSAGES;
    }
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch {
    return SEED_MESSAGES;
  }
}

function writeMessages(data) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2));
}

// GET /messages — return random selection
app.get('/messages', (req, res) => {
  const data = readMessages();
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  res.json(shuffled.slice(0, 8));
});

// POST /messages — save user input
app.post('/messages', (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: '內容不能為空' });
  }
  const data = readMessages();
  const newMsg = {
    id: Date.now(),
    content: content.trim().slice(0, 200),
    timestamp: new Date().toISOString(),
    seed: false
  };
  data.push(newMsg);
  writeMessages(data);
  res.json({ success: true, message: newMsg });
});

app.listen(PORT, () => {
  console.log(`HackIt Room API → http://localhost:${PORT}`);
});
