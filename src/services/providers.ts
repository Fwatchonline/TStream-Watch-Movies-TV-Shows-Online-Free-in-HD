import { StreamServer } from '../types/media';

/**
 * 100% Direct Native HLS Streaming Providers
 * Creative, clean, mythical server names (no technical/scraper names exposed).
 */
export const STREAMING_PROVIDERS: StreamServer[] = [
  {
    id: 'fmov',
    name: 'Zeus Ultra 4K',
    badge: 'Cinema 4K HDR',
    quality: '2160p / 1080p HDR',
    category: 'vyla',
    description: 'Flagship multi-cluster ultra stream engine with high-bitrate master feeds and multi-channel audio',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=fmov`
  },
  {
    id: 'showbox',
    name: 'Poseidon Quantum 4K',
    badge: '4K Ultra HDR / 5.1',
    quality: '2160p / 1080p',
    category: 'vyla',
    description: 'Direct dedicated 4K HDR cloud stream engine with native 4K streams and multi-channel 5.1 surround sound',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=showbox`
  },
  {
    id: 'vidapi',
    name: 'Apollo Master HLS',
    badge: 'Zero-Buffer Quantum',
    quality: '1080p 60fps',
    category: 'vyla',
    description: 'Adaptive multi-bitrate ladder (1080p, 720p, 480p) optimized for instantaneous playback start',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidapi`
  },
  {
    id: 'vidrock',
    name: 'Athena Prime HD',
    badge: 'Pure Studio Audio',
    quality: '1080p Master',
    category: 'vyla',
    description: 'Decrypted master direct streams with high-bitrate surround audio channels',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrock`
  },
  {
    id: 'vidlink',
    name: 'Hermes Velocity',
    badge: 'Ultra-Adaptive',
    quality: '1080p HD',
    category: 'vyla',
    description: 'High-frequency edge delivery with synchronized dynamic multi-language subtitle tracks',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidlink`
  },
  {
    id: 'fastcloud',
    name: 'Ares Direct CDN',
    badge: 'Sub-Second Latency',
    quality: '1080p Fast',
    category: 'featured',
    description: 'Ultra-fast distributed edge CDN cluster with low-latency TS and fMP4 segments',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrock`
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

export const DEFAULT_SERVER_ID = 'fmov';
