import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AuctionView from './src/components/AuctionView';
import SellerView from './src/components/SellerView';
import { SubscriptionsView } from './src/components/SubscriptionsView';
import { VerificationView } from './src/components/VerificationView';
import { CreateAuctionForm } from './src/components/CreateAuctionForm';
import { ChatView } from './src/components/ChatView';
import { AuthView } from './src/components/AuthView';
import { LegalModal } from './src/components/LegalModal';
import { VerificationBanner } from './src/components/VerificationBanner';
import { StaticTimer } from './src/components/StaticTimer';
import { AuctionCard } from './src/components/AuctionCard';
import { HeroCarousel } from './src/components/HeroCarousel';
import { Header } from './src/components/Header';
import { Footer } from './src/components/Footer';
import { CheckoutModal } from './src/components/CheckoutModal';
import { SettingsView } from './src/components/SettingsView';
import { ConfirmBidModal } from './src/components/ConfirmBidModal';
import { 
  Search, User, Globe, ChevronLeft, ChevronRight, Clock, MapPin, TrendingUp, Gavel,
  ArrowLeft, ChevronDown, ShieldCheck, Building2, Eye,
  Plus, Minus, Lock, CheckCircle2, Mail, Phone, CreditCard as CardIcon, PlusCircle, 
  Settings, LogOut, Star, Camera, Landmark, FileCheck, AlertCircle, X, Calendar, 
  UserCheck, MessageSquare, History, Briefcase, Upload, Image as ImageIcon, ArrowUp,
  Trophy, AlertTriangle, Info, Table, Truck, Zap, Download, CreditCard, AlertOctagon,
  Trash2, Filter, LayoutGrid, List, Scale, FileText, HelpCircle, Languages, FileUp
} from 'lucide-react';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import imageCompression from 'browser-image-compression';

import { supabase } from './src/lib/supabaseClient';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || (() => { throw new Error("VITE_STRIPE_PUBLIC_KEY is not defined"); })());
import { AuctionItem, Region, ViewState, Seller, Review, SellerType, SubscriptionTier, PaymentCard, WonItem, Category } from './types.ts';

import { Toaster, toast } from 'sonner';

// --- CONFIGURATION ---
const IS_LIVE = true; 

import { EXTENDED_MOCK_AUCTIONS } from './src/lib/mockData';

import { translations } from './src/lib/translations';
import { getIncrement, formatSeconds } from './src/lib/utils';

// --- MAIN APP COMPONENT ---

// SignedImg component for fetching Supabase signed URLs
const SignedImg = ({ src, alt, className, onClick }: { src: string, alt: string, className?: string, onClick?: () => void }) => {
    const [signedUrl, setSignedUrl] = useState<string>('');
    useEffect(() => {
        if (!src) return;
        if (src.startsWith('http')) { setSignedUrl(src); return; }
        supabase.storage.from('auction-images').createSignedUrl(src, 3600).then(({data}) => {
            if (data?.signedUrl) setSignedUrl(data.signedUrl);
        });
    }, [src]);
    return <img src={signedUrl || src} alt={alt} loading="lazy" className={className} onClick={onClick} referrerPolicy="no-referrer" />;
};

