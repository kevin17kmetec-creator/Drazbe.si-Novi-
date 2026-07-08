const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/consecutiveErrorsRef\.current\+\+;/g, '');
code = code.replace(/if \(consecutiveErrorsRef\.current >= 5\) \{[\s\S]*?return;\s*\n\s*\}/g, '');
code = code.replace(/if \(!isMounted \|\| consecutiveErrorsRef\.current >= 5\) return;/g, 'if (!isMounted) return;');

fs.writeFileSync('App.tsx', code);
