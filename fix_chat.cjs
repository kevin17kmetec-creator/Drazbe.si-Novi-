const fs = require('fs');
let code = fs.readFileSync('src/context/ChatContext.tsx', 'utf8');

code = code.replace(/const unsubscribe = onSnapshot\(q, async \(snapshot\) => \{/g, 
`const unsubscribe = onSnapshot(q, async (snapshot) => {`);

code = code.replace(/\}\);\s*return \(\) => unsubscribe\(\);/g, `}, (error) => {
      console.error("Conversations snapshot error:", error);
    });
    return () => unsubscribe();`);
    
// for messages snapshot:
code = code.replace(/const unsubscribe = onSnapshot\(q, \(snapshot\) => \{/g, 
`const unsubscribe = onSnapshot(q, (snapshot) => {`);

code = code.replace(/setMessages\(msgs\);\n\s*setLoadingMessages\(false\);\n\s*\}\);\n\s*return \(\) => unsubscribe\(\);/g, `setMessages(msgs);
      setLoadingMessages(false);
    }, (error) => {
      console.error("Messages snapshot error:", error);
      setLoadingMessages(false);
    });
    return () => unsubscribe();`);
    
fs.writeFileSync('src/context/ChatContext.tsx', code);
