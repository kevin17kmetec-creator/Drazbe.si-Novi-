const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /async function handleBidSubmit\(item: any, amount: number\) \{[\s\S]*?setPendingBid\(\{ item, amount \}\);/,
  `async function handleBidSubmit(item: any, amount: number) {
    if (!isLoggedIn) {
      toast.error(t("login")); setActiveView("login"); return "login_required";
    }
    if (userData.isBlocked || userData.unpaidStrikes >= 3) {
      toast.error("Vaš račun je blokiran za ponujanje zaradi preveč neplačanih dražb (3 opomini).");
      return "error";
    }
    setPendingBid({ item, amount });`
);

fs.writeFileSync('App.tsx', code);
