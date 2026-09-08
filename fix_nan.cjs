const fs = require('fs');
let code = fs.readFileSync('src/server/moneyUtils.ts', 'utf8');

code = code.replace(/return NaN;/g, 'return 0;');
code = code.replace(/let parsed = NaN;/g, 'let parsed = 0;');

fs.writeFileSync('src/server/moneyUtils.ts', code);
