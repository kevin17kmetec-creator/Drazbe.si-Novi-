import express from "express";
import {
  reserveWalletFunds,
  commitReservedFunds,
  rollbackReservedFunds,
  addHeldFunds,
  releaseHeldFunds,
  ensureWalletMigrated,
  creditTestFunds,
  creditWalletDepositFromStripe,
  getUserWallet
} from './walletService';
import { parseAmountToCents, calculateCheckoutTotals, calculateMarginalPlatformFee } from './moneyUtils';
import { authenticateFirebaseUser } from './authHelper';
import {
  formatStripeError,
  ensurePlatformTestBalance,
  diagnoseStripeTransferPrerequisites
} from './stripeHelper';
import cors from "cors";
import Stripe from "stripe";
import { Resend } from 'resend';
import { render } from '@react-email/render';
import React from 'react';
import { AuctionEmailTemplate } from '../emails/AuctionEmailTemplate';
import { AuthEmailTemplate } from '../emails/AuthEmailTemplate';
import { GoogleGenAI } from "@google/genai";
import { generateInvoicePDF } from '../lib/pdfGenerator';
import {
  sendEndingSoonNotification,
  sendAuctionWonNotification,
  sendPaymentReminderNotification,
  sendOutbidNotification
} from './emailService';
import { processAuctionCrons } from './cronProcessor';
import {
  adminDb,
  adminAuth,
  getAuth,
  uploadBufferToStorage,
  isDocSnapshotExists,
  getDocSnapshotData,
  FieldValue
} from '../lib/firebase-admin';

async function safeGetDocs(queryRef: any) {
  try {
    const snap = await queryRef.get();
    return {
      empty: snap.empty,
      size: snap.size,
      docs: snap.docs.map((d: any) => ({
        id: d.id,
        ref: d.ref,
        data: () => getDocSnapshotData(d) || {},
        exists: () => isDocSnapshotExists(d)
      }))
    };
  } catch (error: any) {
    console.warn("[safeGetDocs] Failed to fetch docs:", error.message);
    return { empty: true, size: 0, docs: [] as any[] };
  }
}

async function safeGetDoc(docRef: any) {
  try {
    const snap = await docRef.get();
    const exists = isDocSnapshotExists(snap);
    return {
      exists: () => exists,
      data: () => (exists ? getDocSnapshotData(snap) : null),
      id: snap.id,
      ref: docRef
    };
  } catch (error: any) {
    console.warn("[safeGetDoc] Failed to fetch doc:", error.message);
    return {
      exists: () => false,
      data: () => null,
      id: docRef.id || '',
      ref: docRef
    };
  }
}

async function generateInvoiceNumber(type: 'SALES' | 'COMMISSION'): Promise<string> {
  const year = new Date().getFullYear();
  const docId = `${type}_${year}`;
  const counterRef = adminDb.collection('invoice_counters').doc(docId);

  return await adminDb.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let currentNumber = 1;

    if (isDocSnapshotExists(counterDoc)) {
      const data = getDocSnapshotData(counterDoc);
      currentNumber = (data?.current_number || 0) + 1;
      transaction.update(counterRef, { current_number: currentNumber });
    } else {
      transaction.set(counterRef, {
        type,
        year,
        current_number: 1
      });
    }

    const prefix = type === 'SALES' ? 'RAC' : 'PROV';
    const formattedNum = String(currentNumber).padStart(6, '0');
    return `${prefix}-${year}-${formattedNum}`;
  });
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
        await adminDb.collection('users').doc(userId).set({
          stripe_customer_id: customerId,
          stripeCustomerId: customerId
        }, { merge: true });
      }
    } catch (e: any) {
      console.error("Error creating/linking stripe customer:", e.message);
    }
  }

  return customerId;
}

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

function getBidIncrement(price: number): number {
  if (price < 50) return 1;
  if (price < 500) return 5;
  if (price < 2000) return 20;
  if (price < 5000) return 50;
  return 100;
}

const app = express();

app.use(cors());

