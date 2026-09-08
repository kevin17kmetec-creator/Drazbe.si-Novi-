import fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const old = `        // Refund buyer
        const buyerDoc = await safeGetDoc(adminDb.collection('users').doc(tx.buyer_id));
        if (buyerDoc.exists()) {
          const currentBalance = Number(buyerDoc.data().wallet_balance) || 0;
          await adminDb.collection('users').doc(tx.buyer_id).update({
            wallet_balance: currentBalance + Number(tx.amount_total || tx.amount)
          });
        }`;

const newCode = `        // Refund buyer from held funds
        const refundAmount = Number(tx.amount_total || tx.amount);
        const refundCents = Math.round(refundAmount * 100);
        await adminDb.runTransaction(async (t) => {
          const sellerRef = adminDb.collection('users').doc(tx.seller_id);
          const buyerRef = adminDb.collection('users').doc(tx.buyer_id);
          
          t.update(sellerRef, { held_cents: admin.firestore.FieldValue.increment(-refundCents) });
          t.update(buyerRef, { available_cents: admin.firestore.FieldValue.increment(refundCents) });
          
          const txRef = adminDb.collection('wallet_transactions').doc();
          t.set(txRef, {
             transaction_id: txRef.id,
             user_id: tx.buyer_id,
             type: 'refund',
             amount_cents: refundCents,
             status: 'completed',
             idempotency_key: 'refund_' + docSnap.id,
             created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });`;

code = code.replace(old, newCode.replace(/admin\.firestore\.FieldValue/g, 'FieldValue'));
fs.writeFileSync('src/server/app.ts', code);
