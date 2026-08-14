const fs = require('fs');
let code = fs.readFileSync('src/components/MessagesView.tsx', 'utf8');

if (!code.includes("import { CheckoutFlow }")) {
    code = "import { CheckoutFlow } from './CheckoutFlow';\n" + code;
}

const target = `                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">`;
const replacement = `                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                            {currentChatConv && (
                                <CheckoutFlow auction={currentChatConv.auction} currentUserId={userId} />
                            )}`;

if (code.includes(target) && !code.includes("<CheckoutFlow")) {
    code = code.replace(target, replacement);
}

fs.writeFileSync('src/components/MessagesView.tsx', code);
console.log("MessagesView.tsx patched");
