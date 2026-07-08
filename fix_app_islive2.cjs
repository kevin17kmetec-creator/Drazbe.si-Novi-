const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/    if \(\s*\n\s*IS_LIVE \|\|[\s\S]*?\)\s*\{/g, `    if (true) {`);

code = code.replace(/      \} else if \(\!userData\.stripe_onboarding_complete\) \{[\s\S]*?      \}/g, '');

fs.writeFileSync('App.tsx', code);
