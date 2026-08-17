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

  const sellerAddress = getFullAddress(seller);
  const buyerAddress = getFullAddress(buyer);

  const itemPrice = auction.currentBid || 0;

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
                Predogled računa
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
            className="w-full max-w-[210mm] p-12 shadow-md shrink-0"
            style={{ minHeight: '297mm', backgroundColor: '#FFFFFF', color: '#0A1128', fontFamily: 'sans-serif' }}
          >
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-16">
              <div>
                <h1 className="text-4xl font-black tracking-tighter mb-2 uppercase" style={{ color: '#0A1128' }}>RAČUN</h1>
                <p className="font-bold" style={{ color: '#64748B' }}>Številka: {invoiceNumber}</p>
                <p className="font-bold" style={{ color: '#64748B' }}>Datum izdaje: {paymentDate}</p>
                <p className="font-bold" style={{ color: '#64748B' }}>Datum opravljene storitve/dobave: {paymentDate}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tracking-tighter italic" style={{ color: '#CBD5E1' }}>dražbe.si</div>
                <p className="text-xs font-bold mt-1" style={{ color: '#94A3B8' }}>Platforma za posredovanje</p>
              </div>
            </div>

            <div className="flex justify-between mb-16">
              {/* Seller details */}
              <div className="w-1/2 pr-4">
                <h3 className="text-xs font-black uppercase tracking-widest mb-2 border-b pb-1" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>Izdajatelj (Prodajalec)</h3>
                <p className="font-bold text-lg" style={{ color: '#0A1128' }}>{sellerName}</p>
                <p style={{ color: '#475569' }}>{sellerAddress}</p>
                {seller.taxId && <p className="mt-1" style={{ color: '#475569' }}>Davčna številka: {seller.taxId}</p>}
                {seller.vat_id && <p className="mt-1" style={{ color: '#475569' }}>Davčna številka: {seller.vat_id}</p>}
              </div>

              {/* Buyer details */}
              <div className="w-1/2 pl-4">
                <h3 className="text-xs font-black uppercase tracking-widest mb-2 border-b pb-1" style={{ color: '#94A3B8', borderColor: '#E2E8F0' }}>Prejemnik (Kupec)</h3>
                <p className="font-bold text-lg" style={{ color: '#0A1128' }}>{buyerName}</p>
                <p style={{ color: '#475569' }}>{buyerAddress}</p>
                {buyer.taxId && <p className="mt-1" style={{ color: '#475569' }}>Davčna številka: {buyer.taxId}</p>}
                {buyer.vat_id && <p className="mt-1" style={{ color: '#475569' }}>Davčna številka: {buyer.vat_id}</p>}
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-12 border-collapse">
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
                    <p className="font-bold" style={{ color: '#0A1128' }}>{auction.title?.SLO || auction.title?.EN || 'Dražba'}</p>
                    <p className="text-sm" style={{ color: '#64748B' }}>ID dražbe: {auction.id}</p>
                  </td>
                  <td className="py-4 text-center" style={{ color: '#0A1128' }}>1</td>
                  <td className="py-4 text-right" style={{ color: '#0A1128' }}>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-4 text-right font-bold" style={{ color: '#0A1128' }}>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                {/* Note about delivery */}
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <td className="py-3 text-sm italic" style={{ color: '#64748B' }} colSpan={4}>
                    Način dostave: {auction.delivery_method === 'post' ? 'Pošiljanje po pošti' : auction.delivery_method === 'pickup' ? 'Osebni prevzem' : 'Po dogovoru'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-16">
              <div className="w-64">
                <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#64748B' }}>Znesek brez DDV:</span>
                  <span style={{ color: '#0A1128' }}>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#64748B' }}>DDV (0%):</span>
                  <span style={{ color: '#0A1128' }}>0,00 €</span>
                </div>
                <div className="flex justify-between py-4 text-lg font-black uppercase" style={{ color: '#0A1128' }}>
                  <span>Za plačilo:</span>
                  <span>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
              </div>
            </div>

            {/* Legal / Footer notes */}
            <div className="text-xs mt-auto pt-8" style={{ color: '#64748B', borderTop: '1px solid #E2E8F0' }}>
              <p className="mb-2"><strong style={{ color: '#475569' }}>Izjava o DDV:</strong> Vse cene so končne. Razen če je prodajalec pravna oseba in zavezanec za DDV ter je DDV izrecno navedel, se DDV ne obračunava (sistem C2C ali oprostitev).</p>
              <p>Platforma dražbe.si nastopa izključno kot tehnološki posrednik in ni stranka v prodajni pogodbi. Ta račun služi kot potrdilo o sklenjenem poslu in plačilu med prodajalcem in kupcem, generirano samodejno s strani sistema po uspešnem zaključku dražbe.</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
