const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(/    \} catch \(err: any\) \{\s*\n\s*const errorMessage = err\?\.message \|\| String\(err\);\s*\n\s*\/\/ Remove \[EN\] and \[DE\] prefix hardcoding/g, `    } catch (err: any) {
       console.error("Fetch exception", err);
    }
  }, [activeView, selectedItem, selectedSeller, language]);

  const handlePublish = async (itemData: any) => {
    try {
      // Remove [EN] and [DE] prefix hardcoding`);

fs.writeFileSync('App.tsx', code);
