import { admin, db } from '../src/lib/firebase-admin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');



export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id, return_url, refresh_url } = req.body;

    // Check if user already has an account
    const userDoc = await db.collection('users').doc(user_id).get();
    const user = userDoc.data();
    let accountId = user?.stripe_account_id;

    if (!accountId) {
      // Create an Express account
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }
        }
      });
      accountId = account.id;

      // Save to DB
      await db.collection('users').doc(user_id).update({ stripe_account_id: accountId });
    }
    
    // If onboarding is complete, generate a Login Link for the Express Dashboard
    if (accountId && user?.stripe_onboarding_complete) {
        const loginLink = await stripe.accounts.createLoginLink(accountId);
        return res.status(200).json({ url: loginLink.url });
    }

    // Create an AccountLink for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refresh_url,
      return_url: return_url,
      type: 'account_onboarding',
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (error: any) {
    console.error("Stripe Account Link Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
