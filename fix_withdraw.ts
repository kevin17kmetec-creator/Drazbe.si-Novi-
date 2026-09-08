import * as fs from 'fs';

let code = fs.readFileSync('src/server/app.ts', 'utf8');

const oldWithdraw = `app.post("/api/payouts/withdraw", async (req, res) => {
  try {
    const { user_id, amount, return_url, refresh_url } = req.body || {};
    const stripe = getStripe();

    const amountInCents = parseAmountToCents(amount);
    if (amountInCents <= 0) {
       return res.status(400).json({ error: "Invalid payout amount" });
    }
    const withdrawalAmount = amountInCents / 100;

    const userDocRef = adminDb.collection('users').doc(user_id);
    const userDoc = await safeGetDoc(userDocRef);
    const user = userDoc.data() || {};

    const currentBalance = Number(user.wallet_balance) || 0;

    if (currentBalance < withdrawalAmount) {
      return res.status(400).json({ error: "Nedostupno stanje v denarnici" });
    }

    let stripeAccountId = user.stripeAccountId || user.stripe_account_id;
    if (!stripeAccountId) {
       return res.status(400).json({ error: "Stripe račun ni povezan" });
    }

    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: "eur",
      destination: stripeAccountId,
    });

    const payout = await stripe.payouts.create({
      amount: amountInCents,
      currency: "eur",
    }, {
      stripeAccount: stripeAccountId
    });

    await userDocRef.update({
      wallet_balance: admin.firestore.FieldValue.increment(-withdrawalAmount)
    });

    const txId = 'POUT_' + Date.now();
    await adminDb.collection('transactions').doc(txId).set({
      type: 'payout',
      user_id,
      amount: withdrawalAmount,
      currency: 'eur',
      status: 'completed',
      stripe_transfer_id: transfer.id,
      stripe_payout_id: payout.id,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, transfer_id: transfer.id, payout_id: payout.id });
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ error: error.message });
  }
});`;

const newWithdraw = `app.post("/api/payouts/withdraw", async (req, res) => {
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

    const { amount, return_url, refresh_url } = req.body || {};
    const stripe = getStripe();

    const amountInCents = parseAmountToCents(amount);
    if (amountInCents <= 0) {
       return res.status(400).json({ error: "Invalid payout amount" });
    }

    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await safeGetDoc(userDocRef);
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userDoc.data() || {};

    let stripeAccountId = user.stripeAccountId || user.stripe_account_id;
    if (!stripeAccountId) {
       return res.status(400).json({ error: "Stripe račun ni povezan" });
    }
    
    // Ensure Stripe account can receive transfers
    const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
    if (!stripeAccount.payouts_enabled) {
      return res.status(400).json({ error: "Stripe payouts are not enabled for this account" });
    }

    const idempotencyKey = \`withdraw_\${userId}_\${Date.now()}\`;

    // 1. Reserve funds
    let txId: string;
    try {
      txId = await reserveWalletFunds(userId, amountInCents, 'withdrawal', idempotencyKey);
    } catch (e: any) {
      return res.status(400).json({ error: e.message || "Insufficient funds" });
    }

    // 2. Transfer to Connected Account
    try {
      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: "eur",
        destination: stripeAccountId,
      }, {
        idempotencyKey
      });

      // Payout is generally handled automatically by Stripe Connect depending on settings.
      // Do not create a manual payout unless explicitly needed. The transfer moves it to their balance.
      // If we need to trigger manual payout from their connected account, we can, but a transfer is the actual money move from platform to seller.

      await commitReservedFunds(txId, { stripe_transfer_id: transfer.id });

      const updatedUserDoc = await safeGetDoc(userDocRef);
      const remainingAvailable = updatedUserDoc.data()?.available_cents || 0;

      res.json({ success: true, transfer_id: transfer.id, available_cents: remainingAvailable });
    } catch (transferError: any) {
      console.error("Stripe transfer failed, rolling back:", transferError);
      await rollbackReservedFunds(txId);
      res.status(500).json({ error: transferError.message || "Transfer failed" });
    }
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ error: error.message });
  }
});`;

code = code.replace(oldWithdraw, newWithdraw);
fs.writeFileSync('src/server/app.ts', code);
