const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const admin = require\('firebase-admin'\);\s*if \(!admin\.apps\.length\) \{\s*admin\.initializeApp\(\{ credential: admin\.credential\.applicationDefault\(\) \}\);\s*\}\s*const db = admin\.firestore\(\);/g, '');

fs.writeFileSync('server.ts', code);
