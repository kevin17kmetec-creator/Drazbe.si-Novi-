import fs from 'fs';

let content = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');

const startIdx = content.indexOf('const setupGlobalChannel = useCallback(async (force = false) => {');
const endMarker = '  const isMountedRef = useRef(true);';
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find markers", startIdx, endIdx);
  process.exit(1);
}

const replacement = `
  const setupGlobalChannel = useCallback(async (force = false) => {
    if (!userIdRef.current) return;
    if (isReconnectingRef.current && !force) return;

    if (reconnectAttemptsRef.current >= 5) {
      console.warn("Max reconnect attempts reached.");
      setConnectionState(false);
      return;
    }

    isReconnectingRef.current = true;

    try {
      if (globalChannelRef.current) {
        await globalChannelRef.current.unsubscribe();
        supabase.removeChannel(globalChannelRef.current);
      }
      if (presenceChannelRef.current && presenceChannelRef.current !== globalChannelRef.current) {
         await presenceChannelRef.current.unsubscribe();
         supabase.removeChannel(presenceChannelRef.current);
      }
      await supabase.removeAllChannels();
    } catch (e) {}
    
    globalChannelRef.current = null;
    presenceChannelRef.current = null;
    setConnectionState(true);

    try {
      const channel = supabase.channel("global_unified_channel", {
        config: { presence: { key: userIdRef.current } }
      });

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
              const filtered = prev.filter(m => !(m.status === "sending" && m.content === newMsg.content && m.sender_id === newMsg.sender_id));
              if (filtered.some(m => m.id === newMsg.id)) return prev;
              return [...filtered, { ...newMsg, status: "sent" as const }].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
            if (newMsg.sender_id !== userIdRef.current && !newMsg.is_read) {
              markAsRead(newMsg.conversation_id);
            }
          } else {
            const convIds = conversationsRef.current.map(p => p.id).filter(id => id);
            if (convIds.includes(newMsg.conversation_id) && newMsg.sender_id !== userIdRef.current) {
              fetchUnread(convIds);
            }
          }
        }
      );

      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload: any) => {
          const updated = payload.new as Message;
          if (updated.conversation_id === activeConvIdRef.current) {
            setMessages((prev) => prev.map(m => m.id === updated.id || (m.status === "sending" && m.content === updated.content) ? { ...updated, status: "sent" as const } : m));
          } else {
            const convIds = conversationsRef.current.map(p => p.id).filter(id => id);
            if (convIds.includes(updated.conversation_id)) fetchUnread(convIds);
          }
        }
      );

      channel.on("broadcast", { event: "typing" }, (payload: any) => {
        if (payload.payload.convId === activeConvIdRef.current && payload.payload.userId !== userIdRef.current) {
          setOtherUserTyping(payload.payload.isTyping);
        }
      });

      channel.on("presence", { event: "sync" }, () => {
        const newState = channel.presenceState();
        const online = new Set<string>();
        Object.keys(newState).forEach(key => online.add(key));
        setOnlineUsers(online);
      });

      channel.subscribe(async (status: string, err: any) => {
        if (status === "SUBSCRIBED") {
          setConnectionState(false);
          reconnectAttemptsRef.current = 0;
          try {
            await channel.track({ online_at: new Date().toISOString() });
          } catch(e) {}
        }
        if (status === "SYSTEM_ERROR" || status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
          setConnectionState(true);
          console.error("Unified Channel Issue:", status, err);
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          if (globalReconnectTimeoutRef.current) clearTimeout(globalReconnectTimeoutRef.current);
          globalReconnectTimeoutRef.current = setTimeout(() => {
            setupGlobalChannel();
            resyncAll();
          }, delay);
        }
      });

      globalChannelRef.current = channel;
      presenceChannelRef.current = channel;
    } catch (err) {
      console.error("Error setting up channel listeners:", err);
      setConnectionState(true);
    } finally {
      isReconnectingRef.current = false;
    }
  }, [resyncAll, setConnectionState, fetchUnread]);

  // 2. Global Realtime Channel Init
  useEffect(() => {
    if (!userId) return;
    setupGlobalChannel();

    const pingInterval = setInterval(() => {
      if (globalChannelRef.current && globalChannelRef.current.state === "joined") {
        globalChannelRef.current.send({ type: "broadcast", event: "ping", payload: {} }).catch(() => {});
      }
    }, 25000);

    return () => {
      if (globalReconnectTimeoutRef.current) clearTimeout(globalReconnectTimeoutRef.current);
      clearInterval(pingInterval);
      if (globalChannelRef.current) {
        try { supabase.removeChannel(globalChannelRef.current); } catch (_) {}
      }
    };
  }, [userId, setupGlobalChannel, hardResetChatState]);

`;

const newContent = content.substring(0, startIdx) + replacement + content.substring(endIdx);
fs.writeFileSync('src/context/ChatContext.tsx', newContent);
console.log("Rewrite successful");
