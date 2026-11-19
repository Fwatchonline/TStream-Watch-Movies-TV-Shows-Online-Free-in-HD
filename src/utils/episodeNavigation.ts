import { Episode, Season } from '../types/media';

export interface EpisodeNavTarget {
  season: number;
  episode: number;
  episodeName?: string;
  isSeasonTransition: boolean;
}

export interface AdjacentEpisodeResult {
  hasNext: boolean;
  hasPrev: boolean;
  next: EpisodeNavTarget | null;
  prev: EpisodeNavTarget | null;
}

function getSeasonEpisodeNumbers(
  seasonNumber: number,
  seasonsList: Season[] | undefined,
  loadedSeasonsMap: Record<number, Episode[]> | undefined
): number[] {
  const loaded = loadedSeasonsMap?.[seasonNumber];
  if (loaded && loaded.length > 0) {
    return Array.from(
      new Set(
        loaded
          .map((e) => e.episodeNumber)
          .filter((n) => typeof n === 'number' && n > 0)
      )
    ).sort((a, b) => a - b);
  }

  const seasonObj = seasonsList?.find((s) => s.seasonNumber === seasonNumber);
  if (seasonObj?.episodes && seasonObj.episodes.length > 0) {
    return Array.from(
      new Set(
        seasonObj.episodes
          .map((e) => e.episodeNumber)
          .filter((n) => typeof n === 'number' && n > 0)
      )
    ).sort((a, b) => a - b);
  }

  if (seasonObj?.episodeCount && seasonObj.episodeCount > 0) {
    return Array.from({ length: seasonObj.episodeCount }, (_, i) => i + 1);
  }

  return [];
}

function findEpisodeTitle(
  seasonNumber: number,
  episodeNumber: number,
  seasonsList: Season[] | undefined,
  loadedSeasonsMap: Record<number, Episode[]> | undefined
): string | undefined {
  const loaded = loadedSeasonsMap?.[seasonNumber];
  const fromLoaded = loaded?.find((e) => e.episodeNumber === episodeNumber);
  if (fromLoaded?.name) return fromLoaded.name;

  const seasonObj = seasonsList?.find((s) => s.seasonNumber === seasonNumber);
  const fromSeason = seasonObj?.episodes?.find((e) => e.episodeNumber === episodeNumber);
  return fromSeason?.name;
}

/**
 * Resolves exact adjacent episode targets (previous and next, including cross-season transitions)
 * from genuine loaded episodes or verified TMDB/AniList season metadata.
 * NEVER fabricates an assumed season episode count (like 8 or 10).
 */
