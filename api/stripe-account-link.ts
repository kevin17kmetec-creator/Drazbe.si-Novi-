import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { db } from '../src/lib/firebase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing userId in request body' });

    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    const user = userDoc.data() || {};

    let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;

    if (!targetStripeAccountId) {
      
      const isBusiness = user.user_type === 'business' || user.userType === 'business';
      const businessType = isBusiness ? 'company' : 'individual';
      
      const accountParams: any = {
        type: 'express',
        country: user.country_code || 'SI',
        email: user.email,
        business_type: businessType,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }
        }
      };
      
      if (isBusiness) {
        accountParams.company = {
          phone: user.phone || undefined,
          name: user.company_name || user.companyName || undefined,
          address: {
            line1: user.company_street || user.companyStreet || undefined,
            city: user.company_city || user.companyCity || undefined,
            postal_code: user.company_postal_code || user.companyPostalCode || undefined,
            country: user.country_code || 'SI'
          }
        };
      } else {
        accountParams.individual = {
          phone: user.phone || undefined,
          first_name: user.first_name || user.firstName || undefined,
          last_name: user.last_name || user.lastName || undefined,
          email: user.email || undefined,
          address: {
            line1: user.street || undefined,
            city: user.city || undefined,
            postal_code: user.postal_code || user.postalCode || undefined,
            country: user.country_code || 'SI'
          }
        };
      }

      const account = await stripe.accounts.create(accountParams);
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
    console.error("Stripe Account Link Error:", err);
    return res.status(500).json({ 
      error: err.message, 
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  }
}
