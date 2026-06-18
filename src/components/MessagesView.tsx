import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, SendHorizontal, Image as ImageIcon, Check, CheckCheck, Loader2, User, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { AuctionItem } from '../../types';
import { useChat } from '../context/ChatContext';

export const MessagesView: React.FC<{
  userId: string;
  t: (k: string) => string;
  language: string;
  initialAuctionId: string | null;
  auctions: AuctionItem[];
  onBack: () => void;
}> = ({ userId, t, language, initialAuctionId, auctions, onBack }) => {
  const { 
      conversations, 
      activeChat, 
      setActiveChat, 
      messages, 
      loadingChats, 
      loadingMessages, 
      unreadCounts,
      onlineUsers, 
      otherUserTyping, 
      setTyping, 
      sendMessage, 
      retryMessage,
      uploadImage, 
      isSending,
      isConnecting,
      checkAndRecoverHealth
  } = useChat();

  const [newMessage, setNewMessage] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentChatConv = conversations.find(c => c.auction.id === activeChat);

  const scrollToBottom = useCallback(() => {
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  }, []);

  // Check health on mount to make sure everything is properly synched
  useEffect(() => {
      if (checkAndRecoverHealth) {
          checkAndRecoverHealth();
      }
  }, [checkAndRecoverHealth]);

  // Set the active chat when navigating from an auction
  useEffect(() => {
      if (initialAuctionId) {
          setActiveChat(initialAuctionId);
      }
  }, [initialAuctionId, setActiveChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
      scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNewMessage(e.target.value);

      setTyping(true);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
      }, 2000);
  };

  const handleSend = () => {
      const msg = newMessage.trim();
      if (!msg) return;
      sendMessage(msg).then(() => {
          setNewMessage('');
          scrollToBottom();
      });
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeChat || !currentChatConv || !e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      e.target.value = '';
      
      uploadImage(file).then(() => {
          scrollToBottom();
      });
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
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-2xl font-black text-[#0A1128] uppercase tracking-tighter">Sporočila</h2>
                    {isConnecting && (
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-[#FEBA4F] bg-[#FEBA4F]/10 px-2.5 py-1 rounded-full">
                            <Loader2 size={12} className="animate-spin" />
                            Povezovanje...
                        </div>
                    )}
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
                            const count = c.id ? (unreadCounts[c.id] || 0) : 0;
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
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-black text-sm text-[#0A1128] truncate">{name}</h4>
                                            {count > 0 && (
                                                <span className="flex-shrink-0 bg-red-600 text-white text-[10px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-md ml-2 select-none">
                                                    {count}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 font-bold truncate mt-0.5">{isActive && otherUserTyping ? <span className="text-[#FEBA4F]">sogovorec piše...</span> : title}</p>
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-red-500 flex items-center gap-1 font-extrabold uppercase tracking-wider">
                                                                <AlertCircle size={12} /> Napaka pri pošiljanju
                                                            </span>
                                                            <button 
                                                                onClick={() => retryMessage(m.id)}
                                                                className="flex items-center gap-1 bg-red-100/80 hover:bg-red-200/90 text-red-600 font-black px-2 py-1 rounded-lg border border-red-200 transition-all cursor-pointer text-[9px] uppercase tracking-wider shadow-sm"
                                                            >
                                                                <RefreshCw size={10} /> Pošlji ponovno
                                                            </button>
                                                        </div>
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
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={isSending} />
                                    {isSending ? <Loader2 size={20} className="animate-spin"/> : <ImageIcon size={20} />}
                                </label>
                                <textarea
                                    value={newMessage}
                                    onChange={handleTyping}
                                    onKeyDown={(e) => { 
                                        if (e.key === 'Enter' && !e.shiftKey) { 
                                            e.preventDefault(); 
                                            handleSend(); 
                                        } 
                                    }}
                                    placeholder="Napišite sporočilo..."
                                    className="flex-1 max-h-32 min-h-[40px] bg-transparent outline-none resize-none py-2 text-sm font-medium text-[#0A1128] placeholder-slate-400 scrollbar-hide"
                                    rows={1}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!newMessage.trim() || isSending}
                                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[#0A1128] text-white flex items-center justify-center hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                                >
                                    {isSending ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <SendHorizontal size={18} />}
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
