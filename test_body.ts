import http from 'http';
import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 10, type: 'auction', auction_id: 'test_id', seller_id: '123' })
  });
  console.log(await res.text());
}
test();
