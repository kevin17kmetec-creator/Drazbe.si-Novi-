const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /const newDocRef = doc\(collection\(db, 'auctions'\)\);/,
  `const newDocRef = itemData.id ? doc(db, 'auctions', itemData.id) : doc(collection(db, 'auctions'));`
);

code = code.replace(
  /bidding_history: \[\],/,
  `bidding_history: [],
        top_bids: [],
        winner_id: null,
        winnerId: null,
        payment_status: 'unpaid',
        post_auction_status: null,`
);

fs.writeFileSync('App.tsx', code);
