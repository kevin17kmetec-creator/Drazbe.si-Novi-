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
    const isBusiness = user.user_type === 'business' || user.userType === 'business';
    const businessType = isBusiness ? 'company' : 'individual';

    let formattedPhone = undefined;
    if (user.phone) {
        let phone = user.phone.replace(/[^0-9+]/g, '');
        if (phone.startsWith('00')) {
            formattedPhone = '+' + phone.substring(2);
        } else if (phone.startsWith('0')) {
            formattedPhone = '+386' + phone.substring(1);
        } else if (!phone.startsWith('+')) {
            formattedPhone = '+386' + phone;
        } else {
            formattedPhone = phone;
        }
    }

    const parseDob = (dobStr) => {
        if (!dobStr) return undefined;
        // Assuming dobStr is YYYY-MM-DD
        const parts = dobStr.split('-');
        if (parts.length === 3) {
           return {
              day: parseInt(parts[2]),
              month: parseInt(parts[1]),
              year: parseInt(parts[0])
           };
        }
        return undefined;
    };

    const dob = user.dob ? parseDob(user.dob) : undefined;

    const accountParams: any = {
      email: user.email,
      business_type: businessType,
      business_profile: {
         url: 'https://drazbe.si',
         product_description: 'Sodelovanje in prodaja na spletni platformi',
         mcc: '5999',
         support_email: user.email,
         support_phone: formattedPhone || undefined,
         name: isBusiness ? (user.company_name || user.companyName) : `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() || undefined,
      }
    };
    
    if (isBusiness) {
      accountParams.company = {
        phone: formattedPhone || undefined,
        name: user.company_name || user.companyName || undefined,
        address: {
          line1: user.company_street || user.companyStreet || user.street || user.address?.street || undefined,
          city: user.company_city || user.companyCity || user.city || user.address?.city || undefined,
          postal_code: user.company_postal_code || user.companyPostalCode || user.postal_code || user.postalCode || user.address?.postcode || undefined,
          country: user.country_code || 'SI'
        }
      };
    } else {
      accountParams.individual = {
        phone: formattedPhone || undefined,
        first_name: user.first_name || user.firstName || undefined,
        last_name: user.last_name || user.lastName || undefined,
        email: user.email || undefined,
        dob: dob || undefined,
        address: {
          line1: user.street || user.address?.street || undefined,
          city: user.city || user.address?.city || undefined,
          postal_code: user.postal_code || user.postalCode || user.address?.postcode || undefined,
          country: user.country_code || 'SI'
        }
      };
    }

    if (!targetStripeAccountId) {
      accountParams.type = 'express';
      accountParams.country = user.country_code || 'SI';
      accountParams.capabilities = {
        transfers: { requested: true },
        card_payments: { requested: true }
      };
      
      const account = await stripe.accounts.create(accountParams);
      targetStripeAccountId = account.id;
      await userDocRef.set({ stripeAccountId: targetStripeAccountId }, { merge: true });
    } else {
      
      if (!user.stripe_onboarding_complete) {
         try {
             await stripe.accounts.update(targetStripeAccountId, accountParams);
         } catch (e: any) {
             console.error("Failed to update existing Stripe account:", e.message);
             // If it failed because of business_type or phone, try updating just the basic info
             try {
                const fallbackParams = { ...accountParams };
                delete fallbackParams.business_type;
                if (e.message.includes('phone')) {
                   if (fallbackParams.company) delete fallbackParams.company.phone;
                   if (fallbackParams.individual) delete fallbackParams.individual.phone;
                   if (fallbackParams.business_profile) delete fallbackParams.business_profile.support_phone;
                }
                await stripe.accounts.update(targetStripeAccountId, fallbackParams);
             } catch (fallbackErr: any) {
                console.error("Fallback update also failed:", fallbackErr.message);
             }
         }
      }

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
