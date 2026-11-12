export const DEFAULT_WATCH_REGION = 'US';

export const SUPPORTED_WATCH_REGIONS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'AU', label: 'Australia' },
  { code: 'HR', label: 'Croatia' },
  { code: 'RS', label: 'Serbia' }
] as const;

export function normalizeWatchRegion(region?: string | null): string {
  const clean = (region || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(clean)) {
    return clean;
  }
  return DEFAULT_WATCH_REGION;
}

export function getConfiguredWatchRegion(): string {
  if (typeof process !== 'undefined' && process.env?.DEFAULT_WATCH_REGION) {
    return normalizeWatchRegion(process.env.DEFAULT_WATCH_REGION);
  }
  return DEFAULT_WATCH_REGION;
}

export interface PlatformMeta {
  id: string;
  name: string;
  shortBadge: string;
  tagline: string;
  description: string;
  color: string;
  cardBg: string;
  /** TMDB TV network ID(s), distinct from watch provider streaming availability */
  networkId: string;
  /** TMDB Watch Provider ID(s) used for streaming availability in watchRegion */
  watchProviderId: string;
  /** TMDB Production Company ID(s) representing studio ownership/origin */
  companyId: string;
  watchRegion: string;
  /**
   * Verified local flagship original/studio titles in offline catalog.
   * Empty array ensures unpopulated offline platforms emit noindex instead of fabricating unrelated titles.
   * These offline records reflect original/studio references rather than real-time streaming availability.
   */
  verifiedCatalogIds: number[];
}

export const PLATFORM_ALIASES: Record<string, string> = {
  hbo: 'max',
  hbomax: 'max',
  'apple-tv': 'apple',
  appletv: 'apple',
  amazon: 'prime',
  'prime-video': 'prime',
  disneyplus: 'disney'
};

export const PLATFORM_CONFIGS: PlatformMeta[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    shortBadge: 'N',
    tagline: 'Netflix Originals & Streaming Catalog',
    description:
      'Explore movies and television series streaming on Netflix alongside flagship Netflix Originals.',
    color: '#E50914',
    cardBg: 'bg-black',
    networkId: '213',
    watchProviderId: '8',
    companyId: '178464|19308',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [66732, 94605] // Stranger Things, Arcane (Netflix Originals)
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    shortBadge: 'tv+',
    tagline: 'Apple TV+ Streaming & Apple Originals',
    description:
      'Award-winning series, dramas, and films streaming on Apple TV+ and produced by Apple Studios.',
    color: '#A2AAAD',
    cardBg: 'bg-[#151516]',
    networkId: '2552',
    watchProviderId: '350',
    companyId: '11073|194232',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [95396] // Severance (Apple TV+ Original)
  },
  {
    id: 'max',
    name: 'HBO Max',
    shortBadge: 'MAX',
    tagline: 'HBO Originals & Max Streaming',
    description:
      'Stream HBO original series and Max streaming catalog titles across cinema and television.',
    color: '#9933FF',
    cardBg: 'bg-[#0f0524]',
    networkId: '3186|49',
    watchProviderId: '1899|384',
    companyId: '3268|174',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [100088, 94997] // The Last of Us, House of the Dragon (HBO / Max Originals)
  },
  {
    id: 'prime',
    name: 'Prime Video',
    shortBadge: 'PRIME',
    tagline: 'Prime Video Streaming & Amazon Originals',
    description:
      'Stream movies and Amazon MGM Studios series currently available on Prime Video.',
    color: '#00A8E1',
    cardBg: 'bg-[#00050d]',
    networkId: '1024',
    watchProviderId: '9|119',
    companyId: '20580|21',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [] // Populated dynamically via live TMDB watch providers
  },
  {
    id: 'disney',
    name: 'Disney+',
    shortBadge: 'D+',
    tagline: 'Disney+ Streaming, Marvel & Lucasfilm',
    description:
      'Stream Disney, Marvel Studios, Star Wars, Pixar, and National Geographic titles available on Disney+.',
    color: '#113CCF',
    cardBg: 'bg-[#040714]',
    networkId: '2739',
    watchProviderId: '337',
    companyId: '2|420',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [24428, 99861, 299536, 299534, 533535, 22, 58] // Disney/Marvel/Pirates flagship catalog
  },
  {
    id: 'peacock',
    name: 'Peacock',
    shortBadge: 'PEA',
    tagline: 'Peacock Streaming & NBCUniversal',
    description:
      'Hit series and films available on Peacock from NBCUniversal television and cinema.',
    color: '#008BE2',
    cardBg: 'bg-black',
    networkId: '3353|6',
    watchProviderId: '386|387',
    companyId: '33',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [] // Populated dynamically via live TMDB watch providers (avoid claiming studio-only films without regional provider confirmation)
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    shortBadge: 'P+',
    tagline: 'Paramount+ Streaming & Showtime',
    description:
      'Stream movies and television series available on Paramount+, CBS, and Showtime.',
    color: '#0064FF',
    cardBg: 'bg-[#00173d]',
    networkId: '4330|16',
    watchProviderId: '531',
    companyId: '4',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [] // Populated dynamically via live TMDB watch providers
  },
  {
    id: 'hulu',
    name: 'Hulu',
    shortBadge: 'hulu',
    tagline: 'Hulu Streaming & FX Originals',
    description:
      'Critically celebrated dramas, comedy gems, and FX television series available on Hulu.',
    color: '#1CE783',
    cardBg: 'bg-[#0b1411]',
    networkId: '453|88',
    watchProviderId: '15',
    companyId: '25',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [126308] // Shogun (FX / Hulu Original)
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll',
    shortBadge: 'CR',
    tagline: 'Crunchyroll Anime Streaming',
    description:
      'Anime series, simulcasts, and animated films currently available on Crunchyroll.',
    color: '#F47521',
    cardBg: 'bg-[#141519]',
    networkId: '1112',
    watchProviderId: '283',
    companyId: '1112',
    watchRegion: DEFAULT_WATCH_REGION,
    verifiedCatalogIds: [] // Populated dynamically via live TMDB watch providers
  }
];

export function normalizePlatformId(id?: string | null): string {
  const clean = (id || '').toLowerCase().trim();
  return PLATFORM_ALIASES[clean] || clean;
}

export function getPlatformConfigById(id?: string | null): PlatformMeta | undefined {
  if (!id) return undefined;
  const cleanId = id.toLowerCase().trim();
  const aliased = PLATFORM_ALIASES[cleanId] || cleanId;
  return PLATFORM_CONFIGS.find(
    p =>
      p.id === aliased ||
      p.name.toLowerCase() === cleanId ||
      p.shortBadge.toLowerCase() === cleanId
  );
}
