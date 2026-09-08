import { adminDb } from './src/lib/firebase-admin';

async function run() {
  await adminDb.collection('auctions').doc('TEST_AUCTION_20').set({
    title: { SLO: 'Test Dražba', EN: 'Test Auction' },
    current_price: "20,00",
    status: 'completed',
    post_auction_status: 'awaiting_payment_1st'
  });
  console.log("Created test auction");
}
run();
