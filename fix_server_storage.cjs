const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Add storage imports
code = code.replace(
  /import \{ collection, doc, getDoc, getDocs, updateDoc, setDoc, addDoc, query, where, limit, writeBatch \} from 'firebase\/firestore';/,
  `import { collection, doc, getDoc, getDocs, updateDoc, setDoc, addDoc, query, where, limit, writeBatch } from 'firebase/firestore';
import { storage } from './src/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';`
);

// Replace admin.storage().bucket().file(...).save(...) and publicUrl
const invoiceReplace1 = `const fileRef = storageRef(storage, \`\${buyer_id}/\${invoiceFileName}\`);
            await uploadBytes(fileRef, invoicePdfBuffer);
            const publicUrl = await getDownloadURL(fileRef);`;

const certReplace1 = `const fileRef = storageRef(storage, \`\${buyer_id}/\${certFileName}\`);
                await uploadBytes(fileRef, certPdfBuffer);
                const publicUrl = await getDownloadURL(fileRef);`;
                
const invoiceReplace2 = `const fileRef = storageRef(storage, \`\${buyer_id}/\${invoiceFileName}\`);
                 await uploadBytes(fileRef, invoicePdfBuffer);
                 const publicUrl = await getDownloadURL(fileRef);`;

const certReplace2 = `const fileRef = storageRef(storage, \`\${buyer_id}/\${certFileName}\`);
                     await uploadBytes(fileRef, certPdfBuffer);
                     const publicUrl = await getDownloadURL(fileRef);`;

code = code.replace(/await admin\.storage\(\)\.bucket\(\)\.file\(`\$\{buyer_id\}\/\$\{invoiceFileName\}`\)\.save\(invoicePdfBuffer\);\s*const publicUrl = `https:\/\/storage\.googleapis\.com\/\$\{admin\.storage\(\)\.bucket\(\)\.name\}\/\$\{buyer_id\}\/\$\{invoiceFileName\}`;/g, invoiceReplace1);
code = code.replace(/await admin\.storage\(\)\.bucket\(\)\.file\(`\$\{buyer_id\}\/\$\{certFileName\}`\)\.save\(certPdfBuffer\);\s*const publicUrl = `https:\/\/storage\.googleapis\.com\/\$\{admin\.storage\(\)\.bucket\(\)\.name\}\/\$\{buyer_id\}\/\$\{certFileName\}`;/g, certReplace1);

fs.writeFileSync('server.ts', code);
