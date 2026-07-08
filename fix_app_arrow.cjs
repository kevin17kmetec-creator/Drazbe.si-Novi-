const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/function handleBidSubmit\(item: any, amount: number\) => \{/g, `function handleBidSubmit(item: any, amount: number) {`);
code = code.replace(/function handleCancelTerms\(\) => \{/g, `function handleCancelTerms() {`);
code = code.replace(/function handleAcceptTerms\(\) => \{/g, `function handleAcceptTerms() {`);
code = code.replace(/function handleCancelConfirmBid\(\) => \{/g, `function handleCancelConfirmBid() {`);
code = code.replace(/async function handleConfirmBid\(\) => \{/g, `async function handleConfirmBid() {`);
code = code.replace(/function handleDeliveryMethodSubmit\(method: any\) => \{/g, `function handleDeliveryMethodSubmit(method: any) {`);
code = code.replace(/function handleReceiptConfirmSubmit\(\) => \{/g, `function handleReceiptConfirmSubmit() {`);
code = code.replace(/function handleRatingSubmit\(\) => \{/g, `function handleRatingSubmit() {`);

fs.writeFileSync('App.tsx', code);
