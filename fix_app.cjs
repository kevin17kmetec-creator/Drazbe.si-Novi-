const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

// 1. Add moneyUtils import
if (!code.includes("import { parseAmountToCents, calculateCheckoutTotals }")) {
  code = code.replace("import express from 'express';", "import express from 'express';\nimport { parseAmountToCents, calculateCheckoutTotals } from './moneyUtils';");
}

fs.writeFileSync('src/server/app.ts', code);
