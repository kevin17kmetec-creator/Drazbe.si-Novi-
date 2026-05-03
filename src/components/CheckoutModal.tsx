import React, { useState } from 'react';
import { X, Clock, Lock, CreditCard as CardIcon } from 'lucide-react';

export const CheckoutModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  title: string;
  t: any;
  language: string;
  onSuccess: () => void;
  metadata?: any;
}> = ({ isOpen, onClose, amount, title, t, language, onSuccess, metadata }) => {
  if (!isOpen) return null;

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    const popup = window.open('', 'stripeCheckout', 'width=800,height=700,left=200,top=100');
    if (popup) {
        popup.document.write('<div style="font-family: sans-serif; padding: 20px;">Pripravljam varno plačilo...</div>');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            amount, 
            ...metadata,
            return_url: window.location.href
        })
      });
      const data = await res.json();
      
      if (data.error) {
          throw new Error(data.error);
      }

      if (data.url) {
          if (popup) {
              popup.location.href = data.url;
          } else {
              window.open(data.url, '_blank', 'width=800,height=700');
          }
          // We can also close the modal now that they are in the popup
          onClose();
      } else {
          if (popup) popup.close();
      }
    } catch (err: any) {
      if (popup) popup.close();
      setError(err.message || "Napaka pri preusmeritvi na plačilo");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in border-4 border-[#FEBA4F]">
        <button type="button" onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
        <h3 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-2">{t('checkout') || 'PLAČILO'}</h3>
        <p className="text-slate-500 font-bold mb-8">{title}</p>
        
        <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('totalAmount') || 'ZA PLAČILO'}</p>
          <p className="text-4xl font-black text-[#FEBA4F]">€{amount.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <p className="text-slate-500 text-sm mb-8 text-center font-bold">
          Preusmerjeni boste na varen sistem Stripe za izvedbo plačila, kjer lahko plačate s kartico, Google Pay ali Apple Pay.
        </p>

        {error && <div className="mb-6 text-red-500 text-sm font-bold text-center">{error}</div>}

        <button type="button" onClick={handlePay} disabled={isProcessing} className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
          {isProcessing ? <Clock className="animate-spin" size={20} /> : <Lock size={20} />}
          {isProcessing ? 'Nalaganje...' : 'Nadaljuj na plačilo'}
        </button>
      </div>
    </div>
  );
};

