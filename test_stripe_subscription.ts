import fetch from 'node-fetch';

async function test() {
  const req = await fetch('http://localhost:3000/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'subscription', amount: 50, planId: 'PRO', user_id: '123' })
  });
  console.log(await req.text());
}
test();
