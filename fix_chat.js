const fs = require('fs');
let content = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');

// We will do a full rewrite of the file to fix everything in it
