const fs = require('fs');

function replaceImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace './src/...' with '@/src/...'
  if (content.includes("from './src/")) {
    content = content.replace(/from '\.\/src\/(.+?)\.js'/g, "from '@/src/$1'");
    content = content.replace(/from '\.\/src\/(.+?)'/g, "from '@/src/$1'");
    changed = true;
  }
  
  // Custom replacements
  if (filePath === 'src/server/emailService.ts') {
    content = content.replace(/from '\.\.\/emails\/AuctionEmailTemplate\.js'/g, "from '@/src/emails/AuctionEmailTemplate'");
    changed = true;
  }
  
  if (filePath === 'src/server/cronProcessor.ts') {
    content = content.replace(/from '\.\.\/lib\/firebase\.js'/g, "from '@/src/lib/firebase'");
    content = content.replace(/from '\.\/emailService\.js'/g, "from '@/src/server/emailService'");
    changed = true;
  }
  
  if (filePath.startsWith('api/')) {
    content = content.replace(/from '\.\.\/server\.js'/g, "from '@/server'");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed imports in ${filePath}`);
  }
}

['server.ts', 'src/server/emailService.ts', 'src/server/cronProcessor.ts', 'api/index.ts', 'api/[...slug].ts', 'api/webhook.ts'].forEach(f => {
  if (fs.existsSync(f)) {
    replaceImports(f);
  }
});
