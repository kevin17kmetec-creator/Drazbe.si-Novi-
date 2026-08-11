const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /<button onClick=\{\(\) => \{ setActiveView\("myUnsold"\); setIsUserMenuOpen\(false\); \}\}/g,
  '<button onClick={() => { setActiveView("myArchive"); setIsUserMenuOpen(false); }}'
);

code = code.replace(
  /Neprodane/g,
  'Arhiv'
);

// We need to also add ViewState type if necessary, though it might just be a string.
// Let's check types.ts
fs.writeFileSync('App.tsx', code);
