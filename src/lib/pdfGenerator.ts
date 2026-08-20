import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateInvoicePDF(transaction: any, buyer: any, seller: any, auction?: any, salesInvoiceNo?: string, commissionInvoiceNo?: string): Promise<Buffer> {
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
    
    // Determine Document Title based on seller and buyer type
    const isSellerBusiness = seller.company_status === 'company' || seller.user_type === 'business' || seller.isCompany;
    const isBuyerBusiness = buyer.company_status === 'company' || buyer.user_type === 'business' || buyer.isCompany;
    const isB2C = isSellerBusiness && !isBuyerBusiness;
    const isB2B = isSellerBusiness && isBuyerBusiness;
    const isC2B = !isSellerBusiness && isBuyerBusiness;
    const isC2C = !isSellerBusiness && !isBuyerBusiness;

    const documentTitle = isSellerBusiness 
      ? 'RAČUN / INVOICE' 
      : 'KUPOPRODAJNA POGODBA';

    doc.fontSize(18).text(documentTitle, { align: 'center' });
    doc.moveDown(0.5);

    const sellerTaxId = seller.tax_id || seller.taxId || seller.vat_id || seller.vatId;
    const buyerTaxId = buyer.tax_id || buyer.taxId || buyer.vat_id || buyer.vatId;

    // IZDajatelj (Seller)
    doc.fontSize(11).text('Izdajatelj (Prodajalec) / Issuer (Seller):', { underline: true });
    doc.fontSize(9);
    if (isSellerBusiness) {
      doc.text(`${seller.company_name || 'N/A'}`);
      doc.text(`${seller.address || 'Naslov ni na voljo'}`);
      if (sellerTaxId) doc.text(`Davčna številka / VAT ID: ${sellerTaxId}`);
      if (seller.registration_number || seller.regNo) doc.text(`Matična številka / Reg No: ${seller.registration_number || seller.regNo}`);
    } else {
      const sellerName = `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.name || 'Prodajalec';
      doc.text(sellerName);
      if (seller.address) doc.text(seller.address);
      doc.text(`Davčna številka: ${sellerTaxId || 'Ni navedena'}`);
    }
    doc.moveDown(0.5);

    // Prejemnik (Buyer)
    doc.fontSize(11).text('Prejemnik (Kupec) / Recipient (Buyer):', { underline: true });
    doc.fontSize(9);
    if (isBuyerBusiness) {
      doc.text(`${buyer.company_name || 'N/A'}`);
      doc.text(`${buyer.first_name || ''} ${buyer.last_name || ''}`.trim());
      doc.text(`${buyer.address || 'Naslov ni na voljo'}`);
      if (buyerTaxId) doc.text(`Davčna številka / VAT ID: ${buyerTaxId}`);
      if (buyer.registration_number || buyer.regNo) doc.text(`Matična številka / Reg No: ${buyer.registration_number || buyer.regNo}`);
    } else {
      const buyerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || buyer.name || 'Kupec';
      doc.text(buyerName);
      if (buyer.address) doc.text(buyer.address);
      doc.text(`Davčna številka: ${buyerTaxId || 'Ni navedena'}`);
    }
    doc.moveDown(0.5);

    // Party Electronic Identification note if tax IDs are not present/public
    if (!sellerTaxId || !buyerTaxId) {
      doc.fontSize(8).text('Opomba o identifikaciji: Stranki sta elektronsko identificirani znotraj platforme dražbe.si.', { italic: true });
      doc.moveDown(0.5);
    }

    // Invoice Meta
    const getPlaceFromUser = (user: any): string => {
      if (!user) return 'Slovenija';
      let raw = user.city || user.place || user.location?.city || '';
      if (!raw && (user.address || user.street_address || user.location?.address)) {
        const addr = user.address || user.street_address || user.location?.address;
        const parts = addr.split(',');
        if (parts.length > 1) {
          raw = parts[parts.length - 1].trim();
          if (raw.toLowerCase() === 'slovenija' && parts.length > 2) {
            raw = parts[parts.length - 2].trim();
          }
        } else {
          raw = addr;
        }
      }
      let cleaned = (raw || 'Ljubljana')
        .replace(/SI-?\s*\d{4}/gi, '')
        .replace(/\b\d{4}\b/g, '')
        .trim()
        .replace(/^,\s*|,\s*$/g, '');

      if (!cleaned) cleaned = 'Ljubljana';
      if (!cleaned.toLowerCase().includes('slovenija')) {
        cleaned = `${cleaned}, Slovenija`;
      }
      return cleaned;
    };

    const sellerPlace = getPlaceFromUser(seller);

    doc.fontSize(9);
    const docNo = salesInvoiceNo || `ITEM-${transactionIdShort}`;
    doc.text(`Številka dokumenta / Document No: ${docNo}`);
    doc.text(`Kraj izdaje / Place of issue: ${sellerPlace}`);
    doc.text(`Datum izdaje in sklenitve / Date of agreement: ${todayStr}`);
    doc.moveDown(0.5);

    // Items
    doc.fontSize(11).text('Postavke / Items:', { underline: true });
    doc.fontSize(9);
    const itemAmount = Number(transaction.amount_total - (transaction.platform_fee || 0) - (transaction.vat_amount || 0));
    const isVatApplicable = isB2C || isB2B;
    const vatRate = 0.22;
    const vatBase = isVatApplicable ? itemAmount / (1 + vatRate) : itemAmount;
    const vatVal = isVatApplicable ? itemAmount - vatBase : 0;

    doc.text(`Predmet / Item: ${auction?.title?.SLO || auction?.title?.EN || 'Dražbeni predmet'}`);
    doc.text(`Količina / Quantity: 1`);

    if (isB2C || isB2B) {
      doc.text(`Cena z DDV / Price (incl. VAT): €${itemAmount.toFixed(2)}`);
      doc.text(`Osnova za DDV (22%) / Tax base (22%): €${vatBase.toFixed(2)}`);
      doc.text(`Znesek DDV (22%) / VAT (22%): €${vatVal.toFixed(2)}`);
    } else {
      doc.text(`Kupnina / Price: €${itemAmount.toFixed(2)}`);
      doc.text(`DDV: Ni obračunan (prodajalec je fizična oseba in ni davčni zavezanec po ZDDV-1)`);
    }
    doc.moveDown(0.5);

    doc.fontSize(12).text(`SKUPAJ ZA PLAČILO / TOTAL: €${itemAmount.toFixed(2)}`, { align: 'right' });
    doc.moveDown();

    // Clauses and Legal Notes
    doc.fontSize(8);
    doc.text('Kupoprodajne klavzule in pravne opombe:', { underline: true });
    doc.moveDown(0.3);

    if (isB2C) {
      doc.text('• Jamstvo za neskladnost blaga (ZVPot-1): Za blago veljajo zakonska jamstva za neskladnost blaga v skladu z ZVPot-1.');
      doc.text('• Prenos lastništva: Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.');
      doc.text('• DDV izjava: V ceno je vključen 22% DDV v skladu z Zakonom o davku na dodano vrednost (ZDDV-1).');
    } else if (isB2B) {
      doc.text('• Izjava o DDV in stanje opreme: V ceno je vključen 22% DDV v skladu z ZDDV-1. Za rabljeno opremo velja dogovorjeno stanje ob prevzemu (videno-kupljeno).');
      doc.text('• Prenos lastništva: Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.');
    } else if (isC2B) {
      doc.text('• Videno-kupljeno: Predmet se prodaja po načelu "videno-kupljeno". Prodajalec ne odgovarja za stvarne napake predmeta po njegovem prevzemu.');
      doc.text('• Prenos lastništva: Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.');
      doc.text('• Pravna opomba in DDV: Prodajalec je fizična oseba (C2B). DDV se v skladu z ZDDV-1 ne obračunava. Dokument služi kot kupoprodajna pogodba in dokazilo o plačilu.');
    } else {
      doc.text('• Videno-kupljeno: Predmet se prodaja po načelu "videno-kupljeno". Prodajalec ne odgovarja za stvarne napake predmeta po njegovem prevzemu.');
      doc.text('• Prenos lastništva: Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.');
      doc.text('• DDV izjava: Prodajalec je fizična oseba (C2C). DDV se v skladu z ZDDV-1 ne obračunava. Dokument služi kot dokazilo o sklenjeni pogodbi in plačilu.');
    }
    doc.text('• Posredovanje: Platforma dražbe.si nastopa izključno kot tehnološki posrednik in ni pogodbena stranka prodajne pogodbe.');

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
    const feeDocNo = commissionInvoiceNo || `FEE-${transactionIdShort}`;
    doc.text(`Številka računa / Invoice No: ${feeDocNo}`);
    doc.text(`Datum izdaje in opravljene storitve / Date of issue & service: ${todayStr}`);
    
    const paymentMethodText = transaction.payment_method === 'wallet' ? 'Sredstva na dražbe.si (Wallet)' : 'Spletno plačilo / Kartica';
    const paidAtDateStr = transaction.paid_at ? new Date(transaction.paid_at).toLocaleDateString('sl-SI') : todayStr;
    doc.text(`Način plačila / Payment Method: ${paymentMethodText}`);
    doc.text(`Status plačila / Payment Status: PLAČANO (${paidAtDateStr})`);
    
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
