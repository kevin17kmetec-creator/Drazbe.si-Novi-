import fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const old1 = `    const sellerDocRef = adminDb.collection('users').doc(seller_id);
    const sellerDoc = await safeGetDoc(sellerDocRef);
    if (sellerDoc.exists()) {
      const currentBalance = Number(sellerDoc.data()?.wallet_balance) || 0;
      const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);
      await sellerDocRef.update({ wallet_balance: currentBalance + releaseAmount });
    }`;

const new1 = `    const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);
    const releaseCents = Math.round(releaseAmount * 100);
    await releaseHeldFunds(seller_id, releaseCents, 'release_' + tx_id, { auction_id, related_tx: tx_id });`;

code = code.replace(old1, new1);

const old2 = `      const sellerDoc = await safeGetDoc(adminDb.collection('users').doc(tx.seller_id));
      if (sellerDoc.exists()) {
        const currentBalance = Number(sellerDoc.data()?.wallet_balance) || 0;
        const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);
        await adminDb.collection('users').doc(tx.seller_id).update({
          wallet_balance: currentBalance + releaseAmount
        });
      }`;

const new2 = `      const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);
      const releaseCents = Math.round(releaseAmount * 100);
      await releaseHeldFunds(tx.seller_id, releaseCents, 'cron_release_' + tx.id, { auction_id: tx.auction_id, related_tx: tx.id });`;

code = code.replace(old2, new2);

fs.writeFileSync('src/server/app.ts', code);
