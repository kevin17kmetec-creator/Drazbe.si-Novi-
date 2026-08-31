const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix missing publicUrl around line 418
code = code.replace(/await uploadBytes\(fileRef, invoicePdfBuffer\);\s+documentsToInsert/g, "await uploadBytes(fileRef, invoicePdfBuffer);\n            const publicUrl = await getDownloadURL(fileRef);\n            documentsToInsert");

fs.writeFileSync('server.ts', code);
