const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/function handleBidSubmit\(item: AuctionItem, amount: number\) \{/g, `async function handleBidSubmit(item: any, amount: number) {`);
code = code.replace(/toast\.error\(t\("login"\)\);\s*\n\s*setActiveView\("login"\);\s*\n\s*return;/g, `toast.error(t("login")); setActiveView("login"); return "login_required";`);
code = code.replace(/setShowConfirmBidModal\(true\);\s*\n\s*\}/g, `setShowConfirmBidModal(true); } return "success";`);

code = code.replace(/function handleDeliveryMethodSubmit\(method: 'personal' \| 'post'\)/g, `function handleDeliveryMethodSubmit(method: any)`);

fs.writeFileSync('App.tsx', code);
