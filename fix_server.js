const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace all usages of certPdfBuffer, certBuffer, and generateCertificatePDF
code = code.replace(/import \{ generateInvoicePDF, generateCertificatePDF \} from '.\/src\/lib\/pdfGenerator.js';/g, "import { generateInvoicePDF } from './src/lib/pdfGenerator.js';");
code = code.replace(/const certPdfBuffer = await generateCertificatePDF\(.*?\);/g, "");
code = code.replace(/const certBuffer = await generateCertificatePDF\(.*?\);/g, "");

// Remove the push of certPdfBuffer in the first place
code = code.replace(/attachments\.push\(\{\s*filename:\s*certFileName,\s*content:\s*certPdfBuffer\s*\}\);/g, "");
// Remove the push in the second place
code = code.replace(/,\s*\{\s*filename: \`potrdilo_\$\{mockTransaction\.id\}\.pdf\`, content: certBuffer\s*\}/g, "");
code = code.replace(/,\s*\{\s*filename: \`potrdilo_\$\{transaction\.id\}\.pdf\`, content: certPdfBuffer\s*\}/g, "");

fs.writeFileSync('server.ts', code);
