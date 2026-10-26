import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  syncUserProfile,
  getUserProfile,
  addToWatchlist,
  removeFromWatchlist,
  subscribeToWatchlist,
  saveUserContinueWatching,
  removeUserContinueWatching,
  getUserContinueWatchingItem,
  subscribeToUserContinueWatching,
  UserProfile,
  WatchlistItem,
  ContinueWatchingRecord,
  User
} from '../services/firebase';
import { MediaItem } from '../types/media';

type AuthModalMode = 'login' | 'register' | 'profile' | 'watchlist';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  watchlist: WatchlistItem[];
  continueWatching: ContinueWatchingRecord[];
  loading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleWatchlist: (item: Partial<MediaItem> & { id: number; title?: string }) => Promise<boolean>;
  isInWatchlist: (tmdbId: number | string) => boolean;
  saveContinueWatching: (item: {
    tmdbId: string | number;
    mediaType: 'movie' | 'tv';
    title: string;
    posterPath?: string;
    backdropPath?: string;
    progressSeconds: number;
    durationSeconds: number;
    seasonNumber?: number;
    episodeNumber?: number;
    episodeName?: string;
  }) => Promise<void>;
  removeContinueWatching: (mediaType: 'movie' | 'tv', tmdbId: string | number) => Promise<void>;
  getContinueWatchingItem: (mediaType: 'movie' | 'tv', tmdbId: string | number) => Promise<ContinueWatchingRecord | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // Auth State Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const prof = await syncUserProfile(currentUser);
          setProfile(prof);
        } catch (err) {
          console.warn('Failed to sync profile:', err);
        }
      } else {
        setProfile(null);
        setWatchlist([]);
        setContinueWatching([]);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Watchlist Listener when user is authenticated
  useEffect(() => {
    if (!user) {
      setWatchlist([]);
      return;
    }

    const unsubscribeWatchlist = subscribeToWatchlist(user.uid, (items) => {
      setWatchlist(items);
    });

    return () => unsubscribeWatchlist();
  }, [user]);

  // Continue Watching Listener (exclusively for registered users)
  useEffect(() => {
    if (!user) {
      setContinueWatching([]);
      return;
    }

    const unsubscribeContinue = subscribeToUserContinueWatching(user.uid, (items) => {
      setContinueWatching(items);
    });

    return () => unsubscribeContinue();
  }, [user]);

  // Actions
  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const p = await syncUserProfile(result.user);
      setProfile(p);
      closeAuthModal();
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    if (result.user) {
      const p = await syncUserProfile(result.user);
      setProfile(p);
      closeAuthModal();
    }
  };

  const registerWithEmail = async (email: string, pass: string, displayName: string) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (result.user) {
      if (displayName.trim()) {
        await updateProfile(result.user, { displayName: displayName.trim() });
      }
      const p = await syncUserProfile(result.user, displayName.trim());
      setProfile(p);
      closeAuthModal();
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setWatchlist([]);
    setContinueWatching([]);
    closeAuthModal();
  };

  const isInWatchlist = (tmdbId: number | string): boolean => {
    const idStr = String(tmdbId);
    return watchlist.some((item) => item.tmdbId === idStr);
  };

  const saveContinueWatching = async (item: {
    tmdbId: string | number;
    mediaType: 'movie' | 'tv';
    title: string;
    posterPath?: string;
    backdropPath?: string;
    progressSeconds: number;
    durationSeconds: number;
    seasonNumber?: number;
    episodeNumber?: number;
    episodeName?: string;
  }): Promise<void> => {
    // Continue watching is strictly for registered users
    if (!user) return;

    const payload: any = {
      userId: user.uid,
      tmdbId: String(item.tmdbId),
      mediaType: item.mediaType,
      title: item.title,
      progressSeconds: item.progressSeconds,
      durationSeconds: item.durationSeconds,
      percentage: item.durationSeconds > 0
        ? Math.min(100, Math.max(1, Math.round((item.progressSeconds / item.durationSeconds) * 100)))
        : 1
    };

    if (item.posterPath) payload.posterPath = item.posterPath;
    if (item.backdropPath) payload.backdropPath = item.backdropPath;
    if (typeof item.seasonNumber === 'number' && !isNaN(item.seasonNumber)) {
      payload.seasonNumber = item.seasonNumber;
    }
    if (typeof item.episodeNumber === 'number' && !isNaN(item.episodeNumber)) {
      payload.episodeNumber = item.episodeNumber;
    }
    if (item.episodeName) payload.episodeName = item.episodeName;

    await saveUserContinueWatching(payload);
  };

  const removeContinueWatching = async (
    mediaType: 'movie' | 'tv',
    tmdbId: string | number
  ): Promise<void> => {
    if (!user) return;
    await removeUserContinueWatching(user.uid, mediaType, tmdbId);
  };

  const getContinueWatchingItem = async (
    mediaType: 'movie' | 'tv',
    tmdbId: string | number
  ): Promise<ContinueWatchingRecord | null> => {
    if (!user) return null;
    return getUserContinueWatchingItem(user.uid, mediaType, tmdbId);
  };

  const toggleWatchlist = async (item: Partial<MediaItem> & { id: number; title?: string }): Promise<boolean> => {
    if (!user) {
      openAuthModal('login');
      return false;
    }

    const idStr = String(item.id);
    const exists = isInWatchlist(idStr);

    if (exists) {
      await removeFromWatchlist(user.uid, idStr);
      return false;
    } else {
      await addToWatchlist({
        userId: user.uid,
        tmdbId: idStr,
        mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
        title: item.title || 'Untitled',
        posterPath: item.posterPath || undefined,
        voteAverage: item.voteAverage || 0,
        releaseDate: item.releaseDate || ''
      });
      return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        watchlist,
        loading,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        logout,
        toggleWatchlist,
        isInWatchlist,
        continueWatching,
        saveContinueWatching,
        removeContinueWatching,
        getContinueWatchingItem
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
