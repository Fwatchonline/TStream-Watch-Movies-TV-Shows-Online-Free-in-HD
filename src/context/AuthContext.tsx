import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  addToWatchlist,
  removeFromWatchlist,
  subscribeToWatchlist,
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
  isFirestoreQuotaExceeded,
  UserProfile,
  WatchlistItem,
  ContinueWatchingRecord,
  FollowedShowItem,
  EpisodeNotification,
  User
} from '../services/firebase';
import {
  MediaItem,
  MediaType,
  WatchHistoryRecord,
  CompletedMediaRecord
} from '../types/media';
import { fetchTvLastEpisode } from '../services/newEpisodes';
import {
  loadUserPlayerSettingsFromFirestore,
  clearSessionPlayerSettings
} from '../services/playerSettings';
import {
  getContinueWatching as getGuestContinueWatching,
  removeContinueWatching as removeGuestContinueWatching,
  getGuestWatchHistory,
  getGuestCompletedMedia,
  getGuestWatchProgressItem,
  getWatchlist as getGuestWatchlist,
  toggleWatchlist as toggleGuestWatchlist
} from '../services/storage';
import {
  recordWatchProgress,
  mergeGuestDataToAccount,
  subscribeToUserWatchHistory,
  subscribeToUserCompleted,
  removeUserHistoryItem,
  clearUserWatchHistory,
  removeUserCompletedItem,
  clearUserCompleted
} from '../services/watchHistory';
import { buildMediaKey, buildSeriesKey } from '../utils/mediaKey';

type AuthModalMode = 'login' | 'register' | 'profile' | 'watchlist';

export interface SaveContinueWatchingInput {
  tmdbId: string | number;
  mediaType: MediaType;
  anilistId?: number;
  malId?: number;
  mediaFormat?: string;
  title: string;
  posterPath?: string;
  backdropPath?: string;
  progressSeconds: number;
  durationSeconds: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeName?: string;
  genres?: string[];
  serverId?: string;
  audioLang?: string;
  forceSync?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  watchlist: WatchlistItem[];
  continueWatching: ContinueWatchingRecord[];
  watchHistory: WatchHistoryRecord[];
  completedMedia: CompletedMediaRecord[];
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
  isInWatchlist: (tmdbId: number | string, mediaType?: MediaType) => boolean;
  saveContinueWatching: (item: SaveContinueWatchingInput) => Promise<void>;
  removeContinueWatching: (mediaType: MediaType, tmdbId: string | number) => Promise<void>;
  getContinueWatchingItem: (
    mediaType: MediaType,
    tmdbId: string | number,
    seasonNumber?: number,
    episodeNumber?: number
  ) => Promise<ContinueWatchingRecord | null>;
  removeHistoryItem: (mediaKey: string) => Promise<void>;
  clearWatchHistory: () => Promise<void>;
  removeCompletedItem: (mediaKey: string) => Promise<void>;
  clearCompletedMedia: () => Promise<void>;
  toggleFollowShow: (show: Partial<MediaItem> & { id: number; title?: string }) => Promise<boolean>;
  isFollowingShow: (showId: number | string) => boolean;
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  checkFollowedShowsForNewEpisodes: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapGuestContinueToRecords(): ContinueWatchingRecord[] {
  return getGuestContinueWatching().map((item) => ({
    userId: 'guest',
    tmdbId: String(item.mediaType === 'anime' ? (item.anilistId || item.id) : (item.tmdbId || item.id)),
    mediaKey: item.mediaKey || buildMediaKey({
      mediaType: item.mediaType,
      tmdbId: item.tmdbId ?? (item.mediaType !== 'anime' ? item.id : undefined),
      anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
      id: item.id,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber
    }),
    anilistId: item.anilistId ?? (item.mediaType === 'anime' ? item.id : undefined),
    malId: item.malId,
    mediaType: item.mediaType,
    title: item.title,
    posterPath: item.posterPath,
    backdropPath: item.backdropPath,
    progressSeconds: item.progressSeconds,
    durationSeconds: item.durationSeconds,
    percentage: item.percentage ?? 1,
    seasonNumber: item.seasonNumber,
    episodeNumber: item.episodeNumber,
    episodeName: item.episodeName,
    completed: item.completed,
    updatedAt: item.lastWatched
  }));
}

function mapGuestWatchlistToRecords(): WatchlistItem[] {
  return getGuestWatchlist().map((w) => ({
    userId: 'guest',
    tmdbId: String(w.mediaType === 'anime' ? (w.anilistId || w.id) : (w.tmdbId || w.id)),
    mediaKey: w.mediaKey || buildSeriesKey({
      mediaType: w.mediaType,
      tmdbId: w.tmdbId ?? (w.mediaType !== 'anime' ? w.id : undefined),
      anilistId: w.anilistId ?? (w.mediaType === 'anime' ? w.id : undefined),
      id: w.id
    }),
    anilistId: w.anilistId ?? (w.mediaType === 'anime' ? w.id : undefined),
    malId: w.malId,
    mediaType: w.mediaType,
    title: w.title,
    posterPath: w.posterPath,
    backdropPath: w.backdropPath,
    voteAverage: w.voteAverage,
    releaseDate: w.releaseDate,
    addedAt: w.addedAt
  }));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => mapGuestWatchlistToRecords());
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingRecord[]>(() => mapGuestContinueToRecords());
  const [watchHistory, setWatchHistory] = useState<WatchHistoryRecord[]>(() => getGuestWatchHistory());
  const [completedMedia, setCompletedMedia] = useState<CompletedMediaRecord[]>(() => getGuestCompletedMedia());
  const [followedShows, setFollowedShows] = useState<FollowedShowItem[]>([]);
  const [notifications, setNotifications] = useState<EpisodeNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const checkingShowsRef = useRef(false);
  const mergedUidRef = useRef<string | null>(null);
  const notificationsRef = useRef<EpisodeNotification[]>([]);
  notificationsRef.current = notifications;
  const watchlistRef = useRef<WatchlistItem[]>([]);
  watchlistRef.current = watchlist;
  const followedShowsRef = useRef<FollowedShowItem[]>([]);
  followedShowsRef.current = followedShows;

