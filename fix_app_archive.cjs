const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

// Replace myUnsold with myArchive in view logic
code = code.replace(
  /case "myUnsold":/,
  'case "myArchive":'
);

code = code.replace(
  /const currentUserUnsold = auctions\.filter\([\s\S]*?\);\s*content = \(/,
  `const currentUserArchive = auctions.filter(
        (a) =>
          (a.sellerId === userData.id ||
            (a as any).seller_id === userData.id) &&
          (a.status === "completed" || new Date(a.endTime) <= new Date()) &&
          (a.post_auction_status === "unsold" || a.post_auction_status === "archived" || a.post_auction_status === "failed_1st" || a.post_auction_status === "failed_2nd" || a.post_auction_status === "rejected_2nd" || (!a.winnerId && !(a as any).winner_id))
      );
      content = (`
);

code = code.replace(
  /currentUserUnsold\.length === 0/g,
  'currentUserArchive.length === 0'
);

code = code.replace(
  /currentUserUnsold\.map/g,
  'currentUserArchive.map'
);

code = code.replace(
  /Neprodane dražbe/g,
  'Arhiv dražb'
);

code = code.replace(
  /Pregled vaših neprodanih dražb/g,
  'Pregled zaključenih dražb, ki niso bile prodane'
);

code = code.replace(
  /Nimate neprodanih dražb/g,
  'Arhiv je prazen'
);

fs.writeFileSync('App.tsx', code);
