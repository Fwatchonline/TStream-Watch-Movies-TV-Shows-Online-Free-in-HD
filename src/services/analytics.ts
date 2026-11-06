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
import { db } from './firebase';

export interface SiteVisitRecord {
  id?: string;
  path: string;
  referrer: string;
  device: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
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

let lastLoggedPath = '';
let lastLoggedTime = 0;

/**
 * Record a visit / pageview into Firestore analytics
 */
export async function recordSiteVisit(
  path: string,
  user?: { uid: string; email?: string | null } | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  // Prevent duplicate logs for the same route within 4 seconds
  if (path === lastLoggedPath && now - lastLoggedTime < 4000) {
    return;
  }
  lastLoggedPath = path;
  lastLoggedTime = now;

  const dateStr = new Date().toISOString().split('T')[0];
  const { device, browser, os } = getDeviceInfo();
  const referrer = document.referrer ? new URL(document.referrer, window.location.origin).pathname : 'Direct';

  try {
    const isNewSession = !sessionStorage.getItem('tstream_analytics_session');
    if (isNewSession) {
      sessionStorage.setItem('tstream_analytics_session', `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    }

    const visit: SiteVisitRecord = {
      path: path || '/',
      referrer: referrer || 'Direct',
      device,
      browser,
      os,
      isRegistered: !!user,
      userId: user?.uid || null,
      userEmail: user?.email || null,
      timestamp: new Date().toISOString(),
      date: dateStr
    };

    // 1. Log real-time visit document
    await addDoc(collection(db, 'analytics_visits'), visit);

    // 2. Aggregate into daily metrics
    const dailyRef = doc(db, 'analytics_daily', dateStr);
    const cleanPathKey = (path.replace(/[/.]/g, '_').substring(0, 40) || 'home');

    await setDoc(
      dailyRef,
      {
        date: dateStr,
        pageViews: increment(1),
        registeredVisits: increment(user ? 1 : 0),
        guestVisits: increment(user ? 0 : 1),
        [`pages.${cleanPathKey}`]: increment(1),
        [`devices.${device}`]: increment(1),
        [`browsers.${browser}`]: increment(1)
      },
      { merge: true }
    );

    // 3. Increment global lifetime summary
    const summaryRef = doc(db, 'analytics_summary', 'global');
    await setDoc(
      summaryRef,
      {
        totalVisits: increment(1),
        totalPageViews: increment(1),
        lastUpdated: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Analytics visit recording skipped:', err);
  }
}

/**
 * Get total registered users count directly from Firestore
 */
export async function getRegisteredUsersCount(): Promise<number> {
  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getCountFromServer(usersCol);
    return snapshot.data().count;
  } catch (err) {
    console.warn('Could not query users count with server aggregator, trying collection read:', err);
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.size;
    } catch (e) {
      console.error('Error fetching registered users count:', e);
      return 0;
    }
  }
}

/**
 * Fetch registered users directory from Firestore
 */
export async function getRegisteredUsersList(limitCount = 100): Promise<RegisteredUserSummary[]> {
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
    console.warn('Error fetching registered users list:', err);
    return [];
  }
}

/**
 * Fetch comprehensive website analytics & metrics
 */
export async function getAnalyticsData(): Promise<AnalyticsSummary> {
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
        guestVisits: d.guestVisits || 0
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

  return {
    totalVisits,
    totalPageViews,
    registeredUsersCount,
    todayVisits,
    yesterdayVisits,
    recentVisits,
    dailyTrends,
    topPages,
    deviceBreakdown,
    browserBreakdown
  };
}
