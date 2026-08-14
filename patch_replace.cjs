const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('images[0]?.replace?.(')) {
        lines[i] = lines[i].replace(/images\[0\]\?\.\s*replace\?\.\(/, "images[0]");
        lines[i] = lines[i].replace(/images\[0\]\?\.\s*replace\?\(/, "images[0]");
    }
}
fs.writeFileSync('App.tsx', lines.join('\n'));
