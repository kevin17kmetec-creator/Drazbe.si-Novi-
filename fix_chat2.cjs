const fs = require('fs');

let code = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');
code = code.replace(/import \{ collection, query, where, or, onSnapshot/g, 'import { onAuthStateChanged } from "firebase/auth";\nimport { collection, query, where, or, onSnapshot');
code = code.replace(/const unsubscribe = onSnapshot\(q, async \(snapshot\) => \{[\s\S]*?\}\);/g, (match) => {
    // We will just rewrite the listeners cleanly.
    return match; // Actually, let's do a larger replace
});
fs.writeFileSync('src/context/ChatContext.tsx', code);
