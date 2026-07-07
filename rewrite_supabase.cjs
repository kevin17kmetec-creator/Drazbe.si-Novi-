const fs = require('fs');

const firebaseInit = `
import * as admin from 'firebase-admin';
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();
`;

function replaceSupabase(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Remove supabase imports and init
    code = code.replace(/import \{ createClient \} from '@supabase\/supabase-js';\n?/g, '');
    code = code.replace(/const supabaseUrl = process\.env\.(VITE_)?SUPABASE_URL \|\| process\.env\.SUPABASE_URL;\n?/g, '');
    code = code.replace(/const supabaseServiceKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| process\.env\.SUPABASE_ANON_KEY;\n?/g, '');
    code = code.replace(/const supabase = createClient\(supabaseUrl!, supabaseServiceKey!\);\n?/g, firebaseInit);

    // Replace basic select single
    code = code.replace(/const \{ data: ([a-zA-Z0-9_]+) \} = await supabase\.from\('([a-zA-Z0-9_]+)'\)\.select\('[^']+'\)\.eq\('id', ([a-zA-Z0-9_]+)\)\.single\(\);/g, 
        `const $1Doc = await db.collection('$2').doc($3).get();\n    const $1 = $1Doc.data();`);
    
    code = code.replace(/const \{ data: ([a-zA-Z0-9_]+) \} = await supabase\.from\('([a-zA-Z0-9_]+)'\)\.select\('\*'\)\.eq\('id', ([a-zA-Z0-9_]+)\)\.single\(\);/g, 
        `const $1Doc = await db.collection('$2').doc($3).get();\n    const $1 = $1Doc.data();`);
        
    code = code.replace(/const \{ data: ([a-zA-Z0-9_]+) \} = await supabase\.from\('([a-zA-Z0-9_]+)'\)\.select\('[^']+'\)\.eq\('([a-zA-Z0-9_]+)', ([a-zA-Z0-9_]+)\)\.single\(\);/g, 
        `const $1Snap = await db.collection('$2').where('$3', '==', $4).limit(1).get();\n    const $1 = $1Snap.empty ? null : $1Snap.docs[0].data();`);

    // Replace update
    code = code.replace(/await supabase\.from\('([a-zA-Z0-9_]+)'\)\.update\(([\s\S]*?)\)\.eq\('id', ([a-zA-Z0-9_]+)\);/g, 
        `await db.collection('$1').doc($3).update($2);`);
        
    code = code.replace(/const \{ error: ([a-zA-Z0-9_]+) \} = await supabase\s*\.from\('([a-zA-Z0-9_]+)'\)\s*\.update\(([\s\S]*?)\)\s*\.eq\('id', ([a-zA-Z0-9_]+)\);/g, 
        `let $1 = null; try { await db.collection('$2').doc($4).update($3); } catch(e) { $1 = e; }`);

    // Replace insert single
    code = code.replace(/const \{ data: ([a-zA-Z0-9_]+), error: ([a-zA-Z0-9_]+) \} = await supabase\.from\('([a-zA-Z0-9_]+)'\)\.insert\(([\s\S]*?)\)\.select\(\)\.single\(\);/g, 
        `let $1 = null, $2 = null;\n    try { \n      const ref = await db.collection('$3').add($4);\n      const snap = await ref.get();\n      $1 = { id: ref.id, ...snap.data() };\n    } catch(e) { $2 = e; }`);

    // Replace insert multiple
    code = code.replace(/await supabase\.from\('([a-zA-Z0-9_]+)'\)\.insert\(([a-zA-Z0-9_]+)\);/g, 
        `const batch = db.batch(); $2.forEach(doc => { const ref = db.collection('$1').doc(); batch.set(ref, doc); }); await batch.commit();`);
        
    // Replace storage upload
    code = code.replace(/await supabase\.storage\.from\('([a-zA-Z0-9_]+)'\)\.upload\(`([^`]+)`, ([a-zA-Z0-9_]+), \{[^}]+\}\);/g,
        `await admin.storage().bucket().file(\`$2\`).save($3);`);
        
    code = code.replace(/const \{ data: \{ publicUrl \} \} = supabase\.storage\.from\('([a-zA-Z0-9_]+)'\)\.getPublicUrl\(`([^`]+)`\);/g,
        `const publicUrl = \`https://storage.googleapis.com/\${admin.storage().bucket().name}/$2\`;`);

    // Replace rpc
    code = code.replace(/const \{ data: ([a-zA-Z0-9_]+), error: ([a-zA-Z0-9_]+) \} = await supabase\.rpc\('([a-zA-Z0-9_]+)', (\{[^}]+\})\);/g,
        `let $1 = null, $2 = null; /* RPC call $3 omitted for firebase */`);
        
    code = code.replace(/const \{ error: ([a-zA-Z0-9_]+) \} = await supabase\.rpc\('([a-zA-Z0-9_]+)', (\{[^}]+\})\);/g,
        `let $1 = null; /* RPC call $2 omitted for firebase */`);

    fs.writeFileSync(filePath, code);
}

const files = [
    'server.ts',
    'api/create-checkout-session.ts',
    'api/create-payment-intent.ts',
    'api/stripe-account-link.ts',
    'api/stripe-account-session.ts',
    'api/stripe-check-account-status.ts',
    'api/webhook.ts'
];

files.forEach(replaceSupabase);

