import express from "express";
import Stripe from "stripe";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateInvoicePDF, generateCertificatePDF } from './src/lib/pdfGenerator';
import dotenv from 'dotenv';

dotenv.config();

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
        // 1. Fetch transaction details from metadata or database
        // Assuming metadata contains auction_id, buyer_id, seller_id
        const { auction_id, buyer_id, seller_id, fee_percentage } = paymentIntent.metadata;
        
        if (!auction_id || !buyer_id || !seller_id) {
            console.warn('Missing metadata for payment intent:', paymentIntent.id);
            res.json({received: true});
            return;
        }

        // 2. Fetch buyer and seller details
        const { data: buyer } = await supabase.from('users').select('*').eq('id', buyer_id).single();
        const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();

        if (!buyer || !seller) throw new Error('Buyer or seller not found');

        // 3. Calculate Fee and VAT
        const amountTotal = paymentIntent.amount / 100; // Convert from cents
        const feePercentage = Number(fee_percentage) || 10; // Default 10%
        const platformFee = amountTotal * (feePercentage / 100);
        
        let vatRate = 0;
        let isReverseCharge = false;

        // VAT Logic:
        // Platform is in Slovenia.
        // If buyer is in Slovenia -> 22% VAT
        // If buyer is in EU and is a company with VAT ID -> 0% (Reverse Charge)
        // If buyer is outside EU -> 0% (Export)
        // For simplicity, assuming EU countries list:
        const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
        
        const buyerCountry = buyer.country_code || 'SI';
        
        if (buyerCountry === 'SI') {
            vatRate = 22;
        } else if (euCountries.includes(buyerCountry)) {
            if (buyer.company_status === 'company' && buyer.tax_id) {
                isReverseCharge = true;
                vatRate = 0;
            } else {
                vatRate = 22; // B2C in EU
            }
        } else {
            vatRate = 0; // Outside EU
        }

        const vatAmount = platformFee * (vatRate / 100);

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

  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { amount, currency = "eur", auction_id, buyer_id, seller_id, fee_percentage } = req.body;
      const stripe = getStripe();
      
      // Fetch the actual auction to securely determine the final bid price
      const { data: auction } = await supabase.from('auctions').select('current_price').eq('id', auction_id).single();
      const currentPrice = auction?.current_price || (amount / 1.122); // Fallback estimate if not found

      // Calculate platform fee
      const feePercentage = Number(fee_percentage) || 10;
      const platformFee = currentPrice * (feePercentage / 100);
      
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

      // Fetch seller connected account
      const { data: seller } = await supabase.from('users').select('stripe_account_id, stripe_onboarding_complete').eq('id', seller_id).single();
      
      if (!seller?.stripe_account_id || !seller?.stripe_onboarding_complete) {
         return res.status(400).json({ error: "Prodajalec še nima nastavljenega računa za prejemanje plačil (Stripe Connect ni zaključen). Nakuplja na žalost ni mogoče izvesti trenutno." });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amounts in cents
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
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
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/account_session", async (req, res) => {
    try {
      const { user_id } = req.body;
      const stripe = getStripe();

      // Check if user already has an account
      const { data: user } = await supabase.from('users').select('stripe_account_id').eq('id', user_id).single();
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

      // Create an AccountSession
      const accountSession = await stripe.accountSessions.create({
        account: accountId,
        components: {
          account_onboarding: { enabled: true },
        },
      });

      res.json({ client_secret: accountSession.client_secret });
    } catch (error: any) {
      console.error("Stripe Account Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/check_account_status", async (req, res) => {
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
