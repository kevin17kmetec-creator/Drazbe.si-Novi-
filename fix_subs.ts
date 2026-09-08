import fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const renewalCron = `
app.post("/api/cron/process-subscription-renewals", async (req, res) => {
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
});
`;

if (!code.includes("process-subscription-renewals")) {
    code += "\n" + renewalCron;
}

fs.writeFileSync('src/server/app.ts', code);
