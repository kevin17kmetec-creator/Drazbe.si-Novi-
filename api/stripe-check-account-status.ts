import { admin, db } from '../src/lib/firebase-admin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    const { user_id } = req.body;
    
    const userDocRef = db.collection('users').doc(user_id);
    const userDoc = await userDocRef.get();
    const user = userDoc.data() || {};
    
    let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;

    if (!targetStripeAccountId) {
      return res.status(200).json({ complete: false });
    }

    const account = await stripe.accounts.retrieve(targetStripeAccountId);
    
    const isComplete = account.details_submitted && account.charges_enabled;

    // Sync status to DB
    await userDocRef.set({ stripe_onboarding_complete: isComplete }, { merge: true });

    return res.status(200).json({ complete: isComplete, account });
  } catch (error: any) {
    console.error("Stripe Check Account Status Error:", error);
    return res.status(500).json({ error: error.message || 'Server configuration error' });
  }
}
