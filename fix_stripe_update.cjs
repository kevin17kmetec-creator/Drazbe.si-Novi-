const fs = require('fs');
let code = fs.readFileSync('api/stripe-account-link.ts', 'utf8');

const updateLogic = `
      if (!user.stripe_onboarding_complete) {
         try {
             await stripe.accounts.update(targetStripeAccountId, accountParams);
         } catch (e: any) {
             console.error("Failed to update existing Stripe account:", e.message);
             // If it failed because of business_type or phone, try updating just the basic info
             try {
                const fallbackParams = { ...accountParams };
                delete fallbackParams.business_type;
                if (e.message.includes('phone')) {
                   if (fallbackParams.company) delete fallbackParams.company.phone;
                   if (fallbackParams.individual) delete fallbackParams.individual.phone;
                   if (fallbackParams.business_profile) delete fallbackParams.business_profile.support_phone;
                }
                await stripe.accounts.update(targetStripeAccountId, fallbackParams);
             } catch (fallbackErr: any) {
                console.error("Fallback update also failed:", fallbackErr.message);
             }
         }
      }
`;

code = code.replace(
  /if \(\!user\.stripe_onboarding_complete\) \{[\s\S]*?catch \(e: any\) \{[\s\S]*?console\.error\("Failed to update existing Stripe account:", e\.message\);\s*\}\s*\}/,
  updateLogic
);

fs.writeFileSync('api/stripe-account-link.ts', code);
