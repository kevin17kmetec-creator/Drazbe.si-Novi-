import { Buffer } from 'buffer';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { generateInvoicePDF, generateCertificatePDF } from '../src/lib/pdfGenerator';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Stripe needs the raw body to verify the signature
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
const resend = new Resend(process.env.RESEND_API_KEY);

async function buffer(readable: any) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!endpointSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    event = stripe.webhooks.constructEvent(buf, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    console.log('PaymentIntent was successful!', paymentIntent.id);
    
    try {
      const { auction_id, buyer_id, seller_id, fee_percentage } = paymentIntent.metadata;
      
      if (!auction_id || !buyer_id || !seller_id) {
          console.warn('Missing metadata for payment intent:', paymentIntent.id);
          return res.status(200).json({received: true});
      }

      const { data: buyer } = await supabase.from('users').select('*').eq('id', buyer_id).single();
      const { data: seller } = await supabase.from('users').select('*').eq('id', seller_id).single();

      if (!buyer || !seller) throw new Error('Buyer or seller not found');

      const amountTotal = paymentIntent.amount / 100;
      
      let platformFee = 0;
      let currentPrice = amountTotal / 1.122; // Quick fallback
      const { data: auction } = await supabase.from('auctions').select('current_price').eq('id', auction_id).single();
      if (auction?.current_price) {
          currentPrice = auction.current_price;
          const feePercentage = Number(fee_percentage) || 10;
          platformFee = currentPrice * (feePercentage / 100);
      } else {
          const feePercentage = Number(fee_percentage) || 10;
          platformFee = amountTotal * (feePercentage / 100);
      }
      
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

      const documentsToInsert = [];
      const attachments = [];

      try {
          const invoicePdfBuffer = await generateInvoicePDF(transaction, buyer, seller);
          const invoiceFileName = \`racun_\${transaction.id.substring(0,8)}.pdf\`;
          
          await supabase.storage
              .from('documents')
              .upload(\`\${buyer_id}/\${invoiceFileName}\`, invoicePdfBuffer, {
                  contentType: 'application/pdf',
                  upsert: true
              });

          const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(\`\${buyer_id}/\${invoiceFileName}\`);
          
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

      if (buyer.user_type !== 'business') {
          try {
              const certPdfBuffer = await generateCertificatePDF(transaction, buyer, seller);
              const certFileName = \`potrdilo_\${transaction.id.substring(0,8)}.pdf\`;
              
              await supabase.storage
                  .from('documents')
                  .upload(\`\${buyer_id}/\${certFileName}\`, certPdfBuffer, {
                      contentType: 'application/pdf',
                      upsert: true
                  });

              const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(\`\${buyer_id}/\${certFileName}\`);
              
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

      if (documentsToInsert.length > 0) {
          await supabase.from('documents').insert(documentsToInsert);
      }

      const buyerEmail = buyer.email;
      if (buyerEmail && process.env.RESEND_API_KEY) {
          try {
              await resend.emails.send({
                  from: 'Drazba.si <obvestila@drazba.si>',
                  to: buyerEmail,
                  subject: 'Potrdilo o plačilu in dokumenti - Drazba.si',
                  html: \`
                      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                          <h2 style="color: #0A1128;">Pozdravljeni, \${buyer.first_name || 'uporabnik'}!</h2>
                          <p>Vaše plačilo za dražbo je bilo uspešno obdelano.</p>
                          <p>V priponki vam pošiljamo <strong>račun</strong> za opravljeno storitev ter <strong>potrdilo o nakupu</strong>.</p>
                          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                          <p style="font-size: 12px; color: #666;">Ekipa Drazba.si</p>
                      </div>
                  \`,
                  attachments: attachments
              });
              console.log(\`Email sent successfully to \${buyerEmail}\`);
          } catch (emailErr) {
              console.error('Error sending success email:', emailErr);
          }
      }

    } catch (err: any) {
        console.error("Error processing successful payment:", err);
        return res.status(500).json({ error: err.message });
    }
  }

  return res.status(200).json({received: true});
}
