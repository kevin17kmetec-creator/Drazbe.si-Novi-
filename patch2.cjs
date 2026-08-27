const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const middleware = `
app.use((req, res, next) => {
  if (process.env.VERCEL) {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/webhook')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    
    // On Vercel, the default body parser is enabled for all routes EXCEPT /api/webhook.
    // This means Vercel already parses JSON into req.body.
    // express.json() will hang waiting for stream data that's already consumed.
    // By setting req._body = true, we tell express.json() to skip parsing.
    if (req.url !== '/api/webhook' && req.url !== '/webhook') {
      req._body = true;
    }
  }
  next();
});
`;

code = code.replace(/app\.use\(\(req, res, next\) => \{[\s\S]*?next\(\);\n\}\);/, middleware.trim());
fs.writeFileSync('server.ts', code);
