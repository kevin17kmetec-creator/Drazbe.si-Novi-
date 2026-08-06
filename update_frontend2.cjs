const fs = require('fs');
let code = fs.readFileSync('src/components/StripeConnectOnboarding.tsx', 'utf8');

if (!code.includes('// Updated Stripe Onboarding v1.0.1')) {
    code = '// Updated Stripe Onboarding v1.0.1\n' + code;
    fs.writeFileSync('src/components/StripeConnectOnboarding.tsx', code);
}
