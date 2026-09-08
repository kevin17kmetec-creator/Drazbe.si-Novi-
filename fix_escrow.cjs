const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

// In confirm-receipt
code = code.replace(
  "await sellerDocRef.update({ wallet_balance: currentBalance + Number(tx.amount_total || tx.amount) });",
  "const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);\n      await sellerDocRef.update({ wallet_balance: currentBalance + releaseAmount });"
);

// In cron job
code = code.replace(
  "await adminDb.collection('users').doc(tx.seller_id).update({\n          wallet_balance: currentBalance + Number(tx.amount_total || tx.amount)\n        });",
  "const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);\n        await adminDb.collection('users').doc(tx.seller_id).update({\n          wallet_balance: currentBalance + releaseAmount\n        });"
);

fs.writeFileSync('src/server/app.ts', code);
