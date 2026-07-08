const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const target = `  if (isHydrating) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0A1128] border-t-[#FEBA4F] rounded-full animate-spin"></div>
      </div>
    );
  }`;

const replacement = `  const [dontShowTermsAgain, setDontShowTermsAgain] = useState(false);

  const handleBidSubmit = (item: AuctionItem, amount: number) => {
    if (!isLoggedIn) {
      toast.error(t("login"));
      setActiveView("login");
      return;
    }
    setPendingBid({ item, amount });
    if (!hasAcceptedTerms && !localStorage.getItem("dontShowTermsAgain")) {
      setShowTermsModal(true);
    } else {
      setShowConfirmBidModal(true);
    }
  };

  const handleCancelTerms = () => {
    setShowTermsModal(false);
    setPendingBid(null);
  };

  const handleAcceptTerms = () => {
    setHasAcceptedTerms(true);
    if (dontShowTermsAgain) {
      localStorage.setItem("dontShowTermsAgain", "true");
    }
    setShowTermsModal(false);
    setShowConfirmBidModal(true);
  };

  const handleCancelConfirmBid = () => {
    setShowConfirmBidModal(false);
    setPendingBid(null);
  };

  const handleConfirmBid = async () => {
    if (!pendingBid) return;
    const { item, amount } = pendingBid;
    
    setShowConfirmBidModal(false);
    try {
        const { data, error } = await supabase.from("auctions").select("*").eq("id", item.id).single();
        if (error) { toast.error("Error"); return; }
        
        await supabase.from("auctions").update({
            current_price: amount,
            bid_count: (data.bid_count || 0) + 1,
            winner_id: userData.id
        }).eq("id", item.id);
        toast.success("Ponudba uspešno oddana!");
    } catch (e) {
        toast.error("Error");
    }
    setPendingBid(null);
  };

  const handleDeliveryMethodSubmit = (method: 'personal' | 'post') => {
    setDeliveryMethodModal(prev => ({ ...prev, isOpen: false }));
    fetchAuctions();
  };

  const handleReceiptConfirmSubmit = () => {
    setReceiptConfirmModal(prev => ({ ...prev, isOpen: false }));
    fetchAuctions();
  };

  const handleRatingSubmit = () => {
    setRatingModal(prev => ({ ...prev, isOpen: false }));
    fetchAuctions();
  };

  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center font-sans">
        <h1 className="text-3xl font-black text-[#0A1128] uppercase tracking-widest">Stran je trenutno v pripravi.</h1>
      </div>
    );
  }

  if (isHydrating || isAllowed === null) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0A1128] border-t-[#FEBA4F] rounded-full animate-spin"></div>
      </div>
    );
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('App.tsx', code);
