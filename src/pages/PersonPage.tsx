import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  User,
  Film,
  Tv,
  Star,
  Calendar,
  MapPin,
  Play,
  Award,
  Sparkles,
  Clapperboard
} from 'lucide-react';
import { PersonDetail, fetchPersonDetail } from '../services/tmdb';
import { MediaItem } from '../types/media';

interface PersonPageProps {
  personId: number;
  onBack: () => void;
  onSelectMedia: (item: MediaItem) => void;
  onWatchMedia?: (item: MediaItem) => void;
}

export const PersonPage: React.FC<PersonPageProps> = ({
  personId,
  onBack,
  onSelectMedia,
  onWatchMedia
}) => {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'movies' | 'tv'>('all');
  const [showFullBio, setShowFullBio] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'instant' as any });

    fetchPersonDetail(personId).then((data) => {
      if (isMounted) {
        setPerson(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [personId]);

  if (loading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-8 text-center bg-[#121215]">
        <div className="w-12 h-12 border-3 border-[#3A3A40] border-t-[#F5C400] rounded-full animate-spin mb-4" />
        <h2 className="text-base font-extrabold text-white tracking-wide uppercase">
          Loading Filmography
        </h2>
        <p className="text-xs text-[#A6A6AC] mt-1">
          Fetching movies, series, and career credits...
        </p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center bg-[#121215]">
        <User className="w-16 h-16 text-slate-600 mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Artist Not Found</h2>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-[#F5C400] text-black font-extrabold text-xs cursor-pointer"
        >
          Return to Previous Page
        </button>
      </div>
    );
  }

  // Combine credits from combinedCredits
  const castItems = person.combinedCredits?.cast || [];
  const crewItems = person.combinedCredits?.crew || [];

  // Group into filmography items with unique IDs
  const allCreditsMap = new Map<string, MediaItem>();

  const addCredit = (item: MediaItem) => {
    const key = `${item.mediaType}_${item.id}`;
    if (!allCreditsMap.has(key)) {
      allCreditsMap.set(key, item);
    }
  };

  [...castItems, ...crewItems].forEach(addCredit);
  const allCredits = Array.from(allCreditsMap.values());

  const filteredCredits = allCredits.filter((item) => {
    if (activeFilter === 'movies') return item.mediaType === 'movie';
    if (activeFilter === 'tv') return item.mediaType === 'tv';
    return true;
  });

  const isDirector = person.knownForDepartment?.toLowerCase().includes('direct');

  return (
    <div className="min-h-screen bg-[#121215] text-[#F3F3F3] pb-24 font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#A6A6AC] hover:text-[#F5C400] transition-colors cursor-pointer group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back</span>
        </button>
      </div>

      {/* Main Profile Info Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#18181c] border border-[#2d2d34] rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            {/* Person Headshot Portrait */}
            <div className="w-36 sm:w-44 aspect-[3/4] rounded-2xl overflow-hidden bg-[#232328] border-2 border-[#F5C400]/40 shadow-2xl shrink-0">
              {person.profilePath ? (
                <img
                  src={person.profilePath}
                  alt={person.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-[#16161c] to-[#252532] text-slate-500">
                  <User className="w-16 h-16" />
                </div>
              )}
            </div>

            {/* Person Bio and Details */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#F5C400]/15 border border-[#F5C400]/40 text-[#F5C400] text-[11px] font-black uppercase tracking-wider">
                  {isDirector ? 'Director & Filmmaker' : (person.knownForDepartment || 'Actor')}
                </span>
                <span className="text-xs text-[#8E8E93] font-medium">
                  {allCredits.length} Titles in Filmography
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                {person.name}
              </h1>

              {/* Metadata Badges */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-[#A6A6AC]">
                {person.birthday && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#F5C400]" />
                    <span>Born: {person.birthday}</span>
                  </div>
                )}
                {person.placeOfBirth && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#F5C400]" />
                    <span>{person.placeOfBirth}</span>
                  </div>
                )}
                {person.popularity && (
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#F5C400]" />
                    <span>Popularity Rank: {Math.round(person.popularity)}</span>
                  </div>
                )}
              </div>

              {/* Biography */}
              {person.biography && (
                <div className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                  <p className={!showFullBio && person.biography.length > 320 ? 'line-clamp-4' : ''}>
                    {person.biography}
                  </p>
                  {person.biography.length > 320 && (
                    <button
                      onClick={() => setShowFullBio(!showFullBio)}
                      className="mt-1 text-xs font-bold text-[#F5C400] hover:underline cursor-pointer"
                    >
                      {showFullBio ? 'Read Less' : 'Read Full Biography'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filmography Section */}
        <div className="mt-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Clapperboard className="w-6 h-6 text-[#F5C400]" />
                <span>Filmography &amp; Credits</span>
              </h2>
              <p className="text-xs text-[#8E8E93] mt-0.5">
                All movies and TV series featuring {person.name}
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#1b1b20] border border-[#303036]">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-[#F5C400] text-black font-black shadow-md'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                All ({allCredits.length})
              </button>
              <button
                onClick={() => setActiveFilter('movies')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === 'movies'
                    ? 'bg-[#F5C400] text-black font-black shadow-md'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                Movies ({allCredits.filter(c => c.mediaType === 'movie').length})
              </button>
              <button
                onClick={() => setActiveFilter('tv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === 'tv'
                    ? 'bg-[#F5C400] text-black font-black shadow-md'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                TV Series ({allCredits.filter(c => c.mediaType === 'tv').length})
              </button>
            </div>
          </div>

          {/* Filmography Cards Grid */}
          {filteredCredits.length === 0 ? (
            <div className="py-16 text-center bg-[#18181c] rounded-2xl border border-white/5">
              <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-semibold">No titles found in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredCredits.map((item) => {
                const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '';
                return (
                  <div
                    key={`${item.mediaType}_${item.id}`}
                    onClick={() => onSelectMedia(item)}
                    className="group flex flex-col bg-[#16161a] border border-[#26262c] hover:border-[#F5C400]/60 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer shadow-md hover:-translate-y-1"
                  >
                    {/* Poster */}
                    <div className="aspect-[2/3] w-full bg-[#1b1b22] relative overflow-hidden">
                      {item.posterPath ? (
                        <img
                          src={item.posterPath}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Film className="w-10 h-10" />
                        </div>
                      )}

                      {/* Hover Watch Button */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#F5C400] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                          <Play className="w-4 h-4 fill-black ml-0.5" />
                        </div>
                      </div>

                      {/* Type Badge */}
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-black uppercase text-white border border-white/10">
                        {item.mediaType === 'tv' ? 'TV' : 'Movie'}
                      </span>

                      {/* Rating */}
                      {item.voteAverage > 0 && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[#F5C400] text-black text-[10px] font-black flex items-center gap-0.5 shadow-md">
                          <Star className="w-2.5 h-2.5 fill-black" />
                          {item.voteAverage.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-[#8E8E93] mt-0.5">
                          {year || 'HD'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
