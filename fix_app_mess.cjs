const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// I will rebuild the end of fetchAuctions.
// Find `      });\n    } catch (err: any) {\n            const errorMessage = err?.message || String(err);`
// And `            // Remove [EN] and [DE] prefix hardcoding`

const targetMatch = `      });
    } catch (err: any) {
            const errorMessage = err?.message || String(err);
            // Remove [EN] and [DE] prefix hardcoding`;

const replacement = `      });
    } catch (err: any) {
       console.error("Fetch exception", err);
    }
  }, [activeView, selectedItem, selectedSeller, language]);

  const handlePublish = async (itemData: Omit<AuctionItem, "id" | "sellerId" | "bidCount" | "currentBid">) => {
      // Remove [EN] and [DE] prefix hardcoding`;

code = code.replace(targetMatch, replacement);
fs.writeFileSync('App.tsx', code);
