const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');
code = code.replace(/setShowConfirmBidModal\(true\);\s*\}\s*return "success";;?/g, 'setShowConfirmBidModal(true);\n    return "success";\n  }');
fs.writeFileSync('App.tsx', code);
