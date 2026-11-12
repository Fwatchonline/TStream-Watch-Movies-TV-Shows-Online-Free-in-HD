export interface PlatformMeta {
  id: string;
  name: string;
  shortBadge: string;
  tagline: string;
  description: string;
  color: string;
  cardBg: string;
  networkId: string;
  watchProviderId: string;
  companyId: string;
  watchRegion: string;
  /**
   * Verified local catalog TMDB IDs genuinely belonging to this platform/studio.
   * Empty array means offline local fallback has no confirmed matches and will
   * not fabricate unrelated movies/shows (live TMDB discover provides full results).
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
    tagline: 'Netflix Originals & Global Productions',
    description:
      'Explore movies, binge-worthy series, and documentaries produced and distributed exclusively by Netflix.',
    color: '#E50914',
    cardBg: 'bg-black',
    networkId: '213',
    watchProviderId: '8',
    companyId: '178464|19308',
    watchRegion: 'US',
    verifiedCatalogIds: [66732, 94605] // Stranger Things, Arcane
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    shortBadge: 'tv+',
    tagline: 'Apple Original Films & Television',
    description:
      'Award-winning series, captivating dramas, groundbreaking documentaries, and cinema productions by Apple Studios.',
    color: '#A2AAAD',
    cardBg: 'bg-[#151516]',
    networkId: '2552',
    watchProviderId: '350',
    companyId: '11073|194232',
    watchRegion: 'US',
    verifiedCatalogIds: [95396] // Severance
  },
  {
    id: 'max',
    name: 'HBO Max',
    shortBadge: 'MAX',
    tagline: 'HBO & Warner Bros. Productions',
    description:
      'The standard of television excellence: HBO originals, Warner Bros. Pictures blockbusters, and Max exclusive series.',
    color: '#9933FF',
    cardBg: 'bg-[#0f0524]',
    networkId: '3186|49',
    watchProviderId: '1899|384',
    companyId: '3268|174',
    watchRegion: 'US',
    verifiedCatalogIds: [100088, 94997, 414906, 693134, 155, 671, 672, 673] // The Last of Us, House of the Dragon, The Batman, Dune 2, Dark Knight, Harry Potter
  },
  {
    id: 'prime',
    name: 'Prime Video',
    shortBadge: 'PRIME',
    tagline: 'Amazon MGM Studios & Originals',
    description:
      'Epic dramas, superhero sagas, and Hollywood releases produced by Amazon Studios and MGM.',
    color: '#00A8E1',
    cardBg: 'bg-[#00050d]',
    networkId: '1024',
    watchProviderId: '9|119',
    companyId: '20580|21',
    watchRegion: 'US',
    verifiedCatalogIds: [] // Populated dynamically via live TMDB watch providers/networks
  },
  {
    id: 'disney',
    name: 'Disney+',
    shortBadge: 'D+',
    tagline: 'Disney, Marvel Studios & Lucasfilm',
    description:
      'Iconic franchises and new stories from Disney, Marvel Studios, Star Wars, Pixar, and National Geographic.',
    color: '#113CCF',
    cardBg: 'bg-[#040714]',
    networkId: '2739',
    watchProviderId: '337',
    companyId: '2|420',
    watchRegion: 'US',
    verifiedCatalogIds: [24428, 99861, 299536, 299534, 533535, 22, 58] // Avengers, Deadpool & Wolverine, Pirates of the Caribbean
  },
  {
    id: 'peacock',
    name: 'Peacock',
    shortBadge: 'PEA',
    tagline: 'Peacock Originals & Universal Pictures',
    description:
      'Hit originals, classic comedies, drama series, and blockbuster films produced by Universal Television & Peacock.',
    color: '#008BE2',
    cardBg: 'bg-black',
    networkId: '3353|6',
    watchProviderId: '386|387',
    companyId: '33',
    watchRegion: 'US',
    verifiedCatalogIds: [872585] // Oppenheimer (Universal Pictures)
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    shortBadge: 'P+',
    tagline: 'Paramount Pictures & Showtime Originals',
    description:
      'A mountain of entertainment from Paramount Pictures, CBS Studios, Showtime, MTV, and Nickelodeon.',
    color: '#0064FF',
    cardBg: 'bg-[#00173d]',
    networkId: '4330|16',
    watchProviderId: '531',
    companyId: '4',
    watchRegion: 'US',
    verifiedCatalogIds: [157336, 558449] // Interstellar, Gladiator II (Paramount Pictures)
  },
  {
    id: 'hulu',
    name: 'Hulu',
    shortBadge: 'hulu',
    tagline: 'Hulu Originals & FX Productions',
    description:
      'Critically celebrated dramas, comedy gems, and FX television series made exclusively for Hulu.',
    color: '#1CE783',
    cardBg: 'bg-[#0b1411]',
    networkId: '453|88',
    watchProviderId: '15',
    companyId: '25',
    watchRegion: 'US',
    verifiedCatalogIds: [126308] // Shogun (FX / Hulu)
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll',
    shortBadge: 'CR',
    tagline: 'Crunchyroll Anime & Cinema',
    description:
      'The premier destination for Japanese animation studios, movies, and worldwide simulcast series.',
    color: '#F47521',
    cardBg: 'bg-[#141519]',
    networkId: '1112',
    watchProviderId: '283',
    companyId: '1112',
    watchRegion: 'US',
    verifiedCatalogIds: [] // Populated dynamically via live TMDB Crunchyroll provider/network
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
