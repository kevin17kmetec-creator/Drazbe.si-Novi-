const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const oldHandle = `const handlePublishPackage = async (pkg: {title: string, items: any[]}) => {
    if (!userData?.id) {
      toast.error(t("loginRequired"));
      return;
    }
    
    // Simulate formatting items just like single publish
    const formattedItems = pkg.items.map((itemData: any) => {
      const getConditionTranslations = (cond: string) => {
        switch (cond) {
          case "Novo": return { SLO: "Novo", EN: "New", DE: "Neu" };
          case "Kot novo": return { SLO: "Kot novo", EN: "Like New", DE: "Wie Neu" };
          case "Rabljeno": return { SLO: "Rabljeno", EN: "Used", DE: "Gebraucht" };
          case "Potrebno obnove": return { SLO: "Potrebno obnove", EN: "Needs Restoration", DE: "Restaurierungsbedürftig" };
          case "Za dele": return { SLO: "Za dele", EN: "For Parts", DE: "Für Ersatzteile" };
          default: return { SLO: cond, EN: cond, DE: cond };
        }
      };

      return {
        id: itemData.id,
        title: { SLO: itemData.title?.SLO || itemData.title, EN: itemData.title?.SLO || itemData.title, DE: itemData.title?.SLO || itemData.title },
        description: { SLO: itemData.description, EN: itemData.description, DE: itemData.description },
        current_price: parseInt(itemData.startingPrice),
        bid_count: 0,
        item_count: 1,
        end_time: itemData.endTime || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        location: itemData.location || { SLO: "Neznano", EN: "Unknown", DE: "Unbekannt" },
        region: itemData.region || "Osrednjeslovenska",
        category: itemData.category || "Ostalo",
        condition: getConditionTranslations(itemData.condition || "Rabljeno"),
        specifications: {},
        bidding_history: [],
        top_bids: [],
        winner_id: null,
        winnerId: null,
        payment_status: 'unpaid',
        post_auction_status: null,
        images: itemData.images,
        delivery_option: itemData.delivery_option || 'both',
        shipping_fee_type: itemData.shipping_fee_type || 'calculated',
        shipping_cost: itemData.shipping_cost !== undefined ? itemData.shipping_cost : null
      };
    });

    try {
      const res = await fetch('/api/packages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pkg.title, items: formattedItems, user_id: userData.id })
      });
      if (res.ok) {
        toast.success("Paket je uspešno objavljen!");
        setActiveView("grid");
        setCreateMode("choice");
        fetchAuctions();
      } else {
        toast.error("Napaka pri objavi paketa");
      }
    } catch (e) {
      toast.error("Napaka pri povezavi");
    }
  };`;

const newHandle = `const handlePublishPackage = async (pkg: {title: string, items: any[], packageId: string}) => {
    if (!userData?.id) {
      toast.error(t("loginRequired"));
      return;
    }
    
    const getConditionTranslations = (cond: string) => {
        switch (cond) {
          case "Novo": return { SLO: "Novo", EN: "New", DE: "Neu" };
          case "Kot novo": return { SLO: "Kot novo", EN: "Like New", DE: "Wie Neu" };
          case "Rabljeno": return { SLO: "Rabljeno", EN: "Used", DE: "Gebraucht" };
          case "Potrebno obnove": return { SLO: "Potrebno obnove", EN: "Needs Restoration", DE: "Restaurierungsbedürftig" };
          case "Za dele": return { SLO: "Za dele", EN: "For Parts", DE: "Für Ersatzteile" };
          default: return { SLO: cond, EN: cond, DE: cond };
        }
      };

    try {
      const auctionIds = [];
      for (const itemData of pkg.items) {
          // Skip already published items, but collect their IDs
          if (itemData.is_published && itemData.id) {
              auctionIds.push(itemData.id);
              continue;
          }
          
          const payload = {
            title: { SLO: itemData.title?.SLO || itemData.title, EN: itemData.title?.SLO || itemData.title, DE: itemData.title?.SLO || itemData.title },
            description: { SLO: itemData.description, EN: itemData.description, DE: itemData.description },
            current_price: parseInt(itemData.startingPrice),
            bid_count: 0,
            item_count: 1,
            end_time: itemData.endTime || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
            location: itemData.location || { SLO: "Neznano", EN: "Unknown", DE: "Unbekannt" },
            region: itemData.region || "Osrednjeslovenska",
            category: itemData.category || "Ostalo",
            condition: getConditionTranslations(itemData.condition || "Rabljeno"),
            specifications: {},
            bidding_history: [],
            top_bids: [],
            winner_id: null,
            winnerId: null,
            payment_status: 'unpaid',
            post_auction_status: null,
            images: itemData.images,
            delivery_option: itemData.delivery_option || 'both',
            shipping_fee_type: itemData.shipping_fee_type || 'calculated',
            shipping_cost: itemData.shipping_cost !== undefined ? itemData.shipping_cost : null,
            is_package: true,
            package_id: pkg.packageId,
            package_title: pkg.title
          };
          
          const res = await fetch('/api/auctions/create', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ itemData: payload, user_id: userData.id })
          });
          if (res.ok) {
             const data = await res.json();
             auctionIds.push(data.id || itemData.id || crypto.randomUUID());
          }
      }
      
      // Upsert package document
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase');
      const pkgRef = doc(db, 'packages', pkg.packageId);
      await setDoc(pkgRef, {
          id: pkg.packageId,
          title: pkg.title,
          seller_id: userData.id,
          auction_ids: auctionIds,
          status: 'active',
          created_at: new Date().toISOString()
      }, { merge: true });

      toast.success("Zbirka je uspešno objavljena!");
      setActiveView("grid");
      setCreateMode("choice");
      fetchAuctions();
    } catch (e) {
      toast.error("Napaka pri povezavi");
    }
  };`;

code = code.replace(oldHandle, newHandle);
fs.writeFileSync('App.tsx', code);
console.log('patched handlePublishPackage');
