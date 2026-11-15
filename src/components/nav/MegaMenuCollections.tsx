import React from 'react';
import { Layers, Film, ArrowRight, Sparkles, Star } from 'lucide-react';

interface MegaMenuCollectionsProps {
  onNavigate: (view: string, extraParams?: any) => void;
  onClose: () => void;
}

interface FranchiseItem {
  id: number;
  name: string;
  count: string;
  image: string;
  desc: string;
}

const TOP_FRANCHISES: FranchiseItem[] = [
  {
    id: 86311,
    name: 'Marvel Universe (MCU)',
    count: '4+ Films',
    image: 'https://image.tmdb.org/t/p/w500/yFSIUVTCvgYrpalUktulvk3Gi5Y.jpg',
    desc: 'Avengers, Iron Man, Thor, Captain America & the Multiverse'
  },
  {
    id: 263,
    name: 'DC Universe & Batman',
    count: '3 Films',
    image: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    desc: 'The Dark Knight Trilogy, Batman Begins & Gotham rogues'
  },
  {
    id: 1241,
    name: 'Harry Potter Wizarding World',
    count: '8 Films',
    image: 'https://image.tmdb.org/t/p/w500/eVPs2Y0LyvTLZn6AP5Z6O2rtiGB.jpg',
    desc: 'The complete Hogwarts saga from Sorcerer’s Stone to Deathly Hallows'
  },
  {
    id: 10,
    name: 'Star Wars Saga',
    count: '9 Films',
    image: 'https://image.tmdb.org/t/p/w500/pWVLFh4OuejTpUaDQbB1C4zoS2p.jpg',
    desc: 'The Skywalker Saga across the galaxy far, far away'
  },
  {
    id: 9485,
    name: 'Fast & Furious Franchise',
    count: '10 Films',
    image: 'https://image.tmdb.org/t/p/w500/zOCnMPoUxgJK1RFPfN4PcnT16gr.jpg',
    desc: 'High-octane street racing and international heist action'
  },
  {
    id: 119,
    name: 'The Lord of the Rings',
    count: '3 Films',
    image: 'https://image.tmdb.org/t/p/w500/oENY593nKRVL2PnxXsMtlh8izb4.jpg',
    desc: 'Peter Jackson’s Academy Award-winning Middle-earth journey'
  }
];

export const MegaMenuCollections: React.FC<MegaMenuCollectionsProps> = ({
  onNavigate,
  onClose
}) => {
  const handleSelectCollection = (colId?: number) => {
    onClose();
    if (colId) {
      onNavigate('collections', { collectionId: colId });
    } else {
      onNavigate('collections');
    }
  };

  return (
    <div className="w-[620px] p-4 bg-[#1e1e24] rounded-2xl border border-[#3A3A40] text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F5C400]/20 flex items-center justify-center text-[#F5C400]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-wide uppercase text-white flex items-center gap-1.5">
              <span>Movie Sagas &amp; Franchises</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#F5C400] text-black text-[9px] font-black">
                CURATED
              </span>
            </h4>
            <p className="text-[10px] text-[#8E8E93]">
              Binge entire movie universes in chronological and release order
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSelectCollection()}
          className="text-[11px] font-bold text-[#F5C400] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Browse All</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Grid of Top Franchises with artwork */}
      <div className="grid grid-cols-2 gap-2">
        {TOP_FRANCHISES.map((franchise) => (
          <div
            key={franchise.id}
            onClick={() => handleSelectCollection(franchise.id)}
            className="flex items-center gap-3 p-2 rounded-xl bg-[#25252c] hover:bg-[#2f2f38] border border-white/5 hover:border-[#F5C400]/40 transition-all cursor-pointer group"
          >
            {/* Thumbnail */}
            <div className="w-12 h-16 rounded-lg bg-[#141418] shrink-0 overflow-hidden border border-white/10 relative shadow-sm">
              <img
                src={franchise.image}
                alt={franchise.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors truncate">
                  {franchise.name}
                </span>
              </div>
              <span className="inline-block mt-0.5 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/50 text-[#F5C400] border border-[#F5C400]/20">
                {franchise.count}
              </span>
              <p className="text-[10px] text-[#8E8E93] line-clamp-1 mt-1">
                {franchise.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer navigation */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-[11px] text-[#8E8E93]">
          <button
            type="button"
            onClick={() => handleSelectCollection()}
            className="hover:text-[#F5C400] font-semibold transition-colors cursor-pointer"
          >
            Popular Collections
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => handleSelectCollection()}
            className="hover:text-[#F5C400] font-semibold transition-colors cursor-pointer"
          >
            Movie Franchises
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSelectCollection()}
          className="px-3 py-1.5 rounded-lg bg-[#F5C400] hover:bg-[#e0b400] text-black font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <span>View All 80 Sagas</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
