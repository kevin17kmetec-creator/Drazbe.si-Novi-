const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const stripeCode = `
  app.post("/api/stripe-account-session", async (req, res) => {
    try {
      const { user_id } = req.body;
      const stripe = getStripe();

      const userDoc = await getDoc(doc(db, 'users', user_id));
      const user = userDoc.data();
      let accountId = user?.stripe_account_id;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true }
          }
        });
        accountId = account.id;
        await updateDoc(doc(db, 'users', user_id), { stripe_account_id: accountId });
      }

      const accountSession = await stripe.accountSessions.create({
        account: accountId,
        components: {
          account_onboarding: { enabled: true },
        },
      });

      res.status(200).json({ client_secret: accountSession.client_secret });
    } catch (error: any) {
      console.error("Stripe Account Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
`;

// Insert it before app.post("/api/stripe-account-link"
code = code.replace('  app.post("/api/stripe-account-link"', stripeCode + '\n  app.post("/api/stripe-account-link"');
fs.writeFileSync('server.ts', code);
console.log('Added stripe-account-session to server.ts');
