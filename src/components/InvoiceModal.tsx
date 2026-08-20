import React, { useRef, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';
import { AuctionItem } from '../../types.ts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  auction: AuctionItem | null;
  seller: any;
  buyer: any;
  feePercentage?: number; // Only relevant for the platform fee part, though standard invoice is just between buyer and seller.
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  auction,
  seller,
  buyer,
  feePercentage = 0
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !auction || !seller || !buyer) return null;

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.tagName === 'IMG' // Prevent CORS issues from images
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Racun-${auction.id.substring(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const paymentDate = auction.paid_at ? new Date(auction.paid_at).toLocaleDateString('sl-SI') : new Date().toLocaleDateString('sl-SI');
  const invoiceNumber = `INV-${auction.id.substring(0, 8).toUpperCase()}`;

  const sellerName = seller.company_name || seller.companyName || `${seller.first_name || seller.firstName || ''} ${seller.last_name || seller.lastName || ''}`.trim() || 'Prodajalec';
  const buyerName = buyer.company_name || buyer.companyName || `${buyer.first_name || buyer.firstName || ''} ${buyer.last_name || buyer.lastName || ''}`.trim() || 'Kupec';

  const getFullAddress = (user: any) => {
    if (!user) return 'Neznan naslov';
    const street = user.address || user.street_address || user.location?.address;
    const postal = user.postal_code || user.postcode || user.location?.zip;
    const city = user.city || user.place || user.location?.city;
    
    if (street && postal && city) {
      return `${street}, ${postal} ${city}`;
    } else if (street && city) {
      return `${street}, ${city}`;
    } else if (city) {
      return city;
    }
    return 'Neznan naslov';
  };

  const getSellerPlace = (user: any) => {
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
    // Remove postal code numbers (e.g. 2380, SI-2380) so only city name + country remains
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

  const sellerAddress = getFullAddress(seller);
  const buyerAddress = getFullAddress(buyer);
  const sellerPlace = getSellerPlace(seller);

  const isSellerCompany = seller.company_status === 'company' || seller.isCompany || seller.user_type === 'business';
  const isBuyerCompany = buyer.company_status === 'company' || buyer.isCompany || buyer.user_type === 'business';
  const isSellerIndividual = !isSellerCompany;
  const isB2C = isSellerCompany && !isBuyerCompany;
  const isB2B = isSellerCompany && isBuyerCompany;
  const isC2B = isSellerIndividual && isBuyerCompany;
  const isC2C = isSellerIndividual && !isBuyerCompany;

  const sellerTaxId = seller.tax_id || seller.taxId || seller.vat_id || seller.vatId;
  const buyerTaxId = buyer.tax_id || buyer.taxId || buyer.vat_id || buyer.vatId;
  const hasTaxIds = !!(sellerTaxId || buyerTaxId);

  // Check if seller is VAT payer (company with SI tax ID or standard company)
  const isSellerVatPayer = isSellerCompany && (
    seller.is_vat_liable !== false &&
    (!sellerTaxId || sellerTaxId.toUpperCase().startsWith('SI') || !sellerTaxId.startsWith(''))
  );

  const itemPrice = auction.currentBid || 0;

  // VAT calculation: For B2C and B2B where seller is VAT payer: Osnova = Skupni znesek / 1.22, DDV = Skupni znesek - Osnova
  const vatRate = 0.22;
  const isVatApplicable = (isB2C || isB2B) && isSellerVatPayer;
  const vatBase = isVatApplicable ? itemPrice / (1 + vatRate) : itemPrice;
  const vatAmount = isVatApplicable ? itemPrice - vatBase : 0;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[#0A1128]/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-100 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FEBA4F]/20 rounded-xl flex items-center justify-center text-[#FEBA4F]">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-widest text-[#0A1128]">
                {isC2B ? 'Kupoprodajna pogodba' : isSellerIndividual ? 'Kupoprodajna pogodba / Račun' : 'Predogled računa'}
              </h3>
              <p className="text-xs font-bold text-slate-400">
                {invoiceNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-[#0A1128] text-white px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {isGenerating ? 'Generiranje...' : 'Prenesi PDF'}
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Invoice Preview Container (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-slate-100/50 flex justify-center">
          
          {/* Actual Invoice HTML to be captured */}
          <div 
            ref={invoiceRef}
            className="w-full max-w-[210mm] p-12 shadow-md shrink-0 flex flex-col justify-between"
            style={{ minHeight: '297mm', backgroundColor: '#FFFFFF', color: '#0A1128', fontFamily: 'sans-serif' }}
          >
            <div>
              {/* Invoice Header */}
              <div className="flex justify-between items-start mb-14">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 uppercase" style={{ color: '#0A1128' }}>
                    {isC2B ? 'KUPOPRODAJNA POGODBA' : isSellerIndividual ? 'KUPOPRODAJNA POGODBA / RAČUN' : 'RAČUN / INVOICE'}
                  </h1>
                  <p className="font-bold text-sm" style={{ color: '#64748B' }}>Številka: {invoiceNumber}</p>
                  <p className="font-bold text-sm" style={{ color: '#64748B' }}>Kraj izdaje: {sellerPlace}</p>
                  <p className="font-bold text-sm" style={{ color: '#64748B' }}>Datum izdaje / sklenitve: {paymentDate}</p>
                  <p className="font-bold text-sm" style={{ color: '#64748B' }}>Datum opravljene storitve/dobave: {paymentDate}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black tracking-tighter italic" style={{ color: '#CBD5E1' }}>dražbe.si</div>
                  <p className="text-xs font-bold mt-1" style={{ color: '#94A3B8' }}>Platforma za posredovanje</p>
                </div>
              </div>

              <div className="flex justify-between mb-12 gap-8 border-y border-slate-200 py-6">
                {/* Seller details */}
                <div className="w-1/2 pr-2">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-2 border-b pb-1" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
                    Izdajatelj (Prodajalec)
                  </h3>
                  <p className="font-bold text-base" style={{ color: '#0A1128' }}>{sellerName}</p>
                  <p className="text-sm mt-0.5" style={{ color: '#475569' }}>{sellerAddress}</p>
                  {isC2B ? (
                    <p className="text-xs font-medium mt-1" style={{ color: '#475569' }}>
                      Davčna številka: <strong>{sellerTaxId || '[Davčna številka prodajalca]'}</strong>
                    </p>
                  ) : sellerTaxId ? (
                    <p className="text-xs font-medium mt-1" style={{ color: '#475569' }}>
                      Davčna številka: <strong>{sellerTaxId}</strong>
                    </p>
                  ) : null}
                </div>

                {/* Buyer details */}
                <div className="w-1/2 pl-2">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-2 border-b pb-1" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>
                    Prejemnik (Kupec)
                  </h3>
                  <p className="font-bold text-base" style={{ color: '#0A1128' }}>{buyerName}</p>
                  <p className="text-sm mt-0.5" style={{ color: '#475569' }}>{buyerAddress}</p>
                  {buyerTaxId && <p className="text-xs font-medium mt-1" style={{ color: '#475569' }}>Davčna številka: <strong>{buyerTaxId}</strong></p>}
                </div>
              </div>

              {/* Electronic Identification Note if tax numbers are not public/available */}
              {(!sellerTaxId || !buyerTaxId) && (
                <div className="mb-8 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <span className="text-[#FEBA4F] font-bold">ℹ</span>
                  <span><strong>Identifikacija:</strong> Stranki sta elektronsko identificirani znotraj platforme dražbe.si.</span>
                </div>
              )}

              {/* Items Table */}
              <table className="w-full mb-10 border-collapse">
                <thead>
                  <tr style={{ borderBottom: '2px solid #0A1128' }}>
                    <th className="text-left py-3 text-sm font-black uppercase tracking-widest" style={{ color: '#0A1128' }}>Opis</th>
                    <th className="text-center py-3 text-sm font-black uppercase tracking-widest w-24" style={{ color: '#0A1128' }}>Količina</th>
                    <th className="text-right py-3 text-sm font-black uppercase tracking-widest w-32" style={{ color: '#0A1128' }}>Cena (€)</th>
                    <th className="text-right py-3 text-sm font-black uppercase tracking-widest w-32" style={{ color: '#0A1128' }}>Skupaj (€)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td className="py-4">
                      <p className="font-bold text-sm" style={{ color: '#0A1128' }}>{auction.title?.SLO || auction.title?.EN || 'Dražbeni predmet'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>ID dražbe: {auction.id}</p>
                    </td>
                    <td className="py-4 text-center text-sm font-bold" style={{ color: '#0A1128' }}>1</td>
                    <td className="py-4 text-right text-sm" style={{ color: '#0A1128' }}>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-4 text-right text-sm font-bold" style={{ color: '#0A1128' }}>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  {/* Note about delivery */}
                  <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                    <td className="py-2.5 px-2 text-xs italic" style={{ color: '#64748B' }} colSpan={4}>
                      Način predaje: {auction.delivery_method === 'post' ? 'Pošiljanje po pošti' : auction.delivery_method === 'pickup' ? 'Osebni prevzem' : 'Po dogovoru'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-12">
                <div className="w-72">
                  {isVatApplicable ? (
                    <>
                      <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B' }}>Osnova za DDV (22%):</span>
                        <span className="font-semibold" style={{ color: '#0A1128' }}>{vatBase.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B' }}>Znesek DDV (22%):</span>
                        <span className="font-semibold" style={{ color: '#0A1128' }}>{vatAmount.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      </div>
                      <div className="flex justify-between py-3.5 text-base font-black uppercase" style={{ color: '#0A1128', borderTop: '2px solid #0A1128' }}>
                        <span>Skupaj za plačilo:</span>
                        <span>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B' }}>Kupnina / Znesek:</span>
                        <span className="font-semibold" style={{ color: '#0A1128' }}>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <span style={{ color: '#64748B' }}>DDV:</span>
                        <span className="font-semibold" style={{ color: '#0A1128' }}>Ni obračunan</span>
                      </div>
                      <div className="flex justify-between py-3.5 text-base font-black uppercase" style={{ color: '#0A1128', borderTop: '2px solid #0A1128' }}>
                        <span>Za plačilo:</span>
                        <span>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Legal / Footer notes */}
            <div className="text-xs pt-6 mt-8 space-y-2 border-t border-slate-200" style={{ color: '#475569' }}>
              {isB2C ? (
                <>
                  <p>
                    <strong>Jamstvo za neskladnost blaga (ZVPot-1):</strong> Za blago veljajo zakonska jamstva za neskladnost blaga v skladu z ZVPot-1.
                  </p>
                  <p>
                    <strong>Prenos lastništva:</strong> Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.
                  </p>
                  <p>
                    <strong>Izjava o DDV:</strong> V ceno je vključen 22% DDV v skladu z Zakonom o davku na dodano vrednost (ZDDV-1).
                  </p>
                </>
              ) : isB2B ? (
                <>
                  <p>
                    <strong>Izjava o DDV in stanje opreme:</strong> V ceno je vključen 22% DDV v skladu z ZDDV-1. Za rabljeno opremo velja dogovorjeno stanje ob prevzemu (videno-kupljeno).
                  </p>
                  <p>
                    <strong>Prenos lastništva:</strong> Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.
                  </p>
                </>
              ) : isC2B ? (
                <>
                  <p>
                    <strong>Videno-kupljeno:</strong> Predmet se prodaja po načelu "videno-kupljeno". Prodajalec ne odgovarja za stvarne napake predmeta po njegovem prevzemu.
                  </p>
                  <p>
                    <strong>Prenos lastništva:</strong> Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.
                  </p>
                  <p>
                    <strong>Pravna opomba in DDV:</strong> Prodajalec je fizična oseba (C2B). DDV se v skladu z ZDDV-1 ne obračunava. Dokument služi kot kupoprodajna pogodba in dokazilo o plačilu.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Videno-kupljeno:</strong> Predmet se prodaja po načelu "videno-kupljeno". Prodajalec ne odgovarja za stvarne napake predmeta po njegovem prevzemu.
                  </p>
                  <p>
                    <strong>Prenos lastništva:</strong> Lastninska pravica in nevarnost naključnega uničenja preideta na kupca ob celotnem plačilu kupnine in prevzemu predmeta.
                  </p>
                  <p>
                    <strong>Izjava o DDV:</strong> Prodajalec je fizična oseba in ni davčni zavezanec po Zakonu o davku na dodano vrednost (ZDDV-1), zato DDV ni obračunan.
                  </p>
                </>
              )}
              <p className="text-[11px] pt-1" style={{ color: '#94A3B8' }}>
                Platforma dražbe.si nastopa izključno kot tehnološki posrednik in ni stranka v prodajni pogodbi. Ta dokument služi kot kupoprodajna pogodba in potrdilo o sklenjenem poslu ter plačilu med prodajalcem in kupcem, generirano samodejno s strani sistema po uspešnem zaključku dražbe.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
