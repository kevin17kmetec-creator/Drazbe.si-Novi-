import React, { useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  userId: string;
  isComplete: boolean;
  onComplete: () => void;
  t: (key: string) => string;
}

export const StripeConnectOnboarding: React.FC<Props> = ({ userId, isComplete, onComplete, t }) => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stripeConnectInstance, setStripeConnectInstance] = useState<any>(null);

  const handleStartOnboarding = () => {
    const fetchClientSecret = async () => {
      const response = await fetch('/api/stripe/account_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to fetch client secret');
      }
      const { client_secret } = await response.json();
      return client_secret;
    };

    const instance = loadConnectAndInitialize({
      publishableKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY,
      fetchClientSecret: fetchClientSecret,
      appearance: {
        overlays: 'dialog',
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

  if (isComplete) {
    return (
      <div className="p-6 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-green-800">Stripe račun povezan</h4>
            <p className="text-xs font-bold text-green-600/80 mt-1">Vaš račun je potrjen in pripravljen za prejemanje plačil ter objavo dražb.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-6">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-[#0A1128]">Stripe preverjanje in izplačila</h4>
            <p className="text-xs font-bold text-slate-500 mt-2 max-w-sm">Za objavo dražb in prejemanje sredstev morate overiti in povezati bančni račun. Preverjanje poteka varno na naši platformi preko sistema Stripe.</p>
          </div>
        </div>
        <button
          onClick={handleStartOnboarding}
          className="shrink-0 bg-[#0A1128] text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-lg"
        >
          Začni preverjanje
        </button>
      </div>

      {showOnboarding && stripeConnectInstance && (
        <div className="mt-8 border-t border-slate-200 pt-8" style={{ minHeight: '600px' }}>
          <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountOnboarding
              onExit={() => {
                // When user clicks exit or completes
                // Let's verify status from our backend
                fetch('/api/stripe/check_account_status', {
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
