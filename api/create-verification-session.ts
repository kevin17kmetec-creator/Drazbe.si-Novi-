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
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      options: {
        document: {
          require_id_number: true,
          require_matching_selfie: true,
        },
      },
    });

    return res.status(200).json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error('Stripe Identity Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
