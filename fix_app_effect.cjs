const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/    import\("firebase\/firestore"\)\.then\(\(\{ collection, onSnapshot \}\) => \{[\s\S]*?    \}\)\.catch\(\(\) => \{\}\);/g, `    unsubscribe = onSnapshot(collection(db, "auctions"), () => {
      if (isMounted) fetchAuctions();
    }, (err: any) => {
      console.warn("Auctions onSnapshot error (will retry):", err);
    });`);

fs.writeFileSync('App.tsx', code);
