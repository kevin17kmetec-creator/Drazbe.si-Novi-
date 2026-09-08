const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

if (!code.includes("import { parseAmountToCents")) {
  code = code.replace(
    /import express from "express";/g,
    "import express from \"express\";\nimport { parseAmountToCents, calculateCheckoutTotals, calculateMarginalPlatformFee } from './moneyUtils';"
  );
  fs.writeFileSync('src/server/app.ts', code);
  console.log("Added import");
} else {
  console.log("Import already exists");
}
