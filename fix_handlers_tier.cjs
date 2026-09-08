const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

// 1. In create-checkout-session
code = code.replace(
  "const totals = calculateCheckoutTotals(authoritativePriceInCents, fee_percentage);",
  `const sellerDoc = await safeGetDoc(adminDb.collection('users').doc(seller_id || auction.seller_id || auction.sellerId || ''));
      let sellerTier = 'BASIC';
      if (sellerDoc.exists()) sellerTier = sellerDoc.data().subscription_tier;
      const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);`
);

// 2. In create-payment-intent
code = code.replace(
  "const totals = calculateCheckoutTotals(authoritativePriceInCents, fee_percentage);",
  `const sellerDoc = await safeGetDoc(adminDb.collection('users').doc(seller_id || auction.seller_id || auction.sellerId || ''));
             let sellerTier = 'BASIC';
             if (sellerDoc.exists()) sellerTier = sellerDoc.data().subscription_tier;
             const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);`
);

// 3. In wallet-pay-auction
code = code.replace(
  "const totals = calculateCheckoutTotals(authoritativePriceInCents, fee_percentage);",
  `const sellerDoc2 = await safeGetDoc(adminDb.collection('users').doc(seller_id));
    let sellerTier = 'BASIC';
    if (sellerDoc2.exists()) sellerTier = sellerDoc2.data().subscription_tier;
    const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);`
);

fs.writeFileSync('src/server/app.ts', code);