const App: React.FC = () => {
  const [language, setLanguage] = useState('SLO');
  const t = (key: string) => translations[language]?.[key] || key;
  
  const [auctions, setAuctions] = useState<AuctionItem[]>(EXTENDED_MOCK_AUCTIONS);
  const [activeView, setActiveView] = useState<ViewState>('grid');
  const [bidAuctionIds, setBidAuctionIds] = useState<string[]>([]);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showConfirmBidModal, setShowConfirmBidModal] = useState(false);
  const bidResolverRef = useRef<((value: 'success' | 'outbid' | 'error' | 'login_required' | 'cancelled') => void) | null>(null);
  const [pendingBid, setPendingBid] = useState<{item: AuctionItem, amount: number} | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userType, setUserType] = useState<'individual' | 'business' | null>(null);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);

  // Redirect to home if logged in and on login page
  useEffect(() => {
    if (isLoggedIn && activeView === 'login') {
      setActiveView('grid');
      setSelectedRegion(null);
      setSelectedCategory(null);
      setSearchQuery('');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [isLoggedIn, activeView]);

  const toggleWatch = async (id: string) => {
    const newWatchedIds = watchedIds.includes(id) 
      ? watchedIds.filter(i => i !== id) 
      : [...watchedIds, id];
    
    setWatchedIds(newWatchedIds);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('users').upsert({
          id: session.user.id,
          email: session.user.email,
          watched_auctions: newWatchedIds
        });
      }
    } catch (err) {
      console.error("Error updating watched auctions:", err);
    }
  };
  const [activeLegal, setActiveLegal] = useState<'terms' | 'privacy' | 'how' | null>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionTier>(SubscriptionTier.FREE);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{ amount: number; title: string; onSuccess: () => void; metadata?: any } | null>(null);
  const [userData, setUserData] = useState({ id: '', firstName: '', lastName: '', email: '', profilePicture: '', is_verified: false });
  
  const [selectedItem, setSelectedItem] = useState<AuctionItem | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

  const currentUserWinnings = useMemo(() => {
      if (!userData?.id) return [];
      return auctions.filter(a => 
          (a.winner_id === userData.id || a.winnerId === userData.id) && 
          (a.status === 'completed' || a.endTime.getTime() <= Date.now())
      ).sort((a, b) => b.endTime.getTime() - a.endTime.getTime());
  }, [auctions, userData?.id]);

  // Pagination & Scroll
  const [baseItemsPerPage, setBaseItemsPerPage] = useState(12);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const updateCols = () => {
      if (window.innerWidth >= 1536) setCols(5);
      else if (window.innerWidth >= 1280) setCols(4);
      else if (window.innerWidth >= 1024) setCols(3);
      else if (window.innerWidth >= 640) setCols(2);
      else setCols(1);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const itemsPerPage = Math.ceil(baseItemsPerPage / cols) * cols;
  const [currentPage, setCurrentPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Ref for the "Aktualne dražbe" section
  const auctionsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let title = 'Drazba.si | Prva slovenska digitalna dražba';
    let metaDesc = 'Najbolj zanesljiva platforma za spletne dražbe v Sloveniji. Pregledno, varno in enostavno.';
    
    switch(activeView) {
      case 'detail':
        if (selectedItem) {
          const itemTitle = selectedItem.title[language as keyof typeof selectedItem.title] || selectedItem.title['SLO'];
          title = `${itemTitle} | Drazba.si`;
        }
        metaDesc = `Licitirajte za stroje, vozila ali nepremičnine. Oddajte svojo ponudbo zdaj.`;
        break;
      case 'sellerProfile':
        if (selectedSeller) title = `Profil prodajalca: ${selectedSeller.name} | Drazba.si`;
        metaDesc = `Oglejte si vse aktivne dražbe prodajalca na Drazba.si.`;
        break;
      case 'lastChance':
        title = 'Zadnja priložnost | Predmeti, ki se iztekajo | Drazba.si';
        metaDesc = 'Zgrabite še zadnjo priložnost za licitacijo. Dražbe se iztekajo.';
        break;
      case 'createAuction':
        title = 'Objavi novo dražbo | Drazba.si';
        break;
      case 'login':
        title = 'Prijava in registracija | Drazba.si';
        break;
    }

    document.title = title;
    
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaDesc);
  }, [activeView, selectedItem, selectedSeller, language]);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase.from('auctions').select('*');
      if (error) {
          console.error("Error fetching auctions:", error);
          return;
      }

      // Fetch users to map seller names
      const { data: usersData } = await supabase.from('users').select('id, username, company_name, user_type, first_name, last_name');
      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
      
      const supabaseData: AuctionItem[] = data.map(d => {
          const seller = usersMap.get(d.seller_id);
          let sellerName = 'Neznan prodajalec';
          if (seller) {
              if (seller.user_type === 'business' && seller.company_name) {
                  sellerName = seller.company_name;
              } else if (seller.username) {
                  sellerName = seller.username;
              } else if (seller.first_name && seller.last_name) {
                  sellerName = `${seller.first_name} ${seller.last_name}`;
              }
          }

          return {
              ...d,
              endTime: new Date(d.end_time || d.endTime),
              currentBid: d.current_price || d.currentBid,
              hiddenMaxBid: d.hidden_max_bid || d.hiddenMaxBid,
              bidCount: d.bid_count || d.bidCount,
              winnerId: d.winner_id || d.winnerId,
              winner_id: d.winner_id || d.winnerId,
              payment_status: d.payment_status || 'unpaid',
              paid_at: d.paid_at,
              sellerName: d.sellerName || sellerName
          };
      });

      if (IS_LIVE) {
          setAuctions(supabaseData);
      } else {
          const merged = [...EXTENDED_MOCK_AUCTIONS];
          supabaseData.forEach(fd => {
              const idx = merged.findIndex(m => m.id === fd.id);
              if (idx > -1) merged[idx] = fd;
              else merged.unshift(fd);
          });
          setAuctions(merged);
      }
    } catch (err) {
      console.error("Supabase connection error:", err);
      if (!IS_LIVE) {
        setAuctions([...EXTENDED_MOCK_AUCTIONS]);
      }
    }
  };

  // Effect to reset page and scroll to top on ANY view/category change
  useEffect(() => {
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeView, selectedRegion, selectedCategory, searchQuery]);

  // Firestore Sync
  useEffect(() => {
    fetchAuctions();

    // Auto-polling fallback for immediate real-time sync (in case WebSockets or Supabase Replication are blocked)
    const pollInterval = setInterval(() => {
        fetchAuctions();
    }, 3000);

    // Real-time subscription with WebSocket check
    let channel: any = null;
    if (typeof window !== 'undefined' && window.WebSocket) {
      try {
        channel = supabase.channel('public:auctions')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
            fetchAuctions();
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.warn("Supabase Realtime channel error. Live updates might be unavailable.");
            }
          });
      } catch (err) {
        console.warn("Supabase Realtime subscription failed:", err);
      }
    } else {
      console.warn("WebSockets are not supported or blocked in this environment. Real-time updates are disabled.");
    }
    
    return () => {
        clearInterval(pollInterval);
        if (channel) supabase.removeChannel(channel); 
    }
  }, []);

  // Sync selectedItem if it was updated in the background
  useEffect(() => {
      if (selectedItem) {
          const updated = auctions.find(a => a.id === selectedItem.id);
          if (updated && (
              updated.currentBid !== selectedItem.currentBid || 
              updated.winner_id !== selectedItem.winner_id ||
              updated.status !== selectedItem.status ||
              updated.endTime.getTime() !== selectedItem.endTime.getTime() ||
              updated.bidCount !== selectedItem.bidCount
          )) {
              setSelectedItem(updated);
          }
      }
  }, [auctions, selectedItem]);

  // Auth Sync
  useEffect(() => {
    const syncAuth = async () => {
      setIsAuthLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setIsLoggedIn(true);
          setUserData(prev => ({ ...prev, email: session.user.email || '' }));
          
          let { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
          
          // If user doesn't exist in 'users' table, create them now
          if (!data) {
              const { data: newUser, error: insertError } = await supabase.from('users').insert({ 
                  id: session.user.id, 
                  email: session.user.email, 
                  is_verified: false, 
                  unpaid_strikes: 0, 
                  subscription: 'FREE' 
              }).select().single();
              
              if (!insertError && newUser) {
                  data = newUser;
              } else {
                  const { data: existingUser } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                  if (existingUser) data = existingUser;
              }
          }

          if (data) {
            console.log("Auth Sync - User data:", data);
            const verified = !!(data.is_verified || data.isVerified || data.isverified);
            setIsVerified(verified);
            setUserType(data.user_type || data.userType || 'individual');
            setUserData(prev => ({ ...prev, ...data, id: session.user.id, is_verified: verified }));
            if (data.watched_auctions) {
              setWatchedIds(data.watched_auctions);
            }
            if (data.has_accepted_terms) {
              setHasAcceptedTerms(true);
            }
            if (data.bid_auction_ids) {
              setBidAuctionIds(data.bid_auction_ids);
            }
            if (data.subscription) {
              setCurrentPlan(data.subscription);
            }
          }
        }
      } catch (err) {
        console.error("Supabase auth sync error:", err);
      } finally {
        setIsAuthLoading(false);
      }
    };
    syncAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setUserData(prev => ({ ...prev, email: session.user.email || '' }));
        
        // Only fetch user data from DB on initial load or sign in to prevent infinite loops
        // if a DB query triggers a token refresh which triggers another DB query.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            setIsAuthLoading(true);
            try {
              let { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
              
              // If user doesn't exist in 'users' table, create them now
              if (!data) {
                  const { data: newUser, error: insertError } = await supabase.from('users').insert({ 
                      id: session.user.id, 
                      email: session.user.email, 
                      is_verified: false, 
                      unpaid_strikes: 0, 
                      subscription: 'FREE' 
                  }).select().single();
                  
                  if (!insertError && newUser) {
                      data = newUser;
                  } else {
                      const { data: existingUser } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                      if (existingUser) data = existingUser;
                  }
              }

              if (data) {
                console.log("Auth State Change - User data:", data);
                const verified = !!(data.is_verified || data.isVerified || data.isverified);
                setIsVerified(verified);
                setUserType(data.user_type || data.userType || 'individual');
                setUserData(prev => ({ ...prev, ...data, id: session.user.id, is_verified: verified }));
                if (data.watched_auctions) {
                  setWatchedIds(data.watched_auctions);
                }
                if (data.has_accepted_terms) {
                  setHasAcceptedTerms(true);
                }
                if (data.bid_auction_ids) {
                  setBidAuctionIds(data.bid_auction_ids);
                }
                if (data.subscription) {
                  setCurrentPlan(data.subscription);
                }
              }
            } catch (err) {
              console.error("Error fetching user data on auth change:", err);
            } finally {
              setIsAuthLoading(false);
            }
            fetchAuctions();
        }
      } else {
        setIsLoggedIn(false);
        setIsVerified(false);
        setIsAuthLoading(false);
        fetchAuctions();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBidSubmit = async (item: AuctionItem, amount: number): Promise<'success' | 'outbid' | 'error' | 'login_required' | 'cancelled'> => {
    if (!isLoggedIn) { setActiveView('login'); return 'login_required'; }
    if (!isVerified) { 
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return 'error'; 
    }
    
    return new Promise((resolve) => {
        setPendingBid({ item, amount });
        bidResolverRef.current = resolve;
        
        if (!hasAcceptedTerms) {
            setShowTermsModal(true);
        } else {
            setShowConfirmBidModal(true);
        }
    });
  };

  const executeBid = async (item: AuctionItem, amount: number): Promise<'success' | 'outbid' | 'error'> => {
    // Prevent bidding if auction has ended
    if (item.status === 'completed' || item.status === 'cancelled' || new Date(item.endTime).getTime() <= Date.now()) {
        console.warn("Cannot bid: Auction has already ended.");
        return 'error';
    }

    // Proxy Bidding Logic
    if (IS_LIVE || item.id.includes('-') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) {
        try {
            // 1. Fetch latest auction state
            const { data: auction, error: fetchError } = await supabase
                .from('auctions')
                .select('*')
                .eq('id', item.id)
                .single();

            if (fetchError || !auction) {
                console.error("Fetch Error:", fetchError);
                return 'error';
            }

            const currentPrice = auction.current_price || 0;
            const currentWinnerId = auction.winner_id;
            const currentMaxBid = auction.hidden_max_bid || 0;
            const increment = getIncrement(currentPrice);

            let newPrice = currentPrice;
            let newWinnerId = currentWinnerId;
            let newMaxBid = currentMaxBid;
            let outbiddenImmediately = false;

            if (!currentWinnerId) {
                // First bid
                newPrice = currentPrice; 
                newWinnerId = userData.id;
                newMaxBid = amount;
            } else if (userData.id === currentWinnerId) {
                // Same user increasing their own max bid
                if (amount <= currentMaxBid) {
                    return 'error';
                }
                newMaxBid = amount;
            } else {
                // New bidder
                if (amount > currentMaxBid) {
                    // New bidder takes the lead
                    newPrice = Math.max(currentPrice + increment, currentMaxBid + increment);
                    if (newPrice > amount) newPrice = amount;
                    newWinnerId = userData.id;
                    newMaxBid = amount;
                } else {
                    // New bidder is lower or equal to current max
                    newPrice = Math.min(amount + increment, currentMaxBid);
                    newWinnerId = currentWinnerId;
                    newMaxBid = currentMaxBid;
                    outbiddenImmediately = true;
                }
            }

            // 2. Update auction
            const newBid = {
                id: crypto.randomUUID(),
                bidderId: userData.id,
                bidderName: userData.username || userData.first_name || 'Uporabnik',
                amount: amount,
                timestamp: new Date().toISOString()
            };
            const updatedHistory = [...(auction.bidding_history || []), newBid];

            // Anti-sniping logic
            let newEndTime = auction.end_time;
            const nowTime = Date.now();
            const auctionEndTime = new Date(auction.end_time).getTime();
            if (auctionEndTime - nowTime < 60000 && auctionEndTime > nowTime) {
                newEndTime = new Date(nowTime + 60000).toISOString();
            }

            const { error: updateError, data: updatedDbData } = await supabase
                .from('auctions')
                .update({
                    current_price: newPrice,
                    winner_id: newWinnerId,
                    hidden_max_bid: newMaxBid,
                    bid_count: (auction.bid_count || 0) + 1,
                    bidding_history: updatedHistory,
                    end_time: newEndTime
                })
                .eq('id', item.id)
                .select()
                .single();

            if (updateError || !updatedDbData) {
                console.error("Update Error or RLS block:", updateError);
                return 'error';
            }

            const updatedItem = {
                ...item, 
                currentBid: newPrice,
                current_price: newPrice, 
                bidCount: (item.bidCount || 0) + 1,
                bid_count: ((item as any).bid_count || 0) + 1,
                winnerId: newWinnerId, 
                winner_id: newWinnerId,
                hiddenMaxBid: newMaxBid,
                hidden_max_bid: newMaxBid,
                biddingHistory: updatedHistory,
                bidding_history: updatedHistory,
                endTime: new Date(newEndTime),
                end_time: newEndTime
            };

            // Proactively update local state to avoid red border flash
            setAuctions(prev => prev.map(a => a.id === item.id ? { ...a, ...updatedItem } : a));
            if (selectedItem?.id === item.id) {
                setSelectedItem(prev => prev ? { ...prev, ...updatedItem } : null);
            }
            const newBidIds = Array.from(new Set([...bidAuctionIds, item.id]));
            setBidAuctionIds(newBidIds);
            
            // Fire and forget updating user's locally tracked bids
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session?.user) {
                supabase.from('users').update({
                  bid_auction_ids: newBidIds
                }).eq('id', session.user.id).then(({error}) => {
                  if (error) console.error("Error updating bid_auction_ids:", error);
                });
              }
            }).catch(err => console.error("Session error during bid:", err));

            return outbiddenImmediately ? 'outbid' : 'success';
        } catch (error: any) { 
            console.error(error); 
            return 'error';
        }
    } else {
        // Handle mock auctions locally
        setAuctions(prev => prev.map(a => a.id === item.id ? {...a, currentBid: amount, bidCount: a.bidCount + 1, winnerId: userData.id, winner_id: userData.id} : a));
        const newBidIds = Array.from(new Set([...bidAuctionIds, item.id]));
        setBidAuctionIds(newBidIds);
        
        // Fire and forget updating user's locally tracked bids
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            supabase.from('users').update({
              bid_auction_ids: newBidIds
            }).eq('id', session.user.id).then(({error}) => {
              if (error) console.error("Error updating bid_auction_ids:", error);
            });
          }
        }).catch(err => console.error("Session error during bid:", err));

        return 'success';
    }
  };

  const [dontShowTermsAgain, setDontShowTermsAgain] = useState(false);

  const handleAcceptTerms = async () => {
      setShowTermsModal(false);
      
      if (dontShowTermsAgain) {
          setHasAcceptedTerms(true);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              await supabase.from('users').upsert({
                id: session.user.id,
                email: session.user.email,
                has_accepted_terms: true
              });
            }
          } catch (err) {
            console.error("Error saving terms acceptance:", err);
          }
      }
      
      if (pendingBid) {
          setShowConfirmBidModal(true);
      } else if (bidResolverRef.current) {
          bidResolverRef.current('cancelled');
          bidResolverRef.current = null;
      }
  };

  const handleCancelTerms = () => {
      setShowTermsModal(false);
      if (bidResolverRef.current) bidResolverRef.current('cancelled');
      bidResolverRef.current = null;
      setPendingBid(null);
  };

  const handleConfirmBid = async (amount: number) => {
      if (!pendingBid || !bidResolverRef.current) return;
      
      const result = await executeBid(pendingBid.item, amount);
      setShowConfirmBidModal(false);
      if (bidResolverRef.current) {
          bidResolverRef.current(result);
          bidResolverRef.current = null;
      }
      setPendingBid(null);
  };

  const handleCancelConfirmBid = () => {
      setShowConfirmBidModal(false);
      if (bidResolverRef.current) bidResolverRef.current('cancelled');
      bidResolverRef.current = null;
      setPendingBid(null);
  };

  const handlePublish = async (itemData: any) => {
      try {
          if (!isLoggedIn || !userData?.id) {
              toast.error(t('loginRequired'));
              setActiveView('login');
              return;
          }

          // Remove [EN] and [DE] prefix hardcoding as this looks like test data and is unnecessary
          const simulatedTitle = {
              SLO: itemData.title.SLO,
              EN: itemData.title.SLO,
              DE: itemData.title.SLO
          };
          const simulatedDescription = {
              SLO: itemData.description,
              EN: itemData.description,
              DE: itemData.description
          };

              // Construct dynamic condition payload based on Slovene selection
              const getConditionTranslations = (cond: string) => {
                  switch(cond) {
                      case 'Novo': return { SLO: 'Novo', EN: 'New', DE: 'Neu' };
                      case 'Kot novo': return { SLO: 'Kot novo', EN: 'Like New', DE: 'Wie Neu' };
                      case 'Rabljeno': return { SLO: 'Rabljeno', EN: 'Used', DE: 'Gebraucht' };
                      case 'Potrebno obnove': return { SLO: 'Potrebno obnove', EN: 'Needs Restoration', DE: 'Restaurierungsbedürftig' };
                      case 'Za dele': return { SLO: 'Za dele', EN: 'For Parts', DE: 'Für Ersatzteile' };
                      default: return { SLO: cond, EN: cond, DE: cond };
                  }
              };

          const insertPromise = supabase.from('auctions').insert({
              title: simulatedTitle,
              description: simulatedDescription,
              current_price: parseInt(itemData.startingPrice),
              bid_count: 0,
              item_count: 1,
              end_time: itemData.endTime || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
              location: itemData.location || { SLO: 'Neznano', EN: 'Unknown', DE: 'Unbekannt' },
              region: itemData.region || Region.Osrednjeslovenska,
              category: itemData.category || Category.Ostalo,
              condition: getConditionTranslations(itemData.condition || 'Rabljeno'),
              specifications: {},
              bidding_history: [],
              seller_id: userData.id,
              status: 'active',
              images: itemData.images
          });

          const timeoutPromise = new Promise<{data: any, error: any}>(resolve => 
              setTimeout(() => resolve({ data: null, error: { message: "Povezava s strežnikom je potekla (Timeout 30s)." } }), 30000)
          );

          const { error } = await Promise.race([insertPromise, timeoutPromise]) as any;

          if (error) {
              console.error("Publish Error:", error);
              toast.error(t('publishError'));
              return;
          }

          setActiveView('grid');
          toast.success(t('auctionPublished'));
          fetchAuctions(); // Refresh the list from DB
      } catch (error: any) { 
          console.error("HandlePublish Exception:", error); 
          toast.error(t('publishError'));
      }
  };

  const handleLogout = async () => {
    // Clear state immediately for better UX
    setIsLoggedIn(false);
    setIsVerified(false);
    setUserType(null);
    setUserData({ firstName: '', lastName: '', email: '', profilePicture: '' });
    setHasAcceptedTerms(false);
    setBidAuctionIds([]);
    setActiveView('grid');
    
    try {
      await supabase.auth.signOut();
      toast.success(t('loggedOut'));
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    const prices = { [SubscriptionTier.FREE]: 0, [SubscriptionTier.BASIC]: 20, [SubscriptionTier.PRO]: 50 };
    
    const saveSubscription = async (newTier: SubscriptionTier) => {
      setCurrentPlan(newTier);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.from('users').upsert({
            id: session.user.id,
            email: session.user.email,
            subscription: newTier
          });
        }
      } catch (err) {
        console.error("Error saving subscription:", err);
      }
    };

    if (tier === SubscriptionTier.FREE) {
      await saveSubscription(tier);
      toast.success(t('paymentSuccess'));
      return;
    }
    setCheckoutData({
      amount: prices[tier],
      title: `Naročnina - ${tier}`,
      onSuccess: async () => {
        await saveSubscription(tier);
        setIsCheckoutOpen(false);
        toast.success(t('paymentSuccess'));
      }
    });
    setIsCheckoutOpen(true);
  };

  const handleSaveSettings = async (data: any) => {
    console.log("handleSaveSettings called with data:", data);
    if (!userData?.id) {
        console.log("No user ID found in state");
        toast.error("Uporabnik ni prijavljen.");
        return;
    }

    try {
        // Update password if provided
        if (data.newPassword && data.oldPassword) {
            const { error: passError } = await supabase.auth.updateUser({ password: data.newPassword });
            if (passError) {
                toast.error(`Napaka pri spremembi gesla: ${passError.message}`);
                return;
            }
        }

        // Update user profile data
        const updateData: any = {
            username: data.username,
            first_name: data.firstName,
            last_name: data.lastName,
            street: data.street,
            city: data.city,
            postal_code: data.postalCode,
            company_name: data.companyName,
            tax_number: data.taxNumber,
            tax_id: data.taxNumber, // Save to both for compatibility
            company_street: data.companyStreet,
            company_city: data.companyCity,
            company_postal_code: data.companyPostalCode,
            representative: data.representative,
            country_code: data.countryCode,
            auto_invoice_generation: data.autoInvoiceGeneration
        };

        if (data.profilePicture && data.profilePicture.startsWith('data:image')) {
            try {
                console.log("Processing profile picture...");
                
                // Manual base64 to Blob conversion to avoid CSP fetch issues
                const base64Parts = data.profilePicture.split(',');
                const mimeType = base64Parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
                const base64Data = base64Parts[1];
                const byteCharacters = atob(base64Data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });
                const file = new File([blob], "profile.jpg", { type: mimeType });

                // Compress image
                const options = {
                    maxSizeMB: 0.2,
                    maxWidthOrHeight: 800,
                    useWebWorker: true
                };
                
                const compressedFile = await imageCompression(file, options);
                console.log("Image compressed successfully");

                const fileName = `${userData.id}-${Date.now()}.jpg`;

                const { data: uploadData, error: uploadError } = await supabase.storage.from('auction-images').upload(`profiles/${fileName}`, compressedFile, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

                if (uploadError) {
                    console.error("Error uploading profile picture:", uploadError);
                    toast.error(t('imageUploadError'));
                } else if (uploadData) {
                    const { data: publicUrlData } = supabase.storage.from('auction-images').getPublicUrl(`profiles/${fileName}`);
                    updateData.profile_picture_url = publicUrlData.publicUrl;
                    console.log("Profile picture uploaded:", publicUrlData.publicUrl);
                }
            } catch (imgErr) {
                console.error("Error processing profile picture:", imgErr);
            }
        } else if (!data.profilePicture) {
            updateData.profile_picture_url = null;
        }

        console.log("Updating database with:", updateData);
        const { data: updatedUser, error } = await supabase.from('users').update({ 
            email: userData.email,
            ...updateData 
        }).eq('id', userData.id).select().single();

        if (error) {
            console.error("Database update error:", error);
            if (error.code === '23505' && error.message.includes('username')) {
                toast.error('To uporabniško ime je že zasedeno. Prosimo, izberite drugega.');
            } else {
                toast.error(`Napaka pri shranjevanju: ${error.message}`);
            }
            return;
        }

        if (updatedUser) {
            console.log("User updated successfully:", updatedUser);
            setUserData(prev => ({ ...prev, ...updatedUser }));
        }

        toast.success(t('saveChanges') + ' - ' + t('success'));
    } catch (err) {
        console.error("Error saving settings:", err);
        toast.error("Prišlo je do napake pri shranjevanju.");
    }
  };

  const getFilteredAuctions = useMemo(() => {
      let filtered = [...auctions];
      const now = new Date();
      
      if (activeView === 'lastChance') {
          filtered = filtered
            .filter(i => i.status === 'active' && new Date(i.endTime) > now)
            .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
            .slice(0, 200);
      } else {
          filtered = filtered.filter(item => {
              if (new Date(item.endTime) <= now) return false;
              if (selectedRegion && item.region !== selectedRegion) return false;
              if (selectedCategory && item.category !== selectedCategory) return false;
              if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  const titleMatch = (item.title[language] || item.title['SLO']).toLowerCase().includes(q);
                  const locationMatch = (item.location[language] || item.location['SLO']).toLowerCase().includes(q);
                  return titleMatch || locationMatch;
              }
              return true;
          });
      }
      return filtered;
  }, [auctions, activeView, selectedRegion, selectedCategory, searchQuery, language]);

  const totalPages = Math.ceil(getFilteredAuctions.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAuctions = getFilteredAuctions.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const isHomePage = activeView === 'grid' && !selectedCategory && !searchQuery;
    
    if (isHomePage && auctionsSectionRef.current) {
        auctionsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const paginationNumbers = useMemo(() => {
      if (totalPages <= 7) return Array.from({length: totalPages}, (_, i) => i + 1);
      if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
      if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [currentPage, totalPages]);

  let content;
  switch (activeView) {
    case 'login': 
        content = (
            <AuthView 
                t={t} 
                onLoginSuccess={() => {
                    setIsLoggedIn(true);
                    setSelectedRegion(null);
                    setSelectedCategory(null);
                    setSearchQuery('');
                    setActiveView('grid');
                    window.scrollTo({ top: 0, behavior: 'instant' });
                    
                    // If it's a demo login (no session), we need to set a fake user ID
                    supabase.auth.getSession().then(({ data: { session } }) => {
                        if (!session) {
                            setIsAuthLoading(false);
                            setUserData(prev => ({
                                ...prev,
                                id: 'demo-user-id',
                                firstName: 'Demo',
                                lastName: 'Uporabnik',
                                email: 'demo@example.com',
                            }));
                        }
                    });
                }} 
                setIsVerified={setIsVerified} 
                setAppLoggedIn={(val) => setIsLoggedIn(val)}
            />
        ); 
        break;
    case 'createAuction': 
      if (!isLoggedIn) {
          content = <AuthView onLoginSuccess={() => setActiveView('createAuction')} t={t} />;
      } else if (!userData.stripe_onboarding_complete && IS_LIVE) {
          content = (
              <div className="max-w-3xl mx-auto py-32 px-6 flex flex-col items-center text-center animate-in">
                  <div className="bg-red-50 text-red-500 w-24 h-24 rounded-full flex items-center justify-center mb-8 border-4 border-red-100">
                     <AlertCircle size={48} />
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-6">Plačila niso nastavljena</h2>
                  <p className="text-lg font-bold text-slate-500 mb-10 max-w-xl">
                      Za objavo dražbe morate najprej overiti svoj bančni račun preko sistema Stripe za prejemanje nakazil (Destination charges).
                  </p>
                  <button onClick={() => { setActiveView('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-xl">
                      Pojdi v nastavitve
                  </button>
              </div>
          );
      } else if (!userData.stripe_onboarding_complete) {
          // Allow testing if not IS_LIVE, but still show a warning or just block. The prompt says "ne more objaviti". So let's block even in mock if possible, or assume backend is ready? Let's just block strictly.
          content = (
              <div className="max-w-3xl mx-auto py-32 px-6 flex flex-col items-center text-center animate-in">
                  <div className="bg-red-50 text-red-500 w-24 h-24 rounded-full flex items-center justify-center mb-8 border-4 border-red-100">
                     <AlertCircle size={48} />
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-6">Plačila niso nastavljena</h2>
                  <p className="text-lg font-bold text-slate-500 mb-10 max-w-xl">
                      Za objavo dražbe morate najprej overiti svoj bančni račun preko sistema Stripe za prejemanje nakazil.
                  </p>
                  <button onClick={() => { setActiveView('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-xl">
                      Pojdi v nastavitve
                  </button>
              </div>
          );
      } else {
          content = <CreateAuctionForm onBack={() => setActiveView('grid')} t={t} onPublish={handlePublish} isLoggedIn={isLoggedIn} />; 
      }
      break;
    case 'chat': content = <ChatView onBack={() => setActiveView('grid')} t={t} currentUserId={userData.id} language={language} />; break;
    case 'detail':
      if (selectedItem) content = (
        <AuctionView 
          item={selectedItem} 
          t={t} 
          language={language} 
          isVerified={isVerified} 
          isWatched={watchedIds.includes(selectedItem.id)}
          onWatchToggle={() => toggleWatch(selectedItem.id)}
          currentPlan={currentPlan} 
          currentUserId={userData.id}
          onBack={() => { setActiveView('grid'); setSelectedItem(null); }} 
          onBidSubmit={handleBidSubmit} 
          onCheckout={(item) => { 
            setCheckoutData({ 
              amount: item.currentBid || item.current_price, 
              title: item.title?.[language] || item.title?.['SLO'] || t('auctionFallback'), 
              onSuccess: async () => { 
                await supabase.from('auctions').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', item.id);
                toast.success(t('paymentSuccess')); 
                setIsCheckoutOpen(false); 
                fetchAuctions();
              },
              metadata: {
                auction_id: item.id,
                buyer_id: userData.id,
                seller_id: item.sellerId || item.seller_id,
                fee_percentage: 10
              }
            }); 
            setIsCheckoutOpen(true); 
          }} 
          onSellerClick={(seller) => {
            setSelectedSeller(seller);
            setActiveView('sellerProfile');
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        />
      );
      else setActiveView('grid');
      break;
    case 'verification':
        content = (
            <VerificationView 
                onBack={() => setActiveView('grid')} 
                t={t} 
                isVerified={isVerified} 
                userType={userType}
                initialData={userData}
                onVerify={async (type, data) => {
                    console.log("Starting verification process for type:", type, "with data:", data);
                    try {
                        let userId = userData.id;
                        
                        if (!userId) {
                            console.log("No userId in state, fetching session...");
                            const { data: { session } } = await supabase.auth.getSession();
                            userId = session?.user?.id || '';
                            console.log("Session fetched:", userId);
                        } else {
                            console.log("Using userId from state:", userId);
                        }
                        
                        if (!userId) {
                            throw new Error("Uporabnik ni prijavljen.");
                        }

                        // Prepare data to override ALL relevant fields
                        const updateData: any = {
                            id: userId,
                            email: data.email,
                            is_verified: true,
                            user_type: type,
                            first_name: data.firstName || null,
                            last_name: data.lastName || null,
                            street: data.street || null,
                            city: data.city || null,
                            postal_code: data.postalCode || null,
                            tax_number: data.taxNumber || null,
                            company_name: data.companyName || null,
                            company_street: data.companyStreet || null,
                            company_city: data.companyCity || null,
                            company_postal_code: data.companyPostalCode || null,
                            representative: data.representative || null
                        };

                        console.log("Updating verification data:", updateData);
                        
                        const updatePromise = supabase
                            .from('users')
                            .update(updateData)
                            .eq('id', userId)
                            .select()
                            .single();
                            
                        const timeoutPromise = new Promise<{data: any, error: any}>(resolve => 
                            setTimeout(() => resolve({ data: null, error: { message: "Povezava s strežnikom je potekla. Prosimo, osvežite stran in poskusite znova." } }), 8000)
                        );
                        
                        const { data: updatedUser, error } = await Promise.race([updatePromise, timeoutPromise]) as any;
                        
                        if (error) {
                            console.error("Supabase update error:", error);
                            throw new Error(`Napaka pri shranjevanju: ${error.message}`);
                        }

                        console.log("Verification data saved successfully. Updating state...");
                        setIsVerified(true);
                        setUserType(type);
                            
                        if (updatedUser) {
                            console.log("Updated user data fetched:", updatedUser);
                            setUserData(prev => ({ ...prev, ...updatedUser, id: userId, is_verified: true }));
                        }

                        toast.success("Verifikacija uspešna!");
                        return true;
                    } catch (err: any) {
                        console.error("Detailed verification error:", err);
                        toast.error(err.message || "Prišlo je do napake pri verifikaciji.");
                        throw err;
                    }
                }}
            />
        );
        break;
    case 'settings':
        content = <SettingsView t={t} language={language} user={userData} onSave={handleSaveSettings} onVerify={() => setActiveView('verification')} onStripeVerified={async () => {
             const { data } = await supabase.from('users').select('*').eq('id', userData.id).single();
             if (data) {
                 setUserData(prev => ({ ...prev, stripe_onboarding_complete: data.stripe_onboarding_complete, stripe_account_id: data.stripe_account_id }));
             } else {
                 setUserData(prev => ({ ...prev, stripe_onboarding_complete: true }));
             }
             toast.success('Plačila so uspešno nastavljena! Sedaj lahko objavljate dražbe.');
        }}/>;
        break;
    case 'subscriptions':
        content = <SubscriptionsView t={t} currentPlan={currentPlan} onSubscribe={handleSubscribe} isVerified={isVerified} />;
        break;
    case 'myBids':
        content = (
            <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
                <button onClick={() => setActiveView('grid')} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> {t('back')}</button>
                <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 min-h-[500px]">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="bg-[#FEBA4F] p-4 rounded-3xl shadow-lg shadow-[#FEBA4F]/20">
                            <Gavel size={40} className="text-[#0A1128]" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128]">{t('myBids')}</h2>
                            <p className="text-slate-400 font-bold mt-2">{t('myBidsDesc')}</p>
                        </div>
                    </div>
                    
                    <div className="grid gap-8 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 320px))' }}>
                        {auctions.filter(a => bidAuctionIds.includes(a.id)).filter(a => !((a.winner_id === userData.id || a.winnerId === userData.id) && (a.status === 'completed' || new Date(a.endTime) <= new Date()))).map(item => (
                            <AuctionCard 
                                key={item.id} 
                                item={item} 
                                t={t} 
                                language={language} 
                                isVerified={isVerified} 
                                currentUserId={userData.id}
                                hasBid={true}
                                isWatched={watchedIds.includes(item.id)}
                                onWatchToggle={() => toggleWatch(item.id)}
                                onClick={() => { setSelectedItem(item); setActiveView('detail'); }} 
                                onBidSubmit={handleBidSubmit} 
                                onSellerClick={(seller) => { setSelectedSeller(seller); setActiveView('sellerProfile'); }} 
                            />
                        ))}
                        {auctions.filter(a => bidAuctionIds.includes(a.id)).filter(a => !((a.winner_id === userData.id || a.winnerId === userData.id) && (a.status === 'completed' || new Date(a.endTime) <= new Date()))).length === 0 && (
                            <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <Gavel size={48} className="mx-auto mb-4 text-slate-300" />
                                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">{t('noBids')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
        break;
    case 'sellerProfile':
        if (selectedSeller) {
            content = (
                <SellerView 
                    seller={selectedSeller} 
                    onBack={() => setActiveView('grid')} 
                    onAuctionClick={(item) => {
                        setSelectedItem(item);
                        setActiveView('detail');
                    }}
                    t={t}
                    language={language}
                    isLoggedIn={isLoggedIn}
                    currentUserWinnings={currentUserWinnings}
                />
            );
        } else {
            setActiveView('grid');
        }
        break;
    case 'winnings':
        content = (
            <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
                <button onClick={() => setActiveView('grid')} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
                <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 min-h-[500px]">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="bg-[#FEBA4F] p-4 rounded-3xl shadow-lg shadow-[#FEBA4F]/20">
                            <Trophy size={40} className="text-[#0A1128]" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128]">{t('myWinnings')}</h2>
                            <p className="text-slate-400 font-bold mt-2">Pregled in plačilo dobljenih dražb</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {currentUserWinnings.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-slate-500 font-black uppercase tracking-widest text-lg">{t('noWinnings')}</p>
                            </div>
                        ) : currentUserWinnings.map(wonItem => {
                            const feePercentage = currentPlan === SubscriptionTier.PRO ? 5 : currentPlan === SubscriptionTier.BASIC ? 10 : 12;
                            const commissionNet = wonItem.currentBid * (feePercentage / 100);
                            const totalAmountToPay = wonItem.currentBid + (commissionNet * 1.22);
                            
                            return (
                            <div key={wonItem.id} className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-[2.5rem] border-2 border-slate-100 hover:border-[#FEBA4F] transition-colors group">
                                <SignedImg 
                                    src={wonItem.images[0]} 
                                    alt="Item" 
                                    className="w-32 h-32 rounded-3xl object-cover shadow-md group-hover:scale-105 transition-transform cursor-pointer" 
                                    onClick={() => {
                                        setSelectedItem(wonItem);
                                        setActiveView('detail');
                                        window.scrollTo({ top: 0, behavior: 'instant' });
                                    }}
                                />
                                <div className="flex-1 text-center md:text-left">
                                    <h3 
                                        className="text-2xl font-black uppercase tracking-tighter text-[#0A1128] mb-2 cursor-pointer hover:text-[#FEBA4F] transition-colors"
                                        onClick={() => {
                                            setSelectedItem(wonItem);
                                            setActiveView('detail');
                                            window.scrollTo({ top: 0, behavior: 'instant' });
                                        }}
                                    >
                                        {wonItem.title[language as keyof typeof wonItem.title] || wonItem.title.SLO}
                                    </h3>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-bold text-slate-400">
                                        <span className="flex items-center gap-1.5"><Gavel size={16}/> Končni znesek (vklj. s provizijo in DDV): <span className="text-[#0A1128] font-black">€{totalAmountToPay.toLocaleString('sl-SI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 w-full md:w-auto">
                                    {wonItem.payment_status === 'paid' ? (
                                        <div className="flex flex-col items-center md:items-end gap-2">
                                            <div className="bg-green-50 text-green-600 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2 border-2 border-green-100">
                                                <CheckCircle2 size={18} /> Plačano
                                            </div>
                                            {wonItem.paid_at && (
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    Plačano dne: {new Date(wonItem.paid_at).toLocaleDateString('sl-SI')}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={async () => {
                                                setCheckoutData({
                                                    amount: parseFloat(totalAmountToPay.toFixed(2)),
                                                    title: `Plačilo za: ${wonItem.title.SLO}`,
                                                    onSuccess: async () => {
                                                        await supabase.from('auctions').update({ payment_status: 'paid', paid_at: new Date().toISOString() }).eq('id', wonItem.id);
                                                        setIsCheckoutOpen(false);
                                                        toast.success('Plačilo uspešno! Račun in potrdilo sta bila poslana na vaš e-mail.');
                                                        // Refresh to show paid status
                                                        setTimeout(() => fetchAuctions(), 1500);
                                                    },
                                                    metadata: {
                                                        auction_id: wonItem.id,
                                                        buyer_id: userData.id,
                                                        seller_id: wonItem.sellerId,
                                                        fee_percentage: feePercentage
                                                    }
                                                });
                                                setIsCheckoutOpen(true);
                                            }}
                                            className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl flex items-center justify-center gap-2"
                                        >
                                            <CardIcon size={18} /> Plačaj zdaj
                                        </button>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
        break;
    case 'watchlist':
        content = (
            <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
                <button onClick={() => setActiveView('grid')} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
                <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 min-h-[500px]">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="bg-[#FEBA4F] p-4 rounded-3xl shadow-lg shadow-[#FEBA4F]/20">
                            <Eye size={40} className="text-[#0A1128]" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128]">Opazovane dražbe</h2>
                            <p className="text-slate-400 font-bold mt-2">Dražbe, ki jih spremljate</p>
                        </div>
                    </div>
                    
                    <div className="grid gap-8 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 320px))' }}>
                        {auctions.filter(a => watchedIds.includes(a.id)).filter(a => !((a.winner_id === userData.id || a.winnerId === userData.id) && (a.status === 'completed' || new Date(a.endTime) <= new Date()))).map(item => (
                            <AuctionCard 
                                key={item.id} 
                                item={item} 
                                t={t} 
                                language={language} 
                                isVerified={isVerified} 
                                currentUserId={userData.id}
                                hasBid={bidAuctionIds.includes(item.id)}
                                isWatched={true}
                                onWatchToggle={() => toggleWatch(item.id)}
                                onClick={() => { setSelectedItem(item); setActiveView('detail'); }} 
                                onBidSubmit={handleBidSubmit} 
                                onSellerClick={(seller) => { setSelectedSeller(seller); setActiveView('sellerProfile'); }} 
                            />
                        ))}
                        {auctions.filter(a => watchedIds.includes(a.id)).filter(a => !((a.winner_id === userData.id || a.winnerId === userData.id) && (a.status === 'completed' || new Date(a.endTime) <= new Date()))).length === 0 && (
                            <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <Eye size={48} className="mx-auto mb-4 text-slate-300" />
                                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Nimate opazovanih dražb</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
        break;
    default:
      content = (
        <div className="animate-in">
          {activeView === 'grid' && !selectedCategory && !searchQuery && !selectedRegion && (
              <HeroCarousel 
                  items={auctions} 
                  onSelectItem={(item) => { 
                      window.scrollTo({ top: 0, behavior: 'instant' }); 
                      setSelectedItem(item); 
                      setActiveView('detail'); 
                  }} 
                  t={t} 
                  language={language} 
              />
          )}
          <div className="max-w-[1600px] mx-auto px-6 py-12">
            <div ref={auctionsSectionRef} className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 scroll-mt-32">
                <div className="flex items-center gap-4">
                    <div className="bg-[#FEBA4F] w-2.5 h-10 rounded-full shadow-lg"></div>
                    <h2 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter italic">
                        {activeView === 'lastChance' ? t('lastChanceTitle') : (selectedRegion ? `${t('regions')}: ${selectedRegion}` : (selectedCategory ? `${t('category')}: ${selectedCategory}` : (searchQuery ? `Rezultati: "${searchQuery}"` : t('activeAuctions'))))}
                    </h2>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase text-slate-400">{t('itemsPerPage')}</span>
                    <select 
                        className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-black shadow-sm outline-none focus:border-[#FEBA4F] transition-colors cursor-pointer" 
                        value={baseItemsPerPage} 
                        onChange={e => {
                            setBaseItemsPerPage(parseInt(e.target.value));
                            setCurrentPage(1);
                        }}
                    >
                        <option value="12">Prikaži ~12</option>
                        <option value="24">Prikaži ~24</option>
                        <option value="48">Prikaži ~48</option>
                        <option value="96">Prikaži ~96</option>
                    </select>
                </div>
            </div>
            <div className="grid gap-8 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 320px))' }}>
                {currentAuctions.map(item => (
                    <AuctionCard 
                        key={item.id} 
                        item={item} 
                        t={t} 
                        language={language} 
                        isVerified={isVerified} 
                        currentUserId={userData.id}
                        hasBid={bidAuctionIds.includes(item.id)}
                        isWatched={watchedIds.includes(item.id)}
                        onWatchToggle={() => toggleWatch(item.id)}
                        onClick={() => { 
                            window.scrollTo({ top: 0, behavior: 'instant' });
                            setSelectedItem(item); 
                            setActiveView('detail'); 
                        }} 
                        onBidSubmit={handleBidSubmit} 
                        onSellerClick={(seller) => { 
                            setSelectedSeller(seller); 
                            setActiveView('sellerProfile'); 
                            window.scrollTo({ top: 0, behavior: 'instant' });
                        }} 
                        onTimeUp={(auctionId) => {
                            // Force a re-render so activeAuctions filter recalculates and removes this item
                            setAuctions(prev => [...prev]);
                        }}
                    />
                ))}
            </div>
            {totalPages > 1 && (
                <div className="mt-20 flex flex-col md:flex-row items-center justify-between gap-8 border-t-2 border-slate-100 pt-12">
                    <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('showing')} {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, getFilteredAuctions.length)} {t('of')} {getFilteredAuctions.length} {t('auctions')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={`p-4 rounded-2xl border-2 transition-all ${currentPage === 1 ? 'border-slate-50 text-slate-200' : 'border-slate-100 text-[#0A1128] hover:border-[#FEBA4F]'}`}><ChevronLeft size={20}/></button>
                        <div className="flex items-center gap-2">
                            {paginationNumbers.map((p, idx) => typeof p === 'string' ? <span key={idx} className="px-3 text-slate-400 font-bold">...</span> : <button key={idx} onClick={() => handlePageChange(p as number)} className={`w-12 h-12 rounded-2xl font-black text-sm transition-all shadow-sm ${currentPage === p ? 'bg-[#0A1128] text-white scale-110' : 'bg-white border-2 border-slate-50 text-slate-400 hover:border-slate-200'}`}>{p}</button>)}
                        </div>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`p-4 rounded-2xl border-2 transition-all ${currentPage === totalPages ? 'border-slate-50 text-slate-200' : 'border-slate-100 text-[#0A1128] hover:border-[#FEBA4F]'}`}><ChevronRight size={20}/></button>
                    </div>
                </div>
            )}
          </div>
        </div>
      );
  }

  // Banner is active if user is logged in, not verified, and auth data has finished loading
  const isBannerActive = !isAuthLoading && isLoggedIn && !isVerified;

  // Sync isVerified state with userData as a fallback
  useEffect(() => {
    const userDataVerified = !!(userData as any).is_verified || !!(userData as any).isVerified || !!(userData as any).isverified;
    if (isLoggedIn && isVerified !== userDataVerified) {
      console.log("Syncing isVerified from userData:", userDataVerified);
      setIsVerified(userDataVerified);
    }
  }, [userData, isLoggedIn, isVerified]);

  console.log("RENDER DEBUG:", { isLoggedIn, isVerified, isBannerActive });

  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans selection:bg-[#FEBA4F] selection:text-[#0A1128] overflow-x-hidden">
        <Toaster 
            position="top-center" 
            duration={4000}
            richColors
            toastOptions={{
                style: {
                    background: '#0A1128',
                    color: '#ffffff',
                    border: '1px solid #FEBA4F',
                    borderRadius: '1rem',
                    padding: '16px 20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                },
                className: 'shadow-2xl'
            }} 
        />
        <VerificationBanner isVisible={isBannerActive} onAction={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('verification'); }} t={t} />
        <Header 
            onHome={() => { setActiveView('grid'); setSelectedRegion(null); setSelectedCategory(null); setSearchQuery(''); }} 
            onSearch={setSearchQuery} 
            onRegionSelect={(reg) => { setSelectedRegion(reg); setActiveView('grid'); }}
            onCategorySelect={(cat) => { setSelectedCategory(cat); setActiveView('grid'); }} 
            onLastChance={() => { setActiveView('lastChance'); setSelectedRegion(null); setSelectedCategory(null); }} 
            onLogin={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('login'); }} 
            onLogout={handleLogout} 
            onSettings={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('settings'); }} 
            onSubscriptions={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('subscriptions'); }}
            onCreateAuction={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('createAuction'); }} 
            onMyWinnings={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('winnings'); }} 
            onMyBids={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('myBids'); }}
            onChat={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('chat'); }}
            onWatchlist={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('watchlist'); }}
            activeView={activeView} 
            selectedRegion={selectedRegion}
            selectedCategory={selectedCategory} 
            isLoggedIn={isLoggedIn} 
            isVerified={isVerified} 
            language={language} 
            onLanguageChange={setLanguage} 
            t={t} 
            auctions={auctions}
            userEmail={userData.email}
            userProfilePicture={userData.profile_picture_url || userData.profilePicture}
        />
        <main>{content}</main>
        {activeView === 'grid' && <Footer t={t} onLegal={setActiveLegal} />}
        {showTermsModal && (
            <div className="fixed inset-0 bg-[#0A1128]/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-in">
                <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 lg:p-14 shadow-2xl relative">
                    <button onClick={handleCancelTerms} className="absolute top-8 right-8 text-slate-400 hover:text-[#0A1128] transition-colors"><X size={24}/></button>
                    <div className="bg-[#FEBA4F] w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-[#FEBA4F]/20">
                        <ShieldCheck size={40} className="text-[#0A1128]" />
                    </div>
                    <h2 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">Splošni pogoji poslovanja</h2>
                    <p className="text-slate-500 font-bold leading-relaxed mb-6">
                        Z oddajo ponudbe potrjujete, da se strinjate s splošnimi pogoji poslovanja platforme Drazba.si. 
                        Vaša ponudba je pravno zavezujoča. V primeru, da zmagate na dražbi, ste dolžni predmet prevzeti in plačati v skladu s pogoji prodajalca.
                    </p>
                    <label className="flex items-center gap-3 mb-10 cursor-pointer group">
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${dontShowTermsAgain ? 'bg-[#FEBA4F] border-[#FEBA4F]' : 'border-slate-300 group-hover:border-[#FEBA4F]'}`}>
                            {dontShowTermsAgain && <CheckCircle2 size={16} className="text-[#0A1128]" />}
                        </div>
                        <span className="text-sm font-bold text-slate-600 select-none">Ne prikaži več tega obvestila</span>
                        <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={dontShowTermsAgain} 
                            onChange={(e) => setDontShowTermsAgain(e.target.checked)} 
                        />
                    </label>
                    <button 
                        onClick={handleAcceptTerms}
                        className="w-full bg-[#0A1128] text-white py-6 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl"
                    >
                        Strinjam se in potrjujem ponudbo
                    </button>
                </div>
            </div>
        )}
        {pendingBid && (
            <ConfirmBidModal 
                isOpen={showConfirmBidModal}
                onClose={handleCancelConfirmBid}
                item={pendingBid.item}
                initialBidAmount={pendingBid.amount}
                currentPlan={currentPlan}
                t={t}
                onConfirm={handleConfirmBid}
                userData={userData}
            />
        )}
        {activeLegal && <LegalModal type={activeLegal} onClose={() => setActiveLegal(null)} t={t} />}
        {isCheckoutOpen && checkoutData && (
            <CheckoutModal 
                isOpen={isCheckoutOpen}
                t={t} 
                amount={checkoutData.amount} 
                title={checkoutData.title} 
                onClose={() => setIsCheckoutOpen(false)} 
                onSuccess={checkoutData.onSuccess} 
                metadata={checkoutData.metadata}
            />
        )}
        {showBackToTop && (
            <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                className="fixed bottom-12 right-12 bg-[#FEBA4F] text-[#0A1128] p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 border-2 border-[#0A1128]"
            >
                <ArrowUp size={24} strokeWidth={3} />
            </button>
        )}
    </div>
  );
};

// --- ADDITIONAL COMPONENTS ---

export default App;