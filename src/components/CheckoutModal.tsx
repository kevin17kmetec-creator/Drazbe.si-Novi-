import React, { useState } from 'react';
import { X, Clock, Lock, CreditCard as CardIcon } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || (() => { throw new Error("VITE_STRIPE_PUBLIC_KEY is not defined"); })());

const CheckoutForm: React.FC<{ amount: number; title: string; t: any; onSuccess: () => void; onClose: () => void; metadata?: any }> = ({ amount, title, t, onSuccess, onClose, metadata }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [method, setMethod] = useState<'card' | 'google' | 'apple' | 'paypal'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ID Upload for > 10k
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (amount > 10000 && (!idFront || !idBack)) {
        setError("Za nakupe nad 10.000 € je obvezna naložitev osebnega dokumenta (sprednja in zadnja stran).");
        return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, ...metadata })
      });
      const data = await res.json();
      
      if (data.error) {
          console.error("Backend Error Details:", data.details || data.error);
          throw new Error(data.error);
      }

      const clientSecret = data.clientSecret;

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement as any,
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="relative bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in border-4 border-[#FEBA4F]">
        <button type="button" onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
        <h3 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-2">{t('checkout')}</h3>
        <p className="text-slate-500 font-bold mb-8">{title}</p>
        
        <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('totalAmount')}</p>
          <p className="text-4xl font-black text-[#FEBA4F]">€{amount.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{t('paymentMethods')}</p>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button type="button" onClick={() => setMethod('card')} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'card' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            <CardIcon size={16} /> {t('payWithCard')}
          </button>
          <button type="button" onClick={() => {
              setMethod('google');
              setError('To plačilno sredstvo je trenutno v pripravi.');
          }} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'google' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            Google Pay
          </button>
          <button type="button" onClick={() => {
              setMethod('apple');
              setError('To plačilno sredstvo je trenutno v pripravi.');
          }} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'apple' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            Apple Pay
          </button>
          <button type="button" onClick={() => {
              setMethod('paypal');
              setError('To plačilno sredstvo je trenutno v pripravi.');
          }} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'paypal' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            PayPal
          </button>
        </div>

        {method === 'card' && (
          <div className="mb-8 p-4 border border-slate-200 rounded-xl bg-slate-50">
            <CardElement options={{
              hidePostalCode: true,
              style: {
                base: {
                  fontSize: '16px',
                  color: '#0A1128',
                  '::placeholder': {
                    color: '#94a3b8',
                  },
                },
                invalid: {
                  color: '#ef4444',
                },
              },
            }} />
          </div>
        )}

        {amount > 10000 && (
            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#0A1128] mb-4">Obvezna identifikacija (Nakup nad 10.000 €)</h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Osebni dokument - Sprednja stran</label>
                        <input type="file" accept="image/*" onChange={(e) => setIdFront(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-[#FEBA4F]/10 file:text-[#0A1128] hover:file:bg-[#FEBA4F]/20 cursor-pointer" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Osebni dokument - Zadnja stran</label>
                        <input type="file" accept="image/*" onChange={(e) => setIdBack(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:uppercase file:tracking-widest file:bg-[#FEBA4F]/10 file:text-[#0A1128] hover:file:bg-[#FEBA4F]/20 cursor-pointer" />
                    </div>
                </div>
            </div>
        )}

        {error && <div className="mb-6 text-red-500 text-sm font-bold text-center">{error}</div>}

        <button type="submit" disabled={!stripe || isProcessing} className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
          {isProcessing ? <Clock className="animate-spin" size={20} /> : <Lock size={20} />}
          {isProcessing ? '...' : t('payNow')}
        </button>
    </form>
  );
};

export const CheckoutModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  title: string;
  t: any;
  onSuccess: () => void;
  metadata?: any;
}> = ({ isOpen, onClose, amount, title, t, onSuccess, metadata }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-md" onClick={onClose}></div>
      <Elements stripe={stripePromise}>
        <CheckoutForm amount={amount} title={title} t={t} onSuccess={onSuccess} onClose={onClose} metadata={metadata} />
      </Elements>
    </div>
  );
};
