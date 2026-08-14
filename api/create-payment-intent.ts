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
    const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, user_id, userId } = req.body;
    const effectiveBuyerId = buyer_id || user_id || userId;

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    if (!amount || typeof amount !== 'number') {
      throw new Error('Podan ni bil ustrezen znesek (amount).');
    }

    // Fetch the actual auction to securely determine the final bid price
    let currentPrice = amount / 1.122; // Fallback
    if (auction_id) {
        const auctionDoc = await db.collection('auctions').doc(auction_id).get();
        const auction = auctionDoc.data();
        if (auction?.current_price) {
           currentPrice = auction.current_price;
        }
    }

    // Calculate platform fee
    const feePercentage = Number(fee_percentage) || 10;
    const platformFee = currentPrice * (feePercentage / 100);
    
    // Check user and get/create stripe customer
    let buyer: any = null;
    let stripeCustomerId: string | null = null;
    let vatRate = 0;

    if (effectiveBuyerId) {
      const buyerDoc = await db.collection('users').doc(effectiveBuyerId).get();
      buyer = buyerDoc.exists ? buyerDoc.data() : null;
      if (buyer) {
        stripeCustomerId = await getOrCreateStripeCustomer(effectiveBuyerId, buyer);

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

    const payload: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
          auction_id: auction_id || '',
          buyer_id: effectiveBuyerId || '',
          seller_id: seller_id || '',
          fee_percentage: feePercentage
      }
    };

    if (stripeCustomerId) {
      payload.customer = stripeCustomerId;
    }
    if (buyer?.email) {
      payload.receipt_email = buyer.email;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create(payload);
      return res.status(200).json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (stripeErr: any) {
      console.error("Stripe API Native Error:", stripeErr);
      return res.status(500).json({ 
        error: "Stripe zavrnil transakcijo - preveri konzolo",
        details: stripeErr.raw || stripeErr.message || stripeErr 
      });
    }

  } catch (error: any) {
    console.error('General Stripe Payment Intent Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
