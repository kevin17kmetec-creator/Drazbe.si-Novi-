const fs = require('fs');
const code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

// find all JSX text or toast strings that are hardcoded strings
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('toast.') || line.match(/>[A-Za-zČŠŽčšž0-9\s.,?!:-]{4,}</)) {
    console.log(`${idx+1}: ${line.trim()}`);
  }
});
