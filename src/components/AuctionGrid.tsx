
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
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
