const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Remove IS_LIVE config
code = code.replace(/const IS_LIVE = true;\n/g, '');

// Fix fetchAuctions IS_LIVE check
code = code.replace(/        const newData = IS_LIVE\s*\n\s*\?\s*supabaseData\s*\n\s*:\s*\(\(\) => \{[\s\S]*?              return merged;\n\s*\}\)\(\);/g, `        const newData = supabaseData;`);

// Remove if (!IS_LIVE) in fetchAuctions
code = code.replace(/      if \(!IS_LIVE\) \{\s*\n\s*setAuctions\(\(prev\) =>\s*\n\s*prev.length === \[\]\.length\s*\n\s*\? prev\s*\n\s*: \[\.\.\.\[\]\],\s*\n\s*\);\s*\n\s*\}/g, ``);

// Fix Proxy Bidding Logic
code = code.replace(/    if \(\s*\n\s*IS_LIVE \|\|\s*\n\s*item\.id\.includes\("-"\) \|\|\s*\n\s*\/^\[0-9a-f\]\{8\}\-\[0-9a-f\]\{4\}\-\[0-9a-f\]\{4\}\-\[0-9a-f\]\{4\}\-\[0-9a-f\]\{12\}\$\/i\.test\(\s*\n\s*item\.id,\s*\n\s*\)\s*\n\s*\) \{/g, `    if (true) {`);

// Remove else block of mock auctions
code = code.replace(/    \} else \{\s*\n\s*\/\/ Handle mock auctions locally[\s\S]*?\n\s*\}\s*\n\s*\}\);\n\s*return "success";\n\s*\}/g, ``);

// Fix user stripe check
code = code.replace(/\} else if \(!userData\.stripe_onboarding_complete && IS_LIVE\) \{/g, `} else if (!userData.stripe_onboarding_complete) {`);

// Remove the remaining else if (!userData.stripe_onboarding_complete)
const otherElseIf = `      } else if (!userData.stripe_onboarding_complete) {
        // Allow testing if not IS_LIVE, but still show a warning or just block. The prompt says "ne more objaviti". So let's block even in mock if possible, or assume backend is ready? Let's just block strictly.
        content = (
          <div className="max-w-3xl mx-auto py-32 px-6 flex flex-col items-center text-center animate-in">
            <div className="bg-red-50 text-red-500 w-24 h-24 rounded-full flex items-center justify-center mb-8 border-4 border-red-100">
              <AlertCircle size={48} />
            </div>
            <h1 className="text-4xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">
              {t("cannotPublish")}
            </h1>
            <p className="text-lg text-slate-500 mb-8 max-w-xl font-medium">
              You must set up your payment account in settings first.
            </p>
            <button
              onClick={() => setActiveView("settings")}
              className="bg-[#0A1128] text-white px-8 py-4 rounded-full font-bold uppercase tracking-wider hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors"
            >
              Pojdi v nastavitve
            </button>
          </div>
        );
      }`;
code = code.replace(otherElseIf, ``);

fs.writeFileSync('App.tsx', code);
