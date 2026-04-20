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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_id } = req.body;
    
    const { data: user } = await supabase.from('users').select('stripe_account_id').eq('id', user_id).single();
    
    if (!user?.stripe_account_id) {
      return res.status(200).json({ complete: false });
    }

    const account = await stripe.accounts.retrieve(user.stripe_account_id);
    
    const isComplete = account.details_submitted && account.charges_enabled;

    // Sync status to DB
    await supabase.from('users').update({ stripe_onboarding_complete: isComplete }).eq('id', user_id);

    return res.status(200).json({ complete: isComplete, account });
  } catch (error: any) {
    console.error("Stripe Check Account Status Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
