import { TMDB_BASE_URL } from './tmdb';
import { MediaItem } from '../types/media';

export type EpisodeReleasePeriod = 'today' | 'yesterday' | 'this_week' | 'recent';

export interface NewEpisodeItem {
  id: string; // e.g. "1399_s8_e6"
  showId: number;
  showTitle: string;
  showPoster: string;
  showBackdrop?: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  overview: string;
  stillPath?: string;
  airDate: string;
  voteAverage: number;
  genres?: string[];
  isAiringToday?: boolean;
  releasePeriod: EpisodeReleasePeriod;
  relativeTimeText: string;
}

/**
 * Determine if episode air date is Today, Yesterday, or This Week
 */
export function computeReleasePeriod(airDateStr: string, _isAiringTodayFlag?: boolean): {
  period: EpisodeReleasePeriod;
  relativeText: string;
} {
  if (!airDateStr) {
    return { period: 'this_week', relativeText: 'This Week' };
  }

  const parts = airDateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const epYear = parts[0];
    const epMonth = parts[1] - 1;
    const epDay = parts[2];

    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const epUtc = Date.UTC(epYear, epMonth, epDay);

    const diffDays = Math.round((todayUtc - epUtc) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { period: 'today', relativeText: 'Released Today' };
    } else if (diffDays === 1) {
      return { period: 'yesterday', relativeText: 'Yesterday' };
    } else if (diffDays >= 2 && diffDays <= 7) {
      return { period: 'this_week', relativeText: `${diffDays} days ago` };
    } else {
      return { period: 'recent', relativeText: `${diffDays} days ago` };
    }
  }

  return { period: 'this_week', relativeText: 'This Week' };
}

// Fallback curated ongoing series with dynamically calculated Today / Yesterday / This Week
const nowMs = Date.now();
const dayMs = 86400000;
const todayDateStr = new Date(nowMs).toISOString().slice(0, 10);
const yesterdayDateStr = new Date(nowMs - dayMs).toISOString().slice(0, 10);
const twoDaysAgoDateStr = new Date(nowMs - dayMs * 2).toISOString().slice(0, 10);
const threeDaysAgoDateStr = new Date(nowMs - dayMs * 3).toISOString().slice(0, 10);
const fourDaysAgoDateStr = new Date(nowMs - dayMs * 4).toISOString().slice(0, 10);
const fiveDaysAgoDateStr = new Date(nowMs - dayMs * 5).toISOString().slice(0, 10);

