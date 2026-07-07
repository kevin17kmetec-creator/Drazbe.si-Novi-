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
    const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, return_url } = req.body;
      
    // Fetch the actual auction
    const auctionDoc = await db.collection('auctions').doc(auction_id).get();
    const auction = auctionDoc.data();
    const currentPrice = auction?.current_price || (amount / 1.122);

    // Fee calculations
    const feePercentage = Number(fee_percentage) || 10;
    const platformFee = currentPrice * (feePercentage / 100);
    
    const buyerDoc = await db.collection('users').doc(buyer_id).get();
    const buyer = buyerDoc.data();
    let vatRate = 0;
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
    const applicationFeeAmount = Math.min(Math.round(totalPlatformFeeGross * 100), Math.round(amount * 100));

    const sellerDoc = await db.collection('users').doc(seller_id).get();
    const seller = sellerDoc.data();
    
    if (!seller?.stripe_account_id || !seller?.stripe_onboarding_complete) {
       return res.status(400).json({ error: "Prodajalec še nima nastavljenega računa za prejemanje plačil." });
    }

    // Title parsing
    let auctionTitle = "Dražba";
    if (auction?.title) {
       auctionTitle = auction.title['SLO'] || auction.title['EN'] || "Dražba";
    }

    const session = await stripe.checkout.sessions.create({
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
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: seller.stripe_account_id,
        },
        metadata: {
          auction_id,
          buyer_id,
          seller_id,
          fee_percentage
        }
      },
      mode: 'payment',
      success_url: `${return_url}?payment=success`,
      cancel_url: `${return_url}?payment=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
