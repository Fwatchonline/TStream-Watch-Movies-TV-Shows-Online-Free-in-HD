export interface ResolvedStream {
  quality: string;
  type: 'hls' | 'mp4' | 'dash';
  url: string;
  playUrl: string;
  directUrl: string;
  server: string;
  headers?: Record<string, string>;
  subtitles?: Array<{ label: string; url: string; language?: string; type?: string }>;
}

export interface DirectProviderResult {
  provider: string;
  providerName: string;
  streams: ResolvedStream[];
  subtitles: Array<{ label: string; url: string; language?: string; type?: string }>;
}

export interface ResolveResponse {
  success: boolean;
  results: DirectProviderResult[];
  error?: string;
}

/**
 * Universal client-side sanitizer to eliminate technical scraper names (showbox, febbox, vidapi, etc.)
 */
export function cleanServerDisplay(name: string): string {
  if (!name) return 'Zeus (1080p)';
  let s = name;
  s = s.replace(/api\.fmov\.my/gi, 'Zeus Ultra');
  s = s.replace(/fmov/gi, 'Zeus');
  s = s.replace(/showbox/gi, 'Poseidon 4K');
  s = s.replace(/febbox/gi, 'Poseidon');
  s = s.replace(/vidapi/gi, 'Apollo');
  s = s.replace(/vaplayer/gi, 'Zeus Core');
  s = s.replace(/vidlink/gi, 'Hermes');
  s = s.replace(/castletv/gi, 'Athena');
  s = s.replace(/4khdhub/gi, 'Apollo 4K');
  s = s.replace(/streamflix/gi, 'Ares Edge');
  s = s.replace(/netmirror/gi, 'Chronos Mirror');
  s = s.replace(/dahmermovies/gi, 'Ares');
  s = s.replace(/onetouchtv/gi, 'Titan');

  // Strip movie / series titles after separator (e.g. "Poseidon 4K · Magnum P.I. - S1E1...")
  if (s.includes(' · ')) {
    const parts = s.split(' · ');
    const prefix = parts[0].trim();
    const rest = parts.slice(1).join(' · ').trim();

    if (/^(cluster|route|server|primary|backup|node|source|direct|ultra|quantum|master)\b/i.test(rest)) {
      s = `${prefix} · ${rest}`;
    } else {
      // It's a movie/series title or file string -> strip it!
      s = prefix;
    }
  }

  // Also strip any " - Magnum P.I. - S1E1..." or " - Title"
  if (s.includes(' - ')) {
    const parts = s.split(' - ');
    const prefix = parts[0].trim();
    const rest = parts.slice(1).join(' - ').trim();
    if (/s\d+e\d+|season|episode|\d{3,4}p|web|bluray|mkv|mp4/i.test(rest) || rest.length > 10) {
      s = prefix;
    }
  }

  // Strip trailing episode/file release tags
  s = s.replace(/\s*[-–·]\s*S\d+\s*E\d+.*$/i, '');
  s = s.replace(/\s*[-–·]\s*Season\s*\d+.*$/i, '');
  s = s.replace(/\[\s*\]/g, '').replace(/\s+/g, ' ').trim();
  return s;
}

export async function fetchDirectStreams(params: {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  provider?: string;
}): Promise<DirectProviderResult[]> {
  try {
    const query = new URLSearchParams({
      tmdbId: params.tmdbId.toString(),
      type: params.mediaType
    });
    if (params.season != null) query.set('season', params.season.toString());
    if (params.episode != null) query.set('episode', params.episode.toString());
    if (params.provider) query.set('provider', params.provider);

    const res = await fetch(`/api/stream-resolve?${query.toString()}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data: ResolveResponse = await res.json();
    if (data.success && Array.isArray(data.results)) {
      return data.results
        .filter(r => !r.provider?.toLowerCase().includes('castle') && !r.providerName?.toLowerCase().includes('castle'))
        .map(r => ({
          ...r,
          providerName: cleanServerDisplay(r.providerName),
          streams: (r.streams || [])
            .filter(st => !st.server?.toLowerCase().includes('castle') && !st.url?.toLowerCase().includes('castle'))
            .map(st => ({
              ...st,
              server: cleanServerDisplay(st.server)
            }))
        }));
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch direct streams via API:', err);
    return [];
  }
}
