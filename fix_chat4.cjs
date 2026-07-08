const fs = require('fs');
let code = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');

const startIdx = code.indexOf('  // Firestore Snapshot Listeners');
const endIdx = code.indexOf('  useEffect(() => {\n    const setupActiveChat');

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + `  // Firestore Snapshot Listeners
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
          const convData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
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
                    region: "Ljubljana",
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
          
          const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
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

` + code.substring(endIdx);
    fs.writeFileSync('src/context/ChatContext.tsx', code);
}
