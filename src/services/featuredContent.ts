import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  setDoc
} from 'firebase/firestore';
import {
  db,
  isFirestoreQuotaExceeded,
  isQuotaExceededError,
  markFirestoreQuotaExceeded
} from './firebase';
import type { MediaType } from '../types/media';

export interface FeaturedContentEntry {
  id: string;
  mediaKey: string;
  mediaType: MediaType;
  title: string;
  order: number;
  enabled: boolean;
  updatedAt: string;
}

const LOCAL_FEATURED_KEY = 'tstream_featured_content_v1';
const LOCAL_HIDDEN_KEY = 'tstream_hidden_titles_v1';

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, val: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export function buildFeaturedItemId(mediaType: MediaType, numericId: number | string): string {
  const cleanId = String(numericId).replace(/[^a-zA-Z0-9_-]/g, '');
  return `${mediaType}_${cleanId}`;
}

export async function listFeaturedContent(): Promise<FeaturedContentEntry[]> {
  const local = readLocalJson<FeaturedContentEntry[]>(LOCAL_FEATURED_KEY, []);
  if (isFirestoreQuotaExceeded()) {
    return local.sort((a, b) => a.order - b.order);
  }

  try {
    const snap = await getDocs(query(collection(db, 'featuredContent'), limit(50)));
    const items: FeaturedContentEntry[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (data?.id && data?.title && data?.mediaType) {
        items.push({
          id: String(data.id),
          mediaKey: String(data.mediaKey || data.id),
          mediaType: data.mediaType,
          title: String(data.title),
          order: typeof data.order === 'number' ? data.order : 0,
          enabled: Boolean(data.enabled),
          updatedAt: String(data.updatedAt || new Date().toISOString())
        });
      }
    });
    items.sort((a, b) => a.order - b.order);
    writeLocalJson(LOCAL_FEATURED_KEY, items);
    return items;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    return local.sort((a, b) => a.order - b.order);
  }
}

export async function saveFeaturedContentEntry(input: {
  mediaType: MediaType;
  numericId: number | string;
  title: string;
  order?: number;
  enabled?: boolean;
}): Promise<FeaturedContentEntry> {
  const cleanNum = String(input.numericId).replace(/[^a-zA-Z0-9_-]/g, '');
  const id = buildFeaturedItemId(input.mediaType, cleanNum);
  const entry: FeaturedContentEntry = {
    id,
    mediaKey: id,
    mediaType: input.mediaType,
    title: input.title.trim().slice(0, 300),
    order: Math.max(0, Math.min(1000, Math.round(input.order ?? 1))),
    enabled: input.enabled ?? true,
    updatedAt: new Date().toISOString()
  };

  const local = readLocalJson<FeaturedContentEntry[]>(LOCAL_FEATURED_KEY, []).filter(
    (item) => item.id !== id
  );
  local.push(entry);
  writeLocalJson(LOCAL_FEATURED_KEY, local);

  if (!isFirestoreQuotaExceeded()) {
    try {
      await setDoc(doc(db, 'featuredContent', id), entry);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      } else {
        throw err;
      }
    }
  }

  return entry;
}

export async function deleteFeaturedContentEntry(id: string): Promise<void> {
  const local = readLocalJson<FeaturedContentEntry[]>(LOCAL_FEATURED_KEY, []).filter(
    (item) => item.id !== id
  );
  writeLocalJson(LOCAL_FEATURED_KEY, local);

  if (!isFirestoreQuotaExceeded()) {
    try {
      await deleteDoc(doc(db, 'featuredContent', id));
    } catch (err) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      } else {
        throw err;
      }
    }
  }
}

export function getHiddenTitleKeys(): string[] {
  return readLocalJson<string[]>(LOCAL_HIDDEN_KEY, []);
}

export function toggleHiddenTitleKey(mediaKey: string): string[] {
  const current = new Set(getHiddenTitleKeys());
  if (current.has(mediaKey)) {
    current.delete(mediaKey);
  } else {
    current.add(mediaKey);
  }
  const arr = Array.from(current);
  writeLocalJson(LOCAL_HIDDEN_KEY, arr);
  return arr;
}
