const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

// Replace isNaN checks with <= 0 checks
code = code.replace(/let authoritativePriceInCents = NaN;/g, 'let authoritativePriceInCents = 0;');
code = code.replace(/let finalAmountCents = NaN;/g, 'let finalAmountCents = 0;');
code = code.replace(/if \(isNaN\(authoritativePriceInCents\)\)/g, 'if (authoritativePriceInCents <= 0)');
code = code.replace(/if \(isNaN\(finalAmountCents\)\)/g, 'if (finalAmountCents <= 0)');
code = code.replace(/if \(isNaN\(finalAmountCents\) \|\| \!isFinite\(finalAmountCents\) \|\| finalAmountCents <= 0\)/g, 'if (finalAmountCents <= 0)');

fs.writeFileSync('src/server/app.ts', code);
