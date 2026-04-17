const fs = require('fs');

global.window = { innerWidth: 1000, innerHeight: 1000, addEventListener: () => {} };
global.document = {};

class MockCtx {
  clearRect() {} fillRect() {} beginPath() {} moveTo() {} lineTo() {} closePath() {} fill() {} fillText() {} strokeRect() {}
  measureText() { return { width: 10 }; }
}

global.mockCanvas = {
  getContext: () => new MockCtx(),
  style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
};

const code = fs.readFileSync('room.js', 'utf8') + `
  const r = new RoomRenderer(mockCanvas);
  r.initParticles();
  for(let i=0; i<10; i++) r.render(i*0.1);
  console.log("SUCCESS");
`;

eval(code);
