import app from '../server.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: any, res: any) {
  return new Promise((resolve, reject) => {
    // Wait for the response to finish before resolving the promise.
    // This prevents Vercel serverless functions from freezing early 
    // while async tasks (like sending emails) are still running in Express.
    res.once('finish', resolve);
    res.once('close', resolve);
    res.once('error', reject);
    
    try {
      app(req, res);
    } catch (error: any) {
      console.error("API invocation error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || 'Unknown Server Error', stack: error?.stack });
      }
      resolve(error);
    }
  });
}

