const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
const regex = /case "package": \{([\s\S]*?)break;\n    \}/g;
let matches = [...code.matchAll(regex)];

if (matches.length > 1) {
    const secondMatch = matches[1][0];
    code = code.replace(secondMatch, '');
    fs.writeFileSync('App.tsx', code);
    console.log('removed duplicate case');
} else {
    console.log('no duplicate case found');
}
