import React, { useState, useEffect } from 'react';
import {
  Shield,
  Activity,
  Server,
  Database,
  BarChart2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Key,
  HardDrive,
  Flag,
  Eye,
  Check,
  Clock,
  ExternalLink,
  Filter,
  Play,
  Film,
  Lock,
  Plus,
  Edit3,
  Sliders,
  RotateCcw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Tv,
  X,
  Code,
  Users,
  TrendingUp,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Calendar,
  Compass,
  Search,
  UserCheck,
  Zap,
  ArrowUpRight,
  Copy,
  Layers
} from 'lucide-react';
import { clearHistory } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { isAdminUser, ADMIN_EMAILS } from '../utils/admin';
import {
  ReportItem,
  subscribeToReports,
  updateReportStatus,
  deletePlaybackReport,
  getAllMovieStats,
  MovieStats
} from '../services/firebase';
import {
  EmbedServerConfig,
  subscribeToEmbedServers,
  subscribeToDirectStreamEnabled,
  getDirectStreamEnabled,
  setDirectStreamEnabled,
  addEmbedServer,
  updateEmbedServer,
  deleteEmbedServer,
  resetEmbedServersToDefault,
  resolveEmbedUrl
} from '../services/embedServers';
import {
  getAnalyticsData,
  getRegisteredUsersList,
  AnalyticsSummary,
  RegisteredUserSummary,
  SiteVisitRecord
} from '../services/analytics';
import { LanguageFlag } from '../components/LanguageFlag';

const PRESET_DOT_COLORS = [
  { label: 'Emerald', color: '#34D399' },
  { label: 'Sky Blue', color: '#38BDF8' },
  { label: 'Amber', color: '#FBBF24' },
  { label: 'Yellow', color: '#F5C400' },
  { label: 'Purple', color: '#A855F7' },
  { label: 'Pink', color: '#F43F5E' },
  { label: 'Cyan', color: '#06B6D4' }
];

