const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Remove Vite import
code = code.replace('import { createServer as createViteServer } from "vite";', '');

// 2. Remove async function startServer() {
code = code.replace('async function startServer() {\n  const app = express();', 'const app = express();\nexport default app;');

// 3. Find the end of startServer() and replace with startLocalServer()
const endViteMiddlewareStr = `  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

startServer();`;

const replacement = `async function startLocalServer() {
  const PORT = 3000;
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startLocalServer();
}`;

if (code.includes('startServer();')) {
    // Replace the end part
    // Since whitespace might differ, let's use a regex to replace from '// Vite middleware for development' to the end of file
    code = code.replace(/\/\/ Vite middleware for development[\s\S]+startServer\(\);/, replacement);
}

fs.writeFileSync('server.ts', code);
console.log('Refactoring complete.');
