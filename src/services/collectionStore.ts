import { CollectionSummary, MediaItem } from '../types/media';
import { getTmdbApiKey, normalizeTMDBItem, TMDB_BASE_URL } from './tmdb';
import {
  SPIDERMAN_COLLECTION,
  HARRY_POTTER_COLLECTION,
  AVENGERS_COLLECTION,
  PIRATES_COLLECTION
} from './catalogData';
import {
  EXPANDED_CURATED_COLLECTIONS,
  EXTRA_VERIFIED_IMAGES
} from './curatedCollections';

export interface DiscoveredCollection extends CollectionSummary {
  filmCountBadge: string;
  autoDiscovered?: boolean;
  discoveredAt?: string;
  sourceMovieTitle?: string;
}

const STORAGE_KEY = 'tstream_collections';

export const AVATAR_COLLECTION: DiscoveredCollection = {
  id: 87096,
  name: 'Avatar Collection',
  posterPath: 'https://image.tmdb.org/t/p/w500/3C5brXxnBxfkeKWwA1Fh4xvy4wr.jpg',
  backdropPath: 'https://image.tmdb.org/t/p/original/4uwX70EzaWVcGUXMtXPoexlNAff.jpg',
  overview: 'The Avatar Collection tells the story of the world of Pandora, inhabited by the indigenous Na\'vi, and the human conflict to harvest unobtanium and settle the alien biosphere.',
  filmCountBadge: '3 FILMS',
  autoDiscovered: true,
  parts: [
    {
      id: 19995,
      tmdbId: 19995,
      imdbId: 'tt0499549',
      title: 'Avatar',
      overview: 'In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission, but becomes torn between following orders and protecting an alien civilization.',
      posterPath: 'https://image.tmdb.org/t/p/w500/gKY6q7SjCkAU6FqvqWybDYgUKIF.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/vL5LR6WdxWPjLPFRLe133jXWsh5.jpg',
      releaseDate: '2009-12-16',
      voteAverage: 7.6,
      voteCount: 31200,
      popularity: 145.2,
      genres: [{ id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 14, name: 'Fantasy' }, { id: 878, name: 'Science Fiction' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 162
    },
    {
      id: 76600,
      tmdbId: 76600,
      imdbId: 'tt1630029',
      title: 'Avatar: The Way of Water',
      overview: 'Set more than a decade after the events of the first film, Jake Sully and Neytiri have formed a family and are doing everything to stay together while exploring the oceanic regions of Pandora.',
      posterPath: 'https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/kJsPVzdyBrYHLomuNv5SJDXUQ2f.jpg',
      releaseDate: '2022-12-14',
      voteAverage: 7.6,
      voteCount: 11800,
      popularity: 180.5,
      genres: [{ id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }, { id: 28, name: 'Action' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 192
    },
    {
      id: 83533,
      tmdbId: 83533,
      imdbId: 'tt1757678',
      title: 'Avatar: Fire and Ash',
      overview: 'The third chapter explores the fierce Ash People, a fire-based Na\'vi tribe, revealing a darker, more conflicted side of Pandora.',
      posterPath: 'https://image.tmdb.org/t/p/w500/bRBeSHfGHwkEpImlhxPmOcUsaeg.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/u8DU5fkLoM5tTRukzPC31oGPxaQ.jpg',
      releaseDate: '2025-12-17',
      voteAverage: 7.8,
      voteCount: 450,
      popularity: 210.3,
      genres: [{ id: 878, name: 'Science Fiction' }, { id: 12, name: 'Adventure' }, { id: 28, name: 'Action' }],
      mediaType: 'movie',
      certification: 'PG-13',
      runtime: 180
    }
  ]
};

export const FAST_AND_FURIOUS_COLLECTION: DiscoveredCollection = {
  id: 9485,
  name: 'The Fast and the Furious Collection',
  posterPath: 'https://image.tmdb.org/t/p/w500/zOCnMPoUxgJK1RFPfN4PcnT16gr.jpg',
  backdropPath: 'https://image.tmdb.org/t/p/original/z5A5W3WYJc3UVEWljSGwdjDgQ0j.jpg',
  overview: 'The global blockbuster franchise centered on Dominic Toretto, Brian O\'Conner, family, nitro-boosted heist racing, and high-octane international covert missions.',
  filmCountBadge: '11 FILMS',
  autoDiscovered: true,
  parts: [
    {
      id: 9799,
      tmdbId: 9799,
      imdbId: 'tt0232500',
      title: 'The Fast and the Furious',
      overview: 'Dominic Toretto is a Los Angeles street racer suspected of masterminding a series of big-rig hijackings. When undercover cop Brian O\'Conner infiltrates Toretto\'s icon crew, he falls for Dom\'s sister Mia.',
      posterPath: 'https://image.tmdb.org/t/p/w500/gqY0ITBgT7A82poL9jv851qdnIb.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/jY9ef5nqY4xIIMu3yzW3qamUCoi.jpg',
      releaseDate: '2001-06-22',
      voteAverage: 7.0,
      voteCount: 10400,
      popularity: 95.2,
      genres: [{ id: 28, name: 'Action' }, { id: 80, name: 'Crime' }, { id: 53, name: 'Thriller' }],
      mediaType: 'movie'
    },
    {
      id: 584,
      tmdbId: 584,
      imdbId: 'tt0322259',
      title: '2 Fast 2 Furious',
      overview: 'It\'s a major double-cross when former police officer Brian O\'Conner teams up with ex-con Roman Pearce to transport a shipment of "dirty" money for shady Miami-based import-export dealer Carter Verone.',
      posterPath: 'https://image.tmdb.org/t/p/w500/6nDZExrDKIXvSAghsFKVFRVJuSf.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/90ooE5SbUEO0OVJHewNO7pgySb6.jpg',
      releaseDate: '2003-06-05',
      voteAverage: 6.5,
      voteCount: 7800,
      popularity: 88.4,
      genres: [{ id: 28, name: 'Action' }, { id: 80, name: 'Crime' }],
      mediaType: 'movie'
    },
    {
      id: 9615,
      tmdbId: 9615,
      imdbId: 'tt0463985',
      title: 'The Fast and the Furious: Tokyo Drift',
      overview: 'In order to avoid a jail sentence, Sean Boswell heads to Tokyo to live with his military father. In a labyrinth of underground drift racing, he learns the real art of high speed.',
      posterPath: 'https://image.tmdb.org/t/p/w500/46xqGOwHbh2TH2avWSw3SMXph4E.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/dMARcKLrv0T7kVJ4iQR3vqTTdtT.jpg',
      releaseDate: '2006-06-03',
      voteAverage: 6.6,
      voteCount: 7100,
      popularity: 82.1,
      genres: [{ id: 28, name: 'Action' }, { id: 80, name: 'Crime' }],
      mediaType: 'movie'
    },
    {
      id: 51497,
      tmdbId: 51497,
      imdbId: 'tt1596343',
      title: 'Fast Five',
      overview: 'Former cop Brian O\'Conner partners with ex-con Dom Toretto on the opposite side of the law in Rio de Janeiro, Brazil. There, they are hunted by a US Diplomatic Security Service agent.',
      posterPath: 'https://image.tmdb.org/t/p/w500/gEfQjjQwY7fh5bI4GlG0RrBu7Pz.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/tQN9JEQ4N4aqej7O6AkQtt0dLpt.jpg',
      releaseDate: '2011-04-20',
      voteAverage: 7.2,
      voteCount: 8900,
      popularity: 110.3,
      genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }, { id: 80, name: 'Crime' }],
      mediaType: 'movie'
    },
    {
      id: 82992,
      tmdbId: 82992,
      imdbId: 'tt1905041',
      title: 'Fast & Furious 6',
      overview: 'Hobbs has Dom and Brian reassemble their crew in order to take down an elite mastermind organization of mercenary drivers led by Owen Shaw, assisted by Letty Ortiz, whom Dom thought was dead.',
      posterPath: 'https://image.tmdb.org/t/p/w500/thSmnRdrzPBBospIOJjLZBReqzo.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/xDp29MSWa7O3ROC13r6dPTFnREJ.jpg',
      releaseDate: '2013-05-21',
      voteAverage: 6.8,
      voteCount: 8600,
      popularity: 104.2,
      genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }],
      mediaType: 'movie'
    },
    {
      id: 168259,
      tmdbId: 168259,
      imdbId: 'tt2820852',
      title: 'Furious 7',
      overview: 'Deckard Shaw seeks revenge against Dominic Toretto and his family for his comatose brother, while a team of clandestine government agents attempts to recover the God\'s Eye software.',
      posterPath: 'https://image.tmdb.org/t/p/w500/wurKlC3VKUgcfsn0K51MJYEleS2.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/ehzI1mVcnHqB58NqPyQwpMqcVoz.jpg',
      releaseDate: '2015-04-01',
      voteAverage: 7.2,
      voteCount: 10800,
      popularity: 125.0,
      genres: [{ id: 28, name: 'Action' }, { id: 53, name: 'Thriller' }],
      mediaType: 'movie'
    },
    {
      id: 385687,
      tmdbId: 385687,
      imdbId: 'tt5433140',
      title: 'Fast X',
      overview: 'Over many missions and against impossible odds, Dom Toretto and his family have outsmarted every enemy. Now, they confront the most lethal opponent they\'ve ever faced: Dante Reyes, seeking vengeance for his father\'s death.',
      posterPath: 'https://image.tmdb.org/t/p/w500/fiVW06jE7z9YnO4trhaMEdclSiC.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/original/4XM8DUTQb3lhLemJC51Jx4a2EuA.jpg',
      releaseDate: '2023-05-17',
      voteAverage: 7.1,
      voteCount: 5200,
      popularity: 165.8,
      genres: [{ id: 28, name: 'Action' }, { id: 80, name: 'Crime' }, { id: 53, name: 'Thriller' }],
      mediaType: 'movie'
    }
  ]
};

