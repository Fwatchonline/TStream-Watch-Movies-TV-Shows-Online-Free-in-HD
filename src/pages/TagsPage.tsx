import React, { useState, useEffect } from 'react';
import {
  Hash,
  Search,
  ArrowRight,
  Film,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { POPULAR_TAGS, EXPANDED_CATALOG } from '../services/catalogData';
import { MediaItem, PaginatedResponse } from '../types/media';
import { MediaCard } from '../components/MediaCard';
import { Pagination } from '../components/Pagination';
import { fetchByTag } from '../services/tmdb';
import { updateSEO } from '../utils/seo';
import { tagToSlug, slugToTag, isValidTagSlug } from '../utils/tags';

interface TagsPageProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem) => void;
  initialTag?: string;
}

export const TagsPage: React.FC<TagsPageProps> = ({
  onSelectMedia,
  onWatchMedia,
  initialTag
}) => {
  const [searchTag, setSearchTag] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(initialTag ? tagToSlug(initialTag) : null);
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const p = parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10);
    return !isNaN(p) && p >= 1 ? p : 1;
  });
  const [tagData, setTagData] = useState<PaginatedResponse<MediaItem>>({
    page: 1,
    totalPages: 1,
    totalResults: 0,
    results: []
  });
  const [loading, setLoading] = useState(false);

  const activeSlug = activeTag ? tagToSlug(activeTag) : '';
  const displayTag = activeSlug ? slugToTag(activeSlug) : '';

  // Sync prop changes
  useEffect(() => {
    if (initialTag !== undefined) {
      setActiveTag(initialTag ? tagToSlug(initialTag) : null);
    }
  }, [initialTag]);

  // Fetch real matching items from TMDB whenever activeSlug or currentPage changes
  useEffect(() => {
    let isMounted = true;
    if (!activeSlug || !displayTag) {
      setTagData({ page: 1, totalPages: 1, totalResults: 0, results: [] });
      updateSEO({
        title: 'Explore Movies & TV Series by Tag & Theme',
        description: 'Browse movies and TV series by genre tropes, story moods, themes, and aesthetic tags on T Stream.',
        url: '/tags',
        noindex: false
      });
      return;
    }

    // Ensure browser URL is clean canonical kebab-case /tags/:slug (preserving ?page=N when > 1)
    const expectedUrl = currentPage > 1 ? `/tags/${activeSlug}?page=${currentPage}` : `/tags/${activeSlug}`;
    const currentFull = `${window.location.pathname}${window.location.search}`;
    if (currentFull !== expectedUrl) {
      window.history.replaceState({}, '', expectedUrl);
    }

    async function loadTagResults() {
      setLoading(true);
      try {
        const res = await fetchByTag(displayTag, currentPage);
        if (isMounted) {
          setTagData(res);
          setLoading(false);

          const pageSuffix = currentPage > 1 ? ` — Page ${currentPage}` : '';
          // Update SEO based on whether tag has meaningful content
          if (res.results.length === 0) {
            updateSEO({
              title: `Movies Tagged #${displayTag}`,
              description: `No movies currently found tagged with #${displayTag} on T Stream.`,
              url: `/tags/${activeSlug}`,
              noindex: true // Prevent thin/empty tag indexing in Google
            });
          } else {
            updateSEO({
              title: `Movies & TV Shows Tagged #${displayTag} — Watch Online Free${pageSuffix}`,
              description: `Discover top rated and popular movies and TV series tagged with #${displayTag}. Stream free in 4K and 1080p HD with subtitles on T Stream.`,
              url: expectedUrl,
              noindex: false
            });
          }
        }
      } catch {
        if (isMounted) {
          setLoading(false);
          updateSEO({
            title: `Movies Tagged #${displayTag}`,
            description: `Browse titles tagged #${displayTag} on T Stream.`,
            url: `/tags/${activeSlug}`,
            noindex: true
          });
        }
      }
    }

    loadTagResults();
    return () => { isMounted = false; };
  }, [activeSlug, displayTag, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTag.trim() && isValidTagSlug(searchTag.trim())) {
      const slug = tagToSlug(searchTag.trim());
      if (!slug) return;
      setActiveTag(slug);
      setCurrentPage(1);
      window.history.pushState({}, '', `/tags/${slug}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTagClick = (tag: string) => {
    const slug = tagToSlug(tag);
    if (!slug) return;
    setActiveTag(slug);
    setCurrentPage(1);
    window.history.pushState({}, '', `/tags/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      {/* Path Breadcrumbs */}
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        DISCOVER / KEYWORDS
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {displayTag ? `Movies & Shows Tagged #${displayTag}` : 'Explore Tags'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
          {displayTag
            ? `Browse movies and television series matching the #${displayTag} theme on T Stream.`
            : 'Browse movie keywords, story themes and motifs. Each tag has its own page with matching films.'}
        </p>
      </div>

      {/* Search Tags Input Box with Red Button matching Slika 3 */}
      <form onSubmit={handleSearchSubmit} className="max-w-2xl flex gap-2 mb-10">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tags — witch, magic, time travel..."
            value={searchTag}
            onChange={(e) => setSearchTag(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#141418] border border-white/10 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="h-11 px-6 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-amber-500/20 shrink-0 cursor-pointer"
        >
          Search tags
        </button>
      </form>

      {/* Active Tag Results View if a tag is selected */}
      {displayTag ? (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white">#{displayTag}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#303035] text-[#F5C400] border border-[#F5C400]/40 font-bold">
                  {tagData.totalResults} matching movies
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Showing live TMDB catalog entries tagged with #{displayTag}
              </p>
            </div>

            <button
              onClick={() => {
                setActiveTag(null);
                setCurrentPage(1);
                window.history.pushState({}, '', '/tags');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-xs text-[#F5C400] hover:text-amber-300 font-semibold cursor-pointer"
            >
              ← Back to all tags
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-3 border-[#F5C400] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-[#A6A6AC]">Fetching movies tagged #{displayTag} from TMDB...</p>
            </div>
          ) : tagData.results.length === 0 ? (
            <div className="p-8 text-center bg-[#141418] rounded-xl border border-white/5 text-slate-400 text-xs">
              No titles currently indexed with #{displayTag}. Try picking another tag below.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tagData.results.map(item => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    onSelect={onSelectMedia}
                    onWatch={onWatchMedia}
                  />
                ))}
              </div>

              {tagData.totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={tagData.totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </div>
      ) : null}

      {/* Section: Popular tags matching Slika 3 */}
      <div className="mb-8">
        <h2 className="text-lg sm:text-xl font-bold text-white mb-0.5">
          Popular tags
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Start exploring by a story theme.
        </p>

        {/* 4-Column Grid of Tag Cards matching Slika 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
          {POPULAR_TAGS.map(tag => (
            <div
              key={tag.id}
              onClick={() => handleTagClick(tag.name)}
              className="p-4 rounded-xl bg-[#141418] border border-white/10 hover:border-white/25 hover:bg-[#181820] transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                #{tag.name}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-slate-300 mt-2 transition-colors">
                <span>{tag.countText}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tag Pills Cloud matching Slika 3 */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
          {POPULAR_TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                activeSlug === tagToSlug(tag.name)
                  ? 'bg-[#F5C400] text-black border-[#F5C400] shadow-md font-bold'
                  : 'bg-[#29292D] text-[#A6A6AC] hover:text-white border-[#3A3A40]'
              }`}
            >
              #{tag.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
