import { adminDb } from './src/server/firebaseAdmin.ts';

async function test() {
  const auctionRef = await adminDb.collection('auctions').add({
    title: { SLO: 'Test', EN: 'Test' },
    current_price: "20,00",
    seller_id: 'test_seller_123',
  });
  console.log("Created Auction:", auctionRef.id);
  
  const req = await fetch('http://localhost:3000/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'auction', auction_id: auctionRef.id, buyer_id: 'buyer123', seller_id: 'test_seller_123' })
  });
  const res = await req.json();
  console.log("Stripe Result:", res);
}
test();
