# HackIt Room

> 一個讓人短暫離開既有思考框架的空間。  
> 一個讓想法可以留下並影響世界的場域。

---

## 快速啟動

```bash
# 安裝後端依賴
cd backend
npm install

# 啟動伺服器（前後端同一入口）
node server.js

# 開啟瀏覽器
# → http://localhost:3001
```

---

## 文案更改指引

以下說明所有可以不動程式邏輯、只改文字就能客製化的地方。

---

### 1. 物件對話文案

**檔案**：`frontend/main.js`  
**位置**：頂部的 `OBJECT_META` 物件

每個可點擊物件都有自己的敘事文字池，點擊時隨機抽取一則顯示。

```js
const OBJECT_META = {

  lamp: {
    label: '燈泡',              // ← HUD 顯示名稱
    narratives: [
      '它閃爍的頻率，比你的心跳快一點。',   // ← 點擊後顯示的文字
      '有人曾說，燈熄了世界才開始。',        // ← 可新增／刪除任意行
      '光打在牆上的影子從未停在同一個地方。',
      '...照不到的地方，才是真正的地圖。',
    ],
  },

  door: {
    label: '門',
    narratives: [
      '這扇門目前無法打開。\n\n或者說，時機還沒到。',  // ← \n 換行
      '門縫裡透出的光，顏色每次都不一樣。',
      '有人曾站在這裡很久，最後還是走了。',
      '...裡面的聲音說：「等一下」。\n那是三年前的事了。',
    ],
  },

  // radio 和 papers 會從後端拉取使用者留下的訊息顯示
  // fallback 是後端離線時的備用文字
  radio: {
    label: '收音機',
    fallback: [
      '截獲訊號中... [雜訊]',
      '頻率：XX.X MHz ——「你有沒有想過——」[斷訊]',
      // ...
    ],
  },

  papers: {
    label: '紙張',
    fallback: [
      '這張紙上本來有字，但已經消失了。',
      // ...
    ],
  },

};
```

> **提示**：`radio` 和 `papers` 會優先顯示使用者儲存的留言。`fallback` 只在沒有任何留言時使用。

---

### 2. 電腦終端機指令回應

**檔案**：`frontend/main.js`  
**位置**：`processCommand()` 函式

點擊電腦後打開終端機，使用者可以輸入指令。修改各指令的回應文字：

```js
function processCommand(raw) {
  const lo = cmd.toLowerCase();

  if (lo === 'whoami') {
    appendTermLine('unknown_visitor', '#ffc940', 80);
    appendTermLine('但你在這裡。這已經足夠。', '#d4f0cc', 200);  // ← 改這裡
  }

  if (lo === 'help') {
    // 修改指令說明清單
    const cmds = [
      ['ls',           '列出記憶碎片'],      // ← [指令, 說明]
      ['cat <id>',     '讀取內容'],
      ['whoami',       '查詢身份'],
      ['hack into it', '███████'],           // 彩蛋提示，保持神秘 :)
    ];
  }
}
```

**彩蛋觸發字串**（預設為 `hack into it`）：

```js
if (lo === 'hack into it') {   // ← 修改這裡換成其他密語
  appendTermLine('入侵成功。歡迎回家。', '#ffffff', 500);   // ← 修改回應文字
  setTimeout(() => triggerFireworks(), 650);
}
```

---

### 3. 開機載入畫面文字

**檔案**：`frontend/main.js`  
**位置**：`boot()` 函式

```js
async function boot() {
  const hints = [
    '初始化空間...',     // ← 載入進度 25% 時顯示
    '載入記憶碎片...',   // ← 載入進度 50% 時顯示
    '校準頻率...',       // ← 載入進度 75% 時顯示
    '準備就緒。',        // ← 載入完成時顯示
  ];
```

**載入畫面大標題**（修改 `index.html`）：

```html
<!-- frontend/index.html 第 19 行 -->
<div id="loader-title">HACKIT ROOM</div>   <!-- ← 改這裡 -->
```

---

### 4. 抽屜（工作桌）輸入提示文字

**檔案**：`frontend/index.html`

