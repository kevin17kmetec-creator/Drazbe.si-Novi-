import { AuctionItem, Region, Seller, Review, SellerType, SubscriptionTier } from './types.ts';

const now = new Date();

export const MOCK_SELLERS: Seller[] = [
  {
    id: 'sell1',
    type: SellerType.BUSINESS,
    name: { SLO: 'Industrija d.o.o.', EN: 'Industry Ltd.', DE: 'Industrie GmbH' },
    companyName: 'Industrija d.o.o.',
    taxId: 'SI12345678',
    location: { SLO: 'Maribor', EN: 'Maribor', DE: 'Maribor' },
    memberSince: 'Januar 2021',
    rating: 4.8,
    reviewCount: 156,
    totalSold: 1240,
    positiveFeedback: 98,
    description: {
      SLO: 'Specializirano podjetje za prodajo rabljenih industrijskih strojev in opreme z več kot 20-letno tradicijo.',
      EN: 'Specialized company for the sale of used industrial machinery and equipment with over 20 years of tradition.',
      DE: 'Spezialisiertes Unternehmen für den Verkauf von gebrauchten Industriemaschinen und -geräten mit über 20 Jahren Tradition.'
    },
    subscriptionPlan: SubscriptionTier.PRO,
    unpaidStrikes: 0,
    isBlocked: false,
    savedCards: []
  },
  {
    id: 'sell2',
    type: SellerType.PRIVATE,
    name: { SLO: 'Janez Novak (Zasebno)', EN: 'John Doe (Private)', DE: 'Max Mustermann (Privat)' },
    location: { SLO: 'Kranj', EN: 'Kranj', DE: 'Kranj' },
    memberSince: 'Marec 2022',
    rating: 4.5,
    reviewCount: 89,
    totalSold: 450,
    positiveFeedback: 95,
    description: {
      SLO: 'Prodaja osebnih vozil in gozdarske opreme iz lastne uporabe.',
      EN: 'Sale of personal vehicles and forestry equipment from own use.',
      DE: 'Verkauf von Privatfahrzeugen und Forstausrüstung aus eigenem Gebrauch.'
    },
    subscriptionPlan: SubscriptionTier.FREE,
    unpaidStrikes: 0,
    isBlocked: false,
    savedCards: []
  }
];

export const MOCK_REVIEWS: Record<string, Review[]> = {
  'sell1': [
    { id: 'r1', author: 'Janez N.', rating: 5, comment: 'Odličen strokovnjak, stroj je bil točno tak kot v opisu.', date: '12.02.2024', isVerified: true, wouldRecommend: true },
    { id: 'r2', author: 'Maja K.', rating: 4, comment: 'Zadovoljna s prevzemom, malo težav pri komunikaciji ampak vse rešeno.', date: '05.01.2024', isVerified: true, wouldRecommend: true }
  ]
};

