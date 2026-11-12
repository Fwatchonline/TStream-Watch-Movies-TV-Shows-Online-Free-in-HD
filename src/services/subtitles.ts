import { SubtitleTrack, MediaType } from '../types/media';
import { TMDB_BASE_URL } from './tmdb';

export interface SubtitleSearchParams {
  mediaType: MediaType;
  tmdbId: number;
  imdbId?: string;
  season?: number;
  episode?: number;
}

/**
 * Comprehensive ISO 639-1 / ISO 639-2 language dictionary
 */
const LANGUAGE_MAP: Record<string, { code: string; label: string }> = {
  // Ex-Yu / BHS
  sr: { code: 'sr', label: 'Serbian' },
  srp: { code: 'sr', label: 'Serbian' },
  srb: { code: 'sr', label: 'Serbian' },
  scc: { code: 'sr', label: 'Serbian' },
  serbian: { code: 'sr', label: 'Serbian' },
  'sr-latn': { code: 'sr', label: 'Serbian (Latin)' },
  hr: { code: 'hr', label: 'Croatian' },
  hrv: { code: 'hr', label: 'Croatian' },
  scr: { code: 'hr', label: 'Croatian' },
  croatian: { code: 'hr', label: 'Croatian' },
  bs: { code: 'bs', label: 'Bosnian' },
  bos: { code: 'bs', label: 'Bosnian' },
  bosnian: { code: 'bs', label: 'Bosnian' },
  bhs: { code: 'sr', label: 'Bosnian / Croatian / Serbian' },
  // Major languages
  en: { code: 'en', label: 'English' },
  eng: { code: 'en', label: 'English' },
  english: { code: 'en', label: 'English' },
  es: { code: 'es', label: 'Spanish' },
  spa: { code: 'es', label: 'Spanish' },
  spanish: { code: 'es', label: 'Spanish' },
  de: { code: 'de', label: 'German' },
  deu: { code: 'de', label: 'German' },
  ger: { code: 'de', label: 'German' },
  german: { code: 'de', label: 'German' },
  fr: { code: 'fr', label: 'French' },
  fra: { code: 'fr', label: 'French' },
  fre: { code: 'fr', label: 'French' },
  french: { code: 'fr', label: 'French' },
  it: { code: 'it', label: 'Italian' },
  ita: { code: 'it', label: 'Italian' },
  italian: { code: 'it', label: 'Italian' },
  pt: { code: 'pt', label: 'Portuguese' },
  por: { code: 'pt', label: 'Portuguese' },
  pob: { code: 'pt', label: 'Portuguese (BR)' },
  ru: { code: 'ru', label: 'Russian' },
  rus: { code: 'ru', label: 'Russian' },
  russian: { code: 'ru', label: 'Russian' },
  tr: { code: 'tr', label: 'Turkish' },
  tur: { code: 'tr', label: 'Turkish' },
  turkish: { code: 'tr', label: 'Turkish' },
  sl: { code: 'sl', label: 'Slovenian' },
  slv: { code: 'sl', label: 'Slovenian' },
  slovenian: { code: 'sl', label: 'Slovenian' },
  mk: { code: 'mk', label: 'Macedonian' },
  mkd: { code: 'mk', label: 'Macedonian' },
  macedonian: { code: 'mk', label: 'Macedonian' },
  sq: { code: 'sq', label: 'Albanian' },
  alb: { code: 'sq', label: 'Albanian' },
  sqi: { code: 'sq', label: 'Albanian' },
  albanian: { code: 'sq', label: 'Albanian' },
  ar: { code: 'ar', label: 'Arabic' },
  ara: { code: 'ar', label: 'Arabic' },
  arabic: { code: 'ar', label: 'Arabic' },
  hi: { code: 'hi', label: 'Hindi' },
  hin: { code: 'hi', label: 'Hindi' },
  hindi: { code: 'hi', label: 'Hindi' },
  id: { code: 'id', label: 'Indonesian' },
  ind: { code: 'id', label: 'Indonesian' },
  indonesian: { code: 'id', label: 'Indonesian' },
  ms: { code: 'ms', label: 'Malay' },
  may: { code: 'ms', label: 'Malay' },
  msa: { code: 'ms', label: 'Malay' },
  malay: { code: 'ms', label: 'Malay' },
  nl: { code: 'nl', label: 'Dutch' },
  dut: { code: 'nl', label: 'Dutch' },
  nld: { code: 'nl', label: 'Dutch' },
  dutch: { code: 'nl', label: 'Dutch' },
  pl: { code: 'pl', label: 'Polish' },
  pol: { code: 'pl', label: 'Polish' },
  polish: { code: 'pl', label: 'Polish' },
  cs: { code: 'cs', label: 'Czech' },
  ces: { code: 'cs', label: 'Czech' },
  cze: { code: 'cs', label: 'Czech' },
  czech: { code: 'cs', label: 'Czech' },
  hu: { code: 'hu', label: 'Hungarian' },
  hun: { code: 'hu', label: 'Hungarian' },
  hungarian: { code: 'hu', label: 'Hungarian' },
  ro: { code: 'ro', label: 'Romanian' },
  ron: { code: 'ro', label: 'Romanian' },
  rum: { code: 'ro', label: 'Romanian' },
  romanian: { code: 'ro', label: 'Romanian' },
  bg: { code: 'bg', label: 'Bulgarian' },
  bul: { code: 'bg', label: 'Bulgarian' },
  bulgarian: { code: 'bg', label: 'Bulgarian' },
  el: { code: 'el', label: 'Greek' },
  ell: { code: 'el', label: 'Greek' },
  gre: { code: 'el', label: 'Greek' },
  greek: { code: 'el', label: 'Greek' },
  sv: { code: 'sv', label: 'Swedish' },
  swe: { code: 'sv', label: 'Swedish' },
  swedish: { code: 'sv', label: 'Swedish' },
  no: { code: 'no', label: 'Norwegian' },
  nor: { code: 'no', label: 'Norwegian' },
  norwegian: { code: 'no', label: 'Norwegian' },
  da: { code: 'da', label: 'Danish' },
  dan: { code: 'da', label: 'Danish' },
  danish: { code: 'da', label: 'Danish' },
  fi: { code: 'fi', label: 'Finnish' },
  fin: { code: 'fi', label: 'Finnish' },
  finnish: { code: 'fi', label: 'Finnish' },
  he: { code: 'he', label: 'Hebrew' },
  heb: { code: 'he', label: 'Hebrew' },
  hebrew: { code: 'he', label: 'Hebrew' },
  ko: { code: 'ko', label: 'Korean' },
  kor: { code: 'ko', label: 'Korean' },
  korean: { code: 'ko', label: 'Korean' },
  zh: { code: 'zh', label: 'Chinese' },
  chi: { code: 'zh', label: 'Chinese' },
  zho: { code: 'zh', label: 'Chinese' },
  chinese: { code: 'zh', label: 'Chinese' },
  ja: { code: 'ja', label: 'Japanese' },
  jpn: { code: 'ja', label: 'Japanese' },
  japanese: { code: 'ja', label: 'Japanese' },
  vi: { code: 'vi', label: 'Vietnamese' },
  vie: { code: 'vi', label: 'Vietnamese' },
  vietnamese: { code: 'vi', label: 'Vietnamese' },
  th: { code: 'th', label: 'Thai' },
  tha: { code: 'th', label: 'Thai' },
  thai: { code: 'th', label: 'Thai' }
};

