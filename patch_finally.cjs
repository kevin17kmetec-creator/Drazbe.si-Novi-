const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

const target = `        } finally { 
            activeUploadTaskRef.current = null;
            setUploading(false); 
        }`;

const replacement = `        } finally { 
            activeUploadTaskRef.current = null;
            setUploading(false); 
            setUploadProgress({});
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
console.log("Done");
