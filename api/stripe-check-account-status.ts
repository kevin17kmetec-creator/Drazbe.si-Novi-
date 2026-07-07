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
    const { user_id } = req.body;
    
    const userDoc = await db.collection('users').doc(user_id).get();
    const user = userDoc.data();
    
    if (!user?.stripe_account_id) {
      return res.status(200).json({ complete: false });
    }

    const account = await stripe.accounts.retrieve(user.stripe_account_id);
    
    const isComplete = account.details_submitted && account.charges_enabled;

    // Sync status to DB
    await db.collection('users').doc(user_id).update({ stripe_onboarding_complete: isComplete });

    return res.status(200).json({ complete: isComplete, account });
  } catch (error: any) {
    console.error("Stripe Check Account Status Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
