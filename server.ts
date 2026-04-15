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

        // 5. Generate Documents
        const documentsToInsert = [];
        const attachments = [];

        // Generate Invoice for Platform Fee (if buyer wants auto-invoice or is individual)
        if (buyer.auto_invoice_generation !== false) {
            const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller);
            const invoiceFileName = `invoice_${transaction.id}.pdf`;
            
            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(`${buyer_id}/${invoiceFileName}`, invoicePdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (!uploadError) {
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
            }
        }

        // Generate Certificate for Individuals
        if (buyer.company_status !== 'company') {
            const certPdfBuffer = await generateCertificatePDF(transaction, buyer, seller);
            const certFileName = `certificate_${transaction.id}.pdf`;
            
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(`${buyer_id}/${certFileName}`, certPdfBuffer, {
                    contentType: 'application/pdf',
                    upsert: true
                });

            if (!uploadError) {
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
            }
        }

        // Save document records
        if (documentsToInsert.length > 0) {
            await supabase.from('documents').insert(documentsToInsert);
        }

        // 6. Send Email via Resend
        if (buyer.email && process.env.RESEND_API_KEY) {
            await resend.emails.send({
                from: 'Drazba.si <noreply@drazba.si>',
                to: buyer.email,
                subject: 'Potrditev plačila in dokumenti / Payment Confirmation',
                html: '<p>Spoštovani,</p><p>V priponki vam pošiljamo dokumente za vašo nedavno transakcijo na Drazba.si.</p><p>Hvala za zaupanje!</p>',
                attachments: attachments
            });
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
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amounts in cents
        currency,
        automatic_payment_methods: {
          enabled: true,
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
