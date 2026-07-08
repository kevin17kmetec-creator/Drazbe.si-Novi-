const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/function handleBidSubmit\(item: AuctionItem, amount: number\) => \{/g, `async function handleBidSubmit(item: any, amount: number) {`);
code = code.replace(/async function handleConfirmBidasync \(\) => \{/g, `async function handleConfirmBid() {`);

fs.writeFileSync('App.tsx', code);
