import { admin, db } from '../src/lib/firebase-admin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

function formatE164Phone(phoneStr?: string, defaultCountry = 'SI'): string | undefined {
  if (!phoneStr || typeof phoneStr !== 'string') return undefined;
  const cleaned = phoneStr.trim();
  if (!cleaned) return undefined;
  const digits = cleaned.replace(/[^0-9+]/g, '');
  if (!digits) return undefined;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return '+' + digits.substring(2);
  if (digits.startsWith('0')) {
    if (defaultCountry === 'SI') return '+386' + digits.substring(1);
    if (defaultCountry === 'AT') return '+43' + digits.substring(1);
    if (defaultCountry === 'DE') return '+49' + digits.substring(1);
    if (defaultCountry === 'HR') return '+385' + digits.substring(1);
    if (defaultCountry === 'IT') return '+39' + digits.substring(1);
    return '+386' + digits.substring(1);
  }
  return '+386' + digits;
}

function getCustomerFullName(user: any): string {
  if (!user) return '';
  const first = (user.first_name || user.firstName || '').trim();
  const last = (user.last_name || user.lastName || '').trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (user.company_name || user.companyName) return (user.company_name || user.companyName).trim();
  if (user.representative) return user.representative.trim();
  if (user.name) return user.name.trim();
  if (user.displayName) return user.displayName.trim();
  if (user.username) return user.username.trim();
  return '';
}

function getCustomerAddress(user: any): Stripe.AddressParam | undefined {
  if (!user) return undefined;
  const isBusiness = user.user_type === 'business' || user.userType === 'business';
  const line1 = (isBusiness ? (user.company_street || user.companyStreet) : null) || user.street || (typeof user.address === 'string' ? user.address : user.address?.street) || user.company_street || user.companyStreet || undefined;
  const city = (isBusiness ? (user.company_city || user.companyCity) : null) || user.city || user.address?.city || user.company_city || user.companyCity || undefined;
  const postal_code = (isBusiness ? (user.company_postal_code || user.companyPostalCode) : null) || user.postal_code || user.postalCode || user.address?.postcode || user.company_postal_code || user.companyPostalCode || undefined;
  const country = user.country_code || user.countryCode || (user.address && typeof user.address === 'object' ? user.address.country : null) || 'SI';

  if (!line1 && !city && !postal_code && !country) {
    return undefined;
  }
  return {
    line1: line1 || undefined,
    city: city || undefined,
    postal_code: postal_code || undefined,
    country: country || 'SI',
  };
}

async function getOrCreateStripeCustomer(userId: string, user: any): Promise<string | null> {
  if (!user || !user.email) return null;
  const email = user.email.trim();
  const name = getCustomerFullName(user);
  const phone = formatE164Phone(user.phone || user.phoneNumber || user.telephone, user.country_code || 'SI');
  const address = getCustomerAddress(user);

  let customerId = user.stripe_customer_id || user.stripeCustomerId;

  const customerPayload: Stripe.CustomerCreateParams = {
    email,
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    metadata: {
      user_id: userId,
      user_type: user.user_type || user.userType || 'individual',
    }
  };

  if (customerId) {
    try {
      await stripe.customers.update(customerId, customerPayload);
      return customerId;
    } catch (e: any) {
      console.warn("Could not update existing stripe customer, will search or create fresh:", e.message);
      customerId = null;
    }
  }

  if (!customerId) {
    try {
      const existingList = await stripe.customers.list({ email, limit: 1 });
      if (existingList.data.length > 0) {
        customerId = existingList.data[0].id;
        await stripe.customers.update(customerId, customerPayload);
      } else {
        const newCustomer = await stripe.customers.create(customerPayload);
        customerId = newCustomer.id;
      }
      
      if (userId && customerId) {
        await db.collection('users').doc(userId).set({ stripe_customer_id: customerId, stripeCustomerId: customerId }, { merge: true });
      }
    } catch (e: any) {
      console.error("Error creating/linking stripe customer:", e);
    }
  }

  return customerId;
}

