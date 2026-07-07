const fs = require('fs');

let card = fs.readFileSync('src/components/AuctionCard.tsx', 'utf8');
card = card.replace(/import \{ MOCK_SELLERS \} from '\.\.\/\.\.\/data\.ts';\n?/, '');
card = card.replace(/const seller = MOCK_SELLERS\.find\(s => s\.id === item\.sellerId\);/, 'const seller = undefined;');
fs.writeFileSync('src/components/AuctionCard.tsx', card);

let view = fs.readFileSync('src/components/SellerView.tsx', 'utf8');
view = view.replace(/import \{ MOCK_REVIEWS \} from '\.\.\/\.\.\/data';\n?/, '');
view = view.replace(/MOCK_REVIEWS\[seller\.id\] \|\| /g, '');
fs.writeFileSync('src/components/SellerView.tsx', view);

