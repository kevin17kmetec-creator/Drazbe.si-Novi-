const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Replace consecutiveErrorsRef usages
code = code.replace(/        consecutiveErrorsRef\.current\+\+;[\s\S]*?setIsPollingStopped\(true\);\s*\n\s*\}/g, '');

code = code.replace(/      consecutiveErrorsRef\.current = 0;\s*\n/g, '');

code = code.replace(/      if \(!isMounted \|\| consecutiveErrorsRef\.current >= 5\) return;/g, '      if (!isMounted) return;');

code = code.replace(/              if \(consecutiveErrorsRef\.current < 5\) fetchAuctions\(\);/g, '              fetchAuctions();');

fs.writeFileSync('App.tsx', code);
