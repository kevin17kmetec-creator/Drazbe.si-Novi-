import React, { useEffect, useState } from 'react';
import { 
  Clock, Lock, CheckCircle2, AlertCircle, Image as ImageIcon,
  ChevronLeft, ChevronRight, Eye, MapPin, Info, Gavel, Truck,
  CreditCard, Landmark, Plus, X, Calendar as CalendarIcon, Phone, Mail
} from 'lucide-react';
import { getAuth } from 'firebase/auth';

const TimeBox = ({ value, label }: { value: number, label: string }) => (
  <div className="flex flex-col items-center justify-center bg-slate-200/50 rounded-xl w-14 h-14 md:w-16 md:h-16 border border-slate-200">
    <span className="text-xl md:text-2xl font-black text-[#0A1128] leading-none">{value.toString().padStart(2, '0')}</span>
    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{label}</span>
  </div>
);

export default function AuctionView({ item, onBack, onBidSubmit, t, language, isVerified }: { 
  item: any, 
  onBack: () => void, 
  onBidSubmit: (item: any, amount: number) => void,
  t: any,
  language: string,
  isVerified: boolean
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(item?.images?.[0] || null);
  
  useEffect(() => {
    if (item?.images?.[0]) {
      setSelectedImage(item.images[0]);
    }
  }, [item?.id]);
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!item || !item.endTime) return 0;
    const end = new Date(item.endTime).getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.floor((end - now) / 1000));
  });
  const [bidAmount, setBidAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!item || item.status !== 'active') return;

    const updateTimer = () => {
      const end = new Date(item.endTime).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [item?.endTime, item?.status]);

  const handlePlaceBid = async () => {
    if (!bidAmount || isNaN(Number(bidAmount))) return;
    setLoading(true);
    setError(null);
    
    try {
      await onBidSubmit(item, Number(bidAmount));
      setBidAmount('');
    } catch (err: any) {
      setError(err.message || 'Ponudba ni uspela.');
    }
    setLoading(false);
  };

  const handleCheckout = async () => {
    // Mock checkout for now
    alert("Preusmeritev na plačilo...");
  };

  if (!item) return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Nalagam dražbo...</div>;

  const isWinner = currentUser && item.winnerId === currentUser.uid;
  const isSeller = currentUser && item.sellerId === currentUser.uid;
  const isEnded = item.status === 'completed' || item.status === 'cancelled' || timeLeft === 0;

  const d = Math.floor(timeLeft / (3600 * 24));
  const h = Math.floor((timeLeft % (3600 * 24)) / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = Math.floor(timeLeft % 60);

  const auctionDate = item.endTime ? new Date(item.endTime) : new Date();
  const isValidDate = !isNaN(auctionDate.getTime());
  const title = item.title?.[language] || item.title?.['SLO'] || 'Dražba';
  const description = item.description?.[language] || item.description?.['SLO'] || 'Ni dodatnega opisa.';
  const location = item.location?.[language] || item.location?.['SLO'] || 'Slovenija';

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 bg-slate-50/50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-[#0A1128] transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
          <ChevronLeft size={16} /> Nazaj na seznam
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-[#0A1128] text-white p-4 flex items-center gap-4">
              <div className="bg-white text-[#0A1128] rounded-xl p-2 text-center min-w-[60px] shadow-inner">
                <div className="text-2xl font-black leading-none">{isValidDate ? auctionDate.getDate() : '-'}</div>
                <div className="text-[10px] font-black uppercase tracking-widest">{isValidDate ? auctionDate.toLocaleString('sl-SI', { month: 'short' }) : '-'}</div>
              </div>
              <div>
                <h3 className="font-black uppercase tracking-tight leading-tight text-sm">Splošna dražba opreme</h3>
                <p className="text-[10px] text-slate-300 flex items-center gap-1 mt-1 uppercase tracking-widest"><MapPin size={10}/> {location}</p>
              </div>
            </div>
            
            <div className="p-0">
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-[#FEBA4F] font-black uppercase tracking-widest text-xs mb-3">
                  <Info size={16} /> Informacije
                </div>
                {!isEnded ? (
                  <div className="text-center py-3 bg-green-50 text-green-700 font-black uppercase tracking-widest text-[10px] rounded-xl border border-green-200">
                    Oddaja ponudb možna
                  </div>
                ) : (
                  <div className="text-center py-3 bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px] rounded-xl border border-slate-200">
                    Dražba zaključena
                  </div>
                )}
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-[#0A1128] font-black uppercase tracking-widest text-xs mb-2">
                  <Gavel size={16} className="text-[#FEBA4F]" /> Zaključek
                </div>
                <p className="text-sm font-bold text-slate-600">
                  {isValidDate ? `${auctionDate.toLocaleDateString('sl-SI')} ob ${auctionDate.toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})}` : 'Neznano'}
                </p>
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-[#0A1128] font-black uppercase tracking-widest text-xs mb-2">
                  <Eye size={16} className="text-[#FEBA4F]" /> Ogled
                </div>
                <p className="text-sm font-bold text-slate-600">Po dogovoru s prodajalcem</p>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 text-[#0A1128] font-black uppercase tracking-widest text-xs mb-2">
                  <Truck size={16} className="text-[#FEBA4F]" /> Prevzem
                </div>
                <p className="text-sm font-bold text-slate-600">Po dogovoru s prodajalcem</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 text-[#0A1128] font-black uppercase tracking-widest text-xs">
                <MapPin size={16} className="text-[#FEBA4F]" /> Lokacija
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs font-bold text-slate-500 mb-4 leading-relaxed">
                Točna lokacija bo razkrita zmagovalcu dražbe po uspešnem plačilu.
              </p>
              <div className="w-full h-32 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-300 border border-slate-200">
                <MapPin size={24} className="mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest">Zemljevid skrit</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 text-[#0A1128] font-black uppercase tracking-widest text-xs">
                <Phone size={16} className="text-[#FEBA4F]" /> Kontakt
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm font-black text-[#0A1128]">Drazba.si Ekipa</p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><Phone size={14}/> +386 1 234 5678</p>
              <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><Mail size={14}/> info@drazba.si</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-6">
          <div className="flex justify-between items-start gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[#0A1128] leading-tight">{title}</h1>
            <button className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#FEBA4F] hover:bg-white transition-all min-w-[80px] shrink-0 group">
              <Eye size={20} className="text-slate-400 mb-1 group-hover:text-[#FEBA4F] transition-colors" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover:text-[#0A1128]">Opazuj</span>
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-center relative min-h-[300px] xl:min-h-[400px] shadow-sm">
                <div className="absolute bottom-4 left-4 bg-[#0A1128] text-white text-[10px] font-black px-3 py-2 rounded-xl uppercase tracking-widest shadow-lg text-center leading-tight">
                  Pos.Nr: <br/><span className="text-lg text-[#FEBA4F]">1</span>
                </div>
                {item.images && item.images.length > 0 ? (
                  <img src={selectedImage || item.images[0]} alt="Main" className="w-full h-full object-contain max-h-[400px]" />
                ) : (
                  <div className="text-center text-slate-300">
                    <ImageIcon size={64} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-black uppercase tracking-widest">Ni slike</p>
                  </div>
                )}
              </div>
              {item.images && item.images.length > 1 && (
                <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto md:w-24 shrink-0 pb-2 md:pb-0">
                  {item.images.map((img: string, idx: number) => (
                    <button 
                      key={idx} 
                      onClick={() => setSelectedImage(img)}
                      className={`w-20 md:w-full aspect-square bg-white border-2 rounded-xl overflow-hidden shrink-0 transition-all ${selectedImage === img || (!selectedImage && idx === 0) ? 'border-[#FEBA4F] shadow-md scale-105' : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'}`}
                    >
                      <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 flex flex-col w-full shadow-sm relative overflow-hidden">
              {isEnded && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center">
                  <CheckCircle2 size={48} className="text-green-500 mb-4" />
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0A1128] mb-2">Dražba zaključena</h3>
                  
                  {isWinner ? (
                    <>
                      <p className="text-slate-600 font-bold mb-6">Čestitamo, zmagali ste! Prosimo, dokončajte plačilo.</p>
                      <button 
                        onClick={handleCheckout}
                        disabled={loading}
                        className="w-full bg-[#FEBA4F] text-[#0A1128] px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-[#0A1128] hover:text-white transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Lock size={18} /> {loading ? 'Pripravljam...' : 'Plačaj s Stripe'}
                      </button>
                    </>
                  ) : isSeller ? (
                    <p className="text-slate-600 font-bold">Zmagovalec je bil obveščen in preusmerjen na plačilo.</p>
                  ) : (
                    <p className="text-slate-600 font-bold">Dražba se je končala. Niste zmagovalec.</p>
                  )}
                </div>
              )}

              <div className="flex justify-center items-center gap-2 mb-3">
                <TimeBox value={d} label="DNI" /> <span className="text-2xl font-black text-slate-300 mb-4">:</span>
                <TimeBox value={h} label="URE" /> <span className="text-2xl font-black text-slate-300 mb-4">:</span>
                <TimeBox value={m} label="MIN" /> <span className="text-2xl font-black text-slate-300 mb-4">:</span>
                <TimeBox value={s} label="SEK" />
              </div>
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">
                {isValidDate ? `${auctionDate.toLocaleDateString('sl-SI')}, ${auctionDate.toLocaleTimeString('sl-SI', {hour: '2-digit', minute:'2-digit'})} UHR` : 'Neznano'}
              </p>

              <div className="grid grid-cols-2 gap-y-8 gap-x-4 w-full mb-8">
                <div className="text-center border-r border-slate-100">
                  <p className="text-2xl font-black text-[#FEBA4F]">{item.bidCount || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Ponudb</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-[#0A1128]">€ {item.currentBid || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Začetna cena</p>
                </div>
                
                <div className="text-center border-r border-slate-100 pt-8 border-t">
                  <p className="text-2xl font-black text-slate-300">-</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 flex items-center justify-center gap-1"><Lock size={10}/> Moja max ponudba</p>
                </div>
                <div className="text-center pt-8 border-t border-slate-100">
                  <p className="text-4xl font-black text-[#FEBA4F]">€ {item.currentBid || 0}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Trenutna ponudba</p>
                </div>
              </div>

              {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] uppercase tracking-widest text-center border border-red-100">{error}</div>}

              {!isSeller && !isEnded && (
                <div className="flex flex-col sm:flex-row gap-3 w-full mt-auto">
                  <div className="relative flex-1">
                    <input 
                      type="number" 
                      value={bidAmount}
                      onChange={e => setBidAmount(e.target.value)}
                      placeholder={`€ ${(item.currentBid || 0) + 10}`}
                      className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 font-black text-xl outline-none focus:border-[#FEBA4F] text-center transition-colors"
                    />
                    <button 
                      onClick={() => setBidAmount(String(Math.max(Number(bidAmount || item.currentBid), item.currentBid) + 10))}
                      className="absolute right-2 top-2 bottom-2 aspect-square bg-white border border-slate-200 rounded-lg flex items-center justify-center hover:border-[#FEBA4F] hover:text-[#FEBA4F] text-slate-400 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <button 
                    onClick={handlePlaceBid}
                    disabled={loading}
                    className="h-14 px-8 bg-[#0A1128] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-lg disabled:opacity-50 sm:w-auto w-full"
                  >
                    {loading ? '...' : 'Ponudi'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">Opis</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 font-bold leading-relaxed whitespace-pre-line text-sm">
                  {description}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[#0A1128] font-black uppercase tracking-widest text-xs">Pristojbine in pogoji</h3>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Dražbena provizija:</p>
                  <p className="font-bold text-[#0A1128] text-sm">18 Odstotkov</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">DDV:</p>
                  <p className="font-bold text-[#0A1128] text-sm">22 Odstotkov</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pogoji dostave:</p>
                  <p className="font-bold text-slate-600 text-sm leading-relaxed">Osebni prevzem na lokaciji prodajalca. Pošiljanje ni mogoče, razen če je izrecno dogovorjeno.</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Možnosti plačila:</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><CreditCard size={16} className="text-[#FEBA4F]"/> Kreditna kartica</div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Landmark size={16} className="text-[#FEBA4F]"/> Nakazilo (SEPA)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
