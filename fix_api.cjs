const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('api').filter(f => f.endsWith('.ts'));

for (const file of files) {
    let code = fs.readFileSync(path.join('api', file), 'utf8');

    code = code.replace(/await supabase\.storage\s*\.from\('([a-zA-Z0-9_]+)'\)\s*\.upload\(`([^`]+)`, ([a-zA-Z0-9_]+), \{[\s\S]*?\}\);/g, 
        `await admin.storage().bucket().file(\`$2\`).save($3);`);
        
    code = code.replace(/const \{ data: ([a-zA-Z0-9_]+), error \} = await supabase\.from\('([a-zA-Z0-9_]+)'\)\.select\('([^']+)'\)\.eq\('id', ([a-zA-Z0-9_]+)\)\.single\(\);/g,
        `const $1Doc = await admin.firestore().collection('$2').doc($4).get();\n        const $1 = $1Doc.exists ? $1Doc.data() : null;\n        const error = null;`);
        
    code = code.replace(/const \{ error: ([a-zA-Z0-9_]+) \} = await supabase\s*\.rpc\('([a-zA-Z0-9_]+)', \{[\s\S]*?\}\);/g,
        `let $1 = null; /* RPC call $2 omitted for firebase */`);
        
    code = code.replace(/import \{ supabase \} from '\.\.\/src\/lib\/supabaseClient';/g, `import { admin } from '../server'; /* using admin directly now */`);
    
    fs.writeFileSync(path.join('api', file), code);
}
