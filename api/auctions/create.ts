import { db } from '../../src/lib/firebase-admin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { itemData, user_id } = req.body || {};
    if (!user_id || !itemData) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    const userDoc = await db.collection('users').doc(user_id).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Uporabnik ne obstaja' });
    }

    const userData = userDoc.data() || {};
    if (userData.auction_blocked_until) {
      const blockedUntil = new Date(userData.auction_blocked_until);
      if (blockedUntil > new Date()) {
        return res.status(403).json({ 
          error: `Objavljanje novih dražb vam je onemogočeno do ${blockedUntil.toLocaleDateString('sl-SI')} zaradi večkratnih kršitev roka za odpošiljanje predmeta.` 
        });
      }
    }

    const auctionId = itemData.id || db.collection('auctions').doc().id;
    const auctionPayload = {
      ...itemData,
      id: auctionId,
      seller_id: user_id,
      status: 'active',
      created_at: new Date().toISOString()
    };

    await db.collection('auctions').doc(auctionId).set(auctionPayload, { merge: true });

    return res.status(200).json({ success: true, id: auctionId });
  } catch (error: any) {
    console.error('Error creating auction:', error);
    return res.status(500).json({ error: error.message || 'Napaka pri objavi dražbe' });
  }
}
