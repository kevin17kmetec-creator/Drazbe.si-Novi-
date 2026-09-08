import * as fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

code = code.replace(/admin\.firestore\.FieldValue/g, 'FieldValue');

fs.writeFileSync('src/server/app.ts', code);
