const fs = require('fs');
let code = fs.readFileSync('src/components/SettingsView.tsx', 'utf8');

const regex = /useEffect\(\(\) => \{\n    if \(user\) \{([\s\S]*?)\}\n  \}, \[user\]\);/;

const newEffect = `// Removed auto-updating form on user change to prevent wiping input.
  // The useState initialization is sufficient because SettingsView remounts when opened.`;

code = code.replace(regex, newEffect);
fs.writeFileSync('src/components/SettingsView.tsx', code);
console.log('patched SettingsView effect 2');
