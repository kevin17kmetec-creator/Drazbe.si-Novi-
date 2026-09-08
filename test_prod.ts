import fetch from 'node-fetch';

async function test() {
  const res = await fetch('https://ais-dev-75i4wcu666i5her4hkgy7p-20368539723.europe-west3.run.app/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 10, type: 'auction', auction_id: 'test_id', seller_id: '123' })
  });
  console.log(await res.text());
}
test();
