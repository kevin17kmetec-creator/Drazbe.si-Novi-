import React, { useState } from 'react';
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

  const handleStartOnboarding = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe-account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            user_id: userId,
            refresh_url: window.location.href,
            return_url: window.location.href 
        }),
      });
      if (!response.ok) {
        let errorMsg = 'Failed to create stripe link';
        try {
            const data = await response.json();
            if (data.error) errorMsg = data.error;
        } catch(e) {
            errorMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }
      const data = await response.json();
      if (data.url) {
          window.location.href = data.url;
      }
    } catch (err: any) {
        console.error(err);
        alert(err.message || 'Prišlo je do napake pri preusmeritvi na Stripe.');
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

