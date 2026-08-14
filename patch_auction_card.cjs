const fs = require('fs');
let code = fs.readFileSync('src/components/AuctionCard.tsx', 'utf8');

const target = `  let borderClass = "border-white/5";
  if (hasBid) {
    borderClass = isWinner ? "border-green-500 border-2 ring-4 ring-green-500/20" : "border-red-500 border-2 ring-4 ring-red-500/20";
  }`;

const replacement = `  let borderClass = "border-transparent";
  if (hasBid) {
    borderClass = isWinner ? "border-green-500 border-2 ring-2 ring-green-500/20" : "border-red-500 border-2 ring-2 ring-red-500/20";
  }`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/AuctionCard.tsx', code);
console.log("Done patching AuctionCard border");
