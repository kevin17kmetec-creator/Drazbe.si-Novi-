export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import app from '../src/server/app';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
