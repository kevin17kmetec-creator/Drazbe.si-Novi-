import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateInvoicePDF(transaction: any, buyer: any, seller: any, auction?: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    const todayStr = new Date().toLocaleDateString('sl-SI');
    const transactionIdShort = transaction.id.substring(0, 8).toUpperCase();

    // ==========================================
    // PAGE 1: INVOICE FOR THE ITEM (Seller -> Buyer)
    // ==========================================
    
    // Determine Document Title based on seller type
    const isSellerBusiness = seller.company_status === 'company';
    const documentTitle = isSellerBusiness ? 'RAČUN / INVOICE' : 'KUPOPRODAJNA POGODBA / PURCHASE AGREEMENT';

    doc.fontSize(20).text(documentTitle, { align: 'center' });
    doc.moveDown();

    // IZDajatelj (Seller)
    doc.fontSize(12).text('Izdajatelj (Prodajalec) / Issuer (Seller):', { underline: true });
    doc.fontSize(10);
    if (isSellerBusiness) {
      doc.text(`${seller.company_name || 'N/A'}`);
      doc.text(`${seller.address || 'Naslov ni na voljo'}`);
      doc.text(`Davčna številka / VAT ID: ${seller.tax_id || 'N/A'}`);
      if (seller.registration_number) doc.text(`Matična številka / Reg No: ${seller.registration_number}`);
    } else {
      doc.text(`${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.name || 'Neznan');
      if (seller.address) doc.text(seller.address);
    }
    doc.moveDown();

    // Prejemnik (Buyer)
    doc.fontSize(12).text('Prejemnik (Kupec) / Recipient (Buyer):', { underline: true });
    doc.fontSize(10);
    if (buyer.company_status === 'company') {
      doc.text(`${buyer.company_name || 'N/A'}`);
      doc.text(`${buyer.first_name || ''} ${buyer.last_name || ''}`.trim());
      doc.text(`${buyer.address || 'Naslov ni na voljo'}`);
      doc.text(`Davčna številka / VAT ID: ${buyer.tax_id || 'N/A'}`);
    } else {
      doc.text(`${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || buyer.name || 'Neznan');
      if (buyer.address) doc.text(buyer.address);
    }
    doc.moveDown();

    // Invoice Meta
    doc.text(`Številka dokumenta / Document No: ITEM-${transactionIdShort}`);
    doc.text(`Datum izdaje in opravljene storitve / Date of issue & service: ${todayStr}`);
    doc.moveDown();

    // Items
    doc.fontSize(12).text('Postavke / Items:', { underline: true });
    doc.fontSize(10);
    doc.text(`Predmet / Item: ${auction?.title?.SLO || auction?.title?.EN || 'Dražbeni predmet'}`);
    doc.text(`Količina / Quantity: 1`);
    doc.text(`Znesek / Amount: €${Number(transaction.amount_total - (transaction.platform_fee || 0) - (transaction.vat_amount || 0)).toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(14).text(`SKUPAJ ZA PLAČILO / TOTAL: €${Number(transaction.amount_total - (transaction.platform_fee || 0) - (transaction.vat_amount || 0)).toFixed(2)}`, { align: 'right' });

    if (!isSellerBusiness) {
      doc.moveDown();
      doc.fontSize(9).text('Prodajalec je fizična oseba. Dokument služi kot kupoprodajna pogodba med fizično osebo in kupcem po uspešno zaključeni dražbi.', { italic: true });
    }

    // ==========================================
    // PAGE 2: INVOICE FOR PLATFORM FEE (Platform -> Buyer)
    // ==========================================
    doc.addPage();

    doc.fontSize(20).text('RAČUN ZA STORITEV / SERVICE INVOICE', { align: 'center' });
    doc.moveDown();

    // IZDajatelj (Platform)
    doc.fontSize(12).text('Izdajatelj (Platforma) / Issuer (Platform):', { underline: true });
    doc.fontSize(10);
    doc.text('Dizain d.o.o.');
    doc.text('Karantanska ulica 28, 2000 Maribor, Slovenija');
    doc.text('ID za DDV / VAT ID: SI57008060');
    doc.text('Matična številka / Reg. No.: 9093494000');
    doc.text('Datum vpisa / Registration Date: 25. 3. 2022');
    doc.moveDown();

    // Prejemnik (Buyer)
    doc.fontSize(12).text('Prejemnik storitve (Kupec) / Service Recipient (Buyer):', { underline: true });
    doc.fontSize(10);
    if (buyer.company_status === 'company') {
      doc.text(`${buyer.company_name || 'N/A'}`);
      doc.text(`${buyer.first_name || ''} ${buyer.last_name || ''}`.trim());
      doc.text(`${buyer.address || 'Naslov ni na voljo'}`);
      doc.text(`Davčna številka / VAT ID: ${buyer.tax_id || 'N/A'}`);
    } else {
      doc.text(`${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || buyer.name || 'Neznan');
      if (buyer.address) doc.text(buyer.address);
    }
    doc.moveDown();

    // Invoice Meta
    doc.text(`Številka računa / Invoice No: FEE-${transactionIdShort}`);
    doc.text(`Datum izdaje in opravljene storitve / Date of issue & service: ${todayStr}`);
    doc.moveDown();

    // Items
    doc.fontSize(12).text('Postavke / Items:', { underline: true });
    doc.fontSize(10);
    
    const feeAmount = transaction.platform_fee || 0;
    const vatAmount = transaction.vat_amount || 0;
    const totalAmount = feeAmount + vatAmount;

    doc.text(`Provizija platforme za uporabo sistema (Dražba: ${auction?.title?.SLO || 'Neznano'})`);
    doc.text(`Osnova / Base: €${feeAmount.toFixed(2)}`);
    
    if (transaction.is_reverse_charge) {
      doc.text(`DDV / VAT (0% - Reverse Charge): €0.00`);
      doc.moveDown();
      doc.fontSize(9).text('Obrnjena davčna obveznost v skladu z 1. točko 25. člena ZDDV-1 (Reverse charge mechanism).', { italic: true });
      doc.fontSize(10);
    } else {
      doc.text(`DDV / VAT (${transaction.vat_rate || 22}%): €${vatAmount.toFixed(2)}`);
    }
    
    doc.moveDown();
    doc.fontSize(14).text(`SKUPAJ PROVIZIJA / TOTAL FEE: €${totalAmount.toFixed(2)}`, { align: 'right' });

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
