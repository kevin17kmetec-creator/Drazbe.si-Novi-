const fs = require('fs');
let code = fs.readFileSync('src/server/cronProcessor.ts', 'utf8');

const safeGetDocCode = `
async function safeGetDoc(docRef: any) {
  try {
    return await getDoc(docRef);
  } catch (error: any) {
    console.warn("[safeGetDoc] Failed to fetch doc:", error.message);
    return { exists: () => false, data: () => null } as any;
  }
}
async function safeGetDocs(queryRef: any) {
  try {
    return await getDocs(queryRef);
  } catch (error: any) {
    console.warn("[safeGetDocs] Failed to fetch docs:", error.message);
    return { empty: true, docs: [] } as any;
  }
}
`;

if (!code.includes('safeGetDoc')) {
  code = code.replace("import { db } from '../lib/firebase.js';", "import { db } from '../lib/firebase.js';\n" + safeGetDocCode);
  code = code.replace(/await getDoc\(/g, "await safeGetDoc(");
  code = code.replace(/await getDocs\(/g, "await safeGetDocs(");
  fs.writeFileSync('src/server/cronProcessor.ts', code);
  console.log("Patched getDocs calls in cronProcessor");
}
