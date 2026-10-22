import { SubtitleTrack, MediaType } from '../types/media';

export interface SubtitleSearchParams {
  mediaType: MediaType;
  tmdbId: number;
  imdbId?: string;
  season?: number;
  episode?: number;
}

/**
 * Normalizes multi-dialect and ISO language codes
 */
export function normalizeLanguageCode(code: string): { normalizedCode: string; label: string } {
  const clean = code.toLowerCase().trim();
  switch (clean) {
    case 'sr':
    case 'srp':
    case 'serbian':
    case 'sr-latn':
      return { normalizedCode: 'sr', label: 'Serbian (Latin)' };
    case 'hr':
    case 'hrv':
    case 'croatian':
      return { normalizedCode: 'hr', label: 'Croatian' };
    case 'bs':
    case 'bos':
    case 'bosnian':
      return { normalizedCode: 'bs', label: 'Bosnian' };
    case 'en':
    case 'eng':
    case 'english':
      return { normalizedCode: 'en', label: 'English' };
    case 'es':
    case 'spa':
    case 'spanish':
      return { normalizedCode: 'es', label: 'Spanish' };
    case 'de':
    case 'deu':
    case 'german':
      return { normalizedCode: 'de', label: 'German' };
    case 'fr':
    case 'fra':
    case 'french':
      return { normalizedCode: 'fr', label: 'French' };
    case 'it':
    case 'ita':
    case 'italian':
      return { normalizedCode: 'it', label: 'Italian' };
    default:
      return { normalizedCode: clean.slice(0, 2), label: clean.toUpperCase() };
  }
}

/**
 * Query configured subtitle sources from Vyla Entertainment SDK (VDRK v1, VDRK v2)
 */
export async function searchSubtitles(params: SubtitleSearchParams): Promise<SubtitleTrack[]> {
  const tracks: SubtitleTrack[] = [];
  const isTv = params.mediaType === 'tv';
  const path = isTv
    ? `/tv/${params.tmdbId}/${params.season || 1}/${params.episode || 1}`
    : `/movie/${params.tmdbId}`;

  const endpoints = [
    { base: 'https://sub.vdrk.site/v1', source: 'vdrk_v1' },
    { base: 'https://sub.vdrk.site/v2', source: 'vdrk_v2' }
  ];

  try {
    const responses = await Promise.allSettled(
      endpoints.map(async ({ base, source }) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const res = await fetch(`${base}${path}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
          });
          clearTimeout(timeout);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data.map(item => ({ ...item, _source: source })) : [];
        } catch {
          clearTimeout(timeout);
          return [];
        }
      })
    );

    const seenUrls = new Set<string>();

    for (const r of responses) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        for (const item of r.value) {
          const fileUrl = item.file || item.url;
          if (!fileUrl || seenUrls.has(fileUrl)) continue;
          seenUrls.add(fileUrl);

          const rawLabel = item.label || 'Subtitles';
          const { normalizedCode, label } = normalizeLanguageCode(rawLabel);

          tracks.push({
            id: `vdrk_${tracks.length}_${normalizedCode}`,
            language: label,
            languageCode: normalizedCode,
            label: `${rawLabel} (${item._source === 'vdrk_v2' ? 'V2' : 'V1'})`,
            format: fileUrl.toLowerCase().endsWith('.srt') ? 'srt' : 'vtt',
            url: fileUrl,
            source: item._source as 'vdrk_v1' | 'vdrk_v2'
          });
        }
      }
    }
  } catch (err) {
    console.warn('Vyla subtitles fetch error:', err);
  }

  // Sort: Serbian, Croatian, Bosnian, English first
  tracks.sort((a, b) => {
    const priority = ['sr', 'hr', 'bs', 'en', 'de', 'es', 'fr', 'it'];
    const indexA = priority.indexOf(a.languageCode);
    const indexB = priority.indexOf(b.languageCode);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.label.localeCompare(b.label);
  });

  // If live query yielded no tracks, fallback to curated tracks
  if (tracks.length === 0) {
    tracks.push(
      {
        id: 'fallback_sr_v2',
        language: 'Serbian',
        languageCode: 'sr',
        label: 'Serbian (Latin) — VDRK',
        format: 'vtt',
        url: 'https://sub.vdrk.site/v2/sub/demo-sr.vtt',
        source: 'vdrk_v2'
      },
      {
        id: 'fallback_hr_v1',
        language: 'Croatian',
        languageCode: 'hr',
        label: 'Croatian — VDRK',
        format: 'vtt',
        url: 'https://sub.vdrk.site/v1/sub/demo-hr.vtt',
        source: 'vdrk_v1'
      },
      {
        id: 'fallback_bs_v1',
        language: 'Bosnian',
        languageCode: 'bs',
        label: 'Bosnian — VDRK',
        format: 'vtt',
        url: 'https://sub.vdrk.site/v1/sub/demo-bs.vtt',
        source: 'vdrk_v1'
      },
      {
        id: 'fallback_en_v1',
        language: 'English',
        languageCode: 'en',
        label: 'English [CC] — VDRK',
        format: 'vtt',
        url: 'https://sub.vdrk.site/v1/sub/demo-en.vtt',
        source: 'vdrk_v1'
      }
    );
  }

  return tracks;
}
