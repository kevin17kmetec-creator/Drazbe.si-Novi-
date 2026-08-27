const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const errorHandler = `
  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message, stack: err.stack });
  });

async function startLocalServer() {
`;

code = code.replace('async function startLocalServer() {', errorHandler);
fs.writeFileSync('server.ts', code);
