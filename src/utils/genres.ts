/**
 * Shared Genre Landing Page Configuration & Slug Utilities for TStream.online
 * Connects Header/Sidebar/Details UI clicks, React client routing, SSR HTML,
 * pre-rendering, sitemaps, and TMDB genre discovery under /genre/:slug.
 */

import { ALL_GENRES } from '../services/catalogData.ts';

export interface GenreLandingMeta {
  id: number;
  name: string;
  slug: string;
  tmdbMovieGenreId?: number;
  tmdbTvGenreId?: number;
  description: string;
}

const GENRE_META_OVERRIDES: Record<number, Omit<GenreLandingMeta, 'id' | 'name'>> = {
  28: {
    slug: 'action',
    tmdbMovieGenreId: 28,
    tmdbTvGenreId: 10759,
    description: 'Watch high-octane action movies and adrenaline-fueled series free in HD and 4K on T Stream.'
  },
  12: {
    slug: 'adventure',
    tmdbMovieGenreId: 12,
    tmdbTvGenreId: 10759,
    description: 'Stream epic adventure films, treasure quests, and expedition series online in Full HD on T Stream.'
  },
  16: {
    slug: 'animation',
    tmdbMovieGenreId: 16,
    tmdbTvGenreId: 16,
    description: 'Discover animated feature films, anime classics, and acclaimed animated TV series on T Stream.'
  },
  35: {
    slug: 'comedy',
    tmdbMovieGenreId: 35,
    tmdbTvGenreId: 35,
    description: 'Watch top-rated comedy movies, sitcoms, and laugh-out-loud television series in HD on T Stream.'
  },
  80: {
    slug: 'crime',
    tmdbMovieGenreId: 80,
    tmdbTvGenreId: 80,
    description: 'Stream gritty crime thrillers, detective dramas, and heist films free online in HD on T Stream.'
  },
  99: {
    slug: 'documentary',
    tmdbMovieGenreId: 99,
    tmdbTvGenreId: 99,
    description: 'Explore acclaimed true-story documentaries and investigative docuseries in HD on T Stream.'
  },
  18: {
    slug: 'drama',
    tmdbMovieGenreId: 18,
    tmdbTvGenreId: 18,
    description: 'Stream award-winning drama films and gripping television series free in 4K and 1080p HD on T Stream.'
  },
  10751: {
    slug: 'family',
    tmdbMovieGenreId: 10751,
    tmdbTvGenreId: 10751,
    description: 'Watch family-friendly movies and all-ages television adventures free in HD on T Stream.'
  },
  14: {
    slug: 'fantasy',
    tmdbMovieGenreId: 14,
    tmdbTvGenreId: 10765,
    description: 'Enter magical fantasy worlds, mythical sagas, and supernatural series in HD on T Stream.'
  },
  36: {
    slug: 'history',
    tmdbMovieGenreId: 36,
    description: 'Watch sweeping historical epics, period dramas, and historical feature films on T Stream.'
  },
  27: {
    slug: 'horror',
    tmdbMovieGenreId: 27,
    tmdbTvGenreId: 9648,
    description: 'Stream chilling horror films, supernatural thrillers, and suspenseful series in HD on T Stream.'
  },
  10402: {
    slug: 'music',
    tmdbMovieGenreId: 10402,
    description: 'Watch acclaimed music biopics, concert films, and musical features online in HD on T Stream.'
  },
  9648: {
    slug: 'mystery',
    tmdbMovieGenreId: 9648,
    tmdbTvGenreId: 9648,
    description: 'Unravel gripping mystery movies, whodunits, and twist-filled detective series on T Stream.'
  },
  10749: {
    slug: 'romance',
    tmdbMovieGenreId: 10749,
    tmdbTvGenreId: 10749,
    description: 'Stream romantic dramas, heartfelt love stories, and romantic comedies free in HD on T Stream.'
  },
  878: {
    slug: 'science-fiction',
    tmdbMovieGenreId: 878,
    tmdbTvGenreId: 10765,
    description: 'Explore visionary science fiction blockbusters and futuristic sci-fi series in 4K and HD on T Stream.'
  },
  10770: {
    slug: 'tv-movie',
    tmdbMovieGenreId: 10770,
    description: 'Watch feature-length television movies and special event films free in HD on T Stream.'
  },
  53: {
    slug: 'thriller',
    tmdbMovieGenreId: 53,
    tmdbTvGenreId: 80,
    description: 'Stream edge-of-your-seat psychological, espionage, and suspense thrillers in HD on T Stream.'
  },
  10752: {
    slug: 'war',
    tmdbMovieGenreId: 10752,
    tmdbTvGenreId: 10768,
    description: 'Watch powerful war dramas, military epics, and historical combat films in HD on T Stream.'
  },
  37: {
    slug: 'western',
    tmdbMovieGenreId: 37,
    tmdbTvGenreId: 37,
    description: 'Stream frontier western classics and modern neo-western series free in HD on T Stream.'
  },
  10759: {
    slug: 'action-adventure',
    tmdbMovieGenreId: 28,
    tmdbTvGenreId: 10759,
    description: 'Watch action and adventure television series and blockbuster journeys free on T Stream.'
  },
  10765: {
    slug: 'sci-fi-fantasy',
    tmdbMovieGenreId: 878,
    tmdbTvGenreId: 10765,
    description: 'Stream acclaimed sci-fi and fantasy television series and speculative worlds on T Stream.'
  }
};

