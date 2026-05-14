import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, Check, CheckCheck, Loader2, User, Search, Play, Phone, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { AuctionItem } from '../../types';

interface Message {
  id: string;
  auction_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface OtherUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string;
}

export const MessagesView: React.FC<{
  userId: string;
  t: (k: string) => string;
  language: string;
  initialAuctionId: string | null;
  auctions: AuctionItem[];
  onBack: () => void;
}> = ({ userId, t, language, initialAuctionId, auctions, onBack }) => {
  const [conversations, setConversations] = useState<{ auction: AuctionItem; otherUserId: string; user?: OtherUser }[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(initialAuctionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const globalChannelRef = useRef<any>(null);
  
  const currentChatConv = conversations.find(c => c.auction.id === activeChat);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Identify relevant auctions (completed, has winner, user is seller or winner)
    const relevant = auctions.filter(a => {
        if (a.status !== 'completed' && new Date(a.endTime) > new Date()) return false;
        const wId = a.winnerId || (a as any).winner_id;
        if (!wId) return false;
        return a.sellerId === userId || wId === userId;
    });

    const convs = relevant.map(a => {
        const wId = a.winnerId || (a as any).winner_id;
        const otherUserId = a.sellerId === userId ? wId : a.sellerId;
        return { auction: a, otherUserId };
    });

    setConversations(convs);

    if (convs.length > 0) {
        const otherIds = [...new Set(convs.map(c => c.otherUserId))];
        supabase.from('users').select('id, first_name, last_name, email, profile_picture_url').in('id', otherIds).then(({ data }) => {
            if (data) {
                setConversations(convs.map(c => {
                    const u = data.find(u => u.id === c.otherUserId);
                    return {
                        ...c,
                        user: u ? {
                            id: u.id,
                            firstName: u.first_name || '',
                            lastName: u.last_name || '',
                            email: u.email || '',
                            profilePicture: u.profile_picture_url || ''
                        } : undefined
                    };
                }));
            }
            setLoadingChats(false);
            if (!activeChat && convs.length > 0) {
                setActiveChat(convs[0].auction.id);
            }
        });
    } else {
        setLoadingChats(false);
    }
  }, [auctions, userId]);

  useEffect(() => {
      if (!activeChat || !currentChatConv) return;
      setLoadingMessages(true);
      
      const fetchMessages = async () => {
          const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('auction_id', activeChat)
            .order('created_at', { ascending: true });
            
          if (data) {
              setMessages(data);
              // Mark unread as read
              const unread = data.filter(m => m.receiver_id === userId && !m.is_read).map(m => m.id);
              if (unread.length > 0) {
                  await supabase.from('messages').update({ is_read: true }).in('id', unread);
              }
          }
          setLoadingMessages(false);
          scrollToBottom();
      };
      
      fetchMessages();

      const channel = supabase.channel(`messages_${activeChat}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `auction_id=eq.${activeChat}` }, payload => {
            const newMsg = payload.new as Message;
            setMessages(prev => [...prev, newMsg]);
            if (newMsg.receiver_id === userId) {
                supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id);
            }
            scrollToBottom();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `auction_id=eq.${activeChat}` }, payload => {
            const updated = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        })
        .on('broadcast', { event: 'typing' }, payload => {
            if (payload.payload.userId === currentChatConv.otherUserId) {
                setOtherUserTyping(payload.payload.isTyping);
            }
        })
        .subscribe();

      // Track global online presence
      const presenceChannel = supabase.channel('global_online', {
        config: {
          presence: {
            key: userId,
          },
        },
      });

      presenceChannel.on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.keys(newState).forEach(key => {
           online.add(key);
        });
        setOnlineUsers(online);
      }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

      globalChannelRef.current = channel;

      return () => {
          supabase.removeChannel(channel);
          supabase.removeChannel(presenceChannel);
          globalChannelRef.current = null;
          setOtherUserTyping(false);
      };
  }, [activeChat, currentChatConv, userId]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNewMessage(e.target.value);

      if (!isTyping) {
          setIsTyping(true);
          globalChannelRef.current?.send({
              type: 'broadcast',
              event: 'typing',
              payload: { userId, isTyping: true }
          });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          globalChannelRef.current?.send({
              type: 'broadcast',
              event: 'typing',
              payload: { userId, isTyping: false }
          });
      }, 2000);
  };


  const scrollToBottom = () => {
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  };

  const handleSend = async () => {
      if (!newMessage.trim() || !activeChat || !currentChatConv) return;
      
      const msgText = newMessage.trim();
      setNewMessage('');
      setIsSending(true);
      
      const { data, error } = await supabase.from('messages').insert([{
          auction_id: activeChat,
          sender_id: userId,
          receiver_id: currentChatConv.otherUserId,
          content: msgText
      }]).select();
      
      // Realtime subscription handles the update but we can optimistically insert if it doesn't bounce back fast enough
      if (data && data.length > 0 && !messages.find(m => m.id === data[0].id)) {
          setMessages(prev => [...prev, data[0] as Message]);
          scrollToBottom();
      }
      setIsSending(false);
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeChat || !currentChatConv || !e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      e.target.value = '';
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `chat_images/${userId}/${fileName}`;

      setIsSending(true);
      const { error: uploadError } = await supabase.storage.from('auction-images').upload(filePath, file);
      if (!uploadError) {
          const { data } = supabase.storage.from('auction-images').getPublicUrl(filePath);
          if (data.publicUrl) {
               await supabase.from('messages').insert([{
                  auction_id: activeChat,
                  sender_id: userId,
                  receiver_id: currentChatConv.otherUserId,
                  content: `[IMAGE]${data.publicUrl}`
               }]);
               scrollToBottom();
          }
      }
      setIsSending(false);
  };

  const renderContent = (content: string) => {
      if (content.startsWith('[IMAGE]')) {
          const url = content.replace('[IMAGE]', '');
          return <img src={url} alt="Poslana slika" className="max-w-[200px] md:max-w-xs rounded-2xl cursor-pointer" onClick={() => window.open(url, '_blank')} />
      }
      return <p className="whitespace-pre-wrap whitespace-break-spaces break-words">{content}</p>;
  };

  return (
    <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 mb-6 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
        <div className="bg-white rounded-[2rem] flex shadow-2xl border border-slate-100 max-h-[85vh] h-[750px] overflow-hidden relative">
            
            {/* LEFT SIDEBAR (CONVERSATIONS) */}
            <div className="w-1/3 min-w-[280px] max-w-[380px] border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-2xl font-black text-[#0A1128] uppercase tracking-tighter">Sporočila</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loadingChats ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" size={24} /></div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 font-bold text-sm">Ni aktivnih pogovorov.</div>
                    ) : (
                        conversations.map(c => {
                            const name = c.user?.firstName ? `${c.user.firstName} ${c.user.lastName}`.trim() : c.user?.email || 'Neznan uporabnik';
                            const isActive = activeChat === c.auction.id;
                            const isOnline = onlineUsers.has(c.otherUserId);
                            const title = c.auction.title[language as keyof typeof c.auction.title] || c.auction.title.SLO;
                            return (
                                <div 
                                    key={c.auction.id} 
                                    onClick={() => setActiveChat(c.auction.id)}
                                    className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all ${isActive ? 'bg-white shadow-md border-2 border-[#FEBA4F]' : 'border-2 border-transparent hover:bg-slate-100'}`}
                                >
                                    <div className="relative">
                                        {c.user?.profilePicture ? (
                                            <img src={c.user.profilePicture} className="w-12 h-12 rounded-full object-cover shadow-sm bg-slate-200" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400"><User size={20} /></div>
                                        )}
                                        {isOnline && <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                                        <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full border-2 border-white overflow-hidden shadow-sm">
                                            <img src={c.auction.images[0]} className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-sm text-[#0A1128] truncate">{name}</h4>
                                        <p className="text-xs text-slate-400 font-bold truncate">{isActive && otherUserTyping ? <span className="text-[#FEBA4F]">sogovorec piše...</span> : title}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT SIDE (CHAT) */}
            <div className="flex-1 flex flex-col bg-white">
                {activeChat && currentChatConv ? (
                    <>
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm z-10 sticky top-0 bg-white/80 backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    {currentChatConv.user?.profilePicture ? (
                                        <img src={currentChatConv.user.profilePicture} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><User size={20} /></div>
                                    )}
                                    {onlineUsers.has(currentChatConv.otherUserId) && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-[#0A1128] flex items-center gap-2">
                                        {currentChatConv.user?.firstName ? `${currentChatConv.user.firstName} ${currentChatConv.user.lastName}` : currentChatConv.user?.email || 'Neznan uporabnik'}
                                        {onlineUsers.has(currentChatConv.otherUserId) && <span className="text-[10px] bg-green-50 text-green-600 px-2 rounded-full uppercase tracking-widest font-black">Na spletu</span>}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-bold">{currentChatConv.auction.title[language as keyof typeof currentChatConv.auction.title] || currentChatConv.auction.title.SLO}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                            {loadingMessages ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" size={24} /></div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">Tukaj se začne vaš pogovor.</div>
                            ) : (
                                messages.map((m, idx) => {
                                    const isMe = m.sender_id === userId;
                                    const showTime = idx === 0 || new Date(messages[idx].created_at).getTime() - new Date(messages[idx-1].created_at).getTime() > 1000 * 60 * 5;
                                    
                                    return (
                                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full`}>
                                            {showTime && <div className="text-[10px] uppercase font-black tracking-widest text-slate-300 mb-3 mt-2">{new Date(m.created_at).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}</div>}
                                            <div className={`relative group flex gap-2 max-w-[80%]`}>
                                                <div className={`px-5 py-3 rounded-2xl shadow-sm border ${isMe ? 'bg-[#FEBA4F] border-[#FEBA4F] text-[#0A1128] rounded-tr-none' : 'bg-white border-slate-100 text-[#0A1128] rounded-tl-none font-medium'}`}>
                                                    {renderContent(m.content)}
                                                </div>
                                            </div>
                                            {isMe && (
                                                <div className="flex items-center gap-1 mt-1 text-[10px] font-black text-slate-400">
                                                    {m.is_read ? <span className="text-green-500 flex items-center gap-1"><CheckCheck size={12}/> Prebrano</span> : <span className="flex items-center gap-1"><Check size={12}/> Poslano</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-4 bg-white border-t border-slate-100">
                            <div className="flex items-end gap-3 max-w-4xl mx-auto relative bg-slate-50 p-2 rounded-3xl border border-slate-200">
                                <label className="flex-shrink-0 w-10 h-10 rounded-2xl hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-colors text-slate-400 hover:text-[#0A1128]">
                                    <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={isSending} />
                                    <ImageIcon size={20} />
                                </label>
                                <textarea
                                    value={newMessage}
                                    onChange={handleTyping}
                                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                    placeholder="Napišite sporočilo..."
                                    className="flex-1 max-h-32 min-h-[40px] bg-transparent outline-none resize-none py-2 text-sm font-medium text-[#0A1128] placeholder-slate-400 scrollbar-hide"
                                    rows={1}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!newMessage.trim() || isSending}
                                    className="flex-shrink-0 w-10 h-10 rounded-2xl bg-[#0A1128] text-white flex items-center justify-center hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-1" />}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <MessageSquare size={64} className="opacity-20 mb-6" />
                        <h3 className="font-black text-xl text-[#0A1128] mb-2 uppercase tracking-tighter">Vaša Sporočila</h3>
                        <p className="font-bold text-sm">Izberite pogovor na levi strani ali ga začnite preko dražbe.</p>
                    </div>
                )}
            </div>
            
        </div>
    </div>
  );
};

