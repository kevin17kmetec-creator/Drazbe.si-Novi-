import { admin, db } from '../src/lib/firebase-admin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { generateInvoicePDF, generateCertificatePDF } from '../src/lib/pdfGenerator.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const resend = new Resend(process.env.RESEND_API_KEY);

function calculateMarginalPlatformFee(currentPrice: number, subscriptionTier: string | null | undefined): number {
  let bracket1Rate = 8;
  let bracket2Rate = 5;
  let bracket3Rate = 4;

  if (subscriptionTier === 'PRO') {
    bracket1Rate = 3;
    bracket2Rate = 2.5;
    bracket3Rate = 2;
  } else if (subscriptionTier === 'BASIC') {
    bracket1Rate = 6.5;
    bracket2Rate = 4;
    bracket3Rate = 3.2;
  }

  let totalFee = 0;
  let remainingAmount = currentPrice;

  // Bracket 1: €0 to €1,000
  if (remainingAmount > 0) {
    const amountInBracket = Math.min(remainingAmount, 1000);
    totalFee += amountInBracket * (bracket1Rate / 100);
    remainingAmount -= amountInBracket;
  }

  // Bracket 2: €1,000.01 to €5,000
  if (remainingAmount > 0) {
    const amountInBracket = Math.min(remainingAmount, 4000);
    totalFee += amountInBracket * (bracket2Rate / 100);
    remainingAmount -= amountInBracket;
  }

  // Bracket 3: Over €5,000
  if (remainingAmount > 0) {
    totalFee += remainingAmount * (bracket3Rate / 100);
  }

  return totalFee;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { sessionId, auctionId } = req.body || {};

    if (!sessionId && !auctionId) {
      return res.status(400).json({ error: 'Missing sessionId or auctionId parameter' });
    }

    let session: Stripe.Checkout.Session | null = null;
    let paymentIntent: Stripe.PaymentIntent | null = null;

    if (sessionId) {
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['payment_intent']
        });
      } catch (err: any) {
        console.error('Error retrieving session:', err);
      }
    }

    if (session) {
      const isPaid = session.payment_status === 'paid' || session.status === 'complete';
      if (!isPaid) {
        return res.status(400).json({ error: 'Payment not completed for this session', status: session.status });
      }

      paymentIntent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
      const metadata = session.metadata || (paymentIntent ? paymentIntent.metadata : {}) || {};

      const type = metadata.type || 'auction';
      const effectiveAuctionId = metadata.auction_id || auctionId;
      const effectiveBuyerId = metadata.buyer_id || metadata.user_id;
      const effectiveSellerId = metadata.seller_id;

      if (type === 'subscription') {
        const userId = metadata.user_id || effectiveBuyerId;
        const packageId = metadata.package_id || 'PRO';
        if (userId) {
          await db.collection('users').doc(userId).set({
            subscription_tier: packageId,
            subscription_active: true,
            subscription_paid_at: new Date().toISOString()
          }, { merge: true });
        }
        return res.status(200).json({ success: true, type: 'subscription' });
      }

      if (effectiveAuctionId) {
        // Mark auction as paid in Firestore
        await db.collection('auctions').doc(effectiveAuctionId).set({
          status: 'completed',
          payment_status: 'paid',
          post_auction_status: 'paid',
          paid_at: new Date().toISOString()
        }, { merge: true });

        // Update transaction and AML records if buyer and seller exist
        if (effectiveBuyerId && effectiveSellerId) {
          const buyerDoc = await db.collection('users').doc(effectiveBuyerId).get();
          const buyer = buyerDoc.data() || {};
          const sellerDoc = await db.collection('users').doc(effectiveSellerId).get();
          const seller = sellerDoc.data() || {};

          const amountTotal = (session.amount_total || (paymentIntent ? paymentIntent.amount : 0)) / 100;
          const platformFee = calculateMarginalPlatformFee(amountTotal, seller.subscription_tier);

          let vatRate = 0;
          let isReverseCharge = false;
          const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
          const buyerCountry = buyer.country_code || 'SI';
          if (buyerCountry === 'SI') {
            vatRate = 22;
          } else if (euCountries.includes(buyerCountry)) {
            if (buyer.company_status === 'company' && buyer.tax_id) {
              isReverseCharge = true;
              vatRate = 0;
            } else {
              vatRate = 22;
            }
          }

          const vatAmount = platformFee * (vatRate / 100);

          // Check if transaction already created to avoid duplication
          const existingTx = await db.collection('transactions')
            .where('stripe_payment_intent_id', '==', (paymentIntent?.id || session.id))
            .limit(1)
            .get();

          let transactionId = '';
          if (existingTx.empty) {
            const txRef = await db.collection('transactions').add({
              auction_id: effectiveAuctionId,
              buyer_id: effectiveBuyerId,
              seller_id: effectiveSellerId,
              stripe_payment_intent_id: paymentIntent?.id || session.id,
              stripe_session_id: session.id,
              amount_total: amountTotal,
              platform_fee: platformFee,
              vat_amount: vatAmount,
              vat_rate: vatRate,
              is_reverse_charge: isReverseCharge,
              status: 'completed',
              created_at: new Date().toISOString()
            });
            transactionId = txRef.id;
          } else {
            transactionId = existingTx.docs[0].id;
          }

          // Update buyer spending for EU AML law (10k annual limit)
          try {
            const currentYear = new Date().getFullYear();
            const currentYearSpent = (buyer.yearly_spent_by_year && buyer.yearly_spent_by_year[currentYear])
              ? Number(buyer.yearly_spent_by_year[currentYear]) || 0
              : (buyer.yearly_spent_year === currentYear && typeof buyer.yearly_spent === 'number')
                ? buyer.yearly_spent
                : 0;

            const updatedYearlySpent = currentYearSpent + amountTotal;
            const updatedTotalSpent = (Number(buyer.total_spent) || 0) + amountTotal;
            const updatedPurchasesCount = (Number(buyer.purchases_count) || 0) + 1;

            await db.collection('users').doc(effectiveBuyerId).set({
              yearly_spent: updatedYearlySpent,
              yearly_spent_year: currentYear,
              [`yearly_spent_by_year.${currentYear}`]: updatedYearlySpent,
              total_spent: updatedTotalSpent,
              purchases_count: updatedPurchasesCount,
              last_purchase_at: new Date().toISOString()
            }, { merge: true });
          } catch (amlErr) {
            console.error('Error updating AML buyer stats in confirm:', amlErr);
          }
        }

        return res.status(200).json({
          success: true,
          paid: true,
          auction_id: effectiveAuctionId
        });
      }
    } else if (auctionId) {
      // Direct auction confirmation
      await db.collection('auctions').doc(auctionId).set({
        status: 'completed',
        payment_status: 'paid',
        post_auction_status: 'paid',
        paid_at: new Date().toISOString()
      }, { merge: true });

      return res.status(200).json({
        success: true,
        paid: true,
        auction_id: auctionId
      });
    }

    return res.status(400).json({ error: 'Could not confirm payment' });
  } catch (error: any) {
    console.error('Error confirming checkout session:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
