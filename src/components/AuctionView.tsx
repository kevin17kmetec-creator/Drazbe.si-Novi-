import React, { useEffect, useState } from 'react';
import { 
  Clock, Lock, CheckCircle2, AlertCircle, Image as ImageIcon,
  ChevronLeft, ChevronRight, Eye, MapPin, Info, Gavel, Truck, Trophy,
  CreditCard, Landmark, Plus, Minus, X, Calendar as CalendarIcon, Phone, Mail, User,
  MessageSquare
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getIncrement } from '../lib/utils';

const TimeBox = ({ value, label }: { value: number, label: string }) => (
  <div className="flex flex-col items-center justify-center bg-white/10 rounded-xl w-14 h-14 md:w-16 md:h-16 border border-white/10">
    <span className="text-xl md:text-2xl font-black text-white leading-none">{value.toString().padStart(2, '0')}</span>
    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[#FEBA4F] mt-1">{label}</span>
  </div>
);

export default function AuctionView({ item, onBack, onBidSubmit, onCheckout, onSellerClick, t, language, isVerified, currentPlan, isWatched, onWatchToggle, currentUserId, onChatStart }: { 
  item: any, 
  onBack: () => void, 
  onBidSubmit: (item: any, amount: number) => Promise<"error" | "success" | "outbid" | "login_required" | "cancelled">,
  onCheckout: (item: any) => void,
  onSellerClick?: (sellerId: string) => void,
  t: any,
  language: string,
  isVerified: boolean,
  currentPlan: string,
  isWatched?: boolean,
  onWatchToggle?: () => void,
  currentUserId?: string,
  onChatStart?: () => void
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [signedImages, setSignedImages] = useState<string[]>([]);
  const [currentBid, setCurrentBid] = useState<number>(item?.currentBid || item?.current_price || 0);
  const [endTime, setEndTime] = useState<Date>(item?.endTime ? new Date(item.endTime) : new Date());
  const [bidCount, setBidCount] = useState<number>(item?.bidCount || item?.bid_count || 0);
  
  useEffect(() => {
    setCurrentBid(item?.currentBid || item?.current_price || 0);
    setEndTime(item?.endTime ? new Date(item.endTime) : new Date());
    setBidCount(item?.bidCount || item?.bid_count || 0);
  }, [item]);

  useEffect(() => {
    if (!item?.images) return;
    const urls = item.images.map((imgPath: string) => {
      if (imgPath.startsWith('http') || imgPath.startsWith('blob:') || imgPath.startsWith('data:')) return imgPath;
      const { data } = supabase.storage.from('auction-images').getPublicUrl(imgPath);
      return data.publicUrl || imgPath;
    });
    setSignedImages(urls);
    if (urls.length > 0) setSelectedImage(urls[0]);
  }, [item?.images]);

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const end = endTime.getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.floor((end - now) / 1000));
  });
  const [bidAmount, setBidAmount] = useState<string>(String((item?.currentBid || 0) + getIncrement(item?.currentBid || 0)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bidSuccess, setBidSuccess] = useState(false);

  useEffect(() => {
    try {
      supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user)).catch(err => console.error("Error getting user in AuctionView:", err));
    } catch (err) {
      console.error("Supabase auth error in AuctionView:", err);
    }
  }, []);

  useEffect(() => {
    if (!item || item.status !== 'active') return;
    const updateTimer = () => {
      const end = endTime.getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        updateTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVis);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVis);
    };
  }, [endTime, item?.status]);

  useEffect(() => {
    if (Number(bidAmount) < currentBid + getIncrement(currentBid)) {
      setBidAmount(String(currentBid + getIncrement(currentBid)));
    }
  }, [currentBid]);

  const handlePlaceBid = async () => {
    if (!bidAmount || isNaN(Number(bidAmount))) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await onBidSubmit(item, Number(bidAmount));
      if (result === 'success') {
          setBidAmount('');
          setBidSuccess(true);
          setTimeout(() => setBidSuccess(false), 3000);
      } else if (result === 'outbid') {
          setError(t('bidOutbid'));
      } else if (result === 'error') {
          setError(t('bidError'));
      }
    } catch (err: any) {
      setError(err.message || t('bidFailed'));
    }
    setLoading(false);
  };

  const handleCheckout = async () => {
    onCheckout(item);
  };

  if (!item) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">{t('loading')}...</div>;

  const isWinner = currentUserId && (item.winnerId === currentUserId || item.winner_id === currentUserId);
  const isSeller = currentUserId && (item.sellerId === currentUserId || item.seller_id === currentUserId);
  const isEnded = item.status === 'completed' || item.status === 'cancelled' || timeLeft === 0;

  const d = Math.floor(timeLeft / (3600 * 24));
  const h = Math.floor((timeLeft % (3600 * 24)) / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = Math.floor(timeLeft % 60);

  const auctionDate = endTime;
  const isValidDate = !isNaN(auctionDate.getTime());
  const title = item.title?.[language] || item.title?.['SLO'] || t('auctionFallback');
  const description = item.description?.[language] || item.description?.['SLO'] || t('noDescription');
  const location = item.location?.[language] || item.location?.['SLO'] || t('slovenia');

  const feePercentage = currentPlan === 'FREE' ? 12 : currentPlan === 'BASIC' ? 10 : 5;

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 bg-slate-50/50 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-[#0A1128] transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
          <ChevronLeft size={16} /> {t('backToList')}
        </button>
      </div>

      <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-slate-100 p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 order-1">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[#0A1128] leading-tight">{title}</h1>
                  {isWinner && (
                    <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest text-green-600 w-fit animate-pulse">
                      <Trophy size={12} /> {t('leading') || 'Vodilni'}
                    </div>
                  )}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onWatchToggle?.(); }}
                  className={`flex flex-col items-center justify-center p-3 border rounded-2xl transition-all min-w-[80px] shrink-0 group ${isWatched ? 'bg-[#FEBA4F] border-[#FEBA4F]' : 'bg-slate-50 border-slate-200 hover:border-[#FEBA4F] hover:bg-white'}`}
                >
                  <Eye size={20} className={`${isWatched ? 'text-[#0A1128]' : 'text-slate-400 group-hover:text-[#FEBA4F]'} transition-colors`} fill={isWatched ? 'currentColor' : 'none'} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isWatched ? 'text-[#0A1128]' : 'text-slate-500 group-hover:text-[#0A1128]'}`}>{t('watch')}</span>
                </button>
              </div>

              <div className="flex gap-4">
                {signedImages.length > 1 && (
                  <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] scrollbar-hide">
                    {signedImages.map((img: string, idx: number) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedImage(img)}
                        className={`w-20 h-20 aspect-square bg-white border-2 rounded-xl overflow-hidden shrink-0 transition-all ${selectedImage === img || (!selectedImage && idx === 0) ? 'border-[#FEBA4F] shadow-lg scale-105' : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'}`}
                      >
                        <img src={img} alt={`Thumb ${idx}`} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex-1 bg-white border border-slate-200 rounded-[2rem] p-4 flex items-center justify-center relative min-h-[400px] md:min-h-[500px] shadow-sm overflow-hidden group">
                  {signedImages.length > 0 ? (
                    <>
                      <img 
                        src={selectedImage || signedImages[0]} 
                        alt="Main" 
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain max-h-[500px] cursor-pointer" 
                        onClick={() => setLightboxImage(selectedImage || signedImages[0])}
                      />
                      {signedImages.length > 1 && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); const idx = signedImages.indexOf(selectedImage || signedImages[0]); setSelectedImage(signedImages[(idx - 1 + signedImages.length) % signedImages.length]); }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/50 hover:bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronLeft size={24} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); const idx = signedImages.indexOf(selectedImage || signedImages[0]); setSelectedImage(signedImages[(idx + 1) % signedImages.length]); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/50 hover:bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight size={24} />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-slate-300">
                      <ImageIcon size={60} className="mx-auto mb-4 opacity-50" />
                      <p className="text-xs font-black uppercase tracking-widest">{t('loadingImages')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 order-2 space-y-6">
            <div className="bg-[#0A1128] text-white border border-white/5 rounded-[2rem] p-5 flex flex-col w-full shadow-2xl relative overflow-hidden">
              {isEnded && (
                <div className="absolute inset-0 bg-[#0A1128]/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center">
                  <CheckCircle2 size={48} className="text-green-500 mb-4" />
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">{t('auctionEnded')}</h3>
                  <div className="bg-white/10 rounded-2xl px-6 py-4 mb-6 border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Končna cena</p>
                    <p className="text-3xl font-black text-[#FEBA4F]">€ {item.currentBid?.toLocaleString('sl-SI') || 0}</p>
                  </div>
                  
                  {isWinner ? (
                    <>
                      <p className="text-slate-300 font-bold mb-6">{t('winnerNotice')}</p>
                      <button 
                        onClick={handleCheckout}
                        disabled={loading}
                        className="w-full bg-[#FEBA4F] text-[#0A1128] px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
                      >
                        <Lock size={18} /> {loading ? '...' : t('payNow')}
                      </button>
                      <button 
                        onClick={onChatStart}
                        className="w-full bg-slate-800 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700"
                      >
                        <MessageSquare size={18} /> Začni pogovor s prodajalcem
                      </button>
                    </>
                  ) : isSeller ? (
                    <>
                      <p className="text-slate-300 font-bold mb-4">{t('sellerWinnerNotice')}</p>
                      <button 
                        onClick={onChatStart}
                        className="w-full bg-slate-800 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-slate-700"
                      >
                        <MessageSquare size={18} /> Začni pogovor s kupcem
                      </button>
                    </>
                  ) : (
                    <p className="text-slate-300 font-bold">{t('notWinnerNotice')}</p>
                  )}
                </div>
              )}

              <div className="flex justify-center items-center gap-2 mb-2">
                <TimeBox value={d} label={t('days')} /> <span className="text-2xl font-black text-slate-500 mb-4">:</span>
                <TimeBox value={h} label={t('hours')} /> <span className="text-2xl font-black text-slate-500 mb-4">:</span>
                <TimeBox value={m} label={t('minutes')} /> <span className="text-2xl font-black text-slate-500 mb-4">:</span>
                <TimeBox value={s} label={t('seconds')} />
              </div>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                {isValidDate ? `${auctionDate.toLocaleDateString('sl-SI')}, ${auctionDate.toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})} ${t('uhr')}` : t('unknown')}
              </p>

              <div className="grid grid-cols-2 gap-y-4 gap-x-4 w-full mb-4">
                <div className="text-center border-r border-white/10">
                  <p className="text-2xl font-black text-[#FEBA4F]">{item.bidCount || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{t('bidCount')}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-white">€ {item.currentBid || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{t('startingPrice')}</p>
                </div>
                
                <div className="text-center border-r border-white/10 pt-4 border-t">
                  <p className="text-2xl font-black text-green-400">{isWinner ? `€ ${item.hiddenMaxBid || item.hidden_max_bid || '-'}` : '-'}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 flex items-center justify-center gap-1"><Lock size={10}/> {t('myMaxBid')}</p>
                </div>
                <div className="text-center pt-4 border-t border-white/10">
                  <p className="text-4xl font-black text-[#FEBA4F]">€ {item.currentBid || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{t('currentBid')}</p>
                </div>
              </div>

              {error && <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded-xl font-bold text-[10px] uppercase tracking-widest text-center border border-red-500/20">{error}</div>}
              {bidSuccess && <div className="mb-4 p-3 bg-green-500/10 text-green-400 rounded-xl font-bold text-[10px] uppercase tracking-widest text-center border border-green-500/20">{t('bidSuccessMsg')}</div>}

              {!isSeller && !isEnded && (
                <div className="flex flex-col gap-3 w-full mt-auto">
                  <div className="relative flex-1">
                    <button 
                      onClick={() => setBidAmount(String(Math.max(Number(bidAmount || item.currentBid) - 10, item.currentBid + 10)))}
                      className="absolute left-2 top-2 bottom-2 aspect-square bg-white/10 border border-white/10 rounded-lg flex items-center justify-center hover:border-[#FEBA4F] hover:text-[#FEBA4F] text-slate-400 transition-colors"
                    >
                      <Minus size={20} />
                    </button>
                    <input 
                      type="text" 
                      value={`€ ${bidAmount}`}
                      readOnly
                      className="w-full h-14 bg-white/5 border-2 border-white/10 rounded-xl px-14 font-black text-xl text-white outline-none focus:border-[#FEBA4F] text-center transition-colors"
                    />
                    <button 
                      onClick={() => setBidAmount(String(Math.max(Number(bidAmount || item.currentBid), item.currentBid) + 10))}
                      className="absolute right-2 top-2 bottom-2 aspect-square bg-white/10 border border-white/10 rounded-lg flex items-center justify-center hover:border-[#FEBA4F] hover:text-[#FEBA4F] text-slate-400 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <button 
                    onClick={handlePlaceBid}
                    disabled={loading}
                    className="h-14 px-8 bg-[#FEBA4F] text-[#0A1128] rounded-xl font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg disabled:opacity-50 w-full"
                  >
                    {loading ? '...' : t('placeBid')}
                  </button>
                </div>
              )}
            </div>

          </div>

          <div className="lg:col-span-8 order-3 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">{t('description')}</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 font-bold leading-relaxed whitespace-pre-line text-sm">
                  {description}
                </p>
              </div>
            </div>

            {!isEnded && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">{t('biddingHistory')}</h3>
              </div>
              <div className="p-0">
                {item.bidding_history && item.bidding_history.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {[...item.bidding_history].reverse().map((bid: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                            <User size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-[#0A1128]">
                              {(bid.userId || bid.bidderId) === currentUserId ? t('you') : `${t('bidder')} ${(bid.userId || bid.bidderId)?.substring(0, 4) || 'Unknown'}...`}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">
                              {new Date(bid.timestamp).toLocaleString('sl-SI')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-[#FEBA4F]">€ {bid.amount.toLocaleString('sl-SI')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 font-bold text-sm">
                    {t('noBidsYet')}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>

          <div className="lg:col-span-4 order-4">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">{t('information')}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('seller')}:</p>
                  <button 
                    onClick={() => item.sellerId && onSellerClick?.(item.sellerId)}
                    className="text-sm font-black text-[#FEBA4F] hover:underline"
                  >
                    {item.sellerName || t('unknown')}
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('region')}:</p>
                  <p className="text-sm font-bold text-[#0A1128]">{item.region}</p>
                </div>
                {item.condition && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('condition')}:</p>
                  <p className="text-sm font-bold text-[#0A1128]">{typeof item.condition === 'string' ? item.condition : item.condition[language] || item.condition['SLO']}</p>
                </div>
                )}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('feesAndTerms')}:</p>
                  <p className="font-bold text-[#0A1128] text-sm">{feePercentage} {t('percent')} {t('auctionFee')}</p>
                  <p className="font-bold text-[#0A1128] text-sm">22 {t('percent')} {t('vat')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