export const MOCK_AUCTIONS: AuctionItem[] = [
  {
    id: 's1',
    title: {
      SLO: 'Industrijski kompleks Maribor - Oprema v razprodaji',
      EN: 'Maribor Industrial Complex - Equipment Sale',
      DE: 'Industriekomplex Maribor - Ausrüstung im Ausverkauf'
    },
    category: Region.Stajerska,
    currentBid: 42500,
    bidCount: 24,
    itemCount: 150,
    images: [
      'https://images.unsplash.com/photo-1579450392705-564562479f64?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1586191552066-d52dd1e3af86?auto=format&fit=crop&q=80&w=600'
    ],
    endTime: new Date(now.getTime() + 1000 * 60 * 60 * 3),
    location: { SLO: 'Maribor', EN: 'Maribor', DE: 'Maribor' },
    region: Region.Stajerska,
    description: {
      SLO: 'Celovita dražba opreme iz propadlega industrijskega obrata v Mariboru. Vključuje viličarje, regale in orodje.',
      EN: 'Comprehensive auction of equipment from a failed industrial plant in Maribor. Includes forklifts, racks, and tools.',
      DE: 'Umfassende Auktion von Ausrüstung aus einem stillgelegten Industriebetrieb in Maribor. Beinhaltet Gabelstapler, Regale und Werkzeuge.'
    },
    condition: { SLO: 'Rabljeno', EN: 'Used', DE: 'Gebraucht' },
    specifications: { 
      'Lokacija': { SLO: 'Industrijska cona', EN: 'Industrial Zone', DE: 'Industriezone' }, 
      'Ogled': { SLO: 'Po dogovoru', EN: 'By appointment', DE: 'Nach Vereinbarung' }
    },
    biddingHistory: [],
    sellerId: 'sell1', // Business seller -> Tax applied
    status: 'active'
  },
  {
    id: 's2',
    title: {
      SLO: 'Gozdarska oprema in stroji - Kranj',
      EN: 'Forestry Equipment and Machinery - Kranj',
      DE: 'Forstwirtschaftliche Ausrüstung und Maschinen - Kranj'
    },
    category: Region.Gorenjska,
    currentBid: 12400,
    bidCount: 15,
    itemCount: 45,
    images: [
      'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=600'
    ],
    endTime: new Date(now.getTime() + 1000 * 60 * 60 * 12),
    location: { SLO: 'Kranj', EN: 'Kranj', DE: 'Kranj' },
    region: Region.Gorenjska,
    description: {
      SLO: 'Dražba specializirane gozdarske opreme. Od motornih žag do težke mehanizacije za spravilo lesa.',
      EN: 'Auction of specialized forestry equipment. From chainsaws to heavy machinery for timber harvesting.',
      DE: 'Auktion von spezialisierter Forstausrüstung. Von Kettensägen bis hin zu schweren Maschinen für die Holzernte.'
    },
    condition: { SLO: 'Rabljeno', EN: 'Used', DE: 'Gebraucht' },
    specifications: { 
      'Regija': { SLO: 'Gorenjska', EN: 'Gorenjska', DE: 'Gorenjska' }, 
      'DDV': { SLO: 'Ni obračunan (fizična oseba)', EN: 'Not included (private)', DE: 'Nicht enthalten (privat)' }
    },
    biddingHistory: [],
    sellerId: 'sell2', // Private seller -> No Tax on item
    status: 'active'
  },
  {
    id: 'it1',
    title: {
      SLO: 'Pisarniška in IT oprema Ljubljana Center',
      EN: 'Office and IT Equipment Ljubljana Center',
      DE: 'Büro- und IT-Ausrüstung Ljubljana Zentrum'
    },
    category: Region.Osrednjeslovenska,
    currentBid: 2850,
    bidCount: 42,
    itemCount: 200,
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600'
    ],
    endTime: new Date(now.getTime() + 1000 * 60 * 45),
    location: { SLO: 'Ljubljana', EN: 'Ljubljana', DE: 'Ljubljana' },
    region: Region.Osrednjeslovenska,
    description: {
      SLO: 'Dražba sodobne pisarniške opreme iz prestižne lokacije v Ljubljani. Apple računalniki, ergonomski stoli in več.',
      EN: 'Auction of modern office equipment from a prestigious location in Ljubljana. Apple computers, ergonomic chairs, and more.',
      DE: 'Auktion von moderner Büroausstattung an einem prestigeträchtigen Standort in Ljubljana. Apple-Computer, ergonomische Stühle und mehr.'
    },
    condition: { SLO: 'Novo', EN: 'New', DE: 'Neu' },
    specifications: { 
      'Zaloga': { SLO: 'Velika', EN: 'Large stock', DE: 'Großer Vorrat' }, 
      'Garancija': { SLO: 'Delna', EN: 'Partial', DE: 'Teilweise' }
    },
    biddingHistory: [],
    sellerId: 'sell1', // Business
    status: 'active'
  }
];