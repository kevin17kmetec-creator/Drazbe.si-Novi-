const fs = require('fs');
const code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

const matches = code.match(/<[^>]+>[^<{}]*[A-Za-zČŠŽčšž]{2,}[^<{}]*<\/[^>]+>/g);
if (matches) {
  matches.forEach(m => console.log(m));
}
