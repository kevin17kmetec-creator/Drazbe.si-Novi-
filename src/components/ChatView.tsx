import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, ArrowLeft, MessageSquare, Clock, Gavel, CheckCircle2, Star } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { AuctionItem, Seller, SellerType, SubscriptionTier } from '../../types.ts';
import { toast } from 'sonner';

interface Message {
    id: string;
    auction_id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
}

interface ChatSession {
    auction: AuctionItem;
    otherPartyId: string;
    otherPartyEmail: string;
    otherPartyPic?: string;
    lastMessage?: string;
}

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

export const ChatView: React.FC<{ 
    onBack: () => void; 
    t: any; 
    currentUserId: string;
    language: string;
    onViewProfile?: (seller: Seller) => void;
    onViewAuction?: (item: AuctionItem) => void;
    onMessagesRead?: () => void;
    initialAuctionId?: string | null;
}> = ({ onBack, t, currentUserId, language, onViewProfile, onViewAuction, onMessagesRead, initialAuctionId }) => {
    const [buyingSessions, setBuyingSessions] = useState<ChatSession[]>([]);
    const [sellingSessions, setSellingSessions] = useState<ChatSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastFocusRef = useRef<number>(0);
    const loadTimeoutRef = useRef<any>(null);
    const hasSessionsRef = useRef(false);

    // Robust loading state cleanup
    useEffect(() => {
        let timer: any;
        if (loading) {
            timer = setTimeout(() => {
                if (loading) {
                    console.warn("Messaging load timeout reached - forcing end.");
                    setLoading(false);
                }
            }, 10000);
        }
        return () => clearTimeout(timer);
    }, [loading]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Global fetch functions defined at top level for stability
    const fetchMessages = useCallback(async (auctionId: string) => {
        if (!auctionId || !currentUserId) return;
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('auction_id', auctionId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);

            // Mark unread messages sent TO the current user as read
            const unreadIds = (data || [])
                .filter((m: any) => m.receiver_id === currentUserId && !m.is_read)
                .map((m: any) => m.id);

            if (unreadIds.length > 0) {
                await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .in('id', unreadIds);
                    
                onMessagesRead?.();
                // Avoid using previous state here to ensure fresh markers
                setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
            }
        } catch (err: any) {
            console.error("Error fetching messages:", err);
            // Non-blocking catch
        }
    }, [currentUserId, onMessagesRead]);

    const fetchSessions = useCallback(async (isInitial = false) => {
        if (!currentUserId) return;
        
        if (isInitial && !hasSessionsRef.current) {
            setLoading(true);
        }

        try {
            const nowTime = new Date();
            
            // Simpler query: just get auctions where user is involved. Filter status in JS.
            const { data: auctions, error } = await supabase
                .from('auctions')
                .select('*')
                .or(`seller_id.eq.${currentUserId},winner_id.eq.${currentUserId}`);

            if (error) throw error;
            
            if (!auctions || auctions.length === 0) {
                setBuyingSessions([]);
                setSellingSessions([]);
                setLoading(false);
                return;
            }
            
            hasSessionsRef.current = true;

            const userIds = new Set<string>();
            auctions.forEach((a: any) => {
                if (a.seller_id) userIds.add(a.seller_id);
                if (a.winner_id) userIds.add(a.winner_id);
            });

            const userMap = new Map<string, any>();
            if (userIds.size > 0) {
                try {
                    const { data: users, error: usersError } = await supabase
                        .from('users')
                        .select('id, email, first_name, last_name, profile_picture_url')
                        .in('id', Array.from(userIds));

                    if (!usersError && users) {
                        users.forEach((u: any) => userMap.set(u.id, u));
                    }
                } catch (userErr) {
                    console.warn("Secondary user fetch failed:", userErr);
                }
            }

            const buying: ChatSession[] = [];
            const selling: ChatSession[] = [];

            auctions.forEach((a: any) => {
                // filter status in JS for robustness
                const status = (a.status || '').toLowerCase();
                const endTime = new Date(a.end_time || a.endTime || 0);
                const isOver = status === 'completed' || status === 'cancelled' || (endTime.getTime() > 0 && endTime.getTime() <= nowTime.getTime());
                
                if (!isOver) return;

                const isSeller = a.seller_id === currentUserId;
                const otherId = isSeller ? a.winner_id : a.seller_id;
                if (!otherId) return;

                const otherPartyData = userMap.get(otherId) || {};
                const displayName = otherPartyData.first_name && otherPartyData.last_name 
                    ? `${otherPartyData.first_name} ${otherPartyData.last_name}` 
                    : (otherPartyData.email || (isSeller ? t?.('winner') || 'Kupec' : t?.('seller') || 'Prodajalec'));

                const session: ChatSession = {
                    auction: {
                        ...a,
                        id: a.id,
                        title: a.title || { SLO: 'Dražba', EN: 'Auction' },
                        endTime: endTime,
                        currentBid: a.current_price || a.currentBid || 0,
                        bidCount: a.bid_count || a.bidCount || 0,
                        images: a.images || []
                    },
                    otherPartyId: otherId,
                    otherPartyEmail: displayName,
                    otherPartyPic: otherPartyData.profile_picture_url || ''
                };

                if (isSeller) selling.push(session);
                else buying.push(session);
            });

            buying.sort((a, b) => b.auction.endTime.getTime() - a.auction.endTime.getTime());
            selling.sort((a, b) => b.auction.endTime.getTime() - a.auction.endTime.getTime());

            setBuyingSessions(buying);
            setSellingSessions(selling);

            if (initialAuctionId) {
                setSelectedSession(prevSelected => {
                    if (!prevSelected) {
                        const target = [...buying, ...selling].find(s => s.auction.id === initialAuctionId);
                        return target || null;
                    }
                    return prevSelected;
                });
            }

        } catch (err: any) {
            console.error("Error fetching chat sessions:", err);
            if (isInitial && !hasSessionsRef.current) {
                setPageError(t?.('error') || "Prišlo je do napake pri nalaganju.");
            }
        } finally {
            setLoading(false);
        }
    }, [currentUserId, initialAuctionId]);

    // Recover from background/hibernation
    useEffect(() => {
        const handleFocus = () => {
            const now = Date.now();
            if (now - lastFocusRef.current < 5000) return;
            lastFocusRef.current = now;

            if (document.visibilityState === 'visible') {
                fetchSessions(false); 
                if (selectedSession?.auction.id) {
                    fetchMessages(selectedSession.auction.id);
                }
            }
        };

        window.addEventListener('visibilitychange', handleFocus);
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('visibilitychange', handleFocus);
            window.removeEventListener('focus', handleFocus);
        };
    }, [selectedSession?.auction.id, fetchSessions, fetchMessages]);

    useEffect(() => {
        if (!currentUserId) return;
        fetchSessions(true);
    }, [currentUserId, fetchSessions]); 

    useEffect(() => {
        scrollToBottom();
    }, [messages.length]);

    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!selectedSession?.auction.id || !currentUserId) return;
        
        const auctionId = selectedSession.auction.id;
        
        // Background fetch messages
        fetchMessages(auctionId);
        
        // Cleanup existing channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current).catch(() => {});
            channelRef.current = null;
        }

        channelRef.current = supabase
            .channel(`messages:${auctionId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `auction_id=eq.${auctionId}`
            }, async (payload) => {
                const msg = payload.new as Message;
                
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });

                if (msg.receiver_id === currentUserId && !msg.is_read) {
                    try {
                        const { error: updateError } = await supabase
                            .from('messages')
                            .update({ is_read: true })
                            .eq('id', msg.id);
                        if (!updateError) {
                            onMessagesRead?.();
                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
                        }
                    } catch (err) {
                        console.error("Error marking msg as read in hook:", err);
                    }
                }
            })
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error("Chat channel error for auction:", auctionId);
                }
            });

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current).catch(() => {});
                channelRef.current = null;
            }
        };
    }, [selectedSession?.auction.id, currentUserId, fetchMessages, onMessagesRead]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedSession || sending) return;

        setSending(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    auction_id: selectedSession.auction.id,
                    sender_id: currentUserId,
                    receiver_id: selectedSession.otherPartyId,
                    content: newMessage.trim(),
                    is_read: false
                })
                .select('*')
                .single();

            if (error) throw error;
            
            setMessages(prev => {
                if (prev.find(m => m.id === data.id)) return prev;
                return [...prev, data];
            });

            setNewMessage('');
        } catch (err) {
            console.error("Error sending message:", err);
            toast.error(t('messageSendError'));
        } finally {
            setSending(false);
        }
    };

    const handleProfileClick = (session: ChatSession) => {
        if (onViewProfile) {
            onViewProfile({
                id: session.otherPartyId,
                type: SellerType.PRIVATE,
                name: { SLO: session.otherPartyEmail, EN: session.otherPartyEmail },
                location: { SLO: 'N/A', EN: 'N/A' },
                memberSince: new Date().toISOString(),
                rating: 0,
                reviewCount: 0,
                totalSold: 0,
                positiveFeedback: 0,
                description: { SLO: '', EN: '' },
                subscriptionPlan: SubscriptionTier.FREE,
                unpaidStrikes: 0,
                isBlocked: false,
                savedCards: []
            });
        }
    };

    if (loading && buyingSessions.length === 0 && sellingSessions.length === 0) {
        return (
            <div className="max-w-6xl mx-auto px-6 py-10 h-[calc(100vh-120px)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#FEBA4F] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-[10px]">Nalaganje vaših sporočil...</p>
                </div>
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="max-w-6xl mx-auto px-6 py-10 h-[calc(100vh-120px)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-6 text-center max-w-sm">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                        <MessageSquare size={40} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tighter text-[#0A1128] mb-2">Ups! Nekaj je šlo narobe</h3>
                        <p className="text-slate-400 font-bold text-sm">{pageError}</p>
                    </div>
                    <button 
                        onClick={() => { setPageError(null); fetchSessions(true); }}
                        className="w-full py-4 bg-[#0A1128] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl"
                    >
                        Poskusi znova
                    </button>
                    <button onClick={onBack} className="text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-[#0A1128]">Nazaj</button>
                </div>
            </div>
        );
    }

    const tSafe = (key: string, fallback: string = '') => {
        if (typeof t === 'function') {
            try { return t(key) || fallback || key; } catch (e) { return fallback || key; }
        }
        return fallback || key;
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 animate-in h-[calc(100vh-120px)] flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-[#0A1128] transition-all shadow-sm">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-[#0A1128]">{tSafe('messages')}</h2>
                        <p className="text-slate-400 font-bold text-sm">{tSafe('chatDesc')}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex">
                {/* Sidebar */}
                <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                    <div className="p-6 border-b border-slate-100 bg-white">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tSafe('yourChats')}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {buyingSessions.length === 0 && sellingSessions.length === 0 ? (
                            <div className="p-10 text-center">
                                <MessageSquare size={32} className="mx-auto mb-4 text-slate-200" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{tSafe('noActiveChats')}</p>
                                <p className="text-[10px] text-slate-300 mt-2">{tSafe('chatStartNotice')}</p>
                            </div>
                        ) : (
                            <>
                                {buyingSessions.length > 0 && (
                                    <div className="mb-4">
                                        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-[#FEBA4F]/20 flex items-center justify-center text-[#FEBA4F]">
                                                <Star size={12} strokeWidth={3} />
                                            </div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sporočila s prodajalci (moji nakupi)</p>
                                        </div>
                                        {buyingSessions.map((session) => (
                                            <div key={session.auction.id} className="px-3 mb-2">
                                                <button 
                                                    onClick={() => setSelectedSession(session)}
                                                    className={`w-full p-4 text-left rounded-2xl transition-all flex flex-col gap-3 group relative ${
                                                        selectedSession?.auction.id === session.auction.id 
                                                        ? 'bg-white ring-4 ring-[#FEBA4F] shadow-xl z-10' 
                                                        : 'hover:bg-white bg-white/40 border border-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {session.otherPartyPic ? (
                                                            <SignedImg src={session.otherPartyPic} alt="profile" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                                                <User size={14} />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className="flex justify-between items-center w-full">
                                                                <p className="text-[11px] font-black uppercase tracking-widest text-[#0A1128] truncate pr-2">
                                                                    {session.otherPartyEmail}
                                                                </p>
                                                                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="pl-11 flex items-center gap-3">
    {session.auction.images?.[0] ? (
        <SignedImg src={session.auction.images[0]} alt="Auction" className="w-10 h-10 rounded-xl object-cover shrink-0" />
    ) : (
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0"><Gavel size={16} className="text-slate-300"/></div>
    )}
    <div className="min-w-0">
        <p className="font-bold text-xs text-slate-600 line-clamp-1">
            {session.auction.title?.[language] || session.auction.title?.['SLO'] || 'Zasebno sporočilo'}
        </p>
        <p className="text-[10px] text-slate-400 font-bold mt-1">
            Zmagovalna ponudba: €{session.auction.currentBid}
        </p>
    </div>
</div>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {sellingSessions.length > 0 && (
                                    <div>
                                        <div className="px-6 py-3 bg-slate-50 border-y border-slate-100 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-[#0A1128]/10 flex items-center justify-center text-[#0A1128]">
                                                <Gavel size={12} strokeWidth={3} />
                                            </div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sporočila s kupci (moje prodaje)</p>
                                        </div>
                                        {sellingSessions.map((session) => (
                                            <div key={session.auction.id} className="px-3 mb-2">
                                                <button 
                                                    onClick={() => setSelectedSession(session)}
                                                    className={`w-full p-4 text-left rounded-2xl transition-all flex flex-col gap-3 group relative ${
                                                        selectedSession?.auction.id === session.auction.id 
                                                        ? 'bg-white ring-4 ring-[#FEBA4F] shadow-xl z-10' 
                                                        : 'hover:bg-white bg-white/40 border border-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {session.otherPartyPic ? (
                                                            <SignedImg src={session.otherPartyPic} alt="profile" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                                                <User size={14} />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className="flex justify-between items-center w-full">
                                                                <p className="text-[11px] font-black uppercase tracking-widest text-[#0A1128] truncate pr-2">
                                                                    {session.otherPartyEmail}
                                                                </p>
                                                                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="pl-11 flex items-center gap-3">
    {session.auction.images?.[0] ? (
        <SignedImg src={session.auction.images[0]} alt="Auction" className="w-10 h-10 rounded-xl object-cover shrink-0" />
    ) : (
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0"><Gavel size={16} className="text-slate-300"/></div>
    )}
    <div className="min-w-0">
        <p className="font-bold text-xs text-slate-600 line-clamp-1">
            {session.auction.title?.[language] || session.auction.title?.['SLO'] || 'Zasebno sporočilo'}
        </p>
        <p className="text-[10px] text-slate-400 font-bold mt-1">
            Zmagovalna ponudba: €{session.auction.currentBid}
        </p>
    </div>
</div>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white">
                    {selectedSession ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div 
                                    className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => handleProfileClick(selectedSession)}
                                >
                                    {selectedSession.otherPartyPic ? (
                                        <SignedImg src={selectedSession.otherPartyPic} alt={selectedSession.otherPartyEmail} className="w-12 h-12 rounded-2xl object-cover border border-slate-200" />
                                    ) : (
                                        <div className="w-12 h-12 bg-[#0A1128] rounded-2xl flex items-center justify-center text-[#FEBA4F]">
                                            <User size={24} />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-black text-sm text-[#0A1128] hover:text-[#FEBA4F] transition-colors">{selectedSession.otherPartyEmail}</p>
                                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                            <Gavel size={10} /> {selectedSession.auction.title?.[language] || selectedSession.auction.title?.['SLO'] || 'Zasebno sporočilo'}
                                        </p>
                                    </div>
                                </div>
                                <div 
                                    className="text-right flex items-center gap-4 cursor-pointer group"
                                    onClick={() => onViewAuction?.(selectedSession.auction)}
                                >
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-[#FEBA4F] transition-colors">{tSafe('amount')}</p>
                                        <p className="text-lg font-black text-[#0A1128] group-hover:text-[#FEBA4F] transition-colors">€{selectedSession.auction.currentBid}</p>
                                    </div>
                                    {selectedSession.auction.images && selectedSession.auction.images[0] ? (
                                        <SignedImg src={selectedSession.auction.images[0]} alt="Auction" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                                    ) : (
                                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                                            <Gavel size={24} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Messages */}
                            <div 
                                className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 bg-slate-50/20"
                            >
                                {messages.map((msg) => (
                                    <div 
                                        key={msg.id}
                                        className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] p-5 rounded-[1.5rem] shadow-sm ${msg.sender_id === currentUserId ? 'bg-[#0A1128] text-white rounded-tr-none' : 'bg-white border border-slate-100 text-[#0A1128] rounded-tl-none'}`}>
                                            <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
                                            <p className={`text-[11px] mt-2 font-black uppercase tracking-widest ${msg.sender_id === currentUserId ? 'text-white' : 'text-[#0A1128]/70'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                        <MessageSquare size={48} className="mb-4" />
                                        <p className="font-black uppercase tracking-widest text-sm">{tSafe('startConversation')}</p>
                                        <p className="text-xs font-bold mt-2">{tSafe('pickupAgreement')}</p>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <form onSubmit={sendMessage} className="p-6 border-t border-slate-100 bg-white">
                                <div className="relative flex items-center">
                                    <input 
                                        type="text" 
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                sendMessage(e as unknown as React.FormEvent);
                                            }
                                        }}
                                        placeholder="Vpišite sporočilo..."
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-6 pr-20 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!newMessage.trim() || sending}
                                        className="absolute right-3 p-3 bg-[#FEBA4F] text-[#0A1128] rounded-xl hover:bg-[#0A1128] hover:text-white transition-all shadow-lg disabled:opacity-50"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-20">
                            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6">
                                <MessageSquare size={48} />
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0A1128] mb-2">{tSafe('yourInbox')}</h3>
                            <p className="text-slate-400 font-bold max-w-md">{tSafe('selectChatDesc')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