```html
<div id="input-title">留下你的想法</div>              <!-- ← 標題 -->
<div id="input-sub">不評分・不強制・只是留下</div>     <!-- ← 副標 -->
<textarea placeholder="在這裡輸入..."></textarea>      <!-- ← 輸入框提示 -->
<div id="submit-feedback">已記下。</div>               <!-- ← 送出後的回饋文字 -->
```

---

### 5. 種子訊息（預設留言內容）

**檔案**：`backend/server.js`  
**位置**：`SEED_MESSAGES` 陣列

這些是系統預設放進資料庫的「世界觀文字」，使用者還沒留言時，紙張和收音機會顯示這些內容：

```js
const SEED_MESSAGES = [
  { id: 1, content: '有人曾在這裡想到一個點子，但沒有說出來。', ... },
  { id: 2, content: '也許門的另一邊什麼都沒有。也許有。', ... },
  // ↑ 修改 content 欄位即可，保持 id 唯一
  // ↓ 可新增更多條目
  { id: 13, content: '你的新文字。', timestamp: '2025-01-01T00:00:00Z', seed: true },
];
```

> **注意**：如果 `backend/data/messages.json` 已存在（曾有人留過言），種子資料不會自動覆蓋。  
> 若要重置，刪除 `backend/data/messages.json` 後重啟伺服器即可。

---

### 6. 頁面 SEO 與標題

**檔案**：`frontend/index.html`

```html
<title>HackIt Room</title>
<meta name="description" content="一個讓你開始亂想的空間。" />
```

---

### 7. HUD（畫面左上角）文字

**檔案**：`frontend/index.html`

```html
<span id="hud-title">HACKIT ROOM</span>    <!-- ← 左上角標題 -->
<span id="hud-hint">點擊物件探索</span>     <!-- ← 右上角提示（hover 物件時自動更新） -->
```

---

## 物件位置微調

**檔案**：`frontend/room.js`  
**位置**：`buildObjects()` 函式

所有物件座標以比例表示（`W` = 畫布寬度，`H` = 畫布高度）：

```js
buildObjects() {
  const W = this.W, H = this.H;
  const floor   = H * 0.68;     // 地板線高度（0 = 畫面頂部，1 = 底部）
  const deskTop = floor - H * 0.27;  // 工作桌桌面高度

  this.objects = [
    {
      id: 'lamp',
      x: W * 0.11,   // ← 水平位置（0 = 左，1 = 右）
      y: H * 0.13,   // ← 垂直位置（0 = 上，1 = 下）
      w: P * 16,     // ← 寬度（P = 3px，像素單位）
      h: P * 20,     // ← 高度
    },
    // ...
  ];
}
```

---

## 顏色主題

**檔案**：`frontend/room.js`  
**位置**：頂部 `PALETTE` 物件

```js
const PALETTE = {
  amber:  '#ffc940',   // 燈泡、暖色調
  teal:   '#00e5cc',   // 電腦、工作桌
  pink:   '#ff6eb4',   // 收音機
  purple: '#9b7fff',   // 紙張
  blue:   '#6680ff',   // 門
  // ...
};
```

UI 顏色（對話框、終端機）則在 `frontend/style.css` 的 `:root` 區塊修改：

```css
:root {
  --bg:     #07070f;   /* 背景色 */
  --teal:   #00e5cc;   /* 主強調色 */
  --amber:  #ffc940;   /* 暖色強調 */
  --text:   #d4d0f0;   /* 主文字色 */
}
```

---

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/messages` | 隨機取得最多 8 筆使用者留言 |
| `POST` | `/messages` | 新增一筆留言（body: `{ content: "..." }`）|

留言上限 200 字，儲存於 `backend/data/messages.json`。

---

## 專案結構

```
hackit-room/
├── frontend/
│   ├── index.html     # HTML 骨架、DOM 元素
│   ├── style.css      # 所有樣式、動畫、像素風設計系統
│   ├── room.js        # Canvas 房間渲染（物件繪圖、動畫）
│   └── main.js        # 互動邏輯（對話、終端機、煙火彩蛋、音效）
└── backend/
    ├── server.js      # Express API + 靜態檔案服務
    ├── package.json
    └── data/
        └── messages.json   # 使用者留言資料庫（自動生成）
```

---

*HackIt Room — 設計一個環境，讓人開始「亂想」。*