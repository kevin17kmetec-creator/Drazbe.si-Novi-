const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/await supabase\.storage\s*\.from\('([a-zA-Z0-9_]+)'\)\s*\.upload\(`([^`]+)`, ([a-zA-Z0-9_]+), \{[\s\S]*?\}\);/g, 
    `await admin.storage().bucket().file(\`$2\`).save($3);`);
    
code = code.replace(/const \{ error: ([a-zA-Z0-9_]+) \} = await supabase\s*\.rpc\('([a-zA-Z0-9_]+)', \{[\s\S]*?\}\);/g,
    `let $1 = null; /* RPC call $2 omitted for firebase */`);
    
fs.writeFileSync('server.ts', code);
