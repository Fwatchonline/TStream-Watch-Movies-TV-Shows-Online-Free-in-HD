import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  orderBy,
  limit,
  increment,
  getCountFromServer,
  where
} from 'firebase/firestore';
import { db, isFirestoreQuotaExceeded, markFirestoreQuotaExceeded, isQuotaExceededError } from './firebase';

export interface CountryMetric {
  country: string;
  countryCode: string;
  city?: string;
  count: number;
  percentage: number;
  flag: string;
}

export interface SiteVisitRecord {
  id?: string;
  path: string;
  referrer: string;
  device: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
  country?: string;
  countryCode?: string;
  city?: string;
  flag?: string;
  isRegistered: boolean;
  userId?: string | null;
  userEmail?: string | null;
  timestamp: string;
  date: string;
}

export interface DailyAnalyticsRecord {
  date: string;
  pageViews: number;
  uniqueVisits?: number;
  registeredVisits: number;
  guestVisits: number;
  pages?: Record<string, number>;
  devices?: Record<string, number>;
  browsers?: Record<string, number>;
  countries?: Record<string, number>;
}

export interface RegisteredUserSummary {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
  hasPlayerSettings?: boolean;
}

export interface AnalyticsSummary {
  totalVisits: number;
  totalPageViews: number;
  registeredUsersCount: number;
  todayVisits: number;
  yesterdayVisits: number;
  recentVisits: SiteVisitRecord[];
  dailyTrends: DailyAnalyticsRecord[];
  topPages: Array<{ path: string; count: number }>;
  topCountries: CountryMetric[];
  countryBreakdown: Record<string, number>;
  deviceBreakdown: Record<string, number>;
  browserBreakdown: Record<string, number>;
}

// Client Environment Helpers
function getDeviceInfo(): { device: 'Desktop' | 'Mobile' | 'Tablet'; browser: string; os: string } {
  if (typeof window === 'undefined') {
    return { device: 'Desktop', browser: 'Unknown', os: 'Unknown' };
  }

  const ua = navigator.userAgent;

  // Device
  let device: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    device = 'Tablet';
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    device = 'Mobile';
  }

  // Browser
  let browser = 'Chrome';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else browser = 'Other';

  // OS
  let os = 'Windows';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else os = 'Other';

  return { device, browser, os };
}

/**
 * Convert 2-letter ISO country code into Unicode flag emoji
 */
export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Fast zero-latency offline heuristic from browser TimeZone & Locale
 */
