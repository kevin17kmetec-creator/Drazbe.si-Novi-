const fs = require('fs');

let code = fs.readFileSync('App.tsx', 'utf8');

// I will remove the stray `});` around the Demo comment.
code = code.replace(/\/\/ If it's a demo login \(no session\), we need to set a fake user ID\s*\n\s*\}\);\n/g, '');

fs.writeFileSync('App.tsx', code);
