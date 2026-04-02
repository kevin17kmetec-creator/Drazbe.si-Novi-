import React, { useState, useMemo } from 'react';
import { Search, Globe, ChevronDown, User, PlusCircle, Trophy, Eye, CreditCard, Settings, LogOut, ChevronRight } from 'lucide-react';
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
}> = ({ onHome, onSearch, onRegionSelect, onCategorySelect, onLastChance, onLogin, onLogout, onSettings, onSubscriptions, onCreateAuction, onMyWinnings, onWatchlist, activeView, selectedRegion, selectedCategory, isLoggedIn, isVerified, language, onLanguageChange, t, auctions }) => {
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

  // Simplified Slovenia Map Paths (stylized)
  const sloMapRegions = [
    { id: Region.Stajerska, path: "M 140,40 L 180,20 L 220,40 L 240,80 L 200,100 L 160,90 Z", labelPos: { x: 190, y: 60 } },
    { id: Region.Gorenjska, path: "M 40,40 L 100,20 L 140,40 L 130,80 L 80,90 L 40,70 Z", labelPos: { x: 90, y: 50 } },
    { id: Region.Primorska, path: "M 20,80 L 60,100 L 50,140 L 10,150 L 5,110 Z", labelPos: { x: 30, y: 115 } },
    { id: Region.Dolenjska, path: "M 120,110 L 170,100 L 210,130 L 190,170 L 130,160 Z", labelPos: { x: 165, y: 135 } },
    { id: Region.Prekmurje, path: "M 220,40 L 260,10 L 290,30 L 280,60 L 240,80 Z", labelPos: { x: 255, y: 45 } },
    { id: Region.Koroska, path: "M 100,20 L 150,10 L 170,30 L 140,40 L 110,35 Z", labelPos: { x: 130, y: 25 } },
    { id: Region.Notranjska, path: "M 60,100 L 120,110 L 130,160 L 80,170 L 50,140 Z", labelPos: { x: 90, y: 135 } },
    { id: Region.Osrednjeslovenska, path: "M 80,90 L 130,80 L 170,100 L 120,110 L 60,100 Z", labelPos: { x: 115, y: 95 } },
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
                            <p className="font-black text-xs truncate">Uporabnik Drazba.si</p>
                        </div>
                        <button onClick={() => { onCreateAuction(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><PlusCircle size={18} /> Ustvari dražbo</button>
                        <button onClick={() => { onMyWinnings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Trophy size={18} /> Moje zmage</button>
                        <button onClick={() => { onWatchlist(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Eye size={18} /> Opazovane dražbe</button>
                        <button onClick={() => { onSubscriptions(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><CreditCard size={18} /> {t('subscriptions')}</button>
                        <button onClick={() => { onSettings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Settings size={18} /> {t('settings')}</button>
                        <button onClick={() => { onLogout(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-red-50 text-red-600 transition-colors text-xs font-black uppercase tracking-widest border-t border-slate-100"><LogOut size={18} /> Odjava</button>
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
                    <div className="absolute top-full left-0 w-[400px] bg-[#0A1128] border border-white/10 rounded-b-[2rem] shadow-2xl p-6 z-[1000] animate-in">
                        <div className="mb-4 flex justify-between items-center">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Zemljevid regij</p>
                          <button onClick={() => onRegionSelect(null)} className="text-[9px] text-[#FEBA4F] hover:underline">Počisti filter</button>
                        </div>
                        <svg viewBox="0 0 300 180" className="w-full h-auto drop-shadow-2xl">
                          {sloMapRegions.map(reg => (
                            <g key={reg.id} 
                               className="cursor-pointer group" 
                               onClick={() => { onRegionSelect(reg.id); setIsRegOpen(false); }}>
                              <path 
                                d={reg.path} 
                                className={`transition-all duration-300 stroke-white/20 stroke-1 ${selectedRegion === reg.id ? 'fill-[#FEBA4F]' : 'fill-white/5 group-hover:fill-white/10'}`}
                              />
                              <text 
                                x={reg.labelPos.x} 
                                y={reg.labelPos.y} 
                                className={`text-[6px] font-black uppercase pointer-events-none transition-colors ${selectedRegion === reg.id ? 'fill-[#0A1128]' : 'fill-white/40 group-hover:fill-white'}`}
                                textAnchor="middle"
                              >
                                {reg.id}
                              </text>
                              <text 
                                x={reg.labelPos.x} 
                                y={reg.labelPos.y + 8} 
                                className={`text-[8px] font-black pointer-events-none transition-colors ${selectedRegion === reg.id ? 'fill-[#0A1128]' : 'fill-[#FEBA4F]'}`}
                                textAnchor="middle"
                              >
                                {regionCounts[reg.id] || 0}
                              </text>
                            </g>
                          ))}
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
