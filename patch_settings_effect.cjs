const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

const regex = /useEffect\(\(\) => \{\n    if \(user\) \{([\s\S]*?)\}\n  \}, \[user\]\);/;

const newEffect = `useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        username: user.username ?? prev.username,
        firstName: user.first_name ?? user.firstName ?? prev.firstName,
        lastName: user.last_name ?? user.lastName ?? prev.lastName,
        email: user.email ?? prev.email,
        profilePicture: user.profile_picture_url ?? user.profilePicture ?? prev.profilePicture,
        phone: user.phone ?? prev.phone,
        street: user.street ?? prev.street,
        city: user.city ?? prev.city,
        postalCode: user.postal_code ?? user.postalCode ?? prev.postalCode,
        companyName: user.company_name ?? user.companyName ?? prev.companyName,
        taxNumber: user.tax_number ?? user.tax_id ?? user.taxNumber ?? prev.taxNumber,
        regNumber: user.registration_number ?? user.regNumber ?? prev.regNumber,
        companyStreet: user.company_street ?? user.companyStreet ?? prev.companyStreet,
        companyCity: user.company_city ?? user.companyCity ?? prev.companyCity,
        companyPostalCode: user.company_postal_code ?? user.companyPostalCode ?? prev.companyPostalCode,
        representative: user.representative ?? prev.representative,
        countryCode: user.country_code ?? user.countryCode ?? prev.countryCode,
        autoInvoiceGeneration: user.auto_invoice_generation ?? prev.autoInvoiceGeneration,
      }));
    }
  }, [user]);`;

code = code.replace(regex, newEffect);
fs.writeFileSync('src/components/SettingsView.tsx', code);
console.log('patched SettingsView effect');
