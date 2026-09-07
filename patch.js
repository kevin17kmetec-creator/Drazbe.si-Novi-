const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const safeGetDocCode = `
async function safeGetDoc(docRef: any) {
  try {
    return await getDoc(docRef);
  } catch (error: any) {
    console.warn("[safeGetDoc] Failed to fetch doc:", error.message);
    return { exists: () => false, data: () => null } as any;
  }
}
`;

if (!code.includes('safeGetDoc')) {
  code = code.replace("import dotenv from 'dotenv';", "import dotenv from 'dotenv';\n" + safeGetDocCode);
  code = code.replace(/await getDoc\(/g, "await safeGetDoc(");
  fs.writeFileSync('server.ts', code);
  console.log("Patched getDoc calls");
}
