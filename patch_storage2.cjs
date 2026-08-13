const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

const target = `                        console.error("Firebase Storage upload encountered an error:", e);
                        if (e?.code === 'storage/quota-exceeded') {
                            throw new Error('Presegli ste dnevno kvoto za slike na Firebase (Storage Quota Exceeded).');
                        } else if (e?.code === 'storage/unauthorized') {
                            throw new Error('Nimate pravic za nalaganje slik (Unauthorized). Preverite Firebase Storage pravila.');
                        } else {
                            throw new Error(e.message || 'Napaka pri nalaganju slike na strežnik.');
                        }
                    }`;

const replacement = `                        console.warn("Firebase Storage failed (likely due to new Spark plan limitations). Falling back to Base64:", e);
                        // Od oktobra 2024 Firebase na brezplačnem paketu (Spark) blokira Storage (napaka 402 Quota Exceeded).
                        // Zato slike ekstremno stisnemo (na ~70KB), da jih lahko shranimo direktno v tekstovno bazo (Firestore 1MB limit).
                        try {
                            const superCompressed = await imageCompression(compressedFile, { 
                                maxSizeMB: 0.07, 
                                maxWidthOrHeight: 800, 
                                useWebWorker: true,
                                initialQuality: 0.6
                            });
                            downloadUrl = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(reader.result as string);
                                reader.onerror = reject;
                                reader.readAsDataURL(superCompressed);
                            });
                        } catch(fallbackErr) {
                             throw new Error('Presegli ste kvoto za slike in nadomestno shranjevanje ni uspelo.');
                        }
                    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
console.log("Done patching storage fallback");
