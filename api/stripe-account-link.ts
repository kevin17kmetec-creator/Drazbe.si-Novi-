import { admin, db } from '../src/lib/firebase-admin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('Stripe configuration error: STRIPE_SECRET_KEY is missing');
    }
    const stripe = new Stripe(stripeKey);

    const { user_id, return_url, refresh_url } = req.body;

    // Check if user already has an account
    const userDocRef = db.collection('users').doc(user_id);
    const userDoc = await userDocRef.get();
    const user = userDoc.data() || {};
    
    let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;

    if (!targetStripeAccountId) {
      // Create an Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'SI',
        email: user.email,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }
        }
      });
      targetStripeAccountId = account.id;

      // Save to DB
      await userDocRef.set({ stripeAccountId: targetStripeAccountId }, { merge: true });
    }
        
    // If onboarding is complete, generate a Login Link for the Express Dashboard
    if (targetStripeAccountId && user.stripe_onboarding_complete) {
        const loginLink = await stripe.accounts.createLoginLink(targetStripeAccountId);
        return res.status(200).json({ url: loginLink.url });
    }

    // Create an AccountLink for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: targetStripeAccountId,
      refresh_url: 'https://drazbe-si-novi.vercel.app/nastavitve',
      return_url: 'https://drazbe-si-novi.vercel.app/nastavitve?stripe=success',
      type: 'account_onboarding',
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (error: any) {
    console.error("Stripe Account Link Error:", error);
    return res.status(500).json({ error: error.message || 'Stripe configuration error' });
  }
}
