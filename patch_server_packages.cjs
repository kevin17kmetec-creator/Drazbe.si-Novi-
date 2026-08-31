const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const packageEndpoint = `
// --- Packages Endpoint ---
app.post('/api/packages/create', async (req, res) => {
  try {
    const { title, items, user_id } = req.body;
    if (!title || !items || !Array.isArray(items) || items.length < 2 || !user_id) {
      return res.status(400).json({ error: 'Invalid package data' });
    }

    const packageId = 'pkg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const auctionIds = [];

    // Create the package doc first
    const packageRef = db.collection('packages').doc(packageId);
    
    // Create each auction item
    const batch = db.batch();
    
    for (const item of items) {
      const auctionRef = db.collection('auctions').doc();
      const auctionId = auctionRef.id;
      auctionIds.push(auctionId);
      
      const auctionData = {
        ...item,
        id: auctionId,
        seller_id: user_id,
        is_package: true,
        package_id: packageId,
        created_at: new Date().toISOString(),
        status: 'active'
      };
      
      batch.set(auctionRef, auctionData);
    }
    
    // Set package doc
    batch.set(packageRef, {
      id: packageId,
      title,
      seller_id: user_id,
      auction_ids: auctionIds,
      status: 'active',
      created_at: new Date().toISOString()
    });
    
    await batch.commit();
    
    res.json({ success: true, package_id: packageId });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});
`;

if (!code.includes('/api/packages/create')) {
  code = code.replace(
    "app.post('/api/auctions/create', async (req, res) => {",
    packageEndpoint + "\napp.post('/api/auctions/create', async (req, res) => {"
  );
  fs.writeFileSync('server.ts', code);
  console.log('Server patched with packages create');
}
