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

export const DEFAULT_SERVERS: EmbedServerConfig[] = [
  {
    id: 'server_1_direct',
    name: 'Core · Direct Stream',
    type: 'direct',
    badge: 'Default',
    dotColor: '#34D399', // emerald
    enabled: true,
    order: 1,
    isCustom: false
  },
  {
    id: 'server_2_movietvapi',
    name: 'Server 2 · HD',
    type: 'embed',
    badge: 'HD',
    dotColor: '#38BDF8', // sky blue
    enabled: true,
    order: 2,
    movieUrlTemplate: 'https://movietvapi.stream/embed/movie/{id}',
    tvUrlTemplate: 'https://movietvapi.stream/embed/tv/{id}/{season}/{episode}',
    isCustom: false
  },
  {
    id: 'server_3_vidsrc',
    name: 'Server 3 · Backup',
    type: 'embed',
    badge: 'Backup',
    dotColor: '#FBBF24', // amber
    enabled: true,
    order: 3,
    movieUrlTemplate: 'https://vidsrc.sh/embed/movie/{id}',
    tvUrlTemplate: 'https://vidsrc.sh/embed/tv/{id}/{season}/{episode}',
    isCustom: false
  },
  {
    id: 'server_4_fmov',
    name: 'Server 4 · Ultra',
    type: 'embed',
    badge: 'Ultra',
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
const FIRESTORE_DOC_PATH = 'embedServers';

function normalizeServerList(list: EmbedServerConfig[]): EmbedServerConfig[] {
  return list.map((s) =>
    s.id === 'server_1_direct' &&
    (s.name === 'TStream Server' || s.name === 'Core · Direct Native Stream (Auto Failover)')
      ? { ...s, name: DEFAULT_SERVERS[0].name, badge: DEFAULT_SERVERS[0].badge }
      : s
  );
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
    await setDoc(docRef, {
      servers: sorted,
      directStreamEnabled: directEnabled,
      updatedAt: new Date().toISOString()
    });
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
