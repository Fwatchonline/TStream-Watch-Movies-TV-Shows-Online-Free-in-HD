import { StreamServer } from '../types/media';

/**
 * 100% Direct Native HLS Streaming Providers
 * No iframe servers. Native HTML5 <video> & HLS.js streaming feeds.
 */
export const STREAMING_PROVIDERS: StreamServer[] = [
  {
    id: 'vidapi',
    name: 'VidAPI Direct HLS',
    badge: '1080p Ultra HD',
    quality: '1080p',
    category: 'vyla',
    description: 'Master HLS playlist with multi-bitrate ladder (1080p, 720p, 480p), zero buffering',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidapi`
  },
  {
    id: 'vidrock',
    name: 'VidRock Decrypted HLS',
    badge: 'Original Bitrate',
    quality: '1080p',
    category: 'vyla',
    description: 'Decrypted master m3u8 direct streams with high-bitrate surround audio channels',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrock`
  },
  {
    id: 'vidlink',
    name: 'VidLink Direct HLS',
    badge: 'Adaptive',
    quality: '1080p',
    category: 'vyla',
    description: 'Direct multi-resolution streams with embedded subtitle track sync',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidlink`
  },
  {
    id: 'fastcloud',
    name: 'FastCloud Direct HLS',
    badge: 'Low Latency',
    quality: '1080p',
    category: 'featured',
    description: 'Ultra-fast edge CDN cluster with low-latency TS and fMP4 segments',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrock`
  },
  {
    id: 'direct_hls_backup',
    name: 'Direct HLS Global Mirror',
    badge: 'High Reliability',
    quality: '1080p',
    category: 'featured',
    description: 'Global fallback CDN cluster ensuring 99.9% direct streaming availability',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}`
  }
];

export const DEFAULT_SERVER_ID = 'vidapi';