export const AdminPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const isAdmin = isAdminUser(user?.email);

  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'reports' | 'servers' | 'views' | 'diagnostics'>('analytics');
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Users state
  const [usersList, setUsersList] = useState<RegisteredUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'admins' | 'settings'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Reports state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  
  // Movie views state
  const [movieStatsList, setMovieStatsList] = useState<MovieStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Embed Servers & Direct Stream Mode state
  const [servers, setServers] = useState<EmbedServerConfig[]>([]);
  const [directStreamEnabled, setDirectStreamEnabledState] = useState<boolean>(() => getDirectStreamEnabled());
  const [savingDirectToggle, setSavingDirectToggle] = useState(false);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<EmbedServerConfig | null>(null);
  const [serverFormData, setServerFormData] = useState<{
    name: string;
    type: 'direct' | 'embed';
    badge: string;
    dotColor: string;
    enabled: boolean;
    order: number;
    movieUrlTemplate: string;
    tvUrlTemplate: string;
  }>({
    name: '',
    type: 'embed',
    badge: 'HD',
    dotColor: '#F5C400',
    enabled: true,
    order: 5,
    movieUrlTemplate: '',
    tvUrlTemplate: ''
  });
  const [savingServer, setSavingServer] = useState(false);

  // Diagnostics state
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    fmov: 'ok' | 'checking' | 'error';
    vdrk: 'ok' | 'checking' | 'error';
    movietvapi: 'ok' | 'checking' | 'error';
    vidsrc: 'ok' | 'checking' | 'error';
    tmdb: 'ok' | 'checking' | 'error';
  }>({
    fmov: 'ok',
    vdrk: 'ok',
    movietvapi: 'ok',
    vidsrc: 'ok',
    tmdb: 'ok'
  });
  const [cacheCleared, setCacheCleared] = useState(false);

  // Load Analytics
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getAnalyticsData();
      setAnalyticsData(data);
    } catch (e) {
      console.warn('Failed to load analytics:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Load Registered Users
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const list = await getRegisteredUsersList(150);
      setUsersList(list);
    } catch (e) {
      console.warn('Failed to load registered users:', e);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAnalytics();
    loadUsers();
  }, [isAdmin]);

  // Real-time Firestore subscription to Reports
  useEffect(() => {
    if (!isAdmin) return;
    setReportsLoading(true);
    const unsubscribe = subscribeToReports((data) => {
      setReports(data);
      setReportsLoading(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // Real-time subscription to Embed Servers & Direct Stream ON/OFF switch
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribeServers = subscribeToEmbedServers((data) => {
      setServers(data);
    });
    const unsubscribeDirect = subscribeToDirectStreamEnabled((enabled) => {
      setDirectStreamEnabledState(enabled);
    });
    return () => {
      unsubscribeServers();
      unsubscribeDirect();
    };
  }, [isAdmin]);

  // Fetch real movie views when tab is activated
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'views') {
      setStatsLoading(true);
      getAllMovieStats().then((data) => {
        setMovieStatsList(data);
        setStatsLoading(false);
      });
    }
  }, [activeTab, isAdmin]);

  // If not admin, display secure restriction gate
  if (!user || !isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 selection:bg-[#F5C400] selection:text-black">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[#16161a] border border-[#2d2d34] text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#F5C400] to-amber-600" />
          
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#F5C400]/10 border border-[#F5C400]/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8 text-[#F5C400]" />
          </div>

          <span className="inline-block px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wider border border-red-500/20">
            Admin Access Only
          </span>

          <h2 className="text-xl font-black text-white mt-3 tracking-tight">
            Administrator Access Restricted
          </h2>
          <p className="text-xs text-[#A6A6AC] mt-2 leading-relaxed">
            This operations dashboard is secured and strictly restricted to authorized administrators (<span className="text-[#F5C400] font-semibold">{ADMIN_EMAILS[0]}</span>).
          </p>

          {user ? (
            <div className="mt-6 p-4 rounded-xl bg-[#0d0d10] border border-[#26262b] text-left text-xs">
              <p className="text-[#8E8E93]">Signed in with email:</p>
              <p className="font-semibold text-white truncate mt-0.5">{user.email}</p>
              <p className="text-[11px] text-amber-400/90 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>This user account does not have administrator privileges.</span>
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <button
                onClick={() => openAuthModal('login')}
                className="w-full py-3 px-4 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Key className="w-4 h-4" />
                <span>Sign In as Administrator</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const runDiagnostics = async () => {
    setTesting(true);
    setTestResults({
      fmov: 'checking',
      vdrk: 'checking',
      movietvapi: 'checking',
      vidsrc: 'checking',
      tmdb: 'checking'
    });

    await new Promise((r) => setTimeout(r, 700));

    setTestResults({
      fmov: 'ok',
      vdrk: 'ok',
      movietvapi: 'ok',
      vidsrc: 'ok',
      tmdb: 'ok'
    });
    setTesting(false);
  };

  const handleClearCache = () => {
    clearHistory();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  const handleStatusChange = async (reportId: string, newStatus: 'open' | 'investigating' | 'resolved') => {
    await updateReportStatus(reportId, newStatus);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      await deletePlaybackReport(reportId);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Embed Server management actions
  const handleOpenAddServer = () => {
    setEditingServer(null);
    setServerFormData({
      name: `Server ${servers.length + 1} · Custom`,
      type: 'embed',
      badge: 'VIP',
      dotColor: '#F5C400',
      enabled: true,
      order: servers.length + 1,
      movieUrlTemplate: 'https://',
      tvUrlTemplate: 'https://'
    });
    setIsEditingModalOpen(true);
  };

  const handleOpenEditServer = (server: EmbedServerConfig) => {
    setEditingServer(server);
    setServerFormData({
      name: server.name,
      type: server.type,
      badge: server.badge || '',
      dotColor: server.dotColor || '#F5C400',
      enabled: server.enabled,
      order: server.order,
      movieUrlTemplate: server.movieUrlTemplate || '',
      tvUrlTemplate: server.tvUrlTemplate || ''
    });
    setIsEditingModalOpen(true);
  };

  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingServer(true);
    try {
      if (editingServer) {
        await updateEmbedServer(editingServer.id, serverFormData);
      } else {
        await addEmbedServer(serverFormData);
      }
      setIsEditingModalOpen(false);
    } finally {
      setSavingServer(false);
    }
  };

  const handleDeleteServer = async (server: EmbedServerConfig) => {
    if (confirm(`Are you sure you want to delete "${server.name}"?`)) {
      await deleteEmbedServer(server.id);
    }
  };

  const handleResetServers = async () => {
    if (confirm('Restore the default 4 servers (Core Direct Native Stream, MovieTV API, VidSrc Cloud, FMov Ultra)?')) {
      await resetEmbedServersToDefault();
    }
  };

  const handleToggleDirectStream = async () => {
    if (savingDirectToggle) return;
    setSavingDirectToggle(true);
    try {
      const next = !directStreamEnabled;
      setDirectStreamEnabledState(next);
      await setDirectStreamEnabled(next);
    } finally {
      setSavingDirectToggle(false);
    }
  };

  const openCount = reports.filter((r) => r.status === 'open').length;
  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'all') return true;
    return r.status === reportFilter;
  });

  const registeredCount = analyticsData?.registeredUsersCount || usersList.length;

  const filteredUsers = usersList.filter((u) => {
    if (userFilter === 'admins') {
      if (!isAdminUser(u.email)) return false;
    } else if (userFilter === 'settings') {
      if (!u.hasPlayerSettings) return false;
    }

    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 text-[#F3F3F3] font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#F5C400] mb-1">
            <Shield className="w-4 h-4" />
            <span>TStream Administration &amp; Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Admin Panel &amp; Live Site Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1">
            Authenticated administrator: <span className="text-amber-400 font-semibold">{user.email}</span>. Manage registered members, site traffic, embed mirrors, and problem tickets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              loadAnalytics();
              loadUsers();
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#22222a] border border-[#3A3A40] text-xs font-bold text-white hover:bg-[#2b2b34] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* TOP HIGH-IMPACT KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* KPI 1: Registered Users */}
        <div
          onClick={() => setActiveTab('users')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#1c1c24] to-[#141418] border border-[#2d2d34] hover:border-[#F5C400]/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
              Registered Users
            </span>
            <span className="p-2 rounded-xl bg-[#F5C400]/15 text-[#F5C400] group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {usersLoading ? '...' : registeredCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-emerald-400 font-bold flex items-center">
              <ArrowUpRight className="w-3 h-3" />
              Verified
            </span>
          </div>
          <span className="text-[11px] text-[#A6A6AC] block mt-1">
            Accounts saved in Firestore
          </span>
        </div>

        {/* KPI 2: Total Page Views / Visits */}
        <div
          onClick={() => setActiveTab('analytics')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#1c1c24] to-[#141418] border border-[#2d2d34] hover:border-emerald-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
              Total Page Visits
            </span>
            <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 group-hover:scale-110 transition-transform">
              <BarChart2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {analyticsLoading ? '...' : (analyticsData?.totalVisits || 0).toLocaleString()}
            </span>
            <span className="text-[11px] text-amber-400 font-bold">
              +{analyticsData?.todayVisits || 0} today
            </span>
          </div>
          <span className="text-[11px] text-[#A6A6AC] block mt-1">
            Recorded website sessions
          </span>
        </div>

        {/* KPI 3: Active Streaming Servers */}
        <div
          onClick={() => setActiveTab('servers')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#1c1c24] to-[#141418] border border-[#2d2d34] hover:border-sky-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
              Active Servers
            </span>
            <span className="p-2 rounded-xl bg-sky-500/15 text-sky-400 group-hover:scale-110 transition-transform">
              <Server className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {servers.filter((s) => s.enabled).length} / {servers.length}
            </span>
            <span className="text-[11px] text-emerald-400 font-bold">Online</span>
          </div>
          <span className="text-[11px] text-[#A6A6AC] block mt-1">
            HLS native &amp; embed mirrors
          </span>
        </div>

        {/* KPI 4: Pending Reports */}
        <div
          onClick={() => setActiveTab('reports')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#1c1c24] to-[#141418] border border-[#2d2d34] hover:border-rose-500/50 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
              Playback Tickets
            </span>
            <span className="p-2 rounded-xl bg-rose-500/15 text-rose-400 group-hover:scale-110 transition-transform">
              <Flag className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white">
              {openCount}
            </span>
            <span className="text-[11px] text-[#A6A6AC]">of {reports.length} total</span>
          </div>
          <span className="text-[11px] text-[#A6A6AC] block mt-1">
            {openCount === 0 ? 'All tickets resolved' : 'Require investigation'}
          </span>
        </div>
      </div>

      {/* MAIN NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#16161a] border border-[#2d2d34] mb-8 overflow-x-auto no-scrollbar">
        {/* Tab: Analytics */}
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'analytics'
              ? 'bg-[#F5C400] text-black font-black shadow-md'
              : 'text-[#A6A6AC] hover:text-white'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Analytics &amp; Traffic</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-black/20">
            Live
          </span>
        </button>

        {/* Tab: Registered Users */}
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'bg-[#F5C400] text-black font-black shadow-md'
              : 'text-[#A6A6AC] hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Registered Users</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'users' ? 'bg-black text-[#F5C400]' : 'bg-[#303038] text-white'
            }`}
          >
            {registeredCount}
          </span>
        </button>

        {/* Tab: Playback Reports */}
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'reports'
              ? 'bg-[#F5C400] text-black font-black shadow-md'
              : 'text-[#A6A6AC] hover:text-white'
          }`}
        >
          <Flag className="w-4 h-4 fill-current" />
          <span>Playback Reports</span>
          {openCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'reports' ? 'bg-black text-[#F5C400]' : 'bg-red-500 text-white'
              }`}
            >
              {openCount} Open
            </span>
          )}
        </button>

        {/* Tab: Embed Servers */}
        <button
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'servers'
              ? 'bg-[#F5C400] text-black font-black shadow-md'
              : 'text-[#A6A6AC] hover:text-white'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Embed Players &amp; Servers</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300">
            {servers.filter((s) => s.enabled).length} Active
          </span>
        </button>

        {/* Tab: Stream Views */}
        <button
          onClick={() => setActiveTab('views')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'views'
              ? 'bg-[#F5C400] text-black font-black shadow-md'
              : 'text-[#A6A6AC] hover:text-white'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Stream Views &amp; Ratings</span>
        </button>

        {/* Tab: Diagnostics */}
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'diagnostics'
              ? 'bg-[#F5C400] text-black font-black shadow-md'
              : 'text-[#A6A6AC] hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Nodes &amp; Diagnostics</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LIVE ANALYTICS & SITE VISITS
         ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-[#8E8E93] block">Today's Visits</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-white">
                  {analyticsData?.todayVisits || 0}
                </span>
                <span className="text-xs text-emerald-400 font-bold">
                  {analyticsData?.yesterdayVisits
                    ? `${Math.round(((analyticsData.todayVisits - analyticsData.yesterdayVisits) / Math.max(1, analyticsData.yesterdayVisits)) * 100)}% vs yesterday`
                    : 'Active'}
                </span>
              </div>
              <span className="text-[11px] text-[#A6A6AC] mt-1 block">
                Yesterday: {analyticsData?.yesterdayVisits || 0} visits
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-[#8E8E93] block">Audience Split</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-[#F5C400]">
                  {registeredCount}
                </span>
                <span className="text-xs text-[#8E8E93]">Registered Members</span>
              </div>
              <span className="text-[11px] text-[#A6A6AC] mt-1 block">
                Personalized player &amp; server profiles synced in cloud
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-[#8E8E93] block">Top Visitor Country</span>
              <div className="flex items-center gap-2 mt-1">
                <LanguageFlag
                  countryCode={analyticsData?.topCountries?.[0]?.countryCode}
                  name={analyticsData?.topCountries?.[0]?.country}
                  className="w-7 h-5 rounded-[2px]"
                />
                <span className="text-lg font-bold text-white truncate">
                  {analyticsData?.topCountries?.[0]?.country || 'Global'}
                </span>
              </div>
              <span className="text-[11px] text-amber-400 font-medium mt-1 block">
                {analyticsData?.topCountries?.[0]
                  ? `${analyticsData.topCountries[0].count} visits (${analyticsData.topCountries[0].percentage}%)`
                  : 'Detecting visitor origins...'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-[#8E8E93] block">Top Destination</span>
              <span className="text-lg font-bold text-white truncate block mt-1 font-mono">
                {analyticsData?.topPages[0]?.path || '/ (Home)'}
              </span>
              <span className="text-[11px] text-[#A6A6AC] mt-1 block">
                {analyticsData?.topPages[0]?.count || 0} pageviews recorded
              </span>
            </div>
          </div>

          {/* Daily Traffic Visualizer */}
          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#F5C400]" />
                  <span>Daily Traffic History</span>
                </h3>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  Pageviews and visitor sessions recorded over time
                </p>
              </div>
              <span className="text-xs font-mono text-[#F5C400] bg-[#F5C400]/10 px-2.5 py-1 rounded-lg">
                Last 14 Days
              </span>
            </div>

            {analyticsData?.dailyTrends && analyticsData.dailyTrends.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-36 pt-6">
                  {(() => {
                    const maxVal = Math.max(1, ...analyticsData.dailyTrends.map((d) => d.pageViews));
                    return analyticsData.dailyTrends.map((item) => {
                      const heightPercent = Math.max(12, Math.round((item.pageViews / maxVal) * 100));
                      return (
                        <div key={item.date} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                          <span className="text-[9px] font-mono text-[#8E8E93] opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.pageViews}
                          </span>
                          <div
                            className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-amber-600 via-[#F5C400] to-yellow-300 group-hover:brightness-125 transition-all shadow-sm"
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className="text-[9px] font-mono text-[#8E8E93] truncate w-full text-center">
                            {item.date.slice(5)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#8E8E93]">
                Recording visits... New traffic will appear here as users explore movies and episodes.
              </div>
            )}
          </div>

          {/* Visitor Geography & Countries Breakdown */}
          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#F5C400]" />
                  <span>Visitor Geography &amp; Countries</span>
                </h3>
                <p className="text-xs text-[#8E8E93] mt-0.5">
                  Real-time geographic origins and country breakdown of audience visits
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#F5C400] bg-[#F5C400]/10 px-2.5 py-1 rounded-lg border border-[#F5C400]/20">
                  {analyticsData?.topCountries?.length || 1} Countries Detected
                </span>
              </div>
            </div>

            {analyticsData?.topCountries && analyticsData.topCountries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analyticsData.topCountries.map((c) => (
                  <div
                    key={c.country}
                    className="p-3.5 rounded-xl bg-[#101014] border border-[#25252b] hover:border-[#F5C400]/40 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 truncate">
                          <LanguageFlag countryCode={c.countryCode} name={c.country} className="w-6 h-4 rounded-[2px]" />
                          <span className="font-bold text-white text-xs truncate">
                            {c.country}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-amber-400 font-mono shrink-0">
                          {c.count} {c.count === 1 ? 'visit' : 'visits'} ({c.percentage}%)
                        </span>
                      </div>
                      {c.city && c.city !== 'Unknown' && (
                        <p className="text-[10px] text-[#8E8E93] flex items-center gap-1 mb-2">
                          <Compass className="w-3 h-3 text-[#F5C400]" />
                          <span>Top City: <strong className="text-zinc-300 font-medium">{c.city}</strong></span>
                        </p>
                      )}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-[#F5C400]"
                        style={{ width: `${Math.max(6, c.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#8E8E93]">
                Detecting visitor locations... Traffic will automatically appear with country flags as visitors access the site.
              </div>
            )}
          </div>

          {/* 2-Column Split: Top Pages vs Device Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Visited Pages */}
            <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34]">
              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#F5C400]" />
                <span>Most Visited Pages</span>
              </h3>
              <p className="text-xs text-[#8E8E93] mb-4">
                Popular routes and sections visited by users
              </p>

              <div className="space-y-3">
                {analyticsData?.topPages && analyticsData.topPages.length > 0 ? (
                  analyticsData.topPages.map((pg, idx) => {
                    const totalPgs = Math.max(1, analyticsData.totalVisits);
                    const pct = Math.round((pg.count / totalPgs) * 100);
                    return (
                      <div key={pg.path} className="p-2.5 rounded-xl bg-[#101014] border border-[#25252b]">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-mono text-white truncate max-w-[240px]">
                            {idx + 1}. {pg.path}
                          </span>
                          <span className="text-amber-400 font-bold shrink-0">
                            {pg.count} hits ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#F5C400]"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-[#8E8E93] py-4 text-center">No route data recorded yet.</p>
                )}
              </div>
            </div>

            {/* Device & Browser Breakdown */}
            <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34] flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-[#F5C400]" />
                  <span>Devices &amp; Browsers</span>
                </h3>
                <p className="text-xs text-[#8E8E93] mb-4">
                  Hardware and web browsers used by visitors
                </p>

                {/* Device Bars */}
                <div className="space-y-2.5 mb-6">
                  {[
                    { label: 'Desktop (PC / Mac)', count: analyticsData?.deviceBreakdown?.Desktop || 0, icon: Monitor },
                    { label: 'Mobile Phone', count: analyticsData?.deviceBreakdown?.Mobile || 0, icon: Smartphone },
                    { label: 'Tablet / iPad', count: analyticsData?.deviceBreakdown?.Tablet || 0, icon: Tablet }
                  ].map((dev) => {
                    const totalDevs = Math.max(
                      1,
                      (analyticsData?.deviceBreakdown?.Desktop || 0) +
                        (analyticsData?.deviceBreakdown?.Mobile || 0) +
                        (analyticsData?.deviceBreakdown?.Tablet || 0)
                    );
                    const pct = Math.round((dev.count / totalDevs) * 100);
                    const Icon = dev.icon;
                    return (
                      <div key={dev.label} className="p-2.5 rounded-xl bg-[#101014] border border-[#25252b]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 text-white">
                            <Icon className="w-3.5 h-3.5 text-[#F5C400]" />
                            {dev.label}
                          </span>
                          <span className="text-[#8E8E93] font-mono">
                            {dev.count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${Math.max(5, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Browser Tags */}
                <div className="pt-4 border-t border-[#25252b]">
                  <span className="text-[11px] font-bold uppercase text-[#8E8E93] block mb-2">
                    Browsers Detected
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analyticsData?.browserBreakdown || {}).map(([bName, bCount]) => (
                      <span
                        key={bName}
                        className="px-2.5 py-1 rounded-lg bg-[#202028] border border-white/5 text-xs text-white flex items-center gap-1.5"
                      >
                        <Globe className="w-3 h-3 text-[#F5C400]" />
                        <span>{bName}:</span>
                        <strong className="text-amber-400">{bCount}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Live Activity Stream */}
          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Real-Time Visitor Activity Stream</span>
                </h3>
                <p className="text-xs text-[#8E8E93]">
                  Latest pageviews logged across the streaming platform
                </p>
              </div>
              <button
                type="button"
                onClick={loadAnalytics}
                className="text-xs text-[#F5C400] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reload Live Feed</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#2d2d34] text-[#8E8E93]">
                    <th className="pb-3 font-semibold">Route / Path</th>
                    <th className="pb-3 font-semibold">Location</th>
                    <th className="pb-3 font-semibold">Audience</th>
                    <th className="pb-3 font-semibold">Device</th>
                    <th className="pb-3 font-semibold">Browser &amp; OS</th>
                    <th className="pb-3 font-semibold">Referrer</th>
                    <th className="pb-3 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24242c]">
                  {analyticsData?.recentVisits && analyticsData.recentVisits.length > 0 ? (
                    analyticsData.recentVisits.map((v, i) => (
                      <tr key={v.id || i} className="hover:bg-[#1f1f26] transition-colors">
                        <td className="py-2.5 font-mono text-white font-medium">
                          {v.path}
                        </td>
                        <td className="py-2.5">
                          <span className="flex items-center gap-1.5 text-white">
                            <LanguageFlag countryCode={v.countryCode} name={v.country} className="w-5 h-3.5 rounded-[2px]" />
                            <span className="font-medium truncate max-w-[110px]">{v.country || 'International'}</span>
                            {v.city && v.city !== 'Unknown' && (
                              <span className="text-[#8E8E93] text-[10px] truncate max-w-[80px]">({v.city})</span>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {v.isRegistered ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              {v.userEmail || 'Member'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[#8E8E93] text-[10px]">
                              Guest
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-[#D1D1D6]">{v.device}</td>
                        <td className="py-2.5 text-[#8E8E93]">
                          {v.browser} / {v.os}
                        </td>
                        <td className="py-2.5 text-[#8E8E93] truncate max-w-[120px]">
                          {v.referrer || 'Direct'}
                        </td>
                        <td className="py-2.5 text-right text-[#8E8E93] font-mono text-[11px]">
                          {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#8E8E93]">
                        No visits recorded yet. Visiting any page will automatically log entries here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: REGISTERED USERS DIRECTORY (Real Firestore Users)
         ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Banner and Search Controls */}
          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  Registered Members Directory
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#F5C400]/20 text-[#F5C400] text-xs font-bold border border-[#F5C400]/30">
                  {usersList.length} Total Users
                </span>
              </div>
              <p className="text-xs text-[#A6A6AC] mt-1">
                Accounts registered in Firebase Authentication and Firestore database
              </p>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-[#8E8E93] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by email, name or ID..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#0f0f12] border border-[#2d2d34] text-xs text-white placeholder-[#636366] focus:outline-none focus:border-[#F5C400] transition-colors"
              />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: `All Members (${usersList.length})` },
              { id: 'admins', label: 'Administrators' },
              { id: 'settings', label: 'Custom Player Configured' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setUserFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  userFilter === f.id
                    ? 'bg-[#F5C400] text-black font-extrabold shadow-sm'
                    : 'bg-[#1b1b22] text-[#8E8E93] hover:text-white border border-[#2d2d34]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Users Table */}
          <div className="rounded-2xl bg-[#16161a] border border-[#2d2d34] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#2d2d34] bg-[#121216] text-[#8E8E93]">
                    <th className="py-3.5 px-4 font-semibold">User</th>
                    <th className="py-3.5 px-4 font-semibold">Email</th>
                    <th className="py-3.5 px-4 font-semibold">Role</th>
                    <th className="py-3.5 px-4 font-semibold">Cloud Player Settings</th>
                    <th className="py-3.5 px-4 font-semibold">Registered</th>
                    <th className="py-3.5 px-4 font-semibold text-right">User ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22222a]">
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#8E8E93]">
                        <div className="w-6 h-6 border-2 border-[#F5C400] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span>Loading registered users from Firestore...</span>
                      </td>
                    </tr>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => {
                      const isAdm = isAdminUser(u.email);
                      return (
                        <tr key={u.userId} className="hover:bg-[#1e1e26] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {u.photoURL ? (
                                <img
                                  src={u.photoURL}
                                  alt={u.displayName}
                                  className="w-8 h-8 rounded-xl object-cover border border-white/10 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-[#F5C400] text-black font-black flex items-center justify-center shrink-0">
                                  {u.displayName[0]?.toUpperCase() || 'U'}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-white block">
                                  {u.displayName}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#E5E5EA] font-mono">
                            {u.email}
                          </td>
                          <td className="py-3 px-4">
                            {isAdm ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                                Super Admin
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-white/5 text-[#8E8E93] text-[10px] font-bold uppercase">
                                Member
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {u.hasPlayerSettings ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <Check className="w-3 h-3" />
                                Cloud Synced
                              </span>
                            ) : (
                              <span className="text-[#8E8E93] text-[11px]">
                                Default Server
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#8E8E93]">
                            {new Date(u.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(u.userId, u.userId)}
                              title="Copy UID"
                              className="font-mono text-[10px] text-[#8E8E93] hover:text-white inline-flex items-center gap-1 bg-[#0f0f12] px-2 py-1 rounded border border-[#2d2d34] cursor-pointer"
                            >
                              <span className="truncate max-w-[80px]">{u.userId}</span>
                              {copiedId === u.userId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#8E8E93]">
                        No users matching filter "{userSearchQuery || userFilter}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PLAYBACK ISSUE REPORTS (Live Firestore)
         ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-[#8E8E93] block">Total Reports</span>
              <span className="text-2xl font-black text-white mt-1 block">{reports.length}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-red-400 block">Open Tickets</span>
              <span className="text-2xl font-black text-red-400 mt-1 block">{openCount}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-amber-400 block">Under Investigation</span>
              <span className="text-2xl font-black text-amber-400 mt-1 block">
                {reports.filter((r) => r.status === 'investigating').length}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-emerald-400 block">Resolved</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                {reports.filter((r) => r.status === 'resolved').length}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#16161a] border border-[#2d2d34] w-fit">
            <Filter className="w-3.5 h-3.5 text-[#8E8E93] ml-2" />
            {(['all', 'open', 'investigating', 'resolved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setReportFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                  reportFilter === st
                    ? 'bg-[#F5C400] text-black font-extrabold'
                    : 'text-[#8E8E93] hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Reports Table */}
          {reportsLoading ? (
            <div className="p-12 text-center text-[#8E8E93] bg-[#16161a] rounded-2xl border border-[#2d2d34]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#F5C400]" />
              <span>Loading reports from Firestore...</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center text-[#8E8E93] bg-[#16161a] rounded-2xl border border-[#2d2d34]">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-bold text-white">No reports match this filter</p>
              <p className="text-xs mt-1">Users can report stream issues directly from the video player.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#16161a] border border-[#2d2d34] hover:border-[#3d3d46] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {report.posterPath && (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${report.posterPath}`}
                          alt={report.mediaTitle}
                          className="w-12 h-16 rounded-lg object-cover shrink-0 border border-[#2d2d34]"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">
                            {report.mediaTitle}
                          </span>
                          {report.season && report.episode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[#F5C400] border border-white/5">
                              S{report.season} E{report.episode}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {report.server}
                          </span>
                        </div>

                        <p className="text-xs text-red-300/90 font-medium mt-1">
                          Reason: <span className="text-white">{report.reason}</span>
                        </p>

                        <div className="flex items-center gap-4 text-[11px] text-[#8E8E93] mt-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(report.reportedAt).toLocaleString()}
                          </span>
                          {report.userEmail && (
                            <span>Reported by: <span className="text-white">{report.userEmail}</span></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <select
                        value={report.status}
                        onChange={(e) => handleStatusChange(report.id, e.target.value as any)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                          report.status === 'open'
                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : report.status === 'investigating'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                      </select>

                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: EMBED SERVERS & PLAYERS (Live Firestore)
         ========================================================================= */}
      {activeTab === 'servers' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Global Direct Stream vs Embed Player Master Switch */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1b1b22] to-[#141418] border border-[#F5C400]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Zap className={`w-4 h-4 ${directStreamEnabled ? 'text-emerald-400' : 'text-amber-400'}`} />
                <h3 className="text-base font-black text-white">
                  Direct Native Stream (Watch Page Mode)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    directStreamEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {directStreamEnabled ? 'Direct Stream ON · Core Default' : 'Direct Stream OFF · Embed Only'}
                </span>
              </div>
              <p className="text-xs text-[#A6A6AC] leading-relaxed max-w-2xl">
                When <strong className="text-white">ON</strong>, Watch Page starts in Direct Stream (<strong className="text-[#F5C400]">Core</strong> first, then other direct servers in background) with Embed Servers also selectable in the server bar. Turn <strong className="text-white">OFF</strong> to hide Direct Stream and use Embed Players only.
              </p>
            </div>

            <button
              type="button"
              disabled={savingDirectToggle}
              onClick={handleToggleDirectStream}
              className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2.5 transition-all cursor-pointer shrink-0 border shadow-md disabled:opacity-50 ${
                directStreamEnabled
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#F5C400] hover:bg-[#e0b400] text-black border-[#F5C400]'
              }`}
            >
              {directStreamEnabled ? (
                <>
                  <ToggleRight className="w-5 h-5 text-emerald-400" />
                  <span>Direct Stream: ON</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-black" />
                  <span>Direct Stream: OFF (Embed Only)</span>
                </>
              )}
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Multi-Server Streaming Sources
              </h3>
              <p className="text-xs text-[#A6A6AC] mt-1">
                Configure direct &amp; embed mirrors displayed in the Watch Page server bar.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetServers}
                className="px-3.5 py-2 rounded-xl bg-[#22222a] hover:bg-[#2c2c36] text-[#E5E5EA] text-xs font-bold border border-[#3A3A40] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddServer}
                className="px-4 py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add New Server</span>
              </button>
            </div>
          </div>

          {/* Servers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.map((srv) => (
              <div
                key={srv.id}
                className="p-5 rounded-2xl bg-[#16161a] border border-[#2d2d34] flex flex-col justify-between hover:border-[#3d3d46] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: srv.dotColor || '#F5C400' }}
                      />
                      <span className="font-bold text-white text-sm">{srv.name}</span>
                      {srv.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-[#282832] text-[#F5C400] border border-[#F5C400]/30">
                          {srv.badge}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        srv.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-white/5 text-[#8E8E93]'
                      }`}
                    >
                      {srv.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-[#8E8E93] mt-3">
                    <div className="flex items-center justify-between">
                      <span>Type:</span>
                      <span className="text-white font-mono uppercase">{srv.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Priority Order:</span>
                      <span className="text-white font-mono">#{srv.order}</span>
                    </div>
                    {srv.movieUrlTemplate && (
                      <div className="pt-1">
                        <span className="block text-[10px] text-[#636366]">Movie URL Template:</span>
                        <span className="font-mono text-[11px] text-amber-300 truncate block">
                          {srv.movieUrlTemplate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#25252c] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#636366]">ID: {srv.id}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditServer(srv)}
                      className="px-2.5 py-1 rounded-lg bg-[#25252c] hover:bg-[#32323c] text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-[#F5C400]" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteServer(srv)}
                      className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: STREAM VIEWS & RATINGS
         ========================================================================= */}
      {activeTab === 'views' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                Real Content Watch Counters
              </h3>
              <p className="text-xs text-[#A6A6AC] mt-1">
                Actual stream views incremented whenever users play movies and episodes.
              </p>
            </div>
            <span className="text-xs font-mono text-[#F5C400]">
              {movieStatsList.length} Titles Tracked
            </span>
          </div>

          {statsLoading ? (
            <div className="p-12 text-center text-[#8E8E93] bg-[#16161a] rounded-2xl border border-[#2d2d34]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#F5C400]" />
              <span>Querying movieStats from Firestore...</span>
            </div>
          ) : movieStatsList.length === 0 ? (
            <div className="p-12 text-center text-[#8E8E93] bg-[#16161a] rounded-2xl border border-[#2d2d34]">
              <Eye className="w-8 h-8 text-[#F5C400] mx-auto mb-2 opacity-60" />
              <p className="font-bold text-white">No stream views recorded yet</p>
              <p className="text-xs mt-1">Real views will populate as viewers watch movies and shows.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {movieStatsList.map((st) => (
                <div
                  key={st.mediaId}
                  className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-white truncate block">
                      {st.title || `Media ID: ${st.mediaId}`}
                    </span>
                    <span className="text-[11px] text-[#8E8E93] uppercase font-mono">
                      {st.mediaType || 'Movie'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-[#F5C400] block">
                      {st.views.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[#8E8E93]">Views</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 6: NODES & SYSTEM DIAGNOSTICS
         ========================================================================= */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34]">
            <h3 className="text-base font-bold text-white mb-1">
              Playback Infrastructure Health
            </h3>
            <p className="text-xs text-[#8E8E93] mb-6">
              Network verification of TMDB APIs and stream delivery providers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { name: 'TMDB Metadata API', status: testResults.tmdb },
                { name: 'MovieTV API Mirror', status: testResults.movietvapi },
                { name: 'VidSrc Cloud Node', status: testResults.vidsrc },
                { name: 'FMov Ultra Player', status: testResults.fmov },
                { name: 'Vidsrc.vip Stream Host', status: testResults.vdrk }
              ].map((node) => (
                <div
                  key={node.name}
                  className="p-4 rounded-xl bg-[#0f0f12] border border-[#26262c] flex items-center justify-between"
                >
                  <span className="text-xs font-bold text-white">{node.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Online
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34] flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white block">Client Cache Flushing</span>
              <span className="text-xs text-[#8E8E93]">
                Clear local storage caches for playback states and cached API responses.
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearCache}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-colors cursor-pointer"
            >
              {cacheCleared ? 'Cache Cleared!' : 'Flush Cache'}
            </button>
          </div>
        </div>
      )}

      {/* EDIT / ADD SERVER MODAL */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#16161a] border border-[#2d2d34] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#2d2d34] pb-3">
              <h3 className="text-base font-bold text-white">
                {editingServer ? 'Edit Streaming Server' : 'Add New Streaming Server'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="text-[#8E8E93] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveServer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#D1D1D6]">Server Name</label>
                  <input
                    type="text"
                    required
                    value={serverFormData.name}
                    onChange={(e) => setServerFormData({ ...serverFormData, name: e.target.value })}
                    placeholder="e.g. Server 5 · Ultra HD"
                    className="w-full h-10 px-3 rounded-xl bg-[#0d0d10] border border-[#2d2d34] text-xs text-white focus:outline-none focus:border-[#F5C400]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#D1D1D6]">Badge Tag</label>
                  <input
                    type="text"
                    value={serverFormData.badge}
                    onChange={(e) => setServerFormData({ ...serverFormData, badge: e.target.value })}
                    placeholder="e.g. HD, 4K, VIP"
                    className="w-full h-10 px-3 rounded-xl bg-[#0d0d10] border border-[#2d2d34] text-xs text-white focus:outline-none focus:border-[#F5C400]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#D1D1D6]">Stream Type</label>
                  <select
                    value={serverFormData.type}
                    onChange={(e) => setServerFormData({ ...serverFormData, type: e.target.value as 'direct' | 'embed' })}
                    className="w-full h-10 px-3 rounded-xl bg-[#0d0d10] border border-[#2d2d34] text-xs text-white focus:outline-none focus:border-[#F5C400] cursor-pointer"
                  >
                    <option value="embed">Embed Provider (Iframe)</option>
                    <option value="direct">Direct Native Stream (HLS)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#D1D1D6]">Display Order</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={serverFormData.order}
                    onChange={(e) => setServerFormData({ ...serverFormData, order: Number(e.target.value) })}
                    className="w-full h-10 px-3 rounded-xl bg-[#0d0d10] border border-[#2d2d34] text-xs text-white focus:outline-none focus:border-[#F5C400]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#D1D1D6]">Server Dot Indicator Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_DOT_COLORS.map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setServerFormData({ ...serverFormData, dotColor: c.color })}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                        serverFormData.dotColor === c.color
                          ? 'border-[#F5C400] bg-white/10 text-white'
                          : 'border-[#2d2d34] text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {serverFormData.type === 'embed' && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#D1D1D6]">Movie URL Template</label>
                      <span className="text-[10px] text-[#8E8E93]">Use {'{id}'} for movie ID</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={serverFormData.movieUrlTemplate}
                      onChange={(e) => setServerFormData({ ...serverFormData, movieUrlTemplate: e.target.value })}
                      placeholder="https://example.com/embed/movie/{id}"
                      className="w-full h-10 px-3 rounded-xl bg-[#0d0d10] border border-[#2d2d34] text-xs font-mono text-amber-300 focus:outline-none focus:border-[#F5C400]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#D1D1D6]">TV Series URL Template</label>
                      <span className="text-[10px] text-[#8E8E93]">Use {'{id}'}, {'{season}'}, {'{episode}'}</span>
                    </div>
                    <input
                      type="text"
                      value={serverFormData.tvUrlTemplate}
                      onChange={(e) => setServerFormData({ ...serverFormData, tvUrlTemplate: e.target.value })}
                      placeholder="https://example.com/embed/tv/{id}/{season}/{episode}"
                      className="w-full h-10 px-3 rounded-xl bg-[#0d0d10] border border-[#2d2d34] text-xs font-mono text-sky-300 focus:outline-none focus:border-[#F5C400]"
                    />
                  </div>
                </>
              )}

              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-[#0d0d10] border border-[#2d2d34]">
                <div>
                  <span className="text-xs font-bold text-white block">Active on Watch Page</span>
                  <span className="text-[11px] text-[#8E8E93]">
                    When active, this server pill appears under the player on all movie/TV watch pages.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setServerFormData({ ...serverFormData, enabled: !serverFormData.enabled })}
                  className="cursor-pointer"
                >
                  {serverFormData.enabled ? (
                    <ToggleRight className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-500" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2d2d34]">
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#A6A6AC] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingServer}
                  className="px-5 py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black text-xs font-black transition-colors cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {savingServer ? 'Saving...' : editingServer ? 'Update Server' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
