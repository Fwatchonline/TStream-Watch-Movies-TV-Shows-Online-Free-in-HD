import React, { useMemo, useState } from 'react';
import { Play, Search, Calendar, Clock } from 'lucide-react';
import type { AnimeEpisode } from '../../types/media';

interface AnimeEpisodesGridProps {
  episodes: AnimeEpisode[];
  totalEpisodesCount?: number;
  fallbackCover?: string;
  currentEpisode?: number;
  onWatchEpisode: (episodeNumber: number) => void;
}

export const AnimeEpisodesGrid: React.FC<AnimeEpisodesGridProps> = ({
  episodes,
  totalEpisodesCount,
  fallbackCover,
  currentEpisode,
  onWatchEpisode
}) => {
  const [filterText, setFilterText] = useState('');
  const [rangePage, setRangePage] = useState(0);
  const PAGE_CHUNK = 50;

  const fullList = useMemo(() => {
    const byNum = new Map<number, AnimeEpisode>();
    for (const ep of episodes) {
      if (ep.episodeNumber > 0) byNum.set(ep.episodeNumber, ep);
    }
    const maxEp = Math.max(
      totalEpisodesCount || 0,
      episodes.reduce((m, e) => Math.max(m, e.episodeNumber), 0)
    );
    const result: AnimeEpisode[] = [];
    const cap = Math.min(maxEp, 2500);
    for (let n = 1; n <= cap; n++) {
      result.push(
        byNum.get(n) || {
          id: `ep-${n}`,
          episodeNumber: n,
          title: `Episode ${n}`
        }
      );
    }
    return result;
  }, [episodes, totalEpisodesCount]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return fullList;
    return fullList.filter(
      (ep) =>
        String(ep.episodeNumber).includes(q) ||
        ep.title.toLowerCase().includes(q) ||
        (ep.overview && ep.overview.toLowerCase().includes(q))
    );
  }, [fullList, filterText]);

  const totalChunks = Math.max(1, Math.ceil(filtered.length / PAGE_CHUNK));
  const safeChunk = Math.min(rangePage, totalChunks - 1);
  const visible = filtered.slice(safeChunk * PAGE_CHUNK, (safeChunk + 1) * PAGE_CHUNK);

  if (fullList.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-[#1b1b20] border border-[#34343c] text-xs text-[#A6A6AC]">
        No verified episodes have aired or been announced yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#A6A6AC] tabular-nums">
          <span className="font-bold text-white text-sm">Episodes ({fullList.length})</span>
          <span>·</span>
          <span>Click any episode to play</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalChunks > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {Array.from({ length: totalChunks }).map((_, idx) => {
                const start = idx * PAGE_CHUNK + 1;
                const end = Math.min(filtered.length, (idx + 1) * PAGE_CHUNK);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRangePage(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums cursor-pointer transition-colors ${
                      safeChunk === idx
                        ? 'bg-[#F5C400] text-black'
                        : 'bg-[#1b1b20] text-[#A6A6AC] hover:text-white border border-[#34343c]'
                    }`}
                  >
                    {start}-{end}
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8E8E93] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setRangePage(0);
              }}
              placeholder="Find episode # or title..."
              className="h-8 pl-8 pr-3 rounded-lg bg-[#141418] border border-[#34343c] text-xs text-white placeholder-[#6e6e78] focus:outline-none focus:border-[#F5C400] w-48"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((ep) => {
          const isActive = currentEpisode === ep.episodeNumber;
          const img = ep.thumbnail || fallbackCover;
          return (
            <button
              key={ep.id}
              type="button"
              onClick={() => onWatchEpisode(ep.episodeNumber)}
              className={`text-left flex items-stretch gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group ${
                isActive
                  ? 'bg-[#2a2718] border-[#F5C400] ring-1 ring-[#F5C400]/40'
                  : 'bg-[#1b1b20] hover:bg-[#23232a] border-[#34343c] hover:border-[#F5C400]/60'
              }`}
            >
              <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-[#141418] shrink-0">
                {img ? (
                  <img
                    src={img}
                    alt={ep.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-black/70 text-[#F5C400] flex items-center justify-center group-hover:bg-[#F5C400] group-hover:text-black transition-colors">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-black text-white tabular-nums">
                  E{ep.episodeNumber}
                </span>
              </div>

              <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#F5C400] tabular-nums">
                      Episode {ep.episodeNumber}
                    </span>
                    {ep.isFiller && (
                      <span className="text-[10px] font-bold uppercase text-amber-300">Filler</span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[#F5C400] line-clamp-2 mt-0.5 leading-snug">
                    {ep.title}
                  </h4>
                  {ep.overview && (
                    <p className="text-[11px] text-[#9A9AA2] line-clamp-2 mt-1">{ep.overview}</p>
                  )}
                </div>

                {(ep.airDate || ep.durationMinutes) && (
                  <div className="flex items-center gap-2 text-[10px] text-[#8E8E93] mt-1.5 tabular-nums">
                    {ep.airDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {ep.airDate}
                      </span>
                    )}
                    {ep.durationMinutes && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {ep.durationMinutes}m
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
