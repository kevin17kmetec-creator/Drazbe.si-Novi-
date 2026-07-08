const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// The original file is a mess because I used greedy regexes.
