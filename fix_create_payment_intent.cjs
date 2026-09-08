const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const regex = /app\.post\("\/api\/create-payment-intent", async \(req, res\) => \{[\s\S]*?(?=app\.post\("\/api\/stripe-account-session")/g;

const replacement = `app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency = "eur", auction_id, auctionId, buyer_id, seller_id, fee_percentage, user_id, userId } = req.body || {};
    const stripe = getStripe();
    const effectiveAuctionId = auction_id || auctionId;
    const effectiveBuyerId = buyer_id || user_id || userId;

    let stripeCustomerId: string | null = null;
    let buyer: any = null;
    if (effectiveBuyerId) {
      const buyerDoc = await safeGetDoc(adminDb.collection('users').doc(effectiveBuyerId));
      if (buyerDoc.exists()) {
        buyer = buyerDoc.data();
        stripeCustomerId = await getOrCreateStripeCustomer(stripe, effectiveBuyerId, buyer);
      }
    }

    let finalAmountCents = NaN;
    
    if (effectiveAuctionId) {
      try {
        const auctionDoc = await safeGetDoc(adminDb.collection('auctions').doc(effectiveAuctionId));
        if (auctionDoc.exists()) {
          const auction = auctionDoc.data();
          let authoritativePriceInCents = NaN;
          
          if (auction && auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
            authoritativePriceInCents = parseAmountToCents(auction.current_price);
          } else if (auction && auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
            authoritativePriceInCents = parseAmountToCents(auction.currentBid);
          } else if (auction && auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
            authoritativePriceInCents = parseAmountToCents(auction.starting_price);
          }
          
          if (!isNaN(authoritativePriceInCents)) {
             const totals = calculateCheckoutTotals(authoritativePriceInCents, fee_percentage);
             finalAmountCents = totals.buyerTotalInCents;
          }
        }
      } catch(e) {
        console.warn("Could not fetch auction for payment intent:", e);
      }
    }
    
    if (isNaN(finalAmountCents)) {
      finalAmountCents = parseAmountToCents(amount);
    }

    if (isNaN(finalAmountCents) || !isFinite(finalAmountCents) || finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid payment intent amount" });
    }

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: finalAmountCents,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type: 'auction',
        auction_id: effectiveAuctionId || '',
        buyer_id: effectiveBuyerId || '',
        seller_id: seller_id || '',
        fee_percentage: fee_percentage || ''
      }
    };

    if (stripeCustomerId) {
      intentParams.customer = stripeCustomerId;
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Stripe Payment Intent Error:", error);
    res.status(500).json({ error: error.message });
  }
});

`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/server/app.ts', code);