// URL Normalizer for Vercel Serverless environment
app.use((req, _res, next) => {
  if (process.env.VERCEL) {
    const matchedPath = (req.headers['x-matched-path'] as string) || (req.headers['x-invoke-path'] as string);
    let resolvedUrl = req.url || '/';

    if (matchedPath && matchedPath.startsWith('/api')) {
      resolvedUrl = matchedPath;
    } else if (req.originalUrl && req.originalUrl.startsWith('/api') && (req.url === '/' || req.url.startsWith('/api/index') || req.url === '')) {
      resolvedUrl = req.originalUrl;
    } else if (!resolvedUrl.startsWith('/api') && !resolvedUrl.startsWith('/webhook')) {
      resolvedUrl = '/api' + (resolvedUrl.startsWith('/') ? resolvedUrl : '/' + resolvedUrl);
    }

    resolvedUrl = resolvedUrl.replace(/^\/api\/api\//, '/api/');

    if (resolvedUrl === '/api/index.ts' || resolvedUrl === '/api/index') {
      if (req.originalUrl && req.originalUrl !== resolvedUrl) {
        resolvedUrl = req.originalUrl;
      }
    }

    req.url = resolvedUrl;
  }
  next();
});

// Webhook must be mounted BEFORE express.json() to preserve raw Buffer for Stripe signature validation
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'payment_intent.succeeded' || event.type === 'checkout.session.completed') {
    const isSession = event.type === 'checkout.session.completed';
    const sessionObj = isSession ? (event.data.object as Stripe.Checkout.Session) : null;
    const paymentIntent = !isSession ? (event.data.object as Stripe.PaymentIntent) : null;

    const rawMetadata = isSession ? (sessionObj?.metadata || {}) : (paymentIntent?.metadata || {});
    const paymentId = isSession ? sessionObj!.id : paymentIntent!.id;
    console.log('Payment event succeeded:', event.type, paymentId);

    try {
      const { type, purpose, auction_id, buyer_id, seller_id, fee_percentage, user_id, package_id } = rawMetadata;

      // Handle Test Wallet Funding from Stripe PaymentIntent
      if (purpose === 'test_wallet_funding' || type === 'test_wallet_funding') {
        const targetUserId = user_id || buyer_id;
        const amountCents = isSession ? (sessionObj?.amount_total || 0) : (paymentIntent?.amount || 0);
        const piId = isSession 
          ? (typeof sessionObj?.payment_intent === 'string' ? sessionObj.payment_intent : sessionObj?.payment_intent?.id || sessionObj!.id)
          : paymentIntent!.id;

        if (targetUserId && amountCents > 0 && piId) {
          console.log(`[stripe-webhook] eventId=${event.id} paymentIntentId=${piId} userId=${targetUserId} walletCredit=${amountCents}`);
          const depositResult = await creditWalletDepositFromStripe(targetUserId, amountCents, piId, {
            description: 'Platform test balance funding',
            environment: 'test',
            webhook_event_id: event.id,
            idempotencyKey: `wallet_dep_${piId}`
          });
          console.log(`[stripe-webhook] eventId=${event.id} paymentIntentId=${piId} userId=${targetUserId} walletCredit=${amountCents} alreadyProcessed=${depositResult.already_processed}`);
        } else {
          console.warn('[stripe-webhook] Missing user_id or amount for test_wallet_funding:', { targetUserId, amountCents, piId });
        }
        res.json({ received: true });
        return;
      }

      if (type === 'subscription') {
        const targetUserId = user_id || buyer_id;
        console.log('Processing subscription payment for user', targetUserId);
        if (targetUserId && package_id) {
          const updateData: any = {
            subscription_tier: package_id,
            subscription_active: true,
            subscription_paid_at: new Date().toISOString()
          };
          
          let paymentMethodId = null;
          let customerId = null;
          
          if (isSession && sessionObj?.payment_intent) {
            const pi = typeof sessionObj.payment_intent === 'string' 
              ? await stripe.paymentIntents.retrieve(sessionObj.payment_intent as string)
              : sessionObj.payment_intent;
            if (typeof pi === 'object' && pi.payment_method) {
               paymentMethodId = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method.id;
            }
          } else if (!isSession && paymentIntent?.payment_method) {
            paymentMethodId = typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method.id;
          }
          
          if (isSession && sessionObj?.customer) {
            customerId = typeof sessionObj.customer === 'string' ? sessionObj.customer : sessionObj.customer.id;
          } else if (!isSession && paymentIntent?.customer) {
            customerId = typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer.id;
          }
          
          if (paymentMethodId && customerId) {
            updateData.stripe_default_payment_method = paymentMethodId;
            updateData.stripe_customer_id = customerId;
          }
          
          await adminDb.collection('users').doc(targetUserId).update(updateData);
        }
        res.json({ received: true });
        return;
      }

      // Default type is auction
      if (!auction_id || !buyer_id || !seller_id) {
        console.warn('Missing metadata for payment:', paymentId);
        res.json({ received: true });
        return;
      }

      // 2. Fetch buyer and seller details
      const buyerDoc = await safeGetDoc(adminDb.collection('users').doc(buyer_id));
      const buyer = buyerDoc.data();
      const sellerDoc = await safeGetDoc(adminDb.collection('users').doc(seller_id));
      const seller = sellerDoc.data();

      if (!buyer || !seller) throw new Error('Buyer or seller not found');

      // 3. Calculate Fee and VAT dynamically based on active subscription tier and closing price
      const amountTotalInCents = isSession ? (sessionObj?.amount_total || 0) : paymentIntent!.amount;
      const amountTotal = amountTotalInCents / 100;

      // Fetch auction to get exact price instead of estimating it
      const auctionDoc = await safeGetDoc(adminDb.collection('auctions').doc(auction_id));
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
      let transaction: any = null;
      try {
        const txRef = await adminDb.collection('transactions').add({
          auction_id,
          buyer_id,
          seller_id,
          stripe_payment_intent_id: paymentId,
          amount_total: amountTotal,
          platform_fee: platformFee,
          vat_amount: vatAmount,
          vat_rate: vatRate,
          is_reverse_charge: isReverseCharge,
          status: 'completed',
          created_at: new Date().toISOString()
        });
        const snap = await safeGetDoc(txRef);
        transaction = { id: txRef.id, ...snap.data() };
      } catch (e: any) {
        console.error('Error creating transaction record:', e.message);
        throw e;
      }

      // 5. Update Auction Status to mark as paid
      try {
        await adminDb.collection('auctions').doc(auction_id).update({
          status: 'completed',
          payment_status: 'paid',
          post_auction_status: 'paid',
          paid_at: new Date().toISOString()
        });

        // Credit seller's held wallet
        const currentPriceCents = Math.round(currentPrice * 100);
        await addHeldFunds(seller_id, currentPriceCents, 'stripe_' + paymentId, { stripe_payment_intent_id: paymentId, auction_id });
      } catch (e: any) {
        console.error('Error updating auction status or wallet:', e.message);
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

        await adminDb.collection('users').doc(buyer_id).update({
          yearly_spent: updatedYearlySpent,
          yearly_spent_year: currentYear,
          [`yearly_spent_by_year.${currentYear}`]: updatedYearlySpent,
          total_spent: updatedTotalSpent,
          purchases_count: updatedPurchasesCount,
          last_purchase_at: new Date().toISOString()
        });
      } catch (spentErr: any) {
        console.error('Error updating buyer spending records in server webhook:', spentErr.message);
      }

      // 6. Generate Invoice Numbers
      let salesInvoiceNo = `ITEM-${transaction.id.substring(0, 8)}`;
      let commissionInvoiceNo = `FEE-${transaction.id.substring(0, 8)}`;
      try {
        salesInvoiceNo = await generateInvoiceNumber('SALES');
        commissionInvoiceNo = await generateInvoiceNumber('COMMISSION');
        await adminDb.collection('transactions').doc(transaction.id).update({
          sales_invoice_no: salesInvoiceNo,
          commission_invoice_no: commissionInvoiceNo
        });
      } catch (e: any) {
        console.error('Error generating invoice numbers:', e.message);
      }

      // 7. Generate Documents
      const documentsToInsert: any[] = [];
      const attachments: any[] = [];
      let auctionDataPdf: any = null;

      try {
        const auctionDocPdf = await safeGetDoc(adminDb.collection('auctions').doc(auction_id));
        auctionDataPdf = auctionDocPdf.data();
        const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller, auctionDataPdf, salesInvoiceNo, commissionInvoiceNo);
        const invoiceFileName = `racun_${salesInvoiceNo}.pdf`;

        // Upload to Storage via Admin SDK
        const publicUrl = await uploadBufferToStorage(invoicePdfBuffer, `${buyer_id}/${invoiceFileName}`);
        documentsToInsert.push({
          transaction_id: transaction.id,
          user_id: buyer_id,
          type: 'invoice',
          file_url: publicUrl,
          created_at: new Date().toISOString()
        });

        attachments.push({
          filename: invoiceFileName,
          content: invoicePdfBuffer
        });
      } catch (pdfErr: any) {
        console.error('Error generating/uploading invoice PDF:', pdfErr.message);
      }

      if (documentsToInsert.length > 0) {
        try {
          const batch = adminDb.batch();
          documentsToInsert.forEach(d => {
            const ref = adminDb.collection('documents').doc();
            batch.set(ref, d);
          });
          await batch.commit();
        } catch (docErr: any) {
          console.error('Error saving document records:', docErr.message);
        }
      }

      if (buyer.email && process.env.RESEND_API_KEY) {
        try {
          const auctionTitleText = auctionDataPdf?.title?.SLO || auctionDataPdf?.title?.EN || 'Predmet dražbe';
          const auctionUrl = `${process.env.APP_URL || 'https://drazba.si'}/?drazba=${auction_id}`;
          
          const htmlContent = await render(React.createElement(AuctionEmailTemplate, {
            type: 'payment_success',
            recipientName: buyer.first_name || buyer.name || 'uporabnik',
            auctionTitle: auctionTitleText,
            auctionImageUrl: auctionDataPdf?.images?.[0]?.url,
            currentPrice: transaction.amount_total,
            auctionUrl,
            settingsUrl: `${process.env.APP_URL || 'https://drazba.si'}/?tab=settings`,
          }));

          const resendClient = new Resend(process.env.RESEND_API_KEY);
          await resendClient.emails.send({
            from: process.env.EMAIL_FROM || 'Drazba.si <obvestila@drazba.si>',
            to: buyer.email,
            subject: `Potrdilo o plačilu in dokumenti: ${auctionTitleText} - Drazba.si`,
            html: htmlContent,
            attachments
          });
          console.log(`Email sent successfully to ${buyer.email}`);
        } catch (emailErr: any) {
          console.error('Error sending success email:', emailErr.message);
        }
      }

    } catch (err: any) {
      console.error("Error processing successful payment:", err.message);
    }
  }

  res.json({ received: true });
});

// JSON Body Parser for all non-webhook routes
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, (err) => {
    if (err) {
      console.warn('[JSON parse warning]:', err.message);
    }
    next();
  });
});

app.use((req, _res, next) => {
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      // ignore malformed strings
    }
  }
  next();
});

