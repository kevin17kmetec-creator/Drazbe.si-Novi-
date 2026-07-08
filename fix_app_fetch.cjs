const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Replace fetchAuctions logic
code = code.replace(/const consecutiveErrorsRef = useRef\(0\);[\s\S]*?const fetchAuctions = useCallback\(async \(\) => \{[\s\S]*?if \(isPollingStopped\) setIsPollingStopped\(false\);/g, 
`const fetchAuctions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("auctions").select("*");
      if (error) {
        console.warn(\`Fetch auctions warning: \${error.message}\`);
        return;
      }`);

// Remove poll() and channel setup from useEffect
const pollEffectStart = code.indexOf('  // Auto-refresh fallback and real-time subscription');
const pollEffectEnd = code.indexOf('  // Sync selectedItem if it was updated in the background');

if (pollEffectStart !== -1 && pollEffectEnd !== -1) {
    const replacement = `  // Native Firebase real-time subscription for auctions
  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;
    
    // We only attach listener once auth is no longer loading, so we don't get permission errors
    // if the rules require auth. (Even if public, it's safer).
    if (isAuthLoading) return;

    import("firebase/firestore").then(({ collection, onSnapshot }) => {
       import("./src/lib/firebase-admin").then(({ db }) => {
           unsubscribe = onSnapshot(collection(db, "auctions"), () => {
              if (isMounted) fetchAuctions();
           }, (err: any) => {
              console.warn("Auctions onSnapshot error (will retry):", err);
           });
       }).catch(() => {});
    }).catch(() => {});

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchAuctions, isAuthLoading]);

`;
    code = code.substring(0, pollEffectStart) + replacement + code.substring(pollEffectEnd);
}

fs.writeFileSync('App.tsx', code);
