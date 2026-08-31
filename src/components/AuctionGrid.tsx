
import React from 'react';
import { AuctionItem } from '../../types';
import { AuctionCard } from './AuctionCard';
import { PackageCard } from './PackageCard';

interface AuctionGridProps {
  auctions: AuctionItem[];
  onAuctionClick: (item: AuctionItem) => void;
  onWatchToggle: (id: string) => void;
  watchlist: string[];
  t: (key: string) => string;
  language: string;
  isVerified: boolean;
  onSelectPackage?: (packageId: string) => void;
}

export const AuctionGrid: React.FC<AuctionGridProps> = ({
  auctions, onAuctionClick, onWatchToggle, watchlist, t, language, isVerified, onSelectPackage
}) => {
  // Group package auctions and standalone auctions
  const packageGroups: Record<string, { title: string; items: AuctionItem[] }> = {};
  const standaloneAuctions: AuctionItem[] = [];

  auctions.forEach(item => {
    if (item.is_package && item.package_id) {
      if (!packageGroups[item.package_id]) {
        // Find title from item or default
        const pkgTitle = (item as any).package_title || 
          (typeof item.title === 'object' ? item.title[language] || item.title['SLO'] : item.title) || 
          'Paket dražb';
        packageGroups[item.package_id] = {
          title: pkgTitle,
          items: []
        };
      }
      packageGroups[item.package_id].items.push(item);
    } else {
      standaloneAuctions.push(item);
    }
  });

  const packageIds = Object.keys(packageGroups);

  return (
    <div className="space-y-8">
      {/* If there are packages, display package cards */}
      {packageIds.length > 0 && (
        <div className="space-y-6">
          {packageIds.map(pkgId => {
            const group = packageGroups[pkgId];
            return (
              <PackageCard
                key={pkgId}
                packageId={pkgId}
                title={group.title}
                sellerName={group.items[0]?.sellerName}
                items={group.items}
                t={t}
                language={language}
                isVerified={isVerified}
                onSelectPackage={onSelectPackage || (() => {})}
                onAuctionClick={onAuctionClick}
              />
            );
          })}
        </div>
      )}

      {/* Standalone auctions grid */}
      <div className="grid gap-8 justify-center" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 320px))' }}>
        {standaloneAuctions.map(item => (
          <AuctionCard 
            key={item.id} 
            item={item} 
            t={t} 
            language={language} 
            isVerified={isVerified}
            isWatched={watchlist.includes(item.id)}
            onWatchToggle={() => onWatchToggle(item.id)}
            onClick={() => onAuctionClick(item)} 
          />
        ))}
      </div>
    </div>
  );
};

export default AuctionGrid;
