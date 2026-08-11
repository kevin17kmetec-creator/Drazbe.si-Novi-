const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Inject quickRepublishItem state
code = code.replace(
  /const \[republishData, setRepublishData\] = useState<any>\(null\);/,
  `const [republishData, setRepublishData] = useState<any>(null);
  const [quickRepublishItem, setQuickRepublishItem] = useState<any>(null);
  const [quickRepublishDuration, setQuickRepublishDuration] = useState<number>(3); // days`
);

// Add quick republish handler
const quickRepublishHandler = `
  const handleQuickRepublish = async () => {
    if (!quickRepublishItem) return;
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + quickRepublishDuration * 24 * 60 * 60 * 1000);
      const auctionRef = doc(db, 'auctions', quickRepublishItem.id);
      await updateDoc(auctionRef, {
        status: 'active',
        endTime: endTime.toISOString(),
        end_time: endTime.toISOString(),
        currentBid: quickRepublishItem.startingBid || quickRepublishItem.starting_price || 0,
        current_price: quickRepublishItem.startingBid || quickRepublishItem.starting_price || 0,
        bidCount: 0,
        bid_count: 0,
        biddingHistory: [],
        top_bids: [],
        winnerId: null,
        winner_id: null,
        payment_status: 'unpaid',
        post_auction_status: null
      });
      toast.success("Dražba uspešno ponovno objavljena!");
      setQuickRepublishItem(null);
      fetchAuctions();
    } catch (e: any) {
      toast.error(e.message || "Napaka pri ponovni objavi");
    }
  };
`;

code = code.replace(
  /function handleDeliveryMethodSubmit/,
  quickRepublishHandler + '\n  function handleDeliveryMethodSubmit'
);

// Add modal at the end of the return statement before last </div>
const modalUI = `
        {quickRepublishItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0A1128] mb-4">
                Hitra objava dražbe
              </h3>
              <p className="text-sm font-bold text-slate-500 mb-6">
                Izberite, koliko časa naj traja nova dražba za predmet: 
                <span className="text-[#0A1128] block mt-1">{quickRepublishItem.title?.SLO || quickRepublishItem.title}</span>
              </p>
              
              <div className="space-y-4 mb-8">
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400">
                  Trajanje (v dneh)
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="30" 
                  value={quickRepublishDuration}
                  onChange={(e) => setQuickRepublishDuration(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleQuickRepublish}
                  className="w-full bg-[#FEBA4F] text-[#0A1128] py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-[#0A1128] hover:text-white transition-colors"
                >
                  Objavi zdaj
                </button>
                <button
                  onClick={() => setQuickRepublishItem(null)}
                  className="w-full bg-slate-100 text-slate-500 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-colors"
                >
                  Prekliči
                </button>
              </div>
            </div>
          </div>
        )}
`;

code = code.replace(
  /(\s*)(<\/div>\s*<\/ChatProvider>\s*\)\;\s*\}\s*)$/,
  '$1' + modalUI + '$2'
);

// Change the archive buttons
code = code.replace(
  /<button\s*onClick=\{\(\) => \{\s*setRepublishData\(soldItem\);\s*setActiveView\("createAuction"\);\s*window\.scrollTo\(\{ top: 0, behavior: "instant" \}\);\s*\}\}\s*className="bg-\[#0A1128\] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-\[#FEBA4F\] hover:text-\[#0A1128\] transition-all shadow-xl flex items-center justify-center gap-2"\s*>\s*<Upload size=\{16\} \/> Ponovno objavi\s*<\/button>/,
  `<button
    onClick={() => setQuickRepublishItem(soldItem)}
    className="bg-[#FEBA4F] text-[#0A1128] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#0A1128] hover:text-[#FEBA4F] transition-all shadow-xl flex items-center justify-center gap-2"
  >
    <Upload size={16} /> Hitra objava
  </button>
  <button
    onClick={() => {
      setRepublishData(soldItem);
      setActiveView("createAuction");
      window.scrollTo({ top: 0, behavior: "instant" });
    }}
    className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl flex items-center justify-center gap-2"
  >
    <Upload size={16} /> Uredi in objavi
  </button>`
);

fs.writeFileSync('App.tsx', code);
