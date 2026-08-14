const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const target1 = `wonItem.images[0]?.replace?.(
                                  /([\[\]"'])/g,
                                  "",
                                ) || ""`;
const target2 = `soldItem.images[0]?.replace?.(
                                  /([\[\]"'])/g,
                                  "",
                                ) || ""`;

code = code.replace(/wonItem\.images\[0\]\?\.replace\?\([\s\S]*?\) \|\| ""/g, "wonItem.images[0]");
code = code.replace(/soldItem\.images\[0\]\?\.replace\?\([\s\S]*?\) \|\| ""/g, "soldItem.images[0]");

fs.writeFileSync('App.tsx', code);
console.log("Brute force patched");