export function resolveAdjacentEpisodes(params: {
  isMovie: boolean;
  currentSeason: number;
  currentEpisode: number;
  seasonsList?: Season[];
  loadedSeasonsMap?: Record<number, Episode[]>;
}): AdjacentEpisodeResult {
  if (params.isMovie) {
    return { hasNext: false, hasPrev: false, next: null, prev: null };
  }

  const { currentSeason, currentEpisode, seasonsList, loadedSeasonsMap } = params;

  // Determine ordered regular seasons (exclude Specials season 0 unless currently watching season 0)
  const regularSeasons = (seasonsList || [])
    .filter((s) => s.seasonNumber > 0 && ((s.episodeCount ?? 0) > 0 || (s.episodes?.length ?? 0) > 0 || (loadedSeasonsMap?.[s.seasonNumber]?.length ?? 0) > 0))
    .map((s) => s.seasonNumber)
    .sort((a, b) => a - b);

  if (currentSeason > 0 && !regularSeasons.includes(currentSeason)) {
    const currentLoaded = loadedSeasonsMap?.[currentSeason];
    if (currentLoaded && currentLoaded.length > 0) {
      regularSeasons.push(currentSeason);
      regularSeasons.sort((a, b) => a - b);
    }
  }

  const currentSeasonEpNums = getSeasonEpisodeNumbers(currentSeason, seasonsList, loadedSeasonsMap);

  // Resolve Next Episode
  let next: EpisodeNavTarget | null = null;
  const idxInSeason = currentSeasonEpNums.indexOf(currentEpisode);

  if (idxInSeason >= 0 && idxInSeason + 1 < currentSeasonEpNums.length) {
    const nextEp = currentSeasonEpNums[idxInSeason + 1];
    next = {
      season: currentSeason,
      episode: nextEp,
      episodeName: findEpisodeTitle(currentSeason, nextEp, seasonsList, loadedSeasonsMap),
      isSeasonTransition: false
    };
  } else if (currentSeasonEpNums.length > 0 && currentEpisode < currentSeasonEpNums[currentSeasonEpNums.length - 1]) {
    const higher = currentSeasonEpNums.find((n) => n > currentEpisode);
    if (higher !== undefined) {
      next = {
        season: currentSeason,
        episode: higher,
        episodeName: findEpisodeTitle(currentSeason, higher, seasonsList, loadedSeasonsMap),
        isSeasonTransition: false
      };
    }
  }

  // If at the end of current season, check next season (> 0)
  if (!next && currentSeason > 0) {
    const nextSeasonNum = regularSeasons.find((s) => s > currentSeason);
    if (nextSeasonNum !== undefined) {
      const nextSeasonEps = getSeasonEpisodeNumbers(nextSeasonNum, seasonsList, loadedSeasonsMap);
      const firstEp = nextSeasonEps[0] ?? 1;
      next = {
        season: nextSeasonNum,
        episode: firstEp,
        episodeName: findEpisodeTitle(nextSeasonNum, firstEp, seasonsList, loadedSeasonsMap),
        isSeasonTransition: true
      };
    }
  }

  // Resolve Previous Episode
  let prev: EpisodeNavTarget | null = null;
  if (idxInSeason > 0) {
    const prevEp = currentSeasonEpNums[idxInSeason - 1];
    prev = {
      season: currentSeason,
      episode: prevEp,
      episodeName: findEpisodeTitle(currentSeason, prevEp, seasonsList, loadedSeasonsMap),
      isSeasonTransition: false
    };
  } else if (currentEpisode > (currentSeasonEpNums[0] ?? 1)) {
    const lower = [...currentSeasonEpNums].reverse().find((n) => n < currentEpisode);
    if (lower !== undefined) {
      prev = {
        season: currentSeason,
        episode: lower,
        episodeName: findEpisodeTitle(currentSeason, lower, seasonsList, loadedSeasonsMap),
        isSeasonTransition: false
      };
    }
  } else if (currentSeason > 1) {
    const prevSeasonNum = [...regularSeasons].reverse().find((s) => s < currentSeason && s > 0);
    if (prevSeasonNum !== undefined) {
      const prevSeasonEps = getSeasonEpisodeNumbers(prevSeasonNum, seasonsList, loadedSeasonsMap);
      const lastEp = prevSeasonEps[prevSeasonEps.length - 1];
      if (lastEp !== undefined) {
        prev = {
          season: prevSeasonNum,
          episode: lastEp,
          episodeName: findEpisodeTitle(prevSeasonNum, lastEp, seasonsList, loadedSeasonsMap),
          isSeasonTransition: true
        };
      }
    }
  }

  return {
    hasNext: next !== null,
    hasPrev: prev !== null,
    next,
    prev
  };
}

export interface NormalizedAudioTrack {
  id: number;
  code: string;
  languageName: string;
  displayName: string;
  isDefault: boolean;
}

