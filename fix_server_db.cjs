const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace imports
code = code.replace(
  /import \{ admin, db \} from '\.\/src\/lib\/firebase-admin';/,
  `import { db } from './src/firebase';
import { admin } from './src/lib/firebase-admin';
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, addDoc, query, where, limit, writeBatch } from 'firebase/firestore';`
);

// db.collection('x').doc('y').update({ ... }) -> updateDoc(doc(db, 'x', 'y'), { ... })
code = code.replace(/await db\.collection\(([^)]+)\)\.doc\(([^)]+)\)\.update\(/g, 'await updateDoc(doc(db, $1, $2), ');

// db.collection('x').doc('y').get() -> getDoc(doc(db, 'x', 'y'))
code = code.replace(/await db\.collection\(([^)]+)\)\.doc\(([^)]+)\)\.get\(\)/g, 'await getDoc(doc(db, $1, $2))');

// db.collection('x').add({ ... }) -> addDoc(collection(db, 'x'), { ... })
code = code.replace(/await db\.collection\(([^)]+)\)\.add\(/g, 'await addDoc(collection(db, $1), ');

// db.collection('x').where(...).limit(...).get()
code = code.replace(/await db\.collection\(([^)]+)\)\.where\(([^,]+),\s*([^,]+),\s*([^)]+)\)\.limit\(([^)]+)\)\.get\(\)/g, 'await getDocs(query(collection(db, $1), where($2, $3, $4), limit($5)))');

// db.collection('x').where(...).get()
code = code.replace(/await db\.collection\(([^)]+)\)\.where\(([^,]+),\s*([^,]+),\s*([^)]+)\)\.get\(\)/g, 'await getDocs(query(collection(db, $1), where($2, $3, $4)))');

// db.collection('x').doc()
code = code.replace(/db\.collection\(([^)]+)\)\.doc\(\)/g, 'doc(collection(db, $1))');

// db.collection('x').doc('y')
code = code.replace(/db\.collection\(([^)]+)\)\.doc\(([^)]+)\)/g, 'doc(db, $1, $2)');

// batch.set(ref, doc) is same syntax if batch is from writeBatch(db)
// const batch = db.batch();
code = code.replace(/const batch = db\.batch\(\);/g, 'const batch = writeBatch(db);');

// data() method still works on client DocumentSnapshot
fs.writeFileSync('server.ts', code);
