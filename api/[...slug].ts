import app from '../server.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (error: any) {
    console.error("Email send error / API invocation error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error?.message || 'Unknown Server Error', stack: error?.stack });
    }
  }
}

