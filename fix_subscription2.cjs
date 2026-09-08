const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const regex = /app\.post\("\/api\/create-subscription-checkout", async \(req, res\) => \{[\s\S]*?(?=app\.post\("\/api\/create-verification-session")/g;

const replacement = `app.post("/api/create-subscription-checkout", async (req, res) => {
  try {
    const { amount, currency = "eur", user_id, package_id, return_url } = req.body || {};
    const stripe = getStripe();

    const packageIdStr = (package_id || '').toLowerCase();
    let finalAmountCents = 0;
    if (packageIdStr.includes('pro')) {
       finalAmountCents = 5000;
    } else if (packageIdStr.includes('basic')) {
       finalAmountCents = 2000;
    } else {
       finalAmountCents = parseAmountToCents(amount);
    }

    if (isNaN(finalAmountCents) || !isFinite(finalAmountCents) || finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid subscription payment amount" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: \`Naročnina - Paket \${package_id || 'Premium'}\`,
          },
          unit_amount: finalAmountCents,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'subscription',
        user_id: user_id || '',
        package_id: package_id || '',
        amount: finalAmountCents.toString()
      },
      payment_intent_data: {
        metadata: {
          type: 'subscription',
          user_id: user_id || '',
          package_id: package_id || '',
          amount: finalAmountCents.toString()
        }
      },
      mode: 'payment',
      success_url: return_url && return_url.includes('/stripe-callback.html')
        ? \`\${return_url}?payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}\`
        : \`\${return_url || 'https://www.drazbe.eu'}\${return_url && return_url.includes('?') ? '&' : '?'}payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}\`,
      cancel_url: return_url && return_url.includes('/stripe-callback.html')
        ? \`\${return_url}?payment=cancel\`
        : \`\${return_url || 'https://www.drazbe.eu'}\${return_url && return_url.includes('?') ? '&' : '?'}payment=cancel\`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Subscription Checkout Error:", error);
    res.status(500).json({ error: error.message });
  }
});

`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/server/app.ts', code);
