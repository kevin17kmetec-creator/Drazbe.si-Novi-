const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/await userDocRef\.get\(\)/g, 'await getDoc(userDocRef)');

fs.writeFileSync('server.ts', code);
