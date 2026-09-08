import fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const oldCode = `    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{`;

const newCode = `    const customerId = await getOrCreateStripeCustomer(user_id);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { name: 'auto', address: 'auto' },
      payment_method_types: ['card'],
      line_items: [{`;

code = code.replace(oldCode, newCode);

const oldCode2 = `      payment_intent_data: {
        metadata: {
          type: 'subscription',`;
const newCode2 = `      payment_intent_data: {
        setup_future_usage: 'off_session',
        metadata: {
          type: 'subscription',`;

code = code.replace(oldCode2, newCode2);
fs.writeFileSync('src/server/app.ts', code);
