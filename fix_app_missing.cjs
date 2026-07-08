const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const funcs = `
  const [dontShowTermsAgain, setDontShowTermsAgain] = useState(false);

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
`;

code = code.replace(/  if \(isAllowed === false\) \{/g, funcs);
fs.writeFileSync('App.tsx', code);
