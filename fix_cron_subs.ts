import fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const old = `app.post("/api/cron/process-subscription-renewals", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const secretHeader = req.headers['x-cron-secret'];
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== \`Bearer \${cronSecret}\` && secretHeader !== cronSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const now = new Date();
    // Assuming subscription expires in 30 days. We need to query users whose subscription is active, and paid_at is older than 30 days.
    // However, maybe there's an explicit subscription_expires_at?
    // The prompt says: "On the renewal date, attempt one idempotent wallet debit first... If insufficient, attempt the saved card through Stripe's proper recurring/off-session subscription or invoice workflow."
    
    // Actually, maybe Stripe manages the subscription?
    // Let's check how subscriptions are created in \`/api/create-subscription-checkout\`.
    res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});`;

const newCode = `app.post("/api/cron/process-subscription-renewals", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const secretHeader = req.headers['x-cron-secret'];
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== \`Bearer \${cronSecret}\` && secretHeader !== cronSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Process subscriptions that are active and need renewal.
    // E.g., paid_at is older than 30 days.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const usersSnapshot = await adminDb.collection('users')
      .where('subscription_active', '==', true)
      .where('subscription_paid_at', '<=', thirtyDaysAgo.toISOString())
      .get();
      
    let processed = 0;
    const stripe = getStripe();
    
    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      const packageId = (user.subscription_tier || '').toLowerCase();
      
      let amountCents = 0;
      if (packageId.includes('pro')) amountCents = 5000;
      else if (packageId.includes('basic')) amountCents = 2000;
      else continue; // Skip unknown tiers
      
      const idempotencyKey = \`renew_\${doc.id}_\${new Date().getFullYear()}_\${new Date().getMonth()}\`;
      
      try {
        // 1. Try wallet debit first
        const txId = await reserveWalletFunds(doc.id, amountCents, 'wallet_payment', idempotencyKey, { type: 'subscription_renewal' });
        
        // Success: commit the wallet funds
        await commitReservedFunds(txId);
        
        await doc.ref.update({
           subscription_paid_at: new Date().toISOString()
        });
        processed++;
        continue;
      } catch (walletError: any) {
        // Insufficient funds or already processed (idempotency key exists).
        // Check if already processed
        if (walletError.message.includes('Idempotency key already exists')) {
          continue;
        }
        
        // 2. Fallback to saved card
        if (user.stripe_customer_id && user.stripe_default_payment_method) {
          try {
            const pi = await stripe.paymentIntents.create({
              amount: amountCents,
              currency: 'eur',
              customer: user.stripe_customer_id,
              payment_method: user.stripe_default_payment_method,
              off_session: true,
              confirm: true,
              metadata: {
                type: 'subscription',
                user_id: doc.id,
                package_id: user.subscription_tier,
                renewal: 'true'
              }
            }, { idempotencyKey: \`card_\${idempotencyKey}\` });
            
            // Webhook will handle updating the user's subscription_paid_at date on success.
            processed++;
          } catch (stripeError: any) {
            console.error(\`Failed to renew subscription via card for user \${doc.id}: \`, stripeError);
            await doc.ref.update({
               subscription_active: false // Mark unpaid / past due
            });
            // We should notify the user.
          }
        } else {
          // No saved card
          await doc.ref.update({
             subscription_active: false // Mark unpaid / past due
          });
        }
      }
    }

    res.json({ success: true, processed });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});`;

code = code.replace(old, newCode);
fs.writeFileSync('src/server/app.ts', code);
