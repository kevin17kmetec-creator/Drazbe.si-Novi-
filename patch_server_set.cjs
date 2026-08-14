const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("await userDocRef.set({ stripeAccountId: accountId }, { merge: true });", "await setDoc(userDocRef, { stripeAccountId: accountId }, { merge: true });");
code = code.replace("await transactionDocRef.set({", "await setDoc(transactionDocRef, {");

fs.writeFileSync('server.ts', code);
console.log("server.ts patched sets");
