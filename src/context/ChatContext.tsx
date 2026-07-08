import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, or, onSnapshot, doc, getDoc, setDoc, addDoc, updateDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { AuctionItem } from "../../types";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  status?: "sending" | "sent" | "error";
}

export interface OtherUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string;
}

export interface Conversation {
  id: string;
  auction: AuctionItem;
  otherUserId: string;
  user?: OtherUser;
}

interface ChatContextType {
  conversations: Conversation[];
  activeChat: string | null;
  setActiveChat: (auctionId: string | null) => void;
  messages: Message[];
  activeConversationId: string | null;
  loadingChats: boolean;
  loadingMessages: boolean;
  unreadMessageCount: number;
  unreadCounts: Record<string, number>;
  onlineUsers: Set<string>;
  otherUserTyping: boolean;
  setTyping: (isTyping: boolean) => void;
  sendMessage: (content: string, prefix?: string) => Promise<void>;
  retryMessage: (tempId: string) => Promise<void>;
  markAsRead: (convId: string) => Promise<void>;
  uploadImage: (file: File) => Promise<void>;
  isSending: boolean;
  isConnecting: boolean;
  checkAndRecoverHealth: () => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};

export const ChatProvider: React.FC<{
  userId: string;
  auctions: AuctionItem[];
  appWakeupTrigger?: number;
  children: React.ReactNode;
}> = ({ userId, auctions, appWakeupTrigger = 0, children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isSending, setIsSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Firestore Snapshot Listeners
  useEffect(() => {
    if (!userId) return;
    
    let unsubscribe = () => {};
    let isMounted = true;
    
    const setupListener = () => {
        if (!auth.currentUser) return; // wait for auth
        setLoadingChats(true);
        const convRef = collection(db, "conversations");
        const q = query(convRef, or(where("participant_one", "==", userId), where("participant_two", "==", userId)));
        
        unsubscribe = onSnapshot(q, async (snapshot) => {
          if (!isMounted) return;
          const convData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          
          const enrichedConvs = [];
          for (const conv of convData) {
            let auction = auctions.find(a => a.id === conv.auction_id);
            if (!auction) {
               auction = {
                    id: conv.auction_id,
                    title: { en: "Unknown" },
                    category: "Other",
                    currentBid: 0,
                    bidCount: 0,
                    itemCount: 1,
                    images: [],
                    endTime: new Date(),
                    location: {},
                    region: "Ljubljana" as any,
                    description: {},
                    condition: {},
                    specifications: {},
                    biddingHistory: [],
                    sellerId: "unknown",
                    status: "completed"
                };
            }
            
            const otherUserId = conv.participant_one === userId ? conv.participant_two : conv.participant_one;
            let user = undefined;
            try {
              const userDoc = await getDoc(doc(db, "users", otherUserId));
              if (userDoc.exists()) {
                user = { id: userDoc.id, ...userDoc.data() };
              }
            } catch (e) {}
            enrichedConvs.push({ id: conv.id, auction, otherUserId, user });
          }
          
          setConversations(enrichedConvs);
          setLoadingChats(false);
        }, (error) => {
          console.error("Error fetching conversations:", error);
          setLoadingChats(false);
        });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
            setupListener();
        } else {
            setLoadingChats(false);
        }
    });

    return () => {
        isMounted = false;
        unsubscribeAuth();
        unsubscribe();
    };
  }, [userId, auctions.length]);

  useEffect(() => {
    if (!userId) return;
    
    let unsubscribe = () => {};
    let isMounted = true;

    const setupListener = () => {
        if (!auth.currentUser) return;
        const msgRef = collection(db, "messages");
        const q = query(msgRef, orderBy("created_at", "desc"));
        
        unsubscribe = onSnapshot(q, (snapshot) => {
          if (!isMounted) return;
          let totalUnread = 0;
          const counts = {};
          
          const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
          
          conversations.forEach(conv => {
            const unread = allMsgs.filter(m => m.conversation_id === conv.id && m.sender_id !== userId && !m.is_read).length;
            counts[conv.id] = unread;
            totalUnread += unread;
          });
          
          setUnreadCounts(counts);
          setUnreadMessageCount(totalUnread);
          
          if (activeConversationId) {
             const activeMsgs = allMsgs.filter(m => m.conversation_id === activeConversationId).reverse();
             setMessages(activeMsgs);
          }
        }, (error) => {
           console.error("Error fetching unread messages:", error);
        });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
            setupListener();
        }
    });

    return () => {
        isMounted = false;
        unsubscribeAuth();
        unsubscribe();
    };
  }, [userId, conversations, activeConversationId]);

  useEffect(() => {
    const setupActiveChat = async () => {
      if (!activeChat || !userId || conversations.length === 0) return;
      
      setLoadingMessages(true);
      const existingConv = conversations.find(c => c.auction.id === activeChat);
      let convId = existingConv?.id;
      
      if (!convId) {
        // Find other user ID from activeChat auction
        const auction = auctions.find(a => a.id === activeChat);
        if (auction) {
           const otherUserId = auction.sellerId === userId ? auction.biddingHistory?.[0]?.bidderId : auction.sellerId;
           if (otherUserId) {
               try {
                   const res = await addDoc(collection(db, "conversations"), {
                       auction_id: activeChat,
                       participant_one: userId,
                       participant_two: otherUserId,
                       created_at: new Date().toISOString()
                   });
                   convId = res.id;
               } catch (e) { console.error("Error creating conv", e); }
           }
        }
      }
      
      if (convId) {
         setActiveConversationId(convId);
      }
      setLoadingMessages(false);
    };
    setupActiveChat();
  }, [activeChat, userId, conversations, auctions]);

  const sendMessage = async (content: string, prefix?: string) => {
    if (!activeConversationId || !userId) return;
    setIsSending(true);
    const finalContent = prefix ? prefix + content : content;
    try {
       await addDoc(collection(db, "messages"), {
         conversation_id: activeConversationId,
         sender_id: userId,
         content: finalContent,
         is_read: false,
         created_at: new Date().toISOString()
       });
    } catch (e) {
       console.error("Error sending message:", e);
    } finally {
       setIsSending(false);
    }
  };

  const markAsRead = async (convId: string) => {
    console.log("Marking as read", convId);
  };

  const uploadImage = async (file: File) => {
    console.log("Upload image not fully implemented in Firebase mock", file);
  };

  const retryMessage = async () => {};
  const setTyping = () => {};
  const checkAndRecoverHealth = () => {};

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeChat,
        setActiveChat,
        messages,
        activeConversationId,
        loadingChats,
        loadingMessages,
        unreadMessageCount,
        unreadCounts,
        onlineUsers,
        otherUserTyping,
        setTyping,
        sendMessage,
        retryMessage,
        markAsRead,
        uploadImage,
        isSending,
        isConnecting: false,
        checkAndRecoverHealth
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
