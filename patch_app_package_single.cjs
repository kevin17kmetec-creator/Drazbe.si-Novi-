const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Inside CreatePackageForm in App.tsx, add onPublishItemDirectly
const createPackageStr = `<CreatePackageForm
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
            />`;

const newCreatePackageStr = `<CreatePackageForm
              onBack={() => setCreateMode("choice")}
              t={t}
              language={language}
              onPublishPackage={handlePublishPackage}
              onPublishItemDirectly={async (itemData: any, pkgTitle: string, packageId: string) => {
                 if (!userData?.id) return;
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
                 const payload = {
                    ...itemData,
                    title: { SLO: itemData.title?.SLO || itemData.title, EN: itemData.title?.SLO || itemData.title, DE: itemData.title?.SLO || itemData.title },
                    description: { SLO: itemData.description, EN: itemData.description, DE: itemData.description },
                    current_price: parseInt(itemData.startingPrice),
                    bid_count: 0,
                    item_count: 1,
                    end_time: itemData.endTime,
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
                    package_id: packageId,
                    package_title: pkgTitle
                 };
                 const res = await fetch('/api/auctions/create', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ itemData: payload, user_id: userData.id })
                 });
                 if (!res.ok) throw new Error("Failed to publish item");
              }}
              isLoggedIn={isLoggedIn}
              userData={userData}
              onNavigateToSettings={(tab) => {
                setSettingsTab(tab || 'personal');
                setActiveView("settings");
              }}
            />`;

code = code.replace(createPackageStr, newCreatePackageStr);
fs.writeFileSync('App.tsx', code);
console.log('patched App.tsx');
