const fs = require('fs');
let code = fs.readFileSync('src/components/CheckoutModal.tsx', 'utf8');

code = code.replace(
  "<span>{amount.toFixed(2)} €</span>",
  "<span>{typeof amount === 'number' ? amount.toFixed(2) : parseFloat(String(amount).replace(',', '.')).toFixed(2)} €</span>"
);

fs.writeFileSync('src/components/CheckoutModal.tsx', code);
