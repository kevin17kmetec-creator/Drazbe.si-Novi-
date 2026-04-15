import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateInvoicePDF(transaction: any, buyer: any, seller: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Header
    doc.fontSize(20).text('RAČUN / INVOICE', { align: 'center' });
    doc.moveDown();

    // Platform Details
    doc.fontSize(10).text('Drazba.si d.o.o.');
    doc.text('Slovenska cesta 1, 1000 Ljubljana, Slovenija');
    doc.text('Davčna številka / VAT ID: SI12345678');
    doc.moveDown();

    // Invoice Details
    doc.text(`Številka računa / Invoice No: INV-${transaction.id.substring(0, 8).toUpperCase()}`);
    doc.text(`Datum izdaje / Date: ${new Date().toLocaleDateString('sl-SI')}`);
    doc.moveDown();

    // Buyer Details
    doc.fontSize(12).text('Kupec / Buyer:', { underline: true });
    doc.fontSize(10).text(`${buyer.first_name} ${buyer.last_name}`);
    if (buyer.company_status === 'company') {
      doc.text(`Podjetje / Company: ${buyer.company_name || 'N/A'}`);
      doc.text(`Davčna številka / VAT ID: ${buyer.tax_id || 'N/A'}`);
    }
    doc.text(`Država / Country: ${buyer.country_code || 'SI'}`);
    doc.moveDown();

    // Transaction Details
    doc.fontSize(12).text('Postavke / Items:', { underline: true });
    doc.fontSize(10);
    
    const feeAmount = transaction.platform_fee;
    const vatAmount = transaction.vat_amount;
    const totalAmount = feeAmount + vatAmount;

    doc.text(`Provizija platforme za dražbo / Platform fee for auction: €${feeAmount.toFixed(2)}`);
    
    if (transaction.is_reverse_charge) {
      doc.text(`DDV / VAT (0% - Reverse Charge): €0.00`);
      doc.moveDown();
      doc.fontSize(9).text('Obrnjena davčna obveznost v skladu z 1. točko 25. člena ZDDV-1 (Reverse charge mechanism).', { italic: true });
    } else {
      doc.text(`DDV / VAT (${transaction.vat_rate}%): €${vatAmount.toFixed(2)}`);
    }
    
    doc.moveDown();
    doc.fontSize(14).text(`SKUPAJ ZA PLAČILO / TOTAL: €${totalAmount.toFixed(2)}`, { align: 'right' });

    doc.end();
  });
}

export async function generateCertificatePDF(transaction: any, buyer: any, seller: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Header
    doc.fontSize(20).text('POTRDILO O NAKUPU / PURCHASE CERTIFICATE', { align: 'center' });
    doc.moveDown();

    // Platform Details
    doc.fontSize(10).text('Drazba.si');
    doc.moveDown();

    // Certificate Details
    doc.text(`Številka potrdila / Certificate No: CERT-${transaction.id.substring(0, 8).toUpperCase()}`);
    doc.text(`Datum / Date: ${new Date().toLocaleDateString('sl-SI')}`);
    doc.moveDown();

    // Buyer Details
    doc.fontSize(12).text('Kupec / Buyer:', { underline: true });
    doc.fontSize(10).text(`${buyer.first_name} ${buyer.last_name}`);
    doc.moveDown();

    // Seller Details
    doc.fontSize(12).text('Prodajalec / Seller:', { underline: true });
    doc.fontSize(10).text(`${seller.first_name} ${seller.last_name}`);
    if (seller.company_status === 'company') {
      doc.text(`Podjetje / Company: ${seller.company_name || 'N/A'}`);
    }
    doc.moveDown();

    // Transaction Details
    doc.fontSize(12).text('Podrobnosti transakcije / Transaction Details:', { underline: true });
    doc.fontSize(10);
    doc.text(`Znesek nakupa / Purchase Amount: €${transaction.amount_total.toFixed(2)}`);
    
    doc.moveDown();
    doc.fontSize(9).text('To potrdilo služi kot informativni dokaz o uspešno zaključeni dražbi in plačilu.', { italic: true });

    doc.end();
  });
}
