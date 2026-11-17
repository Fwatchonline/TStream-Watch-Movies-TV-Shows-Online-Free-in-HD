import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

export interface EmbedServerConfig {
  id: string;
  name: string;
  type: 'direct' | 'embed';
  badge?: string;
  dotColor: string;
  enabled: boolean;
  order: number;
  movieUrlTemplate?: string;
  tvUrlTemplate?: string;
  isCustom?: boolean;
}

export interface DefaultServerPreferences {
  movieServerId: string;
  tvServerId: string;
  movieDirectProvider: string;
  tvDirectProvider: string;
}

export const DIRECT_PROVIDER_OPTIONS = [
  { id: 'cinejoy', name: 'Aether (Default)', badge: '4K / 1080p' },
  { id: 'cinesrc', name: 'Vortex', badge: '4K / 1080p' },
  { id: 'vidrock', name: 'Krypton', badge: '1080p' },
  { id: 'vidup', name: 'Cobalt', badge: '4K / 1440p' },
  { id: 'hexa', name: 'Helios', badge: '1440p / 720p' },
  { id: 'boxmovie', name: 'Vertex', badge: '1080p / 720p' },
  { id: 'meowtv', name: 'Flux', badge: '1080p' },
  { id: 'vidapi', name: 'Sigma', badge: '1080p' },
  { id: 'eclipse', name: 'Spectra', badge: '1080p' },
  { id: 'vidrift', name: 'Nimbus', badge: '1080p' },
  { id: 'vidlink', name: 'Quantum', badge: '1080p' },
  { id: 'lmscript', name: 'Onyx', badge: '1080p' }
] as const;

export const DEFAULT_SERVER_PREFERENCES: DefaultServerPreferences = {
  movieServerId: 'server_1_direct',
  tvServerId: 'server_1_direct',
  movieDirectProvider: 'cinejoy',
  tvDirectProvider: 'cinejoy'
};

export const DEFAULT_SERVERS: EmbedServerConfig[] = [
  {
    id: 'server_1_direct',
    name: 'Aether · Direct Stream',
    type: 'direct',
    badge: '4K / 1080p',
    dotColor: '#34D399', // emerald
    enabled: true,
    order: 1,
    isCustom: false
  },
  {
    id: 'server_2_movietvapi',
    name: 'Mirage · Mirror',
    type: 'embed',
    badge: '1080p',
    dotColor: '#38BDF8', // sky blue
    enabled: true,
    order: 2,
    movieUrlTemplate: 'https://movietvapi.stream/embed/movie/{id}',
    tvUrlTemplate: 'https://movietvapi.stream/embed/tv/{id}/{season}/{episode}',
    isCustom: false
  },
  {
    id: 'server_3_vidsrc',
    name: 'Vesper · Mirror',
    type: 'embed',
    badge: '1080p',
    dotColor: '#FBBF24', // amber
    enabled: true,
    order: 3,
    movieUrlTemplate: 'https://vidsrc.sh/embed/movie/{id}',
    tvUrlTemplate: 'https://vidsrc.sh/embed/tv/{id}/{season}/{episode}',
    isCustom: false
  },
  {
    id: 'server_4_fmov',
    name: 'Solstice · Mirror',
    type: 'embed',
    badge: '4K / 1080p',
    dotColor: '#F5C400', // yellow
    enabled: true,
    order: 4,
    movieUrlTemplate: 'https://fmov.my/embed/movie/{id}?color=F5C400',
    tvUrlTemplate: 'https://fmov.my/embed/series/{id}/{season}/{episode}?color=F5C400',
    isCustom: false
  }
];

const LOCAL_SERVERS_KEY = 'tstream_configured_embed_servers';
const LOCAL_DIRECT_ENABLED_KEY = 'tstream_direct_stream_enabled';
const LOCAL_DEFAULT_PREFS_KEY = 'tstream_default_server_prefs';
const FIRESTORE_DOC_PATH = 'embedServers';

