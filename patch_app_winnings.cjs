const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Insert state
if (!code.includes('const [lastSeenWinnings')) {
    code = code.replace(
        /const \[activeView, setActiveView\] = useState<ViewState>\(\(\) => \{/,
        "const [lastSeenWinnings, setLastSeenWinnings] = useState(() => Number(localStorage.getItem('last_seen_winnings') || \"0\"));\n  const [activeView, setActiveView] = useState<ViewState>(() => {"
    );
}

// Insert effect
if (!code.includes("localStorage.setItem('last_seen_winnings'")) {
    code = code.replace(
        /  useEffect\(\(\) => \{\n    if \(isHydrating\) return;\n/,
        "  useEffect(() => {\n    if (activeView === 'winnings') {\n      const now = Date.now();\n      localStorage.setItem('last_seen_winnings', now.toString());\n      setLastSeenWinnings(now);\n    }\n  }, [activeView]);\n\n  useEffect(() => {\n    if (isHydrating) return;\n"
    );
}

// Insert newWinningsCount
if (!code.includes('const newWinningsCount = useMemo')) {
    code = code.replace(
        /  const filteredAuctions = useMemo/,
        "  const newWinningsCount = useMemo(() => {\n    if (!isLoggedIn || !userData) return 0;\n    return auctions.filter(a => a.status === 'finished' && a.current_bidder === userData.id && new Date(a.endTime || a.end_time).getTime() > lastSeenWinnings).length;\n  }, [auctions, isLoggedIn, userData, lastSeenWinnings]);\n\n  const filteredAuctions = useMemo"
    );
}

// Pass newWinningsCount to Header
code = code.replace(/auctions=\{auctions\}\n          userEmail=\{userData\?\.email\}/, "auctions={auctions}\n          newWinningsCount={newWinningsCount}\n          userEmail={userData?.email}");

fs.writeFileSync('App.tsx', code);
console.log("App.tsx patched with newWinningsCount");