/**
 * Normalizes multi-dialect and ISO language codes
 */
export function normalizeLanguageCode(code: string): { normalizedCode: string; label: string } {
  const clean = (code || '').toLowerCase().trim();
  if (LANGUAGE_MAP[clean]) {
    return {
      normalizedCode: LANGUAGE_MAP[clean].code,
      label: LANGUAGE_MAP[clean].label
    };
  }

  // Fallback pattern matching
  if (clean.includes('serbian') || clean.includes('srpski')) {
    return { normalizedCode: 'sr', label: 'Serbian' };
  }
  if (clean.includes('croatian') || clean.includes('hrvatski')) {
    return { normalizedCode: 'hr', label: 'Croatian' };
  }
  if (clean.includes('bosnian') || clean.includes('bosanski')) {
    return { normalizedCode: 'bs', label: 'Bosnian' };
  }
  if (clean.includes('english')) {
    return { normalizedCode: 'en', label: 'English' };
  }

  return {
    normalizedCode: clean.slice(0, 2) || 'en',
    label: clean.toUpperCase() || 'Subtitles'
  };
}

/**
 * Retrieves the IMDb ID for a given TMDB media item if not already known
 */
async function resolveImdbId(mediaType: MediaType, tmdbId: number): Promise<string | null> {
  if (!tmdbId || typeof window === 'undefined') return null;
  try {
    const res = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${tmdbId}/external_ids`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.imdb_id || null;
  } catch {
    return null;
  }
}

/**
 * Queries all available subtitle providers:
 * 1. OpenSubtitles v3 Stremio Addon (official Stremio subtitles provider)
 * 2. VDRK Subtitles v1
 * 3. VDRK Subtitles v2
 *
 * Returns every available subtitle track, sorted by regional priority (Ex-Yu / BHS -> English -> Other).
 */
export async function searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleTrack[]> {
  const tmdbId = params.tmdbId;
  if (!tmdbId) return [];

  const isTv = params.mediaType === 'tv';
  const season = params.season || 1;
  const episode = params.episode || 1;

  // Resolve IMDb ID for Stremio OpenSubtitles v3
  let imdbId = params.imdbId;
  if (!imdbId) {
    imdbId = (await resolveImdbId(params.mediaType, tmdbId)) || undefined;
  }

  const tracks: SubtitleTrack[] = [];
  const seenUrls = new Set<string>();

  // Prepare provider endpoints
  const fetchTasks: Promise<void>[] = [];

  // 1. OpenSubtitles v3 Stremio Addon
  if (imdbId) {
    const stremioUrl = isTv
      ? `https://opensubtitles-v3.strem.io/subtitles/series/${imdbId}:${season}:${episode}.json`
      : `https://opensubtitles-v3.strem.io/subtitles/movie/${imdbId}.json`;

    fetchTasks.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(stremioUrl, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
          });
          clearTimeout(timeout);
          if (!res.ok) return;
          const data = await res.json();
          const list = Array.isArray(data?.subtitles) ? data.subtitles : [];

          for (const item of list) {
            const fileUrl = item.url;
            if (!fileUrl || seenUrls.has(fileUrl)) continue;
            seenUrls.add(fileUrl);

            const { normalizedCode, label: langName } = normalizeLanguageCode(item.lang || item.language || 'en');

            // Format descriptive label
            const fpsStr = item.fpsMilli
              ? `${(item.fpsMilli / 1000).toFixed(item.fpsMilli % 1000 === 0 ? 0 : 2)} fps`
              : '';
            const tagParts = [fpsStr, item.releaseGroup, item.releaseFormat].filter(Boolean);
            const tag = tagParts.length > 0 ? ` (${tagParts.join(', ')})` : '';

            tracks.push({
              id: `os_${item.id || tracks.length}_${normalizedCode}`,
              language: langName,
              languageCode: normalizedCode,
              label: `${langName}${tag}`,
              format: fileUrl.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
              url: fileUrl,
              source: 'opensubtitles_v3'
            });
          }
        } catch (err) {
          console.warn('OpenSubtitles Stremio addon fetch error:', err);
        }
      })()
    );
  }

  // 2. VDRK v1 & v2 Subtitles
  const vdrkEndpoints = [
    {
      url: isTv
        ? `https://sub.vdrk.site/v1/tv/${tmdbId}/${season}/${episode}`
        : `https://sub.vdrk.site/v1/movie/${tmdbId}`,
      source: 'vdrk_v1' as const,
      sourceLabel: 'V1'
    },
    {
      url: isTv
        ? `https://sub.vdrk.site/v2/tv/${tmdbId}/${season}/${episode}`
        : `https://sub.vdrk.site/v2/movie/${tmdbId}`,
      source: 'vdrk_v2' as const,
      sourceLabel: 'V2'
    }
  ];

  for (const ep of vdrkEndpoints) {
    fetchTasks.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(ep.url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
          });
          clearTimeout(timeout);
          if (!res.ok) return;
          const data = await res.json();
          if (!Array.isArray(data)) return;

          for (const item of data) {
            const fileUrl = item.file || item.url;
            if (!fileUrl || seenUrls.has(fileUrl)) continue;
            seenUrls.add(fileUrl);

            const rawLabel = item.label || 'Subtitles';
            const { normalizedCode, label: langName } = normalizeLanguageCode(rawLabel);

            tracks.push({
              id: `vdrk_${tracks.length}_${normalizedCode}`,
              language: langName,
              languageCode: normalizedCode,
              label: `${langName}`,
              format: fileUrl.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt',
              url: fileUrl,
              source: ep.source
            });
          }
        } catch (err) {
          console.warn(`VDRK ${ep.sourceLabel} subtitles fetch error:`, err);
        }
      })()
    );
  }

  // Wait for all providers concurrently
  await Promise.allSettled(fetchTasks);

  // Sort: Serbian, Croatian, Bosnian first, then English, then other languages alphabetically
  tracks.sort((a, b) => {
    const priority = ['sr', 'hr', 'bs', 'en', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'tr'];
    const indexA = priority.indexOf(a.languageCode);
    const indexB = priority.indexOf(b.languageCode);

    if (indexA !== -1 && indexB !== -1) {
      if (indexA !== indexB) return indexA - indexB;
      // Prefer OpenSubtitles v3 within same language, then V2, then V1
      const sourceScore = (s?: string) => (s === 'opensubtitles_v3' ? 0 : s === 'vdrk_v2' ? 1 : 2);
      return sourceScore(a.source) - sourceScore(b.source);
    }
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    return a.language.localeCompare(b.language) || a.label.localeCompare(b.label);
  });

  return tracks;
}
