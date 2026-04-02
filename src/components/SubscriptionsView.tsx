import React from 'react';
import { Lock } from 'lucide-react';
import { SubscriptionTier } from '../../types.ts';

export const SubscriptionsView: React.FC<{ t: any; currentPlan: SubscriptionTier; onSubscribe: (tier: SubscriptionTier) => void; isVerified: boolean }> = ({ t, currentPlan, onSubscribe, isVerified }) => {
  const plans = [
    { tier: SubscriptionTier.FREE, name: t('freeTier'), price: 0, desc: t('freeDesc'), color: 'bg-slate-100 text-slate-600' },
    { tier: SubscriptionTier.BASIC, name: t('basicTier'), price: 20, desc: t('basicDesc'), color: 'bg-[#FEBA4F] text-[#0A1128]' },
    { tier: SubscriptionTier.PRO, name: t('proTier'), price: 50, desc: t('proDesc'), color: 'bg-[#0A1128] text-white' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-12">{t('subscriptions')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan.tier} className={`rounded-[3rem] p-10 flex flex-col ${plan.color} ${currentPlan === plan.tier ? 'ring-4 ring-offset-4 ring-[#FEBA4F]' : ''}`}>
            {currentPlan === plan.tier && <div className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-80">{t('currentPlan')}</div>}
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">{plan.name}</h3>
            <div className="text-5xl font-black mb-6">€{plan.price}<span className="text-lg opacity-60">/mo</span></div>
            <p className="font-bold opacity-80 mb-10 flex-1">{plan.desc}</p>
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
    </div>
  );
};
