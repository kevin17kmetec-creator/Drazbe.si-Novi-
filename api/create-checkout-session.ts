import { admin, db } from '../src/lib/firebase-admin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

function calculateMarginalPlatformFee(currentPrice: number, subscriptionTier: string | null | undefined): number {
    let bracket1Rate = 8;
    let bracket2Rate = 5;
    let bracket3Rate = 4;

    if (subscriptionTier === 'basic') {
        bracket1Rate = 6;
        bracket2Rate = 4;
        bracket3Rate = 3;
    } else if (subscriptionTier === 'pro') {
        bracket1Rate = 4;
        bracket2Rate = 2.5;
        bracket3Rate = 2;
    }

    let fee = 0;
    if (currentPrice <= 1000) {
        fee = currentPrice * (bracket1Rate / 100);
    } else if (currentPrice <= 10000) {
        fee = (1000 * (bracket1Rate / 100)) + ((currentPrice - 1000) * (bracket2Rate / 100));
    } else {
        fee = (1000 * (bracket1Rate / 100)) + (9000 * (bracket2Rate / 100)) + ((currentPrice - 10000) * (bracket3Rate / 100));
    }
    return fee;
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
    const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, return_url, type = "auction" } = req.body;
      
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Neveljaven znesek plačila.' });
    }

    let auctionTitle = "Plačilo";
    let sessionMetadata: any = { type: type || 'auction' };

    // Check EU AML law: 10,000 € annual limit check for buyers without ID verification
    if (buyer_id) {
      const buyerDoc = await db.collection('users').doc(buyer_id).get();
      const buyer = buyerDoc.exists ? buyerDoc.data() : null;
      
      if (buyer) {
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
      if (buyer_id) {
        const buyerDoc = await db.collection('users').doc(buyer_id).get();
        const buyer = buyerDoc.exists ? buyerDoc.data() : null;
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

      if (auction?.title) {
         auctionTitle = auction.title['SLO'] || auction.title['EN'] || "Dražba";
      }

      sessionMetadata = {
        type: 'auction',
        auction_id: auction_id || '',
        buyer_id: buyer_id || '',
        seller_id: seller_id || '',
        fee_percentage: fee_percentage || 10
      };
    } else if (type === "subscription") {
      auctionTitle = "Naročnina";
      sessionMetadata = {
        type: 'subscription',
        buyer_id: buyer_id || '',
        user_id: buyer_id || '',
      };
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
        // Escrow model: all payments go to platform account, credited upon fulfillment
        metadata: sessionMetadata
      },
      mode: 'payment',
      success_url: `${return_url || 'https://www.drazbe.eu'}?payment=success`,
      cancel_url: `${return_url || 'https://www.drazbe.eu'}?payment=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    return res.status(500).json({ error: error.message || 'Napaka pri vzpostavitvi plačila.' });
  }
}
