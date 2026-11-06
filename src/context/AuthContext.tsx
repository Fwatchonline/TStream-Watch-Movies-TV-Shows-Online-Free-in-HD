import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  followShow,
  unfollowShow,
  subscribeToFollowedShows,
  saveEpisodeNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToEpisodeNotifications,
  UserProfile,
  WatchlistItem,
  ContinueWatchingRecord,
  FollowedShowItem,
  EpisodeNotification,
  User
} from '../services/firebase';
import { MediaItem } from '../types/media';
import { fetchTvLastEpisode } from '../services/newEpisodes';
import {
  loadUserPlayerSettingsFromFirestore,
  clearSessionPlayerSettings
} from '../services/playerSettings';

type AuthModalMode = 'login' | 'register' | 'profile' | 'watchlist';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  watchlist: WatchlistItem[];
  continueWatching: ContinueWatchingRecord[];
  followedShows: FollowedShowItem[];
  notifications: EpisodeNotification[];
  unreadNotificationsCount: number;
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
  toggleFollowShow: (show: Partial<MediaItem> & { id: number; title?: string }) => Promise<boolean>;
  isFollowingShow: (showId: number | string) => boolean;
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  checkFollowedShowsForNewEpisodes: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingRecord[]>([]);
  const [followedShows, setFollowedShows] = useState<FollowedShowItem[]>([]);
  const [notifications, setNotifications] = useState<EpisodeNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const checkingShowsRef = useRef(false);

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
          // Load registered user player and server settings directly from Firestore database
          await loadUserPlayerSettingsFromFirestore(currentUser.uid);
        } catch (err) {
          console.warn('Failed to sync profile or player settings:', err);
        }
      } else {
        setProfile(null);
        setWatchlist([]);
        setContinueWatching([]);
        setFollowedShows([]);
        setNotifications([]);
        clearSessionPlayerSettings();
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

  // Followed Shows Realtime Listener
  useEffect(() => {
    if (!user) {
      setFollowedShows([]);
      return;
    }

    const unsubscribeFollowed = subscribeToFollowedShows(user.uid, (items) => {
      setFollowedShows(items);
    });

    return () => unsubscribeFollowed();
  }, [user]);

  // Episode Notifications Realtime Listener
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const unsubscribeNotifs = subscribeToEpisodeNotifications(user.uid, (items) => {
      setNotifications(items);
    });

    return () => unsubscribeNotifs();
  }, [user]);

  // Automatic Checker: Scans followed shows for new episodes when shows load
  useEffect(() => {
    if (!user || followedShows.length === 0) return;

    // Run debounced check
    const timer = setTimeout(() => {
      checkFollowedShowsForNewEpisodes();
    }, 2500);

    return () => clearTimeout(timer);
  }, [user?.uid, followedShows.length]);

  /**
   * Scans followed TV series against TMDB to detect if a new episode aired
   * and creates an interactive alert notification if not yet registered.
   */
  const checkFollowedShowsForNewEpisodes = async () => {
    if (!user || checkingShowsRef.current || followedShows.length === 0) return;
    checkingShowsRef.current = true;

    try {
      for (const show of followedShows) {
        const tvId = parseInt(show.showId, 10);
        if (isNaN(tvId)) continue;

        const info = await fetchTvLastEpisode(tvId);
        if (!info || !info.lastEpisode) continue;

        const ep = info.lastEpisode;
        const notifId = `notif_${tvId}_s${ep.seasonNumber}_e${ep.episodeNumber}`;

        // Check if notification already exists
        const alreadyExists = notifications.some(n => n.id === notifId);
        if (!alreadyExists) {
          const newNotif: EpisodeNotification = {
            id: notifId,
            userId: user.uid,
            showId: String(tvId),
            showTitle: info.showTitle || show.title,
            posterPath: info.showPoster || show.posterPath,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
            episodeName: ep.name || `Episode ${ep.episodeNumber}`,
            airDate: ep.airDate || new Date().toISOString().slice(0, 10),
            read: false,
            createdAt: new Date().toISOString()
          };

          await saveEpisodeNotification(newNotif);
        }
      }
    } catch (err) {
      console.warn('Failed checking followed shows for new episodes:', err);
    } finally {
      checkingShowsRef.current = false;
    }
  };

  // Follow / Unfollow TV Series
  const isFollowingShow = (showId: number | string): boolean => {
    const idStr = String(showId);
    return followedShows.some(s => String(s.showId) === idStr);
  };

  const toggleFollowShow = async (show: Partial<MediaItem> & { id: number; title?: string }): Promise<boolean> => {
    if (!user) {
      openAuthModal('login');
      return false;
    }

    const showIdStr = String(show.id);
    const following = isFollowingShow(showIdStr);

    if (following) {
      await unfollowShow(user.uid, showIdStr);
      return false;
    } else {
      await followShow({
        userId: user.uid,
        showId: showIdStr,
        title: show.title || 'Untitled Series',
        posterPath: show.posterPath || undefined,
        backdropPath: show.backdropPath || undefined,
        voteAverage: show.voteAverage || 0
      });

      // Immediately check this show for its latest episode to welcome the user
      setTimeout(async () => {
        try {
          const info = await fetchTvLastEpisode(show.id);
          if (info && info.lastEpisode) {
            const ep = info.lastEpisode;
            const notifId = `notif_${show.id}_s${ep.seasonNumber}_e${ep.episodeNumber}`;
            await saveEpisodeNotification({
              id: notifId,
              userId: user.uid,
              showId: showIdStr,
              showTitle: info.showTitle || show.title || 'TV Series',
              posterPath: info.showPoster || show.posterPath,
              seasonNumber: ep.seasonNumber,
              episodeNumber: ep.episodeNumber,
              episodeName: ep.name,
              airDate: ep.airDate,
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        } catch {}
      }, 500);

      return true;
    }
  };

  const markNotificationRead = async (notifId: string): Promise<void> => {
    if (!user) return;
    await markNotificationAsRead(user.uid, notifId);
  };

  const markAllNotificationsRead = async (): Promise<void> => {
    if (!user) return;
    await markAllNotificationsAsRead(user.uid);
  };

  // Watchlist Actions
  const isInWatchlist = (tmdbId: number | string): boolean => {
    const idStr = String(tmdbId);
    return watchlist.some((item) => item.tmdbId === idStr);
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

  // Continue Watching Actions
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

  // Auth Operations
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
    setFollowedShows([]);
    setNotifications([]);
    closeAuthModal();
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        watchlist,
        continueWatching,
        followedShows,
        notifications,
        unreadNotificationsCount,
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
        saveContinueWatching,
        removeContinueWatching,
        getContinueWatchingItem,
        toggleFollowShow,
        isFollowingShow,
        markNotificationRead,
        markAllNotificationsRead,
        checkFollowedShowsForNewEpisodes
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
