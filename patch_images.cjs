const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Update SignedImg component
code = code.replace(
    /if \(src\.startsWith\("http"\)\) \{/,
    "if (src.startsWith(\"http\") || src.startsWith(\"blob:\") || src.startsWith(\"data:\")) {"
);

// Remove .replace from winnings view
code = code.replace(
    /wonItem\.images\[0\]\?\.replace\?\(\n\s*\/[^/]+\/g,\n\s*"",?\n\s*\) \|\| ""/g,
    "wonItem.images[0]"
);

// Remove .replace from mySold view (if same format)
code = code.replace(
    /soldItem\.images\[0\]\?\.replace\?\(\n\s*\/[^/]+\/g,\n\s*"",?\n\s*\) \|\| ""/g,
    "soldItem.images[0]"
);

// Just in case it's all on one line:
code = code.replace(/wonItem\.images\[0\]\?\.replace\?\(\/\(\[\\\[\\\]"'\\]\)\/g, ""\) \|\| ""/g, "wonItem.images[0]");
code = code.replace(/soldItem\.images\[0\]\?\.replace\?\(\/\(\[\\\[\\\]"'\\]\)\/g, ""\) \|\| ""/g, "soldItem.images[0]");

// Fallback manual replace if regex doesn't hit
code = code.split(/wonItem\.images\[0\]\?\.replace\?\([\s\S]*?\) \|\| ""/).join("wonItem.images[0]");
code = code.split(/soldItem\.images\[0\]\?\.replace\?\([\s\S]*?\) \|\| ""/).join("soldItem.images[0]");

fs.writeFileSync('App.tsx', code);
console.log("Images patched");
