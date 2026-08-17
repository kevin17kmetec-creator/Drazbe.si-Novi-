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
        logging: false
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

  const sellerAddress = seller.location?.address || seller.location?.city || 'Neznan naslov';
  const buyerAddress = buyer.location?.address || buyer.location?.city || 'Neznan naslov';

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
            className="w-full max-w-[210mm] bg-white p-12 shadow-md shrink-0 text-[#0A1128]"
            style={{ minHeight: '297mm' }}
          >
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-16">
              <div>
                <h1 className="text-4xl font-black tracking-tighter mb-2 uppercase">RAČUN</h1>
                <p className="text-slate-500 font-bold">Številka: {invoiceNumber}</p>
                <p className="text-slate-500 font-bold">Datum izdaje: {paymentDate}</p>
                <p className="text-slate-500 font-bold">Datum opravljene storitve/dobave: {paymentDate}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black tracking-tighter italic text-slate-300">dražbe.si</div>
                <p className="text-xs text-slate-400 font-bold mt-1">Platforma za posredovanje</p>
              </div>
            </div>

            <div className="flex justify-between mb-16">
              {/* Seller details */}
              <div className="w-1/2 pr-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 border-b pb-1">Izdajatelj (Prodajalec)</h3>
                <p className="font-bold text-lg">{sellerName}</p>
                <p className="text-slate-600">{sellerAddress}</p>
                {seller.taxId && <p className="text-slate-600 mt-1">Davčna številka: {seller.taxId}</p>}
              </div>

              {/* Buyer details */}
              <div className="w-1/2 pl-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 border-b pb-1">Prejemnik (Kupec)</h3>
                <p className="font-bold text-lg">{buyerName}</p>
                <p className="text-slate-600">{buyerAddress}</p>
                {buyer.taxId && <p className="text-slate-600 mt-1">Davčna številka: {buyer.taxId}</p>}
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-12 border-collapse">
              <thead>
                <tr className="border-b-2 border-[#0A1128]">
                  <th className="text-left py-3 text-sm font-black uppercase tracking-widest">Opis</th>
                  <th className="text-center py-3 text-sm font-black uppercase tracking-widest w-24">Količina</th>
                  <th className="text-right py-3 text-sm font-black uppercase tracking-widest w-32">Cena (€)</th>
                  <th className="text-right py-3 text-sm font-black uppercase tracking-widest w-32">Skupaj (€)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-4">
                    <p className="font-bold">{auction.title?.SLO || auction.title?.EN || 'Dražba'}</p>
                    <p className="text-sm text-slate-500">ID dražbe: {auction.id}</p>
                  </td>
                  <td className="py-4 text-center">1</td>
                  <td className="py-4 text-right">{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-4 text-right font-bold">{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                {/* Note about delivery */}
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <td className="py-3 text-sm italic text-slate-500" colSpan={4}>
                    Način dostave: {auction.delivery_method === 'post' ? 'Pošiljanje po pošti' : auction.delivery_method === 'pickup' ? 'Osebni prevzem' : 'Po dogovoru'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-16">
              <div className="w-64">
                <div className="flex justify-between py-2 border-b border-slate-200 text-sm">
                  <span className="text-slate-500">Znesek brez DDV:</span>
                  <span>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200 text-sm">
                  <span className="text-slate-500">DDV (0%):</span>
                  <span>0,00 €</span>
                </div>
                <div className="flex justify-between py-4 text-lg font-black uppercase">
                  <span>Za plačilo:</span>
                  <span>{itemPrice.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </div>
              </div>
            </div>

            {/* Legal / Footer notes */}
            <div className="text-xs text-slate-500 mt-auto pt-8 border-t border-slate-200">
              <p className="mb-2"><strong>Izjava o DDV:</strong> Vse cene so končne. Razen če je prodajalec pravna oseba in zavezanec za DDV ter je DDV izrecno navedel, se DDV ne obračunava (sistem C2C ali oprostitev).</p>
              <p>Platforma dražbe.si nastopa izključno kot tehnološki posrednik in ni stranka v prodajni pogodbi. Ta račun služi kot potrdilo o sklenjenem poslu in plačilu med prodajalcem in kupcem, generirano samodejno s strani sistema po uspešnem zaključku dražbe.</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
