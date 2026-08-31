const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The bad sed removed lines:
//         // Generate Certificate for Individuals
//         if (buyer.user_type !== 'business') {
//             try {
//                 const certFileName = `potrdilo_${transaction.id.substring(0,8)}.pdf`;
//                 ...
//             } catch (e) {}
//         }
// But because of nested braces, it stopped early. I'll just remove anything mentioning certFileName and the remaining parts of it manually.

code = code.replace(/const certFileName = .*?;/g, "");
code = code.replace(/const fileRef = storageRef\(storage, `\$\{buyer_id\}\/\$\{certFileName\}`\);/g, "");
code = code.replace(/await uploadBytes\(fileRef, certPdfBuffer\);/g, "");
code = code.replace(/const publicUrl = await getDownloadURL\(fileRef\);/g, "");
code = code.replace(/documentsToInsert\.push\(\{\s*transaction_id: transaction\.id,\s*user_id: buyer_id,\s*type: 'certificate',\s*file_url: publicUrl\s*\}\);/g, "");
code = code.replace(/attachments\.push\(\{\s*filename: certFileName,\s*content: certPdfBuffer\s*\}\);/g, "");
code = code.replace(/\} catch \(e\) \{ console\.error\('Cert error:', e\); \}/g, "");
code = code.replace(/\} catch\(e\) \{ console\.error\('Cert error:', e\); \}/g, "");
code = code.replace(/if \(buyer\.user_type !== 'business'\) \{/g, "");

fs.writeFileSync('server.ts', code);
