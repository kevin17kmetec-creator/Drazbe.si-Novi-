const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// I also need to replace pdfBuffer in line 1903 if it was not caught by previous script.
code = code.replace(/pdfBuffer = await generateCertificatePDF/g, "pdfBuffer = invoicePdfBuffer; // Re-use invoice buffer if pdfBuffer is needed //");

fs.writeFileSync('server.ts', code);