// Unified Cron handler for Vercel Cron and external schedulers
const handleCronCheck = async (req: express.Request, res: express.Response) => {
  try {
    const authHeader = req.headers.authorization || '';
    const secretHeader = req.headers['x-cron-secret'];
    const querySecret = req.query?.secret;
    const cronSecret = process.env.CRON_SECRET;

    const isBearerMatch = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
    const isSecretHeaderMatch = Boolean(cronSecret && secretHeader === cronSecret);
    const isQueryMatch = Boolean(cronSecret && querySecret === cronSecret);

    if (!isBearerMatch && !isSecretHeaderMatch && !isQueryMatch) {
      console.warn('[CRON AUTH] Unauthorized cron request attempt');
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' });
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

    const auctionRef = adminDb.collection('auctions').doc(auction_id);
    const userRef = adminDb.collection('users').doc(user_id);

    // Verify user existence and state
    const userSnap = await safeGetDoc(userRef);
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

    await adminDb.runTransaction(async (transaction) => {
      const auctionDoc = await transaction.get(auctionRef);
      if (!isDocSnapshotExists(auctionDoc)) {
        throw new Error("Dražba ne obstaja.");
      }
      const data = getDocSnapshotData(auctionDoc) || {};
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
          const prevUserDoc = await safeGetDoc(adminDb.collection('users').doc(outbidUserToNotify!.userId));
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
        } catch (emailErr: any) {
          console.error('[OUTBID EMAIL ERROR]', emailErr.message);
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

    const [auctionDoc, userDoc] = await Promise.all([
      safeGetDoc(adminDb.collection('auctions').doc(auction_id)),
      safeGetDoc(adminDb.collection('users').doc(outbid_user_id)),
    ]);

    if (!auctionDoc.exists() || !userDoc.exists()) {
      return res.status(404).json({ error: "Dražba ali uporabnik ne obstaja" });
    }

    const auctionData = auctionDoc.data();
    const userData = userDoc.data();

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { amount, currency = "eur", auction_id, auctionId, buyer_id, seller_id, fee_percentage, return_url, type = "auction", user_id, userId, buyer_data } = req.body || {};
    const stripe = getStripe();

    const effectiveAuctionId = auction_id || auctionId;
    const effectiveBuyerId = buyer_id || user_id || userId;
    let auctionTitle = "Plačilo";
    let sessionMetadata: any = { type };
    let buyer: any = buyer_data || null;
    let stripeCustomerId: string | null = null;
    let finalAmountCents = 0;

    // Check EU AML law: 10,000 € annual limit check for buyers without ID verification
    if (effectiveBuyerId) {
      if (!buyer) {
        try {
          const buyerDoc = await safeGetDoc(adminDb.collection('users').doc(effectiveBuyerId));
          if (buyerDoc.exists()) {
            buyer = buyerDoc.data();
          }
        } catch (e: any) {
          console.warn("Could not fetch buyer from DB, proceeding without full verification check:", e.message);
        }
      }

      if (buyer) {
        stripeCustomerId = await getOrCreateStripeCustomer(stripe, effectiveBuyerId, buyer);

        const currentYear = new Date().getFullYear();
        let currentYearSpent = 0;

        if (buyer.yearly_spent_by_year && buyer.yearly_spent_by_year[currentYear]) {
          currentYearSpent = Number(buyer.yearly_spent_by_year[currentYear]) || 0;
        } else if (buyer.yearly_spent_year === currentYear && typeof buyer.yearly_spent === 'number') {
          currentYearSpent = buyer.yearly_spent;
        }

        const isVerified = !!(buyer.is_verified || buyer.is_id_verified || buyer.id_document_verified);
        if (currentYearSpent > 10000 && !isVerified) {
          return res.status(400).json({
            error: "V skladu z zakonodajo EU (ZPPDFT-2 / AML) je za skupne letne nakupe nad 10.000 € obvezna identifikacija z osebnim dokumentom. Prosimo, verificirajte svoj profil v nastavitvah pred nadaljevanjem."
          });
        }
      }
    }

    let diagnosticInfo: any = {
      route: '/api/create-checkout-session',
      type,
      hasAuctionId: !!effectiveAuctionId,
      auctionFound: false,
      usedPriceField: 'none',
      computedCents: NaN
    };

    if (type === "auction") {
      if (!effectiveAuctionId || !effectiveBuyerId) {
         return res.status(400).json({ error: "Missing required auction fields for payment" });
      }

      let auction: any = null;
      try {
        const auctionDoc = await safeGetDoc(adminDb.collection('auctions').doc(effectiveAuctionId));
        if (auctionDoc.exists()) {
          auction = auctionDoc.data();
          diagnosticInfo.auctionFound = true;
        }
      } catch (e) {
        console.warn("Could not fetch auction:", e);
      }

      if (!auction) {
        return res.status(400).json({ error: "Invalid auction payment amount (auction not found)" });
      }

      if (auction.title) {
        auctionTitle = auction.title['SLO'] || auction.title['EN'] || "Dražba";
      }
      
      let authoritativePriceInCents = 0;
      
      if (auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.current_price);
        diagnosticInfo.usedPriceField = 'current_price';
      } else if (auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.currentBid);
        diagnosticInfo.usedPriceField = 'currentBid';
      } else if (auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.starting_price);
        diagnosticInfo.usedPriceField = 'starting_price';
      }

      if (authoritativePriceInCents <= 0) {
        return res.status(400).json({ error: "Invalid auction payment amount" });
      }

      const sellerDoc = await safeGetDoc(adminDb.collection('users').doc(seller_id || auction.seller_id || auction.sellerId || ''));
      let sellerTier = 'BASIC';
      if (sellerDoc.exists()) sellerTier = sellerDoc.data().subscription_tier;
      const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);
      finalAmountCents = totals.buyerTotalInCents;

      sessionMetadata = {
        type: 'auction',
        auction_id: effectiveAuctionId,
        buyer_id: effectiveBuyerId,
        seller_id: seller_id || auction.seller_id || auction.sellerId || '',
        fee_percentage: fee_percentage || ''
      };
    } else if (type === "subscription") {
      const planIdStr = (req.body.planId || req.body.package_id || '').toLowerCase();
      if (planIdStr.includes('pro')) finalAmountCents = 5000;
      else if (planIdStr.includes('basic')) finalAmountCents = 2000;
      else finalAmountCents = parseAmountToCents(amount);

      auctionTitle = "Naročnina - " + (req.body.planId || 'Paket');
      sessionMetadata = {
        type: 'subscription',
        buyer_id: effectiveBuyerId || '',
        user_id: effectiveBuyerId || '',
        planId: req.body.planId || ''
      };
    } else {
      auctionTitle = "Plačilo dražbe";
      finalAmountCents = parseAmountToCents(amount);
      sessionMetadata = {
        type: 'auction',
        auction_id: effectiveAuctionId || '',
        buyer_id: effectiveBuyerId || '',
        seller_id: seller_id || '',
      };
    }

    diagnosticInfo.computedCents = finalAmountCents;
    console.log("[DIAGNOSTIC] create-checkout-session amounts:", JSON.stringify(diagnosticInfo));

    if (finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid auction payment amount" });
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: auctionTitle,
          },
          unit_amount: finalAmountCents,
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
          await adminDb.collection('users').doc(targetUserId).update({
            subscription_tier: packageId,
            subscription_active: true,
            subscription_paid_at: new Date().toISOString()
          });
        }
        return res.json({ success: true, type: 'subscription' });
      }

      if (effectiveAuctionId) {
        await adminDb.collection('auctions').doc(effectiveAuctionId).update({
          status: 'completed',
          payment_status: 'paid',
          post_auction_status: 'paid',
          paid_at: new Date().toISOString()
        });

        if (effectiveBuyerId && effectiveSellerId) {
          const buyerDoc = await safeGetDoc(adminDb.collection('users').doc(effectiveBuyerId));
          const buyer = buyerDoc.data() || {};
          const sellerDoc = await safeGetDoc(adminDb.collection('users').doc(effectiveSellerId));
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
            const existingTx = await safeGetDocs(
              adminDb.collection('transactions').where('stripe_payment_intent_id', '==', (paymentIntent?.id || session.id))
            );

            if (existingTx.empty) {
              await adminDb.collection('transactions').add({
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

            await adminDb.collection('users').doc(effectiveBuyerId).update({
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
      await adminDb.collection('auctions').doc(auctionId).update({
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
    const { amount, currency = "eur", auction_id, auctionId, buyer_id, seller_id, fee_percentage, user_id, userId } = req.body || {};
    const stripe = getStripe();
    const effectiveAuctionId = auction_id || auctionId;
    const effectiveBuyerId = buyer_id || user_id || userId;

    let stripeCustomerId: string | null = null;
    let buyer: any = null;
    if (effectiveBuyerId) {
      const buyerDoc = await safeGetDoc(adminDb.collection('users').doc(effectiveBuyerId));
      if (buyerDoc.exists()) {
        buyer = buyerDoc.data();
        stripeCustomerId = await getOrCreateStripeCustomer(stripe, effectiveBuyerId, buyer);
      }
    }

    let finalAmountCents = 0;
    
    if (effectiveAuctionId) {
      try {
        const auctionDoc = await safeGetDoc(adminDb.collection('auctions').doc(effectiveAuctionId));
        if (auctionDoc.exists()) {
          const auction = auctionDoc.data();
          let authoritativePriceInCents = 0;
          
          if (auction && auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
            authoritativePriceInCents = parseAmountToCents(auction.current_price);
          } else if (auction && auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
            authoritativePriceInCents = parseAmountToCents(auction.currentBid);
          } else if (auction && auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
            authoritativePriceInCents = parseAmountToCents(auction.starting_price);
          }
          
          if (!isNaN(authoritativePriceInCents)) {
             const sellerDoc = await safeGetDoc(adminDb.collection('users').doc(seller_id || auction.seller_id || auction.sellerId || ''));
             let sellerTier = 'BASIC';
             if (sellerDoc.exists()) sellerTier = sellerDoc.data().subscription_tier;
             const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);
             finalAmountCents = totals.buyerTotalInCents;
          }
        }
      } catch(e) {
        console.warn("Could not fetch auction for payment intent:", e);
      }
    }
    
    if (finalAmountCents <= 0) {
      finalAmountCents = parseAmountToCents(amount);
    }

    if (finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid payment intent amount" });
    }

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: finalAmountCents,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type: 'auction',
        auction_id: effectiveAuctionId || '',
        buyer_id: effectiveBuyerId || '',
        seller_id: seller_id || '',
        fee_percentage: fee_percentage || ''
      }
    };

    if (stripeCustomerId) {
      intentParams.customer = stripeCustomerId;
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Stripe Payment Intent Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/stripe-account-session", async (req, res) => {
  try {
    const { user_id } = req.body;
    const stripe = getStripe();

    const userDoc = await safeGetDoc(adminDb.collection('users').doc(user_id));
    const user = userDoc.data();
    let accountId = user?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true }
        }
      });
      accountId = account.id;
      await adminDb.collection('users').doc(user_id).update({ stripe_account_id: accountId });
    }

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    res.status(200).json({ client_secret: accountSession.client_secret });
  } catch (error: any) {
    console.error("Stripe Account Session Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/stripe-account-link", async (req, res) => {
  try {
    const { user_id, userId, return_url, refresh_url } = req.body;
    const targetUserId = userId || user_id;
    const stripe = getStripe();

    const userDocRef = adminDb.collection('users').doc(targetUserId);
    const userDoc = await safeGetDoc(userDocRef);
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
      await userDocRef.set({ stripeAccountId: targetStripeAccountId }, { merge: true });
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

    if (targetStripeAccountId && user.stripe_onboarding_complete) {
      const loginLink = await stripe.accounts.createLoginLink(targetStripeAccountId);
      return res.json({ url: loginLink.url });
    }

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
    let userId: string;
    try {
      userId = await authenticateFirebaseUser(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized' });
    }

    const stripe = getStripe();

    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await safeGetDoc(userDocRef);
    const user = userDoc.data() || {};

    let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;

    if (!targetStripeAccountId) {
      return res.json({ complete: false });
    }

    const account = await stripe.accounts.retrieve(targetStripeAccountId);
    const isComplete = account.details_submitted && account.charges_enabled;

    await userDocRef.set({ stripe_onboarding_complete: isComplete }, { merge: true });

    res.json({ complete: isComplete, account });
  } catch (error: any) {
    console.error("Stripe Check Account Status Error:", error);
    res.status(500).json({ error: error.message || 'Server configuration error' });
  }
});

app.post("/api/payments/wallet-pay-auction", async (req, res) => {
  try {
    let userId: string;
    try {
      userId = await authenticateFirebaseUser(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized' });
    }

    const { auction_id } = req.body || {};
    if (!auction_id) {
      return res.status(400).json({ error: "Manjkajoči podatki" });
    }

    const txId = await adminDb.runTransaction(async (t) => {
      let auction: any = null;
      const auctionRef = adminDb.collection('auctions').doc(auction_id);
      const auctionDoc = await t.get(auctionRef);
      if (auctionDoc.exists) {
        auction = auctionDoc.data();
      } else {
        throw new Error("Dražba ne obstaja");
      }
      
      const buyer_id = auction.highest_bidder || auction.winner_id;
      if (userId !== buyer_id) {
        throw new Error("Samo zmagovalec lahko plača dražbo");
      }
      
      const seller_id = auction.seller_id;
      if (!seller_id) throw new Error("Missing seller info");

      let authoritativePriceInCents = 0;
      if (auction.current_price !== undefined && auction.current_price !== null && auction.current_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.current_price);
      } else if (auction.currentBid !== undefined && auction.currentBid !== null && auction.currentBid !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.currentBid);
      } else if (auction.starting_price !== undefined && auction.starting_price !== null && auction.starting_price !== '') {
        authoritativePriceInCents = parseAmountToCents(auction.starting_price);
      }

      if (authoritativePriceInCents <= 0) {
        throw new Error("Invalid auction price");
      }

      const sellerRef = adminDb.collection('users').doc(seller_id);
      const sellerDoc2 = await t.get(sellerRef);
      let sellerTier = 'BASIC';
      let sellerData: any = {};
      if (sellerDoc2.exists) {
         sellerData = sellerDoc2.data() || {};
         sellerTier = sellerData.subscription_tier || 'BASIC';
      }
      const totals = calculateCheckoutTotals(authoritativePriceInCents, sellerTier);
      const finalAmountCents = totals.buyerTotalInCents;

      const buyerRef = adminDb.collection('users').doc(buyer_id);
      const buyerDoc = await t.get(buyerRef);
      const buyerData = buyerDoc.data() || {};
      
      // Ensure wallet migration
      const buyerWallet = ensureWalletMigrated(t, buyerRef, buyerData);
      if (buyerWallet.available_cents < finalAmountCents) {
        throw new Error("Ni dovolj sredstev v denarnici");
      }

      // Debit buyer
      t.update(buyerRef, {
        available_cents: FieldValue.increment(-finalAmountCents)
      });
      
      // Ensure seller wallet migration and credit held funds
      ensureWalletMigrated(t, sellerRef, sellerData);
      t.update(sellerRef, {
        held_cents: FieldValue.increment(authoritativePriceInCents) // Seller gets the item price (before platform fee is applied if we assume buyer pays fee? Wait, calculateCheckoutTotals adds platform fee to itemPrice. Actually, seller proceeds is authoritativePriceInCents - totals.platformFeeInCents - totals.vatInCents? Wait, check the original code: it credited `authoritativePriceInCents / 100`. Let's use authoritativePriceInCents)
      });
      
      // Update auction
      t.update(auctionRef, {
        payment_status: 'paid',
        post_auction_status: 'sold',
        status: 'completed',
      });

      const txId = 'WTX_' + Date.now();
      t.set(adminDb.collection('transactions').doc(txId), {
        type: 'wallet_payment',
        auction_id,
        buyer_id,
        seller_id,
        amount_total: finalAmountCents / 100, // legacy UI compatibility
        amount_cents: finalAmountCents,
        platform_fee: totals.platformFeeInCents / 100,
        vat_amount: totals.vatInCents / 100,
        vat_rate: 0,
        is_reverse_charge: false,
        currency: 'eur',
        status: 'completed',
        created_at: FieldValue.serverTimestamp()
      });
      
      // Also add wallet ledger entries
      const wtxBuyerId = adminDb.collection('wallet_transactions').doc().id;
      t.set(adminDb.collection('wallet_transactions').doc(wtxBuyerId), {
        transaction_id: wtxBuyerId,
        user_id: buyer_id,
        type: 'wallet_payment',
        amount_cents: finalAmountCents,
        status: 'completed',
        idempotency_key: txId + "_buyer",
        created_at: FieldValue.serverTimestamp()
      });
      
      const wtxSellerId = adminDb.collection('wallet_transactions').doc().id;
      t.set(adminDb.collection('wallet_transactions').doc(wtxSellerId), {
        transaction_id: wtxSellerId,
        user_id: seller_id,
        type: 'hold',
        amount_cents: authoritativePriceInCents,
        status: 'completed',
        auction_id: auction_id,
        idempotency_key: txId + "_seller",
        created_at: FieldValue.serverTimestamp()
      });
      
      return txId;
    });

    res.json({ success: true, transaction_id: txId });
  } catch (error: any) {
    console.error("Wallet pay error:", error);
    res.status(500).json({ error: error.message || "Napaka" });
  }
});

app.post("/api/payments/wallet-pay-subscription", async (req, res) => {
  try {
    let userId: string;
    try {
      userId = await authenticateFirebaseUser(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized' });
    }

    const { package_id } = req.body || {};
    if (!package_id) {
      return res.status(400).json({ error: "Manjka package_id" });
    }

    const packageIdStr = String(package_id).toLowerCase();
    let amountCents = 0;
    if (packageIdStr.includes('pro')) amountCents = 5000;
    else if (packageIdStr.includes('basic')) amountCents = 2000;
    else {
      return res.status(400).json({ error: "Neznan paket" });
    }

    const idempotencyKey = `sub_wallet_${userId}_${Date.now()}`;
    const txId = await reserveWalletFunds(userId, amountCents, 'wallet_payment', idempotencyKey, {
      package_id,
      type: 'subscription'
    });

    await commitReservedFunds(txId);

    const tierToSet = packageIdStr.includes('pro') ? 'PRO' : 'BASIC';
    await adminDb.collection('users').doc(userId).update({
      subscription_tier: tierToSet,
      subscription_active: true,
      subscription_paid_at: new Date().toISOString()
    });

    console.log('Subscription paid via wallet:', package_id, 'by user:', userId);
    res.json({ success: true, transaction_id: txId, subscription_tier: tierToSet });
  } catch (error: any) {
    console.error("Wallet pay subscription error:", error);
    res.status(500).json({ error: error.message || "Napaka" });
  }
});

app.post("/api/payouts/withdraw", async (req, res) => {
  try {
    let userId: string;
    try {
      userId = await authenticateFirebaseUser(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || 'Unauthorized' });
    }

    const { amount, return_url, refresh_url } = req.body || {};
    const stripe = getStripe();

    const amountInCents = parseAmountToCents(amount);
    if (amountInCents <= 0) {
       return res.status(400).json({ error: "Invalid payout amount" });
    }

    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await safeGetDoc(userDocRef);
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userDoc.data() || {};

    let stripeAccountId = user.stripeAccountId || user.stripe_account_id;
    if (!stripeAccountId) {
       return res.status(400).json({ error: "Stripe račun ni povezan" });
    }
    
    // Ensure Stripe account can receive transfers
    const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
    const payoutsReady = stripeAccount.payouts_enabled || stripeAccount.charges_enabled || (stripeAccount.capabilities && stripeAccount.capabilities.transfers === 'active');
    if (!payoutsReady) {
      return res.status(400).json({ error: "Stripe payouts are not enabled for this account" });
    }

    const idempotencyKey = `withdraw_${userId}_${Date.now()}`;

    // 1. Reserve funds
    let txId: string;
    try {
      txId = await reserveWalletFunds(userId, amountInCents, 'withdrawal', idempotencyKey);
    } catch (e: any) {
      return res.status(400).json({ error: e.message || "Insufficient funds" });
    }

    // 2. Transfer to Connected Account
    try {
      // In test mode, ensure platform balance has sufficient test funds
      await ensurePlatformTestBalance(stripe, amountInCents);

      const transfer = await stripe.transfers.create({
        amount: amountInCents,
        currency: "eur",
        destination: stripeAccountId,
        description: `Izplačilo drazbe.si za uporabnika ${userId}`
      }, {
        idempotencyKey
      });

      await commitReservedFunds(txId, { stripe_transfer_id: transfer.id });

      const updatedUserDoc = await safeGetDoc(userDocRef);
      const remainingAvailable = updatedUserDoc.data()?.available_cents || 0;

      res.json({
        success: true,
        transfer_id: transfer.id,
        available_cents: remainingAvailable,
        wallet_balance: remainingAvailable / 100
      });
    } catch (transferError: any) {
      console.error("Stripe transfer failed, rolling back reserved funds:", transferError.message);
      await rollbackReservedFunds(txId);

      const safeDiag = formatStripeError(transferError);
      console.warn(`[Withdrawal Diagnostics] Type: ${safeDiag.type || 'none'}, Code: ${safeDiag.code || 'none'}, RequestId: ${safeDiag.requestId || 'none'}`);

      res.status(safeDiag.statusCode || 400).json({
        error: safeDiag.userMessage,
        diagnostics: {
          type: safeDiag.type,
          code: safeDiag.code,
          requestId: safeDiag.requestId
        }
      });
    }
  } catch (error: any) {
    console.error("Payout error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/create-subscription-checkout", async (req, res) => {
  try {
    const { amount, currency = "eur", user_id, package_id, return_url } = req.body || {};
    const stripe = getStripe();

    const packageIdStr = (package_id || '').toLowerCase();
    let finalAmountCents = 0;
    if (packageIdStr.includes('pro')) {
       finalAmountCents = 5000;
    } else if (packageIdStr.includes('basic')) {
       finalAmountCents = 2000;
    } else {
       finalAmountCents = parseAmountToCents(amount);
    }

    if (finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid subscription payment amount" });
    }

    let customerId: string | undefined = undefined;
    if (user_id) {
      const userDoc = await safeGetDoc(adminDb.collection('users').doc(user_id));
      if (userDoc.exists()) {
        const cId = await getOrCreateStripeCustomer(stripe, user_id, userDoc.data());
        if (cId) customerId = cId;
      }
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { name: 'auto', address: 'auto' },
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: `Naročnina - Paket ${package_id || 'Premium'}`,
          },
          unit_amount: finalAmountCents,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'subscription',
        user_id: user_id || '',
        package_id: package_id || '',
        amount: finalAmountCents.toString()
      },
      payment_intent_data: {
        setup_future_usage: 'off_session',
        metadata: {
          type: 'subscription',
          user_id: user_id || '',
          package_id: package_id || '',
          amount: finalAmountCents.toString()
        }
      },
      mode: 'payment',
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
      const userDoc = await safeGetDoc(adminDb.collection('users').doc(targetUserId));
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

// TEST / DIAGNOSTIC ENDPOINTS
app.post("/api/test/send-email", async (req, res) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(500).json({
        error: "RESEND_API_KEY is missing",
        message: "RESEND_API_KEY environment variable is not defined in the server environment.",
        resendConfigured: false
      });
    }

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
    const {
      toEmail,
      type = 'outbid',
      recipientName = "Testni Uporabnik",
      auctionId = "test-auction-123",
      auctionTitle = "Industrijski CNC obdelovalni center Haas VF-2",
      currentPrice = 1250,
      auctionImageUrl = "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=60",
    } = body;

    if (!toEmail) {
      return res.status(400).json({ error: "E-poštni naslov prejemnika (toEmail) je obvezen." });
    }

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
      const fee = calculateMarginalPlatformFee(currentPrice, 'PRO');
      const mockTransaction = {
        id: `TX-${Date.now().toString().substring(6)}`,
        amount_total: currentPrice,
        platform_fee: fee,
        vat_amount: Math.round(fee * 0.22 * 100) / 100,
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

      const invoiceBuffer = await generateInvoicePDF(mockTransaction, mockBuyer, mockSeller, mockAuction, 'RAC-TEST-000001', 'PROV-TEST-000001');
      const attachments = [
        { filename: `racun_${mockTransaction.id}.pdf`, content: invoiceBuffer },
      ];

      const resendClient = new Resend(resendApiKey);
      const htmlContent = await render(React.createElement(AuctionEmailTemplate, {
        type: 'payment_success',
        recipientName: recipientName || 'Uporabnik',
        auctionTitle: auctionTitle,
        currentPrice: currentPrice,
        auctionUrl: `${process.env.APP_URL || 'https://drazba.si'}/?drazba=${auctionId}`,
        settingsUrl: `${process.env.APP_URL || 'https://drazba.si'}/?tab=settings`,
      }));

      const emailResponse = await resendClient.emails.send({
        from: process.env.EMAIL_FROM || 'dražbe.si <obvestila@drazba.si>',
        to: toEmail,
        subject: `🧾 Potrdilo o plačilu in račun: ${auctionTitle} - dražbe.si`,
        html: htmlContent,
        attachments
      });

      if (emailResponse.error) {
        sendResult = { success: false, error: emailResponse.error.message };
      } else {
        sendResult = { success: true, messageId: emailResponse.data?.id };
      }
    } else {
      return res.status(400).json({ error: "Neznan tip e-poštnega obvestila." });
    }

    if (sendResult && sendResult.success === false) {
      return res.status(400).json({
        success: false,
        error: sendResult.error || "Napaka pri pošiljanju e-pošte preko Resend API.",
        type,
        toEmail,
        details: sendResult,
        resendConfigured: true
      });
    }

    return res.json({
      success: true,
      type,
      toEmail,
      timestamp: new Date().toISOString(),
      details: sendResult,
      resendConfigured: true
    });
  } catch (error: any) {
    console.error("Email send error:", error);
    return res.status(500).json({
      error: error.message || "Nepričakovana napaka pri pošiljanju e-maila",
      stack: error.stack
    });
  }
});

app.post("/api/test/generate-pdf", async (req, res) => {
  try {
    const {
      relationshipType = "individual_individual",
      sellerData = {},
      buyerData = {},
      itemTitle = "Industrijski CNC obdelovalni center Haas VF-2",
      itemPrice = 1250,
      docType = "invoice"
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
    } else {
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
      pdfBuffer = Buffer.from('');
      filename = `Potrdilo_${mockTx.id}.pdf`;
    } else {
      pdfBuffer = await generateInvoicePDF(mockTx, buyer, seller, mockAuction, 'RAC-TEST-000001', 'PROV-TEST-000001');
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

app.post("/api/test/test-payout", async (req, res) => {
  try {
    let userId = req.body?.user_id;
    try {
      const authUid = await authenticateFirebaseUser(req);
      if (authUid) userId = authUid;
    } catch (_) {}

    const { amount = 50, executeReal = false } = req.body || {};
    const amountInCents = parseAmountToCents(amount);

    if (!userId) {
      return res.status(400).json({ error: "Manjka user_id." });
    }
    if (amountInCents <= 0) {
      return res.status(400).json({ error: "Znesek izplačila mora biti večji od 0." });
    }

    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await safeGetDoc(userDocRef);
    if (!userDoc.exists()) {
      return res.status(404).json({ error: "Uporabnik ne obstaja v bazi." });
    }
    const userData = userDoc.data() || {};
    const wallet = await getUserWallet(userId);
    const stripe = getStripe();

    const diag = await diagnoseStripeTransferPrerequisites(stripe, userData, amountInCents);
    const logs: string[] = [
      `[1] Preverjanje uporabnika: ${userData.first_name || ''} ${userData.last_name || userData.username || userId} (ID: ${userId})`,
      `[2] Trenutno razpoložljivo stanje v denarnici: ${(wallet.available_cents / 100).toFixed(2)} € (${wallet.available_cents} centov)`,
      `[3] Zahtevan znesek izplačila: ${(amountInCents / 100).toFixed(2)} € (${amountInCents} centov)`,
      ...diag.logs
    ];

    const hasSufficientBalance = wallet.available_cents >= amountInCents;
    logs.push(`[*] Preverjanje stanja denarnice: ${hasSufficientBalance ? 'DA (Zadostno dobroimetje)' : 'NE (Nezadostno dobroimetje)'}`);

    if (executeReal) {
      if (!hasSufficientBalance) {
        logs.push(`[X] Prekinitev: Sredstva v denarnici niso zadostna.`);
        return res.status(400).json({
          success: false,
          error: "Nezadostno stanje v denarnici za izvedbo izplačila.",
          logs,
          diagnostics: diag.details
        });
      }

      if (!diag.ready) {
        logs.push(`[X] Prekinitev: Zahteve Stripe Connect računa niso izpolnjene.`);
        return res.status(400).json({
          success: false,
          error: diag.issues[0] || "Stripe račun ni pripravljen za izplačilo.",
          logs,
          diagnostics: diag.details
        });
      }

      const stripeAccountId = userData.stripeAccountId || userData.stripe_account_id;
      const idempotencyKey = `test_payout_${userId}_${Date.now()}`;

      // Reserve funds in wallet
      logs.push(`[->] Rezervacija sredstev v denarnici (${amountInCents} centov)...`);
      let txId: string;
      try {
        txId = await reserveWalletFunds(userId, amountInCents, 'withdrawal', idempotencyKey, {
          description: `Testno izplačilo preko Stripe Connect (${(amountInCents / 100).toFixed(2)} €)`,
          environment: 'sandbox'
        });
        logs.push(`[OK] Sredstva uspešno rezervirana (ID transakcije: ${txId})`);
      } catch (reserveErr: any) {
        logs.push(`[X] Rezervacija ni uspela: ${reserveErr.message}`);
        return res.status(400).json({ success: false, error: reserveErr.message, logs });
      }

      // Ensure platform balance in test mode
      await ensurePlatformTestBalance(stripe, amountInCents);

      // Perform Stripe transfer
      logs.push(`[->] Izvajanje Stripe Connect transferja na račun ${stripeAccountId}...`);
      try {
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: "eur",
          destination: stripeAccountId,
          description: `Testno izplačilo drazbe.si za ${userId}`
        }, {
          idempotencyKey
        });

        logs.push(`[OK] Stripe transfer uspešno izveden! ID nakazila: ${transfer.id}`);

        // Commit reserved funds
        await commitReservedFunds(txId, {
          stripe_transfer_id: transfer.id,
          status: 'completed'
        });
        logs.push(`[OK] Knjiženje v denarnici potrjeno. Transakcija zaključena.`);

        const updatedWallet = await getUserWallet(userId);
        logs.push(`[=] Novo razpoložljivo stanje v denarnici: ${(updatedWallet.available_cents / 100).toFixed(2)} €`);

        return res.json({
          success: true,
          simulation: false,
          transfer_id: transfer.id,
          requestedAmount: amountInCents / 100,
          previousBalance: wallet.available_cents / 100,
          newBalance: updatedWallet.available_cents / 100,
          available_cents: updatedWallet.available_cents,
          logs,
          diagnostics: diag.details
        });
      } catch (transferErr: any) {
        logs.push(`[X] Stripe transfer ni uspel: ${transferErr.message}`);
        await rollbackReservedFunds(txId);
        logs.push(`[!] Rezervirana sredstva vrnjena v denarnico uporabnika (rollback).`);

        const safeErr = formatStripeError(transferErr);
        logs.push(`[Diagnoza] Koda napake: ${safeErr.code || safeErr.type || 'neznana'}, Sporočilo: ${safeErr.userMessage}`);

        return res.status(400).json({
          success: false,
          error: safeErr.userMessage,
          logs,
          diagnostics: {
            ...diag.details,
            stripeError: safeErr
          }
        });
      }
    } else {
      logs.push(`[7] Način simulacije: Denarnica ni bila zmanjšana in Stripe transfer ni bil sprožen.`);
      logs.push(`[8] Vklopi stikalo 'Izvedi pravo izplačilo' za dejansko nakazilo preko Stripe Connect.`);

      return res.json({
        success: true,
        simulation: true,
        requestedAmount: amountInCents / 100,
        previousBalance: wallet.available_cents / 100,
        newBalance: wallet.available_cents / 100,
        available_cents: wallet.available_cents,
        stripeAccountStatus: diag.ready ? 'ready' : (diag.details.stripeAccountId ? 'onboarding_required' : 'missing'),
        logs,
        diagnostics: diag.details
      });
    }
  } catch (err: any) {
    console.error("Test payout error:", err);
    res.status(500).json({ error: err.message || "Napaka pri testnem izplačilu" });
  }
});

app.post("/api/test/add-test-funds", async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY || '';
    if (!stripeKey.startsWith('sk_test_')) {
      return res.status(400).json({ error: "Ta funkcija je na voljo le v testnem načinu (Stripe Sandbox)." });
    }

    let userId = req.body?.user_id;
    try {
      const authUid = await authenticateFirebaseUser(req);
      if (authUid) userId = authUid;
    } catch (_) {}

    if (!userId) {
      return res.status(401).json({ error: "Zahtevana je avtentikacija uporabnika ali veljaven user_id" });
    }

    const { amount = 100 } = req.body || {};
    const amountInCents = parseAmountToCents(amount);
    if (amountInCents <= 0) {
      return res.status(400).json({ error: "Znesek mora biti večji od 0" });
    }

    const stripe = getStripe();
    const clientKey = req.body?.idempotencyKey || `pi_test_${Date.now()}`;
    const stripeIdempotencyKey = `stripe_pi_test_funding_${userId}_${clientKey}`;

    // 1. Create and confirm real Stripe test PaymentIntent with official test card pm_card_visa
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      payment_method: "pm_card_visa",
      confirm: true,
      return_url: "https://drazba.si/test-sandbox",
      payment_method_types: ['card'],
      description: "Platform test balance funding",
      metadata: {
        purpose: "test_wallet_funding",
        user_id: userId,
        environment: "test"
      }
    }, {
      idempotencyKey: stripeIdempotencyKey
    });

    console.log(`[test-wallet-funding] userId=${userId} paymentIntentId=${paymentIntent.id} amountCents=${amountInCents} status=${paymentIntent.status}`);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: `Stripe testno plačilo ni uspelo (stanje: ${paymentIntent.status})`,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status
      });
    }

    // 2. Credit the wallet idempotently with real Stripe test deposit
    const result = await creditWalletDepositFromStripe(userId, amountInCents, paymentIntent.id, {
      description: "Platform test balance funding",
      environment: "test",
      idempotencyKey: `wallet_dep_${paymentIntent.id}`
    });

    res.json({
      success: true,
      stripe_payment_intent_id: paymentIntent.id,
      transaction_id: result.transaction_id,
      amount: amountInCents / 100,
      amount_cents: amountInCents,
      newBalance: result.wallet_balance,
      available_cents: result.available_cents,
      wallet_balance: result.wallet_balance,
      already_processed: result.already_processed
    });
  } catch (err: any) {
    console.error("Add test funds error:", err);
    const formatted = formatStripeError(err);
    res.status(500).json({ error: formatted.userMessage || "Napaka pri izvedbi Stripe testnega plačila" });
  }
});

