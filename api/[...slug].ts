export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import app from '@/server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;

