import { StreamServer } from '../types/media';

/**
 * 100% Direct Native HLS Streaming Providers
 * Creative, clean, mythical server names (no technical/scraper names exposed).
 */
export const STREAMING_PROVIDERS: StreamServer[] = [
  {
    id: 'cinejoy',
    name: 'Aether (Default)',
    badge: '4K / 1080p',
    quality: '4K / 1080p HLS',
    category: 'featured',
    description: 'Fastest verified multi-server HLS cluster for movies and TV series with subtitles',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=cinejoy`
  },
  {
    id: 'cinesrc',
    name: 'Vortex Adaptive',
    badge: '4K / 1080p',
    quality: '4K / 1080p HLS',
    category: 'featured',
    description: 'High-speed adaptive multi-node HLS delivery with dynamic server failover',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=cinesrc`
  },
  {
    id: 'vidrock',
    name: 'Krypton Core',
    badge: '1080p / 720p',
    quality: '1080p HLS',
    category: 'vyla',
    description: 'AES-GCM decrypted master direct streams with multi-mirror fallback',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrock`
  },
  {
    id: 'vidup',
    name: 'Cobalt Ultra',
    badge: '4K / 1440p',
    quality: '4K / 1440p HLS',
    category: 'featured',
    description: 'Ultra-HD adaptive bitrate streaming supporting up to 4K master playlists',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidup`
  },
  {
    id: 'hexa',
    name: 'Helios Edge',
    badge: '1440p / 720p',
    quality: '1440p / 720p HLS',
    category: 'featured',
    description: 'Dedicated high-throughput encrypted HLS edge cluster for movies and series',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=hexa`
  },
  {
    id: 'boxmovie',
    name: 'Vertex CDN',
    badge: '1080p / 720p',
    quality: '1080p / 720p MP4',
    category: 'vyla',
    description: 'High-speed direct MP4 CDN with 1080p, 720p, and 480p quality tracks',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=boxmovie`
  },
  {
    id: 'meowtv',
    name: 'Flux Multi-Audio',
    badge: '1080p',
    quality: '1080p Multi HLS',
    category: 'vyla',
    description: 'Adaptive multi-audio HLS stream with instant fallback',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=meowtv`
  },
  {
    id: 'vidapi',
    name: 'Sigma Adaptive',
    badge: '1080p',
    quality: '1080p HLS',
    category: 'vyla',
    description: 'Adaptive multi-bitrate ladder optimized for instantaneous playback start',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidapi`
  },
  {
    id: 'eclipse',
    name: 'Spectra Direct',
    badge: '1080p',
    quality: '1080p MP4/HLS',
    category: 'vyla',
    description: 'Direct 1080p MP4/HLS delivery relay',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=eclipse`
  },
  {
    id: 'vidrift',
    name: 'Nimbus Direct',
    badge: '1080p',
    quality: '1080p HLS',
    category: 'featured',
    description: 'Direct HLS extraction cluster with low-latency TS segments',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidrift`
  },
  {
    id: 'vidlink',
    name: 'Quantum Stream',
    badge: '1080p',
    quality: '1080p / 720p',
    category: 'vyla',
    description: 'High-frequency edge delivery with synchronized multi-language subtitles',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=vidlink`
  },
  {
    id: 'lmscript',
    name: 'Onyx Cinema',
    badge: '1080p',
    quality: '1080p Movies',
    category: 'vyla',
    description: 'Dedicated high-bitrate 1080p movie relay',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}&provider=lmscript`
  },
  {
    id: 'direct_hls_backup',
    name: 'Aurora Global Mirror',
    badge: '4K / 1080p',
    quality: '4K / 1080p Auto',
    category: 'featured',
    description: 'Global fallback relay sweeping all servers for uninterrupted playback',
    buildUrl: ({ mediaType, tmdbId, season = 1, episode = 1 }) =>
      `/api/stream-resolve?tmdbId=${tmdbId}&type=${mediaType}${mediaType === 'tv' ? `&season=${season}&episode=${episode}` : ''}`
  }
];

export const DEFAULT_SERVER_ID = 'cinejoy';
