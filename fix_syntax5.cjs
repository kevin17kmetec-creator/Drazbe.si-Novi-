const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// I need to change pdfBuffer = invoicePdfBuffer to something valid like pdfBuffer = Buffer.from('');
code = code.replace(/pdfBuffer = invoicePdfBuffer; \/\/ Re-use invoice buffer if pdfBuffer is needed \/\//g, "pdfBuffer = Buffer.from('');");
code = code.replace(/pdfBuffer = invoicePdfBuffer; \/\/ Re-use invoice buffer if pdfBuffer is needed/g, "pdfBuffer = Buffer.from('');");

fs.writeFileSync('server.ts', code);
