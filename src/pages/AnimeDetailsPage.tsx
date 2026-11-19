import React, { useEffect, useState } from 'react';
import { Play, Plus, Check, Share2, Film, Star, Calendar, Clock, Tv, Globe, ArrowLeft } from 'lucide-react';
import type { AnimeDetail, AnimeMedia, VideoItem } from '../types/media';
import { getAnimeDetailById } from '../services/animeCatalog';
import { isInWatchlist, toggleWatchlist, getContinueWatching } from '../services/storage';
import { getUserPlayerSettings, saveUserPlayerSettings, type AnimeAudioPreference } from '../services/playerSettings';
import { AnimeEpisodesGrid } from '../components/anime/AnimeEpisodesGrid';
import { AnimeCard } from '../components/anime/AnimeCard';
import { RatingViewsBar } from '../components/RatingViewsBar';
import { TrailerModal } from '../components/TrailerModal';
import { ShareModal } from '../components/ShareModal';
import { ReportIssueModal } from '../components/ReportIssueModal';
import { updateMediaSEO, updateSEO } from '../utils/seo';

interface AnimeDetailsPageProps {
  anilistId: number;
  isMovieRoute?: boolean;
  onBack: () => void;
  onSelectAnime: (anime: AnimeMedia) => void;
  onWatchAnime: (anime: AnimeDetail, episode?: number) => void;
  onSelectGenre: (genre: string) => void;
}

