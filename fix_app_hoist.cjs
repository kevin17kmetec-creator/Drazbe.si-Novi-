const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/const handleBidSubmit = /g, 'function handleBidSubmit');
code = code.replace(/const handleCancelTerms = /g, 'function handleCancelTerms');
code = code.replace(/const handleAcceptTerms = /g, 'function handleAcceptTerms');
code = code.replace(/const handleCancelConfirmBid = /g, 'function handleCancelConfirmBid');
code = code.replace(/const handleConfirmBid = /g, 'async function handleConfirmBid');
code = code.replace(/const handleDeliveryMethodSubmit = /g, 'function handleDeliveryMethodSubmit');
code = code.replace(/const handleReceiptConfirmSubmit = /g, 'function handleReceiptConfirmSubmit');
code = code.replace(/const handleRatingSubmit = /g, 'function handleRatingSubmit');

fs.writeFileSync('App.tsx', code);
