const fs = require('fs');
const css = fs.readFileSync('style.css', 'utf8');
const updated = css.replace(/font-size:\s*(\d+)px/g, (m, p1) => `font-size: ${parseInt(p1) + 4}px`);
fs.writeFileSync('style.css', updated);
console.log('Done');
