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
 * Universal client-side sanitizer to preserve and highlight verified fast servers
 */
export function cleanServerDisplay(name: string): string {
  if (!name) return 'Vector (1080p)';
  let s = name;

  // Preserve core fast providers
  if (/^(Vector|Valence|Eclipse|BoxMovie|Apex|Core|Orion|Pulse)\b/i.test(s)) {
    return s;
  }
  if (/vidapi/i.test(s)) return 'Vector';
  if (/lmscript/i.test(s)) return 'Valence';
  if (/boxmovie/i.test(s)) return 'BoxMovie';
  if (/meowtv/i.test(s)) return 'Apex';
  if (/vidrock/i.test(s)) return 'Core';
  if (/vidrift/i.test(s)) return 'Orion';
  if (/vidlink/i.test(s)) return 'Pulse';

  s = s.replace(/api\.fmov\.my/gi, 'Eclipse');
  s = s.replace(/fmov/gi, 'Eclipse');
  s = s.replace(/showbox/gi, 'Poseidon 4K');
  s = s.replace(/febbox/gi, 'Poseidon');
  s = s.replace(/vaplayer/gi, 'Vector Core');
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

    if (/^(cluster|route|server|primary|backup|node|source|direct|ultra|quantum|master|stream|\d+p)\b/i.test(rest)) {
      s = `${prefix} · ${rest}`;
    } else {
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
  single?: boolean;
  exclude?: string[];
}): Promise<DirectProviderResult[]> {
  const query = new URLSearchParams();
  if (params.season != null) query.set('season', params.season.toString());
  if (params.episode != null) query.set('episode', params.episode.toString());
  if (params.provider && params.provider !== 'all') query.set('provider', params.provider);
  if (params.single && params.provider && params.provider !== 'all') query.set('single', '1');
  if (params.exclude && params.exclude.length > 0) query.set('exclude', params.exclude.join(','));
  const queryStr = query.toString() ? `?${query.toString()}` : '';

  // 1. Primary Orchestrated Multi-Server Route (/api/stream/:type/:id)
  try {
    const orchestratorRes = await fetch(`/api/stream/${params.mediaType}/${params.tmdbId}${queryStr}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(18000)
    }).catch(() => null);

    if (orchestratorRes && orchestratorRes.ok) {
      const data = await orchestratorRes.json();
      if (data.success && Array.isArray(data.servers) && data.servers.length > 0) {
        const orchestratedResults: DirectProviderResult[] = data.servers.map((s: any) => ({
          provider: s.key,
          providerName: s.label,
          streams: (s.sources && s.sources.length > 0 ? s.sources : [{ name: s.label, url: s.url, type: s.type }]).map((sourceItem: any) => ({
            quality: sourceItem.quality || (sourceItem.type === 'hls' ? '1080p Auto' : '1080p'),
            type: (sourceItem.type || s.type || 'hls') as 'hls' | 'mp4',
            url: sourceItem.url,
            playUrl: sourceItem.url,
            directUrl: sourceItem.url,
            server: sourceItem.name || s.label
          })),
          subtitles: []
        }));

        return orchestratedResults;
      }
    }
  } catch (err) {
    console.warn('Orchestrator route error, attempting fallback:', err);
  }

  // 2. Secondary Direct Resolver Fallback
  try {
    const fallbackQuery = new URLSearchParams({
      tmdbId: params.tmdbId.toString(),
      type: params.mediaType
    });
    if (params.season != null) fallbackQuery.set('season', params.season.toString());
    if (params.episode != null) fallbackQuery.set('episode', params.episode.toString());
    if (params.provider) fallbackQuery.set('provider', params.provider);

    const res = await fetch(`/api/stream-resolve?${fallbackQuery.toString()}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000)
    });

    if (res.ok) {
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
    }
  } catch (err) {
    console.warn('Failed to fetch direct streams via fallback API:', err);
  }

  return [];
}

