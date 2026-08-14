import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Lock, CreditCard as CardIcon, ShieldCheck } from 'lucide-react';

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
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'STRIPE_POPUP_CALLBACK') {
        const { status, action, sessionId } = event.data;
        if (status === 'success') {
          setIsProcessing(false);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (popupRef.current && !popupRef.current.closed) {
            try { popupRef.current.close(); } catch (e) {}
          }
          onSuccess();
          onClose();
        } else if (status === 'cancel') {
          setIsProcessing(false);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setError("Plačilo je bilo preklicano.");
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [onSuccess, onClose]);

  const handlePay = async () => {
    setError(null);
    setIsProcessing(true);

    // Open popup immediately on click to prevent browser popup blockers
    const popup = window.open('', 'stripeCheckout', 'width=800,height=750,left=250,top=100');
    popupRef.current = popup;

    if (popup) {
      popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Dražbe.si - Varno plačilo</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0A1128; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .loader { width: 36px; height: 36px; border: 3px solid rgba(254,186,79,0.2); border-top-color: #FEBA4F; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
            @keyframes spin { to { transform: rotate(360deg); } }
            h3 { font-size: 18px; margin-bottom: 8px; color: #FEBA4F; }
            p { font-size: 13px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div>
            <div class="loader"></div>
            <h3>Pripravljam varno plačilo...</h3>
            <p>Preusmerjanje na sistem Stripe</p>
          </div>
        </body>
        </html>
      `);
    }

    try {
      const callbackUrl = `${window.location.origin}/stripe-callback.html`;
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount, 
          ...metadata,
          return_url: callbackUrl
        })
      });
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.url) {
        if (popup && !popup.closed) {
          popup.location.href = data.url;
        } else {
          window.location.href = data.url;
          return;
        }

        // Start fallback monitor for popup closure
        let checkCount = 0;
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(async () => {
          checkCount++;
          if (popup.closed) {
            clearInterval(pollTimerRef.current);
            setIsProcessing(false);
            // If popup was closed after having loaded Stripe, trigger refresh to check if paid
            if (checkCount > 5) {
              if (metadata?.auction_id) {
                try {
                  await fetch('/api/confirm-checkout-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ auctionId: metadata.auction_id })
                  });
                } catch (e) {}
              }
              onSuccess();
              onClose();
            }
          }
        }, 1000);

      } else {
        if (popup && !popup.closed) popup.close();
        throw new Error("Povezava za plačilo ni na voljo.");
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      setIsProcessing(false);
      setError(err.message || "Napaka pri preusmeritvi na plačilo");
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in border-4 border-[#FEBA4F]">
        <button type="button" onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
        <h3 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-2">{t('checkout') || 'PLAČILO'}</h3>
        <p className="text-slate-500 font-bold mb-6">{title}</p>
        
        <div className="bg-slate-50 rounded-2xl p-6 mb-6 border border-slate-100 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('totalAmount') || 'ZA PLAČILO'}</p>
          <p className="text-4xl font-black text-[#FEBA4F]">€{amount.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 mb-6 text-center">
          <p className="text-blue-900 text-xs font-bold leading-relaxed flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-blue-600 shrink-0" />
            Varno spletno plačilo preko sistema Stripe. Za nakupe na platformi (do 10.000 € letno po EU AML zakonodaji) bančni račun ali dodatna verifikacija nista potrebna.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-bold text-center leading-snug">
            {error}
          </div>
        )}

        <button 
          type="button" 
          onClick={handlePay} 
          disabled={isProcessing} 
          className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? <Clock className="animate-spin" size={20} /> : <Lock size={20} />}
          {isProcessing ? 'Pripravljam varno plačilo...' : 'Nadaljuj na plačilo'}
        </button>
      </div>
    </div>
  );
};

