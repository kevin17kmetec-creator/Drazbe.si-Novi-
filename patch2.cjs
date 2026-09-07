const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const safeGetDocsCode = `
async function safeGetDocs(queryRef: any) {
  try {
    return await getDocs(queryRef);
  } catch (error: any) {
    console.warn("[safeGetDocs] Failed to fetch docs:", error.message);
    return { empty: true, docs: [] } as any;
  }
}
`;

if (!code.includes('safeGetDocs')) {
  code = code.replace("import dotenv from 'dotenv';", "import dotenv from 'dotenv';\n" + safeGetDocsCode);
  code = code.replace(/await getDocs\(/g, "await safeGetDocs(");
  fs.writeFileSync('server.ts', code);
  console.log("Patched getDocs calls");
}
