import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processAuctionCrons } from '../../src/server/cronProcessor.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Security authorization check for Vercel Cron
  const authHeader = req.headers.authorization || '';
  const secretHeader = req.headers['x-cron-secret'];
  const querySecret = req.query?.secret;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const isBearerMatch = authHeader === `Bearer ${cronSecret}`;
    const isSecretHeaderMatch = secretHeader === cronSecret;
    const isQueryMatch = querySecret === cronSecret;

    if (!isBearerMatch && !isSecretHeaderMatch && !isQueryMatch) {
      console.warn('[CRON AUTH] Unauthorized cron execution attempt');
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' });
    }
  }

  try {
    const results = await processAuctionCrons();
    return res.status(200).json(results);
  } catch (error: any) {
    console.error('[CRON HANDLER ERROR]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error in cron handler',
    });
  }
}
