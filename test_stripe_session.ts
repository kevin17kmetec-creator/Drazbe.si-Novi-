import fetch from 'node-fetch';

async function test() {
  const req = await fetch('http://localhost:3000/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'auction', auction_id: 'PZ7O34c0wY4q5r6yZ14j', buyer_id: '123', seller_id: '123' })
  });
  console.log(await req.text());
}
test();
