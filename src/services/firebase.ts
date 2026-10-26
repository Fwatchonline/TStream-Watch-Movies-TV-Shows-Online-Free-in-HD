import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Operation Types for error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Critical connection test as mandated by Firebase integration guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client appears offline or connecting:", error.message);
    }
  }
}
testConnection();

// User Profile Model
export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
}

// Watchlist Model
export interface WatchlistItem {
  userId: string;
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  voteAverage?: number;
  releaseDate?: string;
  addedAt: string;
}

/**
 * Creates or updates the user profile record in Firestore
 */
export async function syncUserProfile(user: User, customDisplayName?: string): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();

  const userProfile: UserProfile = {
    userId: user.uid,
    email: user.email || '',
    displayName: customDisplayName || user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || '',
    createdAt: now,
    updatedAt: now
  };

  try {
    const existing = await getDoc(userRef);
    if (existing.exists()) {
      const data = existing.data() as UserProfile;
      userProfile.createdAt = data.createdAt || now;
      await setDoc(userRef, { ...userProfile, updatedAt: now }, { merge: true });
    } else {
      await setDoc(userRef, userProfile);
    }
    return userProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

/**
 * Fetch user profile from Firestore
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${userId}`);
  }
}

/**
 * Strips undefined values from an object before saving to Firestore,
 * as Firestore throws an error when any field is undefined.
 */
export function cleanFirestoreObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && val !== null) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

/**
 * Add an item to user's private watchlist
 */
export async function addToWatchlist(item: Omit<WatchlistItem, 'addedAt'>): Promise<void> {
  const path = `users/${item.userId}/watchlist/${item.tmdbId}`;
  try {
    const itemRef = doc(db, 'users', item.userId, 'watchlist', String(item.tmdbId));
    const fullItem = cleanFirestoreObject({
      ...item,
      addedAt: new Date().toISOString()
    });
    await setDoc(itemRef, fullItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Remove an item from user's private watchlist
 */
export async function removeFromWatchlist(userId: string, tmdbId: string | number): Promise<void> {
  const path = `users/${userId}/watchlist/${tmdbId}`;
  try {
    const itemRef = doc(db, 'users', userId, 'watchlist', String(tmdbId));
    await deleteDoc(itemRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to realtime watchlist updates for the logged in user
 */
export function subscribeToWatchlist(userId: string, onUpdate: (items: WatchlistItem[]) => void): Unsubscribe {
  const watchlistCol = collection(db, 'users', userId, 'watchlist');
  return onSnapshot(
    watchlistCol,
    (snapshot) => {
      const items: WatchlistItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as WatchlistItem);
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${userId}/watchlist`);
    }
  );
}

// Continue Watching Model for Registered Users
export interface ContinueWatchingRecord {
  userId: string;
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  backdropPath?: string;
  progressSeconds: number;
  durationSeconds: number;
  percentage: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  updatedAt: string;
}

/**
 * Save or update continue watching record in Firestore (registered users only)
 */
export async function saveUserContinueWatching(
  item: Omit<ContinueWatchingRecord, 'updatedAt'>
): Promise<void> {
  const docId = `${item.mediaType}_${item.tmdbId}`;
  const path = `users/${item.userId}/continueWatching/${docId}`;
  try {
    const itemRef = doc(db, 'users', item.userId, 'continueWatching', docId);
    const percentage = item.durationSeconds > 0
      ? Math.min(100, Math.max(1, Math.round((item.progressSeconds / item.durationSeconds) * 100)))
      : 1;

    const baseRecord: Record<string, any> = {
      userId: item.userId,
      tmdbId: String(item.tmdbId),
      mediaType: item.mediaType,
      title: item.title,
      progressSeconds: item.progressSeconds,
      durationSeconds: item.durationSeconds,
      percentage,
      updatedAt: new Date().toISOString()
    };

    if (item.posterPath) baseRecord.posterPath = item.posterPath;
    if (item.backdropPath) baseRecord.backdropPath = item.backdropPath;
    if (typeof item.seasonNumber === 'number' && !isNaN(item.seasonNumber)) {
      baseRecord.seasonNumber = item.seasonNumber;
    }
    if (typeof item.episodeNumber === 'number' && !isNaN(item.episodeNumber)) {
      baseRecord.episodeNumber = item.episodeNumber;
    }
    if (item.episodeName) baseRecord.episodeName = item.episodeName;

    const payload = cleanFirestoreObject(baseRecord);
    await setDoc(itemRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Remove an item from user's continue watching
 */
export async function removeUserContinueWatching(
  userId: string,
  mediaType: 'movie' | 'tv',
  tmdbId: string | number
): Promise<void> {
  const docId = `${mediaType}_${tmdbId}`;
  const path = `users/${userId}/continueWatching/${docId}`;
  try {
    const itemRef = doc(db, 'users', userId, 'continueWatching', docId);
    await deleteDoc(itemRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/**
 * Fetch a single continue watching record for auto-resume
 */
export async function getUserContinueWatchingItem(
  userId: string,
  mediaType: 'movie' | 'tv',
  tmdbId: string | number
): Promise<ContinueWatchingRecord | null> {
  const docId = `${mediaType}_${tmdbId}`;
  const path = `users/${userId}/continueWatching/${docId}`;
  try {
    const itemRef = doc(db, 'users', userId, 'continueWatching', docId);
    const snap = await getDoc(itemRef);
    if (snap.exists()) {
      return snap.data() as ContinueWatchingRecord;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Subscribe to realtime continue watching updates for the logged in user
 */
export function subscribeToUserContinueWatching(
  userId: string,
  onUpdate: (items: ContinueWatchingRecord[]) => void
): Unsubscribe {
  const colRef = collection(db, 'users', userId, 'continueWatching');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: ContinueWatchingRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ContinueWatchingRecord);
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${userId}/continueWatching`);
    }
  );
}

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged
};
export type { User };

