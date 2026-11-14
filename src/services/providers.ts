import { StreamServer } from '../types/media';

/**
 * 100% Direct Native HLS Streaming Providers
 * Creative, clean, mythical server names (no technical/scraper names exposed).
 */
export const STREAMING_PROVIDERS: StreamServer[] = [
  {
    id: 'vidrock',
    name: 'Core (Default)',
    badge: 'Primary Default',
    quality: '1080p Master HLS',
    category: 'vyla',
    description: 'Primary AES-GCM decrypted master direct streams loaded first with auto-failover',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrock`
  },
  {
    id: 'boxmovie',
    name: 'BoxMovie Direct',
    badge: '1080p CDN MP4',
    quality: '1080p / 720p MP4',
    category: 'vyla',
    description: 'High-speed direct MP4 CDN with 1080p, 720p, and 480p quality tracks',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=boxmovie`
  },
  {
    id: 'meowtv',
    name: 'Apex Multi-Audio',
    badge: 'Multi-Language HLS',
    quality: '1080p Multi HLS',
    category: 'vyla',
    description: 'Adaptive multi-audio HLS stream with instant fallback',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=meowtv`
  },
  {
    id: 'vidapi',
    name: 'Vector Master HLS',
    badge: 'Adaptive HLS',
    quality: '1080p 60fps',
    category: 'vyla',
    description: 'Adaptive multi-bitrate ladder (1080p, 720p, 480p) optimized for instantaneous playback start',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidapi`
  },
  {
    id: 'vidlink',
    name: 'Pulse Velocity',
    badge: 'Ultra-Adaptive',
    quality: '1080p HD',
    category: 'vyla',
    description: 'High-frequency edge delivery with synchronized dynamic multi-language subtitle tracks',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidlink`
  },
  {
    id: 'vidrift',
    name: 'Orion Direct',
    badge: 'Sub-Second Latency',
    quality: '1080p HLS',
    category: 'featured',
    description: 'Ultra-fast direct HLS cluster with low-latency TS segments',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrift`
  },
  {
    id: 'direct_hls_backup',
    name: 'Titan Orbital Mirror',
    badge: '99.9% Fault-Tolerant',
    quality: '1080p Global',
    category: 'featured',
    description: 'Global orbital fallback relay providing uninterrupted multi-source redundancy and failover',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}`
  }
];

export const DEFAULT_SERVER_ID = 'vidrock';
