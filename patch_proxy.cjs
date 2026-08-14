const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Proxy Bidding Implementation
const target = `            if (amount <= currentPrice) {
                throw new Error("Bid must be higher than current price");
            }`;

const replacement = `            if (amount <= currentPrice) {
                throw new Error("Bid must be higher than current price");
            }

            // PROXY BIDDING LOGIC
            // 'amount' is the max proxy bid from the user.
            // Check if there is an existing proxy bid.
            const currentProxy = data.current_proxy_bid;
            let newCurrentPrice = currentPrice;
            let newWinnerId = userData.id;
            let newProxyBid = { user_id: userData.id, amount: amount };
            
            // Standard increment (assuming 10 for simplicity, or we can fetch a helper)
            const increment = 10;
            
            if (currentProxy && currentProxy.user_id !== userData.id) {
                if (amount > currentProxy.amount) {
                    // New user outbids old proxy
                    newCurrentPrice = Math.min(amount, currentProxy.amount + increment);
                } else if (amount === currentProxy.amount) {
                    // Tie goes to earlier proxy
                    newCurrentPrice = amount;
                    newWinnerId = currentProxy.user_id;
                    newProxyBid = currentProxy;
                } else {
                    // New user did not outbid old proxy
                    newCurrentPrice = Math.min(currentProxy.amount, amount + increment);
                    newWinnerId = currentProxy.user_id;
                    newProxyBid = currentProxy;
                }
            } else if (currentProxy && currentProxy.user_id === userData.id) {
                // User is just increasing their proxy max bid, current price doesn't change unless they are outbidding themselves (which is impossible here)
                newCurrentPrice = currentPrice; 
                // wait, if they are just updating proxy, we just update it
            } else {
                 // No previous proxy, or just starting. New price is current price + increment, or amount if less
                 newCurrentPrice = Math.min(amount, currentPrice + increment);
            }`;

const target2 = `            transaction.update(auctionRef, {
                  current_price: amount,
                  bid_count: (data.bid_count || 0) + 1,
                  winner_id: userData.id,
                 top_bids: uniqueTopBids,
                 end_time: newEndTimeStr
            });`;

const replacement2 = `            
            // Also append to history for display, simulating normal bids
            const newHistoryItem = { userId: newWinnerId, amount: newCurrentPrice, timestamp: new Date().toISOString() };
            const history = data.bidding_history || data.biddingHistory || [];
            history.push(newHistoryItem);

            transaction.update(auctionRef, {
                  current_price: newCurrentPrice,
                  current_proxy_bid: newProxyBid,
                  bid_count: (data.bid_count || 0) + 1,
                  winner_id: newWinnerId,
                  bidding_history: history,
                  top_bids: uniqueTopBids,
                  end_time: newEndTimeStr
            });`;

code = code.replace(target, replacement);
code = code.replace(target2, replacement2);
fs.writeFileSync('App.tsx', code);
console.log("Done patching App.tsx proxy");
