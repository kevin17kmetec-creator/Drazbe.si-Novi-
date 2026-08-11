const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /fetchAuctions\(\);\n\s*fetchUsers\(\);/,
  `fetchAuctions();
    fetchUsers();
    // Run cron job
    fetch('/api/cron-auctions', { method: 'POST' }).catch(console.error);`
);

fs.writeFileSync('App.tsx', code);
