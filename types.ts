
export enum SellerType {
  PRIVATE = 'private',
  BUSINESS = 'business'
}

export enum SubscriptionTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO'
}

export interface PaymentCard {
  id: string;
  last4: string;
  brand: 'visa' | 'mastercard' | 'amex';
  expiry: string;
  isDefault: boolean;
}

export interface WonItem extends AuctionItem {
  winDate: Date;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  invoiceUrl?: string; // Mock PDF link
  totalAmount: number;
}

export interface Seller {
  id: string;
  type: SellerType;
  name: Record<string, string>;
  companyName?: string; // Only for business
  taxId?: string; // Only for business
  location: Record<string, string>;
  memberSince: string;
  rating: number;
  reviewCount: number;
  totalSold: number;
  positiveFeedback: number;
  description: Record<string, string>;
  subscriptionPlan: SubscriptionTier;
  unpaidStrikes: number; // 0-3
  isBlocked: boolean;
  savedCards: PaymentCard[];
  stripe_account_id?: string;
  stripe_onboarding_complete?: boolean;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  isVerified: boolean;
  wouldRecommend: boolean;
}

export interface AuctionItem {
  id: string;
  title: Record<string, string>;
  category: string; 
  currentBid: number;
  bidCount: number;
  itemCount: number; 
  images: string[];
  endTime: Date;
  location: Record<string, string>;
  region: Region; 
  description: Record<string, string>;
  condition: Record<string, string>;
  specifications: Record<string, Record<string, string>>;
  biddingHistory: BidHistory[];
  sellerId: string;
  sellerName?: string;
  status: 'active' | 'completed' | 'cancelled';
  payment_status?: 'unpaid' | 'paid';
  paid_at?: string;
  winnerId?: string;
  hiddenMaxBid?: number; // For proxy bidding logic
}

export interface BidHistory {
  id: string;
  bidderId: string;
  bidderName: string;
  amount: number;
  timestamp: Date;
}

export enum Category {
  Oblacila = 'Oblačila',
  Racunalniki = 'Računalniki',
  ProstiCasInSport = 'Prosti čas in šport',
  DomInVrt = 'Dom in vrt',
  Avtomobilizem = 'Avtomobilizem',
  Nepremicnine = 'Nepremičnine',
  LepotaInZdravje = 'Lepota in zdravje',
  OtroškaOprema = 'Otroška oprema',
  Kmetijstvo = 'Kmetijstvo',
  Umetnine = 'Umetnine',
  Glasbila = 'Glasbila',
  Zbirateljstvo = 'Zbirateljstvo',
  Ostalo = 'Ostalo'
}

export enum Region {
  Prekmurje = 'Prekmurje',
  Stajerska = 'Štajerska',
  Koroska = 'Koroška',
  Gorenjska = 'Gorenjska',
  Primorska = 'Primorska',
  Notranjska = 'Notranjska',
  Dolenjska = 'Dolenjska',
  Osrednjeslovenska = 'Osrednjeslovenska'
}

export type ViewState = 'grid' | 'detail' | 'login' | 'onboarding' | 'terms' | 'sellerProfile' | 'createAuction' | 'settings' | 'verification' | 'winnings' | 'lastChance' | 'subscriptions' | 'watchlist' | 'myBids' | 'chat';