const ISO_AUDIO_MAP: Record<string, { code: string; name: string }> = {
  ja: { code: 'ja', name: 'Japanese' },
  jpn: { code: 'ja', name: 'Japanese' },
  japanese: { code: 'ja', name: 'Japanese' },
  en: { code: 'en', name: 'English' },
  eng: { code: 'en', name: 'English' },
  english: { code: 'en', name: 'English' },
  de: { code: 'de', name: 'German' },
  deu: { code: 'de', name: 'German' },
  ger: { code: 'de', name: 'German' },
  german: { code: 'de', name: 'German' },
  fr: { code: 'fr', name: 'French' },
  fra: { code: 'fr', name: 'French' },
  fre: { code: 'fr', name: 'French' },
  french: { code: 'fr', name: 'French' },
  es: { code: 'es', name: 'Spanish' },
  spa: { code: 'es', name: 'Spanish' },
  spanish: { code: 'es', name: 'Spanish' },
  pt: { code: 'pt', name: 'Portuguese' },
  por: { code: 'pt', name: 'Portuguese' },
  portuguese: { code: 'pt', name: 'Portuguese' },
  it: { code: 'it', name: 'Italian' },
  ita: { code: 'it', name: 'Italian' },
  italian: { code: 'it', name: 'Italian' },
  ru: { code: 'ru', name: 'Russian' },
  rus: { code: 'ru', name: 'Russian' },
  russian: { code: 'ru', name: 'Russian' },
  sr: { code: 'sr', name: 'Serbian' },
  srp: { code: 'sr', name: 'Serbian' },
  scc: { code: 'sr', name: 'Serbian' },
  serbian: { code: 'sr', name: 'Serbian' },
  hr: { code: 'hr', name: 'Croatian' },
  hrv: { code: 'hr', name: 'Croatian' },
  scr: { code: 'hr', name: 'Croatian' },
  croatian: { code: 'hr', name: 'Croatian' },
  bs: { code: 'bs', name: 'Bosnian' },
  bos: { code: 'bs', name: 'Bosnian' },
  bosnian: { code: 'bs', name: 'Bosnian' },
  ko: { code: 'ko', name: 'Korean' },
  kor: { code: 'ko', name: 'Korean' },
  korean: { code: 'ko', name: 'Korean' },
  zh: { code: 'zh', name: 'Chinese' },
  zho: { code: 'zh', name: 'Chinese' },
  chi: { code: 'zh', name: 'Chinese' },
  ar: { code: 'ar', name: 'Arabic' },
  ara: { code: 'ar', name: 'Arabic' },
  hi: { code: 'hi', name: 'Hindi' },
  hin: { code: 'hi', name: 'Hindi' },
  tr: { code: 'tr', name: 'Turkish' },
  tur: { code: 'tr', name: 'Turkish' }
};

export function normalizeIsoAudioCode(rawLang?: string | null, rawName?: string | null): { code: string; languageName: string } {
  const candidates = [String(rawLang || '').trim().toLowerCase(), String(rawName || '').trim().toLowerCase()];
  for (const cand of candidates) {
    if (!cand) continue;
    const base = cand.split(/[-_\s]/)[0];
    if (ISO_AUDIO_MAP[base]) {
      return { code: ISO_AUDIO_MAP[base].code, languageName: ISO_AUDIO_MAP[base].name };
    }
    for (const [k, v] of Object.entries(ISO_AUDIO_MAP)) {
      if (k.length >= 4 && cand.includes(k)) {
        return { code: v.code, languageName: v.name };
      }
    }
  }
  const fallbackName = String(rawName || rawLang || '').trim();
  const fallbackCode = String(rawLang || 'und').trim().toLowerCase().slice(0, 3) || 'und';
  return {
    code: fallbackCode,
    languageName: fallbackName || 'Original Audio'
  };
}

export function normalizeHlsAudioTracks(
  rawTracks: Array<{ id?: number; lang?: string; name?: string; default?: boolean }>
): NormalizedAudioTrack[] {
  return rawTracks.map((t, idx) => {
    const id = typeof t.id === 'number' ? t.id : idx;
    const { code, languageName } = normalizeIsoAudioCode(t.lang, t.name);
    const trackTitle = t.name && t.name.toLowerCase() !== languageName.toLowerCase() && t.name.toLowerCase() !== code
      ? `${languageName} · ${t.name}`
      : t.default
      ? `${languageName} — Original`
      : languageName;
    return {
      id,
      code,
      languageName,
      displayName: trackTitle,
      isDefault: Boolean(t.default || idx === 0)
    };
  });
}
