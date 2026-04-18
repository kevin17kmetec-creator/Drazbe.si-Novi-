import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronLeft, ChevronRight, Clock, Eye, Building2, Minus, Plus, Lock, Trophy } from 'lucide-react';
import { AuctionItem, Seller } from '../../types.ts';
import { MOCK_SELLERS } from '../../data.ts';
import { supabase } from '../lib/supabaseClient';
import { getIncrement, formatSeconds } from '../lib/utils';

export const AuctionCard: React.FC<{
  item: AuctionItem;
  t: any;
  language: string;
  isVerified: boolean;
  currentUserId?: string;
  hasBid?: boolean;
  isWatched: boolean;
  onWatchToggle: () => void;
  onClick: () => void;
  onBidSubmit: (item: AuctionItem, amount: number) => Promise<'success' | 'outbid' | 'error' | 'login_required' | 'cancelled'> | void;
  onSellerClick: (seller: Seller) => void;
  onTimeUp?: (auctionId: string) => void;
}> = ({ item, t, language, isVerified, currentUserId, hasBid, isWatched, onWatchToggle, onClick, onBidSubmit, onSellerClick, onTimeUp }) => {
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [signedImages, setSignedImages] = useState<string[]>([]);
  const seller = MOCK_SELLERS.find(s => s.id === item.sellerId);
  const minNextBid = item.currentBid + getIncrement(item.currentBid);
  const [bidValue, setBidValue] = useState(minNextBid);
  const [bidStatus, setBidStatus] = useState<'success' | 'outbid' | 'error' | null>(null);
  const [isBidding, setIsBidding] = useState(false);
  const isWinner = currentUserId && (item.winnerId === currentUserId || item.winner_id === currentUserId);
  const hasEndedFiredRef = useRef(false);

  useEffect(() => {
    const fetchImages = async () => {
      if (!item?.images) return;
      try {
        const urls = await Promise.all(item.images.map(async (imgPath: string) => {
          if (imgPath.startsWith('http')) return imgPath;
          const { data, error } = await supabase.storage.from('auction-images').createSignedUrl(imgPath, 3600);
          if (error) throw error;
          return data?.signedUrl || imgPath;
        }));
        setSignedImages(urls);
      } catch (err) {
        console.error("Error fetching signed images:", err);
        // Fallback to original paths if signed URLs fail
        setSignedImages(item.images);
      }
    };
    fetchImages();
  }, [item?.images]);

  useEffect(() => { setBidValue(item.currentBid + getIncrement(item.currentBid)); }, [item.currentBid]);
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((item.endTime.getTime() - Date.now()) / 1000));
      setTimeLeftStr(formatSeconds(diff));
      
      if (diff === 0 && !hasEndedFiredRef.current) {
        hasEndedFiredRef.current = true;
        if (onTimeUp) {
            setTimeout(() => {
                onTimeUp(item.id);
            }, 1000);
        }
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [item.endTime, item.id, onTimeUp]);

  const handleAdjustBid = (dir: 'up' | 'down') => {
    const step = getIncrement(bidValue);
    setBidValue(prev => dir === 'up' ? prev + step : Math.max(minNextBid, prev - step));
  };

  const handleBidClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBidStatus(null);
    setIsBidding(true);
    const result = await onBidSubmit(item, bidValue);
    setIsBidding(false);
    if (result === 'success' || result === 'outbid' || result === 'error') {
        setBidStatus(result);
        setTimeout(() => setBidStatus(null), 4000);
    }
  };

  // Border logic
  let borderClass = "border-white/5";
  if (hasBid) {
    borderClass = isWinner ? "border-green-500 border-2 ring-4 ring-green-500/20" : "border-red-500 border-2 ring-4 ring-red-500/20";
  }

  return (
    <div className={`bg-[#0A1128] rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group flex flex-col h-[540px] border relative ${borderClass}`}>
      <div className="relative h-52 overflow-hidden cursor-pointer group/image" onClick={onClick}>
        <img 
          src={signedImages[currentImageIndex] || item.images[currentImageIndex]} 
          alt={item.title[language] || item.title['SLO']} 
          loading="lazy" 
          referrerPolicy="no-referrer" 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" 
        />
        {(signedImages.length > 1 || item.images.length > 1) && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev - 1 + (signedImages.length || item.images.length)) % (signedImages.length || item.images.length)); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-white/30 hover:bg-white/60 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
            >
                <ChevronLeft size={16} className="text-white" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev + 1) % (signedImages.length || item.images.length)); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-white/30 hover:bg-white/60 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
            >
                <ChevronRight size={16} className="text-white" />
            </button>
          </>
        )}
        <div className="absolute top-4 left-4 bg-[#0A1128]/90 backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg flex items-center gap-1.5 border border-white/10">
          <MapPin size={10} className="text-[#FEBA4F]" /> {item.location[language] || item.location['SLO']}
        </div>
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onWatchToggle(); }}
            className={`p-2 rounded-xl backdrop-blur-sm shadow-lg border transition-all ${isWatched ? 'bg-[#FEBA4F] border-[#FEBA4F] text-[#0A1128]' : 'bg-[#0A1128]/90 border-white/10 text-white hover:bg-white/10'}`}
          >
            <Eye size={14} fill={isWatched ? 'currentColor' : 'none'} />
          </button>
          <div className="bg-[#FEBA4F] text-[#0A1128] backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg">
            {item.region}
          </div>
          <div className="bg-white/10 text-white backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg border border-white/10">
            {item.category}
          </div>
          {item.condition && (
          <div className="bg-white/10 text-white backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg border border-white/10">
            {typeof item.condition === 'string' ? item.condition : item.condition[language] || item.condition['SLO']}
          </div>
          )}
          {isWinner && (
            <div className="bg-green-500 text-white backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 border border-green-400/50 animate-pulse">
              <Trophy size={10} /> {t('leading') || 'Vodilni'}
            </div>
          )}
        </div>
      </div>
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-3 flex justify-between items-center">
            {(seller || item.sellerName) && (
                <button onClick={(e) => { e.stopPropagation(); if (seller) onSellerClick(seller); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#FEBA4F] transition-colors flex items-center gap-1.5">
                    <Building2 size={12} /> {seller ? (seller.name[language] || seller.name['SLO']) : item.sellerName}
                </button>
            )}
        </div>
        <h3 className="text-lg font-black leading-tight text-white hover:text-[#FEBA4F] transition-colors line-clamp-2 cursor-pointer mb-4" onClick={onClick}>{item.title[language] || item.title['SLO']}</h3>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-white/5 p-2 rounded-lg text-[#FEBA4F] border border-white/10"><Clock size={14} /></div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white">
            <span className="text-slate-400 block">{t('timeLeft')}</span>
            <span className="text-[#FEBA4F] tabular-nums text-sm">{timeLeftStr}</span>
          </div>
        </div>
        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('currentBid')}</p>
              <p className="text-xl font-black text-[#FEBA4F]">€{item.currentBid.toLocaleString('sl-SI')}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('bidCount')}</p>
              <p className="text-sm font-black text-[#FEBA4F]">{item.bidCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full relative">
             <div className="flex items-center bg-white/5 rounded-2xl border border-white/10 p-1 flex-[3]">
                <button onClick={(e) => { e.stopPropagation(); handleAdjustBid('down'); }} className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex-shrink-0"><Minus size={14}/></button>
                <div className="flex-1 flex items-center justify-center px-1">
                    <span className="text-[#FEBA4F] font-black text-lg mr-1">€</span>
                    <input type="text" value={bidValue} readOnly className="w-full bg-transparent text-center text-white font-black text-lg outline-none tabular-nums" />
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleAdjustBid('up'); }} className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex-shrink-0"><Plus size={14}/></button>
             </div>
             <button onClick={handleBidClick} disabled={isBidding} className={`h-12 flex-1 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap ${isVerified ? 'bg-[#FEBA4F] text-[#0A1128] hover:bg-white' : 'bg-slate-800 text-slate-500'} ${isBidding ? 'opacity-75 cursor-not-allowed' : ''}`}>
                {isBidding ? <div className="w-4 h-4 border-2 border-[#0A1128]/30 border-t-[#0A1128] rounded-full animate-spin" /> : (!isVerified ? <Lock size={14} /> : t('placeBid'))}
             </button>
             
             {/* Inline Feedback */}
             {bidStatus && (
                 <div className={`absolute -top-12 left-0 right-0 flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-300 z-10`}>
                     <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl border ${
                         bidStatus === 'success' ? 'bg-green-500/90 text-white border-green-400/50' :
                         bidStatus === 'outbid' ? 'bg-orange-500/90 text-white border-orange-400/50' :
                         'bg-red-500/90 text-white border-red-400/50'
                     }`}>
                         {bidStatus === 'success' ? t('bidSuccessMsg') :
                          bidStatus === 'outbid' ? t('bidOutbid') :
                          t('bidError')}
                     </div>
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
