const fs = require('fs');
let code = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');

code = code.replace(
  /const otherUserId = auction\.sellerId === userId \? auction\.biddingHistory\?\.\[0\]\?\.bidderId : auction\.sellerId;/,
  `// Fix finding other user
           let otherUserId = auction.sellerId;
           if (auction.sellerId === userId) {
               otherUserId = auction.winnerId || (auction as any).winner_id;
               if (!otherUserId && auction.post_auction_status === 'offered_2nd') {
                   otherUserId = (auction as any).second_highest_bidder_id;
               }
               if (!otherUserId && (auction as any).top_bids?.length > 0) {
                   otherUserId = (auction as any).top_bids[0].user_id;
               }
           }`
);

fs.writeFileSync('src/context/ChatContext.tsx', code);