export const VERIFIED_COLLECTION_IMAGES: Record<number, { backdrop: string; poster: string }> = {
  295: {
    backdrop: 'https://image.tmdb.org/t/p/original/wxgD3fB5lQ2sGJLog0rvXW049Pf.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/zRBaZxS5YauLvRYjAdL4AUCwlht.jpg'
  },
  531241: {
    backdrop: 'https://image.tmdb.org/t/p/original/AvnqpRwlEaYNVL6wzC4RN94EdSd.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/yeba3Y820OjApZO9aJevDsNeMEd.jpg'
  },
  1241: {
    backdrop: 'https://image.tmdb.org/t/p/original/4gV0rKUjB1nLUdZB4zIltLvNZZr.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/eVPs2Y0LyvTLZn6AP5Z6O2rtiGB.jpg'
  },
  87096: {
    backdrop: 'https://image.tmdb.org/t/p/original/4uwX70EzaWVcGUXMtXPoexlNAff.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/3C5brXxnBxfkeKWwA1Fh4xvy4wr.jpg'
  },
  9485: {
    backdrop: 'https://image.tmdb.org/t/p/original/z5A5W3WYJc3UVEWljSGwdjDgQ0j.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/zOCnMPoUxgJK1RFPfN4PcnT16gr.jpg'
  },
  86311: {
    backdrop: 'https://image.tmdb.org/t/p/original/2UNUv4NJdC36E5myDHACBJ99EwL.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/yFSIUVTCvgYrpalUktulvk3Gi5Y.jpg'
  },
  ...EXTRA_VERIFIED_IMAGES
};

