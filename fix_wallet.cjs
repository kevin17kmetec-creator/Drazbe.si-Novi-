const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const regex = /app\.post\("\/api\/payments\/wallet-pay-auction", async \(req, res\) => \{[\s\S]*?(?=app\.post\("\/api\/payments\/wallet-pay-subscription")/g;

const replacement = `app.post("/api/payments/wallet-pay-auction", async (req, res) => {
  try {
    const { amount, auction_id, buyer_id, seller_id, fee_percentage } = req.body || {};
    if (!auction_id || !buyer_id || !seller_id) {
      return res.status(400).json({ error: "Manjkajoči podatki" });
    }

    let auction: any = null;
    const auctionRef = adminDb.collection('auctions').doc(auction_id);
    const auctionDoc = await safeGetDoc(auctionRef);
    if (auctionDoc.exists()) {
      auction = auctionDoc.data();
    } else {
      return res.status(404).json({ error: "Dražba ne obstaja" });
    }

    let authoritativePriceInCents = NaN;
    if (auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
      authoritativePriceInCents = parseAmountToCents(auction.current_price);
    } else if (auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
      authoritativePriceInCents = parseAmountToCents(auction.currentBid);
    } else if (auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
      authoritativePriceInCents = parseAmountToCents(auction.starting_price);
    }

    if (isNaN(authoritativePriceInCents)) {
      return res.status(400).json({ error: "Invalid auction price" });
    }

    const totals = calculateCheckoutTotals(authoritativePriceInCents, fee_percentage);
    const finalAmountCents = totals.buyerTotalInCents;
    const finalAmountEuro = finalAmountCents / 100;

    const buyerRef = adminDb.collection('users').doc(buyer_id);
    const buyerDoc = await safeGetDoc(buyerRef);
    const buyer = buyerDoc.data() || {};
    const walletBalance = Number(buyer.wallet_balance) || 0;

    if (walletBalance < finalAmountEuro) {
      return res.status(400).json({ error: "Ni dovolj sredstev v denarnici" });
    }

    await buyerRef.update({
      wallet_balance: admin.firestore.FieldValue.increment(-finalAmountEuro)
    });

    const sellerRef = adminDb.collection('users').doc(seller_id);
    await sellerRef.update({
      wallet_balance: admin.firestore.FieldValue.increment(authoritativePriceInCents / 100)
    });

    await auctionRef.update({
      payment_status: 'paid',
      post_auction_status: 'sold',
      status: 'completed',
    });

    const txId = 'WTX_' + Date.now();
    await adminDb.collection('transactions').doc(txId).set({
      type: 'wallet_payment',
      auction_id,
      buyer_id,
      seller_id,
      amount: finalAmountEuro,
      fee: totals.platformFeeInCents / 100,
      currency: 'eur',
      status: 'completed',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, transaction_id: txId });
  } catch (error: any) {
    console.error("Wallet pay error:", error);
    res.status(500).json({ error: error.message || "Napaka" });
  }
});

`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/server/app.ts', code);
