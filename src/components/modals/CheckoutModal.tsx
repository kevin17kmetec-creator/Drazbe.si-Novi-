import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Lock, CreditCard as CardIcon, ShieldCheck, AlertCircle } from 'lucide-react';
import { createCheckoutSessionAction, confirmCheckoutSessionAction } from '@/src/actions/index';
import { auth } from "../../lib/firebase";
import { Portal } from '../ui/Portal';
import { isBankTransferAvailable, resolvePaymentDeadlineMs } from '@/src/lib/bankTransfer';

// Deutscher Kommentar: Modal-Komponente zur Wahl der Zahlungsmethode (Karte oder Bankueberweisung) und Initiierung des Checkouts
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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer'>('card');
    const [bankTransferBlocked, setBankTransferBlocked] = useState(false);
  const pollTimerRef = useRef<any>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setErrorMessage(null);
      setPaymentMethod('card');
            setBankTransferBlocked(false);
    }
  }, [isOpen]);

  const isSub = metadata?.type === 'subscription';
  const isAuction = !isSub;
  
  const paymentDeadlineMs = resolvePaymentDeadlineMs({
      payment_deadline: metadata?.payment_deadline,
      endTime: metadata?.endTime || metadata?.end_time
  });
  
  const showBankTransferOption = isAuction && !bankTransferBlocked && isBankTransferAvailable({
      amountCents: Math.round(amount * 100),
      paymentDeadlineMs,
      nowMs: Date.now(),
      alreadyUsed: !!metadata?.bank_transfer_used
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'STRIPE_POPUP_CALLBACK') {
        const { status, action, sessionId } = event.data;
        if (status === 'success') {
          setIsLoading(false);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (popupRef.current && !popupRef.current.closed) {
            try { popupRef.current.close(); } catch (e) {}
          }
          onSuccess();
          onClose();
        } else if (status === 'cancel') {
          setIsLoading(false);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setErrorMessage("Plačilo je bilo preklicano.");
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [onSuccess, onClose, isOpen]);

  if (!isOpen) return null;

  const handlePay = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const determinedPlan = metadata?.planId || metadata?.tier || (isSub ? (title.toLowerCase().includes('pro') ? 'pro' : 'basic') : undefined);
      const callbackUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/stripe-callback.html${isSub ? '?type=subscription' : ''}` 
        : '';

      const res = await createCheckoutSessionAction({
        amount,
        title,
        ...(metadata || {}),
        payment_method: paymentMethod,
        ...(determinedPlan ? { 
          planId: determinedPlan, 
          package_id: String(determinedPlan).toUpperCase(), 
          tier: String(determinedPlan).toUpperCase() 
        } : {}),
        user_id: auth.currentUser?.uid || metadata?.user_id,
        buyer_id: auth.currentUser?.uid || metadata?.buyer_id,
        return_url: callbackUrl
      });

      if (res.url) {
        window.location.href = res.url;
        return;
      } else {
        throw new Error(res.error || "Povezava za plačilo ni na voljo.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || "Napaka pri preusmeritvi na plačilo");
      // Deutscher Kommentar: Bei abgelehnter Bankueberweisung auf Karte zurueckschalten und Option ausblenden
      if (paymentMethod === 'bank_transfer') {
        setPaymentMethod('card');
        setBankTransferBlocked(true);
      }
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-md" onClick={onClose}></div>
        {/* Deutscher Kommentar: Das Modal erhaelt max-h-[90vh] overflow-y-auto, damit es auf kleinen Bildschirmen scrollbar bleibt und nichts abgeschnitten wird */}
        <div className="relative bg-white w-full max-w-lg rounded-[3rem] p-6 sm:p-10 shadow-2xl animate-in border-4 border-[#FEBA4F] max-h-[90vh] overflow-y-auto">
          <button type="button" onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
          <h3 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-2">{t('checkout') || 'PLAČILO'}</h3>
          <p className="text-slate-500 font-bold mb-6">{title}</p>
          
          <div className="bg-slate-50 rounded-2xl p-6 mb-6 border border-slate-100 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('totalAmount') || 'ZA PLAČILO'}</p>
            <p className="text-4xl font-black text-[#FEBA4F]">€{amount.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          {showBankTransferOption && (
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wider text-[#0A1128] mb-3 text-center">Način plačila</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-[#FEBA4F] bg-amber-50/40 text-[#0A1128]'
                      : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CardIcon size={18} className={paymentMethod === 'card' ? 'text-[#FEBA4F]' : 'text-slate-400'} />
                    <span className="text-sm font-black uppercase tracking-tight">Kartica</span>
                  </div>
                  <span className="text-[11px] font-medium leading-tight text-slate-500">Takojšnje plačilo in potrditev</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between cursor-pointer ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-[#FEBA4F] bg-amber-50/40 text-[#0A1128]'
                      : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={18} className={paymentMethod === 'bank_transfer' ? 'text-[#FEBA4F]' : 'text-slate-400'} />
                    <span className="text-sm font-black uppercase tracking-tight text-nowrap">Nakazilo</span>
                  </div>
                  <span className="text-[11px] font-medium leading-tight text-slate-500">Bančno nakazilo (SEPA)</span>
                </button>
              </div>
                      <p className="mt-3 text-[11px] font-medium leading-snug text-slate-500 text-center">
          Po potrditvi imate za nakazilo do 3 delovne dni. Nakazilo lahko izberete samo enkrat; če ne uspe, imate še eno priložnost za plačilo s kartico.
        </p>
            </div>
          )}

          <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 mb-6 text-center">
            <p className="text-blue-900 text-xs font-bold leading-relaxed flex items-center justify-center gap-2">
              <ShieldCheck size={16} className="text-blue-600 shrink-0" />
              {paymentMethod === 'bank_transfer' 
                ? 'Varne podatke za bančno nakazilo bo posredoval naš plačilni partner.' 
                : 'Varno spletno plačilo prek našega plačilnega partnerja.'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-bold text-center leading-snug flex items-center justify-center gap-2">
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button 
            type="button" 
            onClick={handlePay} 
            disabled={isLoading} 
            className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? <Clock className="animate-spin" size={20} /> : <Lock size={20} />}
            {isLoading ? (t('processing') || 'Obdelujem...') : 'Nadaljuj na plačilo'}
          </button>
        </div>
      </div>
    </Portal>
  );
};