export const PIRATES_FULL_COLLECTION: DiscoveredCollection = {
  ...PIRATES_COLLECTION,
  backdropPath: VERIFIED_COLLECTION_IMAGES[295].backdrop,
  posterPath: VERIFIED_COLLECTION_IMAGES[295].poster,
  filmCountBadge: '5 FILMS',
  autoDiscovered: true
};

export const INITIAL_CURATED_COLLECTIONS: DiscoveredCollection[] = [
  PIRATES_FULL_COLLECTION,
  AVATAR_COLLECTION,
  FAST_AND_FURIOUS_COLLECTION,
  {
    ...SPIDERMAN_COLLECTION,
    backdropPath: VERIFIED_COLLECTION_IMAGES[531241].backdrop,
    posterPath: VERIFIED_COLLECTION_IMAGES[531241].poster,
    filmCountBadge: '4 FILMS',
    autoDiscovered: true
  },
  {
    ...HARRY_POTTER_COLLECTION,
    backdropPath: VERIFIED_COLLECTION_IMAGES[1241].backdrop,
    posterPath: VERIFIED_COLLECTION_IMAGES[1241].poster,
    filmCountBadge: '8 FILMS',
    autoDiscovered: true
  },
  {
    ...AVENGERS_COLLECTION,
    backdropPath: VERIFIED_COLLECTION_IMAGES[86311].backdrop,
    posterPath: VERIFIED_COLLECTION_IMAGES[86311].poster,
    filmCountBadge: '6 FILMS',
    autoDiscovered: true
  },
  ...EXPANDED_CURATED_COLLECTIONS
];

