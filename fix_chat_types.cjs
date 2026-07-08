const fs = require('fs');
let code = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');

code = code.replace(/const convData = snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g, `const convData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));`);

code = code.replace(/const allMsgs = snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \}\)\);/g, `const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));`);

code = code.replace(/region: "Ljubljana",/g, `region: "Ljubljana" as any,`);

fs.writeFileSync('src/context/ChatContext.tsx', code);
