import { db } from './src/lib/firebase';
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, addDoc, query, where, limit, writeBatch } from 'firebase/firestore';
import { storage } from './src/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import express from "express";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";
import path from "path";

import { Resend } from 'resend';
import { generateInvoicePDF, generateCertificatePDF } from './src/lib/pdfGenerator';
import dotenv from 'dotenv';

dotenv.config();

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

    // Bracket 3: Anything above €5,000.01
    if (remainingAmount > 0) {
        totalFee += remainingAmount * (bracket3Rate / 100);
    }

    // Strict fallback rule: Cannot drop below 2% of the overall transaction value
    const absoluteMinimumFee = currentPrice * 0.02;
    if (totalFee < absoluteMinimumFee) {
        totalFee = absoluteMinimumFee;
    }

    return totalFee;
}

// Initialize Supabase admin client



// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  let stripeClient: Stripe | null = null;
  function getStripe(): Stripe {
    if (!stripeClient) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error('STRIPE_SECRET_KEY environment variable is required');
      }
      stripeClient = new Stripe(key);
    }
    return stripeClient;
  }

  // Webhook must be before express.json()
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
      event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      
      try {
        const { type, auction_id, buyer_id, seller_id, fee_percentage, user_id, package_id } = paymentIntent.metadata;

        if (type === 'subscription') {
            console.log('Processing subscription payment for user', user_id);
            // This revenue is 100% platform profit.
            // Just activate subscription in Supabase
            if (user_id && package_id) {
                await updateDoc(doc(db, 'users', user_id), { 
                    subscription_tier: package_id, 
                    subscription_active: true,
                    subscription_paid_at: new Date().toISOString()
                });
            }
            res.json({received: true});
            return;
        }

        // Default type is auction
        if (!auction_id || !buyer_id || !seller_id) {
            console.warn('Missing metadata for payment intent:', paymentIntent.id);
            res.json({received: true});
            return;
        }

        // 2. Fetch buyer and seller details
        const buyerDoc = await getDoc(doc(db, 'users', buyer_id));
    const buyer = buyerDoc.data();
        const sellerDoc = await getDoc(doc(db, 'users', seller_id));
    const seller = sellerDoc.data();

        if (!buyer || !seller) throw new Error('Buyer or seller not found');

        // 3. Calculate Fee and VAT dynamically based on active subscription tier and closing price
        const amountTotalInCents = paymentIntent.amount;
        const amountTotal = amountTotalInCents / 100;
        const platformFee = calculateMarginalPlatformFee(amountTotal, seller.subscription_tier);
        const platformFeeInCents = Math.round(platformFee * 100);
        
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
        } else {
            vatRate = 0;
        }

        const vatAmount = platformFee * (vatRate / 100);

        // 3.5 Credit the seller's internal wallet
        const sellerCreditInCents = amountTotalInCents - platformFeeInCents;
        let rpcData = null, rpcError = null; /* RPC call credit_user_balance omitted for firebase */
        if (rpcError) throw rpcError;

        // 4. Create Transaction Record
        let transaction = null, txError = null;
    try { 
      const ref = await addDoc(collection(db, 'transactions'), {
            auction_id,
            buyer_id,
            seller_id,
            stripe_payment_intent_id: paymentIntent.id,
            amount_total: amountTotal,
            platform_fee: platformFee,
            vat_amount: vatAmount,
            vat_rate: vatRate,
            is_reverse_charge: isReverseCharge,
            status: 'completed'
        });
      const snap = await getDoc(ref);
      transaction = { id: ref.id, ...snap.data() };
    } catch(e) { txError = e; }

        if (txError) throw txError;

        // 5. Update Auction Status to mark as paid
        let auctionUpdateError = null; try { await updateDoc(doc(db, 'auctions', auction_id), { 
                status: 'completed', payment_status: 'paid', post_auction_status: 'paid', paid_at: new Date().toISOString()
            }); } catch(e) { auctionUpdateError = e; }
            
        if (auctionUpdateError) {
            console.error('Error updating auction status:', auctionUpdateError);
        }

        // 6. Generate Documents
        const documentsToInsert = [];
        const attachments = [];

        // Generate Invoice for Platform Fee
        try {
            const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller);
            const invoiceFileName = `racun_${transaction.id.substring(0,8)}.pdf`;
            
            // Upload to Supabase Storage
            const fileRef = storageRef(storage, `${buyer_id}/${invoiceFileName}`);
            await uploadBytes(fileRef, invoicePdfBuffer);
            const publicUrl = await getDownloadURL(fileRef);
            
            documentsToInsert.push({
                transaction_id: transaction.id,
                user_id: buyer_id,
                type: 'invoice',
                file_url: publicUrl
            });
            
            attachments.push({
                filename: invoiceFileName,
                content: invoicePdfBuffer
            });
        } catch (pdfErr) {
            console.error('Error generating/uploading invoice PDF:', pdfErr);
        }

        // Generate Certificate for Individuals
        if (buyer.user_type !== 'business') {
            try {
                const certPdfBuffer = await generateCertificatePDF(transaction, buyer, seller);
                const certFileName = `potrdilo_${transaction.id.substring(0,8)}.pdf`;
                
                const fileRef = storageRef(storage, `${buyer_id}/${certFileName}`);
                await uploadBytes(fileRef, certPdfBuffer);
                const publicUrl = await getDownloadURL(fileRef);
                
                documentsToInsert.push({
                    transaction_id: transaction.id,
                    user_id: buyer_id,
                    type: 'certificate',
                    file_url: publicUrl
                });
                
                attachments.push({
                    filename: certFileName,
                    content: certPdfBuffer
                });
            } catch (certErr) {
                console.error('Error generating/uploading certificate PDF:', certErr);
            }
        }

        // Save document records
        if (documentsToInsert.length > 0) {
            const batch = writeBatch(db); documentsToInsert.forEach(doc => { const ref = doc(collection(db, 'documents')); batch.set(ref, doc); }); await batch.commit();
        }

        // 7. Send Real Email via Resend
        const buyerEmail = buyer.email;
        if (buyerEmail && process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
                    from: 'Drazba.si <obvestila@drazba.si>',
                    to: buyerEmail,
                    subject: 'Potrdilo o plačilu in dokumenti - Drazba.si',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #0A1128;">Pozdravljeni, ${buyer.first_name || 'uporabnik'}!</h2>
                            <p>Vaše plačilo za dražbo je bilo uspešno obdelano.</p>
                            <p>V priponki vam pošiljamo <strong>račun</strong> za opravljeno storitev ter <strong>potrdilo o nakupu</strong>.</p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="font-size: 12px; color: #666;">Ekipa Drazba.si</p>
                        </div>
                    `,
                    attachments: attachments
                });
                console.log(`Email sent successfully to ${buyerEmail}`);
            } catch (emailErr) {
                console.error('Error sending success email:', emailErr);
            }
        }

      } catch (err) {
          console.error("Error processing successful payment:", err);
      }
    }

    res.json({received: true});
  });

  app.use(express.json());

  // API routes FIRST
  
  app.post("/api/cron-auctions", async (req, res) => {
    try {
      const now = new Date();

      // 1. Process active auctions that have ended
      const activeSnap = await getDocs(query(collection(db, 'auctions'), where('status', '==', 'active')));
      const endedDocs = activeSnap.docs.filter(docSnap => {
        const data = docSnap.data();
        const endTime = data.end_time || data.endTime;
        return endTime && new Date(endTime).getTime() <= now.getTime();
      });

      for (let auctionDocItem of endedDocs) {
        const data = auctionDocItem.data();
        let hasBids = (data.bid_count > 0) || (data.bidCount > 0);
        if (hasBids) {
          const paymentDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
          await updateDoc(doc(db, 'auctions', auctionDocItem.id), {
            status: 'completed',
            post_auction_status: 'awaiting_payment_1st',
            payment_deadline: paymentDeadline
          });
        } else {
          // Unsold
          await updateDoc(doc(db, 'auctions', auctionDocItem.id), {
            status: 'completed',
            post_auction_status: 'unsold'
          });
        }
      }

      // 2. Process awaiting_payment_1st that expired
      const awaiting1stSnap = await getDocs(query(collection(db, 'auctions'), where('post_auction_status', '==', 'awaiting_payment_1st')));
      const expired1st = awaiting1stSnap.docs.filter(docSnap => {
        const data = docSnap.data();
        return data.payment_deadline && new Date(data.payment_deadline).getTime() <= now.getTime();
      });

      for (let auctionDocItem of expired1st) {
        const data = auctionDocItem.data();
        const winnerId = data.winner_id || data.winnerId;

        if (winnerId) {
          const userRef = doc(db, 'users', winnerId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const udata = userDoc.data();
            const newStrikes = (udata.unpaidStrikes || 0) + 1;
            const updates: any = { unpaidStrikes: newStrikes };
            if (newStrikes >= 3) {
              updates.isBlocked = true;
            }
            await updateDoc(userRef, updates);
          }
        }

        await updateDoc(doc(db, 'auctions', auctionDocItem.id), {
          post_auction_status: 'failed_1st'
        });
      }

      // 3. Process offered_2nd that expired (48h)
      const offered2ndSnap = await getDocs(query(collection(db, 'auctions'), where('post_auction_status', '==', 'offered_2nd')));
      const expiredOffers = offered2ndSnap.docs.filter(docSnap => {
        const data = docSnap.data();
        return data.second_chance_deadline && new Date(data.second_chance_deadline).getTime() <= now.getTime();
      });

      for (let auctionDocItem of expiredOffers) {
        await updateDoc(doc(db, 'auctions', auctionDocItem.id), {
          post_auction_status: 'archived'
        });
      }

      // 4. Process awaiting_payment_2nd that expired (24h)
      const awaiting2ndSnap = await getDocs(query(collection(db, 'auctions'), where('post_auction_status', '==', 'awaiting_payment_2nd')));
      const expired2nd = awaiting2ndSnap.docs.filter(docSnap => {
        const data = docSnap.data();
        return data.payment_deadline && new Date(data.payment_deadline).getTime() <= now.getTime();
      });

      for (let auctionDocItem of expired2nd) {
        await updateDoc(doc(db, 'auctions', auctionDocItem.id), {
          post_auction_status: 'archived'
        });
      }

      res.json({ success: true, processed: true });
    } catch (e: any) {
      console.error("Cron error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, return_url } = req.body;
      const stripe = getStripe();
      
      // Fetch the actual auction
      const auctionDoc = await getDoc(doc(db, 'auctions', auction_id));
    const auction = auctionDoc.data();
      const currentPrice = auction?.current_price || (amount / 1.122);

      const sellerDoc = await getDoc(doc(db, 'users', seller_id));
    const seller = sellerDoc.data();
      const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
      
      const buyerDoc = await getDoc(doc(db, 'users', buyer_id));
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
          // No more transfer_data! All funds go to the platform
          // The webhook handles crediting the seller's internal wallet
          metadata: {
            type: 'auction',
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

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage } = req.body;
      const stripe = getStripe();
      
      // Fetch the actual auction to securely determine the final bid price
      const auctionDoc = await getDoc(doc(db, 'auctions', auction_id));
    const auction = auctionDoc.data();
      const currentPrice = auction?.current_price || (amount / 1.122); // Fallback estimate if not found

      const sellerDoc = await getDoc(doc(db, 'users', seller_id));
    const seller = sellerDoc.data();
      const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
      
      // Calculate VAT for the platform fee
      const buyerDoc = await getDoc(doc(db, 'users', buyer_id));
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

      // Ensure platform fee does not exceed total amount (failsafe)
      const applicationFeeAmount = Math.min(Math.round(totalPlatformFeeGross * 100), Math.round(amount * 100));

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amounts in cents
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
            type: 'auction',
            auction_id,
            buyer_id,
            seller_id,
            fee_percentage
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe-account-link", async (req, res) => {
    try {
      const { user_id, userId, return_url, refresh_url } = req.body;
      const targetUserId = userId || user_id;
      const stripe = getStripe();

      // Check if user already has an account
      const userDocRef = doc(db, 'users', targetUserId);
      const userDoc = await getDoc(userDocRef);
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

    const parseDob = (dobStr: string) => {
        if (!dobStr) return undefined;
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
      await setDoc(userDocRef, { stripeAccountId: targetStripeAccountId }, { merge: true });
    } else {
      if (!user.stripe_onboarding_complete) {
         try {
             await stripe.accounts.update(targetStripeAccountId, accountParams);
         } catch (e: any) {
             console.error("Failed to update existing Stripe account:", e.message);
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
          
      // If onboarding is complete, generate a Login Link for the Express Dashboard
      if (targetStripeAccountId && user.stripe_onboarding_complete) {
          const loginLink = await stripe.accounts.createLoginLink(targetStripeAccountId);
          return res.json({ url: loginLink.url });
      }

      // Create an AccountLink for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: targetStripeAccountId,
        refresh_url: 'https://drazbe-si-novi.vercel.app/nastavitve',
        return_url: 'https://drazbe-si-novi.vercel.app/nastavitve?stripe=success',
        type: 'account_onboarding',
      });

      res.json({ url: accountLink.url });
    } catch (error: any) {
      console.error("Stripe Account Link Error:", error);
      res.status(500).json({ error: error.message || 'Stripe configuration error' });
    }
  });

  app.post("/api/stripe-check-account-status", async (req, res) => {
    try {
      const { user_id } = req.body;
      const stripe = getStripe();
      
      const userDocRef = doc(db, 'users', user_id);
      const userDoc = await getDoc(userDocRef);
      const user = userDoc.data() || {};
      
      let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;

      if (!targetStripeAccountId) {
        return res.json({ complete: false });
      }

      const account = await stripe.accounts.retrieve(targetStripeAccountId);
      
      const isComplete = account.details_submitted && account.charges_enabled;

      // Sync status to DB
      await userDocRef.set({ stripe_onboarding_complete: isComplete }, { merge: true });

      res.json({ complete: isComplete, account });
    } catch (error: any) {
      console.error("Stripe Check Account Status Error:", error);
      res.status(500).json({ error: error.message || 'Server configuration error' });
    }
  });

  // New wallet endpoint for auction payment
  app.post("/api/payments/wallet-pay-auction", async (req, res) => {
    try {
      const { amount, auction_id, buyer_id, seller_id, fee_percentage } = req.body;
      if (!auction_id || !buyer_id || !seller_id) {
          return res.status(400).json({ error: "Manjkajoči podatki" });
      }

      // Re-fetch auction price
      const auctionDoc = await getDoc(doc(db, 'auctions', auction_id));
    const auction = auctionDoc.data();
      const currentPrice = auction?.current_price || (amount / 1.122);
      
      const sellerDoc = await getDoc(doc(db, 'users', seller_id));
    const seller = sellerDoc.data();
      const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
      
      const amountTotalInCents = Math.round(amount * 100);
      const platformFeeInCents = Math.round(platformFee * 100);

      // Execute internal wallet payment
      let rpcData = null, rpcError = null; /* RPC call execute_internal_wallet_payment omitted for firebase */
      if (rpcError) throw rpcError;

      // Create Transaction Record
      let transaction = null, txError = null;
    try { 
      const ref = await addDoc(collection(db, 'transactions'), {
          auction_id,
          buyer_id,
          seller_id,
          amount_total: currentPrice,
          platform_fee: Math.round(platformFee),
          vat_amount: 0, // Simplified for wallet pay, can be enhanced
          vat_rate: 22,
          is_reverse_charge: false,
          status: 'completed',
          payment_method: 'wallet'
      });
      const snap = await getDoc(ref);
      transaction = { id: ref.id, ...snap.data() };
    } catch(e) { txError = e; }

      if (txError) throw txError;

      // Update auction
      await updateDoc(doc(db, 'auctions', auction_id), { status: 'completed', payment_status: 'paid', post_auction_status: 'paid', paid_at: new Date().toISOString() });

      // Generate Documents asynchronously to not block the request
      const buyerDoc = await getDoc(doc(db, 'users', buyer_id));
    const buyer = buyerDoc.data();
      
      if (buyer && seller && transaction) {
          (async () => {
             const documentsToInsert = [];
             const attachments = [];
             
             try {
                 const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller);
                 const invoiceFileName = `racun_${transaction.id.substring(0,8)}.pdf`;
                 
                 const fileRef = storageRef(storage, `${buyer_id}/${invoiceFileName}`);
            await uploadBytes(fileRef, invoicePdfBuffer);
            const publicUrl = await getDownloadURL(fileRef);
                 
                 documentsToInsert.push({ transaction_id: transaction.id, user_id: buyer_id, type: 'invoice', file_url: publicUrl });
                 attachments.push({ filename: invoiceFileName, content: invoicePdfBuffer });
             } catch(e) { console.error('Invoice error:', e); }
 
             if (buyer.user_type !== 'business') {
                 try {
                     const certPdfBuffer = await generateCertificatePDF(transaction, buyer, seller);
                     const certFileName = `potrdilo_${transaction.id.substring(0,8)}.pdf`;
                     
                     const fileRef = storageRef(storage, `${buyer_id}/${certFileName}`);
                await uploadBytes(fileRef, certPdfBuffer);
                const publicUrl = await getDownloadURL(fileRef);
                     
                     documentsToInsert.push({ transaction_id: transaction.id, user_id: buyer_id, type: 'certificate', file_url: publicUrl });
                     attachments.push({ filename: certFileName, content: certPdfBuffer });
                 } catch(e) { console.error('Cert error:', e); }
             }

             if (documentsToInsert.length > 0) {
                 const batch = writeBatch(db); documentsToInsert.forEach(doc => { const ref = doc(collection(db, 'documents')); batch.set(ref, doc); }); await batch.commit();
             }

             if (buyer.email && process.env.RESEND_API_KEY) {
                 await resend.emails.send({
                     from: 'Drazba.si <obvestila@drazba.si>',
                     to: buyer.email,
                     subject: 'Potrdilo o internem plačilu in dokumenti - Drazba.si',
                     html: `<p>Vaše plačilo z dobroimetjem je bilo uspešno obdelano.</p>`,
                     attachments: attachments
                 });
             }
          })();
      }

      console.log('Auction paid via wallet:', auction_id);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Wallet pay auction error:", error);
      res.status(500).json({ error: error.message || "Napaka pri plačilu" });
    }
  });

  // New wallet endpoint for subscription payment
  app.post("/api/payments/wallet-pay-subscription", async (req, res) => {
    try {
      const { user_id, package_id, amount } = req.body;
      const amountTotalInCents = Math.round(amount * 100);

      let rpcData = null, rpcError = null; /* RPC call execute_internal_subscription_payment omitted for firebase */
      if (rpcError) throw rpcError;

      await updateDoc(doc(db, 'users', user_id), { 
          subscription_tier: package_id, 
          subscription_active: true,
          subscription_paid_at: new Date().toISOString()
      });

      console.log('Subscription paid via wallet:', package_id);
      res.json({ success: true });
      
    } catch (error: any) {
      console.error("Wallet pay subscription error:", error);
      res.status(500).json({ error: error.message || "Napaka" });
    }
  });

  // Payout endpoint
  app.post("/api/payouts/withdraw", async (req, res) => {
    try {
      const { user_id, amount, return_url, refresh_url } = req.body;
      const amountInCents = Math.round(amount * 100);
      const stripe = getStripe();

      // Check balance and connected account
      const userDocRef = doc(db, 'users', user_id);
      const userDoc = await getDoc(userDocRef);
      const user = userDoc.data() || {};
      const balanceDataSnap = await getDocs(query(collection(db, 'user_balances'), where('user_id', '==', user_id), limit(1)));
      const balanceData = balanceDataSnap.empty ? null : balanceDataSnap.docs[0].data();
      if (!balanceData || balanceData.available_balance < amountInCents) {
          return res.status(400).json({ error: "Stanje na računu je prenizko." });
      }
      let accountId = user.stripeAccountId || user.stripe_account_id;
      if (!accountId) {
          // IF NO: Create connected account
          const account = await stripe.accounts.create({
              type: 'express',
              country: 'SI',
              email: user.email,
              capabilities: {
                  transfers: { requested: true },
                  card_payments: { requested: true }
              },
          });
          accountId = account.id;
          await userDocRef.set({ stripeAccountId: accountId }, { merge: true });
      }

      const isComplete = user?.stripe_onboarding_complete;

      if (!isComplete) {
          // Create Account Link for onboarding (Deferred KYC)
          const accountLink = await stripe.accountLinks.create({
              account: accountId,
              refresh_url: refresh_url || 'http://localhost:3000',
              return_url: return_url || 'http://localhost:3000',
              type: 'account_onboarding',
          });
          return res.json({ url: accountLink.url, status: 'requires_onboarding' });
      }

      // IF YES: Deduct balance and transfer funds
      let rpcError = null; /* RPC call debit_user_balance omitted for firebase */
      if (rpcError) throw rpcError;

      // Transfer to connected account
      const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: 'eur',
          destination: accountId,
          description: `Izplačilo za uporabnika ${user_id}`
      });

      // Usually custom accounts require payout explicitly if automatic is off
      const payout = await stripe.payouts.create(
          { amount: amountInCents, currency: 'eur' },
          { stripeAccount: accountId }
      );

      res.json({ success: true, transfer_id: transfer.id, payout_id: payout.id });
    } catch (error: any) {
      console.error("Payout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/create-subscription-checkout", async (req, res) => {
    try {
      const { amount, currency = "eur", user_id, package_id, return_url } = req.body;
      const stripe = getStripe();

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency,
            product_data: {
              name: `Naročnina - Paket ${package_id}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        payment_intent_data: {
          metadata: {
            type: 'subscription',
            user_id,
            package_id,
            amount: amount.toString()
          }
        },
        mode: 'payment', // using payment mode for one-time subscription charge
        success_url: `${return_url}?payment=success`,
        cancel_url: `${return_url}?payment=cancel`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Subscription Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/create-verification-session", async (req, res) => {
    try {
      const stripe = getStripe();
      const session = await stripe.identity.verificationSessions.create({
        type: 'document',
        options: {
          document: {
            require_id_number: true,
            require_matching_selfie: true,
          },
        },
      });
      res.json({ clientSecret: session.client_secret });
    } catch (error: any) {
      console.error("Stripe Identity error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
