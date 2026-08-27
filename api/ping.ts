import { VercelRequest, VercelResponse } from '@vercel/node';
export default function(req: VercelRequest, res: VercelResponse) {
  res.json({ ping: 'pong' });
}
