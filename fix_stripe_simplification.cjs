const fs = require('fs');

// 1. Update api/stripe-account-link.ts
let apiCode = fs.readFileSync('api/stripe-account-link.ts', 'utf8');

// Remove dob logic
apiCode = apiCode.replace(/const parseDob[\s\S]*?const dob = user\.dob \? parseDob\(user\.dob\) : undefined;/g, '');
apiCode = apiCode.replace(/dob: dob \|\| undefined,\s*/g, '');

// Update capabilities and add settings
apiCode = apiCode.replace(/accountParams\.capabilities = \{[\s\S]*?transfers: \{ requested: true \},[\s\S]*?card_payments: \{ requested: true \}[\s\S]*?\};/g, 
`accountParams.capabilities = {
        transfers: { requested: true }
      };
      accountParams.settings = { payouts: { schedule: { interval: 'manual' } } };`);

fs.writeFileSync('api/stripe-account-link.ts', apiCode);

// 2. Update server.ts
let serverCode = fs.readFileSync('server.ts', 'utf8');

// Remove dob logic
serverCode = serverCode.replace(/const parseDob = \(dobStr: string\) => \{[\s\S]*?const dob = user\.dob \? parseDob\(user\.dob\) : undefined;/g, '');
serverCode = serverCode.replace(/dob: dob \|\| undefined,\s*/g, '');

// Update capabilities and add settings in stripe-account-link block
serverCode = serverCode.replace(/accountParams\.capabilities = \{[\s\S]*?transfers: \{ requested: true \},[\s\S]*?card_payments: \{ requested: true \}[\s\S]*?\};/g, 
`accountParams.capabilities = {
        transfers: { requested: true }
      };
      accountParams.settings = { payouts: { schedule: { interval: 'manual' } } };`);

// Update capabilities in create-payout block
serverCode = serverCode.replace(/capabilities: \{\s*transfers: \{ requested: true \},\s*card_payments: \{ requested: true \}\s*\}/g, 
`capabilities: {
                  transfers: { requested: true }
              },
              settings: { payouts: { schedule: { interval: 'manual' } } }`);

fs.writeFileSync('server.ts', serverCode);

console.log("Stripe simplification applied.");
