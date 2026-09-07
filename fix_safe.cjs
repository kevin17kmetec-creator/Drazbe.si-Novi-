const fs = require('fs');

function fixInfiniteLoop(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes("return await safeGetDoc(docRef);")) {
    content = content.replace(/return await safeGetDoc\(docRef\);/g, "return await getDoc(docRef);");
    changed = true;
  }
  if (content.includes("return await safeGetDocs(queryRef);")) {
    content = content.replace(/return await safeGetDocs\(queryRef\);/g, "return await getDocs(queryRef);");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed infinite loop in ${filePath}`);
  }
}

['server.ts', 'src/server/cronProcessor.ts'].forEach(fixInfiniteLoop);
