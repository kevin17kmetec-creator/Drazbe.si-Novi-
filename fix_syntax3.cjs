const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace buyerEmail with buyer.email
code = code.replace(/buyerEmail/g, "buyer.email");

// Delete the generation of cert in 1903
code = code.replace(/pdfBuffer = await generateCertificatePDF\(mockTx, buyer, seller\);/g, "pdfBuffer = invoicePdfBuffer; // Re-use invoice buffer if pdfBuffer is needed");

fs.writeFileSync('server.ts', code);