function getLocalFallbackGeo(): { country: string; countryCode: string; city: string; flag: string } {
  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {}

  const tzMap: Record<string, { country: string; countryCode: string; city: string; flag: string }> = {
    // Ex-Yu & Balkans
    'Europe/Belgrade': { country: 'Serbia', countryCode: 'RS', city: 'Belgrade', flag: '🇷🇸' },
    'Europe/Sarajevo': { country: 'Bosnia & Herzegovina', countryCode: 'BA', city: 'Sarajevo', flag: '🇧🇦' },
    'Europe/Zagreb': { country: 'Croatia', countryCode: 'HR', city: 'Zagreb', flag: '🇭🇷' },
    'Europe/Ljubljana': { country: 'Slovenia', countryCode: 'SI', city: 'Ljubljana', flag: '🇸🇮' },
    'Europe/Skopje': { country: 'North Macedonia', countryCode: 'MK', city: 'Skopje', flag: '🇲🇰' },
    'Europe/Podgorica': { country: 'Montenegro', countryCode: 'ME', city: 'Podgorica', flag: '🇲🇪' },
    // Europe
    'Europe/Vienna': { country: 'Austria', countryCode: 'AT', city: 'Vienna', flag: '🇦🇹' },
    'Europe/Berlin': { country: 'Germany', countryCode: 'DE', city: 'Berlin', flag: '🇩🇪' },
    'Europe/Zurich': { country: 'Switzerland', countryCode: 'CH', city: 'Zurich', flag: '🇨🇭' },
    'Europe/London': { country: 'United Kingdom', countryCode: 'GB', city: 'London', flag: '🇬🇧' },
    'Europe/Paris': { country: 'France', countryCode: 'FR', city: 'Paris', flag: '🇫🇷' },
    'Europe/Rome': { country: 'Italy', countryCode: 'IT', city: 'Rome', flag: '🇮🇹' },
    'Europe/Madrid': { country: 'Spain', countryCode: 'ES', city: 'Madrid', flag: '🇪🇸' },
    'Europe/Amsterdam': { country: 'Netherlands', countryCode: 'NL', city: 'Amsterdam', flag: '🇳🇱' },
    'Europe/Brussels': { country: 'Belgium', countryCode: 'BE', city: 'Brussels', flag: '🇧🇪' },
    'Europe/Stockholm': { country: 'Sweden', countryCode: 'SE', city: 'Stockholm', flag: '🇸🇪' },
    'Europe/Oslo': { country: 'Norway', countryCode: 'NO', city: 'Oslo', flag: '🇳🇴' },
    'Europe/Copenhagen': { country: 'Denmark', countryCode: 'DK', city: 'Copenhagen', flag: '🇩🇰' },
    'Europe/Helsinki': { country: 'Finland', countryCode: 'FI', city: 'Helsinki', flag: '🇫🇮' },
    'Europe/Warsaw': { country: 'Poland', countryCode: 'PL', city: 'Warsaw', flag: '🇵🇱' },
    'Europe/Prague': { country: 'Czechia', countryCode: 'CZ', city: 'Prague', flag: '🇨🇿' },
    'Europe/Budapest': { country: 'Hungary', countryCode: 'HU', city: 'Budapest', flag: '🇭🇺' },
    'Europe/Bucharest': { country: 'Romania', countryCode: 'RO', city: 'Bucharest', flag: '🇷🇴' },
    'Europe/Sofia': { country: 'Bulgaria', countryCode: 'BG', city: 'Sofia', flag: '🇧🇬' },
    'Europe/Athens': { country: 'Greece', countryCode: 'GR', city: 'Athens', flag: '🇬🇷' },
    'Europe/Istanbul': { country: 'Turkey', countryCode: 'TR', city: 'Istanbul', flag: '🇹🇷' },
    'Europe/Moscow': { country: 'Russia', countryCode: 'RU', city: 'Moscow', flag: '🇷🇺' },
    'Europe/Kyiv': { country: 'Ukraine', countryCode: 'UA', city: 'Kyiv', flag: '🇺🇦' },
    // Americas & Worldwide
    'America/New_York': { country: 'United States', countryCode: 'US', city: 'New York', flag: '🇺🇸' },
    'America/Chicago': { country: 'United States', countryCode: 'US', city: 'Chicago', flag: '🇺🇸' },
    'America/Los_Angeles': { country: 'United States', countryCode: 'US', city: 'Los Angeles', flag: '🇺🇸' },
    'America/Denver': { country: 'United States', countryCode: 'US', city: 'Denver', flag: '🇺🇸' },
    'America/Toronto': { country: 'Canada', countryCode: 'CA', city: 'Toronto', flag: '🇨🇦' },
    'America/Vancouver': { country: 'Canada', countryCode: 'CA', city: 'Vancouver', flag: '🇨🇦' },
    'America/Mexico_City': { country: 'Mexico', countryCode: 'MX', city: 'Mexico City', flag: '🇲🇽' },
    'America/Sao_Paulo': { country: 'Brazil', countryCode: 'BR', city: 'São Paulo', flag: '🇧🇷' },
    'Australia/Sydney': { country: 'Australia', countryCode: 'AU', city: 'Sydney', flag: '🇦🇺' },
    'Asia/Tokyo': { country: 'Japan', countryCode: 'JP', city: 'Tokyo', flag: '🇯🇵' },
    'Asia/Dubai': { country: 'United Arab Emirates', countryCode: 'AE', city: 'Dubai', flag: '🇦🇪' }
  };

  if (tzMap[timeZone]) {
    return tzMap[timeZone];
  }

  if (timeZone.startsWith('Europe/')) {
    const rawCity = timeZone.split('/')[1]?.replace(/_/g, ' ') || 'Europe';
    return { country: 'Europe', countryCode: 'EU', city: rawCity, flag: '🇪🇺' };
  }
  if (timeZone.startsWith('America/')) {
    const rawCity = timeZone.split('/')[1]?.replace(/_/g, ' ') || 'Americas';
    return { country: 'United States', countryCode: 'US', city: rawCity, flag: '🇺🇸' };
  }

  return { country: 'International', countryCode: 'UN', city: 'Global', flag: '🌐' };
}

/**
 * Asynchronously fetch visitor location with session caching & fast fallback
 */
export async function getVisitorLocation(): Promise<{ country: string; countryCode: string; city: string; flag: string }> {
  if (typeof window === 'undefined') {
    return { country: 'Global', countryCode: 'UN', city: 'Unknown', flag: '🌐' };
  }

  try {
    const cached = sessionStorage.getItem('tstream_visitor_geo');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  const fallback = getLocalFallbackGeo();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const res = await fetch('https://ipwho.is/', {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.country) {
        const countryCode = (data.country_code || fallback.countryCode || 'UN').toUpperCase();
        const flag = data.flag?.emoji || getFlagEmoji(countryCode) || fallback.flag;
        const result = {
          country: data.country || fallback.country,
          countryCode,
          city: data.city || fallback.city,
          flag
        };
        try {
          sessionStorage.setItem('tstream_visitor_geo', JSON.stringify(result));
        } catch {}
        return result;
      }
    }
  } catch {
    // If external service fails or is blocked by client adblocker, keep fallback
  }

  try {
    sessionStorage.setItem('tstream_visitor_geo', JSON.stringify(fallback));
  } catch {}
  return fallback;
}