const CURATED_NEW_EPISODES: NewEpisodeItem[] = [
  // Released Today
  {
    id: '94605_s2_e8',
    showId: 94605,
    showTitle: 'Arcane',
    showPoster: 'https://images.metahub.space/poster/medium/tt11126994/img',
    showBackdrop: 'https://images.metahub.space/background/medium/tt11126994/img',
    seasonNumber: 2,
    episodeNumber: 8,
    episodeName: 'Killing Is a Cycle',
    overview: 'As the battle between Piltover and Zaun reaches its climax, ancient powers and sisterly bonds collide.',
    stillPath: 'https://images.metahub.space/background/medium/tt11126994/img',
    airDate: todayDateStr,
    voteAverage: 9.3,
    genres: ['Animation', 'Action', 'Sci-Fi'],
    isAiringToday: true,
    releasePeriod: 'today',
    relativeTimeText: 'Released Today'
  },
  {
    id: '114479_s1_e8',
    showId: 114479,
    showTitle: 'The Penguin',
    showPoster: 'https://images.metahub.space/poster/medium/tt15435876/img',
    showBackdrop: 'https://images.metahub.space/background/medium/tt15435876/img',
    seasonNumber: 1,
    episodeNumber: 8,
    episodeName: 'A Great or Little Thing',
    overview: 'Oz Cobb makes his final bold play to seize total dominion over Gotham City’s criminal underworld.',
    stillPath: 'https://images.metahub.space/background/medium/tt15435876/img',
    airDate: todayDateStr,
    voteAverage: 9.1,
    genres: ['Crime', 'Drama'],
    isAiringToday: true,
    releasePeriod: 'today',
    relativeTimeText: 'Released Today'
  },
  {
    id: '124364_s2_e1',
    showId: 124364,
    showTitle: 'Severance',
    showPoster: 'https://images.metahub.space/poster/medium/tt11280740/img',
    showBackdrop: 'https://images.metahub.space/background/medium/tt11280740/img',
    seasonNumber: 2,
    episodeNumber: 1,
    episodeName: 'Hello, Lumon',
    overview: 'Mark Scout returns to the severed floor only to discover that everything he knew has been altered.',
    stillPath: 'https://images.metahub.space/background/medium/tt11280740/img',
    airDate: todayDateStr,
    voteAverage: 8.8,
    genres: ['Sci-Fi', 'Mystery', 'Thriller'],
    isAiringToday: true,
    releasePeriod: 'today',
    relativeTimeText: 'Released Today'
  },

  // Yesterday
  {
    id: '100088_s2_e7',
    showId: 100088,
    showTitle: 'The Last of Us',
    showPoster: 'https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
    showBackdrop: 'https://images.metahub.space/background/medium/tt3581920/img',
    seasonNumber: 2,
    episodeNumber: 7,
    episodeName: 'The Price of Vengeance',
    overview: 'Joel and Ellie navigate the treacherous ruins of Seattle while hunted by an unforgiving militia.',
    stillPath: 'https://images.metahub.space/background/medium/tt3581920/img',
    airDate: yesterdayDateStr,
    voteAverage: 8.9,
    genres: ['Drama', 'Sci-Fi', 'Action'],
    releasePeriod: 'yesterday',
    relativeTimeText: 'Yesterday'
  },
  {
    id: '94997_s2_e8',
    showId: 94997,
    showTitle: 'House of the Dragon',
    showPoster: 'https://image.tmdb.org/t/p/w500/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg',
    showBackdrop: 'https://image.tmdb.org/t/p/original/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg',
    seasonNumber: 2,
    episodeNumber: 8,
    episodeName: 'The Queen Who Ever Was',
    overview: 'Armies gather as the Black and Green factions prepare for the catastrophic battle that will decide the realm.',
    stillPath: 'https://image.tmdb.org/t/p/original/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg',
    airDate: yesterdayDateStr,
    voteAverage: 8.7,
    genres: ['Drama', 'Action', 'Fantasy'],
    releasePeriod: 'yesterday',
    relativeTimeText: 'Yesterday'
  },
  {
    id: '125988_s2_e5',
    showId: 125988,
    showTitle: 'Silo',
    showPoster: 'https://images.metahub.space/poster/medium/tt14688458/img',
    showBackdrop: 'https://images.metahub.space/background/medium/tt14688458/img',
    seasonNumber: 2,
    episodeNumber: 5,
    episodeName: 'The Underground',
    overview: 'Juliette uncovers an ancient blueprint within the abandoned silo that changes her understanding of the founders.',
    stillPath: 'https://images.metahub.space/background/medium/tt14688458/img',
    airDate: yesterdayDateStr,
    voteAverage: 8.6,
    genres: ['Sci-Fi', 'Drama', 'Mystery'],
    releasePeriod: 'yesterday',
    relativeTimeText: 'Yesterday'
  },

  // This Week
  {
    id: '84958_s3_e5',
    showId: 84958,
    showTitle: 'Loki',
    showPoster: 'https://images.metahub.space/poster/medium/tt9140554/img',
    showBackdrop: 'https://images.metahub.space/background/medium/tt9140554/img',
    seasonNumber: 2,
    episodeNumber: 6,
    episodeName: 'Glorious Purpose',
    overview: 'Loki steps up to preserve the threads of the Multiverse and takes his rightful throne at the end of time.',
    stillPath: 'https://images.metahub.space/background/medium/tt9140554/img',
    airDate: twoDaysAgoDateStr,
    voteAverage: 8.7,
    genres: ['Sci-Fi', 'Action', 'Adventure'],
    releasePeriod: 'this_week',
    relativeTimeText: '2 days ago'
  },
  {
    id: '76479_s4_e8',
    showId: 76479,
    showTitle: 'The Boys',
    showPoster: 'https://images.metahub.space/poster/medium/tt1190634/img',
    showBackdrop: 'https://image.tmdb.org/t/p/original/n6bUvigpRFqSwmPp1m2YADdbRBc.jpg',
    seasonNumber: 4,
    episodeNumber: 8,
    episodeName: 'Assassination Run',
    overview: 'The Boys race against the clock to save the country before Victoria Neuman and Homelander seize total power.',
    stillPath: 'https://images.metahub.space/background/medium/tt1190634/img',
    airDate: threeDaysAgoDateStr,
    voteAverage: 8.6,
    genres: ['Action', 'Comedy', 'Sci-Fi'],
    releasePeriod: 'this_week',
    relativeTimeText: '3 days ago'
  },
  {
    id: '106379_s1_e9',
    showId: 106379,
    showTitle: 'Fallout',
    showPoster: 'https://images.metahub.space/poster/medium/tt12637874/img',
    showBackdrop: 'https://images.metahub.space/background/medium/tt12637874/img',
    seasonNumber: 1,
    episodeNumber: 8,
    episodeName: 'The Beginning',
    overview: 'Lucy, Maximus, and the Ghoul converge at the Griffith Observatory for the revelation of Vault-Tec’s grand plan.',
    stillPath: 'https://images.metahub.space/background/medium/tt12637874/img',
    airDate: fourDaysAgoDateStr,
    voteAverage: 8.8,
    genres: ['Action', 'Adventure', 'Sci-Fi'],
    releasePeriod: 'this_week',
    relativeTimeText: '4 days ago'
  },
  {
    id: '63333_s2_e4',
    showId: 63333,
    showTitle: 'The Last Kingdom',
    showPoster: 'https://images.metahub.space/poster/medium/tt4179452/img',
    showBackdrop: 'https://images.metahub.space/background/medium/tt4179452/img',
    seasonNumber: 5,
    episodeNumber: 10,
    episodeName: 'Bebbanburg Retaken',
    overview: 'Uhtred risks everything to reclaim his ancestral home and fulfill his ultimate destiny.',
    stillPath: 'https://images.metahub.space/background/medium/tt4179452/img',
    airDate: fiveDaysAgoDateStr,
    voteAverage: 8.5,
    genres: ['Action', 'Drama', 'War'],
    releasePeriod: 'this_week',
    relativeTimeText: '5 days ago'
  }
];

