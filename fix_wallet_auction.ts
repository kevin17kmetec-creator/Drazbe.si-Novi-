import * as fs from 'fs';

let code = fs.readFileSync('src/server/app.ts', 'utf8');

const oldCode = `app.post("/api/payments/wallet-pay-auction", async (req, res) => {
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

    let authoritativePriceInCents = 0;
    if (auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
      authoritativePriceInCents = parseAmountToCents(auction.current_price);
    } else if (auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
      authoritativePriceInCents = parseAmountToCents(auction.currentBid);
    } else if (auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
      authoritativePriceInCents = parseAmountToCents(auction.starting_price);
    }

    if (authoritativePriceInCents <= 0) {
      return res.status(400).json({ error: "Invalid auction price" });
    }

    const sellerDoc2 = await safeGetDoc(adminDb.collection('users').doc(seller_id));
    let sellerTier = 'BASIC';
    if (sellerDoc2.exists()) sellerTier = sellerDoc2.data().subscription_tier;
    const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);
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
      amount_total: finalAmountEuro,
      platform_fee: totals.platformFeeInCents / 100,
      vat_amount: totals.vatInCents / 100,
      vat_rate: 0,
      is_reverse_charge: false,
      currency: 'eur',
      status: 'completed',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, transaction_id: txId });
  } catch (error: any) {
    console.error("Wallet pay error:", error);
    res.status(500).json({ error: error.message || "Napaka" });
  }
});`;

const newCode = `app.post("/api/payments/wallet-pay-auction", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const userId = decodedToken.uid;

    const { auction_id } = req.body || {};
    if (!auction_id) {
      return res.status(400).json({ error: "Manjkajoči podatki" });
    }

    const txId = await adminDb.runTransaction(async (t) => {
      let auction: any = null;
      const auctionRef = adminDb.collection('auctions').doc(auction_id);
      const auctionDoc = await t.get(auctionRef);
      if (auctionDoc.exists) {
        auction = auctionDoc.data();
      } else {
        throw new Error("Dražba ne obstaja");
      }
      
      const buyer_id = auction.highest_bidder || auction.winner_id;
      if (userId !== buyer_id) {
        throw new Error("Samo zmagovalec lahko plača dražbo");
      }
      
      const seller_id = auction.seller_id;
      if (!seller_id) throw new Error("Missing seller info");

      let authoritativePriceInCents = 0;
      if (auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.current_price);
      } else if (auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.currentBid);
      } else if (auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.starting_price);
      }

      if (authoritativePriceInCents <= 0) {
        throw new Error("Invalid auction price");
      }

      const sellerRef = adminDb.collection('users').doc(seller_id);
      const sellerDoc2 = await t.get(sellerRef);
      let sellerTier = 'BASIC';
      let sellerData = {};
      if (sellerDoc2.exists) {
         sellerData = sellerDoc2.data() || {};
         sellerTier = sellerData.subscription_tier || 'BASIC';
      }
      const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);
      const finalAmountCents = totals.buyerTotalInCents;

      const buyerRef = adminDb.collection('users').doc(buyer_id);
      const buyerDoc = await t.get(buyerRef);
      const buyerData = buyerDoc.data() || {};
      
      // Ensure wallet migration
      const buyerWallet = ensureWalletMigrated(t, buyerRef, buyerData);
      if (buyerWallet.available_cents < finalAmountCents) {
        throw new Error("Ni dovolj sredstev v denarnici");
      }

      // Debit buyer
      t.update(buyerRef, {
        available_cents: admin.firestore.FieldValue.increment(-finalAmountCents)
      });
      
      // Ensure seller wallet migration and credit held funds
      ensureWalletMigrated(t, sellerRef, sellerData);
      t.update(sellerRef, {
        held_cents: admin.firestore.FieldValue.increment(authoritativePriceInCents) // Seller gets the item price (before platform fee is applied if we assume buyer pays fee? Wait, calculateCheckoutTotals adds platform fee to itemPrice. Actually, seller proceeds is authoritativePriceInCents - totals.platformFeeInCents - totals.vatInCents? Wait, check the original code: it credited \`authoritativePriceInCents / 100\`. Let's use authoritativePriceInCents)
      });
      
      // Update auction
      t.update(auctionRef, {
        payment_status: 'paid',
        post_auction_status: 'sold',
        status: 'completed',
      });

      const txId = 'WTX_' + Date.now();
      t.set(adminDb.collection('transactions').doc(txId), {
        type: 'wallet_payment',
        auction_id,
        buyer_id,
        seller_id,
        amount_total: finalAmountCents / 100, // legacy UI compatibility
        amount_cents: finalAmountCents,
        platform_fee: totals.platformFeeInCents / 100,
        vat_amount: totals.vatInCents / 100,
        vat_rate: 0,
        is_reverse_charge: false,
        currency: 'eur',
        status: 'completed',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Also add wallet ledger entries
      const wtxBuyerId = adminDb.collection('wallet_transactions').doc().id;
      t.set(adminDb.collection('wallet_transactions').doc(wtxBuyerId), {
        transaction_id: wtxBuyerId,
        user_id: buyer_id,
        type: 'wallet_payment',
        amount_cents: finalAmountCents,
        status: 'completed',
        idempotency_key: txId + "_buyer",
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const wtxSellerId = adminDb.collection('wallet_transactions').doc().id;
      t.set(adminDb.collection('wallet_transactions').doc(wtxSellerId), {
        transaction_id: wtxSellerId,
        user_id: seller_id,
        type: 'hold',
        amount_cents: authoritativePriceInCents,
        status: 'completed',
        auction_id: auction_id,
        idempotency_key: txId + "_seller",
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return txId;
    });

    res.json({ success: true, transaction_id: txId });
  } catch (error: any) {
    console.error("Wallet pay error:", error);
    res.status(500).json({ error: error.message || "Napaka" });
  }
});`;

code = code.replace(oldCode, newCode);
if (!code.includes("ensureWalletMigrated")) {
    code = code.replace(
      "import { reserveWalletFunds",
      "import { ensureWalletMigrated, reserveWalletFunds"
    );
}

fs.writeFileSync('src/server/app.ts', code);
