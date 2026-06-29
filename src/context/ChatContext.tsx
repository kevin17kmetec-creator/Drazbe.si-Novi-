import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { supabase } from "../lib/supabaseClient";
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

const getFailedMessages = (convId: string): Message[] => {
  try {
    const stored = localStorage.getItem(`failed_msgs_${convId}`);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const saveFailedMessages = (convId: string, msgs: Message[]) => {
  try {
    localStorage.setItem(`failed_msgs_${convId}`, JSON.stringify(msgs));
  } catch (e) {
    console.error("Failed to save failed messages to localStorage:", e);
  }
};

const addFailedMessage = (convId: string, msg: Message) => {
  const current = getFailedMessages(convId);
  if (!current.some((m) => m.id === msg.id)) {
    saveFailedMessages(convId, [...current, msg]);
  }
};

const removeFailedMessage = (convId: string, tempId: string) => {
  const current = getFailedMessages(convId);
  saveFailedMessages(
    convId,
    current.filter((m) => m.id !== tempId),
  );
};

export const ChatProvider: React.FC<{
  userId: string;
  auctions: AuctionItem[];
  children: React.ReactNode;
}> = ({ userId, auctions, children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isSending, setIsSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const isConnectingRef = useRef(false);

  const setConnectionState = useCallback((state: boolean) => {
    isConnectingRef.current = state;
    setIsConnecting(state);
  }, []);

  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const globalChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const forceReconnectRef = useRef<() => void>(() => {});
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);

  const hardResetChatState = useCallback(async () => {
    console.warn(
      "Drazba.si Watchdog: Triggering Programmatic Hard-Reset of Chat systems.",
    );
    setConnectionState(true);
    if (globalChannelRef.current) {
      try {
        supabase.removeChannel(globalChannelRef.current);
      } catch (e) {}
      globalChannelRef.current = null;
    }
    if (presenceChannelRef.current) {
      try {
        supabase.removeChannel(presenceChannelRef.current);
      } catch (e) {}
      presenceChannelRef.current = null;
    }
    setConversations([]);
    setMessages([]);
    setOnlineUsers(new Set());
    setUnreadCounts({});
    setUnreadMessageCount(0);
    setReloadTrigger((prev) => prev + 1);
  }, []);

  const checkAndRecoverHealth = useCallback(() => {
    if (isReconnectingRef.current || reconnectAttemptsRef.current >= 5) return;
    const isDead =
      isConnectingRef.current ||
      !globalChannelRef.current ||
      globalChannelRef.current.state !== "joined";
    if (isDead) {
      console.warn(
        "Land/Focus check: Socket unresponsive or dead. Performing programmatic hard-reset.",
      );
      hardResetChatState();
    }
  }, [hardResetChatState]);

  useEffect(() => {
    const handleFocus = () => {
      setReloadTrigger((prev) => prev + 1);
      checkAndRecoverHealth();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [checkAndRecoverHealth]);

  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConversationId;
  const userIdRef = useRef<string>(userId);
  userIdRef.current = userId;

  // Extracted references to avoid stale closures
  const conversationsRef = useRef<Conversation[]>(conversations);
  conversationsRef.current = conversations;

  const fetchUnread = useCallback(
    async (convIds: string[]) => {
      if (!userId || convIds.length === 0) {
        setUnreadMessageCount(0);
        setUnreadCounts({});
        return;
      }
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, conversation_id")
          .in("conversation_id", convIds)
          .eq("is_read", false)
          .neq("sender_id", userId);

        if (!error && data) {
          const newCounts: Record<string, number> = {};
          convIds.forEach((id) => {
            newCounts[id] = 0;
          });
          data.forEach((m: any) => {
            if (m.conversation_id) {
              newCounts[m.conversation_id] =
                (newCounts[m.conversation_id] || 0) + 1;
            }
          });
          setUnreadCounts(newCounts);

          const total = Object.values(newCounts).reduce(
            (acc, curr) => acc + curr,
            0,
          );
          setUnreadMessageCount(total);
        }
      } catch (err) {
        console.error("Error fetching unread messages", err);
      }
    },
    [userId],
  );

  // 1. Fetch Conversations
  useEffect(() => {
    if (!userId) {
      setConversations([]);
      return;
    }

    let isMounted = true;
    if (conversationsRef.current.length === 0) setLoadingChats(true);

    const relevant = auctions.filter((a) => {
      const wId = a.winnerId || (a as any).winner_id;
      const sId = a.sellerId || (a as any).seller_id;
      if (wId !== userId && sId !== userId) return false;
      if (!wId) return false;
      return (
        a.status === "completed" || new Date(a.endTime).getTime() <= Date.now()
      );
    });

    const convsBuild = relevant.map((a) => {
      const wId = a.winnerId || (a as any).winner_id;
      const sId = a.sellerId || (a as any).seller_id;
      return {
        id: "",
        auction: a,
        otherUserId: sId === userId ? wId : sId,
      } as Conversation;
    });

    if (convsBuild.length === 0) {
      setConversations([]);
      setLoadingChats(false);
      return;
    }

    const loadConversationsData = async () => {
      try {
        // Fetch user info for other users
        const otherIds = [
          ...new Set(convsBuild.map((c) => c.otherUserId)),
        ].filter(Boolean);
        let usersData: any[] = [];
        if (otherIds.length > 0) {
          const { data } = await supabase
            .from("users")
            .select("id, first_name, last_name, email, profile_picture_url")
            .in("id", otherIds);
          if (data) usersData = data;
        }

        // Fetch conversation IDs from DB
        const { data: convDataList } = await supabase
          .from("conversations")
          .select("id, auction_id, participant_one, participant_two")
          .or(`participant_one.eq.${userId},participant_two.eq.${userId}`);

        const convDataMap = new Map();
        convDataList?.forEach((c) => convDataMap.set(c.auction_id, c.id));

        if (!isMounted) return;

        const enriched = convsBuild.map((c) => {
          const u = usersData.find((u) => u.id === c.otherUserId);
          const dbId = convDataMap.get(c.auction.id) || "";
          return {
            ...c,
            id: dbId,
            user: u
              ? {
                  id: u.id,
                  firstName: u.first_name || "",
                  lastName: u.last_name || "",
                  email: u.email || "",
                  profilePicture: u.profile_picture_url || "",
                }
              : undefined,
          } as Conversation;
        });

        setConversations(enriched);

        // Initial fetch unread
        fetchUnread(enriched.map((e) => e.id).filter((id) => id));
      } catch (e) {
        console.error("Error loading conversations", e);
      } finally {
        if (isMounted) setLoadingChats(false);
      }
    };

    loadConversationsData();

    return () => {
      isMounted = false;
    };
  }, [userId, auctions, fetchUnread, reloadTrigger]);

  const markAsRead = async (convId: string) => {
    if (!userId || !convId) return;
    try {
      setUnreadCounts((prev) => {
        if (prev[convId] === undefined || prev[convId] === 0) return prev;
        const newCounts = { ...prev, [convId]: 0 };
        const total = Object.values(newCounts).reduce(
          (acc, curr) => acc + curr,
          0,
        );
        setUnreadMessageCount(total);
        return newCounts;
      });

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", convId)
        .eq("is_read", false)
        .neq("sender_id", userId);
    } catch (e) {
      console.error("Mark read error", e);
    }
  };

  const globalReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resyncAll = useCallback(async () => {
    const convIds = conversationsRef.current
      .map((p) => p.id)
      .filter((id) => id);
    if (convIds.length > 0) fetchUnread(convIds);

    const cId = activeConvIdRef.current;
    if (cId) {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", cId)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data.map((m: any) => ({ ...m, status: "sent" as const })));
      }
    }
  }, [fetchUnread]);

  const setupGlobalChannel = useCallback(async () => {
    if (!userIdRef.current) return;
    if (isReconnectingRef.current) return;

    if (reconnectAttemptsRef.current >= 5) {
      console.warn(
        "Max reconnect attempts reached. Stopping automated reconnection.",
      );
      setConnectionState(false);
      return;
    }

    isReconnectingRef.current = true;

    if (globalChannelRef.current) {
      try {
        await globalChannelRef.current.unsubscribe();
        supabase.removeChannel(globalChannelRef.current);
      } catch (e) {}
      globalChannelRef.current = null;
    }

    setConnectionState(true);

    try {
      const nonce = Math.random().toString(36).substring(7);
      const channel = supabase.channel(
        `global_syncer_${userIdRef.current}_${nonce}`,
      );

      forceReconnectRef.current = () => {
        setupGlobalChannel();
      };

      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const newMsg = payload.new as Message;

          if (newMsg.conversation_id === activeConvIdRef.current) {
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) =>
                  !(
                    m.status === "sending" &&
                    m.content === newMsg.content &&
                    m.sender_id === newMsg.sender_id
                  ),
              );
              if (filtered.some((m) => m.id === newMsg.id)) return prev;
              return [...filtered, { ...newMsg, status: "sent" as const }].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              );
            });

            if (newMsg.sender_id !== userIdRef.current && !newMsg.is_read) {
              markAsRead(newMsg.conversation_id);
            }
          } else {
            // Update global unread count
            const convIds = conversationsRef.current
              .map((p) => p.id)
              .filter((id) => id);
            if (
              convIds.includes(newMsg.conversation_id) &&
              newMsg.sender_id !== userIdRef.current
            ) {
              fetchUnread(convIds);
            }
          }
        },
      );

      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload: any) => {
          const updated = payload.new as Message;
          if (updated.conversation_id === activeConvIdRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === updated.id ||
                (m.status === "sending" && m.content === updated.content)
                  ? { ...updated, status: "sent" as const }
                  : m,
              ),
            );
          } else {
            const convIds = conversationsRef.current
              .map((p) => p.id)
              .filter((id) => id);
            if (convIds.includes(updated.conversation_id)) {
              fetchUnread(convIds);
            }
          }
        },
      );

      channel.on("broadcast", { event: "typing" }, (payload: any) => {
        if (
          payload.payload.convId === activeConvIdRef.current &&
          payload.payload.userId !== userIdRef.current
        ) {
          setOtherUserTyping(payload.payload.isTyping);
        }
      });

      if (channel.state !== "joined" && channel.state !== "joining") {
        channel.subscribe((status: string, err: any) => {
          if (status === "SUBSCRIBED") {
            setConnectionState(false);
            reconnectAttemptsRef.current = 0;
          }
          if (
            status === "SYSTEM_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CHANNEL_ERROR" ||
            status === "CLOSED"
          ) {
            setConnectionState(true);
            console.error("Global Channel Issue:", status, err);

            reconnectAttemptsRef.current += 1;
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptsRef.current),
              10000,
            );

            if (globalReconnectTimeoutRef.current)
              clearTimeout(globalReconnectTimeoutRef.current);
            globalReconnectTimeoutRef.current = setTimeout(() => {
              setupGlobalChannel();
              resyncAll();
            }, delay);
          }
        });
      } else {
        setConnectionState(channel.state !== "joined");
        if (channel.state === "joined") {
          reconnectAttemptsRef.current = 0;
        }
      }

      globalChannelRef.current = channel;
    } catch (err) {
      console.error("Error setting up channel listeners:", err);
      setConnectionState(true);
    } finally {
      isReconnectingRef.current = false;
    }
  }, [resyncAll, setConnectionState, fetchUnread]);

  // 2. Global Realtime Channel for Messages & Visibility Change Resync
  useEffect(() => {
    if (!userId) return;

    setupGlobalChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (reconnectAttemptsRef.current >= 5) return;
        resyncAll();
        checkAndRecoverHealth();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    const pingInterval = setInterval(() => {
      if (
        globalChannelRef.current &&
        globalChannelRef.current.state === "joined"
      ) {
        globalChannelRef.current
          .send({ type: "broadcast", event: "ping", payload: {} })
          .catch(() => {});
      }
    }, 25000);

    return () => {
      if (globalReconnectTimeoutRef.current)
        clearTimeout(globalReconnectTimeoutRef.current);
      clearInterval(pingInterval);
      if (globalChannelRef.current) {
        try {
          supabase.removeChannel(globalChannelRef.current);
        } catch (_) {}
      }
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, setupGlobalChannel, resyncAll, checkAndRecoverHealth]);

  // 3. Presence Setup
  useEffect(() => {
    if (!userId) return;

    const setupPresence = async () => {
      if (presenceChannelRef.current) {
        try {
          await presenceChannelRef.current.unsubscribe();
          supabase.removeChannel(presenceChannelRef.current);
        } catch (e) {}
      }

      let presenceChannel = supabase.channel("global_online", {
        config: { presence: { key: userId } },
      });

      if (
        presenceChannel.state === "joined" ||
        presenceChannel.state === "joining"
      ) {
        try {
          await presenceChannel.unsubscribe();
          supabase.removeChannel(presenceChannel);
          presenceChannel = supabase.channel("global_online", {
            config: { presence: { key: userId } },
          });
        } catch (e) {}
      }

      try {
        presenceChannel.on("presence", { event: "sync" }, () => {
          const newState = presenceChannel.presenceState();
          const online = new Set<string>();
          Object.keys(newState).forEach((key) => online.add(key));
          setOnlineUsers(online);
        });

        if (
          presenceChannel.state !== "joined" &&
          presenceChannel.state !== "joining"
        ) {
          presenceChannel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              try {
                await presenceChannel.track({
                  online_at: new Date().toISOString(),
                });
              } catch (e) {}
            }
          });
        }
        presenceChannelRef.current = presenceChannel;
      } catch (e) {
        console.error("Presence channel setup failed", e);
      }
    };

    setupPresence();

    return () => {
      if (presenceChannelRef.current) {
        try {
          presenceChannelRef.current.unsubscribe();
          supabase.removeChannel(presenceChannelRef.current);
        } catch (_) {}
      }
    };
  }, [userId]);

  // 4. Focus Chat Loading Logic
  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      if (!activeChat || !userId) return;

      // Allow conversations array to populate fully first during initial load
      if (conversations.length === 0 && loadingChats) return;

      setLoadingMessages(true);
      setMessages([]);
      setOtherUserTyping(false);

      try {
        const activeConvItem = conversations.find(
          (c) => c.auction.id === activeChat,
        );
        if (!activeConvItem) {
          if (isMounted) setLoadingMessages(false);
          return;
        }

        let convId = activeConvItem.id;

        if (!convId) {
          let { data: convData } = await supabase
            .from("conversations")
            .select("id")
            .eq("auction_id", activeChat)
            .or(
              `and(participant_one.eq.${userId},participant_two.eq.${activeConvItem.otherUserId}),and(participant_one.eq.${activeConvItem.otherUserId},participant_two.eq.${userId})`,
            )
            .maybeSingle();

          if (!convData) {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert([
                {
                  auction_id: activeChat,
                  participant_one: userId,
                  participant_two: activeConvItem.otherUserId,
                },
              ])
              .select("id")
              .single();
            if (newConv) convData = newConv;
          }
          if (convData) convId = convData.id;

          if (convId && isMounted) {
            setConversations((prev) =>
              prev.map((c) =>
                c.auction.id === activeChat ? { ...c, id: convId } : c,
              ),
            );
          }
        }

        if (convId && isMounted) {
          setActiveConversationId(convId);

          const { data: msgData, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", convId)
            .order("created_at", { ascending: true });

          if (error) throw error;

          if (msgData && isMounted) {
            const failed = getFailedMessages(convId);
            const merged = [
              ...msgData.map((m: any) => ({ ...m, status: "sent" as const })),
              ...failed,
            ];
            setMessages(merged);
            markAsRead(convId);

            const cIds = conversationsRef.current
              .map((x) => x.id)
              .filter(Boolean)
              .filter((id) => id !== convId);
            cIds.push(convId);
            fetchUnread(cIds);
          }
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };

    if (activeChat) {
      loadMessages();
    } else {
      setActiveConversationId(null);
      setMessages([]);
    }

    return () => {
      isMounted = false;
    };
  }, [activeChat, userId, conversations.length, loadingChats, fetchUnread]);

  const setTyping = (isTyping: boolean) => {
    if (!globalChannelRef.current || !activeConversationId) return;

    if (isTyping) {
      globalChannelRef.current
        .send({
          type: "broadcast",
          event: "typing",
          payload: { userId, convId: activeConversationId, isTyping: true },
        })
        .catch(() => {});

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        globalChannelRef.current
          ?.send({
            type: "broadcast",
            event: "typing",
            payload: { userId, convId: activeConversationId, isTyping: false },
          })
          .catch(() => {});
      }, 2000);
    }
  };

  const sendMessage = async (content: string, prefix = "") => {
    if (!userId || !activeConversationId) return;
    const msgText = (prefix + content).trim();
    if (!msgText) return;

    const optimisticId = `temp-${Date.now()}`;
    const newMsg: Message = {
      id: optimisticId,
      conversation_id: activeConversationId,
      sender_id: userId,
      content: msgText,
      created_at: new Date().toISOString(),
      is_read: false,
      status: "sending",
    };

    setMessages((prev) => [...prev, newMsg]);

    let insertCompleted = false;
    try {
      setIsSending(true);

      const timeoutPromise = new Promise<{ data: null; error: Error }>(
        (_, reject) => {
          setTimeout(() => {
            if (!insertCompleted) reject(new Error("Timeout (>5s)"));
          }, 5000);
        },
      );

      const dbPromise = supabase
        .from("messages")
        .insert([
          {
            conversation_id: activeConversationId,
            sender_id: userId,
            content: msgText,
          },
        ])
        .select();

      const { data, error } = (await Promise.race([
        dbPromise,
        timeoutPromise,
      ])) as any;
      insertCompleted = true;

      if (error) throw error;

      if (data && data.length > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...(data[0] as Message), status: "sent" as const }
              : m,
          ),
        );
      }
    } catch (e: any) {
      console.error("Send failed:", e);
      const errorMsg: Message = { ...newMsg, status: "error" as const };
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? errorMsg : m)),
      );
      addFailedMessage(activeConversationId, errorMsg);
      if (e?.message?.includes("Timeout")) {
        forceReconnectRef.current();
      }
    } finally {
      setIsSending(false);
    }
  };

  const retryMessage = async (tempId: string) => {
    if (!userId || !activeConversationId) return;

    const failedList = getFailedMessages(activeConversationId);
    const targetMsg = failedList.find((m) => m.id === tempId);
    if (!targetMsg) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, status: "sending" as const } : m,
      ),
    );

    let insertCompleted = false;
    try {
      setIsSending(true);

      const timeoutPromise = new Promise<{ data: null; error: Error }>(
        (_, reject) => {
          setTimeout(() => {
            if (!insertCompleted) reject(new Error("Timeout (>5s)"));
          }, 5000);
        },
      );

      const dbPromise = supabase
        .from("messages")
        .insert([
          {
            conversation_id: activeConversationId,
            sender_id: userId,
            content: targetMsg.content,
          },
        ])
        .select();

      const { data, error } = (await Promise.race([
        dbPromise,
        timeoutPromise,
      ])) as any;
      insertCompleted = true;

      if (error) throw error;

      if (data && data.length > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...(data[0] as Message), status: "sent" as const }
              : m,
          ),
        );
        removeFailedMessage(activeConversationId, tempId);
      }
    } catch (e: any) {
      console.error("Retry failed:", e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "error" as const } : m,
        ),
      );
      if (e?.message?.includes("Timeout")) {
        forceReconnectRef.current();
      }
    } finally {
      setIsSending(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!userId || !activeConversationId) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `chat_images/${userId}/${fileName}`;

    setIsSending(true);
    try {
      const { error } = await supabase.storage
        .from("auction-images")
        .upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage
        .from("auction-images")
        .getPublicUrl(filePath);
      if (data?.publicUrl) {
        await sendMessage(data.publicUrl, "[IMAGE]");
      }
    } catch (e) {
      console.error("Upload fail:", e);
    } finally {
      setIsSending(false);
    }
  };

  const value: ChatContextType = {
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
    isConnecting,
    checkAndRecoverHealth,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
