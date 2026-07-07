const fs = require('fs');

let auth = fs.readFileSync('src/components/AuthView.tsx', 'utf8');

auth = auth.replace(/const demoLogin = \([\s\S]*?\} \/\/\s*\]/g, ''); // maybe not
fs.writeFileSync('src/components/AuthView.tsx', auth);
