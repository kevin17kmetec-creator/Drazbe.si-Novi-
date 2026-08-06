const fs = require('fs');
let code = fs.readFileSync('src/components/StripeConnectOnboarding.tsx', 'utf8');

code = code.replace(
  /const response = await fetch\('\/api\/stripe-account-link', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ \s*user_id: userId,\s*refresh_url: window\.location\.href,\s*return_url: window\.location\.href\s*\}\),\s*\}\);/,
  `const response = await fetch('/api/stripe-account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId })
      });`
);

fs.writeFileSync('src/components/StripeConnectOnboarding.tsx', code);