let lastLoggedPath = '';
let lastLoggedTime = 0;

/**
 * Record a visit / pageview locally without consuming Firestore daily free-tier write quota.
 * Automatic per-navigation writes previously triggered multiple Firestore mutations per page view
 * and exhausted the free-tier daily write limit.
 */
export async function recordSiteVisit(
  path: string,
  user?: { uid: string; email?: string | null } | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (path === lastLoggedPath && now - lastLoggedTime < 10000) {
    return;
  }
  lastLoggedPath = path;
  lastLoggedTime = now;

  try {
    if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('tstream_analytics_session')) {
      sessionStorage.setItem(
        'tstream_analytics_session',
        `session_${now}_${Math.random().toString(36).substring(2, 7)}`
      );
    }

    if (typeof localStorage !== 'undefined') {
      const dateStr = new Date().toISOString().split('T')[0];
      const { device, browser, os } = getDeviceInfo();
      const raw = localStorage.getItem('tstream_local_visits_v1');
      const visits: SiteVisitRecord[] = raw ? JSON.parse(raw) : [];
      visits.unshift({
        path: path || '/',
        referrer: document.referrer ? new URL(document.referrer, window.location.origin).pathname : 'Direct',
        device,
        browser,
        os,
        country: 'Local',
        countryCode: 'UN',
        city: 'Unknown',
        flag: '🌐',
        isRegistered: !!user,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        timestamp: new Date().toISOString(),
        date: dateStr
      });
      localStorage.setItem('tstream_local_visits_v1', JSON.stringify(visits.slice(0, 50)));
    }
  } catch {
    // Ignore storage quota or serialization errors
  }
}

/**
 * Get total registered users count directly from Firestore
 */
export async function getRegisteredUsersCount(): Promise<number> {
  if (isFirestoreQuotaExceeded()) return 0;
  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getCountFromServer(usersCol);
    return snapshot.data().count;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      return 0;
    }
    console.warn('Could not query users count with server aggregator, trying collection read:', err);
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.size;
    } catch (e) {
      if (isQuotaExceededError(e)) {
        markFirestoreQuotaExceeded();
      }
      console.error('Error fetching registered users count:', e);
      return 0;
    }
  }
}

/**
 * Fetch registered users directory from Firestore
 */
export async function getRegisteredUsersList(limitCount = 100): Promise<RegisteredUserSummary[]> {
  if (isFirestoreQuotaExceeded()) return [];
  try {
    const usersCol = collection(db, 'users');
    const q = query(usersCol, orderBy('createdAt', 'desc'), limit(limitCount));
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        userId: d.id,
        email: data.email || 'N/A',
        displayName: data.displayName || data.email?.split('@')[0] || 'User',
        photoURL: data.photoURL || '',
        createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
        hasPlayerSettings: !!data.playerSettings
      };
    });
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
    console.warn('Error fetching registered users list:', err);
    return [];
  }
}

/**
 * Fetch comprehensive website analytics & metrics
 */
