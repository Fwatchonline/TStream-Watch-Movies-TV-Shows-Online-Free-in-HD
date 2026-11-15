import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  ArrowUpRight,
  Film,
  Star,
  X,
  Sparkles,
  Search,
  Play,
  Info,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { CollectionSummary, MediaItem } from '../types/media';
import { getCollectionDetail, normalizeTMDBItem, TMDB_BASE_URL } from '../services/tmdb';
import {
  getDiscoveredCollections,
  saveDiscoveredCollection,
  DiscoveredCollection,
  VERIFIED_COLLECTION_IMAGES
} from '../services/collectionStore';

import {
  buildImageProxyUrl,
  isProxiedImagePath,
  resolveSafeImageSrc
} from '../utils/imageUrl';

interface CollectionsPageProps {
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia: (item: MediaItem) => void;
  initialCollectionId?: number | null;
}

const CollectionCoverImage: React.FC<{
  col: DiscoveredCollection;
}> = ({ col }) => {
  const verified = VERIFIED_COLLECTION_IMAGES[col.id];
  const rawPrimary = verified?.backdrop || col.backdropPath || verified?.poster || col.posterPath || col.parts?.[0]?.backdropPath || '';
  const rawSecondary = verified?.poster || col.posterPath || col.parts?.[0]?.backdropPath || col.parts?.[0]?.posterPath || '';
  const primary = resolveSafeImageSrc(rawPrimary);
  const secondary = resolveSafeImageSrc(rawSecondary);

  const [currentSrc, setCurrentSrc] = useState<string | null>(primary || null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setCurrentSrc(primary || secondary || null);
    setStep(0);
  }, [col.id, primary, secondary]);

  const handleError = () => {
    if (step === 0 && currentSrc && !isProxiedImagePath(currentSrc) && currentSrc.startsWith('http')) {
      setCurrentSrc(buildImageProxyUrl(currentSrc));
      setStep(1);
    } else if (step <= 1 && secondary && secondary !== currentSrc) {
      setCurrentSrc(secondary);
      setStep(2);
    } else if (step <= 2 && col.parts?.[0]?.backdropPath) {
      const partBg = resolveSafeImageSrc(col.parts[0].backdropPath);
      if (partBg && partBg !== currentSrc) {
        setCurrentSrc(partBg);
        setStep(3);
        return;
      }
      setStep(3);
      handleError();
    } else if (step <= 3 && col.parts?.[0]?.posterPath) {
      const partPoster = resolveSafeImageSrc(col.parts[0].posterPath);
      if (partPoster && partPoster !== currentSrc) {
        setCurrentSrc(partPoster);
        setStep(4);
        return;
      }
      setCurrentSrc(null);
    } else {
      setCurrentSrc(null);
    }
  };

  if (!currentSrc) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#1b1b22] via-[#24242e] to-[#121216] flex items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-[#F5C400]/10 border border-[#F5C400]/30 flex items-center justify-center text-[#F5C400] mb-2 shadow-inner">
            <Film className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-white tracking-wide line-clamp-1">{col.name}</span>
          <span className="text-[10px] text-[#A6A6AC] font-semibold mt-0.5">{col.parts?.length || 1} Chapters</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt=""
      onError={handleError}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      referrerPolicy="no-referrer"
    />
  );
};

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  onSelectMedia,
  onWatchMedia,
  initialCollectionId
}) => {
  const [collections, setCollections] = useState<DiscoveredCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<CollectionSummary | null>(null);
  const [loadingCol, setLoadingCol] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'action' | 'fantasy' | 'crime' | 'family' | 'horror'>('all');
  const [sortBy, setSortBy] = useState<'curated' | 'films' | 'title'>('curated');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const ACTION_COLLECTION_IDS = [10, 2344, 726871, 8650, 87096, 328, 8945, 531241, 86311, 448150, 645, 748, 284433, 131292, 131296, 528, 173710, 264, 391860, 558216, 573436, 14890, 131295, 529892, 535313, 531330, 523855, 135483, 422837, 2883, 86055, 90863, 324991];
  const FANTASY_COLLECTION_IDS = [119, 1241, 295, 84, 131635, 33514, 121938, 495527, 2980, 1733, 420, 85943];
  const CRIME_COLLECTION_IDS = [404609, 263, 87359, 9485, 230, 31562, 1575, 1570, 304, 553717, 86119, 102322, 722971, 523855, 135483, 2883];
  const FAMILY_COLLECTION_IDS = [2150, 10194, 8354, 86066, 77816, 87118, 14740, 89137, 720879, 468222, 137697, 1022790, 386382, 185103];
  const HORROR_COLLECTION_IDS = [656, 2602, 228446, 521226, 8091, 399, 313086, 17255];

  const loadCollections = () => {
    const list = getDiscoveredCollections();
    setCollections(list);
  };

  useEffect(() => {
    loadCollections();

    const handleUpdate = () => {
      loadCollections();
    };

    window.addEventListener('tstream:collection_discovered', handleUpdate);
    window.addEventListener('tstream:storage_update', handleUpdate);

    return () => {
      window.removeEventListener('tstream:collection_discovered', handleUpdate);
      window.removeEventListener('tstream:storage_update', handleUpdate);
    };
  }, []);

  const handleOpenCollection = async (col: CollectionSummary) => {
    setSelectedCollection(col);
    setLoadingCol(true);
    try {
      const liveData = await getCollectionDetail(col.id);
      if (liveData && liveData.parts && liveData.parts.length > 0) {
        setSelectedCollection(liveData);
      }
    } finally {
      setLoadingCol(false);
    }
  };

  const autoOpenedIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (initialCollectionId && collections.length > 0 && autoOpenedIdRef.current !== initialCollectionId) {
      const found = collections.find(c => c.id === initialCollectionId);
      if (found) {
        autoOpenedIdRef.current = initialCollectionId;
        handleOpenCollection(found);
      }
    }
  }, [initialCollectionId, collections]);

  // Allow user to search TMDB for new movie franchises on-the-fly
  const handleFranchiseSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterQuery.trim()) return;

    // Check if already in list
    const existing = collections.find(c =>
      c.name.toLowerCase().includes(filterQuery.toLowerCase())
    );
    if (existing) {
      handleOpenCollection(existing);
      return;
    }

    setIsSearchingOnline(true);
    try {
      const res = await fetch(
        `${TMDB_BASE_URL}/search/collection?query=${encodeURIComponent(filterQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        const firstMatch = data.results?.[0];
        if (firstMatch && firstMatch.id) {
          const colRes = await fetch(`${TMDB_BASE_URL}/collection/${firstMatch.id}`);
          if (colRes.ok) {
            const fullCol = await colRes.json();
            const parts = (fullCol.parts || []).map((p: any) => normalizeTMDBItem(p, 'movies'));
            const { collection } = saveDiscoveredCollection({
              id: fullCol.id,
              name: fullCol.name,
              overview: fullCol.overview || `Official collection for ${fullCol.name}.`,
              posterPath: fullCol.poster_path ? `https://image.tmdb.org/t/p/w500${fullCol.poster_path}` : null,
              backdropPath: fullCol.backdrop_path ? `https://image.tmdb.org/t/p/original${fullCol.backdrop_path}` : null,
              parts
            });
            loadCollections();
            setSelectedCollection(collection);
          }
        }
      }
    } catch (err) {
      console.warn('Franchise search failed:', err);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  let filteredCollections = collections.filter(col => {
    const matchesSearch =
      col.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (col.overview && col.overview.toLowerCase().includes(filterQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'action') return ACTION_COLLECTION_IDS.includes(col.id);
    if (activeTab === 'fantasy') return FANTASY_COLLECTION_IDS.includes(col.id);
    if (activeTab === 'crime') return CRIME_COLLECTION_IDS.includes(col.id);
    if (activeTab === 'family') return FAMILY_COLLECTION_IDS.includes(col.id);
    if (activeTab === 'horror') return HORROR_COLLECTION_IDS.includes(col.id);
    return true;
  });

  if (sortBy === 'title') {
    filteredCollections = [...filteredCollections].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'films') {
    filteredCollections = [...filteredCollections].sort((a, b) => (b.parts?.length || 0) - (a.parts?.length || 0));
  }

  return (
    <div className="max-w-[1520px] mx-auto px-3 sm:px-5 lg:px-6 py-6 pb-20">
      {/* Path Breadcrumbs */}
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#A6A6AC] mb-2 flex items-center gap-1.5">
        <span>T STREAM</span>
        <span>/</span>
        <span className="text-[#F5C400]">MOVIE COLLECTIONS</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-6 border-b border-[#3A3A40]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-[#F5C400]/20 text-[#F5C400] text-[10px] font-black uppercase tracking-wider border border-[#F5C400]/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#F5C400]" /> Automatic Franchise Generator
            </span>
            <span className="text-xs text-[#A6A6AC] hidden sm:inline">• Auto-discovers movie sagas on open</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Movie Collections & Sagas
          </h1>
          <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1 max-w-2xl">
            Explore complete movie franchises in release order. When you open any movie (such as Pirates of the Caribbean, Avatar, or Fast & Furious), the site automatically creates and adds that entire saga here.
          </p>
        </div>

        {/* Dynamic status pill */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#29292D] border border-[#3A3A40] text-white text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#F5C400] animate-pulse" />
            <span>{collections.length} Collections Ready</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Tabs Strip */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#29292D] border border-[#3A3A40] rounded-xl p-3 shadow-md">
        {/* Search Input */}
        <form onSubmit={handleFranchiseSearch} className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search collections (e.g. Pirates, Avatar, Fast & Furious)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-24 rounded-lg bg-[#232326] border border-[#3A3A40] text-xs text-white placeholder:text-[#A6A6AC] focus:outline-none focus:border-[#F5C400]"
          />
          <Search className="w-3.5 h-3.5 text-[#A6A6AC] absolute left-3 top-3" />
          <button
            type="submit"
            disabled={isSearchingOnline}
            className="absolute right-1 top-1 h-7 px-2.5 rounded bg-[#303035] hover:bg-[#3A3A40] text-[10px] font-bold text-[#F5C400] border border-[#3A3A40] transition-colors cursor-pointer"
          >
            {isSearchingOnline ? 'Searching...' : 'Find Franchise'}
          </button>
        </form>

        {/* Category Tabs & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#F5C400] text-black shadow-sm font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              All ({collections.length})
            </button>
            <button
              onClick={() => setActiveTab('action')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'action'
                  ? 'bg-[#F5C400] text-black shadow-sm font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              Action &amp; Sci-Fi
            </button>
            <button
              onClick={() => setActiveTab('fantasy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'fantasy'
                  ? 'bg-[#F5C400] text-black shadow-sm font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              Adventure &amp; Fantasy
            </button>
            <button
              onClick={() => setActiveTab('crime')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'crime'
                  ? 'bg-[#F5C400] text-black shadow-sm font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              Crime &amp; Thriller
            </button>
            <button
              onClick={() => setActiveTab('family')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'family'
                  ? 'bg-[#F5C400] text-black shadow-sm font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              Animation &amp; Family
            </button>
            <button
              onClick={() => setActiveTab('horror')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'horror'
                  ? 'bg-[#F5C400] text-black shadow-sm font-extrabold'
                  : 'bg-[#232326] text-[#A6A6AC] hover:text-white border border-[#3A3A40]'
              }`}
            >
              Horror &amp; Mystery
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 sm:pl-2 sm:border-l border-[#3A3A40]">
            <span className="text-[10px] uppercase font-bold text-[#A6A6AC]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#232326] text-xs font-bold text-white border border-[#3A3A40] rounded-lg px-2 py-1 focus:outline-none focus:border-[#F5C400] cursor-pointer"
            >
              <option value="curated">Featured</option>
              <option value="films">Most Films</option>
              <option value="title">A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Collection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCollections.map(col => (
          <div
            key={col.id}
            onClick={() => handleOpenCollection(col)}
            className="group relative rounded-2xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] transition-all duration-300 cursor-pointer shadow-xl flex flex-col justify-between"
          >
            {/* Backdrop Visual Area */}
            <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-[#1f1f24]">
              <CollectionCoverImage col={col} />

              {/* Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#29292D] via-[#29292D]/70 to-transparent" />

              {/* Badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <div className="px-2.5 py-1 rounded-md bg-[#F5C400] text-black text-[10px] font-black uppercase tracking-wider shadow-md shadow-amber-500/20">
                  {col.filmCountBadge || `${col.parts?.length || 1} FILMS`}
                </div>
                {col.autoDiscovered && (
                  <div className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[#F5C400] text-[9px] font-bold border border-[#F5C400]/40 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Auto-Discovered</span>
                  </div>
                )}
              </div>

              {/* Title positioned at bottom of visual banner */}
              <div className="absolute bottom-3 left-4 right-4">
                <h3 className="text-xl font-black text-white group-hover:text-[#F5C400] transition-colors tracking-tight line-clamp-1">
                  {col.name}
                </h3>
              </div>
            </div>

            {/* Description & Action */}
            <div className="p-4 pt-2 flex flex-col justify-between flex-1">
              <p className="text-xs text-[#A6A6AC] leading-relaxed line-clamp-2 mb-3">
                {col.overview}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-[#3A3A40] text-xs font-bold text-[#F3F3F3] group-hover:text-[#F5C400] transition-colors">
                <span className="flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-[#F5C400]" />
                  <span>Explore Saga ({col.parts?.length || 1} titles)</span>
                </span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-[#F5C400]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCollections.length === 0 && (
        <div className="rounded-2xl bg-[#29292D] border border-[#3A3A40] p-12 text-center text-[#A6A6AC]">
          <Layers className="w-12 h-12 text-[#A6A6AC] mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No collections match your filter</h3>
          <p className="text-xs text-[#A6A6AC] max-w-sm mx-auto mb-4">
            Try searching for another franchise (e.g. &quot;Pirates of the Caribbean&quot;, &quot;Avatar&quot;, &quot;Fast and Furious&quot;, &quot;Transformers&quot;, &quot;John Wick&quot;).
          </p>
          <button
            onClick={() => {
              setFilterQuery('');
              setActiveTab('all');
            }}
            className="px-4 py-2 rounded-lg bg-[#F5C400] text-black font-bold text-xs hover:bg-[#e0b400] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Collection Exploration Modal / Drawer */}
      {selectedCollection && (
        <div
          onClick={() => setSelectedCollection(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-[#232326] border border-[#3A3A40] rounded-2xl p-5 sm:p-8 shadow-2xl"
          >
            <button
              onClick={() => setSelectedCollection(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#29292D] border border-[#3A3A40] text-[#A6A6AC] hover:text-white hover:border-[#F5C400] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#F5C400] mb-1">
              <Layers className="w-4 h-4" />
              <span>Complete Franchise Chronicles</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
              {selectedCollection.name}
            </h2>
            <p className="text-xs sm:text-sm text-[#A6A6AC] max-w-3xl leading-relaxed mb-6">
              {selectedCollection.overview}
            </p>

            <div className="flex items-center justify-between gap-2 mb-4 border-b border-[#3A3A40] pb-2">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#F5C400] flex items-center gap-1.5">
                <span>Chronological Release Order</span>
                <span className="text-[#A6A6AC] font-normal">({selectedCollection.parts?.length || 0} films)</span>
              </h3>
            </div>

            {loadingCol && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 border-3 border-[#F5C400] border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs text-[#A6A6AC]">Fetching full saga chapters from TMDB...</span>
              </div>
            )}

            {!loadingCol && selectedCollection.parts && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {selectedCollection.parts.map((film, idx) => (
                  <div
                    key={film.id}
                    className="group rounded-xl overflow-hidden bg-[#29292D] border border-[#3A3A40] hover:border-[#F5C400] transition-all flex flex-col justify-between"
                  >
                    <div
                      onClick={() => {
                        onSelectMedia(film);
                        setSelectedCollection(null);
                      }}
                      className="relative aspect-[2/3] w-full bg-[#1c1c24] cursor-pointer overflow-hidden"
                    >
                      {film.posterPath || film.backdropPath ? (
                        <img
                          src={film.posterPath || film.backdropPath}
                          alt=""
                          onError={(e) => {
                            if (film.backdropPath && e.currentTarget.src !== film.backdropPath) {
                              e.currentTarget.src = film.backdropPath;
                            } else {
                              e.currentTarget.style.display = 'none';
                            }
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#A6A6AC] p-2 text-center">
                          {film.title}
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white">
                        Part {idx + 1}
                      </div>
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-[#F5C400] flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-[#F5C400]" />
                        <span>{film.voteAverage ? film.voteAverage.toFixed(1) : '7.0'}</span>
                      </div>
                    </div>

                    <div className="p-3">
                      <h4
                        onClick={() => {
                          onSelectMedia(film);
                          setSelectedCollection(null);
                        }}
                        className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors truncate cursor-pointer"
                      >
                        {film.title}
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-[#A6A6AC] mt-1 mb-2">
                        <span>{film.releaseDate ? new Date(film.releaseDate).getFullYear() : 'Classic'}</span>
                      </div>

                      {/* Quick Play & Details Actions */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            onWatchMedia(film);
                            setSelectedCollection(null);
                          }}
                          className="py-1 px-1 rounded bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-black" />
                          <span>Watch</span>
                        </button>
                        <button
                          onClick={() => {
                            onSelectMedia(film);
                            setSelectedCollection(null);
                          }}
                          className="py-1 px-1 rounded bg-[#3A3A40] hover:bg-[#4a4a52] text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Info className="w-2.5 h-2.5" />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