export function sanitizeCollectionImages(col: DiscoveredCollection): DiscoveredCollection {
  const verified = VERIFIED_COLLECTION_IMAGES[col.id];
  let backdrop = col.backdropPath;
  let poster = col.posterPath;

  if (verified) {
    backdrop = verified.backdrop;
    poster = verified.poster;
  } else {
    const isCorrupt = (url?: string | null) =>
      !url || url.includes('undefined') || url.includes('null') || url.includes('71tq7340g0b503798a') || url.includes('tLScZr5hx1a2btI1j2d70882e9e');

    if (isCorrupt(backdrop)) {
      backdrop = col.parts?.[0]?.backdropPath || col.parts?.[0]?.posterPath || poster;
    }
    if (isCorrupt(poster)) {
      poster = col.parts?.[0]?.posterPath || backdrop;
    }
  }

  return {
    ...col,
    backdropPath: backdrop,
    posterPath: poster
  };
}

// Helper to broadcast collection updates
function emitCollectionEvent(type: 'created' | 'updated', collection: DiscoveredCollection) {
  window.dispatchEvent(
    new CustomEvent('tstream:collection_discovered', {
      detail: { type, collection }
    })
  );
}

/**
 * Returns all collections: seeded franchises + dynamically auto-created collections from viewed movies
 */
export function getDiscoveredCollections(): DiscoveredCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored: DiscoveredCollection[] = raw ? JSON.parse(raw) : [];

    const map = new Map<number, DiscoveredCollection>();
    INITIAL_CURATED_COLLECTIONS.forEach(c => map.set(c.id, sanitizeCollectionImages(c)));
    stored.forEach(c => {
      const existing = map.get(c.id);
      map.set(c.id, sanitizeCollectionImages({ ...(existing || {}), ...c } as DiscoveredCollection));
    });

    const result = Array.from(map.values()).map(sanitizeCollectionImages);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch {
      // ignore
    }
    return result;
  } catch {
    return INITIAL_CURATED_COLLECTIONS.map(sanitizeCollectionImages);
  }
}

/**
 * Registers / persists a collection in local storage and broadcasts to UI
 */
