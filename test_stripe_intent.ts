import fetch from 'node-fetch';

async function test() {
  const req = await fetch('http://localhost:3000/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 100, user_id: '123' })
  });
  console.log(await req.text());
}
test();
