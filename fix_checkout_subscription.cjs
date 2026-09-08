const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const regex = /\} else if \(type === "subscription"\) \{[\s\S]*?(?=\} else \{)/g;

const replacement = `} else if (type === "subscription") {
      const planIdStr = (req.body.planId || req.body.package_id || '').toLowerCase();
      if (planIdStr.includes('pro')) finalAmountCents = 5000;
      else if (planIdStr.includes('basic')) finalAmountCents = 2000;
      else finalAmountCents = parseAmountToCents(amount);

      auctionTitle = "Naročnina - " + (req.body.planId || 'Paket');
      sessionMetadata = {
        type: 'subscription',
        buyer_id: effectiveBuyerId || '',
        user_id: effectiveBuyerId || '',
        planId: req.body.planId || ''
      };
    `;

code = code.replace(regex, replacement);
fs.writeFileSync('src/server/app.ts', code);
