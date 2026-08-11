const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const winningsActions = `
  const handleAcceptSecondChance = async (auction: any) => {
    try {
      const now = new Date();
      const paymentDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const auctionRef = doc(db, 'auctions', auction.id);
      await updateDoc(auctionRef, {
        post_auction_status: 'awaiting_payment_2nd',
        payment_deadline: paymentDeadline,
        winner_id: userData.id, // Update winner so it looks like they won
        winnerId: userData.id
      });
      toast.success("Sprejeli ste ponudbo! Imate 24 ur za plačilo.");
      fetchAuctions();
    } catch (e: any) {
      toast.error("Napaka: " + e.message);
    }
  };

  const handleRejectSecondChance = async (auction: any) => {
    try {
      const auctionRef = doc(db, 'auctions', auction.id);
      await updateDoc(auctionRef, {
        post_auction_status: 'rejected_2nd'
      });
      toast.success("Zavrnili ste ponudbo. Dražba je zaključena.");
      fetchAuctions();
    } catch (e: any) {
      toast.error("Napaka: " + e.message);
    }
  };
`;

code = code.replace(
  /function handleDeliveryMethodSubmit/,
  winningsActions + '\n  function handleDeliveryMethodSubmit'
);

code = code.replace(
  /<button\s*onClick=\{\(\) => \{\s*setSelectedItem\(wonItem\);\s*setActiveView\("detail"\);\s*window\.scrollTo\(\{ top: 0, behavior: "instant" \}\);\s*\}\}\s*className="bg-slate-100 text-\[#0A1128\] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-\[#FEBA4F\] transition-all shadow-xl flex items-center justify-center gap-2"\s*>\s*Odpri dražbo\s*<\/button>/,
  `<button
      onClick={() => {
        setSelectedItem(wonItem);
        setActiveView("detail");
        window.scrollTo({ top: 0, behavior: "instant" });
      }}
      className="bg-slate-100 text-[#0A1128] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] transition-all shadow-xl flex items-center justify-center gap-2"
    >
      Odpri dražbo
    </button>
    
    {wonItem.post_auction_status === 'offered_2nd' && wonItem.second_highest_bidder_id === userData.id ? (
      <>
        <button
          onClick={() => handleAcceptSecondChance(wonItem)}
          className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-green-700 transition-all flex items-center justify-center gap-2"
        >
          Sprejmi ponudbo
        </button>
        <button
          onClick={() => handleRejectSecondChance(wonItem)}
          className="bg-red-100 text-red-700 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-red-200 transition-all flex items-center justify-center gap-2"
        >
          Zavrni
        </button>
      </>
    ) : null}`
);

// We should also replace the checkout/pay button in winnings to only show if they are actually awaiting payment
// Right now it checks if payment_status === "paid". We also need to check post_auction_status
// Let's find where the checkout button is rendered
fs.writeFileSync('App.tsx', code);
