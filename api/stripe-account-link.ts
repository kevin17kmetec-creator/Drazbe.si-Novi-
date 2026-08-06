import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { db } from '../src/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS & Options
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    console.log("Invoking Stripe account link API v1.0.1", req.body);
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing userId parameter' });

    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    const user = userDoc.data() || {};

    let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;

    if (!targetStripeAccountId) {
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
      await userDocRef.set({ stripeAccountId: targetStripeAccountId }, { merge: true });
    }

    if (targetStripeAccountId && user.stripe_onboarding_complete) {
        const loginLink = await stripe.accounts.createLoginLink(targetStripeAccountId);
        return res.status(200).json({ url: loginLink.url });
    }

    const accountLink = await stripe.accountLinks.create({
      account: targetStripeAccountId,
      refresh_url: 'https://drazbe-si-novi.vercel.app/nastavitve',
      return_url: 'https://drazbe-si-novi.vercel.app/nastavitve?stripe=success',
      type: 'account_onboarding',
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (err: any) {
    console.error("Stripe Onboarding Error:", err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
