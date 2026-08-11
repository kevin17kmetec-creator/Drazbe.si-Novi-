const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /const currentUserWinnings = useMemo\(\(\) => \{\n\s*if \(\!userData\?\.id\) return \[\];\n\s*return auctions\n\s*\.filter\(\n\s*\(a\) =>\n\s*\(\(a as any\)\.winner_id === userData\.id \|\|\n\s*a\.winnerId === userData\.id\) &&\n\s*\(a\.status === "completed" \|\| a\.endTime\.getTime\(\) <= Date\.now\(\)\),\n\s*\)/,
  `const currentUserWinnings = useMemo(() => {
    if (!userData?.id) return [];
    return auctions
      .filter(
        (a) =>
          (((a as any).winner_id === userData.id || a.winnerId === userData.id) || 
           (a.second_highest_bidder_id === userData.id && (a.post_auction_status === 'offered_2nd' || a.post_auction_status === 'awaiting_payment_2nd'))) &&
          (a.status === "completed" || a.endTime.getTime() <= Date.now()),
      )`
);

fs.writeFileSync('App.tsx', code);