  const openAuthModal = useCallback((mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  // Auth State Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const prof = await syncUserProfile(currentUser);
          setProfile(prof);
          if (mergedUidRef.current !== currentUser.uid) {
            mergedUidRef.current = currentUser.uid;
            await mergeGuestDataToAccount(currentUser.uid);
          }
          // Load registered user player and server settings directly from Firestore database
          await loadUserPlayerSettingsFromFirestore(currentUser.uid);
        } catch (err) {
          console.warn('Failed to sync profile, merge guest history, or load settings:', err);
        }
      } else {
        mergedUidRef.current = null;
        setProfile(null);
        setFollowedShows([]);
        setNotifications([]);
        clearSessionPlayerSettings();
        setWatchlist(mapGuestWatchlistToRecords());
        setContinueWatching(mapGuestContinueToRecords());
        setWatchHistory(getGuestWatchHistory());
        setCompletedMedia(getGuestCompletedMedia());
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Guest Local Storage Synchronizer (keeps Continue Watching, History, Completed, Watchlist reactive without login)
  useEffect(() => {
    if (user) return;
    const syncGuest = () => {
      setWatchlist(mapGuestWatchlistToRecords());
      setContinueWatching(mapGuestContinueToRecords());
      setWatchHistory(getGuestWatchHistory());
      setCompletedMedia(getGuestCompletedMedia());
    };
    syncGuest();
    window.addEventListener('tstream:storage_update', syncGuest);
    return () => window.removeEventListener('tstream:storage_update', syncGuest);
  }, [user]);

  // Watchlist Listener when user is authenticated
  useEffect(() => {
    if (!user) return;

    const unsubscribeWatchlist = subscribeToWatchlist(user.uid, (items) => {
      setWatchlist(items);
    });

    return () => unsubscribeWatchlist();
  }, [user]);

  // Continue Watching Listener (authenticated users; guests handled via localStorage listener above)
  useEffect(() => {
    if (!user) return;

    const unsubscribeContinue = subscribeToUserContinueWatching(user.uid, (items) => {
      setContinueWatching(items);
    });

    return () => unsubscribeContinue();
  }, [user]);

  // Watch History & Completed Listeners (authenticated users)
  useEffect(() => {
    if (!user) return;

    const unsubHistory = subscribeToUserWatchHistory(user.uid, (items) => {
      setWatchHistory(items);
    });
    const unsubCompleted = subscribeToUserCompleted(user.uid, (items) => {
      setCompletedMedia(items);
    });

    return () => {
      unsubHistory();
      unsubCompleted();
    };
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
  const checkFollowedShowsForNewEpisodes = useCallback(async () => {
    const currentFollowed = followedShowsRef.current;
    if (!user || checkingShowsRef.current || currentFollowed.length === 0 || isFirestoreQuotaExceeded()) return;
    checkingShowsRef.current = true;

    let cachedNotifIds = new Set<string>();
    try {
      const raw = localStorage.getItem(`tstream_notifs_${user.uid}`);
      if (raw) {
        const parsed = JSON.parse(raw) as EpisodeNotification[];
        parsed.forEach((n) => cachedNotifIds.add(n.id));
      }
    } catch {}

    try {
      for (const show of currentFollowed) {
        if (isFirestoreQuotaExceeded()) break;
        const tvId = parseInt(show.showId, 10);
        if (isNaN(tvId)) continue;

        const info = await fetchTvLastEpisode(tvId);
        if (!info || !info.lastEpisode) continue;

        const ep = info.lastEpisode;
        const notifId = `notif_${tvId}_s${ep.seasonNumber}_e${ep.episodeNumber}`;

        // Check if notification already exists in state or local cache
        const alreadyExists =
          cachedNotifIds.has(notifId) ||
          notificationsRef.current.some(n => n.id === notifId);
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
  }, [user]);

  // Follow / Unfollow TV Series
  const isFollowingShow = useCallback((showId: number | string): boolean => {
    const idStr = String(showId);
    return followedShows.some(s => String(s.showId) === idStr);
  }, [followedShows]);

  const toggleFollowShow = useCallback(async (show: Partial<MediaItem> & { id: number; title?: string }): Promise<boolean> => {
    if (!user) {
      openAuthModal('login');
      return false;
    }

    const showIdStr = String(show.id);
    const following = followedShowsRef.current.some(s => String(s.showId) === showIdStr);

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
  }, [user, openAuthModal]);

  const markNotificationRead = useCallback(async (notifId: string): Promise<void> => {
    if (!user) return;
    await markNotificationAsRead(user.uid, notifId);
  }, [user]);

  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    if (!user) return;
    await markAllNotificationsAsRead(user.uid);
  }, [user]);

  // Watchlist Actions (Guest + Cloud, Movie/TV/Anime)
  const isInWatchlist = useCallback((tmdbId: number | string, mediaType?: MediaType): boolean => {
    const idStr = String(tmdbId);
    return watchlist.some((item) => {
      if (mediaType && item.mediaType !== mediaType) return false;
      return (
        item.tmdbId === idStr ||
        item.mediaKey === idStr ||
        (item.anilistId !== undefined && String(item.anilistId) === idStr)
      );
    });
  }, [watchlist]);

  const toggleWatchlist = useCallback(async (item: Partial<MediaItem> & { id: number; title?: string }): Promise<boolean> => {
    const resolvedType: MediaType = item.mediaType === 'anime' ? 'anime' : item.mediaType === 'tv' ? 'tv' : 'movie';
    const seriesKey = buildSeriesKey({
      mediaType: resolvedType,
      tmdbId: item.tmdbId ?? (resolvedType !== 'anime' ? item.id : undefined),
      anilistId: item.anilistId ?? (resolvedType === 'anime' ? item.id : undefined),
      id: item.id
    });

    if (!user) {
      const added = toggleGuestWatchlist({
        id: item.id,
        mediaType: resolvedType,
        title: item.title || 'Untitled',
        posterPath: item.posterPath || '',
        backdropPath: item.backdropPath || '',
        releaseDate: item.releaseDate || '',
        voteAverage: item.voteAverage || 0,
        tmdbId: item.tmdbId,
        anilistId: item.anilistId,
        malId: item.malId,
        mediaFormat: item.mediaFormat
      });
      setWatchlist(mapGuestWatchlistToRecords());
      return added;
    }

    const idStr = String(resolvedType === 'anime' ? (item.anilistId || item.id) : (item.tmdbId || item.id));
    const exists = watchlistRef.current.some((w) => (
      w.mediaKey === seriesKey ||
      (w.tmdbId === idStr && w.mediaType === resolvedType) ||
      (resolvedType !== 'anime' && w.tmdbId === idStr && !w.mediaKey)
    ));

    if (exists) {
      const existingItem = watchlistRef.current.find((w) => (
        w.mediaKey === seriesKey ||
        (w.tmdbId === idStr && w.mediaType === resolvedType) ||
        w.tmdbId === idStr
      ));
      await removeFromWatchlist(user.uid, existingItem?.mediaKey || seriesKey || idStr);
      if (existingItem?.tmdbId && existingItem.tmdbId !== existingItem.mediaKey) {
        await removeFromWatchlist(user.uid, existingItem.tmdbId).catch(() => {});
      }
      return false;
    } else {
      await addToWatchlist({
        userId: user.uid,
        tmdbId: idStr,
        mediaKey: seriesKey,
        anilistId: item.anilistId ?? (resolvedType === 'anime' ? item.id : undefined),
        malId: item.malId,
        mediaType: resolvedType,
        title: item.title || 'Untitled',
        posterPath: item.posterPath || undefined,
        backdropPath: item.backdropPath || undefined,
        voteAverage: item.voteAverage || 0,
        releaseDate: item.releaseDate || ''
      });
      return true;
    }
  }, [user]);

  // Unified Watch Progress & Continue Watching Actions (works seamlessly for BOTH guests and registered users)
  const saveContinueWatching = useCallback(async (item: SaveContinueWatchingInput): Promise<void> => {
    const rec = await recordWatchProgress({
      userId: user?.uid || null,
      mediaType: item.mediaType,
      tmdbId: item.tmdbId,
      anilistId: item.anilistId,
      malId: item.malId,
      id: item.tmdbId,
      mediaFormat: item.mediaFormat,
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      seasonNumber: item.seasonNumber,
      episodeNumber: item.episodeNumber,
      episodeName: item.episodeName,
      progressSeconds: item.progressSeconds,
      durationSeconds: item.durationSeconds,
      genres: item.genres,
      serverId: item.serverId,
      audioLang: item.audioLang,
      forceSync: item.forceSync
    });

    if (!user) {
      setContinueWatching(mapGuestContinueToRecords());
      setWatchHistory(getGuestWatchHistory());
      if (rec.completed) {
        setCompletedMedia(getGuestCompletedMedia());
      }
    }
  }, [user]);

  const removeContinueWatching = useCallback(async (
    mediaType: MediaType,
    tmdbId: string | number
  ): Promise<void> => {
    const numId = parseInt(String(tmdbId), 10);
    if (!isNaN(numId)) {
      removeGuestContinueWatching(numId, mediaType);
    }
    if (!user) {
      setContinueWatching(mapGuestContinueToRecords());
      return;
    }
    await removeUserContinueWatching(user.uid, mediaType, tmdbId);
  }, [user]);

  const getContinueWatchingItem = useCallback(async (
    mediaType: MediaType,
    tmdbId: string | number,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<ContinueWatchingRecord | null> => {
    // Prefer episode-specific unified watch history if available
    const mediaKey = buildMediaKey({
      mediaType,
      tmdbId: mediaType !== 'anime' ? tmdbId : undefined,
      anilistId: mediaType === 'anime' ? Number(tmdbId) : undefined,
      id: tmdbId,
      seasonNumber,
      episodeNumber
    });
    const localProgress = getGuestWatchProgressItem(mediaKey);

    if (!user) {
      if (localProgress) {
        return {
          userId: 'guest',
          tmdbId: String(tmdbId),
          mediaKey: localProgress.mediaKey,
          anilistId: localProgress.anilistId,
          malId: localProgress.malId,
          mediaType: localProgress.mediaType,
          title: localProgress.title,
          posterPath: localProgress.posterPath,
          backdropPath: localProgress.backdropPath,
          progressSeconds: localProgress.progressSeconds,
          durationSeconds: localProgress.durationSeconds,
          percentage: localProgress.percentage,
          seasonNumber: localProgress.seasonNumber,
          episodeNumber: localProgress.episodeNumber,
          episodeName: localProgress.episodeName,
          completed: localProgress.completed,
          updatedAt: localProgress.updatedAt
        };
      }
      const cw = getGuestContinueWatching().find(
        (c) => c.mediaType === mediaType && String(c.tmdbId || c.anilistId || c.id) === String(tmdbId)
      );
      if (!cw) return null;
      return {
        userId: 'guest',
        tmdbId: String(tmdbId),
        mediaKey: cw.mediaKey,
        anilistId: cw.anilistId,
        malId: cw.malId,
        mediaType: cw.mediaType,
        title: cw.title,
        posterPath: cw.posterPath,
        backdropPath: cw.backdropPath,
        progressSeconds: cw.progressSeconds,
        durationSeconds: cw.durationSeconds,
        percentage: cw.percentage ?? 1,
        seasonNumber: cw.seasonNumber,
        episodeNumber: cw.episodeNumber,
        episodeName: cw.episodeName,
        completed: cw.completed,
        updatedAt: cw.lastWatched
      };
    }

    const cloudCw = await getUserContinueWatchingItem(user.uid, mediaType, tmdbId);
    if (cloudCw) return cloudCw;

    const historyMatch = watchHistory.find((h) => h.mediaKey === mediaKey) || localProgress;
    if (historyMatch) {
      return {
        userId: user.uid,
        tmdbId: String(tmdbId),
        mediaKey: historyMatch.mediaKey,
        anilistId: historyMatch.anilistId,
        malId: historyMatch.malId,
        mediaType: historyMatch.mediaType,
        title: historyMatch.title,
        posterPath: historyMatch.posterPath,
        backdropPath: historyMatch.backdropPath,
        progressSeconds: historyMatch.progressSeconds,
        durationSeconds: historyMatch.durationSeconds,
        percentage: historyMatch.percentage,
        seasonNumber: historyMatch.seasonNumber,
        episodeNumber: historyMatch.episodeNumber,
        episodeName: historyMatch.episodeName,
        completed: historyMatch.completed,
        updatedAt: historyMatch.updatedAt
      };
    }

    return null;
  }, [user, watchHistory]);

  const removeHistoryItem = useCallback(async (mediaKey: string): Promise<void> => {
    await removeUserHistoryItem(user?.uid, mediaKey);
    if (!user) {
      setWatchHistory(getGuestWatchHistory());
    }
  }, [user]);

  const clearWatchHistory = useCallback(async (): Promise<void> => {
    await clearUserWatchHistory(user?.uid);
    setWatchHistory([]);
  }, [user]);

  const removeCompletedItem = useCallback(async (mediaKey: string): Promise<void> => {
    await removeUserCompletedItem(user?.uid, mediaKey);
    if (!user) {
      setCompletedMedia(getGuestCompletedMedia());
    }
  }, [user]);

  const clearCompletedMedia = useCallback(async (): Promise<void> => {
    await clearUserCompleted(user?.uid);
    setCompletedMedia([]);
  }, [user]);

  // Auth Operations
  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const p = await syncUserProfile(result.user);
      setProfile(p);
      closeAuthModal();
    }
  }, [closeAuthModal]);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    if (result.user) {
      const p = await syncUserProfile(result.user);
      setProfile(p);
      closeAuthModal();
    }
  }, [closeAuthModal]);

  const registerWithEmail = useCallback(async (email: string, pass: string, displayName: string) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (result.user) {
      if (displayName.trim()) {
        await updateProfile(result.user, { displayName: displayName.trim() });
      }
      const p = await syncUserProfile(result.user, displayName.trim());
      setProfile(p);
      closeAuthModal();
    }
  }, [closeAuthModal]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setFollowedShows([]);
    setNotifications([]);
    setWatchlist(mapGuestWatchlistToRecords());
    setContinueWatching(mapGuestContinueToRecords());
    setWatchHistory(getGuestWatchHistory());
    setCompletedMedia(getGuestCompletedMedia());
    closeAuthModal();
  }, [closeAuthModal]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    profile,
    watchlist,
    continueWatching,
    watchHistory,
    completedMedia,
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
    removeHistoryItem,
    clearWatchHistory,
    removeCompletedItem,
    clearCompletedMedia,
    toggleFollowShow,
    isFollowingShow,
    markNotificationRead,
    markAllNotificationsRead,
    checkFollowedShowsForNewEpisodes
  }), [
    user,
    profile,
    watchlist,
    continueWatching,
    watchHistory,
    completedMedia,
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
    removeHistoryItem,
    clearWatchHistory,
    removeCompletedItem,
    clearCompletedMedia,
    toggleFollowShow,
    isFollowingShow,
    markNotificationRead,
    markAllNotificationsRead,
    checkFollowedShowsForNewEpisodes
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
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
