import { GoogleGenAI } from '@google/genai';
import { db } from './src/lib/firebase';
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, addDoc, query, where, limit, writeBatch, runTransaction } from 'firebase/firestore';
import { storage } from './src/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import express from "express";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";
import path from "path";

import { Resend } from 'resend';
import { generateInvoicePDF, generateCertificatePDF } from './src/lib/pdfGenerator';
import { sendOutbidNotification, sendEndingSoonNotification, sendAuctionWonNotification, sendPaymentReminderNotification } from './src/server/emailService';
import { processAuctionCrons } from './src/server/cronProcessor';
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

async function getOrCreateStripeCustomer(stripe: Stripe, userId: string, user: any): Promise<string | null> {
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
        await setDoc(doc(db, 'users', userId), { stripe_customer_id: customerId, stripeCustomerId: customerId }, { merge: true });
      }
    } catch (e: any) {
      console.error("Error creating/linking stripe customer:", e);
    }
  }

  return customerId;
}

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

    if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
      let isSession = event.type === 'checkout.session.completed';
      let sessionObj = isSession ? (event.data.object as Stripe.Checkout.Session) : null;
      let paymentIntent = !isSession ? (event.data.object as Stripe.PaymentIntent) : null;
      
      const rawMetadata = isSession ? (sessionObj?.metadata || {}) : (paymentIntent?.metadata || {});
      const paymentId = isSession ? sessionObj!.id : paymentIntent!.id;
      console.log('Payment event succeeded:', event.type, paymentId);
      
      try {
        const { type, auction_id, buyer_id, seller_id, fee_percentage, user_id, package_id } = rawMetadata;

        if (type === 'subscription') {
            const targetUserId = user_id || buyer_id;
            console.log('Processing subscription payment for user', targetUserId);
            if (targetUserId && package_id) {
                await updateDoc(doc(db, 'users', targetUserId), { 
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
            console.warn('Missing metadata for payment:', paymentId);
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
        const amountTotalInCents = isSession ? (sessionObj?.amount_total || 0) : paymentIntent!.amount;
        const amountTotal = amountTotalInCents / 100;
        
        // Fetch auction to get exact price instead of estimating it
        const auctionDoc = await getDoc(doc(db, 'auctions', auction_id));
        const auction = auctionDoc.data();
        let currentPrice = amountTotal;
        if (auction && (auction.current_price || auction.currentBid)) {
            currentPrice = Number(auction.current_price || auction.currentBid);
        } else {
            const feePct = Number(fee_percentage) || 0;
            if (feePct > 0) {
                currentPrice = amountTotal / (1 + (feePct / 100));
            }
        }

        const platformFee = calculateMarginalPlatformFee(currentPrice, seller.subscription_tier);
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

        // 4. Create Transaction Record
        let transaction = null, txError = null;
    try { 
      const ref = await addDoc(collection(db, 'transactions'), {
            auction_id,
            buyer_id,
            seller_id,
            stripe_payment_intent_id: paymentId,
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
        let auctionUpdateError = null; 
        try { 
            await updateDoc(doc(db, 'auctions', auction_id), { 
                status: 'completed', payment_status: 'paid', post_auction_status: 'paid', paid_at: new Date().toISOString()
            }); 
            
            // Credit seller's wallet
            const currentWallet = Number(seller.wallet_balance) || 0;
            await updateDoc(doc(db, 'users', seller_id), {
                wallet_balance: currentWallet + currentPrice
            });
        } catch(e) { auctionUpdateError = e; }
            
        if (auctionUpdateError) {
            console.error('Error updating auction status or wallet:', auctionUpdateError);
        }

        // Track buyer spending for EU AML (10k annual limit) & purchase history
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

            await updateDoc(doc(db, 'users', buyer_id), {
                yearly_spent: updatedYearlySpent,
                yearly_spent_year: currentYear,
                [`yearly_spent_by_year.${currentYear}`]: updatedYearlySpent,
                total_spent: updatedTotalSpent,
                purchases_count: updatedPurchasesCount,
                last_purchase_at: new Date().toISOString()
            });
        } catch (spentErr) {
            console.error('Error updating buyer spending records in server webhook:', spentErr);
        }

        // 6. Generate Documents
        const documentsToInsert = [];
        const attachments = [];

        // Generate Invoice for Platform Fee
        try {
            const auctionDocPdf = await getDoc(doc(db, 'auctions', auction_id));
            const auctionDataPdf = auctionDocPdf.data();
            const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller, auctionDataPdf);
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
  
  function getBidIncrement(price: number): number {
    if (price < 50) return 1;
    if (price < 500) return 5;
    if (price < 2000) return 20;
    if (price < 5000) return 50;
    return 100;
  }

  // Unified Cron handler for Vercel Cron and external schedulers
  const handleCronCheck = async (req: express.Request, res: express.Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const secretHeader = req.headers['x-cron-secret'];
      const querySecret = req.query?.secret;
      const cronSecret = process.env.CRON_SECRET;

      if (cronSecret) {
        const isBearerMatch = authHeader === `Bearer ${cronSecret}`;
        const isSecretHeaderMatch = secretHeader === cronSecret;
        const isQueryMatch = querySecret === cronSecret;

        if (!isBearerMatch && !isSecretHeaderMatch && !isQueryMatch) {
          console.warn('[CRON AUTH] Unauthorized cron request attempt');
          return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
        }
      }

      console.log('[CRON] Executing auction check...');
      const results = await processAuctionCrons();
      res.json(results);
    } catch (e: any) {
      console.error('[CRON ERROR]', e);
      res.status(500).json({ error: e.message || 'Internal server error in cron' });
    }
  };

  app.get("/api/cron/check-auctions", handleCronCheck);
  app.post("/api/cron/check-auctions", handleCronCheck);
  app.get("/api/cron-auctions", handleCronCheck);
  app.post("/api/cron-auctions", handleCronCheck);

  // Dedicated endpoint for placing bids with instant outbid email triggers
  app.post("/api/place-bid", async (req, res) => {
    try {
      const { auction_id, user_id, amount } = req.body;
      if (!auction_id || !user_id || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: "Manjkajoči ali neveljavni podatki za ponudbo." });
      }

      const auctionRef = doc(db, 'auctions', auction_id);
      const userRef = doc(db, 'users', user_id);

      // Verify user existence and state
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ error: "Uporabnik ne obstaja." });
      }
      const userData = userSnap.data();
      if (userData.isBlocked) {
        return res.status(403).json({ error: "Vaš račun je začasno blokiran." });
      }

      let outbidUserToNotify: { userId: string; newPrice: number; auctionTitle: string; auctionImageUrl?: string } | null = null;
      let finalWinnerId = user_id;
      let finalPrice = amount;

      await runTransaction(db, async (transaction) => {
        const auctionDoc = await transaction.get(auctionRef);
        if (!auctionDoc.exists()) {
          throw new Error("Dražba ne obstaja.");
        }
        const data = auctionDoc.data();
        const currentPrice = Number(data.current_price ?? data.currentBid ?? 0);
        const prevWinnerId = data.winner_id || data.winnerId;
        const isCurrentWinner = prevWinnerId === user_id;

        if (amount <= currentPrice) {
          throw new Error("Ponudba mora biti višja od trenutne cene.");
        }

        const currentProxy = data.current_proxy_bid || data.currentProxyBid;
        let newCurrentPrice = currentPrice;
        let newWinnerId = user_id;
        let newProxyBid = { user_id, amount };

        const increment = getBidIncrement(currentPrice);

        if (currentProxy && currentProxy.user_id !== user_id) {
          if (amount > currentProxy.amount) {
            newCurrentPrice = Math.min(amount, currentProxy.amount + increment);
            newWinnerId = user_id;
            newProxyBid = { user_id, amount };
          } else if (amount === currentProxy.amount) {
            newCurrentPrice = amount;
            newWinnerId = currentProxy.user_id;
            newProxyBid = currentProxy;
          } else {
            newCurrentPrice = Math.min(currentProxy.amount, amount + increment);
            newWinnerId = currentProxy.user_id;
            newProxyBid = currentProxy;
          }
        } else if (isCurrentWinner || (currentProxy && currentProxy.user_id === user_id)) {
          newCurrentPrice = currentPrice;
          newWinnerId = user_id;
          newProxyBid = { user_id, amount };
        } else {
          newCurrentPrice = Math.min(amount, currentPrice + increment);
          newWinnerId = user_id;
          newProxyBid = { user_id, amount };
        }

        const endTimeStr = data.end_time || data.endTime;
        const endTime = endTimeStr ? new Date(endTimeStr).getTime() : 0;
        const now = Date.now();
        let newEndTimeStr = endTimeStr;

        if (endTime > now && endTime - now < 60 * 1000) {
          newEndTimeStr = new Date(now + 60 * 1000).toISOString();
        }

        let topBids = data.top_bids || [];
        topBids.push({ user_id, amount, timestamp: new Date().toISOString() });
        topBids.sort((a: any, b: any) => b.amount - a.amount);

        let uniqueTopBids: any[] = [];
        let seenUsers = new Set();
        for (let bid of topBids) {
          if (!seenUsers.has(bid.user_id)) {
            uniqueTopBids.push(bid);
            seenUsers.add(bid.user_id);
          }
        }
        uniqueTopBids = uniqueTopBids.slice(0, 3);

        const existingHistory = data.bidding_history || data.biddingHistory || [];
        const newHistoryItem = {
          user_id,
          userId: user_id,
          username: userData.username || userData.first_name || userData.email?.split('@')[0] || 'Uporabnik',
          amount,
          created_at: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        transaction.update(auctionRef, {
          current_price: newCurrentPrice,
          currentBid: newCurrentPrice,
          winner_id: newWinnerId,
          winnerId: newWinnerId,
          current_proxy_bid: newProxyBid,
          currentProxyBid: newProxyBid,
          hidden_max_bid: newProxyBid.amount,
          hiddenMaxBid: newProxyBid.amount,
          bid_count: (data.bid_count || data.bidCount || 0) + 1,
          bidCount: (data.bid_count || data.bidCount || 0) + 1,
          top_bids: uniqueTopBids,
          end_time: newEndTimeStr,
          endTime: newEndTimeStr,
          bidding_history: [...existingHistory, newHistoryItem],
          biddingHistory: [...existingHistory, newHistoryItem]
        });

        finalWinnerId = newWinnerId;
        finalPrice = newCurrentPrice;

        // Check if previous leader was outbid
        if (prevWinnerId && prevWinnerId !== user_id && newWinnerId === user_id) {
          const title = data.title?.SLO || data.title?.EN || (typeof data.title === 'string' ? data.title : 'Predmet dražbe');
          const imageUrl = Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : undefined;
          outbidUserToNotify = {
            userId: prevWinnerId,
            newPrice: newCurrentPrice,
            auctionTitle: title,
            auctionImageUrl: imageUrl,
          };
        }
      });

      // Send outbid notification email asynchronously
      if (outbidUserToNotify) {
        (async () => {
          try {
            const prevUserDoc = await getDoc(doc(db, 'users', outbidUserToNotify!.userId));
            if (prevUserDoc.exists()) {
              const prevUserData = prevUserDoc.data();
              if (prevUserData.email) {
                await sendOutbidNotification({
                  toEmail: prevUserData.email,
                  recipientName: prevUserData.first_name || prevUserData.name || 'Uporabnik',
                  auctionId: auction_id,
                  auctionTitle: outbidUserToNotify!.auctionTitle,
                  auctionImageUrl: outbidUserToNotify!.auctionImageUrl,
                  newPrice: outbidUserToNotify!.newPrice,
                });
              }
            }
          } catch (emailErr) {
            console.error('[OUTBID EMAIL ERROR]', emailErr);
          }
        })();
      }

      const resultStatus = finalWinnerId === user_id ? "ok" : "outbid";
      res.json({
        success: true,
        resultStatus,
        newWinnerId: finalWinnerId,
        currentPrice: finalPrice,
      });
    } catch (e: any) {
      console.error("[PLACE BID ERROR]", e);
      res.status(400).json({ error: e.message || "Napaka pri oddaji ponudbe" });
    }
  });

  // Direct helper endpoint to trigger outbid notifications
  app.post("/api/notify-outbid", async (req, res) => {
    try {
      const { auction_id, outbid_user_id, new_price } = req.body;
      if (!auction_id || !outbid_user_id) {
        return res.status(400).json({ error: "Manjkajoči podatki" });
      }

      const [auctionSnap, userSnap] = await Promise.all([
        getDoc(doc(db, 'auctions', auction_id)),
        getDoc(doc(db, 'users', outbid_user_id)),
      ]);

      if (!auctionSnap.exists() || !userSnap.exists()) {
        return res.status(404).json({ error: "Dražba ali uporabnik ne obstaja" });
      }

      const auctionData = auctionSnap.data();
      const userData = userSnap.data();

      if (!userData.email) {
        return res.json({ success: false, reason: "No email on user" });
      }

      const title = auctionData.title?.SLO || auctionData.title?.EN || (typeof auctionData.title === 'string' ? auctionData.title : 'Predmet dražbe');
      const imageUrl = Array.isArray(auctionData.images) && auctionData.images.length > 0 ? auctionData.images[0] : undefined;
      const price = typeof new_price === 'number' ? new_price : Number(auctionData.current_price || 0);

      await sendOutbidNotification({
        toEmail: userData.email,
        recipientName: userData.first_name || userData.name || 'Uporabnik',
        auctionId: auction_id,
        auctionTitle: title,
        auctionImageUrl: imageUrl,
        newPrice: price,
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error("[NOTIFY OUTBID ERROR]", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, return_url, type = "auction", user_id, userId } = req.body;
      const stripe = getStripe();
      
      const effectiveBuyerId = buyer_id || user_id || userId;
      let auctionTitle = "Plačilo";
      let sessionMetadata: any = { type };
      let buyer: any = null;
      let stripeCustomerId: string | null = null;

      // Check EU AML law: 10,000 € annual limit check for buyers without ID verification
      if (effectiveBuyerId) {
        const buyerDoc = await getDoc(doc(db, 'users', effectiveBuyerId));
        if (buyerDoc.exists()) {
          buyer = buyerDoc.data();
          stripeCustomerId = await getOrCreateStripeCustomer(stripe, effectiveBuyerId, buyer);
          
          const currentYear = new Date().getFullYear();
          let currentYearSpent = 0;
          
          if (buyer.yearly_spent_by_year && buyer.yearly_spent_by_year[currentYear]) {
            currentYearSpent = Number(buyer.yearly_spent_by_year[currentYear]) || 0;
          } else if (buyer.yearly_spent_year === currentYear && typeof buyer.yearly_spent === 'number') {
            currentYearSpent = buyer.yearly_spent;
          }

          const prospectiveTotal = currentYearSpent + (Number(amount) || 0);
          const isVerified = !!(buyer.is_verified || buyer.is_id_verified || buyer.id_document_verified);

          // EU Law limit: 10,000 € / year without identity document verification
          if (prospectiveTotal > 10000 && !isVerified) {
            return res.status(400).json({ 
              error: "V skladu z zakonodajo EU (ZPPDFT-2 / AML) je za skupne letne nakupe nad 10.000 € obvezna identifikacija z osebnim dokumentom. Prosimo, verificirajte svoj profil v nastavitvah pred nadaljevanjem." 
            });
          }
        }
      }

      if (type === "auction" && auction_id && effectiveBuyerId && seller_id) {
        // Fetch the actual auction
        const auctionDoc = await getDoc(doc(db, 'auctions', auction_id));
        const auction = auctionDoc.data();
        const currentPrice = auction?.current_price || (amount / 1.122);

        const sellerDoc = await getDoc(doc(db, 'users', seller_id));
        const seller = sellerDoc.data();
        const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
        
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

        if (auction?.title) {
           auctionTitle = auction.title['SLO'] || auction.title['EN'] || "Dražba";
        }
        
        sessionMetadata = {
          type: 'auction',
          auction_id,
          buyer_id: effectiveBuyerId,
          seller_id,
          fee_percentage
        };
      } else if (type === "subscription") {
        auctionTitle = "Naročnina";
        sessionMetadata = {
          type: 'subscription',
          buyer_id: effectiveBuyerId || '',
          user_id: effectiveBuyerId || '',
        };
      } else {
        if (!auction_id || !effectiveBuyerId || !seller_id) {
          auctionTitle = "Plačilo dražbe";
          sessionMetadata = {
            type: 'auction',
            auction_id: auction_id || '',
            buyer_id: effectiveBuyerId || '',
            seller_id: seller_id || '',
          };
        }
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

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/confirm-checkout-session", async (req, res) => {
    try {
      const { sessionId, auctionId } = req.body || {};
      const stripe = getStripe();

      if (!sessionId && !auctionId) {
        return res.status(400).json({ error: 'Missing sessionId or auctionId' });
      }

      let session: Stripe.Checkout.Session | null = null;
      let paymentIntent: Stripe.PaymentIntent | null = null;

      if (sessionId) {
        try {
          session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent']
          });
        } catch (err: any) {
          console.error('Error retrieving checkout session:', err);
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
          const targetUserId = metadata.user_id || effectiveBuyerId;
          const packageId = metadata.package_id || 'PRO';
          if (targetUserId) {
            await updateDoc(doc(db, 'users', targetUserId), {
              subscription_tier: packageId,
              subscription_active: true,
              subscription_paid_at: new Date().toISOString()
            });
          }
          return res.json({ success: true, type: 'subscription' });
        }

        if (effectiveAuctionId) {
          await updateDoc(doc(db, 'auctions', effectiveAuctionId), {
            status: 'completed',
            payment_status: 'paid',
            post_auction_status: 'paid',
            paid_at: new Date().toISOString()
          });

          if (effectiveBuyerId && effectiveSellerId) {
            const buyerDoc = await getDoc(doc(db, 'users', effectiveBuyerId));
            const buyer = buyerDoc.data() || {};
            const sellerDoc = await getDoc(doc(db, 'users', effectiveSellerId));
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

            try {
              const txQuery = query(collection(db, 'transactions'), where('stripe_payment_intent_id', '==', (paymentIntent?.id || session.id)));
              const existingTx = await getDocs(txQuery);

              if (existingTx.empty) {
                await addDoc(collection(db, 'transactions'), {
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
              }
            } catch (txErr) {
              console.error('Error recording transaction:', txErr);
            }

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

              await updateDoc(doc(db, 'users', effectiveBuyerId), {
                yearly_spent: updatedYearlySpent,
                yearly_spent_year: currentYear,
                [`yearly_spent_by_year.${currentYear}`]: updatedYearlySpent,
                total_spent: updatedTotalSpent,
                purchases_count: updatedPurchasesCount,
                last_purchase_at: new Date().toISOString()
              });
            } catch (amlErr) {
              console.error('Error updating AML stats:', amlErr);
            }
          }

          return res.json({ success: true, paid: true, auction_id: effectiveAuctionId });
        }
      } else if (auctionId) {
        await updateDoc(doc(db, 'auctions', auctionId), {
          status: 'completed',
          payment_status: 'paid',
          post_auction_status: 'paid',
          paid_at: new Date().toISOString()
        });
        return res.json({ success: true, paid: true, auction_id: auctionId });
      }

      return res.status(400).json({ error: 'Could not confirm payment' });
    } catch (err: any) {
      console.error('Error in confirm-checkout-session:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, user_id, userId } = req.body;
      const stripe = getStripe();
      const effectiveBuyerId = buyer_id || user_id || userId;
      
      let stripeCustomerId: string | null = null;
      let buyer: any = null;
      if (effectiveBuyerId) {
        const buyerDoc = await getDoc(doc(db, 'users', effectiveBuyerId));
        if (buyerDoc.exists()) {
          buyer = buyerDoc.data();
          stripeCustomerId = await getOrCreateStripeCustomer(stripe, effectiveBuyerId, buyer);
        }
      }

      // Fetch the actual auction to securely determine the final bid price
      const auctionDoc = await getDoc(doc(db, 'auctions', auction_id));
      const auction = auctionDoc.data();
      const currentPrice = auction?.current_price || (amount / 1.122); // Fallback estimate if not found

      const sellerDoc = await getDoc(doc(db, 'users', seller_id));
      const seller = sellerDoc.data();
      const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
      
      // Calculate VAT for the platform fee
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

      const intentParams: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(amount * 100), // Stripe expects amounts in cents
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
            type: 'auction',
            auction_id,
            buyer_id: effectiveBuyerId || '',
            seller_id,
            fee_percentage
        }
      };

      if (stripeCustomerId) {
        intentParams.customer = stripeCustomerId;
      }
      if (buyer?.email) {
        intentParams.receipt_email = buyer.email;
      }

      const paymentIntent = await stripe.paymentIntents.create(intentParams);

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
        tax_id: user.tax_number || user.taxNumber || user.tax_id || undefined,
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
        transfers: { requested: true }
      };
      accountParams.settings = { payouts: { schedule: { interval: 'manual' } } };
      
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
      const reqOrigin = req.get('origin') || (req.get('host') ? `${req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http'}://${req.get('host')}` : 'https://www.drazbe.eu');
      const accountLink = await stripe.accountLinks.create({
        account: targetStripeAccountId,
        refresh_url: refresh_url || `${reqOrigin}/stripe-callback.html?stripe=refresh`,
        return_url: return_url || `${reqOrigin}/stripe-callback.html?stripe=success`,
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
      await setDoc(userDocRef, { stripe_onboarding_complete: isComplete }, { merge: true });

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

      const auctionDoc = await getDoc(doc(db, 'auctions', auction_id));
      const auction = auctionDoc.data();

      // Get exact currentPrice from auction
      let currentPrice = amount;
      if (auction && (auction.current_price || auction.currentBid)) {
          currentPrice = Number(auction.current_price || auction.currentBid);
      } else {
          const feePct = Number(fee_percentage) || 0;
          if (feePct > 0) {
              currentPrice = amount / (1 + (feePct / 100));
          }
      }
      
      const sellerDoc = await getDoc(doc(db, 'users', seller_id));
    const seller = sellerDoc.data();

      // Ensure platform fee calculation uses the buyer's fee rate since they pay the fee
      const platformFee = amount - currentPrice;
      
      const amountTotalInCents = Math.round(amount * 100);
      const platformFeeInCents = Math.round(platformFee * 100);

      // Execute internal wallet payment logic manually using Firestore
      const buyerDocRef = doc(db, 'users', buyer_id);
      const buyerDocSnapshot = await getDoc(buyerDocRef);
      const buyerData = buyerDocSnapshot.data();
      
      const currentBuyerWallet = Number(buyerData?.wallet_balance) || 0;
      if (currentBuyerWallet < amount) {
          return res.status(400).json({ error: "Ni dovolj sredstev na računu." });
      }

      // Deduct from buyer
      await updateDoc(buyerDocRef, {
          wallet_balance: currentBuyerWallet - amount
      });

      // Credit to seller
      const sellerWallet = Number(seller?.wallet_balance) || 0;
      await updateDoc(doc(db, 'users', seller_id), {
          wallet_balance: sellerWallet + currentPrice
      });

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
                 const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller, auction);
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
      const stripe = getStripe();
      
      const withdrawalAmount = Number(amount);
      const amountInCents = Math.round(withdrawalAmount * 100);

      // Check balance and connected account
      const userDocRef = doc(db, 'users', user_id);
      const userDoc = await getDoc(userDocRef);
      const user = userDoc.data() || {};
      
      const currentBalance = Number(user.wallet_balance) || 0;

      if (currentBalance < withdrawalAmount) {
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
                  transfers: { requested: true }
              },
              settings: { payouts: { schedule: { interval: 'manual' } } },
          });
          accountId = account.id;
          await setDoc(userDocRef, { stripeAccountId: accountId }, { merge: true });
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
      await updateDoc(userDocRef, {
          wallet_balance: currentBalance - withdrawalAmount
      });

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
        metadata: {
          type: 'subscription',
          user_id,
          package_id,
          amount: amount.toString()
        },
        payment_intent_data: {
          metadata: {
            type: 'subscription',
            user_id,
            package_id,
            amount: amount.toString()
          }
        },
        mode: 'payment', // using payment mode for one-time subscription charge
        success_url: return_url && return_url.includes('/stripe-callback.html')
          ? `${return_url}?payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}`
          : `${return_url || 'https://www.drazbe.eu'}${return_url && return_url.includes('?') ? '&' : '?'}payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: return_url && return_url.includes('/stripe-callback.html')
          ? `${return_url}?payment=cancel`
          : `${return_url || 'https://www.drazbe.eu'}${return_url && return_url.includes('?') ? '&' : '?'}payment=cancel`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Subscription Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/create-verification-session", async (req, res) => {
    try {
      const { user_id, userId } = req.body || {};
      const targetUserId = user_id || userId;
      const stripe = getStripe();

      let user: any = null;
      if (targetUserId) {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          user = userDoc.data();
        }
      }

      const formattedPhone = user?.phone ? formatE164Phone(user.phone, user.country_code || 'SI') : undefined;

      const session = await stripe.identity.verificationSessions.create({
        type: 'document',
        options: {
          document: {
            require_id_number: true,
            require_matching_selfie: true,
          },
        },
        provided_details: {
          ...(user?.email ? { email: user.email.trim() } : {}),
          ...(formattedPhone ? { phone: formattedPhone } : {}),
        },
        metadata: {
          user_id: targetUserId || '',
        }
      });
      res.json({ clientSecret: session.client_secret });
    } catch (error: any) {
      console.error("Stripe Identity error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // TEST SANDBOX / DIAGNOSTIC ENDPOINTS
  // ==========================================

  // 1. Test Email Sender
  app.post("/api/test/send-email", async (req, res) => {
    try {
      const {
        toEmail,
        type, // 'outbid' | 'ending_soon' | 'won' | 'payment_reminder' | 'receipt_invoice'
        recipientName = "Testni Uporabnik",
        auctionId = "test-auction-123",
        auctionTitle = "Industrijski CNC obdelovalni center Haas VF-2",
        currentPrice = 1250,
        auctionImageUrl = "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=60",
      } = req.body;

      if (!toEmail) {
        return res.status(400).json({ error: "E-poštni naslov prejemnika je obvezen." });
      }

      const resendApiKey = process.env.RESEND_API_KEY;
      let sendResult: any = null;

      if (type === 'outbid') {
        sendResult = await sendOutbidNotification({
          toEmail,
          recipientName,
          auctionId,
          auctionTitle,
          newPrice: currentPrice,
          auctionImageUrl,
        });
      } else if (type === 'ending_soon') {
        sendResult = await sendEndingSoonNotification({
          toEmail,
          recipientName,
          auctionId,
          auctionTitle,
          currentPrice,
          auctionImageUrl,
          endTimeFormatted: "čez 28 minut (danes ob 18:00)",
        });
      } else if (type === 'won') {
        sendResult = await sendAuctionWonNotification({
          toEmail,
          recipientName,
          auctionId,
          auctionTitle,
          winningPrice: currentPrice,
          paymentDeadlineFormatted: "24 ur (do jutri ob 18:00)",
          auctionImageUrl,
        });
      } else if (type === 'payment_reminder') {
        sendResult = await sendPaymentReminderNotification({
          toEmail,
          recipientName,
          auctionId,
          auctionTitle,
          amount: currentPrice,
          paymentDeadlineFormatted: "čez 2 uri (danes ob 18:00)",
          auctionImageUrl,
        });
      } else if (type === 'receipt_invoice') {
        // Generate mock transaction + documents + send with attachments
        const mockTransaction = {
          id: `TX-${Date.now().toString().substring(6)}`,
          amount_total: currentPrice,
          platform_fee: Math.round(currentPrice * 0.05 * 100) / 100,
          vat_amount: Math.round(currentPrice * 0.05 * 0.22 * 100) / 100,
          vat_rate: 22,
          is_reverse_charge: false,
          status: 'completed'
        };
        const mockBuyer = {
          first_name: recipientName.split(' ')[0] || 'Janez',
          last_name: recipientName.split(' ')[1] || 'Novak',
          email: toEmail,
          address: 'Dunajska cesta 156, 1000 Ljubljana',
          user_type: 'individual'
        };
        const mockSeller = {
          company_name: 'Dizain d.o.o. (Testni prodajalec)',
          address: 'Karantanska ulica 28, 2000 Maribor',
          tax_id: 'SI57008060',
          company_status: 'company'
        };
        const mockAuction = {
          id: auctionId,
          title: { SLO: auctionTitle, EN: auctionTitle },
          currentBid: currentPrice
        };

        const invoiceBuffer = await generateInvoicePDF(mockTransaction, mockBuyer, mockSeller, mockAuction);
        const certBuffer = await generateCertificatePDF(mockTransaction, mockBuyer, mockSeller);

        const attachments = [
          { filename: `racun_${mockTransaction.id}.pdf`, content: invoiceBuffer },
          { filename: `potrdilo_${mockTransaction.id}.pdf`, content: certBuffer }
        ];

        if (resendApiKey) {
          const resendClient = new Resend(resendApiKey);
          const emailResponse = await resendClient.emails.send({
            from: process.env.EMAIL_FROM || 'dražbe.si <obvestila@drazba.si>',
            to: toEmail,
            subject: `🧾 Potrdilo o plačilu in račun: ${auctionTitle} - dražbe.si`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0A1128; color: #FFFFFF; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #FEBA4F; font-size: 28px; margin: 0;">dražbe.si</h1>
                  <p style="color: #94A3B8; font-size: 13px;">Uradno potrdilo o plačilu in račun</p>
                </div>
                <div style="background-color: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                  <h2 style="color: #FFFFFF; font-size: 18px; margin-top: 0;">Pozdravljeni, ${recipientName}!</h2>
                  <p style="color: #CBD5E1; line-height: 1.6;">Vaše plačilo za dražbo <strong>${auctionTitle}</strong> v znesku <strong>${currentPrice.toFixed(2)} €</strong> je bilo uspešno evidentirano.</p>
                  <p style="color: #CBD5E1; line-height: 1.6;">V priponki tega sporočila vam prilagamo <strong>uradni PDF račun</strong> ter <strong>potrdilo o nakupu (certifikat)</strong>.</p>
                </div>
                <div style="text-align: center; font-size: 11px; color: #64748B;">
                  <p>© ${new Date().getFullYear()} dražbe.si. Vse pravice pridržane.</p>
                </div>
              </div>
            `,
            attachments
          });
          sendResult = { success: true, messageId: emailResponse.data?.id };
        } else {
          sendResult = { success: false, error: "RESEND_API_KEY ni nastavljen v .env" };
        }
      } else {
        return res.status(400).json({ error: "Neznan tip e-poštnega obvestila." });
      }

      res.json({
        success: sendResult?.success ?? true,
        type,
        toEmail,
        timestamp: new Date().toISOString(),
        details: sendResult,
        resendConfigured: !!resendApiKey
      });
    } catch (err: any) {
      console.error("Test send-email error:", err);
      res.status(500).json({ error: err.message || "Napaka pri pošiljanju testnega e-maila" });
    }
  });

  // 2. Test PDF Generator
  app.post("/api/test/generate-pdf", async (req, res) => {
    try {
      const {
        relationshipType = "individual_individual", // 'individual_individual' | 'company_individual' | 'individual_company' | 'company_company'
        sellerData = {},
        buyerData = {},
        itemTitle = "Industrijski CNC obdelovalni center Haas VF-2",
        itemPrice = 1250,
        docType = "invoice" // 'invoice' | 'certificate'
      } = req.body;

      const mockTx = {
        id: `TX-${Date.now().toString().substring(5)}`,
        amount_total: Number(itemPrice),
        platform_fee: Math.round(Number(itemPrice) * 0.05 * 100) / 100,
        vat_amount: Math.round(Number(itemPrice) * 0.05 * 0.22 * 100) / 100,
        vat_rate: 22,
        is_reverse_charge: relationshipType === 'company_company',
        status: 'completed'
      };

      const mockAuction = {
        id: `AUC-${Date.now().toString().substring(6)}`,
        title: { SLO: itemTitle, EN: itemTitle },
        currentBid: Number(itemPrice),
        delivery_method: 'pickup'
      };

      // Construct seller & buyer based on relationship type
      let seller: any = { ...sellerData };
      let buyer: any = { ...buyerData };

      if (relationshipType === 'individual_individual') {
        seller = {
          first_name: sellerData.first_name || 'Marko',
          last_name: sellerData.last_name || 'Horvat',
          address: sellerData.address || 'Celjska cesta 42, 3000 Celje',
          company_status: 'individual',
          user_type: 'individual'
        };
        buyer = {
          first_name: buyerData.first_name || 'Luka',
          last_name: buyerData.last_name || 'Kovačič',
          address: buyerData.address || 'Tržaška cesta 12, 1000 Ljubljana',
          company_status: 'individual',
          user_type: 'individual'
        };
      } else if (relationshipType === 'company_individual') {
        seller = {
          company_name: sellerData.company_name || 'Strojegradnja d.o.o.',
          tax_id: sellerData.tax_id || 'SI12345678',
          registration_number: '8876543000',
          address: sellerData.address || 'Industrijska cona 5, 2000 Maribor',
          company_status: 'company',
          user_type: 'business'
        };
        buyer = {
          first_name: buyerData.first_name || 'Ana',
          last_name: buyerData.last_name || 'Novak',
          address: buyerData.address || 'Titova cesta 8, 2000 Maribor',
          company_status: 'individual',
          user_type: 'individual'
        };
      } else if (relationshipType === 'individual_company') {
        seller = {
          first_name: sellerData.first_name || 'Janez',
          last_name: sellerData.last_name || 'Kranjc',
          address: sellerData.address || 'Cesta v Gorice 14, 1000 Ljubljana',
          company_status: 'individual',
          user_type: 'individual'
        };
        buyer = {
          company_name: buyerData.company_name || 'TechTrade d.o.o.',
          tax_id: buyerData.tax_id || 'SI87654321',
          registration_number: '9988776000',
          address: buyerData.address || 'Letališka cesta 33, 1000 Ljubljana',
          company_status: 'company',
          user_type: 'business'
        };
      } else { // company_company
        seller = {
          company_name: sellerData.company_name || 'MetalOpus d.o.o.',
          tax_id: sellerData.tax_id || 'SI98765432',
          registration_number: '7766554000',
          address: sellerData.address || 'Obrtna cona 12, 4000 Kranj',
          company_status: 'company',
          user_type: 'business'
        };
        buyer = {
          company_name: buyerData.company_name || 'AvtoTech Solutions d.o.o.',
          tax_id: buyerData.tax_id || 'SI45678901',
          registration_number: '5544332000',
          address: buyerData.address || 'Šmartinska cesta 152, 1000 Ljubljana',
          company_status: 'company',
          user_type: 'business'
        };
      }

      let pdfBuffer: Buffer;
      let filename: string;

      if (docType === 'certificate') {
        pdfBuffer = await generateCertificatePDF(mockTx, buyer, seller);
        filename = `Potrdilo_${mockTx.id}.pdf`;
      } else {
        pdfBuffer = await generateInvoicePDF(mockTx, buyer, seller, mockAuction);
        filename = `Racun_${mockTx.id}.pdf`;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Test generate-pdf error:", err);
      res.status(500).json({ error: err.message || "Napaka pri generiranju testnega PDF" });
    }
  });

  // 3. Test Wallet Payout Simulation & Diagnostics
  app.post("/api/test/test-payout", async (req, res) => {
    try {
      const { user_id, amount = 50, executeReal = false } = req.body;
      const withdrawalAmount = Number(amount);

      if (!user_id) {
        return res.status(400).json({ error: "Manjka user_id." });
      }

      const userDocRef = doc(db, 'users', user_id);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        return res.status(404).json({ error: "Uporabnik ne obstaja v bazi." });
      }
      const userData = userDoc.data() || {};
      const currentBalance = Number(userData.wallet_balance) || 0;

      const logs: string[] = [];
      logs.push(`[1] Preverjanje uporabnika: ${userData.first_name || ''} ${userData.last_name || userData.username || user_id} (Tip: ${userData.user_type || 'individual'})`);
      logs.push(`[2] Trenutno stanje v denarnici: ${currentBalance.toFixed(2)} €`);
      logs.push(`[3] Zahtevan znesek izplačila: ${withdrawalAmount.toFixed(2)} €`);

      const hasSufficientBalance = currentBalance >= withdrawalAmount;
      logs.push(`[4] Zadostno stanje: ${hasSufficientBalance ? 'DA (Odobreno)' : 'NE (Nezadostno dobroimetje)'}`);

      const stripeAccountId = userData.stripeAccountId || userData.stripe_account_id;
      const stripeOnboardingComplete = userData.stripe_onboarding_complete;
      logs.push(`[5] Stripe Connect račun: ${stripeAccountId ? `Povezan (${stripeAccountId})` : 'NI povezan (potrebna registracija izplačilnega računa)'}`);
      logs.push(`[6] Stripe Onboarding zaključen: ${stripeOnboardingComplete ? 'DA' : 'NE'}`);

      let newBalance = currentBalance;
      let transactionId = `TEST-PAYOUT-${Date.now().toString().substring(6)}`;

      if (executeReal) {
        if (!hasSufficientBalance) {
          return res.status(400).json({
            success: false,
            error: "Nezadostno stanje v denarnici za izvedbo izplačila.",
            logs
          });
        }

        newBalance = currentBalance - withdrawalAmount;
        await updateDoc(userDocRef, {
          wallet_balance: newBalance
        });

        await addDoc(collection(db, 'wallet_transactions'), {
          user_id,
          amount: -withdrawalAmount,
          type: 'payout',
          status: 'completed',
          description: `Testno izplačilo na bančni račun`,
          created_at: new Date().toISOString()
        });

        logs.push(`[7] Baza posodobljena: Novo stanje denarnice je ${newBalance.toFixed(2)} €`);
        logs.push(`[8] Zgodovina transakcij zabeležena.`);
      } else {
        logs.push(`[7] Način simulacije: Denarnica ni bila zmanjšana (za dejansko zmanjšanje vklopi 'Izvedi pravo izplačilo').`);
      }

      res.json({
        success: true,
        simulation: !executeReal,
        requestedAmount: withdrawalAmount,
        previousBalance: currentBalance,
        newBalance: executeReal ? newBalance : currentBalance,
        stripeAccountStatus: stripeAccountId ? (stripeOnboardingComplete ? 'ready' : 'onboarding_required') : 'missing',
        logs
      });
    } catch (err: any) {
      console.error("Test payout error:", err);
      res.status(500).json({ error: err.message || "Napaka pri testnem izplačilu" });
    }
  });

  // 4. Add test funds helper
  app.post("/api/test/add-test-funds", async (req, res) => {
    try {
      const { user_id, amount = 100 } = req.body;
      if (!user_id) return res.status(400).json({ error: "Manjka user_id" });

      const userDocRef = doc(db, 'users', user_id);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) return res.status(404).json({ error: "Uporabnik ne obstaja" });

      const currentBalance = Number(userDoc.data()?.wallet_balance) || 0;
      const newBalance = currentBalance + Number(amount);

      await updateDoc(userDocRef, { wallet_balance: newBalance });

      res.json({ success: true, previousBalance: currentBalance, newBalance });
    } catch (err: any) {
      console.error("Add test funds error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Post Analyze Receipt
  app.post("/api/analyze-receipt", async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({error: "No imageUrl provided"});
        
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: "Analiziraj ta račun iz pošte. Poišči skupni znesek poštnine ali končni znesek za plačilo. Vrni izključno JSON objekt v obliki: {\"shipping_cost\": float, \"currency\": \"EUR\"}. Če zneska ne moreš z gotovostjo razbrati, vrni {\"shipping_cost\": null}." }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });
        
        const resultText = geminiResponse.text;
        res.json(JSON.parse(resultText));
    } catch (e: any) {
        console.error("Gemini Vision error:", e);
        res.status(500).json({ error: e.message });
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
