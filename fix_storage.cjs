const fs = require('fs');

// 1. Update firebase.ts
let firebaseCode = fs.readFileSync('src/lib/firebase.ts', 'utf8');
firebaseCode = firebaseCode.replace(
  /storageBucket:\s*"drazbesi.firebasestorage.app"/,
  'storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app"'
);
fs.writeFileSync('src/lib/firebase.ts', firebaseCode);

// 2. Update CreateAuctionForm.tsx
let formCode = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');
formCode = formCode.replace(
  /try \{\s*const storageRef = ref\(storage, \`auction-images\/\$\{fileName\}\`\);\s*await uploadBytes\(storageRef, arrayBuffer, \{ contentType: compressedFile\.type \}\);\s*downloadUrl = await getDownloadURL\(storageRef\);\s*\} catch\(e\) \{ uploadError = e; \}/,
  `try {
                        const storageRef = ref(storage, \`auction-images/\${fileName}\`);
                        await uploadBytes(storageRef, arrayBuffer, { contentType: compressedFile.type });
                        downloadUrl = await getDownloadURL(storageRef);
                    } catch(e) { 
                        console.error("Storage upload error details:", e);
                        uploadError = e; 
                    }`
);
fs.writeFileSync('src/components/CreateAuctionForm.tsx', formCode);

console.log("Storage fixes applied.");
