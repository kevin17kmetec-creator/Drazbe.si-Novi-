const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /transaction\.update\(auctionRef, \{\s*current_price: amount,\s*bid_count: \(data\.bid_count \|\| 0\) \+ 1,\s*winner_id: userData\.id,\s*end_time: newEndTimeStr\s*\}\);/,
  `// Update top bids to keep track of 2nd highest
            let topBids = data.top_bids || [];
            topBids.push({ user_id: userData.id, amount, timestamp: new Date().toISOString() });
            // Sort by amount desc
            topBids.sort((a, b) => b.amount - a.amount);
            // Keep only unique users (highest bid per user) to find the true 2nd highest bidder
            let uniqueTopBids = [];
            let seenUsers = new Set();
            for (let bid of topBids) {
                if (!seenUsers.has(bid.user_id)) {
                    uniqueTopBids.push(bid);
                    seenUsers.add(bid.user_id);
                }
            }
            // Keep top 3 just in case
            uniqueTopBids = uniqueTopBids.slice(0, 3);
            
            transaction.update(auctionRef, { 
                 current_price: amount, 
                 bid_count: (data.bid_count || 0) + 1, 
                 winner_id: userData.id,
                 top_bids: uniqueTopBids,
                 end_time: newEndTimeStr
            });`
);

fs.writeFileSync('App.tsx', code);
