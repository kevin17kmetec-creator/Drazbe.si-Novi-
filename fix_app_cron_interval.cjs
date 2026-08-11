const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /useEffect\(\(\) => \{\n\s*if \(!isLoggedIn\) return;/,
  `useEffect(() => {
    // Fire cron job on mount and every 5 minutes
    fetch('/api/cron-auctions', { method: 'POST' }).catch(console.error);
    const cronInterval = setInterval(() => {
       fetch('/api/cron-auctions', { method: 'POST' }).catch(console.error);
    }, 5 * 60 * 1000);
    return () => clearInterval(cronInterval);
  }, []);
  
  useEffect(() => {
    if (!isLoggedIn) return;`
);

fs.writeFileSync('App.tsx', code);
