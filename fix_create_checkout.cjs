const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const regex = /app\.post\("\/api\/create-checkout-session", async \(req, res\) => \{[\s\S]*?(?=app\.post\("\/api\/confirm-checkout-session")/g;

const replacement = `app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { amount, currency = "eur", auction_id, auctionId, buyer_id, seller_id, fee_percentage, return_url, type = "auction", user_id, userId, buyer_data } = req.body || {};
    const stripe = getStripe();

    const effectiveAuctionId = auction_id || auctionId;
    const effectiveBuyerId = buyer_id || user_id || userId;
    let auctionTitle = "Plačilo";
    let sessionMetadata: any = { type };
    let buyer: any = buyer_data || null;
    let stripeCustomerId: string | null = null;
    let finalAmountCents = NaN;

    // Check EU AML law: 10,000 € annual limit check for buyers without ID verification
    if (effectiveBuyerId) {
      if (!buyer) {
        try {
          const buyerDoc = await safeGetDoc(adminDb.collection('users').doc(effectiveBuyerId));
          if (buyerDoc.exists()) {
            buyer = buyerDoc.data();
          }
        } catch (e: any) {
          console.warn("Could not fetch buyer from DB, proceeding without full verification check:", e.message);
        }
      }

      if (buyer) {
        stripeCustomerId = await getOrCreateStripeCustomer(stripe, effectiveBuyerId, buyer);

        const currentYear = new Date().getFullYear();
        let currentYearSpent = 0;

        if (buyer.yearly_spent_by_year && buyer.yearly_spent_by_year[currentYear]) {
          currentYearSpent = Number(buyer.yearly_spent_by_year[currentYear]) || 0;
        } else if (buyer.yearly_spent_year === currentYear && typeof buyer.yearly_spent === 'number') {
          currentYearSpent = buyer.yearly_spent;
        }

        const isVerified = !!(buyer.is_verified || buyer.is_id_verified || buyer.id_document_verified);
        if (currentYearSpent > 10000 && !isVerified) {
          return res.status(400).json({
            error: "V skladu z zakonodajo EU (ZPPDFT-2 / AML) je za skupne letne nakupe nad 10.000 € obvezna identifikacija z osebnim dokumentom. Prosimo, verificirajte svoj profil v nastavitvah pred nadaljevanjem."
          });
        }
      }
    }

    let diagnosticInfo: any = {
      route: '/api/create-checkout-session',
      type,
      hasAuctionId: !!effectiveAuctionId,
      auctionFound: false,
      usedPriceField: 'none',
      computedCents: NaN
    };

    if (type === "auction") {
      if (!effectiveAuctionId || !effectiveBuyerId) {
         return res.status(400).json({ error: "Missing required auction fields for payment" });
      }

      let auction: any = null;
      try {
        const auctionDoc = await safeGetDoc(adminDb.collection('auctions').doc(effectiveAuctionId));
        if (auctionDoc.exists()) {
          auction = auctionDoc.data();
          diagnosticInfo.auctionFound = true;
        }
      } catch (e) {
        console.warn("Could not fetch auction:", e);
      }

      if (!auction) {
        return res.status(400).json({ error: "Invalid auction payment amount (auction not found)" });
      }

      if (auction.title) {
        auctionTitle = auction.title['SLO'] || auction.title['EN'] || "Dražba";
      }
      
      let authoritativePriceInCents = NaN;
      
      if (auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.current_price);
        diagnosticInfo.usedPriceField = 'current_price';
      } else if (auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.currentBid);
        diagnosticInfo.usedPriceField = 'currentBid';
      } else if (auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.starting_price);
        diagnosticInfo.usedPriceField = 'starting_price';
      }

      if (isNaN(authoritativePriceInCents)) {
        return res.status(400).json({ error: "Invalid auction payment amount" });
      }

      const totals = calculateCheckoutTotals(authoritativePriceInCents, fee_percentage);
      finalAmountCents = totals.buyerTotalInCents;

      sessionMetadata = {
        type: 'auction',
        auction_id: effectiveAuctionId,
        buyer_id: effectiveBuyerId,
        seller_id: seller_id || auction.seller_id || auction.sellerId || '',
        fee_percentage: fee_percentage || ''
      };
    } else if (type === "subscription") {
      auctionTitle = "Naročnina";
      finalAmountCents = parseAmountToCents(amount);
      sessionMetadata = {
        type: 'subscription',
        buyer_id: effectiveBuyerId || '',
        user_id: effectiveBuyerId || '',
      };
    } else {
      auctionTitle = "Plačilo dražbe";
      finalAmountCents = parseAmountToCents(amount);
      sessionMetadata = {
        type: 'auction',
        auction_id: effectiveAuctionId || '',
        buyer_id: effectiveBuyerId || '',
        seller_id: seller_id || '',
      };
    }

    diagnosticInfo.computedCents = finalAmountCents;
    console.log("[DIAGNOSTIC] create-checkout-session amounts:", JSON.stringify(diagnosticInfo));

    if (isNaN(finalAmountCents) || !isFinite(finalAmountCents) || finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid auction payment amount" });
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: auctionTitle,
          },
          unit_amount: finalAmountCents,
        },
        quantity: 1,
      }],
      metadata: sessionMetadata,
      payment_intent_data: {
        metadata: sessionMetadata
      },
      mode: 'payment',
      success_url: return_url && return_url.includes('/stripe-callback.html')
        ? \`\${return_url}?payment=success&session_id={CHECKOUT_SESSION_ID}\`
        : \`\${return_url || 'https://www.drazbe.eu'}\${return_url && return_url.includes('?') ? '&' : '?'}payment=success&session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: return_url && return_url.includes('/stripe-callback.html')
        ? \`\${return_url}?payment=cancel\`
        : \`\${return_url || 'https://www.drazbe.eu'}\${return_url && return_url.includes('?') ? '&' : '?'}payment=cancel\`,
    };

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      sessionParams.customer_update = {
        address: 'auto',
        name: 'auto',
        shipping: 'auto',
      };
    } else if (buyer?.email) {
      sessionParams.customer_email = buyer.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    res.status(500).json({ error: error.message });
  }
});

`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/server/app.ts', code);
