import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  sendOutbidNotification, 
  sendEndingSoonNotification, 
  sendAuctionWonNotification, 
  sendPaymentReminderNotification 
} from '../../src/server/emailService.js';
import { generateInvoicePDF, generateCertificatePDF } from '../../src/lib/pdfGenerator.js';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

      const invoiceBuffer = await generateInvoicePDF(mockTransaction, mockBuyer, mockSeller, mockAuction, 'RAC-TEST-000001', 'PROV-TEST-000001');
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

    return res.status(200).json({
      success: sendResult?.success ?? true,
      type,
      toEmail,
      timestamp: new Date().toISOString(),
      details: sendResult,
      resendConfigured: !!resendApiKey
    });
  } catch (err: any) {
    console.error("Test send-email error:", err);
    return res.status(500).json({ error: err.message || "Napaka pri pošiljanju testnega e-maila" });
  }
}
