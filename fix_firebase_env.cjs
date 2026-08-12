const fs = require('fs');

let firebaseCode = fs.readFileSync('src/lib/firebase.ts', 'utf8');
firebaseCode = firebaseCode.replace(
  /storageBucket: import\.meta\.env\.VITE_FIREBASE_STORAGE_BUCKET \|\| "drazbesi\.firebasestorage\.app"/,
  'storageBucket: (typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_STORAGE_BUCKET : (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET) || "drazbesi.firebasestorage.app"'
);
fs.writeFileSync('src/lib/firebase.ts', firebaseCode);

console.log("Firebase env fix applied.");
