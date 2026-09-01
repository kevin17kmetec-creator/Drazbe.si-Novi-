const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const adminInit = `import { initializeApp as initAdminApp, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
`;
if (!code.includes('firebase-admin/app')) {
  code = adminInit + code;
}
fs.writeFileSync('server.ts', code);
console.log('patched server.ts admin');
