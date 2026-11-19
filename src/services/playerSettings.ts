import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirestoreQuotaExceeded, markFirestoreQuotaExceeded, isQuotaExceededError } from './firebase';
import { getUserSettings, updateUserSettings } from './storage';

export type AnimeAudioPreference = 'sub' | 'dub' | 'auto';

export interface UserPlayerSettings {
  defaultServerId: string;
  autoFallbackServer: boolean;
  rememberLastServer: boolean;
  defaultSubtitleLang: string;
  autoLoadSubtitles: boolean;
  subtitleSize: 'small' | 'medium' | 'large' | 'xlarge';
  subtitleColor: string;
  subtitleBackground: 'shadow' | 'box' | 'outline' | 'none';
  subtitlePosition: 'bottom' | 'top';
  subtitleDelay: number;
  defaultQuality: 'Auto' | '2160p' | '1080p' | '720p' | '480p';
  autoplayNextEpisode: boolean;
  autoPlayNextSeason: boolean;
  nextEpisodeCountdownSeconds: number;
  autoSkipIntro: boolean;
  skipRecap: boolean;
  skipCredits: boolean;
  autoResumePlayback: boolean;
  maintainFullscreen: boolean;
  preferredAudioLang: string;
  animeAudioPreference: AnimeAudioPreference;
  defaultSpeed: number;
  playerAccentColor: string;
  defaultTheaterMode: boolean;
}

export const DEFAULT_PLAYER_SETTINGS: UserPlayerSettings = {
  defaultServerId: 'server_1_direct',
  autoFallbackServer: true,
  rememberLastServer: true,
  defaultSubtitleLang: 'exyu',
  autoLoadSubtitles: true,
  subtitleSize: 'medium',
  subtitleColor: '#FFFFFF',
  subtitleBackground: 'shadow',
  subtitlePosition: 'bottom',
  subtitleDelay: 0,
  defaultQuality: 'Auto',
  autoplayNextEpisode: true,
  autoPlayNextSeason: true,
  nextEpisodeCountdownSeconds: 5,
  autoSkipIntro: false,
  skipRecap: false,
  skipCredits: false,
  autoResumePlayback: true,
  maintainFullscreen: true,
  preferredAudioLang: 'auto',
  animeAudioPreference: 'sub',
  defaultSpeed: 1,
  playerAccentColor: '#F5C400',
  defaultTheaterMode: false
};

export const SUBTITLE_LANGUAGES = [
  { code: 'exyu', name: 'Bosnian / Croatian / Serbian (BHS Auto)', flag: '🇧🇦 🇭🇷 🇷🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'sl', name: 'Slovenian', flag: '🇸🇮' },
  { code: 'mk', name: 'Macedonian', flag: '🇲🇰' },
  { code: 'bs', name: 'Bosnian', flag: '🇧🇦' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
  { code: 'sr', name: 'Serbian', flag: '🇷🇸' },
  { code: 'off', name: 'Off (No Subtitles)', flag: '🚫' }
];

const GUEST_PLAYER_SETTINGS_KEY = 'tstream_guest_player_settings_v1';

function readGuestSettingsFromStorage(): UserPlayerSettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(GUEST_PLAYER_SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_PLAYER_SETTINGS, ...JSON.parse(raw) };
      }
    }
  } catch {}
  return { ...DEFAULT_PLAYER_SETTINGS };
}

function writeGuestSettingsToStorage(settings: UserPlayerSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GUEST_PLAYER_SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch {}
}

let currentSessionSettings: UserPlayerSettings = readGuestSettingsFromStorage();
let currentActiveUserId: string | null = null;

function sanitizeSettingsPatch(patch: Partial<UserPlayerSettings>): Partial<UserPlayerSettings> {
  const next = { ...patch };
  if (typeof next.nextEpisodeCountdownSeconds === 'number') {
    next.nextEpisodeCountdownSeconds = Math.max(0, Math.min(15, Math.round(next.nextEpisodeCountdownSeconds)));
  }
  if (typeof next.subtitleDelay === 'number') {
    next.subtitleDelay = Math.max(-10, Math.min(10, Math.round(next.subtitleDelay * 10) / 10));
  }
  return next;
}

/**
 * Returns current player and server settings synchronously (reads guest localStorage if unauthenticated).
 */
export function getUserPlayerSettings(): UserPlayerSettings {
  if (!currentActiveUserId && !auth?.currentUser?.uid) {
    const fromStorage = readGuestSettingsFromStorage();
    currentSessionSettings = fromStorage;
  }
  return { ...currentSessionSettings };
}

/**
 * Reset active cloud user session back to local guest settings on sign out.
 */
export function clearSessionPlayerSettings(): void {
  currentActiveUserId = null;
  currentSessionSettings = readGuestSettingsFromStorage();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tstream_player_settings_changed', { detail: currentSessionSettings })
    );
  }
}

/**
 * Load user settings from Firestore `users/{uid}` (or preferences/player doc fallback).
 */
