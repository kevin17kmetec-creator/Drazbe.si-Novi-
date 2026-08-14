import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  userId: string;
  isComplete: boolean;
  onComplete: () => void;
  t: (key: string) => string;
  language: string;
}

export const StripeConnectOnboarding: React.FC<Props> = ({ userId, isComplete, onComplete, t, language }) => {
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'STRIPE_POPUP_CALLBACK') {
        const { status, action } = event.data;
        if (action === 'stripe_connect' || !action) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (popupRef.current && !popupRef.current.closed) {
            try { popupRef.current.close(); } catch (e) {}
          }
          setLoading(false);
          onComplete();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [onComplete]);

  const handleStartOnboarding = async () => {
    // Open a popup immediately on click to prevent Safari/mobile popup blockers
    const popup = window.open('', 'stripeOnboarding', 'width=800,height=750,left=250,top=100');
    popupRef.current = popup;

    if (popup) {
      popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Dražbe.si - Stripe povezovanje</title>
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
            <h3>Pripravljam varno povezavo...</h3>
            <p>Preusmerjanje na sistem Stripe</p>
          </div>
        </body>
        </html>
      `);
    }

    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/stripe-callback.html`;
      const response = await fetch('/api/stripe-account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userId, 
          user_id: userId,
          return_url: `${callbackUrl}?stripe=success`,
          refresh_url: `${callbackUrl}?stripe=refresh`
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API returned non-200 response:", response.status, errorText);
        throw new Error(`Server status ${response.status}: ${errorText || 'Failed to fetch link'}`);
      }

      const data = await response.json();
      
      if (data && data.url) {
        if (popup && !popup.closed) {
          popup.location.href = data.url;
        } else {
          window.location.href = data.url;
          return;
        }

        // Monitor popup closure
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimerRef.current);
            setLoading(false);
            onComplete();
          }
        }, 1000);
      } else {
        if (popup && !popup.closed) popup.close();
      }
    } catch (err: any) {
      console.error(err);
      if (popup && !popup.closed) popup.close();
      alert(err.message || 'Napaka pri povezovanju s Stripe sistemom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-6 rounded-2xl border ${isComplete ? 'bg-green-50/50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-6">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isComplete ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
            {isComplete ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          </div>
          <div>
            <h4 className={`text-sm font-black uppercase tracking-widest ${isComplete ? 'text-green-800' : 'text-[#0A1128]'}`}>
                {isComplete ? 'Stripe račun in izplačila' : 'Stripe preverjanje in izplačila'}
            </h4>
            <p className="text-xs font-bold text-slate-500 mt-2 max-w-sm">
                {isComplete ? 'Vaš račun je povezan. Lahko preglejte in posodobite svoje bančne podatke ter nastavitve izplačil.' : 'Za objavo dražb in prejemanje sredstev morate overiti in povezati bančni račun. Preverjanje poteka varno na naši platformi preko sistema Stripe.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={handleStartOnboarding}
          className="shrink-0 bg-[#0A1128] text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-lg disabled:opacity-50"
        >
          {loading ? 'Nalaganje...' : isComplete ? 'Upravljaj bančni račun' : 'Začni preverjanje'}
        </button>
      </div>
    </div>
  );
};