app.post("/api/analyze-receipt", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "No imageUrl provided" });

    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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

    const resultText = geminiResponse.text || '{}';
    res.json(JSON.parse(resultText));
  } catch (e: any) {
    console.error("Gemini Vision error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ESCROW, DISPUTES & STRIKES
async function checkAndApplySellerPenalties(seller_id: string) {
  try {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const snapshot = await safeGetDocs(
      adminDb.collection('seller_strikes').where('user_id', '==', seller_id)
    );
    const recentStrikes = snapshot.docs.filter((d: any) => {
      const data = d.data();
      return data.created_at >= sixMonthsAgo;
    });

    if (recentStrikes.length >= 3) {
      const blockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await adminDb.collection('users').doc(seller_id).update({
        auction_blocked_until: blockedUntil
      });
      console.log(`Seller ${seller_id} penalized: auctions blocked until ${blockedUntil} due to 3+ strikes.`);
    }
  } catch (e) {
    console.error("Error applying seller penalties:", e);
  }
}

app.post("/api/auctions/create", async (req, res) => {
  try {
    const { itemData, user_id } = req.body;

    const userDoc = await safeGetDoc(adminDb.collection('users').doc(user_id));
    if (!userDoc.exists()) return res.status(404).json({ error: "Uporabnik ne obstaja" });

    const userData = userDoc.data();
    if (userData.auction_blocked_until) {
      const blockedUntil = new Date(userData.auction_blocked_until);
      if (blockedUntil > new Date()) {
        return res.status(403).json({ error: `Objavljanje novih dražb vam je onemogočeno do ${blockedUntil.toLocaleDateString()} zaradi večkratnih kršitev roka za odpošiljanje predmeta.` });
      }
    }

    const newDocRef = itemData.id ? adminDb.collection('auctions').doc(itemData.id) : adminDb.collection('auctions').doc();

    await newDocRef.set({
      ...itemData,
      id: newDocRef.id,
      seller_id: user_id,
      status: "active"
    }, { merge: true });

    res.json({ success: true, id: newDocRef.id });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/cron/process-shipping-deadlines", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const snapshot = await safeGetDocs(
      adminDb.collection('transactions').where('status', '==', 'HELD_IN_ESCROW')
    );
    let processed = 0;

    for (const docSnap of snapshot.docs) {
      const tx = docSnap.data();
      if (tx.delivery_method !== 'POSTAL_DELIVERY') continue;

      let deadline = tx.shipping_deadline;
      if (!deadline && tx.paid_at) {
        deadline = new Date(new Date(tx.paid_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      if (deadline && now >= deadline) {
        // Cancel order
        await docSnap.ref.update({
          status: 'CANCELLED',
          cancelled_reason: 'SELLER_NO_SHIPMENT',
          updated_at: now
        });

        // Refund buyer from held funds
        const refundAmount = Number(tx.amount_total || tx.amount);
        const refundCents = Math.round(refundAmount * 100);
        await adminDb.runTransaction(async (t) => {
          const sellerRef = adminDb.collection('users').doc(tx.seller_id);
          const buyerRef = adminDb.collection('users').doc(tx.buyer_id);
          
          t.update(sellerRef, { held_cents: FieldValue.increment(-refundCents) });
          t.update(buyerRef, { available_cents: FieldValue.increment(refundCents) });
          
          const txRef = adminDb.collection('wallet_transactions').doc();
          t.set(txRef, {
             transaction_id: txRef.id,
             user_id: tx.buyer_id,
             type: 'refund',
             amount_cents: refundCents,
             status: 'completed',
             idempotency_key: 'refund_' + docSnap.id,
             created_at: FieldValue.serverTimestamp()
          });
        });

        // Add seller strike
        await adminDb.collection('seller_strikes').add({
          user_id: tx.seller_id,
          order_id: docSnap.id,
          reason: 'NO_SHIPMENT_IN_7_DAYS',
          created_at: now
        });

        const sellerDocInfo = await safeGetDoc(adminDb.collection('users').doc(tx.seller_id));
        if (sellerDocInfo.exists()) {
          const existingNotes = sellerDocInfo.data().system_notes || [];
          await adminDb.collection('users').doc(tx.seller_id).update({
            system_notes: [...existingNotes, `Naročilo preklicano – predmet ni bil poslan v 7 dneh (Naročilo: ${docSnap.id})`]
          });
        }

        await checkAndApplySellerPenalties(tx.seller_id);
        processed++;
      }
    }

    res.json({ success: true, processed });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders/:id/verify-pickup-pin", async (req, res) => {
  try {
    const { id } = req.params;
    const { pin, seller_id } = req.body;
    if (!pin || !seller_id) return res.status(400).json({ error: "Manjka PIN ali seller_id." });

    const txRef = adminDb.collection('transactions').doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naročilo ne obstaja." });

    const tx = txDoc.data();
    if (tx.seller_id !== seller_id) return res.status(403).json({ error: "Nimate pravic za to naročilo." });
    if (tx.status !== 'HELD_IN_ESCROW') return res.status(400).json({ error: "Naročilo ni v stanju HELD_IN_ESCROW." });
    if (tx.pickup_pin !== pin) return res.status(400).json({ error: "Napačen PIN." });

    await txRef.update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString()
    });

    const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);
    const releaseCents = Math.round(releaseAmount * 100);
    const tx_id = id;
    const auction_id = tx.auction_id || '';
    await releaseHeldFunds(seller_id, releaseCents, 'release_' + tx_id, { auction_id, related_tx: tx_id });

    res.json({ success: true, message: "Prevzem potrjen, sredstva so bila sproščena." });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders/:id/mark-as-shipped", async (req, res) => {
  try {
    const { id } = req.params;
    const { carrier_name, tracking_number, seller_id } = req.body;

    const txRef = adminDb.collection('transactions').doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naročilo ne obstaja." });

    const tx = txDoc.data();
    if (tx.seller_id !== seller_id) return res.status(403).json({ error: "Nimate pravic." });
    if (tx.status !== 'HELD_IN_ESCROW') return res.status(400).json({ error: "Napačno stanje naročila." });

    const amount = Number(tx.amount_total || tx.amount);
    if (amount > 15 && !tracking_number) {
      return res.status(400).json({ error: "Za zneske nad 15 € je obvezen vnos sledilne številke." });
    }

    await txRef.update({
      status: 'SHIPPED',
      carrier_name: carrier_name || 'Neznano',
      tracking_number: tracking_number || null,
      shipped_at: new Date().toISOString()
    });

    res.json({ success: true, message: "Označeno kot poslano." });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders/:id/mark-as-delivered", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    const txRef = adminDb.collection('transactions').doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naročilo ne obstaja." });

    const tx = txDoc.data();
    if (tx.buyer_id !== user_id && tx.seller_id !== user_id) return res.status(403).json({ error: "Nimate pravic." });
    if (tx.status !== 'SHIPPED') return res.status(400).json({ error: "Naročilo mora biti poslano." });

    const now = new Date();
    const autoCompleteDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    await txRef.update({
      status: 'DELIVERED',
      delivered_at: now.toISOString(),
      auto_complete_at: autoCompleteDate.toISOString()
    });

    res.json({ success: true, message: "Označeno kot dostavljeno. Samodejna potrditev nastavljena na " + autoCompleteDate.toLocaleString() });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/cron/process-escrow-completions", async (_req, res) => {
  try {
    const now = new Date().toISOString();
    const snapshot = await safeGetDocs(
      adminDb.collection('transactions')
        .where('status', '==', 'DELIVERED')
        .where('auto_complete_at', '<=', now)
    );
    let processed = 0;

    for (const docSnap of snapshot.docs) {
      const tx = docSnap.data();
      if (tx.status === 'DISPUTED') continue;

      await docSnap.ref.update({
        status: 'COMPLETED',
        completed_at: now
      });

      const releaseAmount = Number(tx.amount_total || tx.amount) - Number(tx.platform_fee || 0) - Number(tx.vat_amount || 0);
      const releaseCents = Math.round(releaseAmount * 100);
      await releaseHeldFunds(tx.seller_id, releaseCents, 'cron_release_' + tx.id, { auction_id: tx.auction_id, related_tx: tx.id });
      processed++;
    }

    res.json({ success: true, processed });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/orders/:id/open-dispute", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, reason } = req.body;

    const txRef = adminDb.collection('transactions').doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naročilo ne obstaja." });

    const tx = txDoc.data();
    if (tx.buyer_id !== user_id && tx.seller_id !== user_id) return res.status(403).json({ error: "Nimate pravic." });
    if (tx.status !== 'SHIPPED' && tx.status !== 'DELIVERED') {
      return res.status(400).json({ error: "Spor lahko odprete samo po tem, ko je izdelek poslan ali dostavljen." });
    }

    if (tx.status === 'DELIVERED' && tx.auto_complete_at && new Date(tx.auto_complete_at) < new Date()) {
      return res.status(400).json({ error: "Rok za odprtje spora je potekel (3 dni po dostavi)." });
    }

    await txRef.update({
      status: 'DISPUTED'
    });

    await adminDb.collection('disputes').add({
      order_id: id,
      opened_by_user_id: user_id,
      reason: reason || 'Neznan razlog',
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    res.json({ success: true, message: "Spor uspešno odprt." });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// RECAPTCHA V3 VERIFICATION
app.post("/api/auth/verify-captcha", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Manjka reCAPTCHA žeton." });

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.warn("RECAPTCHA_SECRET_KEY ni nastavljen na strežniku.");
      return res.status(500).json({ error: "Sistemska napaka: reCAPTCHA ni pravilno konfigurirana na strežniku." });
    }

    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token
      }).toString()
    });

    const data = await verifyRes.json();
    console.log("reCAPTCHA Google API Response:", data);

    if (!data.success || data.score < 0.5) {
      console.warn("reCAPTCHA failed or low score:", data);
      return res.status(400).json({ 
        success: false, 
        score: data.score, 
        error: "Zaznana je bila neobičajna dejavnost. Prijava ni mogoča." 
      });
    }

    return res.json({ success: true, score: data.score });
  } catch (err: any) {
    console.error("verify-captcha error:", err);
    res.status(500).json({ error: err.message });
  }
});

