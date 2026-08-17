import React, { useState, useMemo } from 'react';
import { RefreshCcw, MapPin } from 'lucide-react';
import { Region } from '../../types.ts';
import { SLOVENIA_REGIONS_PATHS } from '../lib/sloveniaMapData';

// Mapping from statistical/GeoJSON names to traditional Region enum & aliases
export const REGION_ALIAS_MAP: Record<string, { enumVal: Region; display: string; shortDisplay?: string }> = {
  "pomurska": { enumVal: Region.Prekmurje, display: "POMURSKA", shortDisplay: "POMURSKA" },
  "prekmurje": { enumVal: Region.Prekmurje, display: "PREKMURJE", shortDisplay: "PREKMURJE" },
  "podravska": { enumVal: Region.Stajerska, display: "PODRAVSKA", shortDisplay: "PODRAVSKA" },
  "savinjska": { enumVal: Region.Stajerska, display: "SAVINJSKA", shortDisplay: "SAVINJSKA" },
  "zasavska": { enumVal: Region.Stajerska, display: "ZASAVSKA", shortDisplay: "ZASAVSKA" },
  "stajerska": { enumVal: Region.Stajerska, display: "ŠTAJERSKA", shortDisplay: "ŠTAJERSKA" },
  "štajerska": { enumVal: Region.Stajerska, display: "ŠTAJERSKA", shortDisplay: "ŠTAJERSKA" },
  "koroska": { enumVal: Region.Koroska, display: "KOROŠKA", shortDisplay: "KOROŠKA" },
  "koroška": { enumVal: Region.Koroska, display: "KOROŠKA", shortDisplay: "KOROŠKA" },
  "gorenjska": { enumVal: Region.Gorenjska, display: "GORENJSKA", shortDisplay: "GORENJSKA" },
  "osrednjeslovenska": { enumVal: Region.Osrednjeslovenska, display: "OSREDNJESLOVENSKA", shortDisplay: "OSREDNJA" },
  "jugovzhodna slovenija": { enumVal: Region.Dolenjska, display: "JUGOVZHODNA SLOVENIJA", shortDisplay: "JV SLOVENIJA" },
  "posavska": { enumVal: Region.Dolenjska, display: "POSAVSKA", shortDisplay: "POSAVSKA" },
  "dolenjska": { enumVal: Region.Dolenjska, display: "DOLENJSKA", shortDisplay: "DOLENJSKA" },
  "primorsko-notranjska": { enumVal: Region.Notranjska, display: "PRIMORSKO-NOTRANJSKA", shortDisplay: "NOTRANJSKA" },
  "notranjska": { enumVal: Region.Notranjska, display: "NOTRANJSKA", shortDisplay: "NOTRANJSKA" },
  "goriška": { enumVal: Region.Primorska, display: "GORIŠKA", shortDisplay: "GORIŠKA" },
  "goriska": { enumVal: Region.Primorska, display: "GORIŠKA", shortDisplay: "GORIŠKA" },
  "obalno-kraška": { enumVal: Region.Primorska, display: "OBALNO-KRAŠKA", shortDisplay: "OBALA" },
  "obalno-kraska": { enumVal: Region.Primorska, display: "OBALNO-KRAŠKA", shortDisplay: "OBALA" },
  "primorska": { enumVal: Region.Primorska, display: "PRIMORSKA", shortDisplay: "PRIMORSKA" }
};

export interface SloveniaMapProps {
  regionsData?: Record<string, number>;
  onSelectRegion: (regionId: string) => void;
  selectedRegion?: string | null;
  t?: (key: string) => string;
  showTitle?: boolean;
  compact?: boolean;
}

