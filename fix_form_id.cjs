const fs = require('fs');
let code = fs.readFileSync('src/components/CreateAuctionForm.tsx', 'utf8');

code = code.replace(
  /title: \{ SLO: formData\.title \},/,
  `id: initialData?.id,
                title: { SLO: formData.title },`
);

fs.writeFileSync('src/components/CreateAuctionForm.tsx', code);
