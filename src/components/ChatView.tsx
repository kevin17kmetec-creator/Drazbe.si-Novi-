import React, { useState, useEffect, useRef } from 'react';
import { Send, User, ArrowLeft, MessageSquare, Clock, Gavel, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { AuctionItem } from '../../types.ts';
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
    lastMessage?: string;
}

export const ChatView: React.FC<{ 
    onBack: () => void; 
    t: any; 
    currentUserId: string;
    language: string;
}> = ({ onBack, t, currentUserId, language }) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchSessions();
    }, [currentUserId]);

    useEffect(() => {
        if (selectedSession) {
            fetchMessages(selectedSession.auction.id);
            const subscription = supabase
                .channel(`messages:${selectedSession.auction.id}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages',
                    filter: `auction_id=eq.${selectedSession.auction.id}`
                }, (payload) => {
                    const msg = payload.new as Message;
                    setMessages(prev => [...prev, msg]);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(subscription);
            };
        }
    }, [selectedSession]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            // Fetch completed auctions where user is seller or winner
            const { data: auctions, error } = await supabase
                .from('auctions')
                .select('*, users!auctions_seller_id_fkey(email), winner:users!auctions_winner_id_fkey(email)')
                .eq('status', 'completed')
                .or(`seller_id.eq.${currentUserId},winner_id.eq.${currentUserId}`);

            if (error) throw error;

            const chatSessions: ChatSession[] = auctions.map((a: any) => {
                const isSeller = a.seller_id === currentUserId;
                return {
                    auction: {
                        ...a,
                        endTime: new Date(a.end_time),
                        currentBid: a.current_price,
                        bidCount: a.bid_count
                    },
                    otherPartyId: isSeller ? a.winner_id : a.seller_id,
                    otherPartyEmail: isSeller ? (a.winner?.email || 'Zmagovalec') : (a.users?.email || 'Prodajalec')
                };
            }).filter(s => s.otherPartyId); // Ensure there is another party (winner exists)

            setSessions(chatSessions);
        } catch (err) {
            console.error("Error fetching chat sessions:", err);
            toast.error("Napaka pri nalaganju klepetov.");
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (auctionId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('auction_id', auctionId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedSession || sending) return;

        setSending(true);
        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    auction_id: selectedSession.auction.id,
                    sender_id: currentUserId,
                    receiver_id: selectedSession.otherPartyId,
                    content: newMessage.trim()
                });

            if (error) throw error;
            setNewMessage('');
        } catch (err) {
            console.error("Error sending message:", err);
            toast.error("Napaka pri pošiljanju sporočila.");
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[600px]">
                <div className="w-12 h-12 border-4 border-[#FEBA4F] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-10 animate-in h-[calc(100vh-120px)] flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white rounded-2xl border border-slate-200 text-slate-400 hover:text-[#0A1128] transition-all shadow-sm">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-[#0A1128]">Sporočila</h2>
                        <p className="text-slate-400 font-bold text-sm">Dogovor o prevzemu predmetov</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex">
                {/* Sidebar */}
                <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                    <div className="p-6 border-b border-slate-100 bg-white">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vaši klepeti</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {sessions.length === 0 ? (
                            <div className="p-10 text-center">
                                <MessageSquare size={32} className="mx-auto mb-4 text-slate-200" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Ni aktivnih klepetov</p>
                                <p className="text-[10px] text-slate-300 mt-2">Klepeti se pojavijo po končani dražbi med prodajalcem in zmagovalcem.</p>
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <button 
                                    key={session.auction.id}
                                    onClick={() => setSelectedSession(session)}
                                    className={`w-full p-6 text-left border-b border-slate-100 transition-all flex flex-col gap-2 ${selectedSession?.auction.id === session.auction.id ? 'bg-white border-l-4 border-l-[#FEBA4F] shadow-inner' : 'hover:bg-white'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#FEBA4F] truncate max-w-[120px]">
                                            {session.otherPartyEmail}
                                        </p>
                                        <CheckCircle2 size={12} className="text-green-500" />
                                    </div>
                                    <p className="font-black text-xs text-[#0A1128] line-clamp-1">
                                        {session.auction.title[language] || session.auction.title['SLO']}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-bold">
                                        Zmagovalna ponudba: €{session.auction.currentBid}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white">
                    {selectedSession ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#0A1128] rounded-2xl flex items-center justify-center text-[#FEBA4F]">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <p className="font-black text-sm text-[#0A1128]">{selectedSession.otherPartyEmail}</p>
                                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                            <Gavel size={10} /> {selectedSession.auction.title[language] || selectedSession.auction.title['SLO']}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Znesek</p>
                                    <p className="text-lg font-black text-[#FEBA4F]">€{selectedSession.auction.currentBid}</p>
                                </div>
                            </div>

                            {/* Messages */}
                            <div 
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20"
                            >
                                {messages.map((msg) => (
                                    <div 
                                        key={msg.id}
                                        className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[70%] p-5 rounded-[1.5rem] shadow-sm ${msg.sender_id === currentUserId ? 'bg-[#0A1128] text-white rounded-tr-none' : 'bg-white border border-slate-100 text-[#0A1128] rounded-tl-none'}`}>
                                            <p className="text-sm font-bold leading-relaxed">{msg.content}</p>
                                            <p className={`text-[9px] mt-2 font-black uppercase tracking-widest opacity-40 ${msg.sender_id === currentUserId ? 'text-white' : 'text-slate-400'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {messages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                        <MessageSquare size={48} className="mb-4" />
                                        <p className="font-black uppercase tracking-widest text-sm">Začnite pogovor</p>
                                        <p className="text-xs font-bold mt-2">Dogovorite se za prevzem predmeta</p>
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
                            <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0A1128] mb-2">Vaš predal</h3>
                            <p className="text-slate-400 font-bold max-w-md">Izberite klepet na levi strani, da začnete pogovor s prodajalcem ali zmagovalcem dražbe.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
