const fs = require('fs');
let code = fs.readFileSync('./App.tsx', 'utf8');

// Add import
if (!code.includes('import { CreatePackageForm }')) {
  code = code.replace(
    'import { CreateAuctionForm } from "./src/components/CreateAuctionForm";',
    'import { CreateAuctionForm } from "./src/components/CreateAuctionForm";\nimport { CreatePackageForm } from "./src/components/CreatePackageForm";'
  );
}

// Add state
if (!code.includes('const [createMode, setCreateMode]')) {
  code = code.replace(
    'const [isHydrating, setIsHydrating] = useState(true);',
    'const [isHydrating, setIsHydrating] = useState(true);\n  const [createMode, setCreateMode] = useState<"choice" | "single" | "package">("choice");'
  );
}

// Add package publish handler
const packagePublishHandler = `
  const handlePublishPackage = async (pkg: {title: string, items: any[]}) => {
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
  };
`;

if (!code.includes('handlePublishPackage')) {
  code = code.replace(
    'const handlePublish = async (itemData: any) => {',
    packagePublishHandler + '\n  const handlePublish = async (itemData: any) => {'
  );
}

// Modify the view renderer
const createViewReplacement = `
      } else {
        if (createMode === "choice") {
          content = (
            <div className="max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in">
              <h1 className="text-3xl font-black mb-8 text-center text-[#0A1128]">Kaj želite ustvariti?</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div 
                  onClick={() => setCreateMode("single")}
                  className="bg-white p-8 rounded-3xl shadow-lg border-2 border-transparent hover:border-blue-500 cursor-pointer transition-all hover:-translate-y-1 group"
                >
                  <div className="bg-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <span className="text-4xl">📄</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Enojna dražba</h2>
                  <p className="text-gray-500 line-height-relaxed">
                    Objavite en posamezen predmet. Idealno za večino prodajalcev, ki želijo prodati določen artikel.
                  </p>
                </div>
                
                <div 
                  onClick={() => setCreateMode("package")}
                  className="bg-white p-8 rounded-3xl shadow-lg border-2 border-transparent hover:border-blue-500 cursor-pointer transition-all hover:-translate-y-1 group relative overflow-hidden"
                >
                  <div className="absolute top-6 right-6 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">NOVO</div>
                  <div className="bg-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <span className="text-4xl">📦</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Paket dražb</h2>
                  <p className="text-gray-500 line-height-relaxed">
                    Združite več artiklov v en paket. Račun za provizijo se obračuna šele, ko poteče ZADNJA dražba v paketu. Vsi zmagani artikli istega kupca se združijo na 1 račun.
                  </p>
                </div>
              </div>
              <div className="mt-8 text-center">
                <button onClick={() => { setActiveView("grid"); setCreateMode("choice"); }} className="text-gray-500 hover:text-black font-bold">
                  Nazaj na domačo stran
                </button>
              </div>
            </div>
          );
        } else if (createMode === "single") {
          content = (
            <CreateAuctionForm
              onBack={() => {
                setCreateMode("choice");
                setRepublishData(null);
              }}
              t={t}
              language={language}
              onPublish={handlePublish}
              isLoggedIn={isLoggedIn}
              initialData={republishData}
              userData={userData}
              onNavigateToSettings={(tab) => {
                setSettingsTab(tab || 'personal');
                setActiveView("settings");
              }}
            />
          );
        } else {
          content = (
            <CreatePackageForm
              onBack={() => setCreateMode("choice")}
              t={t}
              language={language}
              onPublishPackage={handlePublishPackage}
              isLoggedIn={isLoggedIn}
              userData={userData}
              onNavigateToSettings={(tab) => {
                setSettingsTab(tab || 'personal');
                setActiveView("settings");
              }}
            />
          );
        }
      }
`;

code = code.replace(
/\} else \{\s*content = \(\s*<CreateAuctionForm[\s\S]*?\/>\s*\);\s*\}/,
createViewReplacement.trim()
);

fs.writeFileSync('./App.tsx', code);
console.log('App patched');
