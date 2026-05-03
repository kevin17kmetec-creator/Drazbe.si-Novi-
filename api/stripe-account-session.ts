import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

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

    // Check if user already has an account
    const { data: user } = await supabase.from('users').select('stripe_account_id').eq('id', user_id).single();
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
      await supabase.from('users').update({ stripe_account_id: accountId }).eq('id', user_id);
    }

    // Create an AccountSession
    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return res.status(200).json({ client_secret: accountSession.client_secret });
  } catch (error: any) {
    console.error("Stripe Account Session Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
