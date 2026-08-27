import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/lib/firebase-admin.js';
import { sendOutbidNotification } from '../src/server/emailService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { auction_id, outbid_user_id, new_price } = req.body;

    if (!auction_id || !outbid_user_id) {
      return res.status(400).json({ error: "Manjkajoči podatki" });
    }

    const [auctionSnap, userSnap] = await Promise.all([
      db.collection('auctions').doc(auction_id).get(),
      db.collection('users').doc(outbid_user_id).get(),
    ]);

    if (!auctionSnap.exists || !userSnap.exists) {
      return res.status(404).json({ error: "Dražba ali uporabnik ne obstaja" });
    }

    const auctionData = auctionSnap.data() as any;
    const userData = userSnap.data() as any;

    if (!userData.email) {
      return res.status(200).json({ success: false, reason: "No email on user" });
    }

    const title = auctionData.title?.SLO || auctionData.title?.EN || (typeof auctionData.title === 'string' ? auctionData.title : 'Predmet dražbe');
    const imageUrl = Array.isArray(auctionData.images) && auctionData.images.length > 0 ? auctionData.images[0] : undefined;
    const price = typeof new_price === 'number' ? new_price : Number(auctionData.current_price || 0);

    await sendOutbidNotification({
      toEmail: userData.email,
      recipientName: userData.first_name || userData.name || 'Uporabnik',
      auctionId: auction_id,
      auctionTitle: title,
      auctionImageUrl: imageUrl,
      newPrice: price,
    });

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error("[NOTIFY OUTBID ERROR]", e);
    return res.status(500).json({ error: e.message || 'Napaka pri pošiljanju outbid emaila' });
  }
}
