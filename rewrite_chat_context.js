import fs from 'fs';
let content = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');

// Instead of regex, let's just make it simpler: I will use sed or we can just run a python script
