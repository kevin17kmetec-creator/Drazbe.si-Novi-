const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
code = code.replace(/import\("\.\/src\/lib\/firebase-admin"\)/g, 'import("./src/lib/firebase")');
fs.writeFileSync('App.tsx', code);
