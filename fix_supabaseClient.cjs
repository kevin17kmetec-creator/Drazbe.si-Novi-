const fs = require('fs');

let code = fs.readFileSync('src/lib/supabaseClient.ts', 'utf8');

code = code.replace(/\.\.\.snap\.data\(\)/g, '...(snap.data() as any)');
code = code.replace(/\.\.\.snap\.docs\[0\]\.data\(\)/g, '...(snap.docs[0].data() as any)');
code = code.replace(/\.\.\.d\.data\(\)/g, '...(d.data() as any)');
code = code.replace(/\.\.\.snapshot\.data\(\)/g, '...(snapshot.data() as any)');

fs.writeFileSync('src/lib/supabaseClient.ts', code);
