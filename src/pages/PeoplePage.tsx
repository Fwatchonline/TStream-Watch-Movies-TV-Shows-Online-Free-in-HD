import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Clapperboard,
  Film,
  Award,
  Sparkles,
  ChevronRight,
  User as UserIcon,
  Filter
} from 'lucide-react';
import { PersonSummary, fetchPopularPeople, searchPeople } from '../services/tmdb';

interface PeoplePageProps {
  onSelectPerson: (personId: number) => void;
}

export const PeoplePage: React.FC<PeoplePageProps> = ({ onSelectPerson }) => {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<'all' | 'Acting' | 'Directing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    if (searchQuery.trim().length > 1) {
      const timer = setTimeout(() => {
        searchPeople(searchQuery.trim(), 1).then((res) => {
          if (isMounted) {
            setPeople(res.results || []);
            setLoading(false);
          }
        });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      fetchPopularPeople(page, department).then((res) => {
        if (isMounted) {
          setPeople(res.results || []);
          setLoading(false);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [department, searchQuery, page]);

  return (
    <div className="min-h-screen bg-[#121215] text-[#F3F3F3] pb-24 font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Hero Header */}
      <div className="relative py-12 px-4 sm:px-6 lg:px-8 border-b border-[#232328] bg-gradient-to-b from-[#181820] to-[#121215]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5C400]/15 border border-[#F5C400]/40 text-[#F5C400] text-xs font-black uppercase tracking-wider mb-3">
                <Users className="w-3.5 h-3.5" />
                <span>Cast &amp; Creators Directory</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Actors &amp; Directors
              </h1>
              <p className="text-sm text-[#A6A6AC] mt-2 max-w-xl">
                Explore the filmographies, bios, and works of Hollywood legends, top-billed stars, and visionary filmmakers.
              </p>
            </div>

            {/* Search Box */}
            <div className="w-full md:w-80">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search actor or director..."
                  className="w-full bg-[#1b1b22] border border-[#3A3A40] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F5C400] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Department Filter Pills */}
          <div className="flex items-center gap-2 mt-8 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setDepartment('all');
                setSearchQuery('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                department === 'all' && !searchQuery
                  ? 'bg-[#F5C400] text-black font-black shadow-lg shadow-amber-500/10'
                  : 'bg-[#1b1b20] text-[#A6A6AC] hover:text-white border border-[#2d2d34]'
              }`}
            >
              All Talents
            </button>

            <button
              onClick={() => {
                setDepartment('Acting');
                setSearchQuery('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                department === 'Acting' && !searchQuery
                  ? 'bg-[#F5C400] text-black font-black shadow-lg shadow-amber-500/10'
                  : 'bg-[#1b1b20] text-[#A6A6AC] hover:text-white border border-[#2d2d34]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Actors &amp; Actresses</span>
            </button>

            <button
              onClick={() => {
                setDepartment('Directing');
                setSearchQuery('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                department === 'Directing' && !searchQuery
                  ? 'bg-[#F5C400] text-black font-black shadow-lg shadow-amber-500/10'
                  : 'bg-[#1b1b20] text-[#A6A6AC] hover:text-white border border-[#2d2d34]'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span>Directors &amp; Filmmakers</span>
            </button>
          </div>
        </div>
      </div>

      {/* People Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-3 border-[#3A3A40] border-t-[#F5C400] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading actors and directors...</p>
          </div>
        ) : people.length === 0 ? (
          <div className="py-20 text-center bg-[#18181c] rounded-2xl border border-white/5">
            <UserIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-bold">No artists found matching your query.</p>
            <p className="text-xs text-slate-500 mt-1">Try another search keyword or clear filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {people.map((person) => {
              const isDir = person.knownForDepartment?.toLowerCase().includes('direct');
              return (
                <div
                  key={person.id}
                  onClick={() => onSelectPerson(person.id)}
                  className="group bg-[#16161a] border border-[#26262c] hover:border-[#F5C400]/70 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer shadow-md hover:-translate-y-1.5 flex flex-col"
                >
                  {/* Portrait photo */}
                  <div className="aspect-[3/4] w-full bg-[#1b1b22] relative overflow-hidden">
                    {person.profilePath ? (
                      <img
                        src={person.profilePath}
                        alt={person.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <UserIcon className="w-12 h-12" />
                      </div>
                    )}

                    {/* Department Tag */}
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider backdrop-blur-xs border ${
                        isDir
                          ? 'bg-amber-500/90 text-black border-amber-300'
                          : 'bg-black/75 text-white border-white/10'
                      }`}
                    >
                      {isDir ? 'Director' : 'Actor'}
                    </span>

                    {/* Popularity Badge */}
                    {person.popularity > 0 && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[#F5C400] text-[10px] font-bold flex items-center gap-1 border border-[#F5C400]/30">
                        <Award className="w-3 h-3" />
                        {Math.round(person.popularity)}
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-white group-hover:text-[#F5C400] transition-colors line-clamp-1">
                        {person.name}
                      </h3>
                      {person.knownFor && (
                        <p className="text-[11px] text-[#8E8E93] line-clamp-1 mt-0.5">
                          {person.knownFor}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#F5C400] font-semibold">
                      <span>View Works</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
