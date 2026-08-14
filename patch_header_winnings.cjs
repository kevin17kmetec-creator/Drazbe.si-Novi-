const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Add to props
code = code.replace(/userEmail\?: string;\n  userProfilePicture\?: string;\n\}> = \(\{/, "newWinningsCount?: number;\n  userEmail?: string;\n  userProfilePicture?: string;\n}> = ({");
code = code.replace(/auctions, userEmail, userProfilePicture \}\) => \{/, "auctions, newWinningsCount, userEmail, userProfilePicture }) => {");

// Add badge to Profile Icon
if (!code.includes('const totalNotifications = (unreadMessageCount || 0) + (newWinningsCount || 0);')) {
    code = code.replace(
        /const userMenuRef = useRef<HTMLDivElement>\(null\);/,
        "const totalNotifications = (unreadMessageCount || 0) + (newWinningsCount || 0);\n  const userMenuRef = useRef<HTMLDivElement>(null);"
    );
}

// Add dot to the User icon
code = code.replace(
    /\{userProfilePicture \? \(\n                        <img/,
    "{totalNotifications > 0 && (\n                          <span className=\"absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse\">{totalNotifications > 9 ? '9+' : totalNotifications}</span>\n                        )}\n                        {userProfilePicture ? (\n                        <img"
);

// Fallback if user doesn't have profile picture (User icon)
code = code.replace(
    /\{!userProfilePicture && <User size=\{20\} \/>\}/,
    "{!userProfilePicture && <User size={20} />}\n                        {totalNotifications > 0 && !userProfilePicture && (\n                          <span className=\"absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse\">{totalNotifications > 9 ? '9+' : totalNotifications}</span>\n                        )}"
);

// Add badge to "Moje zmage"
code = code.replace(
    /<Trophy size=\{18\} \/> \{t\('myWinnings'\)\}<\/button>/,
    "<Trophy size={18} /> {t('myWinnings')}\n                          {newWinningsCount !== undefined && newWinningsCount > 0 && (\n                            <span className=\"ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full\">{newWinningsCount}</span>\n                          )}\n                        </button>"
);

// Add badge to "Sporočila" inside User dropdown
if (code.includes('onMessages(); setIsUserMenuOpen(false);')) {
    code = code.replace(
        /<MessageSquare size=\{18\} \/> \{t\('messages'\)\}<\/button>/,
        "<MessageSquare size={18} /> {t('messages')}\n                          {unreadMessageCount !== undefined && unreadMessageCount > 0 && (\n                            <span className=\"ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full\">{unreadMessageCount}</span>\n                          )}\n                        </button>"
    );
} else {
    // Add Sporočila to user dropdown if not there
    code = code.replace(
        /<button onClick=\{onLogout\} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-red-50 text-red-600 transition-colors text-xs font-black uppercase tracking-widest border-t border-slate-100">/,
        "<button onClick={() => { onMessages(); setIsUserMenuOpen(false); }} className=\"w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest\">\n                          <MessageSquare size={18} /> {t('messages')}\n                          {unreadMessageCount !== undefined && unreadMessageCount > 0 && (\n                            <span className=\"ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full\">{unreadMessageCount}</span>\n                          )}\n                        </button>\n                        <button onClick={onLogout} className=\"w-full flex items-center gap-3 px-6 py-4 hover:bg-red-50 text-red-600 transition-colors text-xs font-black uppercase tracking-widest border-t border-slate-100\">"
    );
}

fs.writeFileSync('src/components/Header.tsx', code);
console.log("Header.tsx patched with notification badges");
