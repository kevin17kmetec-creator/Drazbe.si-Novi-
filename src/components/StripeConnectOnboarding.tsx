import React, { useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  userId: string;
  isComplete: boolean;
  onComplete: () => void;
  t: (key: string) => string;
  language: string;
}

export const StripeConnectOnboarding: React.FC<Props> = ({ userId, isComplete, onComplete, t, language }) => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stripeConnectInstance, setStripeConnectInstance] = useState<any>(null);

  const getStripeLocale = (lang: string) => {
    switch (lang) {
      case 'SLO': return 'sl';
      case 'DE': return 'de';
      default: return 'en-US';
    }
  };

  const handleStartOnboarding = () => {
    // Prevent starting again if already showing to avoid multiple instances
    if (showOnboarding) return;

    const fetchClientSecret = async () => {
      const response = await fetch('/api/stripe-account-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!response.ok) {
        let errorMsg = 'Failed to fetch client secret';
        try {
            const data = await response.json();
            if (data.error) errorMsg = data.error;
        } catch(e) {
            errorMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }
      const { client_secret } = await response.json();
      return client_secret;
    };

    const instance = loadConnectAndInitialize({
      publishableKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY,
      fetchClientSecret: fetchClientSecret,
      locale: getStripeLocale(language),
      appearance: {
        variables: {
          colorPrimary: '#FEBA4F',
          colorBackground: '#ffffff',
          colorText: '#0A1128',
          fontFamily: 'Inter, sans-serif',
          colorDanger: '#ef4444',
          borderRadius: '16px',
        },
      },
    });

    setStripeConnectInstance(instance);
    setShowOnboarding(true);
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
          onClick={handleStartOnboarding}
          className="shrink-0 bg-[#0A1128] text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-lg"
        >
          {isComplete ? 'Upravljaj bančni račun' : 'Začni preverjanje'}
        </button>
      </div>

      {showOnboarding && stripeConnectInstance && (
        <div className="mt-8 border-t border-slate-200 pt-8" style={{ minHeight: '600px' }}>
          <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountOnboarding
              onExit={() => {
                // When user clicks exit or completes
                // Let's verify status from our backend
                fetch('/api/stripe-check-account-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_id: userId }),
                })
                  .then(res => res.json())
                  .then(data => {
                    if (data.complete) {
                      setShowOnboarding(false);
                      onComplete();
                    } else {
                      // Status not complete yet
                      setShowOnboarding(false);
                    }
                  })
                  .catch(console.error);
              }}
            />
          </ConnectComponentsProvider>
        </div>
      )}
    </div>
  );
};
