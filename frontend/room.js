// room.js — HackIt Room Canvas Renderer
// Draws pixel-art room and all interactive objects

const PALETTE = {
  bg:     '#07070f',
  wall:   '#111128',
  wallLt: '#181838',
  floor:  '#0a0a18',
  floorLt:'#13132a',
  ceiling:'#0d0d22',
  amber:  '#ffc940',
  amberDk:'#7a5800',
  teal:   '#00e5cc',
  pink:   '#ff6eb4',
  purple: '#9b7fff',
  blue:   '#6680ff',
  text:   '#d4d0f0',
  dim:    '#2a2850',
  mid:    '#55527a',
  white:  '#f0eeff',
  black:  '#000000',
  paper1: '#d4cfa8',
  paper2: '#b8b49a',
  wood:   '#3a2e22',
  woodLt: '#5a4832',
  green:  '#4caf50',
  greenDk:'#2e7d32',
};

const P = 4; // Base pixel size in screen pixels

class RoomRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 0;
    this.H = 0;
    this.t = 0;
    this.hoverId = null;
    this.objects = [];
    this.doorOpenState = 0;   // 0=closed → 1=open
    this._doorAnimId  = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Keep 16:10 aspect ratio
    const ar = 16 / 10;
    let w = vw, h = vw / ar;
    if (h > vh) { h = vh; w = vh * ar; }
    this.canvas.width  = Math.floor(w / P) * P;
    this.canvas.height = Math.floor(h / P) * P;
    this.canvas.style.width  = this.canvas.width  + 'px';
    this.canvas.style.height = this.canvas.height + 'px';
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this.buildObjects();
  }

  // Object layout — all positions relative to W/H
  buildObjects() {
    const W = this.W, H = this.H;
    const floor = H * 0.68;
    const deskTop = floor - H * 0.27;

    this.objects = [
      {
        id: 'lamp',
        label: '燈泡',
        color: PALETTE.amber,
        x: W * 0.11, y: H * 0.13,
        w: P * 16, h: P * 20,
        hitPad: 12,
        draw: (ctx, x, y, w, h, t, hov) => this.drawLamp(ctx, x, y, w, h, t, hov),
      },
      {
        id: 'papers',
        label: '紙張',
        color: PALETTE.purple,
        x: W * 0.30, y: H * 0.10,
        w: W * 0.20, h: H * 0.36,
        hitPad: 6,
        draw: (ctx, x, y, w, h, t, hov) => this.drawPapers(ctx, x, y, w, h, t, hov),
      },
      {
        id: 'drawer',
        label: '工作桌',
        color: PALETTE.teal,
        x: W * 0.06, y: floor - H * 0.27,
        w: W * 0.42, h: H * 0.27,
        hitPad: 6,
        draw: (ctx, x, y, w, h, t, hov) => this.drawDrawer(ctx, x, y, w, h, t, hov),
      },
      // ── 電腦：桌上，縮小 ──
      {
        id: 'computer',
        label: '電腦',
        color: PALETTE.teal,
        x: W * 0.08, y: deskTop - H * 0.17,
        w: W * 0.10, h: H * 0.17,
        hitPad: 6,
        draw: (ctx, x, y, w, h, t, hov) => this.drawComputer(ctx, x, y, w, h, t, hov),
      },
      // ── 收音機：桌上，往左移避免跟紙張重疊 ──
      {
        id: 'radio',
        label: '收音機',
        color: PALETTE.pink,
        x: W * 0.23, y: deskTop - P * 14,
        w: P * 22,   h: P * 14,
        hitPad: 8,
        draw: (ctx, x, y, w, h, t, hov) => this.drawRadio(ctx, x, y, w, h, t, hov),
      },
      // ── 盆栽：桌上右側 ──
      {
        id: 'plant',
        label: '盆栽',
        color: PALETTE.green,
        x: W * 0.43, y: deskTop - P * 18,
        w: P * 12,   h: P * 18,
        hitPad: 6,
        draw: (ctx, x, y, w, h, t, hov) => this.drawPlant(ctx, x, y, w, h, t, hov),
      },
      // ── 門：放大，移至右下角 ──
      {
        id: 'door',
        label: '門',
        color: PALETTE.blue,
        x: W * 0.82, y: floor - H * 0.52,
        w: W * 0.12, h: H * 0.52,
        hitPad: 6,
        draw: (ctx, x, y, w, h, t, hov) => this.drawDoor(ctx, x, y, w, h, t, hov),
      },
    ];
  }

  // ── Helpers ──────────────────────────────────────────────

  px(n) { return Math.round(n / P) * P; }

  fillPx(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(this.px(x), this.px(y), this.px(w), this.px(h));
  }

  glow(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur  = blur;
  }

  noGlow(ctx) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

  // ── Background Room ──────────────────────────────────────

  drawRoom(t) {
    const ctx = this.ctx;
    const { W, H } = this;
    const floor = H * 0.68;
    const ceil  = H * 0.08;

    // Back wall
    this.fillPx(ctx, PALETTE.wall, 0, 0, W, H);

    // Ceiling strip
    this.fillPx(ctx, PALETTE.ceiling, 0, 0, W, ceil);
    this.fillPx(ctx, PALETTE.dim, 0, ceil - P, W, P); // ceiling edge

    // Left wall strip
    this.fillPx(ctx, '#0e0e24', 0, ceil, W * 0.06, floor - ceil);
    // Right wall strip
    this.fillPx(ctx, '#0e0e24', W * 0.94, ceil, W * 0.06, floor - ceil);

    // Skirting (wall → floor transition)
    this.fillPx(ctx, PALETTE.dim, 0, floor - P, W, P * 2);

    // Floor
    this.fillPx(ctx, PALETTE.floor, 0, floor + P, W, H - floor - P);

    // Floor pixel lines (perspective grid)
    ctx.globalAlpha = 0.18;
    for (let row = 1; row <= 4; row++) {
      const fy = floor + row * (H - floor) * 0.22;
      this.fillPx(ctx, PALETTE.mid, 0, fy, W, P);
    }
    ctx.globalAlpha = 1;

    // Ambient lamp glow on wall (flicker)
    const flicker = 0.7 + Math.sin(t * 2.1) * 0.15 + Math.sin(t * 7.3) * 0.06;
    const lampX = W * 0.13 + P * 8;
    const lampY = H * 0.15 + P * 20;
    const grad = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, W * 0.35);
    grad.addColorStop(0, `rgba(255,200,50,${0.06 * flicker})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Object: Lamp ─────────────────────────────────────────

  drawLamp(ctx, x, y, w, h, t, hov) {
    const flicker = 0.75 + Math.sin(t * 2.1) * 0.13 + Math.sin(t * 7.3) * 0.07;

    // Cord
    this.fillPx(ctx, '#555566', x + w/2 - P, y - P*8, P*2, P*8);

    // Shade (trapezoid via path)
    ctx.fillStyle = PALETTE.woodLt;
    ctx.beginPath();
    ctx.moveTo(this.px(x + P*2), this.px(y));
    ctx.lineTo(this.px(x + w - P*2), this.px(y));
    ctx.lineTo(this.px(x + w + P*2), this.px(y + h * 0.5));
    ctx.lineTo(this.px(x - P*2), this.px(y + h * 0.5));
    ctx.closePath();
    ctx.fill();

    // Shade darker overlay
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath();
    ctx.moveTo(this.px(x + P*3), this.px(y + P));
    ctx.lineTo(this.px(x + w - P*3), this.px(y + P));
    ctx.lineTo(this.px(x + w + P), this.px(y + h * 0.45));
    ctx.lineTo(this.px(x - P), this.px(y + h * 0.45));
    ctx.closePath();
    ctx.fill();

    // Bulb glow area
    const glowA = flicker * (hov ? 1 : 0.85);
    this.glow(ctx, PALETTE.amber, 20 * glowA);
    ctx.fillStyle = `rgba(255,200,60,${0.55 * glowA})`;
    this.fillPx(ctx, `rgba(255,200,60,${0.55 * glowA})`,
                x + P*3, y + h*0.5, w - P*6, P*3);
    this.noGlow(ctx);

    // Bulb solid pixels
    ctx.fillStyle = `rgba(255,230,120,${glowA})`;
    this.fillPx(ctx, `rgba(255,230,120,${glowA})`,
                x + P*4, y + h*0.5 + P*3, w - P*8, P*4);

    // Bottom trim
    this.fillPx(ctx, '#888888', x + P, y + h*0.5 - P, w - P*2, P*2);

    // Hover label
  }

  // ── Object: Radio ────────────────────────────────────────

  drawRadio(ctx, x, y, w, h, t, hov) {
    const blink = Math.sin(t * 4.5) > 0.5;

    // Body
    this.fillPx(ctx, '#2a2a3e', x, y, w, h);
    // Top highlight
    this.fillPx(ctx, '#38384e', x, y, w, P*2);
    // Bottom shadow
    this.fillPx(ctx, '#1a1a2a', x, y+h-P*2, w, P*2);

    // Speaker (left side)
    ctx.fillStyle = '#1a1a2a';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.fillPx(ctx, '#111120',
          x + P*2 + col*P*3, y + P*3 + row*P*3, P*2, P*2);
      }
    }

    // Dial area (right half)
    this.fillPx(ctx, '#1e1e32', x + w*0.45, y + P*2, w*0.52, h - P*4);

    // Frequency bar
    const barW = (w * 0.3) * (0.3 + 0.7 * ((Math.sin(t * 0.4) + 1) / 2));
    this.glow(ctx, PALETTE.pink, blink || hov ? 12 : 4);
    this.fillPx(ctx, PALETTE.pink, x + w*0.48, y + P*4, barW, P*2);
    this.noGlow(ctx);

    // Power LED
    const ledColor = blink ? PALETTE.pink : '#661133';
    this.glow(ctx, ledColor, blink ? 8 : 2);
    this.fillPx(ctx, ledColor, x + w - P*4, y + P*3, P*3, P*3);
    this.noGlow(ctx);

    // Antenna
    this.fillPx(ctx, '#888899', x + w - P*4, y - P*8, P*2, P*8);

    // Knob
    this.fillPx(ctx, '#666677', x + w*0.7, y + P*6, P*4, P*4);
    this.fillPx(ctx, '#aaaacc', x + w*0.7 + P, y + P*6 + P, P*2, P*2);
  }

  // ── Object: Papers (Bulletin Board on Wall) ─────────

  drawPapers(ctx, x, y, w, h, t, hov) {
    // Wooden frame
    this.fillPx(ctx, '#4a2e10', x - P*3, y - P*3, w + P*6, h + P*6);
    this.fillPx(ctx, '#6a4820', x - P*2, y - P*2, w + P*4, h + P*4);
    // Cork board
    this.fillPx(ctx, '#8b6520', x, y, w, h);
    // Cork texture
    ctx.globalAlpha = 0.14;
    for (let ci = 0; ci < 6; ci++) {
      for (let cj = 0; cj < 9; cj++) {
        ctx.fillStyle = cj % 2 === 0 ? '#aa8030' : '#6b4e10';
        ctx.fillRect(this.px(x + ci*(w/6)), this.px(y + cj*(h/9)), this.px(P*2), this.px(P*2));
      }
    }
    ctx.globalAlpha = 1;

    // Papers pinned to board
    const sheets = [
      { dx: w*0.04, dy: h*0.05, pw: w*0.55, ph: h*0.32, rot: -0.07 },
      { dx: w*0.38, dy: h*0.08, pw: w*0.56, ph: h*0.28, rot:  0.05 },
      { dx: w*0.06, dy: h*0.44, pw: w*0.48, ph: h*0.34, rot:  0.08 },
      { dx: w*0.46, dy: h*0.46, pw: w*0.50, ph: h*0.32, rot: -0.04 },
    ];
    const paperCols = ['#ece8d0','#ddd9c0','#e8e4cc','#d4d0b8'];
    const tackCols  = ['#cc3333','#ddaa00','#3366cc','#33aa55'];

    sheets.forEach((s, i) => {
      const wobble = Math.sin(t * 0.35 + i * 1.7) * 0.008;
      const cx = x + s.dx + s.pw/2, cy = y + s.dy + s.ph/2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.rot + wobble);
      ctx.translate(-cx, -cy);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(this.px(x+s.dx+P*2), this.px(y+s.dy+P*2), this.px(s.pw), this.px(s.ph));
      // Paper
      this.fillPx(ctx, paperCols[i], x+s.dx, y+s.dy, s.pw, s.ph);
      // Text lines
      ctx.fillStyle = '#888870';
      const lines = Math.floor(s.ph / (P*5));
      for (let l = 0; l < lines; l++) {
        const lw = s.pw * (0.6 + Math.sin(i*4+l*3)*0.28);
        ctx.fillRect(this.px(x+s.dx+P*3), this.px(y+s.dy+P*5+l*P*5), this.px(lw-P*5), this.px(P*1.5));
      }
      // Thumbtack
      this.glow(ctx, tackCols[i], hov ? 8 : 3);
      this.fillPx(ctx, tackCols[i], x+s.dx+s.pw/2-P, y+s.dy+P, P*2, P*2);
      this.noGlow(ctx);
      ctx.restore();
    });

    if (hov) {
      this.glow(ctx, PALETTE.purple, 16);
      ctx.strokeStyle = PALETTE.purple;
      ctx.lineWidth = P * 1.5;
      ctx.strokeRect(this.px(x-P*2), this.px(y-P*2), this.px(w+P*4), this.px(h+P*4));
      this.noGlow(ctx);
    }
  }

  // ── Object: Door (with open animation) ──────────

  drawDoor(ctx, x, y, w, h, t, hov) {
    const open    = this.doorOpenState;          // 0–1 eased
    const shimmer = (Math.sin(t * 1.8) + 1) / 2;
    const gapW    = w * open * 0.32;            // visible gap width

    // Draw frame first (always)
    this.fillPx(ctx, '#1a1838', x - P*2, y - P*2, w + P*4, h + P*4);

    if (open > 0.01) {
      // ── Light spilling through the gap ──
      const grad = ctx.createLinearGradient(x, y, x + gapW * 2.5, y);
      grad.addColorStop(0,   `rgba(220,215,255,${open * 0.95})`);
      grad.addColorStop(0.3, `rgba(140,120,255,${open * 0.55})`);
      grad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(this.px(x), this.px(y), this.px(gapW * 2.5), this.px(h));

      // Shadow cast by door edge
      ctx.fillStyle = `rgba(0,0,0,${open * 0.6})`;
      ctx.fillRect(this.px(x + gapW), this.px(y), this.px(P*3), this.px(h));

      // Floating dust motes in the light
      ctx.globalAlpha = open * 0.5;
      for (let m = 0; m < 4; m++) {
        const mx = x + gapW * (0.1 + Math.sin(t*0.7 + m*2.1) * 0.4);
        const my = y + h * (0.2 + m * 0.18 + Math.sin(t*1.1 + m) * 0.05);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.px(mx), this.px(my), this.px(P), this.px(P));
      }
      ctx.globalAlpha = 1;
    }

    // ── Door body (shifts right as it opens) ──
    const doorX = x + gapW;
    const doorW = w * (1 - open * 0.22); // slight perspective compress

    // Door body
    this.fillPx(ctx, '#151530', doorX, y, doorW, h);
    // Panels
    this.fillPx(ctx, '#1a1845', doorX + P*2, y + P*2, doorW - P*4, h*0.42);
    this.fillPx(ctx, '#1a1845', doorX + P*2, y + h*0.52, doorW - P*4, h*0.44);
    // Panel highlights
    this.fillPx(ctx, '#22204a', doorX + P*3, y + P*3, doorW - P*6, P);
    this.fillPx(ctx, '#22204a', doorX + P*3, y + h*0.53, doorW - P*6, P);
    // Knob
    this.fillPx(ctx, '#888', doorX + doorW - P*5, y + h*0.52, P*4, P*4);
    this.fillPx(ctx, '#ccc', doorX + doorW - P*4, y + h*0.52+P, P*2, P*2);
    // Edge glow
    const glowA = shimmer * ((hov || open > 0) ? 0.55 : 0.28);
    this.glow(ctx, PALETTE.blue, 14 * (1 + open * 0.5));
    this.fillPx(ctx, `rgba(102,128,255,${glowA})`,     doorX, y, P*2, h);
    this.fillPx(ctx, `rgba(102,128,255,${glowA*0.7})`, doorX+doorW-P*2, y, P*2, h);
    this.fillPx(ctx, `rgba(102,128,255,${glowA*0.5})`, doorX, y, doorW, P*2);
    this.noGlow(ctx);
    if (open > 0.3) this.drawLabel(ctx, x + w/2, y - P*10, '…', PALETTE.blue);
  }

  openDoor() {
    if (this._doorAnimId) return;
    const OPEN_MS  = 700;
    const HOLD_MS  = 2200;
    const CLOSE_MS = 500;
    let start = null;
    const ease = x => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2, 3) / 2;
    const tick = (ts) => {
      if (!start) start = ts;
      const e = ts - start;
      if (e < OPEN_MS) {
        this.doorOpenState = ease(e / OPEN_MS);
      } else if (e < OPEN_MS + HOLD_MS) {
        this.doorOpenState = 1;
      } else {
        const t2 = e - OPEN_MS - HOLD_MS;
        this.doorOpenState = ease(1 - Math.min(t2 / CLOSE_MS, 1));
        if (t2 >= CLOSE_MS) { this.doorOpenState = 0; this._doorAnimId = null; return; }
      }
      this._doorAnimId = requestAnimationFrame(tick);
    };
    this._doorAnimId = requestAnimationFrame(tick);
  }

  // ── Object: Drawer (Large Workbench) ───────────────

  drawDrawer(ctx, x, y, w, h, t, hov) {
    const deskH = h * 0.16;
    const cabH  = h - deskH;

    // Cabinet body
    this.fillPx(ctx, PALETTE.wood, x, y + deskH, w, cabH);
    // Wood grain
    ctx.globalAlpha = 0.10;
    for (let g = 0; g < 4; g++) {
      this.fillPx(ctx, '#ffffff', x+P*2, y+deskH+P*4+g*(cabH/4), w-P*4, P);
    }
    ctx.globalAlpha = 1;

    // 4 drawer fronts
    const n = 4;
    const dw = (w - P*(n+1)) / n;
    for (let d = 0; d < n; d++) {
      const dx = x + P + d*(dw + P);
      const dy = y + deskH + P*2;
      const dh = cabH - P*4;
      this.fillPx(ctx, PALETTE.woodLt, dx, dy, dw, dh);
      // Horizontal divide
      this.fillPx(ctx, PALETTE.wood, dx, dy + dh*0.5 - P*0.5, dw, P);
      // Top handle
      this.fillPx(ctx, '#bbbbbb', dx+dw/2-P*3, dy+dh*0.25-P, P*6, P*2);
      // Bottom handle
      this.fillPx(ctx, '#bbbbbb', dx+dw/2-P*3, dy+dh*0.75-P, P*6, P*2);
    }

    // Desk surface
    this.fillPx(ctx, '#503820', x, y, w, deskH);
    this.fillPx(ctx, '#6a4e28', x, y, w, P*2); // highlight

    // Items on desk: notebook
    this.fillPx(ctx, '#1e2e3c', x+w*0.08, y+P*2, P*16, deskH-P*3);
    this.fillPx(ctx, '#263646', x+w*0.08+P, y+P*3, P*14, P*2);
    // Pen
    this.fillPx(ctx, '#bb4433', x+w*0.30, y+P*2, P*2, deskH-P*3);
    // Coffee mug
    this.fillPx(ctx, '#445566', x+w*0.88, y-P*4, P*7, P*6);
    this.fillPx(ctx, '#566677', x+w*0.88+P, y-P*4+P, P*5, P*2);

    if (hov) {
      this.glow(ctx, PALETTE.teal, 24);
      ctx.strokeStyle = PALETTE.teal;
      ctx.lineWidth = P * 1.5;
      ctx.strokeRect(this.px(x), this.px(y), this.px(w), this.px(h));
      this.noGlow(ctx);
    }
  }

  // ── Object: Computer (CRT Terminal) ───────────────

  drawComputer(ctx, x, y, w, h, t, hov) {
    const monH = h * 0.68;
    const scX  = x + w*0.07, scY = y + monH*0.10;
    const scW  = w * 0.86,   scH = monH * 0.72;

    // Monitor outer casing
    this.fillPx(ctx, '#b8b2a0', x, y, w, monH);
    this.fillPx(ctx, '#ccc6b4', x, y, w, P*2);
    this.fillPx(ctx, '#8a8478', x, y+monH-P*2, w, P*2);

    // Screen bezel
    this.fillPx(ctx, '#7a7470', scX-P*2, scY-P*2, scW+P*4, scH+P*4);
    // Screen
    this.fillPx(ctx, '#010804', scX, scY, scW, scH);

    // Scanline overlay
    ctx.globalAlpha = 0.07;
    for (let sl = 0; sl < scH/P/2; sl++) {
      this.fillPx(ctx, '#ffffff', scX, scY+sl*P*2, scW, P);
    }
    ctx.globalAlpha = 1;

    // Blurry neon green block
    const pulse = 0.8 + Math.sin(t * 3) * 0.2;
    this.glow(ctx, '#00ff60', hov ? 25 : 15);
    this.fillPx(ctx, `rgba(0, 255, 96, ${0.35 * pulse})`, scX + P*2, scY + P*2, scW - P*4, scH - P*4);
    
    // Cursor blink
    if (Math.floor(t * 2) % 2 === 0) {
      this.fillPx(ctx, '#00ff60', scX+P*2, scY+scH-P*6, P*5, P*3);
    }
    this.noGlow(ctx);

    // Power LED
    const ledOn = Math.sin(t * 0.9) > -0.3;
    this.glow(ctx, '#00ff60', ledOn ? 6 : 1);
    this.fillPx(ctx, ledOn ? '#00ff60' : '#003810', x+w-P*5, y+monH-P*5, P*3, P*3);
    this.noGlow(ctx);

    // Stand
    this.fillPx(ctx, '#a09a90', x+w*0.36, y+monH, w*0.28, P*4);
    this.fillPx(ctx, '#888278', x+w*0.28, y+monH+P*3, w*0.44, P*2);

    // Keyboard
    const kbY = y + monH + P*6;
    const kbH = h * 0.18;
    this.fillPx(ctx, '#b8b2a0', x+P*2, kbY, w-P*4, kbH);
    this.fillPx(ctx, '#ccc6b4', x+P*2, kbY, w-P*4, P*2);
    // Key rows
    ctx.fillStyle = '#8a8478';
    for (let kr = 0; kr < 3; kr++) {
      for (let kc = 0; kc < 7; kc++) {
        const kw = (w-P*10)/7;
        ctx.fillRect(this.px(x+P*5+kc*(kw+P)), this.px(kbY+P*3+kr*P*3.5), this.px(kw), this.px(P*2.5));
      }
    }

    if (hov) {
      this.glow(ctx, PALETTE.teal, 20);
      ctx.strokeStyle = PALETTE.teal;
      ctx.lineWidth = P * 1.5;
      ctx.strokeRect(this.px(x-P), this.px(y-P), this.px(w+P*2), this.px(h+P*2));
      this.noGlow(ctx);
    }
  }

  // ── Plant ────────────────────────────────────────────────

  drawPlant(ctx, x, y, w, h, t, hov) {
    // Pot
    const potY = y + h - P*6;
    this.fillPx(ctx, '#7a5230', x + P*2, potY, w - P*4, P*6);
    this.fillPx(ctx, '#5a3a20', x + P*2, potY, P*2, P*6); // shadow
    this.fillPx(ctx, '#8b6038', x + P, potY - P*2, w - P*2, P*2); // rim
    
    // Dirt
    this.fillPx(ctx, '#3d2616', x + P*3, potY - P, w - P*6, P);

    // Leaves (animate slightly with t)
    const sway = Math.sin(t * 1.5) * P;
    
    // Main stem
    this.fillPx(ctx, PALETTE.greenDk, x + w/2 - P/2, y + P*4, P, h - P*10);
    
    // Left leaf
    this.fillPx(ctx, PALETTE.green, x + P, y + P*6 + sway, P*4, P*3);
    this.fillPx(ctx, PALETTE.greenDk, x + P*3, y + P*7 + sway, P*2, P);
    
    // Right leaf
    this.fillPx(ctx, PALETTE.green, x + w - P*5, y + P*4 - sway, P*4, P*3);
    this.fillPx(ctx, PALETTE.greenDk, x + w - P*3, y + P*5 - sway, P*2, P);
    
    // Top leaf
    this.fillPx(ctx, '#66bb6a', x + w/2 - P*1.5 + sway*0.5, y + P, P*3, P*3);

    if (hov) {
      this.glow(ctx, PALETTE.green, 20);
      ctx.strokeStyle = PALETTE.green;
      ctx.lineWidth = P * 1.5;
      ctx.strokeRect(this.px(x-P), this.px(y-P), this.px(w+P*2), this.px(h+P*2));
      this.noGlow(ctx);
    }
  }

  // ── Label ────────────────────────────────────────────────

  drawLabel(ctx, cx, y, text, color) {
    ctx.font = `${P * 3}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    this.glow(ctx, color, 10);
    ctx.fillText(text, this.px(cx), this.px(y));
    this.noGlow(ctx);
    ctx.textAlign = 'left';
  }

  // ── Particles ────────────────────────────────────────────

  initParticles() {
    this.particles = Array.from({ length: 20 }, () => this.newParticle());
  }

  newParticle() {
    return {
      x: Math.random() * this.W,
      y: Math.random() * this.H * 0.8,
      vy: -(0.2 + Math.random() * 0.4),
      vx: (Math.random() - 0.5) * 0.3,
      life: Math.random(),
      maxLife: 0.4 + Math.random() * 0.6,
      size: P * (0.5 + Math.random()),
    };
  }

  drawParticles() {
    const ctx = this.ctx;
    this.particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.002;
      if (p.life <= 0) this.particles[i] = this.newParticle();
      const a = Math.min(p.life / p.maxLife, 1) * 0.35;
      ctx.fillStyle = `rgba(200,195,240,${a})`;
      ctx.fillRect(this.px(p.x), this.px(p.y), this.px(p.size), this.px(p.size));
    });
  }

  // ── Hit testing ─────────────────────────────────────────

  hitTest(mx, my) {
    // Convert from CSS px to canvas px (same since no scale transform here)
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.W / rect.width;
    const scaleY = this.H / rect.height;
    const cx = (mx - rect.left) * scaleX;
    const cy = (my - rect.top)  * scaleY;

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const pad = obj.hitPad * P;
      if (cx >= obj.x - pad && cx <= obj.x + obj.w + pad &&
          cy >= obj.y - pad && cy <= obj.y + obj.h + pad) {
        return obj.id;
      }
    }
    return null;
  }

  // ── Main render ─────────────────────────────────────────

  render(t) {
    this.t = t;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.drawRoom(t);
    if (this.particles) this.drawParticles();

    let hoveredLabelParams = null;

    // Draw all objects (bottom to top, so normal order)
    for (const obj of this.objects) {
      const hov = this.hoverId === obj.id;
      obj.draw(ctx, obj.x, obj.y, obj.w, obj.h, t, hov);
      
      if (hov) {
        let labelText = obj.label;
        if (obj.id === 'door') {
          if (this.doorOpenState > 0.3) labelText = '…';
          else if (this.doorOpenState > 0.05) labelText = null;
        }
        if (labelText) {
          hoveredLabelParams = [obj.x + obj.w / 2, obj.y - P * 10, labelText, obj.color];
        }
      }
    }

    // Draw the label last so it is on top of everything
    if (hoveredLabelParams) {
      this.drawLabel(ctx, ...hoveredLabelParams);
    }
  }
}
