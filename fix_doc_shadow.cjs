const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace "let doc of" with "let auctionDocItem of"
code = code.replace(/for\s*\(\s*let\s+doc\s+of/g, 'for (let auctionDocItem of');
// Fix the usage of doc.id and doc.data() inside the for loop
code = code.replace(/doc\.id/g, 'auctionDocItem.id');
code = code.replace(/doc\.data\(\)/g, 'auctionDocItem.data()');

fs.writeFileSync('server.ts', code);
