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
    const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage } = req.body;
    
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
    
    // Calculate VAT for the platform fee
    let vatRate = 0;
    if (buyer_id) {
        const buyerDoc = await db.collection('users').doc(buyer_id).get();
    const buyer = buyerDoc.data();
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
    }
    
    const vatAmount = platformFee * (vatRate / 100);
    const totalPlatformFeeGross = platformFee + vatAmount;

    // Ensure platform fee does not exceed total amount (failsafe)
    let applicationFeeAmount = Math.min(Math.round(totalPlatformFeeGross * 100), Math.round(amount * 100));

    // Fetch seller connected account
    let sellerAccountId = null;
    if (seller_id && seller_id !== 'dizain-doo' && !seller_id.startsWith('sell')) {
        // Query database safely
        const sellerDoc = await admin.firestore().collection('users').doc(seller_id).get();
        const seller = sellerDoc.exists ? sellerDoc.data() : null;
        const error = null;
        
        if (error || !seller) {
           return res.status(400).json({ error: "Prodajalca ni mogoče najti v bazi, prenos sredstev ni mogoč." });
        }

        const accountId = seller.stripe_account_id;
        if (!accountId || !seller.stripe_onboarding_complete) {
           return res.status(400).json({ error: "Prodajalec še nima nastavljenega Stripe računa za prejemanje plačil! Nakupa ni mogoče izvesti." });
        }
        sellerAccountId = accountId;
    }

    const payload: any = {
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
          auction_id: auction_id || '',
          buyer_id: buyer_id || '',
          seller_id: seller_id || '',
          fee_percentage: feePercentage
      }
    };

    if (sellerAccountId) {
        if (applicationFeeAmount > 0) {
            payload.application_fee_amount = applicationFeeAmount;
        }
        payload.transfer_data = {
           destination: sellerAccountId
        };
        console.log("Creating direct destination charge for account:", sellerAccountId, "with fee:", applicationFeeAmount);
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