const LEGACY_SERVER_NAMES_BY_ID: Record<string, string[]> = {
  server_1_direct: [
    'TStream Server',
    'Core · Direct Stream',
    'Core · Direct Native Stream (Auto Failover)'
  ],
  server_2_movietvapi: ['Server 2 · HD', 'Server 2 · MovieTV API'],
  server_3_vidsrc: ['Server 3 · Backup', 'Server 3 · VidSrc'],
  server_4_fmov: ['Server 4 · Ultra', 'Server 1 · FMOV']
};

function normalizeServerList(list: EmbedServerConfig[]): EmbedServerConfig[] {
  const defaultMap = new Map(DEFAULT_SERVERS.map((d) => [d.id, d]));
  return list.map((s) => {
    const def = defaultMap.get(s.id);
    if (!def) return s;
    const legacyNames = LEGACY_SERVER_NAMES_BY_ID[s.id] || [];
    if (legacyNames.includes(s.name)) {
      return { ...s, name: def.name, badge: def.badge };
    }
    if (!s.badge || s.badge === 'Default' || s.badge === 'HD' || s.badge === 'Backup' || s.badge === 'Ultra') {
      return { ...s, badge: def.badge };
    }
    return s;
  });
}

function normalizeDefaultServerPreferences(raw: any): DefaultServerPreferences {
  const validDirectIds = new Set<string>(DIRECT_PROVIDER_OPTIONS.map((p) => p.id));
  const movieServerId =
    typeof raw?.movieServerId === 'string' && raw.movieServerId.trim()
      ? raw.movieServerId.trim()
      : DEFAULT_SERVER_PREFERENCES.movieServerId;
  const tvServerId =
    typeof raw?.tvServerId === 'string' && raw.tvServerId.trim()
      ? raw.tvServerId.trim()
      : DEFAULT_SERVER_PREFERENCES.tvServerId;
  const movieDirectProvider =
    typeof raw?.movieDirectProvider === 'string' && validDirectIds.has(raw.movieDirectProvider)
      ? raw.movieDirectProvider
      : DEFAULT_SERVER_PREFERENCES.movieDirectProvider;
  const tvDirectProvider =
    typeof raw?.tvDirectProvider === 'string' && validDirectIds.has(raw.tvDirectProvider)
      ? raw.tvDirectProvider
      : DEFAULT_SERVER_PREFERENCES.tvDirectProvider;

  return {
    movieServerId,
    tvServerId,
    movieDirectProvider,
    tvDirectProvider
  };
}

function getLocalServers(): EmbedServerConfig[] {
  try {
    const raw = localStorage.getItem(LOCAL_SERVERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeServerList(parsed);
      }
    }
  } catch {}
  return [...DEFAULT_SERVERS];
}

function saveLocalServers(servers: EmbedServerConfig[]): void {
  try {
    localStorage.setItem(LOCAL_SERVERS_KEY, JSON.stringify(servers));
    // Trigger window event so player updates in real-time across tabs/components
    window.dispatchEvent(new CustomEvent('tstream_servers_updated', { detail: servers }));
  } catch {}
}

export function getDirectStreamEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_DIRECT_ENABLED_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
    const directServer = getLocalServers().find((s) => s.id === 'server_1_direct' || s.type === 'direct');
    if (directServer) return directServer.enabled !== false;
  } catch {}
  return true;
}

function saveLocalDirectStreamEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LOCAL_DIRECT_ENABLED_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('tstream_direct_stream_updated', { detail: enabled }));
  } catch {}
}

export function getDefaultServerPreferences(): DefaultServerPreferences {
  try {
    const raw = localStorage.getItem(LOCAL_DEFAULT_PREFS_KEY);
    if (raw) {
      return normalizeDefaultServerPreferences(JSON.parse(raw));
    }
  } catch {}
  return { ...DEFAULT_SERVER_PREFERENCES };
}

