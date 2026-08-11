const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /setIsVerified\(data\.is_verified \|\| false\);/,
  `setIsVerified(data.is_verified || false);
          setUserType(data.user_type || data.userType || null);`
);

fs.writeFileSync('App.tsx', code);
