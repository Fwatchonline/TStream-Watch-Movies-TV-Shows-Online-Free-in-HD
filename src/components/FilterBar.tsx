import React from 'react';
import { Filter, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { ALL_GENRES } from '../services/catalogData';
import { FilterOptions, MediaType } from '../types/media';

interface FilterBarProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  totalResults: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  totalResults
}) => {
  const handleTypeChange = (mediaType: MediaType | 'all') => {
    onFilterChange({ ...filters, mediaType, page: 1 });
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const genreId = e.target.value ? Number(e.target.value) : undefined;
    onFilterChange({ ...filters, genreId, page: 1 });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sortBy = e.target.value as FilterOptions['sortBy'];
    onFilterChange({ ...filters, sortBy, page: 1 });
  };

  const handleRatingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const minRating = e.target.value ? Number(e.target.value) : undefined;
    onFilterChange({ ...filters, minRating, page: 1 });
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = e.target.value ? Number(e.target.value) : undefined;
    onFilterChange({ ...filters, year, page: 1 });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const language = e.target.value || undefined;
    onFilterChange({ ...filters, language, page: 1 });
  };

  const handleReset = () => {
    onFilterChange({
      mediaType: 'all',
      genreId: undefined,
      sortBy: 'popularity.desc',
      minRating: undefined,
      year: undefined,
      language: undefined,
      query: '',
      platform: filters.platform,
      letter: filters.letter,
      page: 1
    });
  };

  const hasActiveFilters = Boolean(
    (filters.mediaType && filters.mediaType !== 'all') ||
    filters.genreId ||
    filters.minRating ||
    filters.year ||
    filters.language ||
    (filters.query && filters.query.trim())
  );

  const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2015, 2010, 2008, 2004, 2001];

  return (
    <div className="bg-[#29292D] border border-[#3A3A40] rounded-xl p-4 mb-6 shadow-lg shadow-black/40">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Media Type Segmented Control (Interactive buttons per frontend-design skill) */}
        <div className="flex items-center gap-1 p-1 bg-[#232326] rounded-lg border border-[#3A3A40] w-fit">
          <button
            onClick={() => handleTypeChange('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              !filters.mediaType || filters.mediaType === 'all'
                ? 'bg-[#F5C400] text-black font-bold shadow'
                : 'text-[#A6A6AC] hover:text-[#F3F3F3]'
            }`}
          >
            All Content
          </button>
          <button
            onClick={() => handleTypeChange('movie')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              filters.mediaType === 'movie'
                ? 'bg-[#F5C400] text-black font-bold shadow'
                : 'text-[#A6A6AC] hover:text-[#F3F3F3]'
            }`}
          >
            Movies
          </button>
          <button
            onClick={() => handleTypeChange('tv')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              filters.mediaType === 'tv'
                ? 'bg-[#F5C400] text-black font-bold shadow'
                : 'text-[#A6A6AC] hover:text-[#F3F3F3]'
            }`}
          >
            TV Series
          </button>
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 flex-grow max-w-4xl">
          {/* Genre select */}
          <div className="relative">
            <select
              value={filters.genreId || ''}
              onChange={handleGenreChange}
              className="w-full bg-[#232326] border border-[#3A3A40] text-xs font-medium text-[#F3F3F3] rounded-lg px-3 py-2 appearance-none focus:outline-none focus:border-[#F5C400] cursor-pointer"
            >
              <option value="">All Genres</option>
              {ALL_GENRES.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Release Year */}
          <div className="relative">
            <select
              value={filters.year || ''}
              onChange={handleYearChange}
              className="w-full bg-[#232326] border border-[#3A3A40] text-xs font-medium text-[#F3F3F3] rounded-lg px-3 py-2 appearance-none focus:outline-none focus:border-[#F5C400] cursor-pointer"
            >
              <option value="">Any Year</option>
              {years.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Min Rating */}
          <div className="relative">
            <select
              value={filters.minRating || ''}
              onChange={handleRatingChange}
              className="w-full bg-[#232326] border border-[#3A3A40] text-xs font-medium text-[#F3F3F3] rounded-lg px-3 py-2 appearance-none focus:outline-none focus:border-[#F5C400] cursor-pointer"
            >
              <option value="">Any Rating</option>
              <option value="7.0">★ 7.0 and up</option>
              <option value="7.5">★ 7.5 and up</option>
              <option value="8.0">★ 8.0 and up</option>
              <option value="8.5">★ 8.5 and up</option>
            </select>
          </div>

          {/* Language */}
          <div className="relative">
            <select
              aria-label="Original Language"
              value={filters.language || ''}
              onChange={handleLanguageChange}
              className="w-full bg-[#232326] border border-[#3A3A40] text-xs font-medium text-[#F3F3F3] rounded-lg px-3 py-2 appearance-none focus:outline-none focus:border-[#F5C400] cursor-pointer"
            >
              <option value="">All Languages</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="sr">Serbian</option>
              <option value="hr">Croatian</option>
              <option value="bs">Bosnian</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="relative col-span-2 sm:col-span-1">
            <select
              value={filters.sortBy || 'popularity.desc'}
              onChange={handleSortChange}
              className="w-full bg-[#232326] border border-[#3A3A40] text-xs font-medium text-[#F3F3F3] rounded-lg px-3 py-2 appearance-none focus:outline-none focus:border-[#F5C400] cursor-pointer"
            >
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Highest Rated</option>
              <option value="primary_release_date.desc">Release Date</option>
              <option value="title.asc">Title A–Z</option>
            </select>
          </div>
        </div>

        {/* Clear Filters & Count */}
        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <span className="text-xs text-[#A6A6AC] tabular-nums">
            <strong className="text-white">{totalResults}</strong> titles
          </span>

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-[#F5C400] hover:underline font-medium transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
