
export interface AuctionPackage {
  id: string;
  title: string;
  seller_id: string;
  status: 'active' | 'ended' | 'paid';
  created_at: number;
  end_time: number;
  auction_ids: string[];
}