export const AnimeDetailsPage: React.FC<AnimeDetailsPageProps> = ({
  anilistId,
  onBack,
  onSelectAnime,
  onWatchAnime,
  onSelectGenre
}) => {
  const [detail, setDetail] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [audioPref, setAudioPref] = useState<AnimeAudioPreference>(
    () => getUserPlayerSettings().animeAudioPreference || 'sub'
  );
  const [resumeEpisode, setResumeEpisode] = useState<number>(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'instant' as any });

    getAnimeDetailById(anilistId)
      .then((res) => {
        if (!active) return;
        setDetail(res);
        if (res) {
          setInWatchlist(isInWatchlist(res.anilistId || res.id));
          const cw = getContinueWatching().find(
            (item) =>
              item.mediaType === 'anime' &&
              (item.anilistId === res.anilistId || item.id === res.id)
          );
          setResumeEpisode(cw?.episodeNumber && cw.episodeNumber > 0 ? cw.episodeNumber : 1);

          updateMediaSEO(res, {
            seriesId: res.anilistId || res.id,
            season: 1,
            episode: 1,
            numberOfSeasons: 1,
            seasonEpisodeCount: res.numberOfEpisodes || res.episodes?.length
          });
        } else {
          updateSEO({
            title: '404 — Anime Not Found',
            description: 'The requested anime could not be found on T Stream.',
            noindex: true,
            url: '/404'
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [anilistId]);

  const handleAudioPrefChange = async (pref: AnimeAudioPreference) => {
    setAudioPref(pref);
    await saveUserPlayerSettings({ animeAudioPreference: pref });
  };

  if (loading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#1b1b1f]">
        <div className="w-8 h-8 border-3 border-[#F5C400] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail || !detail.anilistData) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-md space-y-4">
          <div className="text-6xl font-black text-[#F5C400]">404</div>
          <h1 className="text-2xl font-extrabold text-white">Anime Not Found</h1>
          <p className="text-xs text-[#A6A6AC]">
            This anime entry could not be found on AniList or is restricted from indexing.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-[#F5C400] text-black text-xs font-extrabold cursor-pointer"
          >
            Back to Anime Catalog
          </button>
        </div>
      </div>
    );
  }

  const anime = detail.anilistData;
  const trailerVideo: VideoItem | null = detail.videos?.[0] || null;
  const isMovie = anime.format === 'MOVIE';
  const mainStudio = anime.studios?.find((s) => s.isAnimationStudio)?.name || anime.studios?.[0]?.name;

  return (
    <div className="pb-24 text-[#F3F3F3]">
      {/* Cinematic Banner Backdrop */}
      <section className="relative bg-[#141418] border-b border-[#32323a] overflow-hidden">
        {anime.bannerImage && (
          <img
            src={anime.bannerImage}
            alt={anime.title}
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1b1b1f] via-[#1b1b1f]/80 to-[#141418]/70" />

        <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A6A6AC] hover:text-white mb-6 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Anime</span>
          </button>

          <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
            {/* Poster */}
            <div className="w-44 sm:w-56 aspect-[2/3] rounded-2xl overflow-hidden bg-[#141418] border border-white/15 shadow-2xl shrink-0">
              {anime.coverImage ? (
                <img
                  src={anime.coverImage}
                  alt={anime.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-[#8E8E93] p-4 text-center">
                  {anime.title}
                </div>
              )}
            </div>

            {/* Info Column */}
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#D1D1D6] tabular-nums">
                <span className="text-[#F5C400] font-black uppercase tracking-wider">
                  {anime.format.replace(/_/g, ' ')}
                </span>
                {anime.seasonYear && (
                  <>
                    <span>·</span>
                    <span>
                      {anime.season ? `${anime.season} ` : ''}
                      {anime.seasonYear}
                    </span>
                  </>
                )}
                {anime.status && (
                  <>
                    <span>·</span>
                    <span>{anime.status.replace(/_/g, ' ')}</span>
                  </>
                )}
                {anime.episodesCount && (
                  <>
                    <span>·</span>
                    <span>{anime.episodesCount} Episodes</span>
                  </>
                )}
                {anime.durationMinutes && (
                  <>
                    <span>·</span>
                    <span>{anime.durationMinutes}m / ep</span>
                  </>
                )}
                {anime.voteAverage > 0 && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-white font-bold">
                      <Star className="w-3.5 h-3.5 fill-[#F5C400] text-[#F5C400]" />
                      {anime.voteAverage.toFixed(1)}
                    </span>
                  </>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {anime.title}
                </h1>
                {(anime.romajiTitle && anime.romajiTitle !== anime.title) || anime.nativeTitle ? (
                  <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1 font-medium">
                    {[anime.romajiTitle !== anime.title ? anime.romajiTitle : null, anime.nativeTitle]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>

              {anime.synonyms && anime.synonyms.length > 0 && (
                <p className="text-[11px] text-[#8E8E93] line-clamp-1">
                  Also known as: {anime.synonyms.slice(0, 4).join(', ')}
                </p>
              )}

              {/* Genres & Studio line */}
              <div className="flex flex-wrap items-center gap-2">
                {anime.genres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onSelectGenre(g)}
                    className="px-2.5 py-1 rounded-lg bg-[#25252d] hover:bg-[#32323c] border border-[#3a3a45] text-xs font-semibold text-white hover:text-[#F5C400] transition-colors cursor-pointer"
                  >
                    {g}
                  </button>
                ))}
                {mainStudio && (
                  <span className="text-xs text-[#A6A6AC] font-medium pl-1">
                    Studio: <strong className="text-white">{mainStudio}</strong>
                  </span>
                )}
              </div>

              {anime.description && (
                <p className="text-sm text-[#D1D1D6] leading-relaxed max-w-3xl whitespace-pre-line">
                  {anime.description}
                </p>
              )}

              {/* Audio Preference + Action Controls */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onWatchAnime(detail, isMovie ? 1 : resumeEpisode)}
                  className="px-6 py-3 rounded-xl bg-[#F5C400] hover:bg-[#ffcf14] text-black font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>
                    {isMovie
                      ? 'Watch Anime Movie'
                      : resumeEpisode > 1
                      ? `Resume Episode ${resumeEpisode}`
                      : 'Watch Episode 1'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const added = toggleWatchlist(detail);
                    setInWatchlist(added);
                  }}
                  className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border cursor-pointer transition-colors ${
                    inWatchlist
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#232328] hover:bg-[#2d2d34] text-white border-[#3A3A40]'
                  }`}
                >
                  {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
                </button>

                {trailerVideo && (
                  <button
                    type="button"
                    onClick={() => setTrailerOpen(true)}
                    className="px-4 py-3 rounded-xl bg-[#232328] hover:bg-[#2d2d34] border border-[#3A3A40] text-xs sm:text-sm font-bold text-white flex items-center gap-2 cursor-pointer"
                  >
                    <Film className="w-4 h-4 text-[#F5C400]" />
                    <span>Trailer</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="px-4 py-3 rounded-xl bg-[#232328] hover:bg-[#2d2d34] border border-[#3A3A40] text-xs sm:text-sm font-bold text-white flex items-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>

              {/* Audio Track Preference + Metadata IDs (isolated) */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-[#F5C400]" />
                  <span className="text-[#A6A6AC] font-semibold">Preferred Audio:</span>
                  {(['sub', 'dub', 'auto'] as const).map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => handleAudioPrefChange(pref)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
                        audioPref === pref
                          ? 'bg-[#F5C400] text-black'
                          : 'bg-[#232328] text-[#A6A6AC] hover:text-white'
                      }`}
                    >
                      {pref === 'sub' ? 'Japanese Original' : pref === 'dub' ? 'English Dub' : 'Auto'}
                    </button>
                  ))}
                </div>

                <RatingViewsBar
                  mediaId={anime.anilistId}
                  mediaType="anime"
                  mediaTitle={anime.title}
                  onOpenReport={() => setReportOpen(true)}
                />
              </div>

              {/* Clean Fact Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs tabular-nums">
                <div className="p-2.5 rounded-xl bg-[#18181d] border border-[#2c2c34]">
                  <span className="text-[10px] uppercase text-[#8E8E93] block">Popularity</span>
                  <span className="font-bold text-white">{anime.popularity.toLocaleString()}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#18181d] border border-[#2c2c34]">
                  <span className="text-[10px] uppercase text-[#8E8E93] block">Release Dates</span>
                  <span className="font-bold text-white flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#F5C400]" />
                    {anime.startDate || 'TBA'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#18181d] border border-[#2c2c34]">
                  <span className="text-[10px] uppercase text-[#8E8E93] block">Runtime</span>
                  <span className="font-bold text-white flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#F5C400]" />
                    {anime.durationMinutes ? `${anime.durationMinutes} min` : 'Standard'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#18181d] border border-[#2c2c34]">
                  <span className="text-[10px] uppercase text-[#8E8E93] block">Identifiers</span>
                  <span className="font-mono text-[11px] text-[#D1D1D6] flex items-center gap-1.5">
                    <Tv className="w-3 h-3 text-[#F5C400]" />
                    AL:{anime.anilistId}
                    {anime.malId ? ` · MAL:${anime.malId}` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* Episodes Grid (Episodic Anime) */}
        {!isMovie && (
          <section>
            <AnimeEpisodesGrid
              episodes={anime.episodes || []}
              totalEpisodesCount={anime.episodesCount}
              fallbackCover={anime.bannerImage || anime.coverImage}
              onWatchEpisode={(epNum) => onWatchAnime(detail, epNum)}
            />
          </section>
        )}

        {/* Tags */}
        {anime.tags && anime.tags.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Themes &amp; Tags</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {anime.tags.slice(0, 14).map((t) => (
                <span
                  key={t.name}
                  className="px-2.5 py-1 rounded-lg bg-[#1b1b20] border border-[#303038] text-[#D1D1D6]"
                >
                  {t.name}
                  {t.rank ? <span className="text-[#8E8E93] ml-1.5 tabular-nums">{t.rank}%</span> : null}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Characters */}
        {anime.characters && anime.characters.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Characters &amp; Voice Cast</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {anime.characters.slice(0, 12).map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#1b1b20] border border-[#303038]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {ch.image ? (
                      <img
                        src={ch.image}
                        alt={ch.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-14 rounded-lg object-cover bg-[#141418] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded-lg bg-[#141418] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{ch.name}</p>
                      <p className="text-[10px] text-[#8E8E93] uppercase">{ch.role}</p>
                    </div>
                  </div>
                  {ch.voiceActor && (
                    <div className="text-right min-w-0">
                      <p className="text-[11px] font-semibold text-[#D1D1D6] truncate">{ch.voiceActor.name}</p>
                      <p className="text-[10px] text-[#8E8E93]">{ch.voiceActor.language}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Related Anime */}
        {anime.relations && anime.relations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Related Anime</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {anime.relations.slice(0, 6).map((rel) => (
                <div key={`${rel.relationType}-${rel.media.anilistId}`} className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5C400] block">
                    {rel.relationType.replace(/_/g, ' ')}
                  </span>
                  <AnimeCard
                    anime={rel.media}
                    onSelect={onSelectAnime}
                    onWatch={(a, ep) => onSelectAnime(a)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommended Anime */}
        {anime.recommendations && anime.recommendations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-white">Recommended Anime</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {anime.recommendations.slice(0, 12).map((rec) => (
                <AnimeCard
                  key={`rec-${rec.anilistId}`}
                  anime={rec}
                  onSelect={onSelectAnime}
                  onWatch={(a) => onSelectAnime(a)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <TrailerModal
        video={trailerVideo}
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        title={anime.title}
      />
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={anime.title}
        overview={anime.description}
      />
      <ReportIssueModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        mediaId={anime.anilistId}
        mediaType="anime"
        mediaTitle={anime.title}
      />
    </div>
  );
};
