import { MOCK_AUCTIONS } from '../../data.ts';
import { AuctionItem, Region } from '../../types.ts';

export const EXTENDED_MOCK_AUCTIONS: AuctionItem[] = MOCK_AUCTIONS.map(a => ({
  ...a,
  images: [
    a.images[0],
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80&w=800'
  ]
}));

export const generateMockData = () => {
    const regions = Object.values(Region);
    for (let i = 0; i < 120; i++) {
        const baseItem = MOCK_AUCTIONS[i % MOCK_AUCTIONS.length];
        const randomTimeOffset = Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 3); 
        const randomPrice = Math.floor(Math.random() * 5000) + 100;
        EXTENDED_MOCK_AUCTIONS.push({
            ...baseItem,
            id: `mock-gen-${i}`,
            title: {
                SLO: `${baseItem.title.SLO} (Kopija ${i+1})`,
                EN: `${baseItem.title.EN} (Copy ${i+1})`,
                DE: `${baseItem.title.DE} (Kopie ${i+1})`
            },
            currentBid: randomPrice,
            endTime: new Date(Date.now() + randomTimeOffset),
            region: regions[Math.floor(Math.random() * regions.length)],
            bidCount: Math.floor(Math.random() * 50),
            images: [
                `https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=80&w=800`,
                `https://images.unsplash.com/photo-${1510000000000 + i}?auto=format&fit=crop&q=80&w=800`,
                `https://images.unsplash.com/photo-${1520000000000 + i}?auto=format&fit=crop&q=80&w=800`
            ]
        });
    }
};

generateMockData();
