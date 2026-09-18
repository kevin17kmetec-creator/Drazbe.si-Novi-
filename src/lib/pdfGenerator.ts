import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

function getFontPath(filename: string): string {
  const localPath = path.join(process.cwd(), 'public', 'fonts', filename);
  if (fs.existsSync(localPath)) return localPath;
  return '';
}

function formatEuro(amount: number): string {
  const num = isNaN(amount) ? 0 : amount;
  return num.toLocaleString('sl-SI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getSafeAddress(user: any): string {
  if (!user) return 'Naslov ni na voljo';
  if (typeof user === 'string') return user;

  const street = user.street_address || user.company_street || user.companyStreet || user.address || user.street || '';
  const postal = user.postal_code || user.company_postal_code || user.companyPostalCode || user.postalCode || user.zip || '';
  const city = user.city || user.company_city || user.companyCity || user.place || '';

  if (street && postal && city) {
    return `${street}, ${postal} ${city}`;
  } else if (street && city) {
    return `${street}, ${city}`;
  } else if (street) {
    return street;
  } else if (city) {
    return city;
  }
  return user.address || 'Naslov ni na voljo';
}

function getSafePlace(user: any): string {
  if (!user) return 'Maribor, Slovenija';
  let raw = user.company_city || user.companyCity || user.city || user.place || '';
  if (!raw && user.address) {
    const parts = user.address.split(',');
    if (parts.length > 1) {
      raw = parts[parts.length - 1].trim();
      if (raw.toLowerCase() === 'slovenija' && parts.length > 2) {
        raw = parts[parts.length - 2].trim();
      }
    } else {
      raw = user.address;
    }
  }
  let cleaned = (raw || 'Maribor')
    .replace(/SI-?\s*\d{4}/gi, '')
    .replace(/\b\d{4}\b/g, '')
    .trim()
    .replace(/^,\s*|,\s*$/g, '');

  if (!cleaned) cleaned = 'Maribor';
  if (!cleaned.toLowerCase().includes('slovenija')) {
    cleaned = `${cleaned}, Slovenija`;
  }
  return cleaned;
}

export async function generateInvoicePDF(
  transaction: any = {},
  buyer: any = {},
  seller: any = {},
  auction: any = {},
  salesInvoiceNo?: string,
  commissionInvoiceNo?: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const buffers: Buffer[] = [];

    const regularFont = getFontPath('Roboto-Regular.ttf');
    const boldFont = getFontPath('Roboto-Bold.ttf');

    if (regularFont && boldFont) {
      doc.registerFont('Roboto', regularFont);
      doc.registerFont('Roboto-Bold', boldFont);
      doc.font('Roboto');
    }

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on('error', (err) => reject(err));

    // Data normalizations
    const isSellerBusiness = seller.company_status === 'company' || seller.user_type === 'business' || seller.isCompany;
    const isBuyerBusiness = buyer.company_status === 'company' || buyer.user_type === 'business' || buyer.isCompany;
    const isB2C = isSellerBusiness && !isBuyerBusiness;
    const isB2B = isSellerBusiness && isBuyerBusiness;
    const isC2B = !isSellerBusiness && isBuyerBusiness;

    const docNo = salesInvoiceNo || `INV-${(transaction.id || auction.id || '000000').substring(0, 8).toUpperCase()}`;
    const todayStr = new Date().toLocaleDateString('sl-SI');
    const paymentDate = auction.paid_at ? new Date(auction.paid_at).toLocaleDateString('sl-SI') : todayStr;

    const sellerName = seller.company_name || seller.companyName || 
      `${seller.first_name || seller.firstName || ''} ${seller.last_name || seller.lastName || ''}`.trim() || 
      (typeof seller.name === 'object' ? seller.name?.SLO : seller.name) || 
      seller.sellerName || 
      'Prodajalec';

    const buyerName = buyer.company_name || buyer.companyName || 
      `${buyer.first_name || buyer.firstName || ''} ${buyer.last_name || buyer.lastName || ''}`.trim() || 
      (typeof buyer.name === 'object' ? buyer.name?.SLO : buyer.name) || 
      'Kupec';

    const sellerAddress = getSafeAddress(seller);
    const buyerAddress = getSafeAddress(buyer);
    const sellerPlace = getSafePlace(seller);

    const sellerTaxId = seller.tax_id || seller.taxId || seller.vat_id || seller.vatId || (isSellerBusiness ? 'SI 12345678' : '');
    const sellerRegNo = seller.registration_number || seller.regNumber || seller.registrationNumber || (isSellerBusiness ? '8876543000' : '');

    const buyerTaxId = buyer.tax_id || buyer.taxId || buyer.vat_id || buyer.vatId || '';
    const buyerRegNo = buyer.registration_number || buyer.regNumber || '';

    const itemPrice = Number(transaction.amount_total || auction.currentBid || auction.current_price || transaction.item_amount || 0);
    const vatRate = 0.22;
    const isVatApplicable = isSellerBusiness;
    const vatBase = isVatApplicable ? itemPrice / (1 + vatRate) : itemPrice;
    const vatAmount = isVatApplicable ? itemPrice - vatBase : 0;

    const itemTitle = (typeof auction.title === 'object' ? (auction.title?.SLO || auction.title?.EN) : auction.title) || 'Dražbeni predmet';
    const auctionId = auction.id || transaction.auction_id || 'AUCT-88319';
    const deliveryMethod = auction.delivery_method === 'post' ? 'Dostava po pošti' : auction.delivery_method === 'pickup' ? 'Osebni prevzem na lokaciji prodajalca' : 'Osebni prevzem ali po dogovoru';

    // Theme colors
    const colorDark = '#0A1128';
    const colorMuted = '#64748B';
    const colorLight = '#94A3B8';
    const colorBorder = '#E2E8F0';

    // ==========================================
    // PAGE 1: RAČUN / INVOICE (PRODAJALEC -> KUPEC)
    // ==========================================

    // Top Header: Title on Left, Logo on Right
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(22).fillColor(colorDark).text(isC2B ? 'KUPOPRODAJNA POGODBA' : !isSellerBusiness ? 'KUPOPRODAJNA POGODBA / RAČUN' : 'RAČUN / INVOICE', 45, 45);

    // Right logo
    doc.fontSize(18).fillColor(colorLight).text('dražbenik.si', 360, 45, { width: 190, align: 'right' });
    if (regularFont) doc.font('Roboto');
    doc.fontSize(8.5).fillColor(colorLight).text('Platforma za posredovanje', 360, 68, { width: 190, align: 'right' });

    // Meta below title
    let yPos = 75;
    doc.fontSize(9).fillColor(colorMuted);
    doc.text(`Številka dokumenta: ${docNo}`, 45, yPos);
    yPos += 14;
    doc.text(`Kraj izdaje: ${sellerPlace}`, 45, yPos);
    yPos += 14;
    doc.text(`Datum izdaje / sklenitve: ${paymentDate}`, 45, yPos);
    yPos += 14;
    doc.text(`Datum opravljene storitve/dobave: ${paymentDate}`, 45, yPos);

    // Horizontal Divider Line
    yPos += 22;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, yPos).lineTo(550, yPos).stroke();

    // Two Columns: IZDAJATELJ and PREJEMNIK
    yPos += 15;
    const colLeft = 45;
    const colRight = 310;

    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(8).fillColor(colorLight).text('IZDAJATELJ (PRODAJALEC)', colLeft, yPos);
    doc.text('PREJEMNIK (KUPEC)', colRight, yPos);

    yPos += 14;
    // Seller Info
    doc.fontSize(11).fillColor(colorDark).text(sellerName, colLeft, yPos, { width: 240 });
    // Buyer Info
    doc.text(buyerName, colRight, yPos, { width: 240 });

    yPos += 16;
    if (regularFont) doc.font('Roboto');
    doc.fontSize(8.5).fillColor(colorMuted).text(sellerAddress, colLeft, yPos, { width: 240 });
    doc.text(buyerAddress, colRight, yPos, { width: 240 });

    yPos += 14;
    doc.text(`Davčna številka: ${sellerTaxId ? sellerTaxId : 'Ni navedena'}`, colLeft, yPos);
    doc.text(`Davčna številka: ${buyerTaxId ? buyerTaxId : 'Ni navedena'}`, colRight, yPos);

    if (sellerRegNo) {
      yPos += 13;
      doc.text(`Matična številka: ${sellerRegNo}`, colLeft, yPos);
    }

    // Horizontal Divider
    yPos += 20;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, yPos).lineTo(550, yPos).stroke();

    // Identification note box
    yPos += 12;
    doc.roundedRect(45, yPos, 505, 24, 4).fillAndStroke('#F8FAFC', '#E2E8F0');
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(8).fillColor('#2563EB').text('ℹ', 55, yPos + 7, { continued: true });
    if (boldFont) doc.font('Roboto-Bold');
    doc.fillColor(colorDark).text('  Identifikacija: ', { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor(colorMuted).text('Stranki sta elektronsko identificirani znotraj platforme dražbenik.si.');

    // Table
    yPos += 40;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(8.5).fillColor(colorDark);
    doc.text('OPIS', 45, yPos);
    doc.text('KOLIČINA', 260, yPos, { width: 70, align: 'center' });
    doc.text('CENA (€)', 350, yPos, { width: 80, align: 'right' });
    doc.text('SKUPAJ (€)', 450, yPos, { width: 100, align: 'right' });

    yPos += 14;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(45, yPos).lineTo(550, yPos).stroke();

    // Item Row
    yPos += 12;
    doc.fontSize(10).fillColor(colorDark).text(itemTitle, 45, yPos, { width: 220 });
    doc.text('1', 260, yPos, { width: 70, align: 'center' });
    doc.text(formatEuro(itemPrice), 350, yPos, { width: 80, align: 'right' });
    doc.text(formatEuro(itemPrice), 450, yPos, { width: 100, align: 'right' });

    yPos += 14;
    if (regularFont) doc.font('Roboto');
    doc.fontSize(8).fillColor(colorLight).text(`ID dražbe: ${auctionId}`, 45, yPos);

    // Delivery method banner
    yPos += 16;
    doc.roundedRect(45, yPos, 505, 18, 3).fill('#F8FAFC');
    doc.fontSize(8).fillColor(colorMuted).text(`Način predaje: ${deliveryMethod}`, 55, yPos + 5);

    yPos += 24;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, yPos).lineTo(550, yPos).stroke();

    // Subtotals Box (Right aligned)
    yPos += 16;
    const totalsLeft = 320;
    const totalsValueRight = 550;

    if (isVatApplicable) {
      doc.fontSize(8.5).fillColor(colorMuted).text('Osnova za DDV (22%):', totalsLeft, yPos);
      doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(vatBase)} €`, totalsLeft + 120, yPos, { width: 110, align: 'right' });
      yPos += 16;

      doc.fontSize(8.5).fillColor(colorMuted).text('Znesek DDV (22%):', totalsLeft, yPos);
      doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(vatAmount)} €`, totalsLeft + 120, yPos, { width: 110, align: 'right' });
      yPos += 16;
    } else {
      doc.fontSize(8.5).fillColor(colorMuted).text('Kupnina / Znesek:', totalsLeft, yPos);
      doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(itemPrice)} €`, totalsLeft + 120, yPos, { width: 110, align: 'right' });
      yPos += 16;

      doc.fontSize(8.5).fillColor(colorMuted).text('DDV:', totalsLeft, yPos);
      doc.fontSize(8.5).fillColor(colorDark).text('Ni obračunan', totalsLeft + 120, yPos, { width: 110, align: 'right' });
      yPos += 16;
    }

    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(totalsLeft, yPos).lineTo(totalsValueRight, yPos).stroke();
    yPos += 8;

    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(10.5).fillColor(colorDark).text('SKUPAJ ZA PLAČILO:', totalsLeft, yPos);
    doc.text(`${formatEuro(itemPrice)} €`, totalsLeft + 120, yPos, { width: 110, align: 'right' });

    // Legal Footer at bottom of Page 1
    const footerY = 660;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, footerY).lineTo(550, footerY).stroke();

    let footY = footerY + 12;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(7.5).fillColor(colorDark).text('Jamstvo za neskladnost blaga (ZVPot-1): ', 45, footY, { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor(colorMuted).text('Za blago veljajo zakonska jamstva za neskladnost blaga v skladu z ZVPot-1.');

    footY += 14;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(7.5).fillColor(colorDark).text('Prenos lastništva: ', 45, footY, { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor(colorMuted).text('Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.');

    footY += 14;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(7.5).fillColor(colorDark).text('Pravna opomba in DDV: ', 45, footY, { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor(colorMuted).text(
      isSellerBusiness
        ? 'V ceno je vključen 22% DDV v skladu z Zakonom o davku na dodano vrednost (ZDDV-1).'
        : 'DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1 (prodajalec je fizična oseba).'
    );

    footY += 16;
    doc.fontSize(7).fillColor(colorLight).text(
      'Platforma dražbenik.si nastopa izključno kot tehnološki posrednik in ni stranka v prodajni pogodbi. Ta dokument služi kot kupoprodajna pogodba in potrdilo o sklenjenem poslu ter plačilu med prodajalcem in kupcem, generirano samodejno s strani sistema po uspešnem zaključku dražbe.',
      45,
      footY,
      { width: 505 }
    );

    // ==========================================
    // PAGE 2: RAČUN ZA STORITEV / SERVICE INVOICE (PLATFORMA -> KUPEC)
    // ==========================================
    doc.addPage({ margin: 45, size: 'A4' });

    const feeDocNo = commissionInvoiceNo || `PROV-${(transaction.id || auction.id || '000000').substring(0, 8).toUpperCase()}`;
    const feeBase = Number(transaction.platform_fee || (itemPrice * 0.10) / 1.22);
    const feeVat = Number(transaction.vat_amount || feeBase * 0.22);
    const feeTotal = Number(transaction.fee_total || feeBase + feeVat);

    // Centered Title
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(16).fillColor(colorDark).text('RAČUN ZA STORITEV / SERVICE INVOICE', 45, 45, { width: 505, align: 'center' });

    // Top Divider Line
    let p2Y = 80;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, p2Y).lineTo(550, p2Y).stroke();

    // Two Columns: IZDAJATELJ (PLATFORMA) & PREJEMNIK STORITVE (KUPEC)
    p2Y += 14;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(8).fillColor(colorLight).text('IZDAJATELJ (PLATFORMA)', colLeft, p2Y);
    doc.text('PREJEMNIK STORITVE (KUPEC)', colRight, p2Y);

    p2Y += 14;
    doc.fontSize(11).fillColor(colorDark).text('Dizain d.o.o.', colLeft, p2Y, { width: 240 });
    doc.text(buyerName, colRight, p2Y, { width: 240 });

    p2Y += 16;
    if (regularFont) doc.font('Roboto');
    doc.fontSize(8.5).fillColor(colorMuted).text('Karantanska ulica 28, 2000 Maribor', colLeft, p2Y, { width: 240 });
    doc.text(buyerAddress, colRight, p2Y, { width: 240 });

    p2Y += 14;
    doc.text('Davčna številka: SI57008060', colLeft, p2Y);
    doc.text(`Davčna številka: ${buyerTaxId ? buyerTaxId : 'Ni navedena'}`, colRight, p2Y);

    p2Y += 13;
    doc.text('Matična številka: 9093494000', colLeft, p2Y);
    if (buyerRegNo) {
      doc.text(`Matična številka: ${buyerRegNo}`, colRight, p2Y);
    }

    // Bottom Divider Line
    p2Y += 20;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, p2Y).lineTo(550, p2Y).stroke();

    // Invoice Meta Information
    p2Y += 16;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(8.5).fillColor(colorMuted);
    doc.text(`Številka računa: `, colLeft, p2Y, { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor(colorDark).text(feeDocNo);

    p2Y += 14;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fillColor(colorMuted).text(`Datum izdaje in opravljene storitve: `, colLeft, p2Y, { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor(colorDark).text(paymentDate);

    p2Y += 14;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fillColor(colorMuted).text(`Način plačila: `, colLeft, p2Y, { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor(colorDark).text('Spletno plačilo / Kartica');

    p2Y += 14;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fillColor(colorMuted).text(`Status plačila: `, colLeft, p2Y, { continued: true });
    if (regularFont) doc.font('Roboto');
    doc.fillColor('#166534').text(`PLAČANO (${paymentDate})`);

    // Table Header
    p2Y += 30;
    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(8.5).fillColor(colorDark);
    doc.text('OPIS', 45, p2Y);
    doc.text('OSNOVA (€)', 450, p2Y, { width: 100, align: 'right' });

    p2Y += 14;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(45, p2Y).lineTo(550, p2Y).stroke();

    // Service Row
    p2Y += 12;
    doc.fontSize(10).fillColor(colorDark).text('Provizija platforme za uporabo sistema', 45, p2Y, { width: 350 });
    doc.text(formatEuro(feeBase), 450, p2Y, { width: 100, align: 'right' });

    p2Y += 14;
    if (regularFont) doc.font('Roboto');
    doc.fontSize(8).fillColor(colorLight).text(`Dražba: ${itemTitle}`, 45, p2Y);

    p2Y += 18;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, p2Y).lineTo(550, p2Y).stroke();

    // Platform Fee Totals Box (Right aligned)
    p2Y += 18;
    doc.fontSize(8.5).fillColor(colorMuted).text('Osnova / Base:', totalsLeft, p2Y);
    doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(feeBase)} €`, totalsLeft + 120, p2Y, { width: 110, align: 'right' });

    p2Y += 16;
    doc.fontSize(8.5).fillColor(colorMuted).text('DDV / VAT (22%):', totalsLeft, p2Y);
    doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(feeVat)} €`, totalsLeft + 120, p2Y, { width: 110, align: 'right' });

    p2Y += 16;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(totalsLeft, p2Y).lineTo(totalsValueRight, p2Y).stroke();
    p2Y += 8;

    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(10.5).fillColor(colorDark).text('SKUPAJ PROVIZIJA:', totalsLeft, p2Y);
    doc.text(`${formatEuro(feeTotal)} €`, totalsLeft + 120, p2Y, { width: 110, align: 'right' });

    // Footer on Page 2
    const p2FooterY = 690;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(45, p2FooterY).lineTo(550, p2FooterY).stroke();

    let p2FootY = p2FooterY + 14;
    if (regularFont) doc.font('Roboto');
    doc.fontSize(7.5).fillColor(colorMuted).text(
      'Dizain d.o.o. je registriran izdajatelj računa za posredniške storitve platforme dražbenik.si. V ceno storitve je vključen 22% DDV.',
      45,
      p2FootY,
      { width: 505 }
    );
    p2FootY += 14;
    doc.fontSize(7).fillColor(colorLight).text(
      'Dokument je generiran elektronsko in je veljaven brez žiga ali podpisa v skladu z ZZEPA ter 84. členom Zakona o davku na dodano vrednost (ZDDV-1).',
      45,
      p2FootY,
      { width: 505 }
    );

    doc.end();
  });
}

export async function generateCertificatePDF(transaction: any, buyer: any, seller: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    const regularFont = getFontPath('Roboto-Regular.ttf');
    const boldFont = getFontPath('Roboto-Bold.ttf');

    if (regularFont && boldFont) {
      doc.registerFont('Roboto', regularFont);
      doc.registerFont('Roboto-Bold', boldFont);
      doc.font('Roboto');
    }

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on('error', (err) => reject(err));

    if (boldFont) doc.font('Roboto-Bold');
    doc.fontSize(20).text('POTRDILO O NAKUPU / PURCHASE CERTIFICATE', { align: 'center' });
    if (regularFont) doc.font('Roboto');
    doc.moveDown();

    doc.fontSize(10).text('dražbenik.si');
    doc.moveDown();

    doc.text(`Številka potrdila / Certificate No: CERT-${(transaction.id || '').substring(0, 8).toUpperCase()}`);
    doc.text(`Datum / Date: ${new Date().toLocaleDateString('sl-SI')}`);
    doc.moveDown();

    doc.fontSize(12).text('Kupec / Buyer:', { underline: true });
    doc.fontSize(10).text(`${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || buyer.name || 'Kupec');
    doc.moveDown();

    doc.fontSize(12).text('Prodajalec / Seller:', { underline: true });
    doc.fontSize(10).text(`${seller.first_name || ''} ${seller.last_name || ''}`.trim() || seller.name || 'Prodajalec');
    if (seller.company_status === 'company') {
      doc.text(`Podjetje / Company: ${seller.company_name || 'N/A'}`);
    }
    doc.moveDown();

    const amount = Number(transaction.amount_total || 0);
    doc.fontSize(12).text('Podrobnosti transakcije / Transaction Details:', { underline: true });
    doc.fontSize(10);
    doc.text(`Znesek nakupa / Purchase Amount: €${amount.toFixed(2)}`);

    doc.moveDown();
    doc.fontSize(9).text('To potrdilo služi kot informativni dokaz o uspešno zaključeni dražbi in plačilu.', { italic: true });

    doc.end();
  });
}
