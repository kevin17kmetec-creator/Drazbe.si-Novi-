import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Globe, ChevronDown, User, PlusCircle, Trophy, Eye, CreditCard, Settings, LogOut, ChevronRight, Gavel, MessageSquare, Wallet } from 'lucide-react';
import { ViewState, Region, Category, AuctionItem } from '../../types.ts';
import { useChat } from '../context/ChatContext';
import { SloveniaMap } from './SloveniaMap';

export const Header: React.FC<{ 
  onHome: () => void;
  onSearch: (val: string) => void;
  onRegionSelect: (reg: Region | null) => void;
  onCategorySelect: (cat: Category | null) => void;
  onLastChance: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onSettings: (tab?: 'profile' | 'personal' | 'stripe') => void;
  onSubscriptions: () => void;
  onCreateAuction: () => void;
  onMyWinnings: () => void;
  onMyBids: () => void;
  onMySold?: () => void;
  onMyUnsold?: () => void;
  onWatchlist: () => void;
  onMessages: () => void;
  activeView: ViewState;
  selectedRegion: Region | null;
  selectedCategory: Category | null;
  isLoggedIn: boolean;
  isVerified: boolean;
  language: string;
  onLanguageChange: (l: string) => void;
  t: (k: string) => string;
  auctions: AuctionItem[];
  newWinningsCount?: number;
  userEmail?: string;
  userProfilePicture?: string;
  userWalletBalance?: number;
}> = ({ onHome, onSearch, onRegionSelect, onCategorySelect, onLastChance, onLogin, onLogout, onSettings, onSubscriptions, onCreateAuction, onMyWinnings, onMyBids, onMySold, onMyUnsold, onWatchlist, onMessages, activeView, selectedRegion, selectedCategory, isLoggedIn, isVerified, language, onLanguageChange, t, auctions, newWinningsCount, userEmail, userProfilePicture, userWalletBalance }) => {
  const { unreadMessageCount } = useChat();

  const [isRegOpen, setIsRegOpen] = useState(false);
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  // Profile badge MUST only show won auctions count, message badge is exclusively on messages button
  const wonAuctionsBadge = newWinningsCount || 0;
  const userMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const catMenuRef = useRef<HTMLDivElement>(null);
  const regMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (catMenuRef.current && !catMenuRef.current.contains(event.target as Node)) {
        setIsCatOpen(false);
      }
      if (regMenuRef.current && !regMenuRef.current.contains(event.target as Node)) {
        setIsRegOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
      else if (a.region) counts[a.region] = (counts[a.region] || 0) + 1;
    });
    return counts;
  }, [auctions]);

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
                  <button onClick={onMessages} className={`relative bg-white/5 p-3 rounded-xl border border-white/10 transition-all text-white flex items-center justify-center ${activeView === 'messages' ? 'bg-[#FEBA4F] text-[#0A1128] border-transparent' : 'hover:bg-white/10 hover:text-[#FEBA4F]'}`}>
                    <MessageSquare size={16} />
                    {unreadMessageCount !== undefined && unreadMessageCount > 0 && (
                        <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-white text-[11px] font-extrabold w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#0A1128] animate-pulse shadow-lg select-none">
                            {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                        </span>
                    )}
                  </button>
              )}
              <div className="relative h-full flex items-center"
                   ref={langMenuRef}
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      onSettings('stripe');
                      setIsUserMenuOpen(false);
                    }}
                    className="group flex items-center gap-2 bg-[#0A1128] text-white px-5 py-2.5 rounded-2xl font-black text-sm shadow-xl hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all border border-slate-700/50"
                  >
                    <Wallet size={16} className="text-[#FEBA4F] group-hover:text-[#0A1128] transition-colors"/>
                    <span className="group-hover:text-[#0A1128] transition-colors">€{(userWalletBalance || 0).toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </button>

                  <div className="relative" ref={userMenuRef}>
                    <button 
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
                      className="flex items-center gap-3 bg-white text-[#0A1128] px-6 py-2.5 rounded-2xl font-black text-sm shadow-xl hover:bg-slate-50 transition-colors"
                    >
                    {wonAuctionsBadge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">{wonAuctionsBadge > 9 ? '9+' : wonAuctionsBadge}</span>
                    )}
                        {userProfilePicture ? (
                        <img 
                          src={userProfilePicture} 
                          alt="Profile" 
                          className="w-5 h-5 rounded-full object-cover" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.insertAdjacentHTML('beforeend', '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>');
                          }}
                        />
                    ) : (
                        <User size={18} />
                    )}
                    <span>{t('myProfile')}</span>
                    <ChevronDown size={14} className={isUserMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'}/>
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-white border border-slate-200 rounded-[2rem] shadow-2xl py-4 text-[#0A1128] overflow-hidden z-[100] animate-in">
                        <div className="px-6 py-4 border-b border-slate-100 mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">{t('loggedInAs')}</p>
                            <p className="font-black text-xs truncate">{userEmail || 'Uporabnik Drazba.si'}</p>
                        </div>
                        <button onClick={() => { onCreateAuction(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><PlusCircle size={18} /> {t('createAuction')}</button>
                        <button onClick={() => { onMyWinnings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Trophy size={18} /> {t('myWinnings')}
                          {newWinningsCount !== undefined && newWinningsCount > 0 && (
                            <span className="ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{newWinningsCount}</span>
                          )}
                        </button>
                        <button onClick={() => { onMyBids(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Gavel size={18} /> {t('myBids')}</button>
                        <button onClick={() => { onMySold?.(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><CreditCard size={18} /> {t('soldAuctions')}</button>
                        <button onClick={() => { onMyUnsold?.(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Settings size={18} /> {t('unsoldAuctions')}</button>
                        <button onClick={() => { onWatchlist(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Eye size={18} /> {t('watchlist')}</button>
                        <button onClick={() => { onSubscriptions(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><CreditCard size={18} /> {t('subscriptions')}</button>
                        <button onClick={() => { onSettings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Settings size={18} /> {t('settings')}</button>
                        <button onClick={() => { onLogout(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-red-50 text-red-600 transition-colors text-xs font-black uppercase tracking-widest border-t border-slate-100"><LogOut size={18} /> {t('logout')}</button>
                    </div>
                  )}
                  </div>
                </div>
              ) : (
                <button onClick={onLogin} className="bg-[#FEBA4F] text-[#0A1128] px-8 py-2.5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white transition-all shadow-xl">{t('login')}</button>
              )}
            </div>
      </div>
      <div className="max-w-[1600px] mx-auto px-6 h-12 flex items-center gap-10 text-[11px] font-black uppercase tracking-widest border-t border-white/5">
            <button onClick={onHome} className={`hover:text-[#FEBA4F] transition-colors ${activeView === 'grid' && !selectedRegion && !selectedCategory ? 'text-[#FEBA4F]' : ''}`}>{t('allAuctions')}</button>
            
            <div className="relative h-full flex items-center" 
                 ref={regMenuRef}
                 onMouseEnter={() => setIsRegOpen(true)}
                 onMouseLeave={() => setIsRegOpen(false)}>
                <button className={`flex items-center gap-1.5 h-full hover:text-[#FEBA4F] transition-colors ${selectedRegion ? 'text-[#FEBA4F]' : ''}`}>{t('regions')} <ChevronDown size={12}/></button>
                {isRegOpen && (
                    <div className="absolute top-full left-0 w-[840px] max-w-[95vw] z-[1000] animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                        <SloveniaMap
                            regionsData={regionCounts}
                            selectedRegion={selectedRegion}
                            onSelectRegion={(reg) => {
                                onRegionSelect(reg ? (reg as Region) : null);
                                setIsRegOpen(false);
                            }}
                            t={t}
                            showTitle={true}
                        />
                    </div>
                )}
            </div>

            <div className="relative h-full flex items-center" 
                 ref={catMenuRef}
                 onMouseEnter={() => setIsCatOpen(true)}
                 onMouseLeave={() => setIsCatOpen(false)}>
                <button className={`flex items-center gap-1.5 h-full hover:text-[#FEBA4F] transition-colors ${selectedCategory ? 'text-[#FEBA4F]' : ''}`}>{t('categories')} <ChevronDown size={12}/></button>
                {isCatOpen && (
                    <div className="absolute top-full left-0 w-64 bg-[#0A1128] border border-white/10 rounded-b-2xl shadow-2xl py-3 z-[1000] animate-in grid grid-cols-1 max-h-[400px] overflow-y-auto">
                        <button onClick={() => { onCategorySelect(null); setIsCatOpen(false); }} className={`w-full text-left px-6 py-4 hover:bg-white/5 text-xs font-black uppercase tracking-widest transition-all ${!selectedCategory ? 'text-[#FEBA4F]' : 'text-slate-300'}`}>{t('allCategories')}</button>
                        {Object.values(Category).map(c => (
                            <button key={c} onClick={() => { onCategorySelect(c); setIsCatOpen(false); }} className={`w-full text-left px-6 py-4 hover:bg-white/5 text-xs font-black uppercase tracking-widest transition-all ${selectedCategory === c ? 'text-[#FEBA4F]' : 'text-slate-300 hover:text-white'}`}>{c}</button>
                        ))}
                    </div>
                )}
            </div>

            <button onClick={onLastChance} className={`ml-auto flex items-center gap-1.5 hover:text-[#FEBA4F] transition-colors text-[#FEBA4F] underline underline-offset-4`}>{t('lastChance')} <ChevronRight size={14}/></button>
      </div>
    </header>
  );
};
