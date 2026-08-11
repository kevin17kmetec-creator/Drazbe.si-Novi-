const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const cronEndpoint = `
  app.post("/api/cron-auctions", async (req, res) => {
    try {
      const now = new Date();
      const nowStr = now.toISOString();

      // 1. Process active auctions that have ended
      const endedAuctions = await db.collection('auctions')
        .where('status', '==', 'active')
        .where('end_time', '<=', nowStr)
        .get();

      // Also check endTime just in case
      const endedAuctions2 = await db.collection('auctions')
        .where('status', '==', 'active')
        .where('endTime', '<=', nowStr)
        .get();

      const processDoc = async (doc) => {
          const data = doc.data();
          if (data.status !== 'active') return; // Double check
          
          let hasBids = data.bid_count > 0;
          if (hasBids) {
              const paymentDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
              await db.collection('auctions').doc(doc.id).update({
                  status: 'completed',
                  post_auction_status: 'awaiting_payment_1st',
                  payment_deadline: paymentDeadline
              });
          } else {
              // Unsold
              await db.collection('auctions').doc(doc.id).update({
                  status: 'completed',
                  post_auction_status: 'unsold'
              });
          }
      };

      for (let doc of endedAuctions.docs) await processDoc(doc);
      for (let doc of endedAuctions2.docs) await processDoc(doc);

      // 2. Process awaiting_payment_1st that expired
      const expired1st = await db.collection('auctions')
        .where('post_auction_status', '==', 'awaiting_payment_1st')
        .where('payment_deadline', '<=', nowStr)
        .get();

      for (let doc of expired1st.docs) {
          const data = doc.data();
          const winnerId = data.winner_id || data.winnerId;
          
          if (winnerId) {
             const userRef = db.collection('users').doc(winnerId);
             const userDoc = await userRef.get();
             if (userDoc.exists) {
                 const udata = userDoc.data();
                 const newStrikes = (udata.unpaidStrikes || 0) + 1;
                 const updates = { unpaidStrikes: newStrikes };
                 if (newStrikes >= 3) {
                     updates.isBlocked = true;
                 }
                 await userRef.update(updates);
             }
          }

          await db.collection('auctions').doc(doc.id).update({
              post_auction_status: 'failed_1st'
          });
      }

      // 3. Process offered_2nd that expired (48h)
      const expiredOffers = await db.collection('auctions')
        .where('post_auction_status', '==', 'offered_2nd')
        .where('second_chance_deadline', '<=', nowStr)
        .get();

      for (let doc of expiredOffers.docs) {
          await db.collection('auctions').doc(doc.id).update({
              post_auction_status: 'archived'
          });
      }

      // 4. Process awaiting_payment_2nd that expired (24h)
      const expired2nd = await db.collection('auctions')
        .where('post_auction_status', '==', 'awaiting_payment_2nd')
        .where('payment_deadline', '<=', nowStr)
        .get();

      for (let doc of expired2nd.docs) {
          await db.collection('auctions').doc(doc.id).update({
              post_auction_status: 'archived'
          });
      }

      res.json({ success: true, processed: true });
    } catch (e) {
      console.error("Cron error:", e);
      res.status(500).json({ error: e.message });
    }
  });
`;

code = code.replace(
  /app\.get\("\/api\/health", \(req, res\) => \{/,
  cronEndpoint + '\n  app.get("/api/health", (req, res) => {'
);

fs.writeFileSync('server.ts', code);
