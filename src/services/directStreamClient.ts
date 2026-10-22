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
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data: ResolveResponse = await res.json();
    if (data.success && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch direct streams via API:', err);
    return [];
  }
}
