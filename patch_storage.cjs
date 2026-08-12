const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

const target = `                        console.warn("Firebase Storage upload encountered an error, falling back to data URL:", e);
                        downloadUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(compressedFile);
                        });
                    }`;

const replacement = `                        console.error("Firebase Storage upload encountered an error:", e);
                        if (e?.code === 'storage/quota-exceeded') {
                            throw new Error('Presegli ste dnevno kvoto za slike na Firebase (Storage Quota Exceeded).');
                        } else if (e?.code === 'storage/unauthorized') {
                            throw new Error('Nimate pravic za nalaganje slik (Unauthorized). Preverite Firebase Storage pravila.');
                        } else {
                            throw new Error(e.message || 'Napaka pri nalaganju slike na strežnik.');
                        }
                    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
console.log("Done patching storage error handling");
