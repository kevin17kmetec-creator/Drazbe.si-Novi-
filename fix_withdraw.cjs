const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const regex = /app\.post\("\/api\/payouts\/withdraw", async \(req, res\) => \{[\s\S]*?(?=app\.post\("\/api\/create-subscription-checkout")/g;

const replacement = `app.post("/api/payouts/withdraw", async (req, res) => {
  try {
    const { user_id, amount, return_url, refresh_url } = req.body || {};
    const stripe = getStripe();

    const amountInCents = parseAmountToCents(amount);
    if (isNaN(amountInCents) || amountInCents <= 0) {
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
});

`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/server/app.ts', code);
