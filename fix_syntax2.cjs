const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the empty block and stray brace
code = code.replace(/\} catch\(e\) \{ console\.error\('Invoice error:', e\); \}\s*\}/g, "} catch(e) { console.error('Invoice error:', e); }\n");

fs.writeFileSync('server.ts', code);
