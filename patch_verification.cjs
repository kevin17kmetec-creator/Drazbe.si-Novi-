const fs = require('fs');
let code = fs.readFileSync('src/components/VerificationView.tsx', 'utf8');

code = code.replace(/initialData\?\.first_name \|\| ''/g, "initialData?.first_name || initialData?.firstName || ''");
code = code.replace(/initialData\?\.last_name \|\| ''/g, "initialData?.last_name || initialData?.lastName || ''");
code = code.replace(/initialData\?\.company_name \|\| ''/g, "initialData?.company_name || initialData?.companyName || ''");
code = code.replace(/initialData\?\.tax_number \|\| ''/g, "initialData?.tax_number || initialData?.taxNumber || initialData?.tax_id || ''");
code = code.replace(/initialData\?\.registration_number \|\| ''/g, "initialData?.registration_number || initialData?.regNumber || ''");
code = code.replace(/initialData\?\.company_street \|\| ''/g, "initialData?.company_street || initialData?.companyStreet || ''");
code = code.replace(/initialData\?\.company_city \|\| ''/g, "initialData?.company_city || initialData?.companyCity || ''");
code = code.replace(/initialData\?\.company_postal_code \|\| ''/g, "initialData?.company_postal_code || initialData?.companyPostalCode || ''");
code = code.replace(/initialData\?\.postal_code \|\| ''/g, "initialData?.postal_code || initialData?.postalCode || ''");

fs.writeFileSync('src/components/VerificationView.tsx', code);
console.log('patched VerificationView');
