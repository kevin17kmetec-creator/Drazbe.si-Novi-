const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /status: 'completed',\s*payment_status: 'paid',\s*paid_at: new Date\(\)\.toISOString\(\)/,
  `status: 'completed', payment_status: 'paid', post_auction_status: 'paid', paid_at: new Date().toISOString()`
);

fs.writeFileSync('server.ts', code);
