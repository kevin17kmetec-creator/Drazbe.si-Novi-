const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// We need to inject handleOfferToSecondBidder and handleMoveToArchive
const actionHandlers = `
  const handleOfferToSecondBidder = async (auction: any) => {
    try {
      const topBids = auction.top_bids || [];
      const secondBid = topBids.length > 1 ? topBids[1] : null;
      if (!secondBid) {
        toast.error("Ni 2. najvišjega ponudnika za to dražbo.");
        return;
      }
      
      const now = new Date();
      const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
      const auctionRef = doc(db, 'auctions', auction.id);
      
      await updateDoc(auctionRef, {
        post_auction_status: 'offered_2nd',
        second_highest_bidder_id: secondBid.user_id,
        second_chance_deadline: deadline,
        currentBid: secondBid.amount,
        current_price: secondBid.amount
      });
      
      toast.success("Dražba je bila ponujena 2. najvišjemu ponudniku. Ima 48 ur, da jo sprejme.");
      fetchAuctions();
    } catch (e: any) {
      toast.error("Napaka pri ponujanju dražbe: " + e.message);
    }
  };

  const handleMoveToArchive = async (auction: any) => {
    try {
      const auctionRef = doc(db, 'auctions', auction.id);
      await updateDoc(auctionRef, {
        post_auction_status: 'archived'
      });
      toast.success("Dražba premaknjena v arhiv.");
      fetchAuctions();
    } catch (e: any) {
      toast.error("Napaka pri premikanju: " + e.message);
    }
  };
`;

code = code.replace(
  /function handleDeliveryMethodSubmit/,
  actionHandlers + '\n  function handleDeliveryMethodSubmit'
);

// We need to replace the status tags in mySold
code = code.replace(
  /\{soldItem\.payment_status === "paid" \? \([\s\S]*?Čaka na plačilo\s*<\/span>\s*\)\}/,
  `{soldItem.payment_status === "paid" ? (
      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <CheckCircle2 size={12} /> Plačano
      </span>
   ) : soldItem.post_auction_status === "failed_1st" ? (
      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <AlertCircle size={12} /> Zmagovalec ni plačal
      </span>
   ) : soldItem.post_auction_status === "offered_2nd" ? (
      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <Clock size={12} /> Čaka na odločitev 2. ponudnika
      </span>
   ) : soldItem.post_auction_status === "awaiting_payment_2nd" ? (
      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <Clock size={12} /> Čaka na plačilo (2. ponudnik)
      </span>
   ) : (
      <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <Clock size={12} /> Čaka na plačilo
      </span>
   )}`
);

// We need to append the action buttons in the mySold button list
code = code.replace(
  /<button\s*onClick=\{\(\) => \{\s*setSelectedItem\(soldItem\);\s*setActiveView\("detail"\);\s*window\.scrollTo\(\{ top: 0, behavior: "instant" \}\);\s*\}\}\s*className="bg-slate-100 text-\[#0A1128\] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-\[#FEBA4F\] transition-all shadow-xl flex items-center justify-center gap-2"\s*>\s*Odpri dražbo\s*<\/button>/,
  `<button
      onClick={() => {
        setSelectedItem(soldItem);
        setActiveView("detail");
        window.scrollTo({ top: 0, behavior: "instant" });
      }}
      className="bg-slate-100 text-[#0A1128] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] transition-all shadow-xl flex items-center justify-center gap-2"
    >
      Odpri dražbo
    </button>
    {soldItem.post_auction_status === "failed_1st" && (
      <>
        {soldItem.top_bids && soldItem.top_bids.length > 1 ? (
          <button
            onClick={() => handleOfferToSecondBidder(soldItem)}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
          >
            Ponudi 2. ponudniku
          </button>
        ) : (
          <p className="text-xs text-red-500 font-bold text-center">Ni 2. ponudnika</p>
        )}
        <button
          onClick={() => handleMoveToArchive(soldItem)}
          className="bg-red-100 text-red-700 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-red-200 transition-all flex items-center justify-center gap-2"
        >
          Premakni v arhiv
        </button>
      </>
    )}`
);

// We need to also filter currentUserSold appropriately, because failed_1st and offered_2nd and awaiting_payment_2nd should be in mySold, but unsold and archived should NOT.
// We already changed myArchive to include failed_1st. Wait, if it's in mySold, it shouldn't be in myArchive if it's failed_1st?
// Ah! myArchive currently has `a.post_auction_status === "failed_1st"`. 
// If it's in myArchive, it will ALSO show up there.
// Let's remove failed_1st from myArchive if it HAS a 2nd bidder? 
// No, let's keep failed_1st in mySold, and let the user manually move it to archive.
// Wait, myArchive logic from before: `a.post_auction_status === "unsold" || a.post_auction_status === "archived" || a.post_auction_status === "failed_1st" || a.post_auction_status === "failed_2nd" || a.post_auction_status === "rejected_2nd" || (!a.winnerId && !(a as any).winner_id)`.
// We should remove `failed_1st` from myArchive, because it should stay in mySold until the user clicks "Premakni v arhiv".

code = code.replace(
  /a\.post_auction_status === "failed_1st" \|\| a\.post_auction_status === "failed_2nd" \|\| a\.post_auction_status === "rejected_2nd"/,
  'a.post_auction_status === "failed_2nd" || a.post_auction_status === "rejected_2nd"'
);

fs.writeFileSync('App.tsx', code);
