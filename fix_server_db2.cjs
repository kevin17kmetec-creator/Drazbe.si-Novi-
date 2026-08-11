const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix multiline .where().where().get()
code = code.replace(
/const endedAuctions = await db\.collection\('auctions'\)\s*\.where\('status',\s*'==',\s*'active'\)\s*\.where\('end_time',\s*'<=',\s*nowStr\)\s*\.get\(\);/,
`const endedAuctions = await getDocs(query(collection(db, 'auctions'), where('status', '==', 'active'), where('end_time', '<=', nowStr)));`
);

code = code.replace(
/const endedAuctions2 = await db\.collection\('auctions'\)\s*\.where\('status',\s*'==',\s*'active'\)\s*\.where\('endTime',\s*'<=',\s*nowStr\)\s*\.get\(\);/,
`const endedAuctions2 = await getDocs(query(collection(db, 'auctions'), where('status', '==', 'active'), where('endTime', '<=', nowStr)));`
);

code = code.replace(
/const expired1st = await db\.collection\('auctions'\)\s*\.where\('post_auction_status',\s*'==',\s*'awaiting_payment_1st'\)\s*\.where\('payment_deadline',\s*'<=',\s*nowStr\)\s*\.get\(\);/,
`const expired1st = await getDocs(query(collection(db, 'auctions'), where('post_auction_status', '==', 'awaiting_payment_1st'), where('payment_deadline', '<=', nowStr)));`
);

code = code.replace(
/const expiredOffers = await db\.collection\('auctions'\)\s*\.where\('post_auction_status',\s*'==',\s*'offered_2nd'\)\s*\.where\('second_chance_deadline',\s*'<=',\s*nowStr\)\s*\.get\(\);/,
`const expiredOffers = await getDocs(query(collection(db, 'auctions'), where('post_auction_status', '==', 'offered_2nd'), where('second_chance_deadline', '<=', nowStr)));`
);

code = code.replace(
/const expired2nd = await db\.collection\('auctions'\)\s*\.where\('post_auction_status',\s*'==',\s*'awaiting_payment_2nd'\)\s*\.where\('payment_deadline',\s*'<=',\s*nowStr\)\s*\.get\(\);/,
`const expired2nd = await getDocs(query(collection(db, 'auctions'), where('post_auction_status', '==', 'awaiting_payment_2nd'), where('payment_deadline', '<=', nowStr)));`
);

// Fix .get() on userRef
code = code.replace(/await userRef\.get\(\)/g, 'await getDoc(userRef)');

// Fix .get() on refs from addDoc
code = code.replace(/const snap = await ref\.get\(\);/g, 'const snap = await getDoc(ref);');

// Fix exist check
code = code.replace(/userDoc\.exists/g, 'userDoc.exists()');

fs.writeFileSync('server.ts', code);
