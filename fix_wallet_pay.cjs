const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /await db\.collection\('auctions'\)\.doc\(auction_id\)\.update\(\{ status: 'completed', payment_status: 'paid', paid_at: new Date\(\)\.toISOString\(\) \}\);/g,
  `await db.collection('auctions').doc(auction_id).update({ status: 'completed', payment_status: 'paid', post_auction_status: 'paid', paid_at: new Date().toISOString() });`
);

fs.writeFileSync('server.ts', code);
