import express from "express";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from '@supabase/supabase-js';
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
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

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
                await supabase.from('users').update({ 
                    subscription_tier: package_id, 
                    subscription_active: true,
                    subscription_paid_at: new Date().toISOString()
                }).eq('id', user_id);
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
        const { data: buyer } = await supabase.from('users').select('*').eq('id', buyer_id).single();
        const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();

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
        const { data: rpcData, error: rpcError } = await supabase.rpc('credit_user_balance', {
            p_user_id: seller_id,
            p_amount: sellerCreditInCents,
            p_type: 'auction_sale',
            p_reference_id: paymentIntent.id
        });
        if (rpcError) throw rpcError;

        // 4. Create Transaction Record
        const { data: transaction, error: txError } = await supabase.from('transactions').insert({
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
        }).select().single();

        if (txError) throw txError;

        // 5. Update Auction Status to mark as paid
        const { error: auctionUpdateError } = await supabase
            .from('auctions')
            .update({ 
                status: 'completed', 
                payment_status: 'paid',
                paid_at: new Date().toISOString()
            })
            .eq('id', auction_id);
            
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
            await supabase.storage
                .from('documents')
                .upload(`${buyer_id}/${invoiceFileName}`, invoicePdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`${buyer_id}/${invoiceFileName}`);
            
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
                
                await supabase.storage
                    .from('documents')
                    .upload(`${buyer_id}/${certFileName}`, certPdfBuffer, {
                        contentType: 'application/pdf',
                        upsert: true
                    });

                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`${buyer_id}/${certFileName}`);
                
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
            await supabase.from('documents').insert(documentsToInsert);
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
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage, return_url } = req.body;
      const stripe = getStripe();
      
      // Fetch the actual auction
      const { data: auction } = await supabase.from('auctions').select('current_price, title').eq('id', auction_id).single();
      const currentPrice = auction?.current_price || (amount / 1.122);

      const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();
      const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
      
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
      const { data: auction } = await supabase.from('auctions').select('current_price').eq('id', auction_id).single();
      const currentPrice = auction?.current_price || (amount / 1.122); // Fallback estimate if not found

      const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();
      const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
      
      // Calculate VAT for the platform fee
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

      // Ensure platform fee does not exceed total amount (failsafe)
      const applicationFeeAmount = Math.min(Math.round(totalPlatformFeeGross * 100), Math.round(amount * 100));

      // Fetch seller
      const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();

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
      const { user_id, return_url, refresh_url } = req.body;
      const stripe = getStripe();

      // Check if user already has an account
      const { data: user } = await supabase.from('users').select('stripe_account_id, stripe_onboarding_complete').eq('id', user_id).single();
      let accountId = user?.stripe_account_id;

      if (!accountId) {
        // Create an Express account
        const account = await stripe.accounts.create({
          type: 'express',
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true }
          }
        });
        accountId = account.id;

        // Save to DB
        await supabase.from('users').update({ stripe_account_id: accountId }).eq('id', user_id);
      }

      if (accountId && user?.stripe_onboarding_complete) {
          const loginLink = await stripe.accounts.createLoginLink(accountId);
          return res.json({ url: loginLink.url });
      }

      // Create an AccountLink
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refresh_url,
        return_url: return_url,
        type: 'account_onboarding',
      });

      res.json({ url: accountLink.url });
    } catch (error: any) {
      console.error("Stripe Account Link Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe-check-account-status", async (req, res) => {
    try {
      const { user_id } = req.body;
      const stripe = getStripe();
      
      const { data: user } = await supabase.from('users').select('stripe_account_id').eq('id', user_id).single();
      
      if (!user?.stripe_account_id) {
        return res.json({ complete: false });
      }

      const account = await stripe.accounts.retrieve(user.stripe_account_id);
      
      const isComplete = account.details_submitted && account.charges_enabled;

      // Sync status to DB
      await supabase.from('users').update({ stripe_onboarding_complete: isComplete }).eq('id', user_id);

      res.json({ complete: isComplete, account });
    } catch (error: any) {
      console.error("Stripe Check Account Status Error:", error);
      res.status(500).json({ error: error.message });
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
      const { data: auction } = await supabase.from('auctions').select('current_price').eq('id', auction_id).single();
      const currentPrice = auction?.current_price || (amount / 1.122);
      
      const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();
      const platformFee = calculateMarginalPlatformFee(currentPrice, seller?.subscription_tier);
      
      const amountTotalInCents = Math.round(amount * 100);
      const platformFeeInCents = Math.round(platformFee * 100);

      // Execute internal wallet payment
      const { data: rpcData, error: rpcError } = await supabase.rpc('execute_internal_wallet_payment', {
          p_buyer_id: buyer_id,
          p_seller_id: seller_id,
          p_total_amount: amountTotalInCents,
          p_commission_amount: platformFeeInCents,
          p_auction_id: auction_id
      });
      if (rpcError) throw rpcError;

      // Create Transaction Record
      const { data: transaction, error: txError } = await supabase.from('transactions').insert({
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
      }).select().single();

      if (txError) throw txError;

      // Update auction
      await supabase.from('auctions').update({ status: 'completed', payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', auction_id);

      // Generate Documents asynchronously to not block the request
      const { data: buyer } = await supabase.from('users').select('*').eq('id', buyer_id).single();
      const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();
      
      if (buyer && seller && transaction) {
          (async () => {
             const documentsToInsert = [];
             const attachments = [];
             
             try {
                 const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller);
                 const invoiceFileName = `racun_${transaction.id.substring(0,8)}.pdf`;
                 
                 await supabase.storage.from('documents').upload(`${buyer_id}/${invoiceFileName}`, invoicePdfBuffer, { contentType: 'application/pdf', upsert: true });
                 const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`${buyer_id}/${invoiceFileName}`);
                 
                 documentsToInsert.push({ transaction_id: transaction.id, user_id: buyer_id, type: 'invoice', file_url: publicUrl });
                 attachments.push({ filename: invoiceFileName, content: invoicePdfBuffer });
             } catch(e) { console.error('Invoice error:', e); }

             if (buyer.user_type !== 'business') {
                 try {
                     const certPdfBuffer = await generateCertificatePDF(transaction, buyer, seller);
                     const certFileName = `potrdilo_${transaction.id.substring(0,8)}.pdf`;
                     
                     await supabase.storage.from('documents').upload(`${buyer_id}/${certFileName}`, certPdfBuffer, { contentType: 'application/pdf', upsert: true });
                     const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`${buyer_id}/${certFileName}`);
                     
                     documentsToInsert.push({ transaction_id: transaction.id, user_id: buyer_id, type: 'certificate', file_url: publicUrl });
                     attachments.push({ filename: certFileName, content: certPdfBuffer });
                 } catch(e) { console.error('Cert error:', e); }
             }

             if (documentsToInsert.length > 0) {
                 await supabase.from('documents').insert(documentsToInsert);
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

      const { data: rpcData, error: rpcError } = await supabase.rpc('execute_internal_subscription_payment', {
          p_user_id: user_id,
          p_total_amount: amountTotalInCents,
          p_package_id: package_id
      });
      if (rpcError) throw rpcError;

      await supabase.from('users').update({ 
          subscription_tier: package_id, 
          subscription_active: true,
          subscription_paid_at: new Date().toISOString()
      }).eq('id', user_id);

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
      const { data: user } = await supabase.from('users').select('stripe_account_id, stripe_onboarding_complete').eq('id', user_id).single();
      const { data: balanceData } = await supabase.from('user_balances').select('available_balance').eq('user_id', user_id).single();

      if (!balanceData || balanceData.available_balance < amountInCents) {
          return res.status(400).json({ error: "Stanje na računu je prenizko." });
      }

      let accountId = user?.stripe_account_id;

      if (!accountId) {
          // IF NO: Create connected account
          const account = await stripe.accounts.create({
              type: 'custom',
              country: 'SI',
              capabilities: {
                  transfers: { requested: true },
              },
          });
          accountId = account.id;
          await supabase.from('users').update({ stripe_account_id: accountId }).eq('id', user_id);
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
      const { error: rpcError } = await supabase.rpc('debit_user_balance', {
          p_user_id: user_id,
          p_amount: amountInCents,
          p_type: 'payout_withdrawal',
          p_reference_id: `payout_${Date.now()}`
      });
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
