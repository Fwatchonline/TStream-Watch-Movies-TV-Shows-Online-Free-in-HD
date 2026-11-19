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

export function formatQualityBadge(rawQuality?: string, streamType?: string): string {
  const q = String(rawQuality || '').trim();
  const lower = q.toLowerCase();
  if (lower.includes('4k') || lower.includes('2160')) {
    if (lower.includes('1080')) return '4K / 1080p';
    if (lower.includes('1440')) return '4K / 1440p';
    return '4K';
  }
  if (lower.includes('1440')) return '1440p';
  if (lower.includes('1080')) return '1080p';
  if (lower.includes('720')) return '720p';
  if (lower.includes('480')) return '480p';
  if (lower.includes('360')) return '360p';
  if (lower === 'auto' || lower === 'hls' || streamType === 'hls') return 'Auto';
  return 'Unknown';
}

export function stripQualityFromName(name: string): string {
  return String(name || '')
    .replace(/\s*·\s*(4K|2160p|1440p|1080p|720p|480p|360p)\s*$/i, '')
    .replace(/\s*\((4K|2160p|1440p|1080p|720p|480p|360p|Auto(?:\s+HLS)?)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getQualityPillClasses(badge?: string): string {
  const b = String(badge || '').toLowerCase();
  if (b.includes('4k') || b.includes('2160')) {
    return 'border-[#F5C400]/60 bg-[#F5C400]/15 text-[#F5C400]';
  }
  if (b.includes('1440')) {
    return 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300';
  }
  if (b.includes('1080')) {
    return 'border-sky-400/50 bg-sky-500/15 text-sky-300';
  }
  if (b.includes('720')) {
    return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300';
  }
  if (b.includes('480') || b.includes('360')) {
    return 'border-amber-400/50 bg-amber-500/15 text-amber-300';
  }
  return 'border-white/20 bg-white/10 text-zinc-200';
}

/**
 * Universal client-side sanitizer to highlight renamed streaming servers cleanly.
 */
export function cleanServerDisplay(name: string): string {
  if (!name) return 'Aether';
  let s = name;

  // Preserve new server names (with optional · sub-server node)
  if (/^(Aether|Vortex|Krypton|Cobalt|Helios|Vertex|Flux|Sigma|Spectra|Nimbus|Quantum|Onyx)\b/i.test(s)) {
    return s;
  }
  if (/cinejoy|\bnova\b/i.test(s)) return 'Aether';
  if (/cinesrc|\bprism\b/i.test(s)) return 'Vortex';
  if (/vidrock|\bcore\b/i.test(s)) return 'Krypton';
  if (/vidup|\bzenith\b/i.test(s)) return 'Cobalt';
  if (/hexa|\batlas\b/i.test(s)) return 'Helios';
  if (/boxmovie/i.test(s)) return 'Vertex';
  if (/meowtv|\bapex\b/i.test(s)) return 'Flux';
  if (/vidapi|\bvector\b/i.test(s)) return 'Sigma';
  if (/eclipse/i.test(s)) return 'Spectra';
  if (/vidrift|\borion\b/i.test(s)) return 'Nimbus';
  if (/vidlink|\bpulse\b/i.test(s)) return 'Quantum';
  if (/lmscript|\bvalence\b/i.test(s)) return 'Onyx';

  s = s.replace(/api\.fmov\.my/gi, 'Spectra');
  s = s.replace(/fmov/gi, 'Solstice');
  s = s.replace(/showbox/gi, 'Solstice');
  s = s.replace(/febbox/gi, 'Solstice');
  s = s.replace(/vaplayer/gi, 'Sigma');
  s = s.replace(/castletv/gi, 'Nimbus');
  s = s.replace(/4khdhub/gi, 'Cobalt');
  s = s.replace(/streamflix/gi, 'Vortex');
  s = s.replace(/netmirror/gi, 'Mirage');
  s = s.replace(/dahmermovies/gi, 'Vertex');
  s = s.replace(/onetouchtv/gi, 'Helios');

  // Strip movie / series titles after separator
  if (s.includes(' · ')) {
    const parts = s.split(' · ');
    const prefix = parts[0].trim();
    const rest = parts.slice(1).join(' · ').trim();

    if (/^(cluster|route|server|primary|backup|node|source|direct|ultra|quantum|master|stream|\d+p|4k)\b/i.test(rest)) {
      s = `${prefix} · ${rest}`;
    } else {
      s = prefix;
    }
  }

  // Also strip any " - Title"
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

export async function reportStreamPlaybackOutcome(
  provider: string,
  succeeded: boolean,
  reason?: string,
  responseTimeMs?: number
): Promise<void> {
  if (!provider) return;
  try {
    await fetch('/api/stream/health/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, succeeded, reason, responseTimeMs })
    });
  } catch {
    // non-fatal telemetry update
  }
}

export async function fetchDirectStreams(params: {
  tmdbId: number;
  mediaType: 'movie' | 'tv' | 'anime';
  anilistId?: number;
  malId?: number;
  title?: string;
  audioType?: 'sub' | 'dub';
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
  if (params.mediaType === 'anime') {
    if (params.tmdbId > 0) query.set('tmdbId', params.tmdbId.toString());
    if (params.malId) query.set('malId', params.malId.toString());
    if (params.title) query.set('title', params.title);
    if (params.audioType) query.set('audio', params.audioType);
  }
  const queryStr = query.toString() ? `?${query.toString()}` : '';
  const targetRouteId = params.mediaType === 'anime' ? (params.anilistId || params.tmdbId) : params.tmdbId;

  // 1. Primary Orchestrated Multi-Server Route (/api/stream/:type/:id)
  try {
    const orchestratorRes = await fetch(`/api/stream/${params.mediaType}/${targetRouteId}${queryStr}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(18000)
    }).catch(() => null);

    if (orchestratorRes && orchestratorRes.ok) {
      const data = await orchestratorRes.json();
      if (data.success && Array.isArray(data.servers) && data.servers.length > 0) {
        const orchestratedResults: DirectProviderResult[] = data.servers.map((s: any) => ({
          provider: s.key,
          providerName: s.label,
          streams: (s.sources && s.sources.length > 0
            ? s.sources
            : [{ name: s.label, url: s.url, quality: s.quality, type: s.type }]
          ).map((sourceItem: any) => ({
            quality: sourceItem.quality || s.quality || (sourceItem.type === 'hls' ? 'Auto' : 'Unknown'),
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

  // 2. Secondary Direct Resolver Fallback (for TMDB-indexed movies/tv)
  if (params.tmdbId > 0 && (params.mediaType === 'movie' || params.mediaType === 'tv')) {
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
  }

  return [];
}