export const PRIMARY_GENRE_SLUGS = [
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'drama',
  'fantasy',
  'horror',
  'mystery',
  'romance',
  'science-fiction',
  'thriller'
] as const;

export function rawGenreNameToSlug(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const GENRE_LANDINGS: GenreLandingMeta[] = ALL_GENRES.map(g => {
  const override = GENRE_META_OVERRIDES[g.id];
  return {
    id: g.id,
    name: g.name,
    slug: override?.slug || rawGenreNameToSlug(g.name),
    tmdbMovieGenreId: override?.tmdbMovieGenreId ?? g.id,
    tmdbTvGenreId: override?.tmdbTvGenreId,
    description: override?.description || `Watch the best ${g.name} movies and TV shows free in HD on T Stream.`
  };
});

const SLUG_TO_GENRE_MAP = new Map<string, GenreLandingMeta>();
const ID_TO_GENRE_MAP = new Map<number, GenreLandingMeta>();

for (const genre of GENRE_LANDINGS) {
  SLUG_TO_GENRE_MAP.set(genre.slug, genre);
  ID_TO_GENRE_MAP.set(genre.id, genre);
}

// Safe canonical slug lookup aliases
SLUG_TO_GENRE_MAP.set('sci-fi', SLUG_TO_GENRE_MAP.get('science-fiction')!);

export function genreToSlug(genreIdOrName: number | string): string {
  if (typeof genreIdOrName === 'number') {
    return ID_TO_GENRE_MAP.get(genreIdOrName)?.slug || '';
  }
  const clean = rawGenreNameToSlug(genreIdOrName);
  const bySlug = SLUG_TO_GENRE_MAP.get(clean);
  if (bySlug) return bySlug.slug;
  const byName = GENRE_LANDINGS.find(g => g.name.toLowerCase() === genreIdOrName.toLowerCase().trim());
  return byName ? byName.slug : clean;
}

export function slugToGenre(rawSlug: string): GenreLandingMeta | undefined {
  if (!rawSlug) return undefined;
  let clean = rawSlug.trim().toLowerCase();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    return undefined;
  }
  clean = clean.replace(/^\/+|\/+$/g, '');
  if (!clean || !/^[a-z0-9-]+$/.test(clean)) return undefined;
  return SLUG_TO_GENRE_MAP.get(clean);
}

export function getGenreById(genreId: number): GenreLandingMeta | undefined {
  return ID_TO_GENRE_MAP.get(genreId);
}

export function getCanonicalGenreUrl(slug: string, page?: number): string {
  const genre = slugToGenre(slug);
  const canonicalSlug = genre ? genre.slug : rawGenreNameToSlug(slug);
  const base = canonicalSlug ? `https://tstream.online/genre/${canonicalSlug}` : 'https://tstream.online/movies';
  if (page && Number.isInteger(page) && page > 1) {
    return `${base}?page=${page}`;
  }
  return base;
}

export function itemMatchesGenre(item: any, genre: GenreLandingMeta): boolean {
  if (!item || !genre) return false;
  const targetIds = new Set<number>([genre.id]);
  if (genre.tmdbMovieGenreId) targetIds.add(genre.tmdbMovieGenreId);
  if (genre.tmdbTvGenreId) targetIds.add(genre.tmdbTvGenreId);
  const targetName = genre.name.toLowerCase();

  if (Array.isArray(item.genres)) {
    for (const g of item.genres) {
      if (typeof g === 'number' && targetIds.has(g)) return true;
      if (typeof g === 'string' && g.toLowerCase().trim() === targetName) return true;
      if (g && typeof g === 'object') {
        if (typeof g.id === 'number' && targetIds.has(g.id)) return true;
        if (typeof g.name === 'string' && g.name.toLowerCase().trim() === targetName) return true;
      }
    }
  }
  if (Array.isArray(item.genre_ids)) {
    for (const id of item.genre_ids) {
      if (targetIds.has(Number(id))) return true;
    }
  }
  return false;
}