export async function getAnalyticsData(): Promise<AnalyticsSummary> {
  if (isFirestoreQuotaExceeded()) {
    try {
      const cached = localStorage.getItem('tstream_cached_analytics');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    return {
      totalVisits: 0,
      totalPageViews: 0,
      registeredUsersCount: 0,
      todayVisits: 0,
      yesterdayVisits: 0,
      recentVisits: [],
      dailyTrends: [],
      topPages: [],
      topCountries: [],
      countryBreakdown: {},
      deviceBreakdown: { Desktop: 0, Mobile: 0, Tablet: 0 },
      browserBreakdown: { Chrome: 0, Safari: 0, Firefox: 0, Edge: 0, Other: 0 }
    };
  }

  let totalVisits = 0;
  let totalPageViews = 0;
  let registeredUsersCount = 0;
  let todayVisits = 0;
  let yesterdayVisits = 0;
  const recentVisits: SiteVisitRecord[] = [];
  const dailyTrends: DailyAnalyticsRecord[] = [];
  const pageCounts: Record<string, number> = {};
  const deviceBreakdown: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
  const browserBreakdown: Record<string, number> = { Chrome: 0, Safari: 0, Firefox: 0, Edge: 0, Other: 0 };

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  // 1. Fetch Registered Users Count
  try {
    registeredUsersCount = await getRegisteredUsersCount();
  } catch {}

  // 2. Fetch Global Summary
  try {
    const summarySnap = await getDoc(doc(db, 'analytics_summary', 'global'));
    if (summarySnap.exists()) {
      const d = summarySnap.data();
      totalVisits = d.totalVisits || 0;
      totalPageViews = d.totalPageViews || 0;
    }
  } catch {}

  // 3. Fetch Recent Visits
  try {
    const visitsQuery = query(
      collection(db, 'analytics_visits'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const visitsSnap = await getDocs(visitsQuery);
    visitsSnap.forEach((docSnap) => {
      const data = docSnap.data() as SiteVisitRecord;
      recentVisits.push({ ...data, id: docSnap.id });

      // Aggregate page counts from recent logs
      const rawPath = data.path || '/';
      pageCounts[rawPath] = (pageCounts[rawPath] || 0) + 1;

      // Aggregate device and browser
      if (data.device) {
        deviceBreakdown[data.device] = (deviceBreakdown[data.device] || 0) + 1;
      }
      if (data.browser) {
        browserBreakdown[data.browser] = (browserBreakdown[data.browser] || 0) + 1;
      }

      if (data.date === todayStr) {
        todayVisits++;
      } else if (data.date === yesterdayStr) {
        yesterdayVisits++;
      }
    });
  } catch (err) {
    console.warn('Error reading analytics_visits:', err);
  }

  // 4. Fetch Daily Trends
  try {
    const dailySnap = await getDocs(query(collection(db, 'analytics_daily'), limit(14)));
    dailySnap.forEach((docSnap) => {
      const d = docSnap.data();
      dailyTrends.push({
        date: d.date || docSnap.id,
        pageViews: d.pageViews || 0,
        registeredVisits: d.registeredVisits || 0,
        guestVisits: d.guestVisits || 0,
        countries: d.countries || {}
      });

      if (d.date === todayStr && d.pageViews > todayVisits) {
        todayVisits = d.pageViews;
      }
      if (d.date === yesterdayStr && d.pageViews > yesterdayVisits) {
        yesterdayVisits = d.pageViews;
      }
    });

    // Sort daily trends chronologically
    dailyTrends.sort((a, b) => a.date.localeCompare(b.date));
  } catch {}

  // 5. Aggregate Countries and Geolocation
  const countryBreakdown: Record<string, number> = {};
  const countryDetailMap: Record<string, { count: number; countryCode: string; flag: string; cities: Record<string, number> }> = {};

  recentVisits.forEach((v) => {
    const cName = v.country || 'Unknown';
    const cCode = v.countryCode || 'UN';
    const cFlag = v.flag || getFlagEmoji(cCode);

    countryBreakdown[cName] = (countryBreakdown[cName] || 0) + 1;

    if (!countryDetailMap[cName]) {
      countryDetailMap[cName] = {
        count: 0,
        countryCode: cCode,
        flag: cFlag,
        cities: {}
      };
    }
    countryDetailMap[cName].count++;
    if (v.city && v.city !== 'Unknown') {
      countryDetailMap[cName].cities[v.city] = (countryDetailMap[cName].cities[v.city] || 0) + 1;
    }
  });

  // Also include countries from daily aggregation if recent visits are few
  dailyTrends.forEach((trend) => {
    if (trend.countries) {
      Object.entries(trend.countries).forEach(([cRaw, cCount]) => {
        const cFormatted = cRaw.replace(/_/g, ' ');
        countryBreakdown[cFormatted] = Math.max(countryBreakdown[cFormatted] || 0, cCount);
        if (!countryDetailMap[cFormatted]) {
          countryDetailMap[cFormatted] = {
            count: cCount,
            countryCode: 'UN',
            flag: '🌐',
            cities: {}
          };
        }
      });
    }
  });

  const totalGeoHits = Math.max(1, Object.values(countryBreakdown).reduce((a, b) => a + b, 0));
  const topCountries: CountryMetric[] = Object.entries(countryDetailMap)
    .map(([cName, data]) => {
      const topCity = Object.entries(data.cities).sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        country: cName,
        countryCode: data.countryCode,
        city: topCity,
        count: data.count,
        percentage: Math.min(100, Math.round((data.count / totalGeoHits) * 100)),
        flag: data.flag
      };
    })
    .sort((a, b) => b.count - a.count);

  // Format Top Pages
  const topPages = Object.entries(pageCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // If totalVisits in summary was 0, fall back to calculated pageViews
  if (totalVisits === 0) {
    totalVisits = Math.max(recentVisits.length, dailyTrends.reduce((acc, cur) => acc + cur.pageViews, 0));
    totalPageViews = totalVisits;
  }

  const result: AnalyticsSummary = {
    totalVisits,
    totalPageViews,
    registeredUsersCount,
    todayVisits,
    yesterdayVisits,
    recentVisits,
    dailyTrends,
    topPages,
    topCountries,
    countryBreakdown,
    deviceBreakdown,
    browserBreakdown
  };

  try {
    localStorage.setItem('tstream_cached_analytics', JSON.stringify(result));
  } catch {}

  return result;
}
