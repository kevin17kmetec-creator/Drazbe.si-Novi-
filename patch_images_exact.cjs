const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const find1 = `wonItem.images[0]?.replace?.(
                                  /([\[\]"'])/g,
                                  "",
                                ) || ""`;
const replace1 = `wonItem.images[0]`;

code = code.replace(find1, replace1);

const find2 = `soldItem.images[0]?.replace?.(
                                  /([\[\]"'])/g,
                                  "",
                                ) || ""`;
const replace2 = `soldItem.images[0]`;

code = code.replace(find2, replace2);

// If it's still failing, let's just do a manual string search
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('images[0]?.replace?.(')) {
        lines[i] = lines[i].replace(/images\[0\]\?\.replace\?\(/, 'images[0]');
        // Remove the next lines until `) || ""`
        let j = i + 1;
        while (j < lines.length && !lines[j].includes(') || ""')) {
            lines[j] = '';
            j++;
        }
        if (j < lines.length && lines[j].includes(') || ""')) {
            lines[j] = lines[j].replace(/[\s\S]*\) \|\| ""/, '');
        }
    }
}
code = lines.join('\n');

fs.writeFileSync('App.tsx', code);
console.log("Exact patch applied");
