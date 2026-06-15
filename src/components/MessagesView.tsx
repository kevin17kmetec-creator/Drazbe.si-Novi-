import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, SendHorizontal, Image as ImageIcon, Check, CheckCheck, Loader2, User, Search, Play, Phone, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { AuctionItem } from '../../types';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  status?: 'sending' | 'sent' | 'error'; // local status
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
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const globalChannelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentChatConv = conversations.find(c => c.auction.id === activeChat);

  const scrollToBottom = useCallback(() => {
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  }, []);

  // 1. Fetch Conversations
  useEffect(() => {
    let isMounted = true;
    const relevant = auctions.filter(a => {
        const wId = a.winnerId || (a as any).winner_id;
        const sId = a.sellerId || (a as any).seller_id;
        if (wId !== userId && sId !== userId) return false;
        if (!wId) return false;
        return a.status === 'completed' || new Date(a.endTime).getTime() <= Date.now();
    });

    const convs = relevant.map(a => {
        const wId = a.winnerId || (a as any).winner_id;
        const sId = a.sellerId || (a as any).seller_id;
        return { auction: a, otherUserId: sId === userId ? wId : sId };
    });

    if (convs.length > 0) {
        const otherIds = [...new Set(convs.map(c => c.otherUserId))].filter(Boolean);
        if (otherIds.length > 0) {
            (async () => {
                try {
                    const { data, error } = await supabase.from('users').select('id, first_name, last_name, email, profile_picture_url').in('id', otherIds);
                    if (!isMounted) return;
                    if (error) {
                        console.error("Error fetching users for chat:", error);
                        setConversations(convs);
                    } else {
                        setConversations(convs.map(c => {
                            const u = data?.find(u => u.id === c.otherUserId);
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
                } catch (e) {
                    if (!isMounted) return;
                    console.error("Exception fetching chat users:", e);
                    setConversations(convs);
                } finally {
                    if (isMounted) {
                        setLoadingChats(false);
                        if (!activeChat && convs.length > 0) setActiveChat(convs[0].auction.id);
                    }
                }
            })();
        } else {
            setConversations(convs);
            setLoadingChats(false);
            if (!activeChat) setActiveChat(convs[0].auction.id);
        }
    } else {
        setConversations(convs);
        setLoadingChats(false);
    }
    return () => { isMounted = false; };
  }, [auctions, userId]);

  // 2. Setup Presence Channel
  useEffect(() => {
      if (!userId) return;
      const presenceChannel = supabase.channel('global_online_messages', {
          config: { presence: { key: userId } },
      });

      presenceChannel.on('presence', { event: 'sync' }, () => {
          const newState = presenceChannel.presenceState();
          const online = new Set<string>();
          Object.keys(newState).forEach(key => online.add(key));
          setOnlineUsers(online);
      }).subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
              try { await presenceChannel.track({ online_at: new Date().toISOString() }); }
              catch(e) { console.error("Presence track error", e); }
          }
      });

      return () => {
          supabase.removeChannel(presenceChannel);
      };
  }, [userId]);

  // 3. Setup Messages Channel & Fetch Messages
  useEffect(() => {
      if (!activeChat || !currentChatConv) return;
      
      let isMounted = true;
      let poolChannel: any = null;
      let reconnectTimeoutId: NodeJS.Timeout;

      setLoadingMessages(true);
      setMessages([]);
      setOtherUserTyping(false);

      const markAsRead = async (convId: string) => {
          try {
              await supabase.from('messages')
                .update({ is_read: true })
                .eq('conversation_id', convId)
                .eq('is_read', false)
                .neq('sender_id', userId);
          } catch(e) {
              console.error("Mark read error", e);
          }
      };

      const initChat = async (retryCount = 0) => {
          if (!isMounted) return;
          try {
              if (poolChannel) {
                  try { await supabase.removeChannel(poolChannel); } catch (e) {}
              }

              let { data: convData } = await supabase
                .from('conversations')
                .select('id')
                .eq('auction_id', activeChat)
                .or(`and(participant_one.eq.${userId},participant_two.eq.${currentChatConv.otherUserId}),and(participant_one.eq.${currentChatConv.otherUserId},participant_two.eq.${userId})`)
                .maybeSingle();

              if (!convData) {
                  const { data: newConv } = await supabase
                    .from('conversations')
                    .insert([{ auction_id: activeChat, participant_one: userId, participant_two: currentChatConv.otherUserId }])
                    .select('id')
                    .single();
                  if (newConv) convData = newConv;
              }

              if (convData && isMounted) {
                  setActiveConversationId(convData.id);
                  
                  // Fetch initial messages
                  const { data: msgData, error: msgError } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', convData.id)
                    .order('created_at', { ascending: true });
                  
                  if (msgError) throw msgError;

                  if (msgData && isMounted) {
                      setMessages(msgData.map(m => ({ ...m, status: 'sent' as const })));
                      markAsRead(convData.id);
                  }

                  // Subscribe to Realtime Let's build channel
                  poolChannel = supabase.channel(`messages_${convData.id}`);
                  
                  poolChannel
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convData.id}` }, async payload => {
                        const newMsg = payload.new as Message;
                        if (!isMounted) return;

                        if (newMsg.sender_id !== userId && !newMsg.is_read) {
                           // Ack read independently
                           supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id).then();
                        }

                        setMessages(prev => {
                            // Deduplicate (e.g., Optimistic update or same insert)
                            // Remove temporary optimistic message if same content/time
                            const filtered = prev.filter(m => !(m.status === 'sending' && m.content === newMsg.content && m.sender_id === newMsg.sender_id));
                            if (filtered.find(m => m.id === newMsg.id)) return prev;
                            const newArr = [...filtered, { ...newMsg, status: 'sent' as const }];
                            return newArr.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                        });
                        scrollToBottom();
                    })
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convData.id}` }, payload => {
                        const updated = payload.new as Message;
                        if (!isMounted) return;
                        setMessages(prev => prev.map(m => (m.id === updated.id || (m.status === 'sending' && m.content === updated.content)) ? { ...updated, status: 'sent' as const } : m));
                    })
                    .on('broadcast', { event: 'typing' }, payload => {
                        if (!isMounted) return;
                        if (payload.payload.userId === currentChatConv.otherUserId) {
                            setOtherUserTyping(payload.payload.isTyping);
                        }
                    });

                  poolChannel.subscribe((status: any, err: any) => {
                      if (status === 'SUBSCRIBED') {
                          console.log("Joined room", convData?.id);
                      }
                      if (status === 'SYSTEM_ERROR' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                          console.error("Supabase Channel Error", status, err);
                          if (retryCount < 5) {
                              const delay = Math.min(Math.pow(2, retryCount) * 1000, 10000);
                              reconnectTimeoutId = setTimeout(() => {
                                  if (isMounted) initChat(retryCount + 1);
                              }, delay);
                          }
                      }
                  });

                  if (isMounted) {
                      globalChannelRef.current = poolChannel;
                      setLoadingMessages(false);
                      scrollToBottom();
                  }
              }
          } catch (err) {
              console.error("Error setting up chat:", err);
              if (isMounted) setLoadingMessages(false);
          }
      };

      initChat();

      return () => {
          isMounted = false;
          if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
          if (poolChannel) {
              poolChannel.unsubscribe().then(() => {
                  supabase.removeChannel(poolChannel);
              }).catch((e: any) => {
                  console.error("Error unmounting channel", e);
                  try { supabase.removeChannel(poolChannel); } catch (_) {}
              });
          }
          globalChannelRef.current = null;
          setActiveConversationId(null);
      };
  }, [activeChat, currentChatConv, userId, scrollToBottom]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNewMessage(e.target.value);

      if (!isTyping && globalChannelRef.current) {
          setIsTyping(true);
          globalChannelRef.current.send({
              type: 'broadcast',
              event: 'typing',
              payload: { userId, isTyping: true }
          }).catch((e: any) => console.error(e));
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          if (globalChannelRef.current) {
              globalChannelRef.current.send({
                  type: 'broadcast',
                  event: 'typing',
                  payload: { userId, isTyping: false }
              }).catch((e: any) => console.error(e));
          }
      }, 2000);
  };

  const attemptSendMessage = async (msgText: string, contentPrefix = '') => {
      if (!msgText.trim() && !contentPrefix) return;
      if (!activeChat || !currentChatConv) return;
      
      const optimisticId = `temp-${Date.now()}`;
      const finalContent = contentPrefix + msgText.trim();
      
      const newMsg: Message = {
          id: optimisticId,
          conversation_id: activeConversationId || 'unknown',
          sender_id: userId,
          content: finalContent,
          created_at: new Date().toISOString(),
          is_read: false,
          status: 'sending' as const
      };

      // Optimistic update
      setMessages(prev => [...prev, newMsg]);
      setNewMessage('');
      scrollToBottom();

      let convId = activeConversationId;
      if (!convId) {
          // Fallback if not initialized yet
          try {
            const { data: convData } = await supabase.from('conversations').select('id').eq('auction_id', activeChat)
              .or(`and(participant_one.eq.${userId},participant_two.eq.${currentChatConv.otherUserId}),and(participant_one.eq.${currentChatConv.otherUserId},participant_two.eq.${userId})`)
              .maybeSingle();
            
            if (convData) convId = convData.id;
            else {
                const { data: newConv } = await supabase.from('conversations').insert([{
                    auction_id: activeChat, participant_one: userId, participant_two: currentChatConv.otherUserId
                }]).select('id').single();
                if (newConv) convId = newConv.id;
            }
            if (convId) setActiveConversationId(convId);
          } catch(e) {
              console.error("Conversation init error", e);
              setMessages(prev => prev.filter(m => m.id !== optimisticId));
              return;
          }
      }

      if (!convId) {
          setMessages(prev => prev.filter(m => m.id !== optimisticId));
          return;
      }
      
      let insertCompleted = false;

      try {
          // Keep button loading state independent of text input reset
          setIsSending(true);

          const timeoutPromise = new Promise<{ data: null, error: Error }>((_, reject) => {
              setTimeout(() => {
                  if (!insertCompleted) {
                      reject(new Error("Timeout: Message sending took too long (> 5s)"));
                  }
              }, 5000);
          });

          const supabasePromise = supabase.from('messages').insert([{
              conversation_id: convId,
              sender_id: userId,
              content: finalContent
          }]).select();

          const { data, error } = await Promise.race([supabasePromise, timeoutPromise]) as any;

          insertCompleted = true;

          if (error) throw error;
          
          if (data && data.length > 0) {
              // We successfully saved, real-time will catch it, or we update temp
              setMessages(prev => prev.map(m => m.id === optimisticId ? { ...(data[0] as Message), status: 'sent' as const } : m));
          }
      } catch (err) {
          console.error("Send message error", err);
          // Mark as error
          setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, status: 'error' as const } : m));
      } finally {
          setIsSending(false);
      }
  };

  const handleSend = () => attemptSendMessage(newMessage);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeChat || !currentChatConv || !e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      e.target.value = '';
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `chat_images/${userId}/${fileName}`;
 
      setIsSending(true);
      try {
          const { error: uploadError } = await supabase.storage.from('auction-images').upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('auction-images').getPublicUrl(filePath);
          if (data?.publicUrl) {
               await attemptSendMessage(data.publicUrl, '[IMAGE]');
          }
      } catch (e) {
          console.error("Image upload failed", e);
      } finally {
          setIsSending(false);
      }
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
                                            <img src={typeof c.auction.images[0] === 'string' ? c.auction.images[0].replace(/([\[\]"'])/g, '') : ''} className="w-full h-full object-cover" />
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
                                        {onlineUsers.has(currentChatConv.otherUserId) ? (
                                            <span className="text-[10px] bg-green-50 text-green-600 px-2 rounded-full uppercase tracking-widest font-black">Aktiven</span>
                                        ) : (
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 rounded-full uppercase tracking-widest font-black">Odsoten</span>
                                        )}
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
                                                    {m.status === 'sending' ? (
                                                        <span className="flex items-center gap-1 opacity-50"><Loader2 size={12} className="animate-spin"/> Pošiljam...</span>
                                                    ) : m.status === 'error' ? (
                                                        <span className="text-red-500 flex items-center gap-1">Napaka</span>
                                                    ) : m.is_read ? (
                                                        <span className="text-green-500 flex items-center gap-1"><CheckCheck size={12}/> Prebrano</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><Check size={12}/> Poslano</span>
                                                    )}
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
                                    {isSending ? <Loader2 size={20} className="animate-spin"/> : <ImageIcon size={20} />}
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
                                    disabled={!newMessage.trim()}
                                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0A1128] text-white flex items-center justify-center hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                                >
                                    <SendHorizontal size={18} />
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
