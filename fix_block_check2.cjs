const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /if \(userData\.isBlocked \|\| userData\.unpaidStrikes >= 3\)/,
  `if ((userData as any).isBlocked || (userData as any).unpaidStrikes >= 3)`
);

fs.writeFileSync('App.tsx', code);
