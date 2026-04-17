const fs = require('fs');
let code = fs.readFileSync('room.js', 'utf8');

// 1. Fix P
code = code.replace('const P = 3;', 'const P = 4;');

// 2. Fix radio X
code = code.replace(/x: W \* 0\.33, y: deskTop - P \* 14,/, 'x: W * 0.23, y: deskTop - P * 14,');

// 3. Fix hitTest
code = code.replace(/for \(const obj of this\.objects\) \{/g, 'for (let i = this.objects.length - 1; i >= 0; i--) {\n      const obj = this.objects[i];');

// 4. Remove drawLabel inside draw methods
code = code.replace(/\n\s*if \(!hov && \!open\) this\.drawLabel.*?;\n/g, '\n');
code = code.replace(/\n\s*if \(hov.*this\.drawLabel.*?;/g, '');
code = code.replace(/\n\s*this\.drawLabel.*?;/g, '');

// 5. Add global label rendering to render()
const renderOld = `  render(t) {
    this.t = t;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.drawRoom(t);
    if (this.particles) this.drawParticles();

    for (const obj of this.objects) {
      const hov = this.hoverId === obj.id;
      obj.draw(ctx, obj.x, obj.y, obj.w, obj.h, t, hov);
    }
  }`;

const renderNew = `  render(t) {
    this.t = t;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.drawRoom(t);
    if (this.particles) this.drawParticles();

    let hoveredLabelParams = null;

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

    if (hoveredLabelParams) {
      this.drawLabel(ctx, ...hoveredLabelParams);
    }
  }`;

code = code.replace(renderOld, renderNew);

fs.writeFileSync('room.js', code, 'utf8');
console.log('Fixed room.js');
