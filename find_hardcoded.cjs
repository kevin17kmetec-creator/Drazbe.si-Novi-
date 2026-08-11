const fs = require('fs');
const path = require('path');

function inspectFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    // Check for hardcoded text inside JSX like >Some Text<
    const matches = line.match(/>\s*([A-Za-zČŠŽčšž0-9.,?!'"-]{3,}[^<]*)</g);
    if (matches) {
      matches.forEach(m => {
        const text = m.replace(/^>\s*/, '').replace(/\s*<$/, '').trim();
        // Ignore numbers, simple icons, empty
        if (text && !text.startsWith('{') && !text.match(/^[\d\s€$:-]+$/)) {
          console.log(`${filePath}:${idx+1} -> "${text}"`);
        }
      });
    }
  });
}

inspectFile('App.tsx');
fs.readdirSync('src/components').forEach(f => {
  if (f.endsWith('.tsx')) inspectFile('src/components/' + f);
});
