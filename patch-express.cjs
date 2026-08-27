const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const middleware = `
const app = express();

app.use((req, res, next) => {
  if (process.env.VERCEL) {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/webhook')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
  next();
});
`;

code = code.replace('const app = express();', middleware);
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts with URL normalization middleware');
