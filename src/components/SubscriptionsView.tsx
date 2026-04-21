import React from 'react';
import { Lock, Calendar, AlertTriangle } from 'lucide-react';
import { SubscriptionTier } from '../../types.ts';

export const SubscriptionsView: React.FC<{ 
    t: any; 
    currentPlan: SubscriptionTier; 
    onSubscribe: (tier: SubscriptionTier) => void; 
    isVerified: boolean;
    onCancelSubscription?: () => void;
    nextBillingDate?: Date;
    isCanceled?: boolean;
}> = ({ t, currentPlan, onSubscribe, isVerified, onCancelSubscription, nextBillingDate, isCanceled }) => {
  const plans = [
    { tier: SubscriptionTier.FREE, name: t('freeTier'), price: 0, desc: t('freeDesc'), color: 'bg-slate-100 text-slate-600' },
    { tier: SubscriptionTier.BASIC, name: t('basicTier'), price: 20, desc: t('basicDesc'), color: 'bg-[#FEBA4F] text-[#0A1128]' },
    { tier: SubscriptionTier.PRO, name: t('proTier'), price: 50, desc: t('proDesc'), color: 'bg-[#0A1128] text-white' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-12">{t('subscriptions')}</h2>
      
      {isCanceled && currentPlan !== SubscriptionTier.FREE && (
          <div className="bg-amber-50 border-2 border-amber-200 text-amber-800 p-6 rounded-3xl mb-12 flex items-center gap-4">
              <AlertTriangle className="text-amber-500" size={32} />
              <div>
                  <h4 className="font-black uppercase tracking-widest text-sm mb-1">Naročnina se ne bo podaljšala</h4>
                  <p className="text-sm font-bold opacity-80">Vaša naročnina je preklicana in se ne bo samodejno obnovila. Ugodnosti lahko koristite do izteka trenutnega obdobja: {nextBillingDate?.toLocaleDateString('sl-SI')}.</p>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan.tier} className={`rounded-[3rem] p-10 flex flex-col ${plan.color} ${currentPlan === plan.tier ? 'ring-4 ring-offset-4 ring-[#FEBA4F]' : ''}`}>
            {currentPlan === plan.tier && <div className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-80">{t('currentPlan')}</div>}
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">{plan.name}</h3>
            <div className="text-5xl font-black mb-6">€{plan.price}<span className="text-lg opacity-60">/mo</span></div>
            <p className="font-bold opacity-80 mb-6 flex-1">{plan.desc}</p>
            
            {currentPlan === plan.tier && plan.tier !== SubscriptionTier.FREE && (
                <div className="bg-black/10 rounded-2xl p-4 mb-6 text-sm font-bold flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{isCanceled ? 'Velja do' : 'Naslednja bremenitev'}: {nextBillingDate?.toLocaleDateString('sl-SI')}</span>
                </div>
            )}
            
            <button 
              onClick={() => onSubscribe(plan.tier)}
              disabled={currentPlan === plan.tier || (!isVerified && plan.tier !== SubscriptionTier.FREE)}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${currentPlan === plan.tier ? 'bg-black/10 opacity-50 cursor-not-allowed' : (!isVerified && plan.tier !== SubscriptionTier.FREE ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white text-[#0A1128] hover:scale-105 shadow-xl')}`}
            >
              {!isVerified && plan.tier !== SubscriptionTier.FREE ? <><Lock size={18} /> {t('verifyAction')}</> : (currentPlan === plan.tier ? t('currentPlan') : t('subscribe'))}
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
