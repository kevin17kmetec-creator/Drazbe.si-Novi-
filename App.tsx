import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AuctionView from './src/components/AuctionView';
import SellerView from './src/components/SellerView';
import { SubscriptionsView } from './src/components/SubscriptionsView';
import { VerificationView } from './src/components/VerificationView';
import { CreateAuctionForm } from './src/components/CreateAuctionForm';
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

import { supabase } from './src/lib/supabaseClient';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx');
import { AuctionItem, Region, ViewState, Seller, Review, SellerType, SubscriptionTier, PaymentCard, WonItem, Category } from './types.ts';

import { Toaster, toast } from 'sonner';

// --- CONFIGURATION ---
const IS_LIVE = false; 

import { EXTENDED_MOCK_AUCTIONS } from './src/lib/mockData';

import { translations } from './src/lib/translations';
import { getIncrement, formatSeconds } from './src/lib/utils';

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [language, setLanguage] = useState('SLO');
  const t = (key: string) => translations[language]?.[key] || key;
  
  const [auctions, setAuctions] = useState<AuctionItem[]>(EXTENDED_MOCK_AUCTIONS);
  const [activeView, setActiveView] = useState<ViewState>('grid');
  const [bidAuctionIds, setBidAuctionIds] = useState<string[]>([]);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
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
  const [checkoutData, setCheckoutData] = useState<{ amount: number; title: string; onSuccess: () => void } | null>(null);
  const [userData, setUserData] = useState({ firstName: '', lastName: '', email: '', profilePicture: '', is_verified: false });
  
  const [selectedItem, setSelectedItem] = useState<AuctionItem | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [currentUserWinnings, setCurrentUserWinnings] = useState<AuctionItem[]>([]);

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
              bidCount: d.bid_count || d.bidCount,
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
              else merged.push(fd);
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

    const fetchWinnings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setCurrentUserWinnings([]);
            return;
        }

        // Fetch auctions where the user is the winner (highest bidder and auction ended)
        // For simplicity in this mock-heavy app, we'll fetch auctions where winner_id matches
        const { data, error } = await supabase
            .from('auctions')
            .select('*')
            .eq('winner_id', user.id);

        if (error) {
            console.error("Error fetching winnings:", error);
            return;
        }

        const wonItems: AuctionItem[] = data.map(d => ({
            ...d,
            endTime: new Date(d.end_time || d.endTime),
            currentBid: d.current_price || d.currentBid,
            bidCount: d.bid_count || d.bidCount
        }));
        setCurrentUserWinnings(wonItems);
      } catch (err) {
        console.error("Supabase error in fetchWinnings:", err);
      }
    };

    fetchWinnings();

    // Real-time subscription with WebSocket check
    if (typeof window !== 'undefined' && window.WebSocket) {
      try {
        const channel = supabase.channel('public:auctions')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
            fetchAuctions();
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.warn("Supabase Realtime channel error. Live updates might be unavailable.");
            }
          });

        return () => { 
          supabase.removeChannel(channel); 
        };
      } catch (err) {
        console.warn("Supabase Realtime subscription failed:", err);
      }
    } else {
      console.warn("WebSockets are not supported or blocked in this environment. Real-time updates are disabled.");
    }
  }, []);

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
              }
          }

          if (data) {
            console.log("Auth Sync - User data:", data);
            const verified = !!(data.is_verified || data.isVerified || data.isverified);
            setIsVerified(verified);
            setUserType(data.user_type || data.userType || 'individual');
            setUserData(prev => ({ ...prev, ...data, is_verified: verified }));
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
        
        // Only show loading if we are signing in or updating
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            setIsAuthLoading(true);
        }

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
              }
          }

          if (data) {
            console.log("Auth State Change - User data:", data);
            const verified = !!(data.is_verified || data.isVerified || data.isverified);
            setIsVerified(verified);
            setUserType(data.user_type || data.userType || 'individual');
            setUserData(prev => ({ ...prev, ...data, is_verified: verified }));
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

  const handleBidSubmit = async (item: AuctionItem, amount: number) => {
    if (!isLoggedIn) { setActiveView('login'); return; }
    if (!isVerified) { 
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return; 
    }
    
    if (!hasAcceptedTerms) {
        setPendingBid({ item, amount });
        setShowTermsModal(true);
        return;
    }
    
    // Check if item.id is a valid UUID before calling RPC
    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID(item.id)) {
        try {
            const { error } = await supabase.rpc('place_bid_transaction', {
                p_auction_id: item.id,
                p_amount: amount
            });
            if (error) {
                console.error("RPC Error:", error);
                throw new Error(error.message || "Napaka pri oddaji ponudbe");
            }
            const newBidIds = Array.from(new Set([...bidAuctionIds, item.id]));
            setBidAuctionIds(newBidIds);
            
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                await supabase.from('users').upsert({
                  id: session.user.id,
                  email: session.user.email,
                  bid_auction_ids: newBidIds
                });
              }
            } catch (err) {
              console.error("Error saving bid auction ids:", err);
            }
        } catch (error: any) { 
            console.error(error); 
            throw error;
        }
    } else {
        // Handle mock auctions locally
        setAuctions(prev => prev.map(a => a.id === item.id ? {...a, currentBid: amount, bidCount: a.bidCount + 1} : a));
        const newBidIds = Array.from(new Set([...bidAuctionIds, item.id]));
        setBidAuctionIds(newBidIds);
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('users').upsert({
              id: session.user.id,
              email: session.user.email,
              bid_auction_ids: newBidIds
            });
          }
        } catch (err) {
          console.error("Error saving bid auction ids:", err);
        }
    }
  };

  const handleAcceptTerms = async () => {
      setHasAcceptedTerms(true);
      setShowTermsModal(false);
      
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

      if (pendingBid) {
          handleBidSubmit(pendingBid.item, pendingBid.amount);
          setPendingBid(null);
      }
  };

  const handlePublish = async (itemData: any) => {
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session && !isLoggedIn) {
              toast.error(t('loginRequired') || "Prosimo, prijavite se za objavo dražbe.");
              setActiveView('login');
              return;
          }

          const simulatedTitle = {
              SLO: itemData.title.SLO,
              EN: `[EN] ${itemData.title.SLO}`,
              DE: `[DE] ${itemData.title.SLO}`
          };
          const simulatedDescription = {
              SLO: itemData.description,
              EN: `[EN] ${itemData.description}`,
              DE: `[DE] ${itemData.description}`
          };

          if (session) {
              const { error } = await supabase.from('auctions').insert({
                  title: simulatedTitle,
                  description: simulatedDescription,
                  current_price: parseInt(itemData.startingPrice),
                  bid_count: 0,
                  item_count: 1,
                  end_time: itemData.endTime || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
                  location: { SLO: 'Ljubljana', EN: 'Ljubljana', DE: 'Ljubljana' },
                  region: itemData.region || Region.Osrednjeslovenska,
                  category: itemData.category || Category.Ostalo,
                  condition: { SLO: 'Novo', EN: 'New', DE: 'Neu' },
                  specifications: {},
                  bidding_history: [],
                  seller_id: session.user.id,
                  status: 'active',
                  images: itemData.images
              });

              if (error) {
                  console.error("Publish Error:", error);
                  const errorMsg = error.message || JSON.stringify(error);
                  toast.error(`Napaka pri objavi v bazo: ${errorMsg}`, { duration: Infinity, closeButton: true });
                  return;
              }
          }

          setActiveView('grid');
          toast.success(t('auctionPublished'));
          if (session) fetchAuctions(); // Refresh the list from DB if real user
      } catch (error: any) { 
          console.error("HandlePublish Exception:", error); 
          const errorMsg = error.message || JSON.stringify(error);
          toast.error(`Sistemska napaka pri objavi: ${errorMsg}`, { duration: Infinity, closeButton: true });
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
      toast.success(t('loggedOut') || "Odjava uspešna.");
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
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Update password if provided
        if (data.newPassword) {
            const { error: passError } = await supabase.auth.updateUser({ password: data.newPassword });
            if (passError) {
                toast.error(`Napaka pri spremembi gesla: ${passError.message}`);
                return;
            }
        }

        // Update user profile data
        const updateData = {
            username: data.username,
            first_name: data.firstName,
            last_name: data.lastName,
            street: data.street,
            city: data.city,
            postal_code: data.postalCode,
            company_name: data.companyName,
            tax_number: data.taxNumber,
            company_street: data.companyStreet,
            company_city: data.companyCity,
            company_postal_code: data.companyPostalCode,
            representative: data.representative
        };

        const { error } = await supabase.from('users').upsert({ 
            id: session.user.id, 
            email: session.user.email,
            ...updateData 
        });

        if (error) {
            if (error.code === '23505' && error.message.includes('username')) {
                toast.error('To uporabniško ime je že zasedeno. Prosimo, izberite drugega.');
            } else {
                toast.error(`Napaka pri shranjevanju: ${error.message}`);
            }
            return;
        }

        // Refresh user data
        let { data: updatedUser } = await supabase.from('users').select('*').eq('id', session.user.id).single();
        if (updatedUser) {
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
      if (activeView === 'lastChance') {
          filtered = filtered.filter(i => i.status === 'active').sort((a, b) => a.endTime.getTime() - b.endTime.getTime()).slice(0, 200);
      } else {
          filtered = filtered.filter(item => {
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
                    setIsAuthLoading(true);
                    setSelectedRegion(null);
                    setSelectedCategory(null);
                    setSearchQuery('');
                    setActiveView('grid');
                    window.scrollTo({ top: 0, behavior: 'instant' });
                }} 
                setIsVerified={setIsVerified} 
                setAppLoggedIn={(val) => setIsLoggedIn(val)}
            />
        ); 
        break;
    case 'createAuction': content = <CreateAuctionForm onBack={() => setActiveView('grid')} t={t} onPublish={handlePublish} isLoggedIn={isLoggedIn} />; break;
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
          onBack={() => { setActiveView('grid'); setSelectedItem(null); }} 
          onBidSubmit={handleBidSubmit} 
          onCheckout={(item) => { 
            setCheckoutData({ 
              amount: item.currentBid || item.current_price, 
              title: item.title?.[language] || item.title?.['SLO'] || t('auctionFallback'), 
              onSuccess: () => { toast.success(t('paymentSuccess')); setIsCheckoutOpen(false); } 
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
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.user) {
                            throw new Error("Uporabnik ni prijavljen.");
                        }

                        // Prepare data to override ALL relevant fields
                        // This ensures old data from previous verification is cleared
                        const updateData: any = {
                            id: session.user.id,
                            email: data.email,
                            is_verified: true,
                            user_type: type,
                            // Reset all fields first to ensure override
                            first_name: null,
                            last_name: null,
                            street: null,
                            city: null,
                            postal_code: null,
                            tax_number: null,
                            company_name: null,
                            company_street: null,
                            company_city: null,
                            company_postal_code: null,
                            representative: null
                        };

                        if (type === 'individual') {
                            updateData.first_name = data.firstName;
                            updateData.last_name = data.lastName;
                            updateData.street = data.street;
                            updateData.city = data.city;
                            updateData.postal_code = data.postalCode;
                            updateData.tax_number = data.taxNumber;
                        } else {
                            updateData.company_name = data.companyName;
                            updateData.tax_number = data.taxNumber;
                            updateData.company_street = data.companyStreet;
                            updateData.company_city = data.companyCity;
                            updateData.company_postal_code = data.companyPostalCode;
                            updateData.representative = data.representative;
                        }

                        console.log("Upserting verification data:", updateData);
                        
                        // Use upsert with onConflict to ensure it replaces the record
                        const { error } = await supabase.from('users').upsert(updateData, { onConflict: 'id' });
                        
                        if (error) {
                            console.error("Supabase upsert error:", error);
                            throw new Error(`Napaka pri shranjevanju: ${error.message}`);
                        }

                        console.log("Verification data saved successfully.");
                        setIsVerified(true);
                        setUserType(type);
                        
                        // Refresh user data
                        const { data: updatedUser, error: fetchError } = await supabase
                            .from('users')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();
                            
                        if (fetchError) {
                            console.warn("Could not fetch updated user data:", fetchError);
                        } else if (updatedUser) {
                            setUserData(prev => ({ ...prev, ...updatedUser, is_verified: true }));
                        }

                        toast.success("Verifikacija uspešna!");
                        
                        // Redirect to home
                        setTimeout(() => {
                            setActiveView('grid');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }, 800);

                        return true; // Resolve the promise for VerificationView
                    } catch (err: any) {
                        console.error("Detailed verification error:", err);
                        toast.error(err.message || "Prišlo je do napake pri verifikaciji.");
                        throw err; // Reject the promise so VerificationView stops loading
                    }
                }}
            />
        );
        break;
    case 'settings':
        content = <SettingsView t={t} user={userData} onSave={handleSaveSettings} onVerify={() => setActiveView('verification')} />;
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
                        {auctions.filter(a => bidAuctionIds.includes(a.id)).map(item => (
                            <AuctionCard 
                                key={item.id} 
                                item={item} 
                                t={t} 
                                language={language} 
                                isVerified={isVerified} 
                                isWatched={watchedIds.includes(item.id)}
                                onWatchToggle={() => toggleWatch(item.id)}
                                onClick={() => { setSelectedItem(item); setActiveView('detail'); }} 
                                onBidSubmit={handleBidSubmit} 
                                onSellerClick={(seller) => { setSelectedSeller(seller); setActiveView('sellerProfile'); }} 
                            />
                        ))}
                        {auctions.filter(a => bidAuctionIds.includes(a.id)).length === 0 && (
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
        const mockWonItem = {
            id: 'mock-win-1',
            title: { SLO: 'Rolex Submariner', EN: 'Rolex Submariner', DE: 'Rolex Submariner' },
            currentBid: 8500,
            images: ['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80'],
            paymentStatus: 'pending'
        };
        content = (
            <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
                <button onClick={() => setActiveView('grid')} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
                <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 min-h-[500px]">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="bg-[#FEBA4F] p-4 rounded-3xl shadow-lg shadow-[#FEBA4F]/20">
                            <Trophy size={40} className="text-[#0A1128]" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128]">Moje zmage</h2>
                            <p className="text-slate-400 font-bold mt-2">Pregled in plačilo dobljenih dražb</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-[2.5rem] border-2 border-slate-100 hover:border-[#FEBA4F] transition-colors group">
                            <img src={mockWonItem.images[0]} alt="Item" className="w-32 h-32 rounded-3xl object-cover shadow-md group-hover:scale-105 transition-transform" />
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0A1128] mb-2">{mockWonItem.title[language as keyof typeof mockWonItem.title] || mockWonItem.title.SLO}</h3>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-bold text-slate-400">
                                    <span className="flex items-center gap-1.5"><Gavel size={16}/> Končni znesek: <span className="text-[#0A1128] font-black">€{mockWonItem.currentBid.toLocaleString('sl-SI')}</span></span>
                                    <span className="flex items-center gap-1.5"><Clock size={16}/> Dobljeno: <span className="text-[#0A1128] font-black">Danes</span></span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => {
                                        setCheckoutData({
                                            amount: mockWonItem.currentBid,
                                            title: `Plačilo za: ${mockWonItem.title.SLO}`,
                                            onSuccess: () => {
                                                setIsCheckoutOpen(false);
                                                toast.success(t('paymentSuccess'));
                                            }
                                        });
                                        setIsCheckoutOpen(true);
                                    }}
                                    className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl flex items-center justify-center gap-2"
                                >
                                    <CardIcon size={18} /> Plačaj zdaj
                                </button>
                            </div>
                        </div>
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
                        {auctions.filter(a => watchedIds.includes(a.id)).map(item => (
                            <AuctionCard 
                                key={item.id} 
                                item={item} 
                                t={t} 
                                language={language} 
                                isVerified={isVerified} 
                                isWatched={true}
                                onWatchToggle={() => toggleWatch(item.id)}
                                onClick={() => { setSelectedItem(item); setActiveView('detail'); }} 
                                onBidSubmit={handleBidSubmit} 
                                onSellerClick={(seller) => { setSelectedSeller(seller); setActiveView('sellerProfile'); }} 
                            />
                        ))}
                        {auctions.filter(a => watchedIds.includes(a.id)).length === 0 && (
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
              {(() => {
                const activeAuctions = currentAuctions.filter(item => new Date(item.endTime) > new Date());
                
                return (
                    <>
                        {activeAuctions.map(item => (
                            <AuctionCard 
                                key={item.id} 
                                item={item} 
                                t={t} 
                                language={language} 
                                isVerified={isVerified} 
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
                            />
                        ))}
                    </>
                );
              })()}
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

  // Banner is active if user is logged in and not verified
  const isBannerActive = isLoggedIn && !isVerified;

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
        <Toaster position="top-center" duration={2000} />
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
        />
        <main>{content}</main>
        {activeView === 'grid' && <Footer t={t} onLegal={setActiveLegal} />}
        {showTermsModal && (
            <div className="fixed inset-0 bg-[#0A1128]/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-in">
                <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 lg:p-14 shadow-2xl relative">
                    <button onClick={() => setShowTermsModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-[#0A1128] transition-colors"><X size={24}/></button>
                    <div className="bg-[#FEBA4F] w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-[#FEBA4F]/20">
                        <ShieldCheck size={40} className="text-[#0A1128]" />
                    </div>
                    <h2 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">Splošni pogoji poslovanja</h2>
                    <p className="text-slate-500 font-bold leading-relaxed mb-10">
                        Z oddajo ponudbe potrjujete, da se strinjate s splošnimi pogoji poslovanja platforme Drazba.si. 
                        Vaša ponudba je pravno zavezujoča. V primeru, da zmagate na dražbi, ste dolžni predmet prevzeti in plačati v skladu s pogoji prodajalca.
                    </p>
                    <button 
                        onClick={handleAcceptTerms}
                        className="w-full bg-[#0A1128] text-white py-6 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl"
                    >
                        Strinjam se in potrjujem ponudbo
                    </button>
                </div>
            </div>
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