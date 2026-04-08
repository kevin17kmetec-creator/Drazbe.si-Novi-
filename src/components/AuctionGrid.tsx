
import React from 'react';
import { AuctionItem } from '../../types';
import { AuctionCard } from './AuctionCard';

interface AuctionGridProps {
  auctions: AuctionItem[];
  onAuctionClick: (item: AuctionItem) => void;
  onWatchToggle: (id: string) => void;
  watchlist: string[];
  t: (key: string) => string;
  language: string;
}

export const AuctionGrid: React.FC<AuctionGridProps> = ({
  auctions, onAuctionClick, onWatchToggle, watchlist, t, language
}) => {
  return (
    <div className="grid gap-8 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 320px))' }}>
      {auctions.map(item => (
        <AuctionCard 
          key={item.id} 
          item={item} 
          t={t} 
          language={language} 
          isWatched={watchlist.includes(item.id)}
          onWatchToggle={(e) => {
            e.stopPropagation();
            onWatchToggle(item.id);
          }}
          onClick={() => onAuctionClick(item)} 
        />
      ))}
    </div>
  );
};

export default AuctionGrid;