export async function loadUserPlayerSettingsFromFirestore(userId: string): Promise<UserPlayerSettings> {
  if (!userId) {
    clearSessionPlayerSettings();
    return getUserPlayerSettings();
  }

  currentActiveUserId = userId;

  const readCachedUserSettings = (): UserPlayerSettings => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`tstream_settings_${userId}`);
        if (raw) {
          return { ...DEFAULT_PLAYER_SETTINGS, ...JSON.parse(raw) };
        }
      }
    } catch {}
    return readGuestSettingsFromStorage();
  };

  if (isFirestoreQuotaExceeded()) {
    currentSessionSettings = readCachedUserSettings();
    return { ...currentSessionSettings };
  }

  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data?.playerSettings) {
        currentSessionSettings = {
          ...DEFAULT_PLAYER_SETTINGS,
          ...data.playerSettings
        };

        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`tstream_settings_${userId}`, JSON.stringify(currentSessionSettings));
          }
          updateUserSettings({ autoplayNext: currentSessionSettings.autoplayNextEpisode });
        } catch {}

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tstream_player_settings_changed', { detail: currentSessionSettings })
          );
        }
        return { ...currentSessionSettings };
      }
    }

    const prefSnap = await getDoc(doc(db, 'users', userId, 'preferences', 'player'));
    if (prefSnap.exists()) {
      const prefDoc = prefSnap.data() as any;
      const prefPayload = prefDoc?.data && typeof prefDoc.data === 'object' ? prefDoc.data : prefDoc;
      if (prefPayload && typeof prefPayload === 'object') {
        currentSessionSettings = {
          ...DEFAULT_PLAYER_SETTINGS,
          ...prefPayload
        };
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`tstream_settings_${userId}`, JSON.stringify(currentSessionSettings));
          }
          updateUserSettings({ autoplayNext: currentSessionSettings.autoplayNextEpisode });
        } catch {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tstream_player_settings_changed', { detail: currentSessionSettings })
          );
        }
        return { ...currentSessionSettings };
      }
    }
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Firestore quota reached while loading player settings. Using cached settings.');
      currentSessionSettings = readCachedUserSettings();
      return { ...currentSessionSettings };
    }
    console.warn('Failed to load user player settings from Firestore database:', err);
  }

  currentSessionSettings = readCachedUserSettings();
  return { ...currentSessionSettings };
}

/**
 * Save player settings for either:
 * - Guest users (`userId` absent): persists locally in localStorage cleanly
 * - Signed-in users (`userId` present): persists locally AND syncs to Firestore `users/{uid}` + `preferences/player`
 */
export async function saveUserPlayerSettings(
  updated: Partial<UserPlayerSettings>,
  userId?: string
): Promise<UserPlayerSettings> {
  const cleanPatch = sanitizeSettingsPatch(updated);
  const base = userId ? currentSessionSettings : readGuestSettingsFromStorage();
  const merged: UserPlayerSettings = {
    ...base,
    ...cleanPatch
  };

  currentSessionSettings = merged;

  // Always persist locally so both guests and offline/quota-limited users keep preferences
  if (userId) {
    currentActiveUserId = userId;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`tstream_settings_${userId}`, JSON.stringify(merged));
      }
    } catch {}
  } else {
    writeGuestSettingsToStorage(merged);
  }

  if (typeof cleanPatch.autoplayNextEpisode === 'boolean') {
    updateUserSettings({ autoplayNext: merged.autoplayNextEpisode });
  }

  if (userId && !isFirestoreQuotaExceeded()) {
    try {
      const nowIso = new Date().toISOString();
      const authEmail = auth?.currentUser?.uid === userId ? (auth.currentUser.email || '') : undefined;
      await Promise.all([
        setDoc(
          doc(db, 'users', userId),
          {
            userId,
            ...(authEmail !== undefined ? { email: authEmail.slice(0, 254) } : {}),
            playerSettings: merged,
            updatedAt: nowIso
          },
          { merge: true }
        ),
        setDoc(
          doc(db, 'users', userId, 'preferences', 'player'),
          {
            userId,
            prefId: 'player',
            data: merged,
            updatedAt: nowIso
          },
          { merge: true }
        )
      ]);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
        console.warn('Firestore quota reached while saving player settings. Maintained in session and local storage.');
      } else {
        throw err;
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tstream_player_settings_changed', { detail: merged })
    );
  }

  return merged;
}

/**
 * Returns the effective Autoplay Next Episode preference for either signed-in users
 * (cloud/session playerSettings) or guests (local user settings).
 */
export function getEffectiveAutoplayNextEpisode(): boolean {
  const uid = currentActiveUserId || auth?.currentUser?.uid;
  if (uid) {
    return currentSessionSettings.autoplayNextEpisode;
  }
  const guest = readGuestSettingsFromStorage();
  if (typeof guest.autoplayNextEpisode === 'boolean') {
    const legacy = getUserSettings();
    return legacy.autoplayNext;
  }
  return getUserSettings().autoplayNext;
}

/**
 * Toggles and persists Autoplay Next Episode immediately from the player settings drawer,
 * library settings, or cloud profile. Works for both guests (localStorage) and signed-in users (Firestore + localStorage).
 */
export async function setAutoplayNextEpisodePreference(enabled: boolean): Promise<boolean> {
  const normalized = Boolean(enabled);
  const uid = currentActiveUserId || auth?.currentUser?.uid;

  const nextSession: UserPlayerSettings = {
    ...currentSessionSettings,
    autoplayNextEpisode: normalized
  };
  currentSessionSettings = nextSession;
  if (!uid) {
    writeGuestSettingsToStorage(nextSession);
  }

  updateUserSettings({ autoplayNext: normalized });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tstream_player_settings_changed', { detail: nextSession })
    );
  }

  if (uid) {
    try {
      await saveUserPlayerSettings({ autoplayNextEpisode: normalized }, uid);
    } catch (err) {
      console.warn('Failed to persist autoplayNextEpisode to Firestore:', err);
    }
  }

  return normalized;
}
