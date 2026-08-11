const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

code = code.replace(
  /Dražbe, na katere ni bilo ponudb\. Po 30 dneh bodo samodejno\s*izbrisane\./,
  'Pregled zaključenih dražb, ki niso bile uspešno prodane. Z enim klikom jih lahko ponovno objavite.'
);

// We need to inject the buttons next to or below the currentBid / time text
// Let's find the structure of currentUserArchive items
