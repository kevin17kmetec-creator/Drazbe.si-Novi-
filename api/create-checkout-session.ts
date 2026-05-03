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
    const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, return_url } = req.body;
      
    // Fetch the actual auction
    const { data: auction } = await supabase.from('auctions').select('current_price, title').eq('id', auction_id).single();
    const currentPrice = auction?.current_price || (amount / 1.122);

    // Fee calculations
    const feePercentage = Number(fee_percentage) || 10;
    const platformFee = currentPrice * (feePercentage / 100);
    
    const { data: buyer } = await supabase.from('users').select('country_code, company_status, tax_id').eq('id', buyer_id).single();
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

    const { data: seller } = await supabase.from('users').select('stripe_account_id, stripe_onboarding_complete').eq('id', seller_id).single();
    
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
