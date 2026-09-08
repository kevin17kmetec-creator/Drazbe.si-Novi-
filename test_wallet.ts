import { adminDb, FieldValue } from './src/lib/firebase-admin';
import { reserveWalletFunds, releaseHeldFunds } from './src/server/walletService';

async function run() {
  const user = await adminDb.collection('users').doc('TEST_SELLER').get();
  if (!user.exists) {
    await adminDb.collection('users').doc('TEST_SELLER').set({
       available_cents: 26000,
       held_cents: 0,
       reserved_cents: 0
    });
  } else {
    await adminDb.collection('users').doc('TEST_SELLER').update({
       available_cents: 26000,
       held_cents: 0,
       reserved_cents: 0
    });
  }

  // test reserve
  const tx = await reserveWalletFunds('TEST_SELLER', 1000, 'withdrawal', 'idemp_test_1');
  console.log("Tx id:", tx);
  const u2 = (await adminDb.collection('users').doc('TEST_SELLER').get()).data();
  console.log("After reserve:", u2);
}
run().then(() => console.log('Done')).catch(console.error);