function saveLocalDefaultServerPreferences(prefs: DefaultServerPreferences): void {
  try {
    const normalized = normalizeDefaultServerPreferences(prefs);
    localStorage.setItem(LOCAL_DEFAULT_PREFS_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent('tstream_default_server_prefs_updated', { detail: normalized })
    );
  } catch {}
}

/**
 * Resolve the effective default server for a given media type ('movie' | 'tv')
 * based on Admin preferences, enabled server list, and Direct Stream toggle.
 */
export function pickEffectiveDefaultServer(
  mediaType: 'movie' | 'tv',
  servers: EmbedServerConfig[],
  directEnabled: boolean,
  prefs: DefaultServerPreferences
): EmbedServerConfig {
  const activeServers = servers.length > 0 ? servers : DEFAULT_SERVERS;
  const preferredId = mediaType === 'movie' ? prefs.movieServerId : prefs.tvServerId;

  const directPool = directEnabled
    ? activeServers.filter((s) => s.type === 'direct' && s.enabled !== false)
    : [];
  const embedPool = activeServers.filter((s) => s.type === 'embed' && s.enabled);
  const fallbackEmbeds = DEFAULT_SERVERS.filter((s) => s.type === 'embed');

  const availablePool: EmbedServerConfig[] = [
    ...(directPool.length > 0 ? directPool : directEnabled ? [DEFAULT_SERVERS[0]] : []),
    ...(embedPool.length > 0 ? embedPool : fallbackEmbeds)
  ];

  const exactMatch = availablePool.find((s) => s.id === preferredId);
  if (exactMatch) {
    return exactMatch;
  }

  if (directEnabled) {
    return availablePool.find((s) => s.type === 'direct') || availablePool[0];
  }
  return availablePool.find((s) => s.type === 'embed') || availablePool[0];
}

/**
 * Save Admin-chosen default server preferences for Movies and TV Series
 */
export async function saveDefaultServerPreferences(
  prefs: DefaultServerPreferences
): Promise<DefaultServerPreferences> {
  const normalized = normalizeDefaultServerPreferences(prefs);
  saveLocalDefaultServerPreferences(normalized);

  try {
    const docRef = doc(db, 'systemSettings', FIRESTORE_DOC_PATH);
    await setDoc(
      docRef,
      {
        defaultServerPrefs: normalized,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving defaultServerPrefs to Firestore:', err);
  }
  return normalized;
}

/**
 * Subscribe in real time to Admin-chosen default server preferences (Movies vs TV Series)
 */
export function subscribeToDefaultServerPreferences(
  callback: (prefs: DefaultServerPreferences) => void
): () => void {
  callback(getDefaultServerPreferences());

  const handleCustomEvent = (e: any) => {
    if (e?.detail && typeof e.detail === 'object') {
      callback(normalizeDefaultServerPreferences(e.detail));
    }
  };
  window.addEventListener('tstream_default_server_prefs_updated', handleCustomEvent);

  let unsubscribeFirestore: Unsubscribe | null = null;
  try {
    const docRef = doc(db, 'systemSettings', FIRESTORE_DOC_PATH);
    unsubscribeFirestore = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.defaultServerPrefs && typeof data.defaultServerPrefs === 'object') {
            const normalized = normalizeDefaultServerPreferences(data.defaultServerPrefs);
            saveLocalDefaultServerPreferences(normalized);
            callback(normalized);
          }
        }
      },
      (err) => {
        console.warn('Firestore defaultServerPrefs listener error:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore defaultServerPrefs subscription failed:', err);
  }

  return () => {
    window.removeEventListener('tstream_default_server_prefs_updated', handleCustomEvent);
    if (unsubscribeFirestore) unsubscribeFirestore();
  };
}

/**
 * Enable or disable Direct Stream globally (Watch Page shows Embed Player only when disabled)
 */
