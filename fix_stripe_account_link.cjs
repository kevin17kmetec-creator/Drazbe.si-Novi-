const fs = require('fs');

let apiCode = fs.readFileSync('api/stripe-account-link.ts', 'utf8');

// The new logic to replace the old logic in api/stripe-account-link.ts
const newApiCode = apiCode.replace(/let targetStripeAccountId = user\.stripeAccountId \|\| user\.stripe_account_id;[\s\S]*?if \(!targetStripeAccountId\)/, 
`let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;
    const isBusiness = user.user_type === 'business' || user.userType === 'business';
    const businessType = isBusiness ? 'company' : 'individual';

    let formattedPhone = undefined;
    if (user.phone) {
        let phone = user.phone.replace(/[^0-9+]/g, '');
        if (phone.startsWith('00')) {
            formattedPhone = '+' + phone.substring(2);
        } else if (phone.startsWith('0')) {
            formattedPhone = '+386' + phone.substring(1);
        } else if (!phone.startsWith('+')) {
            formattedPhone = '+386' + phone;
        } else {
            formattedPhone = phone;
        }
    }

    const parseDob = (dobStr) => {
        if (!dobStr) return undefined;
        // Assuming dobStr is YYYY-MM-DD
        const parts = dobStr.split('-');
        if (parts.length === 3) {
           return {
              day: parseInt(parts[2]),
              month: parseInt(parts[1]),
              year: parseInt(parts[0])
           };
        }
        return undefined;
    };

    const dob = user.dob ? parseDob(user.dob) : undefined;

    const accountParams: any = {
      email: user.email,
      business_type: businessType,
      business_profile: {
         support_email: user.email,
         support_phone: formattedPhone || undefined,
         name: isBusiness ? (user.company_name || user.companyName) : \`\${user.first_name || user.firstName || ''} \${user.last_name || user.lastName || ''}\`.trim() || undefined,
      }
    };
    
    if (isBusiness) {
      accountParams.company = {
        phone: formattedPhone || undefined,
        name: user.company_name || user.companyName || undefined,
        address: {
          line1: user.company_street || user.companyStreet || user.street || user.address?.street || undefined,
          city: user.company_city || user.companyCity || user.city || user.address?.city || undefined,
          postal_code: user.company_postal_code || user.companyPostalCode || user.postal_code || user.postalCode || user.address?.postcode || undefined,
          country: user.country_code || 'SI'
        }
      };
    } else {
      accountParams.individual = {
        phone: formattedPhone || undefined,
        first_name: user.first_name || user.firstName || undefined,
        last_name: user.last_name || user.lastName || undefined,
        email: user.email || undefined,
        dob: dob || undefined,
        address: {
          line1: user.street || user.address?.street || undefined,
          city: user.city || user.address?.city || undefined,
          postal_code: user.postal_code || user.postalCode || user.address?.postcode || undefined,
          country: user.country_code || 'SI'
        }
      };
    }

    if (!targetStripeAccountId)`);

fs.writeFileSync('api/stripe-account-link.ts', newApiCode);
