const fs = require('fs');
let code = fs.readFileSync('src/server/app.ts', 'utf8');

code = code.replace(
  "app.post(\"/api/create-checkout-session\"",
  "app.get(\"/api/test-create-auction\", async (req, res) => {\n  const ref = await adminDb.collection('auctions').add({ title: { SLO: 'Test' }, current_price: '20,00', seller_id: '123' });\n  res.json({ id: ref.id });\n});\napp.post(\"/api/create-checkout-session\""
);

fs.writeFileSync('src/server/app.ts', code);