function calculateMarginalPlatformFee(currentPrice: number, subscriptionTier: string | null | undefined): number {
    let bracket1Rate = 8;
    let bracket2Rate = 5;
    let bracket3Rate = 4;

    if (subscriptionTier === 'PRO' || subscriptionTier === 'pro') {
        bracket1Rate = 3;
        bracket2Rate = 2.5;
        bracket3Rate = 2;
    } else if (subscriptionTier === 'BASIC' || subscriptionTier === 'basic') {
        bracket1Rate = 6.5;
        bracket2Rate = 4;
        bracket3Rate = 3.2;
    }

    let totalFee = 0;
    let remainingAmount = currentPrice;

    if (remainingAmount > 0) {
        const amountInBracket = Math.min(remainingAmount, 1000);
        totalFee += amountInBracket * (bracket1Rate / 100);
        remainingAmount -= amountInBracket;
    }

    if (remainingAmount > 0) {
        const amountInBracket = Math.min(remainingAmount, 4000);
        totalFee += amountInBracket * (bracket2Rate / 100);
        remainingAmount -= amountInBracket;
    }

    if (remainingAmount > 0) {
        totalFee += remainingAmount * (bracket3Rate / 100);
    }

    const absoluteMinimumFee = currentPrice * 0.02;
    if (totalFee < absoluteMinimumFee) {
        totalFee = absoluteMinimumFee;
    }

    return totalFee;
}

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
    const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, return_url, type = "auction", user_id, userId } = req.body;
      
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Neveljaven znesek plačila.' });
    }

    const effectiveBuyerId = buyer_id || user_id || userId;
    let auctionTitle = "Plačilo";
    let sessionMetadata: any = { type: type || 'auction' };
    let buyer: any = null;
    let stripeCustomerId: string | null = null;

    // Check EU AML law: 10,000 € annual limit check for buyers without ID verification
    if (effectiveBuyerId) {
      const buyerDoc = await db.collection('users').doc(effectiveBuyerId).get();
      buyer = buyerDoc.exists ? buyerDoc.data() : null;
      
      if (buyer) {
        stripeCustomerId = await getOrCreateStripeCustomer(effectiveBuyerId, buyer);

        const currentYear = new Date().getFullYear();
        let currentYearSpent = 0;
        
        if (buyer.yearly_spent_by_year && buyer.yearly_spent_by_year[currentYear]) {
          currentYearSpent = Number(buyer.yearly_spent_by_year[currentYear]) || 0;
        } else if (buyer.yearly_spent_year === currentYear && typeof buyer.yearly_spent === 'number') {
          currentYearSpent = buyer.yearly_spent;
        }

        const prospectiveTotal = currentYearSpent + amount;
        const isVerified = !!(buyer.is_verified || buyer.is_id_verified || buyer.id_document_verified);

        // EU Law limit: 10,000 € / year without identity document verification
        if (prospectiveTotal > 10000 && !isVerified) {
          return res.status(400).json({ 
            error: "V skladu z zakonodajo EU (ZPPDFT-2 / AML) je za skupne letne nakupe nad 10.000 € obvezna identifikacija z osebnim dokumentom. Prosimo, verificirajte svoj profil v nastavitvah pred nadaljevanjem." 
          });
        }
      }
    }

    if (type === "auction" && auction_id) {
      // Fetch the actual auction
      const auctionDoc = await db.collection('auctions').doc(auction_id).get();
      const auction = auctionDoc.exists ? auctionDoc.data() : null;
      const currentPrice = auction?.current_price || (amount / 1.122);

      let sellerTier = 'free';
      if (seller_id) {
        const sellerDoc = await db.collection('users').doc(seller_id).get();
        const seller = sellerDoc.exists ? sellerDoc.data() : null;
        sellerTier = seller?.subscription_tier || 'free';
      }

      const platformFee = calculateMarginalPlatformFee(currentPrice, sellerTier);
      
      let vatRate = 22;
      if (buyer) {
        const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
        const buyerCountry = buyer.country_code || 'SI';
        if (buyerCountry === 'SI') {
            vatRate = 22;
        } else if (euCountries.includes(buyerCountry)) {
            if (buyer.company_status === 'company' && buyer.tax_id) {
                vatRate = 0;
            } else {
                vatRate = 22; 
            }
        }
      }
      
      const vatAmount = platformFee * (vatRate / 100);
      const totalPlatformFeeGross = platformFee + vatAmount;

      if (auction?.title) {
         auctionTitle = auction.title['SLO'] || auction.title['EN'] || "Dražba";
      }

      sessionMetadata = {
        type: 'auction',
        auction_id: auction_id || '',
        buyer_id: effectiveBuyerId || '',
        seller_id: seller_id || '',
        fee_percentage: fee_percentage || 10
      };
    } else if (type === "subscription") {
      auctionTitle = "Naročnina";
      sessionMetadata = {
        type: 'subscription',
        buyer_id: effectiveBuyerId || '',
        user_id: effectiveBuyerId || '',
      };
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: auctionTitle,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      metadata: sessionMetadata,
      payment_intent_data: {
        metadata: sessionMetadata
      },
      mode: 'payment',
      success_url: return_url && return_url.includes('/stripe-callback.html')
        ? `${return_url}?payment=success&session_id={CHECKOUT_SESSION_ID}`
        : `${return_url || 'https://www.drazbe.eu'}${return_url && return_url.includes('?') ? '&' : '?'}payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: return_url && return_url.includes('/stripe-callback.html')
        ? `${return_url}?payment=cancel`
        : `${return_url || 'https://www.drazbe.eu'}${return_url && return_url.includes('?') ? '&' : '?'}payment=cancel`,
    };

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      sessionParams.customer_update = {
        address: 'auto',
        name: 'auto',
        shipping: 'auto',
      };
    } else if (buyer?.email) {
      sessionParams.customer_email = buyer.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return res.status(500).json({ error: error.message || 'Napaka pri vzpostavitvi plačila.' });
  }
}
