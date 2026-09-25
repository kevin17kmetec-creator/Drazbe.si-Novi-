import React from 'react';
import { Lock, Calendar, AlertTriangle, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { SubscriptionTier } from "../../types";

export const SubscriptionsView: React.FC<{ 
    t: any; 
    language?: string;
    currentPlan: SubscriptionTier; 
    onSubscribe: (tier: SubscriptionTier) => void; 
    isVerified: boolean;
    onCancelSubscription?: () => void;
    nextBillingDate?: Date;
    subscribedAt?: Date;
    isCanceled?: boolean;
    onBack?: () => void;
    onSyncSubscription?: () => void;
    isSyncing?: boolean;
}> = ({ t, language, currentPlan, onSubscribe, isVerified, onCancelSubscription, nextBillingDate, subscribedAt, isCanceled, onBack, onSyncSubscription, isSyncing }) => {
  const plans = [
    { tier: SubscriptionTier.FREE, name: t('freeTier'), price: 0, desc: t('freeDesc'), color: 'bg-slate-100 text-slate-600' },
    { tier: SubscriptionTier.BASIC, name: t('basicTier'), price: 20, desc: t('basicDesc'), color: 'bg-[#FEBA4F] text-[#0A1128]' },
    { tier: SubscriptionTier.PRO, name: t('proTier'), price: 50, desc: t('proDesc'), color: 'bg-[#0A1128] text-white' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"
          >
            <ArrowLeft size={16} /> {t('back') || 'Nazaj'}
          </button>
        ) : <div />}
        {onSyncSubscription && (
          <button
            type="button"
            onClick={onSyncSubscription}
            disabled={isSyncing}
            className="text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-[#0A1128] transition-colors flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {isSyncing ? 'Preverjanje...' : 'Osveži status naročnine'}
          </button>
        )}
      </div>
      <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-12">{t('subscriptions')}</h2>
      
      {isCanceled && currentPlan !== SubscriptionTier.FREE && (
          <div className="bg-amber-50 border-2 border-amber-200 text-amber-800 p-6 rounded-3xl mb-12 flex items-center gap-4">
              <AlertTriangle className="text-amber-500 shrink-0" size={32} />
              <div>
                  <h4 className="font-black uppercase tracking-widest text-sm mb-1">Naročnina je preklicana</h4>
                  <p className="text-sm font-bold opacity-80">Vaša naročnina je preklicana in se ne bo samodejno obnovila. Ugodnosti vašega paketa veljajo do izteka trenutnega obdobja ({nextBillingDate?.toLocaleDateString('sl-SI')}). Po tem datumu boste samodejno preklopljeni nazaj na brezplačni paket.</p>
              </div>
          </div>
      )}

      {currentPlan !== SubscriptionTier.FREE && !isCanceled && (
          <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-900 p-6 rounded-3xl mb-12 flex items-start gap-4">
              <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={28} />
              <div>
                  <h4 className="font-black uppercase tracking-widest text-sm mb-1">Aktivna naročnina</h4>
                  <p className="text-sm font-bold opacity-85">
                      {subscribedAt && <span>Naročeni od: <strong>{subscribedAt.toLocaleDateString('sl-SI')}</strong>. </span>}
                      Bremenitev naročnine poteka samodejno po poteku 1 meseca od nakupa (naslednja bremenitev: <strong>{nextBillingDate?.toLocaleDateString('sl-SI')}</strong>). Naročnino lahko kadarkoli prekinete brez obveznosti.
                  </p>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan.tier} className={`rounded-[3rem] p-10 flex flex-col ${plan.color} ${currentPlan === plan.tier ? 'ring-4 ring-offset-4 ring-[#FEBA4F]' : ''}`}>
            {currentPlan === plan.tier && (
              <div className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-80 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {plan.tier === SubscriptionTier.FREE ? t('currentPlan') : (t('subscribed') || 'Naročen')}
              </div>
            )}
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">{plan.name}</h3>
            <div className="text-5xl font-black mb-6">€{plan.price}<span className="text-lg opacity-60">/mo</span></div>
            <p className="font-bold opacity-80 mb-6 flex-1">{plan.desc}</p>
            
            {currentPlan === plan.tier && plan.tier !== SubscriptionTier.FREE && (
                <div className="bg-black/10 rounded-2xl p-4 mb-6 text-xs font-bold flex flex-col gap-2">
                    {subscribedAt && (
                      <div className="flex items-center gap-2 opacity-80">
                        <Clock size={14} />
                        <span>Naročeni od: {subscribedAt.toLocaleDateString('sl-SI')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>{isCanceled ? 'Velja do izteka' : 'Naslednja bremenitev'}: {nextBillingDate?.toLocaleDateString('sl-SI')}</span>
                    </div>
                </div>
            )}
            
            <button 
              onClick={() => onSubscribe(plan.tier)}
              disabled={currentPlan === plan.tier || (!isVerified && plan.tier !== SubscriptionTier.FREE)}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${currentPlan === plan.tier ? 'bg-black/10 opacity-50 cursor-not-allowed' : (!isVerified && plan.tier !== SubscriptionTier.FREE ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white text-[#0A1128] hover:scale-105 shadow-xl')}`}
            >
              {!isVerified && plan.tier !== SubscriptionTier.FREE ? (
                <><Lock size={18} /> {t('verifyAction')}</>
              ) : (
                currentPlan === plan.tier 
                  ? (plan.tier === SubscriptionTier.FREE ? t('currentPlan') : (t('subscribed') || 'Naročen')) 
                  : t('subscribe')
              )}
            </button>
          </div>
        ))}
      </div>

      {currentPlan !== SubscriptionTier.FREE && !isCanceled && (
          <div className="mt-12 text-center">
              <button 
                  onClick={onCancelSubscription} 
                  className="bg-red-50 text-red-600 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-red-100 transition-colors"
              >
                  Prekliči naročnino
              </button>
              <p className="text-slate-400 font-bold text-xs mt-4">Preklic bo zaustavil samodejno obnovitev. Ugodnosti boste obdržali do izteka trenutnega obdobja.</p>
          </div>
      )}
    </div>
  );
};
