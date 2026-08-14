const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/wonItem\.images\[0\]\?\.replace\?\(/, "wonItem.images[0]");
code = code.replace(/soldItem\.images\[0\]\?\.replace\?\(/, "soldItem.images[0]");

fs.writeFileSync('App.tsx', code);
