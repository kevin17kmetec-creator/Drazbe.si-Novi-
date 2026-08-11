const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /(\<button\s*onClick=\{async \(\) => \{\s*setCheckoutData\(\{[\s\S]*?\<CardIcon size=\{18\} \/> Plačaj zdaj\s*<\/button>)/,
  `{wonItem.post_auction_status !== 'offered_2nd' && wonItem.post_auction_status !== 'rejected_2nd' && (
    $1
  )}`
);

fs.writeFileSync('App.tsx', code);