// Memory cache to avoid spamming TMDB
const episodesCache: { data: NewEpisodeItem[]; timestamp: number } = {
  data: [],
  timestamp: 0
};

/**
 * Fetch detailed episode info for a TV show's last aired or currently airing episode
 */
export async function fetchTvLastEpisode(tvId: number): Promise<{
  showId: number;
  showTitle: string;
  showPoster: string;
  showBackdrop?: string;
  lastEpisode: {
    id: number;
    seasonNumber: number;
    episodeNumber: number;
    name: string;
    overview: string;
    airDate: string;
    stillPath?: string;
    voteAverage: number;
  } | null;
} | null> {
  if (typeof window === 'undefined') return null;
  const todayIso = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${tvId}`);
    if (!res.ok) return null;
    const data = await res.json();
    
    // Check next_episode_to_air first if its air_date is today or in the past
    let ep = null;
    if (data.next_episode_to_air && data.next_episode_to_air.air_date <= todayIso) {
      ep = data.next_episode_to_air;
    } else if (data.last_episode_to_air) {
      ep = data.last_episode_to_air;
    } else if (data.next_episode_to_air) {
      ep = data.next_episode_to_air;
    }

    if (!ep) return null;

    return {
      showId: data.id,
      showTitle: data.name || 'TV Series',
      showPoster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
      showBackdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : undefined,
      lastEpisode: {
        id: ep.id,
        seasonNumber: ep.season_number || 1,
        episodeNumber: ep.episode_number || 1,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || '',
        airDate: ep.air_date || '',
        stillPath: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : undefined,
        voteAverage: ep.vote_average ? Number(ep.vote_average.toFixed(1)) : 8.0
      }
    };
  } catch (err) {
    console.warn(`Error fetching last episode for show ${tvId}:`, err);
    return null;
  }
}

/**
 * Fetch recently aired & airing today episodes across all top ongoing series
 */
export async function fetchNewEpisodes(options: { forceRefresh?: boolean; extraShowIds?: (number | string)[] } = {}): Promise<NewEpisodeItem[]> {
  const now = Date.now();
  if (!options.forceRefresh && episodesCache.data.length > 0 && (now - episodesCache.timestamp < 1000 * 60 * 10)) {
    return episodesCache.data;
  }

  if (typeof window === 'undefined') {
    return CURATED_NEW_EPISODES;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const yesterdayIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgoIso = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);
  const sevenDaysAgoIso = new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10);

  try {
    // Fetch targeted shows across Today, Yesterday, and This Week concurrently
    const [todayRes1, todayRes2, yestRes1, yestRes2, weekRes1, weekRes2, onAirRes] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/discover/tv?air_date.lte=${todayIso}&air_date.gte=${todayIso}&sort_by=popularity.desc&page=1`).then(r => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })),
      fetch(`${TMDB_BASE_URL}/discover/tv?air_date.lte=${todayIso}&air_date.gte=${todayIso}&sort_by=popularity.desc&page=2`).then(r => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })),
      fetch(`${TMDB_BASE_URL}/discover/tv?air_date.lte=${yesterdayIso}&air_date.gte=${yesterdayIso}&sort_by=popularity.desc&page=1`).then(r => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })),
      fetch(`${TMDB_BASE_URL}/discover/tv?air_date.lte=${yesterdayIso}&air_date.gte=${yesterdayIso}&sort_by=popularity.desc&page=2`).then(r => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })),
      fetch(`${TMDB_BASE_URL}/discover/tv?air_date.lte=${twoDaysAgoIso}&air_date.gte=${sevenDaysAgoIso}&sort_by=popularity.desc&page=1`).then(r => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })),
      fetch(`${TMDB_BASE_URL}/discover/tv?air_date.lte=${twoDaysAgoIso}&air_date.gte=${sevenDaysAgoIso}&sort_by=popularity.desc&page=2`).then(r => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })),
      fetch(`${TMDB_BASE_URL}/tv/on_the_air?page=1`).then(r => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] }))
    ]);

    const targetShows: any[] = [];
    const seenShowIds = new Set<number>();

    // Add extra requested shows (e.g. followed shows) first
    if (options.extraShowIds && options.extraShowIds.length > 0) {
      options.extraShowIds.forEach(rawId => {
        const id = Number(rawId);
        if (!isNaN(id) && id > 0 && !seenShowIds.has(id)) {
          seenShowIds.add(id);
          targetShows.push({ id });
        }
      });
    }

    const addBatch = (list: any[], maxCount: number) => {
      let count = 0;
      for (const item of (list || [])) {
        if (item && item.id && item.poster_path && !seenShowIds.has(item.id)) {
          seenShowIds.add(item.id);
          targetShows.push(item);
          count++;
          if (count >= maxCount) break;
        }
      }
    };

    // Collect balanced representation across all three release windows
    addBatch([...(todayRes1.results || []), ...(todayRes2.results || [])], 35);
    addBatch([...(yestRes1.results || []), ...(yestRes2.results || [])], 35);
    addBatch([...(weekRes1.results || []), ...(weekRes2.results || [])], 35);
    addBatch(onAirRes.results || [], 15);

    const genreMap: Record<number, string> = {
      10759: 'Action & Adventure',
      16: 'Animation',
      35: 'Comedy',
      80: 'Crime',
      99: 'Documentary',
      18: 'Drama',
      10751: 'Family',
      10762: 'Kids',
      9648: 'Mystery',
      10763: 'News',
      10764: 'Reality',
      10765: 'Sci-Fi & Fantasy',
      10766: 'Soap',
      10767: 'Talk',
      10768: 'War & Politics',
      37: 'Western'
    };

    // Resolve detailed episodes for each candidate show
    const detailPromises = targetShows.map(async (show: any) => {
      const info = await fetchTvLastEpisode(show.id);
      if (!info || !info.lastEpisode) return null;

      const ep = info.lastEpisode;
      const airDate = ep.airDate || '';
      const { period, relativeText } = computeReleasePeriod(airDate);

      const genres = show.genre_ids
        ? (show.genre_ids || []).map((gid: number) => genreMap[gid] || 'Drama').slice(0, 3)
        : ['Drama'];

      const episodeItem: NewEpisodeItem = {
        id: `${show.id}_s${ep.seasonNumber}_e${ep.episodeNumber}`,
        showId: show.id,
        showTitle: info.showTitle || show.name || 'TV Series',
        showPoster: info.showPoster || (show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : ''),
        showBackdrop: info.showBackdrop || (show.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : undefined),
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        episodeName: ep.name,
        overview: ep.overview || 'Newly aired episode ready to stream in HD.',
        stillPath: ep.stillPath || (show.backdrop_path ? `https://image.tmdb.org/t/p/w500${show.backdrop_path}` : undefined),
        airDate,
        voteAverage: ep.voteAverage || 8.0,
        genres,
        isAiringToday: period === 'today',
        releasePeriod: period,
        relativeTimeText: relativeText
      };
      return episodeItem;
    });

    const resolved = (await Promise.all(detailPromises)).filter(Boolean) as NewEpisodeItem[];

    if (resolved.length >= 5) {
      // Sort: Today first, then Yesterday, then This Week, then Recent; within same period, newest airDate and highest rating
      const periodOrder: Record<EpisodeReleasePeriod, number> = {
        today: 0,
        yesterday: 1,
        this_week: 2,
        recent: 3
      };

      resolved.sort((a, b) => {
        const orderDiff = periodOrder[a.releasePeriod] - periodOrder[b.releasePeriod];
        if (orderDiff !== 0) return orderDiff;
        const timeDiff = new Date(b.airDate || 0).getTime() - new Date(a.airDate || 0).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (b.voteAverage || 0) - (a.voteAverage || 0);
      });

      episodesCache.data = resolved;
      episodesCache.timestamp = now;
      return resolved;
    }
  } catch (err) {
    console.warn('Error fetching new episodes from TMDB, using fallback:', err);
  }

  // Fallback to curated new episodes
  return CURATED_NEW_EPISODES;
}

/**
 * Convert NewEpisodeItem to standard MediaItem for playback/navigation
 */
export function episodeItemToMediaItem(item: NewEpisodeItem): MediaItem {
  return {
    id: item.showId,
    tmdbId: item.showId,
    title: item.showTitle,
    overview: item.overview,
    posterPath: item.showPoster,
    backdropPath: item.showBackdrop || item.stillPath || item.showPoster,
    releaseDate: item.airDate,
    voteAverage: item.voteAverage,
    voteCount: 150,
    popularity: 85,
    mediaType: 'tv',
    genres: (item.genres || ['Drama']).map((name, idx) => ({ id: 100 + idx, name }))
  };
}