export async function setDirectStreamEnabled(enabled: boolean): Promise<void> {
  saveLocalDirectStreamEnabled(enabled);

  const current = await getEmbedServers();
  const hasDirect = current.some((s) => s.id === 'server_1_direct' || s.type === 'direct');
  const updatedServers = hasDirect
    ? current.map((s) => (s.id === 'server_1_direct' || s.type === 'direct' ? { ...s, enabled } : s))
    : [{ ...DEFAULT_SERVERS[0], enabled }, ...current];

  const sorted = [...updatedServers].sort((a, b) => a.order - b.order);
  saveLocalServers(sorted);

  try {
    const docRef = doc(db, 'systemSettings', FIRESTORE_DOC_PATH);
    await setDoc(
      docRef,
      {
        servers: sorted,
        directStreamEnabled: enabled,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving directStreamEnabled to Firestore:', err);
  }
}

/**
 * Subscribe in real time to Admin-controlled Direct Stream ON/OFF setting
 */
export function subscribeToDirectStreamEnabled(
  callback: (enabled: boolean) => void
): () => void {
  callback(getDirectStreamEnabled());

  const handleCustomEvent = (e: any) => {
    if (typeof e?.detail === 'boolean') {
      callback(e.detail);
    }
  };
  window.addEventListener('tstream_direct_stream_updated', handleCustomEvent);

  let unsubscribeFirestore: Unsubscribe | null = null;
  try {
    const docRef = doc(db, 'systemSettings', FIRESTORE_DOC_PATH);
    unsubscribeFirestore = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          let resolved: boolean | undefined;
          if (typeof data?.directStreamEnabled === 'boolean') {
            resolved = data.directStreamEnabled;
          } else if (Array.isArray(data?.servers)) {
            const directSrv = data.servers.find((s: any) => s.id === 'server_1_direct' || s.type === 'direct');
            if (directSrv && typeof directSrv.enabled === 'boolean') {
              resolved = directSrv.enabled;
            }
          }
          if (typeof resolved === 'boolean') {
            saveLocalDirectStreamEnabled(resolved);
            callback(resolved);
          }
        }
      },
      (err) => {
        console.warn('Firestore directStreamEnabled listener error:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore directStreamEnabled subscription failed:', err);
  }

  return () => {
    window.removeEventListener('tstream_direct_stream_updated', handleCustomEvent);
    if (unsubscribeFirestore) unsubscribeFirestore();
  };
}

/**
 * Fetch all streaming servers (Firestore with localStorage cache fallback)
 */
export async function getEmbedServers(): Promise<EmbedServerConfig[]> {
  const local = getLocalServers();
  try {
    const docRef = doc(db, 'systemSettings', FIRESTORE_DOC_PATH);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (typeof data?.directStreamEnabled === 'boolean') {
        saveLocalDirectStreamEnabled(data.directStreamEnabled);
      }
      if (data?.defaultServerPrefs && typeof data.defaultServerPrefs === 'object') {
        saveLocalDefaultServerPreferences(
          normalizeDefaultServerPreferences(data.defaultServerPrefs)
        );
      }
      if (Array.isArray(data?.servers) && data.servers.length > 0) {
        const normalized = normalizeServerList(data.servers);
        saveLocalServers(normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn('Error fetching embed servers from Firestore, using local cache:', err);
  }
  return local;
}

/**
 * Save all streaming servers to Firestore and localStorage
 */
export async function saveEmbedServers(servers: EmbedServerConfig[]): Promise<void> {
  const sorted = [...servers].sort((a, b) => a.order - b.order);
  saveLocalServers(sorted);

  const directSrv = sorted.find((s) => s.id === 'server_1_direct' || s.type === 'direct');
  const directEnabled = directSrv ? directSrv.enabled !== false : getDirectStreamEnabled();
  saveLocalDirectStreamEnabled(directEnabled);

  try {
    const docRef = doc(db, 'systemSettings', FIRESTORE_DOC_PATH);
    await setDoc(
      docRef,
      {
        servers: sorted,
        directStreamEnabled: directEnabled,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving embed servers to Firestore:', err);
  }
}

/**
 * Add a new custom embed server
 */
export async function addEmbedServer(
  server: Omit<EmbedServerConfig, 'id' | 'order' | 'isCustom'>
): Promise<EmbedServerConfig> {
  const current = await getEmbedServers();
  const nextOrder = current.length > 0 ? Math.max(...current.map((s) => s.order)) + 1 : 1;
  const newServer: EmbedServerConfig = {
    ...server,
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    order: nextOrder,
    isCustom: true
  };

  const updated = [...current, newServer];
  await saveEmbedServers(updated);
  return newServer;
}

/**
 * Update an existing embed server
 */
export async function updateEmbedServer(
  id: string,
  updates: Partial<EmbedServerConfig>
): Promise<void> {
  const current = await getEmbedServers();
  const updated = current.map((s) => (s.id === id ? { ...s, ...updates } : s));
  await saveEmbedServers(updated);
}

/**
 * Delete an embed server
 */
export async function deleteEmbedServer(id: string): Promise<void> {
  const current = await getEmbedServers();
  const updated = current.filter((s) => s.id !== id);
  await saveEmbedServers(updated);
}

/**
 * Reset embed servers back to default initial configuration
 */
export async function resetEmbedServersToDefault(): Promise<EmbedServerConfig[]> {
  saveLocalDirectStreamEnabled(true);
  await saveDefaultServerPreferences({ ...DEFAULT_SERVER_PREFERENCES });
  await saveEmbedServers([...DEFAULT_SERVERS]);
  return [...DEFAULT_SERVERS];
}

/**
 * Subscribe to real-time embed server updates
 */
export function subscribeToEmbedServers(
  callback: (servers: EmbedServerConfig[]) => void
): () => void {
  // 1. Initial callback from local
  callback(getLocalServers());

  // 2. Listen to custom event for intra-tab updates
  const handleCustomEvent = (e: any) => {
    if (e.detail) callback(e.detail);
  };
  window.addEventListener('tstream_servers_updated', handleCustomEvent);

  // 3. Listen to Firestore doc updates
  let unsubscribeFirestore: Unsubscribe | null = null;
  try {
    const docRef = doc(db, 'systemSettings', FIRESTORE_DOC_PATH);
    unsubscribeFirestore = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data?.directStreamEnabled === 'boolean') {
            saveLocalDirectStreamEnabled(data.directStreamEnabled);
          }
          if (data?.defaultServerPrefs && typeof data.defaultServerPrefs === 'object') {
            saveLocalDefaultServerPreferences(
              normalizeDefaultServerPreferences(data.defaultServerPrefs)
            );
          }
          if (Array.isArray(data?.servers) && data.servers.length > 0) {
            const normalized = normalizeServerList(data.servers);
            saveLocalServers(normalized);
            callback(normalized);
          }
        }
      },
      (err) => {
        console.warn('Firestore embed servers listener error, fallback to local:', err);
      }
    );
  } catch (err) {
    console.warn('Firestore subscription failed:', err);
  }

  return () => {
    window.removeEventListener('tstream_servers_updated', handleCustomEvent);
    if (unsubscribeFirestore) unsubscribeFirestore();
  };
}

/**
 * Resolve an embed URL by substituting template placeholders
 */
export function resolveEmbedUrl(
  template: string,
  params: { id: string | number; season?: number; episode?: number }
): string {
  if (!template) return '';
  const idStr = String(params.id);
  const sStr = String(params.season || 1);
  const epStr = String(params.episode || 1);

  return template
    .replace(/{id}/g, idStr)
    .replace(/{tmdbId}/g, idStr)
    .replace(/{tmdb_id}/g, idStr)
    .replace(/{season}/g, sStr)
    .replace(/{episode}/g, epStr);
}
