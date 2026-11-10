import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirestoreQuotaExceeded, markFirestoreQuotaExceeded, isQuotaExceededError } from './firebase';

export interface UserPlayerSettings {
  defaultServerId: string;
  autoFallbackServer: boolean;
  defaultSubtitleLang: string;
  autoLoadSubtitles: boolean;
  subtitleSize: 'small' | 'medium' | 'large' | 'xlarge';
  subtitleColor: string;
  subtitleBackground: 'shadow' | 'box' | 'outline' | 'none';
  defaultQuality: 'Auto' | '2160p' | '1080p' | '720p' | '480p';
  autoplayNextEpisode: boolean;
  autoResumePlayback: boolean;
  defaultSpeed: number;
  playerAccentColor: string;
  defaultTheaterMode: boolean;
}

export const DEFAULT_PLAYER_SETTINGS: UserPlayerSettings = {
  defaultServerId: 'server_1_direct',
  autoFallbackServer: true,
  defaultSubtitleLang: 'exyu',
  autoLoadSubtitles: true,
  subtitleSize: 'medium',
  subtitleColor: '#FFFFFF',
  subtitleBackground: 'shadow',
  defaultQuality: 'Auto',
  autoplayNextEpisode: true,
  autoResumePlayback: true,
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
  { code: 'sl', name: 'Slovenian', flag: '🇸🇮' },
  { code: 'mk', name: 'Macedonian', flag: '🇲🇰' },
  { code: 'bs', name: 'Bosnian', flag: '🇧🇦' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
  { code: 'sr', name: 'Serbian', flag: '🇷🇸' },
  { code: 'off', name: 'Off (No Subtitles)', flag: '🚫' }
];

// In-memory active session settings (NO localStorage persistence)
let currentSessionSettings: UserPlayerSettings = { ...DEFAULT_PLAYER_SETTINGS };
let currentActiveUserId: string | null = null;

/**
 * Returns current player and server settings synchronously from the active in-memory session.
 */
export function getUserPlayerSettings(): UserPlayerSettings {
  return { ...currentSessionSettings };
}

/**
 * Reset in-memory session settings (e.g. on user sign out).
 */
export function clearSessionPlayerSettings(): void {
  currentSessionSettings = { ...DEFAULT_PLAYER_SETTINGS };
  currentActiveUserId = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tstream_player_settings_changed', { detail: currentSessionSettings })
    );
  }
}

/**
 * Load user settings directly from Firestore database.
 * Reserved exclusively for authenticated registered users.
 */
export async function loadUserPlayerSettingsFromFirestore(userId: string): Promise<UserPlayerSettings> {
  if (!userId) {
    clearSessionPlayerSettings();
    return { ...DEFAULT_PLAYER_SETTINGS };
  }

  currentActiveUserId = userId;

  if (isFirestoreQuotaExceeded()) {
    try {
      const raw = localStorage.getItem(`tstream_settings_${userId}`);
      if (raw) {
        currentSessionSettings = { ...DEFAULT_PLAYER_SETTINGS, ...JSON.parse(raw) };
        return { ...currentSessionSettings };
      }
    } catch {}
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
          localStorage.setItem(`tstream_settings_${userId}`, JSON.stringify(currentSessionSettings));
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
      try {
        const raw = localStorage.getItem(`tstream_settings_${userId}`);
        if (raw) {
          currentSessionSettings = { ...DEFAULT_PLAYER_SETTINGS, ...JSON.parse(raw) };
          return { ...currentSessionSettings };
        }
      } catch {}
    } else {
      console.warn('Failed to load user player settings from Firestore database:', err);
    }
  }

  currentSessionSettings = { ...DEFAULT_PLAYER_SETTINGS };
  return { ...DEFAULT_PLAYER_SETTINGS };
}

/**
 * Save user player settings exclusively to Firestore database.
 * Requires an authenticated user ID.
 */
export async function saveUserPlayerSettings(
  updated: Partial<UserPlayerSettings>,
  userId: string | undefined
): Promise<UserPlayerSettings> {
  if (!userId) {
    throw new Error('Player and server settings are reserved exclusively for registered members. Please sign in to save your preferences to the cloud database.');
  }

  const merged: UserPlayerSettings = {
    ...currentSessionSettings,
    ...updated
  };

  currentSessionSettings = merged;
  currentActiveUserId = userId;

  // Always persist to local cache first
  try {
    localStorage.setItem(`tstream_settings_${userId}`, JSON.stringify(merged));
  } catch {}

  if (!isFirestoreQuotaExceeded()) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          userId,
          playerSettings: merged,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch (err) {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
        console.warn('Firestore quota reached while saving player settings. Maintained in session and local storage.');
      } else {
        throw err;
      }
    }
  }

  // Notify active players in the current window session
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tstream_player_settings_changed', { detail: merged })
    );
  }

  return merged;
}
