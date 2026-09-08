import fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const oldCode = `        // Credit seller's wallet
        const currentWallet = Number(seller.wallet_balance) || 0;
        await adminDb.collection('users').doc(seller_id).update({
          wallet_balance: currentWallet + currentPrice
        });`;
const newCode = `        // Credit seller's held wallet
        const currentPriceCents = Math.round(currentPrice * 100);
        await addHeldFunds(seller_id, currentPriceCents, 'stripe_' + paymentId, { stripe_payment_intent_id: paymentId, auction_id });`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/server/app.ts', code);
