import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AuctionItem, SubscriptionTier } from '../../types';

export const ConfirmBidModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  item: AuctionItem;
  initialBidAmount: number;
  currentPlan: SubscriptionTier;
  t: any;
  onConfirm: (amount: number) => Promise<void>;
}> = ({ isOpen, onClose, item, initialBidAmount, currentPlan, t, onConfirm }) => {
  const [bidAmount, setBidAmount] = useState<string>(initialBidAmount.toString());
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    setBidAmount(initialBidAmount.toString());
  }, [initialBidAmount, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const updateTime = () => {
      const diff = Math.max(0, Math.floor((new Date(item.endTime).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [item.endTime, isOpen]);

  if (!isOpen) return null;

  const feePercentage = currentPlan === SubscriptionTier.PRO ? 5 : currentPlan === SubscriptionTier.BASIC ? 10 : 12;

  const d = Math.floor(timeLeft / (3600 * 24));
  const h = Math.floor((timeLeft % (3600 * 24)) / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = Math.floor(timeLeft % 60);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(Number(bidAmount));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0A1128]/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-in">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-0 right-0 bg-[#0099C8] text-white p-3 hover:bg-[#007A9F] transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="p-6 pt-12">
          <div className="flex justify-center gap-2 mb-6">
            <div className="flex flex-col items-center justify-center bg-slate-200 rounded-lg w-12 h-12 border border-slate-300 shadow-inner">
              <span className="text-lg font-black text-slate-600 leading-none">{d.toString().padStart(2, '0')}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">{t('days')}</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-200 rounded-lg w-12 h-12 border border-slate-300 shadow-inner">
              <span className="text-lg font-black text-slate-600 leading-none">{h.toString().padStart(2, '0')}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">{t('hours')}</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-200 rounded-lg w-12 h-12 border border-slate-300 shadow-inner">
              <span className="text-lg font-black text-slate-600 leading-none">{m.toString().padStart(2, '0')}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">{t('minutes')}</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-slate-200 rounded-lg w-12 h-12 border border-slate-300 shadow-inner">
              <span className="text-lg font-black text-slate-600 leading-none">{s.toString().padStart(2, '0')}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">{t('seconds')}</span>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            {t('bidTermsAccept')}
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-[#0099C8] font-bold text-lg">{t('yourBid') || 'Vaša ponudba'}</span>
              <span className="text-[#0099C8] font-bold text-lg">€ {Number(bidAmount).toLocaleString('sl-SI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 text-sm">
              <span>{t('auctionFeeLabel')} {feePercentage}%</span>
              <span>€ {(Number(bidAmount) * (feePercentage / 100)).toLocaleString('sl-SI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 text-sm">
              <span>{t('vatLabel')} 0%</span>
              <span>€ 0,00</span>
            </div>
          </div>

          <div className="border-t border-slate-300 pt-2 mb-2">
            <div className="flex justify-between items-center font-bold text-lg text-[#0A1128]">
              <span>{t('totalSum')}</span>
              <span>€ {(Number(bidAmount) * (1 + feePercentage / 100)).toLocaleString('sl-SI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>

          <div className="border-t border-slate-300 pt-2 mb-6">
            <p className="text-xs text-slate-500">{t('marginScheme')}</p>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0099C8] font-bold">€</span>
              <input 
                type="number" 
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-[#0099C8] outline-none focus:border-[#0099C8]"
              />
            </div>
            <button 
              onClick={handleConfirm}
              disabled={loading}
              className="flex-[2] bg-[#0099C8] text-white font-bold py-3 px-4 rounded-lg hover:bg-[#007A9F] transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t('confirmBidBtn')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