// AUTH EMAILS
app.post("/api/auth/send-verification", async (req, res) => {
  try {
    const { email, displayName } = req.body;
    if (!email) return res.status(400).json({ error: "Manjka e-poštni naslov" });

    const actionUrl = await adminAuth.generateEmailVerificationLink(email, {
      url: `${process.env.APP_URL || 'https://drazba.si'}/?tab=settings`
    });

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const htmlContent = await render(React.createElement(AuthEmailTemplate, {
        type: 'verify_email',
        actionUrl,
        recipientName: displayName || email.split('@')[0],
      }));

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Drazba.si <obvestila@drazba.si>',
        to: email,
        subject: 'Potrdite svoj e-poštni naslov - dražbe.si',
        html: htmlContent,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("send-verification error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/send-password-reset", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Manjka e-poštni naslov" });

    const actionUrl = await adminAuth.generatePasswordResetLink(email, {
      url: `${process.env.APP_URL || 'https://drazba.si'}/`
    });

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const htmlContent = await render(React.createElement(AuthEmailTemplate, {
        type: 'reset_password',
        actionUrl,
        recipientName: email.split('@')[0],
      }));

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Drazba.si <obvestila@drazba.si>',
        to: email,
        subject: 'Ponastavitev gesla - dražbe.si',
        html: htmlContent,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("send-password-reset error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/send-email-changed", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Manjka e-poštni naslov" });

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const htmlContent = await render(React.createElement(AuthEmailTemplate, {
        type: 'email_changed',
        actionUrl: `${process.env.APP_URL || 'https://drazba.si'}/?tab=settings`,
        recipientName: email.split('@')[0],
      }));

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Drazba.si <obvestila@drazba.si>',
        to: email,
        subject: 'Sprememba e-poštnega naslova - dražbe.si',
        html: htmlContent,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("send-email-changed error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/send-mfa-enrollment", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Manjka e-poštni naslov" });

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const htmlContent = await render(React.createElement(AuthEmailTemplate, {
        type: 'mfa_enrollment',
        actionUrl: `${process.env.APP_URL || 'https://drazba.si'}/?tab=settings`,
        recipientName: email.split('@')[0],
      }));

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Drazba.si <obvestila@drazba.si>',
        to: email,
        subject: 'Varnostno obvestilo (MFA) - dražbe.si',
        html: htmlContent,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("send-mfa-enrollment error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for unhandled API routes to prevent HTML 404s
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found on Vercel backend', url: req.url, originalUrl: req.originalUrl });
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message, stack: err.stack });
});

export { app };
export default app;


app.post("/api/cron/process-subscription-renewals", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const secretHeader = req.headers['x-cron-secret'];
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}` && secretHeader !== cronSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Process subscriptions that are active and need renewal.
    // E.g., paid_at is older than 30 days.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const usersSnapshot = await adminDb.collection('users')
      .where('subscription_active', '==', true)
      .where('subscription_paid_at', '<=', thirtyDaysAgo.toISOString())
      .get();
      
    let processed = 0;
    const stripe = getStripe();
    
    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      const packageId = (user.subscription_tier || '').toLowerCase();
      
      let amountCents = 0;
      if (packageId.includes('pro')) amountCents = 5000;
      else if (packageId.includes('basic')) amountCents = 2000;
      else continue; // Skip unknown tiers
      
      const idempotencyKey = `renew_${doc.id}_${new Date().getFullYear()}_${new Date().getMonth()}`;
      
      try {
        // 1. Try wallet debit first
        const txId = await reserveWalletFunds(doc.id, amountCents, 'wallet_payment', idempotencyKey, { type: 'subscription_renewal' });
        
        // Success: commit the wallet funds
        await commitReservedFunds(txId);
        
        await doc.ref.update({
           subscription_paid_at: new Date().toISOString()
        });
        processed++;
        continue;
      } catch (walletError: any) {
        // Insufficient funds or already processed (idempotency key exists).
        // Check if already processed
        if (walletError.message.includes('Idempotency key already exists')) {
          continue;
        }
        
        // 2. Fallback to saved card
        if (user.stripe_customer_id && user.stripe_default_payment_method) {
          try {
            const pi = await stripe.paymentIntents.create({
              amount: amountCents,
              currency: 'eur',
              customer: user.stripe_customer_id,
              payment_method: user.stripe_default_payment_method,
              off_session: true,
              confirm: true,
              metadata: {
                type: 'subscription',
                user_id: doc.id,
                package_id: user.subscription_tier,
                renewal: 'true'
              }
            }, { idempotencyKey: `card_${idempotencyKey}` });
            
            // Webhook will handle updating the user's subscription_paid_at date on success.
            processed++;
          } catch (stripeError: any) {
            console.error(`Failed to renew subscription via card for user ${doc.id}: `, stripeError);
            await doc.ref.update({
               subscription_active: false // Mark unpaid / past due
            });
            // We should notify the user.
          }
        } else {
          // No saved card
          await doc.ref.update({
             subscription_active: false // Mark unpaid / past due
          });
        }
      }
    }

    res.json({ success: true, processed });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
