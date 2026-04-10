import React, { useState, useMemo } from 'react';
import { Search, Globe, ChevronDown, User, PlusCircle, Trophy, Eye, CreditCard, Settings, LogOut, ChevronRight, Gavel, MessageSquare } from 'lucide-react';
import { ViewState, Region, Category, AuctionItem } from '../../types.ts';

export const Header: React.FC<{ 
  onHome: () => void;
  onSearch: (val: string) => void;
  onRegionSelect: (reg: Region | null) => void;
  onCategorySelect: (cat: Category | null) => void;
  onLastChance: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onSettings: () => void;
  onSubscriptions: () => void;
  onCreateAuction: () => void;
  onMyWinnings: () => void;
  onMyBids: () => void;
  onChat: () => void;
  onWatchlist: () => void;
  activeView: ViewState;
  selectedRegion: Region | null;
  selectedCategory: Category | null;
  isLoggedIn: boolean;
  isVerified: boolean;
  language: string;
  onLanguageChange: (l: string) => void;
  t: (k: string) => string;
  auctions: AuctionItem[];
  userEmail?: string;
}> = ({ onHome, onSearch, onRegionSelect, onCategorySelect, onLastChance, onLogin, onLogout, onSettings, onSubscriptions, onCreateAuction, onMyWinnings, onMyBids, onChat, onWatchlist, activeView, selectedRegion, selectedCategory, isLoggedIn, isVerified, language, onLanguageChange, t, auctions, userEmail }) => {
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const languages = [
      { code: 'SLO', label: 'Slovenščina' },
      { code: 'EN', label: 'English' },
      { code: 'DE', label: 'Deutsch' }
  ];

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(Region).forEach(r => counts[r] = 0);
    auctions.filter(a => a.status === 'active').forEach(a => {
      if (counts[a.region] !== undefined) counts[a.region]++;
    });
    return counts;
  }, [auctions]);

  // Detailed Slovenia Map Paths (8 regions)
  const sloMapRegions = [
    { id: Region.Prekmurje, path: "M 850.0,150.0 L 862.4,142.3 L 874.9,134.9 L 887.6,127.7 L 900.0,120.0 L 912.2,114.1 L 924.2,107.9 L 937.0,103.6 L 950.0,100.0 L 956.9,105.9 L 964.2,111.1 L 972.3,115.2 L 980.0,120.0 L 970.7,134.1 L 962.2,148.6 L 956.2,164.3 L 950.0,180.0 L 937.6,185.2 L 925.5,191.3 L 912.8,195.6 L 900.0,200.0 L 887.0,212.0 L 873.0,223.0 L 861.3,236.3 L 850.0,250.0 L 837.8,258.0 L 825.9,266.5 L 812.9,273.2 L 800.0,280.0 L 806.2,265.4 L 811.0,250.3 L 815.8,235.3 L 820.0,220.0 L 828.7,203.0 L 837.5,186.1 L 843.3,167.9 L 850.0,150.0 Z", labelPos: { x: 890, y: 160 } },
    { id: Region.Stajerska, path: "M 800.0,280.0 L 787.1,297.3 L 772.8,313.4 L 761.4,331.7 L 750.0,350.0 L 738.7,363.7 L 726.5,376.5 L 713.3,388.3 L 700.0,400.0 L 686.6,411.6 L 674.2,424.2 L 662.6,437.6 L 650.0,450.0 L 638.3,436.7 L 626.2,423.8 L 613.3,411.6 L 600.0,400.0 L 586.3,411.2 L 572.7,422.7 L 561.3,436.3 L 550.0,450.0 L 538.3,436.6 L 527.1,422.9 L 513.0,412.0 L 500.0,400.0 L 486.6,388.4 L 473.3,376.7 L 461.5,363.5 L 450.0,350.0 L 463.9,339.0 L 476.8,326.8 L 488.3,313.3 L 500.0,300.0 L 512.3,287.3 L 524.7,274.7 L 537.0,262.0 L 550.0,250.0 L 562.5,237.5 L 575.6,225.6 L 587.8,212.8 L 600.0,200.0 L 613.6,188.7 L 626.2,176.2 L 638.2,163.2 L 650.0,150.0 L 662.4,142.3 L 675.2,135.4 L 687.4,127.4 L 700.0,120.0 L 712.1,109.5 L 723.4,98.0 L 737.0,89.4 L 750.0,80.0 L 762.7,84.5 L 775.4,89.0 L 787.7,94.5 L 800.0,100.0 L 805.2,130.0 L 812.5,159.6 L 816.6,189.7 L 820.0,220.0 L 813.9,234.6 L 809.0,249.7 L 804.2,264.7 L 800.0,280.0 Z", labelPos: { x: 680, y: 260 } },
    { id: Region.Koroska, path: "M 500.0,80.0 L 512.9,84.0 L 525.9,87.8 L 538.1,93.6 L 550.0,100.0 L 562.1,106.0 L 574.5,111.3 L 587.1,116.2 L 600.0,120.0 L 612.9,126.8 L 625.1,134.8 L 637.7,142.2 L 650.0,150.0 L 637.8,162.8 L 625.8,175.8 L 613.1,188.1 L 600.0,200.0 L 586.7,211.7 L 573.3,223.3 L 562.3,237.2 L 550.0,250.0 L 538.4,236.7 L 526.2,223.8 L 513.0,212.0 L 500.0,200.0 L 487.1,187.8 L 473.1,176.9 L 461.3,163.6 L 450.0,150.0 L 463.2,133.0 L 475.6,115.5 L 486.9,97.1 L 500.0,80.0 Z", labelPos: { x: 550, y: 150 } },
    { id: Region.Gorenjska, path: "M 150.0,200.0 L 163.2,188.2 L 176.3,176.3 L 188.2,163.2 L 200.0,150.0 L 211.5,140.9 L 223.7,132.8 L 237.2,127.1 L 250.0,120.0 L 262.7,127.2 L 275.3,134.5 L 287.6,142.4 L 300.0,150.0 L 312.9,143.1 L 325.3,135.5 L 337.5,127.4 L 350.0,120.0 L 363.0,116.2 L 375.9,112.3 L 388.3,106.7 L 400.0,100.0 L 412.9,103.9 L 425.7,108.2 L 437.7,114.5 L 450.0,120.0 L 462.5,110.0 L 474.9,99.9 L 487.7,90.2 L 500.0,80.0 L 488.4,98.1 L 476.2,115.8 L 463.2,133.0 L 450.0,150.0 L 437.3,162.3 L 424.9,174.9 L 412.8,187.8 L 400.0,200.0 L 387.7,212.7 L 375.0,225.0 L 362.2,237.2 L 350.0,250.0 L 338.0,263.0 L 325.5,275.5 L 313.1,288.1 L 300.0,300.0 L 286.8,288.2 L 274.3,275.7 L 262.7,262.3 L 250.0,250.0 L 237.0,262.0 L 225.2,275.2 L 212.2,287.1 L 200.0,300.0 L 188.0,287.0 L 175.5,274.5 L 162.8,262.2 L 150.0,250.0 L 151.0,237.5 L 151.6,225.0 L 150.9,212.5 L 150.0,200.0 Z", labelPos: { x: 330, y: 180 } },
    { id: Region.Osrednjeslovenska, path: "M 350.0,250.0 L 361.9,236.9 L 373.9,223.9 L 386.7,211.7 L 400.0,200.0 L 413.0,188.0 L 425.8,175.8 L 438.1,163.1 L 450.0,150.0 L 462.6,162.5 L 476.2,173.8 L 488.1,186.9 L 500.0,200.0 L 513.2,211.8 L 525.8,224.2 L 537.8,237.2 L 550.0,250.0 L 537.4,262.5 L 524.0,274.0 L 512.0,287.0 L 500.0,300.0 L 486.3,311.2 L 473.1,323.1 L 461.0,336.1 L 450.0,350.0 L 437.0,362.0 L 424.6,374.6 L 412.7,387.7 L 400.0,400.0 L 388.5,386.6 L 376.2,373.8 L 362.7,362.3 L 350.0,350.0 L 336.7,361.8 L 322.7,372.7 L 311.3,386.3 L 300.0,400.0 L 287.8,387.2 L 276.4,373.6 L 263.6,361.4 L 250.0,350.0 L 263.7,338.7 L 277.1,327.1 L 289.2,314.1 L 300.0,300.0 L 311.9,286.9 L 324.2,274.2 L 336.8,261.8 L 350.0,250.0 Z", labelPos: { x: 400, y: 300 } },
    { id: Region.Dolenjska, path: "M 500.0,400.0 L 511.6,413.3 L 523.4,426.6 L 536.6,438.4 L 550.0,450.0 L 563.1,438.2 L 575.4,425.4 L 588.1,413.1 L 600.0,400.0 L 613.4,411.6 L 625.8,424.2 L 637.3,437.7 L 650.0,450.0 L 639.1,464.1 L 627.1,477.1 L 613.3,488.2 L 600.0,500.0 L 612.3,512.7 L 624.0,526.0 L 636.8,538.2 L 650.0,550.0 L 635.9,560.8 L 622.8,572.8 L 610.9,586.0 L 600.0,600.0 L 586.0,610.9 L 572.6,622.6 L 560.6,635.7 L 550.0,650.0 L 538.4,636.6 L 526.9,623.1 L 513.5,611.5 L 500.0,600.0 L 488.8,613.7 L 477.1,627.1 L 463.0,637.9 L 450.0,650.0 L 438.6,636.4 L 427.0,623.0 L 414.0,610.9 L 400.0,600.0 L 412.8,587.8 L 425.0,575.0 L 437.1,562.1 L 450.0,550.0 L 437.8,537.2 L 425.4,524.6 L 412.8,512.2 L 400.0,500.0 L 411.1,486.2 L 423.3,473.3 L 436.7,461.8 L 450.0,450.0 L 437.2,437.8 L 424.7,425.3 L 412.3,412.7 L 400.0,400.0 L 413.8,388.9 L 426.9,376.9 L 438.7,363.6 L 450.0,350.0 L 462.9,362.1 L 476.0,374.0 L 488.0,387.0 L 500.0,400.0 Z", labelPos: { x: 530, y: 520 } },
    { id: Region.Notranjska, path: "M 250.0,350.0 L 261.8,363.2 L 274.2,375.8 L 286.5,388.5 L 300.0,400.0 L 312.8,387.7 L 324.4,374.4 L 336.8,361.8 L 350.0,350.0 L 361.0,363.9 L 372.9,377.1 L 386.4,388.6 L 400.0,400.0 L 411.5,413.5 L 423.7,426.3 L 436.8,438.2 L 450.0,450.0 L 437.2,462.3 L 424.4,474.4 L 412.2,487.2 L 400.0,500.0 L 413.8,511.1 L 427.3,522.7 L 438.5,536.5 L 450.0,550.0 L 437.0,562.0 L 423.7,573.7 L 412.3,587.2 L 400.0,600.0 L 385.7,610.6 L 372.5,622.5 L 361.1,636.1 L 350.0,650.0 L 337.1,637.9 L 324.6,625.4 L 312.5,612.5 L 300.0,600.0 L 288.3,613.4 L 277.3,627.3 L 264.1,639.2 L 250.0,650.0 L 236.8,638.2 L 224.6,625.4 L 212.1,612.9 L 200.0,600.0 L 213.0,588.0 L 225.6,575.6 L 237.4,562.4 L 250.0,550.0 L 238.8,536.3 L 226.6,523.4 L 213.0,512.0 L 200.0,500.0 L 212.5,487.5 L 226.2,476.2 L 237.8,462.8 L 250.0,450.0 L 236.9,438.1 L 224.1,425.9 L 211.7,413.3 L 200.0,400.0 L 213.4,388.4 L 227.0,377.0 L 238.4,363.4 L 250.0,350.0 Z", labelPos: { x: 330, y: 500 } },
    { id: Region.Primorska, path: "M 80.0,250.0 L 84.8,262.6 L 89.9,275.0 L 95.5,287.3 L 100.0,300.0 L 112.7,287.7 L 124.5,274.5 L 137.2,262.2 L 150.0,250.0 L 164.0,260.9 L 177.1,272.9 L 188.0,286.9 L 200.0,300.0 L 213.7,288.7 L 227.5,277.5 L 238.5,263.6 L 250.0,250.0 L 261.1,263.8 L 272.8,277.2 L 286.8,288.1 L 300.0,300.0 L 288.1,313.2 L 277.5,327.5 L 263.3,338.2 L 250.0,350.0 L 237.5,362.5 L 225.1,375.1 L 212.4,387.4 L 200.0,400.0 L 211.8,413.2 L 224.6,425.4 L 237.5,437.5 L 250.0,450.0 L 236.4,461.3 L 223.8,473.8 L 211.9,486.9 L 200.0,500.0 L 212.4,512.6 L 224.7,525.3 L 237.3,537.7 L 250.0,550.0 L 237.4,562.4 L 225.3,575.3 L 213.1,588.1 L 200.0,600.0 L 188.2,613.1 L 175.2,625.2 L 162.0,637.0 L 150.0,650.0 L 137.7,637.2 L 126.6,623.4 L 113.1,611.9 L 100.0,600.0 L 89.1,614.0 L 77.0,627.0 L 63.7,638.8 L 50.0,650.0 L 43.2,637.1 L 36.2,624.3 L 28.6,611.8 L 20.0,600.0 L 27.8,587.7 L 35.0,575.0 L 43.1,562.9 L 50.0,550.0 L 58.6,538.2 L 66.8,526.1 L 74.0,513.4 L 80.0,500.0 L 72.7,487.4 L 66.1,474.3 L 57.5,462.6 L 50.0,450.0 L 56.4,436.8 L 62.6,423.6 L 71.9,412.2 L 80.0,400.0 L 73.0,387.2 L 66.7,374.0 L 58.3,362.1 L 50.0,350.0 L 59.7,325.7 L 68.9,301.2 L 74.1,275.5 L 80.0,250.0 Z", labelPos: { x: 150, y: 450 } }
  ];


  return (
    <header className="bg-[#0A1128] text-white shadow-2xl border-b border-white/10 sticky top-0 md:relative z-[500]">
      <div className="max-w-[1600px] mx-auto px-6 h-28 flex items-center justify-between">
            <div onClick={onHome} className="flex items-center cursor-pointer group">
              <img 
                src="https://lh3.googleusercontent.com/u/0/d/1yH_IHNJfoWXgrlrwESprp3gi29_MoYwi" 
                alt="Drazba.si Logo" 
                className="h-16 md:h-20 object-contain group-hover:scale-105 transition-transform" 
              />
            </div>
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <input type="text" placeholder={t('searchPlaceholder')} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-5 pr-12 text-sm focus:ring-2 focus:ring-[#FEBA4F] outline-none placeholder-slate-500 font-bold" onChange={(e) => onSearch(e.target.value)} />
              <Search className="absolute right-4 top-3.5 text-slate-500" size={18} />
            </div>
            <div className="flex items-center gap-4">
              {isLoggedIn && (
                <button 
                  onClick={onChat}
                  className={`p-3 rounded-xl border transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${activeView === 'chat' ? 'bg-[#FEBA4F] text-[#0A1128] border-[#FEBA4F]' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`}
                  title="Sporočila"
                >
                  <MessageSquare size={18} />
                  <span className="hidden lg:inline">Sporočila</span>
                </button>
              )}
              <div className="relative h-full flex items-center"
                   onMouseEnter={() => setIsLangOpen(true)}
                   onMouseLeave={() => setIsLangOpen(false)}>
                  <button className="bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 transition-all font-black text-xs flex items-center gap-2">
                    <Globe size={14} /> {language} <ChevronDown size={12} />
                  </button>
                  {isLangOpen && (
                      <div className="absolute top-full right-0 w-44 bg-[#0A1128] border border-white/10 rounded-b-2xl shadow-2xl py-3 z-[1000] animate-in">
                        {languages.map(l => (
                            <button key={l.code} onClick={() => { onLanguageChange(l.code); setIsLangOpen(false); }} className={`w-full text-left px-6 py-3 text-[10px] font-black tracking-widest transition-all ${language === l.code ? 'text-[#FEBA4F] bg-white/5' : 'text-slate-300 hover:text-white'}`}>
                                {l.label}
                            </button>
                        ))}
                      </div>
                  )}
              </div>

              {isLoggedIn ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
                    className="flex items-center gap-3 bg-white text-[#0A1128] px-6 py-2.5 rounded-2xl font-black text-sm shadow-xl hover:bg-[#FEBA4F] transition-colors"
                  >
                    <User size={18} /><span>{t('myProfile')}</span>
                    <ChevronDown size={14} className={isUserMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'}/>
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-white border border-slate-200 rounded-[2rem] shadow-2xl py-4 text-[#0A1128] overflow-hidden z-[100] animate-in">
                        <div className="px-6 py-4 border-b border-slate-100 mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Prijavljen kot</p>
                            <p className="font-black text-xs truncate">{userEmail || 'Uporabnik Drazba.si'}</p>
                        </div>
                        <button onClick={() => { onCreateAuction(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><PlusCircle size={18} /> {t('createAuction')}</button>
                        <button onClick={() => { onMyWinnings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Trophy size={18} /> {t('myWinnings')}</button>
                        <button onClick={() => { onMyBids(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Gavel size={18} /> {t('myBids')}</button>
                        <button onClick={() => { onWatchlist(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Eye size={18} /> {t('watchlist')}</button>
                        <button onClick={() => { onSubscriptions(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><CreditCard size={18} /> {t('subscriptions')}</button>
                        <button onClick={() => { onSettings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Settings size={18} /> {t('settings')}</button>
                        <button onClick={() => { onLogout(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-red-50 text-red-600 transition-colors text-xs font-black uppercase tracking-widest border-t border-slate-100"><LogOut size={18} /> {t('logout')}</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={onLogin} className="bg-[#FEBA4F] text-[#0A1128] px-8 py-2.5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white transition-all shadow-xl">{t('login')}</button>
              )}
            </div>
      </div>
      <div className="max-w-[1600px] mx-auto px-6 h-12 flex items-center gap-10 text-[11px] font-black uppercase tracking-widest border-t border-white/5">
            <button onClick={onHome} className={`hover:text-[#FEBA4F] transition-colors ${activeView === 'grid' && !selectedRegion && !selectedCategory ? 'text-[#FEBA4F]' : ''}`}>{t('allAuctions')}</button>
            
            <div className="relative h-full flex items-center" 
                 onMouseEnter={() => setIsRegOpen(true)}
                 onMouseLeave={() => setIsRegOpen(false)}>
                <button className={`flex items-center gap-1.5 h-full hover:text-[#FEBA4F] transition-colors ${selectedRegion ? 'text-[#FEBA4F]' : ''}`}>{t('regions')} <ChevronDown size={12}/></button>
                {isRegOpen && (
                    <div className="absolute top-full left-0 w-[800px] bg-[#0A1128] border border-white/10 rounded-b-[2rem] shadow-2xl p-8 z-[1000] animate-in">
                        <div className="mb-6 flex justify-between items-center">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Zemljevid regij</p>
                          <button onClick={() => onRegionSelect(null)} className="text-[9px] text-[#FEBA4F] hover:underline">Počisti filter</button>
                        </div>
                        <svg viewBox="0 0 1000 750" className="w-full h-auto drop-shadow-2xl">
                          <defs>
                            <filter id="slo-shadow">
                              <feDropShadow dx="0" dy="10" stdDeviation="15" floodColor="#000000" floodOpacity="0.5"/>
                            </filter>
                          </defs>
                          
                          <g filter="url(#slo-shadow)">
                            {sloMapRegions.map(reg => (
                              <g key={reg.id} 
                                 className="cursor-pointer group" 
                                 onClick={() => { onRegionSelect(reg.id); setIsRegOpen(false); }}>
                                <path 
                                  d={reg.path} 
                                  className={`transition-all duration-300 stroke-white/20 stroke-[1px] ${selectedRegion === reg.id ? 'fill-[#FEBA4F]' : 'fill-white/5 group-hover:fill-white/10'}`}
                                />
                                <text 
                                  x={reg.labelPos.x} 
                                  y={reg.labelPos.y} 
                                  className={`text-[9px] font-black uppercase pointer-events-none transition-colors ${selectedRegion === reg.id ? 'fill-[#0A1128]' : 'fill-white/40 group-hover:fill-white'}`}
                                  textAnchor="middle"
                                >
                                  {reg.id}
                                </text>
                                <text 
                                  x={reg.labelPos.x} 
                                  y={reg.labelPos.y + 12} 
                                  className={`text-[11px] font-black pointer-events-none transition-colors ${selectedRegion === reg.id ? 'fill-[#0A1128]' : 'fill-[#FEBA4F]'}`}
                                  textAnchor="middle"
                                >
                                  {regionCounts[reg.id] || 0}
                                </text>
                              </g>
                            ))}
                          </g>
                        </svg>
                    </div>
                )}
            </div>

            <div className="relative h-full flex items-center" 
                 onMouseEnter={() => setIsCatOpen(true)}
                 onMouseLeave={() => setIsCatOpen(false)}>
                <button className={`flex items-center gap-1.5 h-full hover:text-[#FEBA4F] transition-colors ${selectedCategory ? 'text-[#FEBA4F]' : ''}`}>{t('categories')} <ChevronDown size={12}/></button>
                {isCatOpen && (
                    <div className="absolute top-full left-0 w-64 bg-[#0A1128] border border-white/10 rounded-b-2xl shadow-2xl py-3 z-[1000] animate-in grid grid-cols-1 max-h-[400px] overflow-y-auto">
                        <button onClick={() => { onCategorySelect(null); setIsCatOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-white/5 text-[10px] font-black tracking-widest transition-all ${!selectedCategory ? 'text-[#FEBA4F]' : 'text-slate-300'}`}>{t('allCategories')}</button>
                        {Object.values(Category).map(c => (
                            <button key={c} onClick={() => { onCategorySelect(c); setIsCatOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-white/5 text-[10px] font-black tracking-widest transition-all ${selectedCategory === c ? 'text-[#FEBA4F]' : 'text-slate-300 hover:text-white'}`}>{c}</button>
                        ))}
                    </div>
                )}
            </div>

            <button onClick={onLastChance} className={`ml-auto flex items-center gap-1.5 hover:text-[#FEBA4F] transition-colors text-[#FEBA4F] underline underline-offset-4`}>{t('lastChance')} <ChevronRight size={14}/></button>
      </div>
    </header>
  );
};
