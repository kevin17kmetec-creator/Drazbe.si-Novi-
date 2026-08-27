import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateInvoicePDF, generateCertificatePDF } from '../../src/server/pdfGenerator.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, mockData } = req.body;
    
    const tx = mockData?.transaction || {
      id: `TX-${Date.now().toString().substring(6)}`,
      amount_total: 1250.00,
      platform_fee: 62.50,
      vat_amount: 13.75,
      vat_rate: 22,
      is_reverse_charge: false,
      status: 'completed'
    };

    const buyer = mockData?.buyer || {
      first_name: 'Janez',
      last_name: 'Novak',
      email: 'janez.novak@example.com',
      address: 'Dunajska cesta 156, 1000 Ljubljana',
      user_type: 'individual'
    };

    const seller = mockData?.seller || {
      company_name: 'Dizain d.o.o.',
      address: 'Karantanska ulica 28, 2000 Maribor',
      tax_id: 'SI57008060',
      company_status: 'company'
    };

    const auction = mockData?.auction || {
      id: 'test-auction-123',
      title: { SLO: 'Industrijski CNC obdelovalni center Haas VF-2', EN: 'Industrijski CNC obdelovalni center Haas VF-2' },
      currentBid: 1250.00
    };

    let pdfBuffer: Buffer;
    
    if (type === 'invoice') {
      pdfBuffer = await generateInvoicePDF(tx, buyer, seller, auction, 'RAC-TEST-000001', 'PROV-TEST-000001');
    } else {
      pdfBuffer = await generateCertificatePDF(tx, buyer, seller);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_test.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (err: any) {
    console.error("Test generate-pdf error:", err);
    return res.status(500).json({ error: err.message || "Napaka pri generiranju PDF-ja" });
  }
}
