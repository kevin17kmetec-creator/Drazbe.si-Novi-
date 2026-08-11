const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /await setDoc\(doc\(db, 'auctions', wonItem\.id\), \{ payment_status: 'paid', paid_at: new Date\(\)\.toISOString\(\) \}, \{ merge: true \}\);/,
  `await setDoc(doc(db, 'auctions', wonItem.id), { payment_status: 'paid', paid_at: new Date().toISOString(), post_auction_status: 'paid' }, { merge: true });`
);

fs.writeFileSync('App.tsx', code);
