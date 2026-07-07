const fs = require('fs');
const path = require('path');

function processFile(filePath, level) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Remove the bad admin imports and init
    code = code.replace(/import \* as admin from 'firebase-admin';\s*if \(!admin\.apps\.length\) \{[\s\S]*?\}\s*const db = admin\.firestore\(\);/g, '');
    code = code.replace(/import \{ admin \} from '\.\.\/server'; \/\* using admin directly now \*\//g, '');
    code = code.replace(/import \{ admin \} from '\.\.\/server';/g, '');
    
    // Add the correct import
    const relativePath = level === 1 ? '../src/lib/firebase-admin' : './src/lib/firebase-admin';
    code = `import { admin, db } from '${relativePath}';\n` + code;
    
    // Fix `import * as admin` conflicts if there are any lingering
    code = code.replace(/import \* as admin from 'firebase-admin';/g, '');
    
    fs.writeFileSync(filePath, code);
}

processFile('server.ts', 0);

const files = fs.readdirSync('api').filter(f => f.endsWith('.ts'));
for (const file of files) {
    processFile(path.join('api', file), 1);
}
