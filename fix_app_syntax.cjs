const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const target = `    case "createAuction":
      if (!isLoggedIn) {
        content = (
          <AuthView
            onLoginSuccess={() => setActiveView("createAuction")}
            t={t}
            setIsVerified={setIsVerified}
            setAppLoggedIn={(val) => setIsLoggedIn(val)}
          />
        );
}
              className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-xl"
            >
              Pojdi v nastavitve
            </button>
          </div>
        );
}
              className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-xl"
            >
              Pojdi v nastavitve
            </button>
          </div>
        );
      } else {
        content = (
          <CreateAuctionForm
            onBack={() => {
              setActiveView("grid");
              setRepublishData(null);
            }}`;

const replacement = `    case "createAuction":
      if (!isLoggedIn) {
        content = (
          <AuthView
            onLoginSuccess={() => setActiveView("createAuction")}
            t={t}
            setIsVerified={setIsVerified}
            setAppLoggedIn={(val) => setIsLoggedIn(val)}
          />
        );
      } else if (!userData.stripe_onboarding_complete) {
        content = (
          <div className="max-w-3xl mx-auto py-32 px-6 flex flex-col items-center text-center animate-in">
            <div className="bg-red-50 text-red-500 w-24 h-24 rounded-full flex items-center justify-center mb-8 border-4 border-red-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h1 className="text-4xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">
              {t("cannotPublish")}
            </h1>
            <p className="text-lg text-slate-500 mb-8 max-w-xl font-medium">
              You must set up your payment account in settings first.
            </p>
            <button
              onClick={() => setActiveView("settings")}
              className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-colors shadow-xl"
            >
              Pojdi v nastavitve
            </button>
          </div>
        );
      } else {
        content = (
          <CreateAuctionForm
            onBack={() => {
              setActiveView("grid");
              setRepublishData(null);
            }}`;

code = code.replace(target, replacement);
fs.writeFileSync('App.tsx', code);
