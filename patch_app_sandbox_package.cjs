const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const packageViewStart = `const packageAuctions = auctions.filter(a => a.package_id === selectedPackageId || (a as any).packageId === selectedPackageId);`;

const newPackageViewStart = `import { mockSandboxPackageId, mockSandboxPackageItems } from "./src/data/mockSandboxData";

      // Allow Sandbox preview package to render properly by intercepting the ID
      const isSandboxPackage = selectedPackageId === mockSandboxPackageId;
      const packageAuctions = isSandboxPackage 
          ? mockSandboxPackageItems 
          : auctions.filter(a => a.package_id === selectedPackageId || (a as any).packageId === selectedPackageId);
`;

code = code.replace("const packageAuctions = auctions.filter(a => a.package_id === selectedPackageId || (a as any).packageId === selectedPackageId);", newPackageViewStart);
// Replace both occurrences if any (sometimes it's there twice due to duplicate code)
code = code.replace("const packageAuctions = auctions.filter(a => a.package_id === selectedPackageId || (a as any).packageId === selectedPackageId);", newPackageViewStart);

fs.writeFileSync('App.tsx', code);
console.log('patched App.tsx for sandbox package');
