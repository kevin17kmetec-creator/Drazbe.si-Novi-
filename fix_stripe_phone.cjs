const fs = require('fs');
let code = fs.readFileSync('api/stripe-account-link.ts', 'utf8');

const newFormatter = `
    let formattedPhone = user.phone ? user.phone.replace(/[^0-9+]/g, '') : undefined;
    if (formattedPhone) {
        if (formattedPhone.startsWith('00')) {
            formattedPhone = '+' + formattedPhone.substring(2);
        } else if (formattedPhone.startsWith('0')) {
            formattedPhone = '+386' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+386' + formattedPhone;
        }
    }
`;

code = code.replace(
  /\/\/ Format phone to E\.164 if exists[\s\S]*?if \(formattedPhone\) \{[\s\S]*?\}\s*\}/,
  newFormatter
);

fs.writeFileSync('api/stripe-account-link.ts', code);
