import fs from 'fs';
let code = fs.readFileSync('src/server/app.ts', 'utf8');

const old = `      if (type === 'subscription') {
        const targetUserId = user_id || buyer_id;
        console.log('Processing subscription payment for user', targetUserId);
        if (targetUserId && package_id) {
          await adminDb.collection('users').doc(targetUserId).update({
            subscription_tier: package_id,
            subscription_active: true,
            subscription_paid_at: new Date().toISOString()
          });
        }
        res.json({ received: true });
        return;
      }`;

const newCode = `      if (type === 'subscription') {
        const targetUserId = user_id || buyer_id;
        console.log('Processing subscription payment for user', targetUserId);
        if (targetUserId && package_id) {
          const updateData: any = {
            subscription_tier: package_id,
            subscription_active: true,
            subscription_paid_at: new Date().toISOString()
          };
          
          let paymentMethodId = null;
          let customerId = null;
          
          if (isSession && sessionObj?.payment_intent) {
            const pi = typeof sessionObj.payment_intent === 'string' 
              ? await stripe.paymentIntents.retrieve(sessionObj.payment_intent as string)
              : sessionObj.payment_intent;
            if (typeof pi === 'object' && pi.payment_method) {
               paymentMethodId = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method.id;
            }
          } else if (!isSession && paymentIntent?.payment_method) {
            paymentMethodId = typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method.id;
          }
          
          if (isSession && sessionObj?.customer) {
            customerId = typeof sessionObj.customer === 'string' ? sessionObj.customer : sessionObj.customer.id;
          } else if (!isSession && paymentIntent?.customer) {
            customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer.id;
          }
          
          if (paymentMethodId && customerId) {
            updateData.stripe_default_payment_method = paymentMethodId;
            updateData.stripe_customer_id = customerId;
          }
          
          await adminDb.collection('users').doc(targetUserId).update(updateData);
        }
        res.json({ received: true });
        return;
      }`;

code = code.replace(old, newCode);
fs.writeFileSync('src/server/app.ts', code);