export const SloveniaMap: React.FC<SloveniaMapProps> = ({
  regionsData = {},
  onSelectRegion,
  selectedRegion,
  t,
  showTitle = true,
  compact = false
}) => {
  const [hoveredRegion, setHoveredRegion] = useState<{ name: string; count: number } | null>(null);

  // Helper to calculate auction count for a specific region
  const getCountForRegion = (regionName: string): number => {
    const rawKey = regionName.toLowerCase();
    
    // Direct match
    if (typeof regionsData[rawKey] === 'number') {
      return regionsData[rawKey];
    }
    if (typeof regionsData[regionName] === 'number') {
      return regionsData[regionName];
    }

    // Match via alias / traditional region enum
    const aliasInfo = REGION_ALIAS_MAP[rawKey];
    if (aliasInfo) {
      if (typeof regionsData[aliasInfo.enumVal] === 'number') {
        return regionsData[aliasInfo.enumVal];
      }
      const enumLower = aliasInfo.enumVal.toLowerCase();
      if (typeof regionsData[enumLower] === 'number') {
        return regionsData[enumLower];
      }
    }

    // Case insensitive lookup
    for (const [k, v] of Object.entries(regionsData)) {
      if (k.toLowerCase() === rawKey || (aliasInfo && k.toLowerCase() === aliasInfo.enumVal.toLowerCase())) {
        return v;
      }
    }

    return 0;
  };

  // Check if a region is currently selected
  const isRegionSelected = (regionName: string): boolean => {
    if (!selectedRegion) return false;
    const rawKey = regionName.toLowerCase();
    const selKey = selectedRegion.toLowerCase();
    if (rawKey === selKey) return true;

    const aliasInfo = REGION_ALIAS_MAP[rawKey];
    if (aliasInfo && aliasInfo.enumVal.toLowerCase() === selKey) return true;
    
    const selAlias = REGION_ALIAS_MAP[selKey];
    if (selAlias && selAlias.enumVal.toLowerCase() === rawKey) return true;
    if (aliasInfo && selAlias && aliasInfo.enumVal === selAlias.enumVal) return true;

    return false;
  };

  const handleClearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectRegion("");
  };

  // Memoized region items with calculated counts and selected status for optimal performance
  const renderedRegions = useMemo(() => {
    return SLOVENIA_REGIONS_PATHS.map((item) => {
      const regionName = item.name;
      const count = getCountForRegion(regionName);
      const isSelected = isRegionSelected(regionName);
      const alias = REGION_ALIAS_MAP[regionName.toLowerCase()];
      const displayName = alias?.shortDisplay || alias?.display || regionName.toUpperCase();
      const targetRegion = alias?.enumVal || regionName;

      return {
        ...item,
        count,
        isSelected,
        displayName,
        targetRegion
      };
    });
  }, [regionsData, selectedRegion]);

  return (
    <div className={`w-full bg-[#0A1128] rounded-[2rem] shadow-2xl relative select-none ${compact ? 'p-3' : 'p-4 sm:p-5'} border border-white/10`}>
      {/* Header section with Title & Clear Filter button */}
      {showTitle && (
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FEBA4F]/10 border border-[#FEBA4F]/30 flex items-center justify-center text-[#FEBA4F]">
              <MapPin size={14} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                {t ? t('regionMap') || 'Zemljevid regij' : 'Zemljevid regij'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold">
                Izberite regijo za filtriranje aktivnih dražb
              </p>
            </div>
          </div>

          {selectedRegion && (
            <button
              onClick={handleClearFilter}
              className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-[#FEBA4F]/10 text-[#FEBA4F] hover:bg-[#FEBA4F] hover:text-[#0A1128] px-3 py-1.5 rounded-xl transition-all border border-[#FEBA4F]/30 shadow-lg"
            >
              <RefreshCcw size={12} className="shrink-0" />
              <span>{t ? t('clearFilter') || 'Počisti filter' : 'Počisti filter'}</span>
            </button>
          )}
        </div>
      )}

      {/* Interactive SVG Map Canvas - Tight bounding box edge-to-edge */}
      <div className="w-full relative flex items-center justify-center overflow-hidden rounded-xl bg-[#070D1E]/70 border border-white/5 p-1">
        <svg
          viewBox="12 5 976 640"
          className="w-full h-auto max-h-[580px] object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)]"
        >
          <defs>
            <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FEBA4F" floodOpacity="0.8" />
            </filter>
            <filter id="hover-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#FEBA4F" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* Region Vector Paths */}
          <g>
            {renderedRegions.map((reg) => {
              const isHovered = hoveredRegion?.name === reg.name;

              return (
                <path
                  key={reg.name}
                  d={reg.path}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => onSelectRegion(reg.targetRegion)}
                  onMouseEnter={() => setHoveredRegion({ name: reg.name, count: reg.count })}
                  onMouseLeave={() => setHoveredRegion(null)}
                  fill={reg.isSelected ? '#FEBA4F' : isHovered ? '#FEBA4F' : '#0F1B3B'}
                  stroke={reg.isSelected ? '#FFFFFF' : isHovered ? '#FFFFFF' : '#eab308'}
                  strokeWidth={reg.isSelected ? 2.5 : isHovered ? 2.5 : 1.5}
                  filter={reg.isSelected ? 'url(#map-glow)' : isHovered ? 'url(#hover-glow)' : undefined}
                />
              );
            })}
          </g>

          {/* Region Text Labels and Auction Counts */}
          <g className="pointer-events-none select-none">
            {renderedRegions.map((reg) => {
              const [cx, cy] = reg.centroid;
              const isHovered = hoveredRegion?.name === reg.name;
              const isHighlighted = reg.isSelected || isHovered;

              return (
                <g key={`label-${reg.name}`} transform={`translate(${cx}, ${cy})`}>
                  {/* Region Name */}
                  <text
                    y={-5}
                    textAnchor="middle"
                    className={`font-black uppercase tracking-wider text-[11px] transition-colors duration-200 ${
                      isHighlighted ? 'fill-[#0A1128]' : 'fill-white'
                    }`}
                    style={{
                      filter: isHighlighted ? 'none' : 'drop-shadow(0px 2px 3px rgba(0,0,0,0.95))',
                      textShadow: isHighlighted ? 'none' : '0 1px 3px #000000'
                    }}
                  >
                    {reg.displayName}
                  </text>

                  {/* Auction Count Badge */}
                  <text
                    y={11}
                    textAnchor="middle"
                    className={`font-black text-[13px] tracking-tight transition-colors duration-200 ${
                      isHighlighted
                        ? 'fill-[#0A1128]'
                        : reg.count > 0
                        ? 'fill-[#FEBA4F]'
                        : 'fill-slate-400'
                    }`}
                    style={{
                      filter: isHighlighted ? 'none' : 'drop-shadow(0px 2px 3px rgba(0,0,0,0.95))',
                      textShadow: isHighlighted ? 'none' : '0 1px 3px #000000'
                    }}
                  >
                    {reg.count}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover status bar indicator */}
        {hoveredRegion && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none bg-[#0A1128]/95 text-white border border-[#FEBA4F]/40 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-2xl backdrop-blur-md flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-150">
            <span className="text-[#FEBA4F] flex items-center gap-1">
              <MapPin size={12} />
              {hoveredRegion.name}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-500"></span>
            <span className="text-white font-bold">
              {hoveredRegion.count} {hoveredRegion.count === 1 ? 'dražba' : hoveredRegion.count === 2 ? 'dražbi' : hoveredRegion.count === 3 || hoveredRegion.count === 4 ? 'dražbe' : 'dražb'}
            </span>
          </div>
        )}
      </div>

      {/* Quick region pill selectors at bottom */}
      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center justify-center gap-1.5">
        {Object.values(Region).map((reg) => {
          const isSelected = selectedRegion === reg || (selectedRegion && selectedRegion.toLowerCase() === reg.toLowerCase());
          const count = typeof regionsData[reg] === 'number' ? regionsData[reg] : getCountForRegion(reg);
          return (
            <button
              key={reg}
              onClick={() => onSelectRegion(reg)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#FEBA4F] text-[#0A1128] shadow-md scale-105'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
              }`}
            >
              <span>{reg}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-[#0A1128]/20 text-[#0A1128]' : 'bg-white/10 text-[#FEBA4F]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