export function saveDiscoveredCollection(
  col: CollectionSummary,
  sourceMovieTitle?: string
): { isNew: boolean; collection: DiscoveredCollection } {
  try {
    const current = getDiscoveredCollections();
    const existingIndex = current.findIndex(c => c.id === col.id);
    const partsCount = col.parts ? col.parts.length : 1;
    const badge = `${partsCount} ${partsCount === 1 ? 'FILM' : 'FILMS'}`;

    const enriched: DiscoveredCollection = {
      ...col,
      filmCountBadge: badge,
      autoDiscovered: true,
      discoveredAt: new Date().toISOString(),
      sourceMovieTitle: sourceMovieTitle || col.name
    };

    let updated: DiscoveredCollection[];
    let isNew = false;

    if (existingIndex >= 0) {
      // Merge parts
      const existing = current[existingIndex];
      const mergedParts = Array.from(
        new Map([...(existing.parts || []), ...(col.parts || [])].map(p => [p.id, p])).values()
      );
      enriched.parts = mergedParts;
      enriched.filmCountBadge = `${mergedParts.length} FILMS`;
      updated = [...current];
      updated[existingIndex] = enriched;
    } else {
      isNew = true;
      updated = [enriched, ...current];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    emitCollectionEvent(isNew ? 'created' : 'updated', enriched);
    return { isNew, collection: enriched };
  } catch (err) {
    console.warn('Failed to save discovered collection:', err);
    return {
      isNew: false,
      collection: { ...col, filmCountBadge: `${col.parts?.length || 1} FILMS` }
    };
  }
}

/**
 * Automatically discovers, builds, and saves franchise collection when a user opens a movie
 */
export async function autoDiscoverMovieFranchise(movie: {
  id: number;
  title: string;
  belongsToCollection?: any;
}): Promise<DiscoveredCollection | null> {
  const apiKey = getTmdbApiKey();

  // 1. If the movie already has belongs_to_collection with parts
  if (movie.belongsToCollection && movie.belongsToCollection.id) {
    const colId = movie.belongsToCollection.id;
    let parts = movie.belongsToCollection.parts || [];

    if (!parts || parts.length <= 1) {
      try {
        const res = await fetch(`${TMDB_BASE_URL}/collection/${colId}?api_key=${apiKey}`);
        if (res.ok) {
          const raw = await res.json();
          parts = (raw.parts || []).map((p: any) => normalizeTMDBItem(p, 'movies'));
          movie.belongsToCollection.parts = parts;
          movie.belongsToCollection.overview = raw.overview || movie.belongsToCollection.overview;
          if (raw.backdrop_path) {
            movie.belongsToCollection.backdropPath = `https://image.tmdb.org/t/p/original${raw.backdrop_path}`;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch full parts for collection:', err);
      }
    }

    const { collection } = saveDiscoveredCollection(
      {
        id: colId,
        name: movie.belongsToCollection.name,
        overview: movie.belongsToCollection.overview || `Official film franchise collection for ${movie.title}.`,
        posterPath: movie.belongsToCollection.posterPath,
        backdropPath: movie.belongsToCollection.backdropPath,
        parts
      },
      movie.title
    );
    return collection;
  }

  // 2. Fallback: Search collection if title matches major franchises (e.g. Pirates, Avatar, Fast, Harry Potter, etc.)
  try {
    // Strip sequels subtitle e.g. "Pirates of the Caribbean: At World's End" -> "Pirates of the Caribbean"
    const cleanedTitle = movie.title.split(/[:–—\-]/)[0].trim();
    const query = cleanedTitle.length >= 3 ? cleanedTitle : movie.title;

    const searchRes = await fetch(
      `${TMDB_BASE_URL}/search/collection?api_key=${apiKey}&query=${encodeURIComponent(query)}`
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const firstMatch = searchData.results?.[0];

      if (firstMatch && firstMatch.id) {
        // Fetch full collection details
        const colRes = await fetch(`${TMDB_BASE_URL}/collection/${firstMatch.id}?api_key=${apiKey}`);
        if (colRes.ok) {
          const colData = await colRes.json();
          const parts = (colData.parts || []).map((p: any) => normalizeTMDBItem(p, 'movies'));

          const { collection } = saveDiscoveredCollection(
            {
              id: colData.id,
              name: colData.name,
              overview: colData.overview || `All films from the ${colData.name} cinematic series.`,
              posterPath: colData.poster_path ? `https://image.tmdb.org/t/p/w500${colData.poster_path}` : null,
              backdropPath: colData.backdrop_path ? `https://image.tmdb.org/t/p/original${colData.backdrop_path}` : null,
              parts
            },
            movie.title
          );
          return collection;
        }
      }
    }
  } catch (err) {
    console.warn('Auto franchise search failed for:', movie.title, err);
  }

  return null;
}
