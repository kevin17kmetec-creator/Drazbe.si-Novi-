const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

code = code.replace(
  "amount: finalAmountEuro,\n      fee: totals.platformFeeInCents / 100,",
  "amount_total: finalAmountEuro,\n      platform_fee: totals.platformFeeInCents / 100,\n      vat_amount: totals.vatInCents / 100,\n      vat_rate: 0,\n      is_reverse_charge: false,"
);

fs.writeFileSync('src/server/app.ts', code);
