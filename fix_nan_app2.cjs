const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

code = code.replace(/if \(isNaN\(amountInCents\) \|\| amountInCents <= 0\)/g, 'if (amountInCents <= 0)');
code = code.replace(/diagnosticInfo.computedCents = NaN;/g, 'diagnosticInfo.computedCents = 0;');

fs.writeFileSync('src/server/app.ts', code);
