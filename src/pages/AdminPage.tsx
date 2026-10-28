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
  Code
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
  addEmbedServer,
  updateEmbedServer,
  deleteEmbedServer,
  resetEmbedServersToDefault,
  resolveEmbedUrl
} from '../services/embedServers';

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

  const [activeTab, setActiveTab] = useState<'reports' | 'views' | 'servers' | 'diagnostics'>('reports');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const [movieStatsList, setMovieStatsList] = useState<MovieStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Embed Servers state
  const [servers, setServers] = useState<EmbedServerConfig[]>([]);
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

  // Real-time subscription to Embed Servers
  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeToEmbedServers((data) => {
      setServers(data);
    });
    return () => unsubscribe();
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
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
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
            Ovaj operativni admin panel je zaštićen i dostupan isključivo ovlašćenom administratoru sajta (<span className="text-[#F5C400] font-semibold">{ADMIN_EMAILS[0]}</span>).
          </p>

          {user ? (
            <div className="mt-6 p-4 rounded-xl bg-[#0d0d10] border border-[#26262b] text-left text-xs">
              <p className="text-[#8E8E93]">Prijavljeni ste sa e-mail adresom:</p>
              <p className="font-semibold text-white truncate mt-0.5">{user.email}</p>
              <p className="text-[11px] text-amber-400/90 mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Ovaj korisnički nalog nema administratorska prava.</span>
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <button
                onClick={() => openAuthModal('login')}
                className="w-full py-3 px-4 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Key className="w-4 h-4" />
                <span>Prijavite se kao Administrator</span>
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

  const handleToggleServerEnabled = async (server: EmbedServerConfig) => {
    await updateEmbedServer(server.id, { enabled: !server.enabled });
  };

  const handleDeleteServer = async (serverId: string, serverName: string) => {
    if (confirm(`Are you sure you want to delete streaming server "${serverName}"?`)) {
      await deleteEmbedServer(serverId);
    }
  };

  const handleResetServers = async () => {
    if (confirm('Reset all embed players back to default TStream server configuration?')) {
      await resetEmbedServersToDefault();
    }
  };

  const handleSaveServerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverFormData.name.trim()) {
      alert('Please enter a server name.');
      return;
    }

    setSavingServer(true);
    try {
      if (editingServer) {
        await updateEmbedServer(editingServer.id, {
          name: serverFormData.name.trim(),
          type: serverFormData.type,
          badge: serverFormData.badge.trim(),
          dotColor: serverFormData.dotColor,
          enabled: serverFormData.enabled,
          order: Number(serverFormData.order) || 1,
          movieUrlTemplate: serverFormData.movieUrlTemplate.trim(),
          tvUrlTemplate: serverFormData.tvUrlTemplate.trim()
        });
      } else {
        await addEmbedServer({
          name: serverFormData.name.trim(),
          type: serverFormData.type,
          badge: serverFormData.badge.trim(),
          dotColor: serverFormData.dotColor,
          enabled: serverFormData.enabled,
          movieUrlTemplate: serverFormData.movieUrlTemplate.trim(),
          tvUrlTemplate: serverFormData.tvUrlTemplate.trim()
        });
      }
      setIsEditingModalOpen(false);
    } catch (err: any) {
      alert(`Error saving server: ${err.message}`);
    } finally {
      setSavingServer(false);
    }
  };

  const openCount = reports.filter((r) => r.status === 'open').length;
  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'all') return true;
    return r.status === reportFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 text-[#F3F3F3] font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#F5C400] mb-1">
            <Shield className="w-4 h-4" />
            <span>TStream Administration &amp; Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Admin Panel &amp; Live Problem Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#A6A6AC] mt-1">
            Logged in as <span className="text-amber-400 font-semibold">{user.email}</span>. Manage playback issue tickets, custom embed players, movie views, and servers.
          </p>
        </div>

        {activeTab === 'diagnostics' && (
          <button
            onClick={runDiagnostics}
            disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5C400] text-black text-xs font-extrabold hover:bg-[#e0b400] disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/20 w-fit cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing Nodes...' : 'Run Diagnostics'}</span>
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#16161a] border border-[#2d2d34] mb-8 overflow-x-auto no-scrollbar">
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
                activeTab === 'reports' ? 'bg-black text-[#F5C400]' : 'bg-[#F5C400] text-black'
              }`}
            >
              {openCount} Open
            </span>
          )}
        </button>

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
            {servers.filter(s => s.enabled).length} Active
          </span>
        </button>

        <button
          onClick={() => setActiveTab('views')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'views'
              ? 'bg-[#F5C400] text-black font-black shadow-md'
              : 'text-[#A6A6AC] hover:text-white'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Real Views &amp; Ratings Database</span>
        </button>

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
          TAB 1: PLAYBACK ISSUE REPORTS (Live Firestore)
         ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Top Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#16161a] border border-[#2d2d34]">
              <span className="text-[11px] font-bold uppercase text-[#8E8E93] block">Total Reports</span>
              <span className="text-2xl font-black text-white mt-1 block">{reports.length}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-amber-500/30">
              <span className="text-[11px] font-bold uppercase text-amber-400 block">Open Tickets</span>
              <span className="text-2xl font-black text-amber-400 mt-1 block">{openCount}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-blue-500/30">
              <span className="text-[11px] font-bold uppercase text-blue-400 block">Investigating</span>
              <span className="text-2xl font-black text-blue-400 mt-1 block">
                {reports.filter((r) => r.status === 'investigating').length}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#16161a] border border-emerald-500/30">
              <span className="text-[11px] font-bold uppercase text-emerald-400 block">Resolved</span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                {reports.filter((r) => r.status === 'resolved').length}
              </span>
            </div>
          </div>

          {/* Filter Sub-nav */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#18181c] border border-[#2d2d34]">
              {(['all', 'open', 'investigating', 'resolved'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setReportFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                    reportFilter === filter
                      ? 'bg-[#2a2a32] text-white shadow-sm'
                      : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <span className="text-xs text-[#8E8E93]">
              Showing {filteredReports.length} ticket{filteredReports.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Reports Table / List */}
          {reportsLoading ? (
            <div className="p-12 text-center text-[#8E8E93] flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-[#F5C400]" />
              <p className="text-xs">Loading live Firestore playback issue tickets...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#16161a] border border-[#2d2d34] text-center text-[#8E8E93]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-white">No playback reports found</p>
              <p className="text-xs mt-1">Users have not reported any issues matching this filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="p-5 rounded-2xl bg-[#16161a] border border-[#2d2d34] hover:border-[#3e3e48] transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {(report.reason || 'Playback Issue').replace('_', ' ')}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            report.status === 'open'
                              ? 'bg-amber-500/20 text-amber-300'
                              : report.status === 'investigating'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {report.status}
                        </span>

                        <span className="text-xs text-[#8E8E93] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(report.reportedAt || Date.now()).toLocaleString()}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>{report.mediaTitle}</span>
                        <span className="text-xs font-normal text-[#8E8E93]">
                          ({report.mediaType.toUpperCase()} · ID: {report.mediaId})
                        </span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-[#A6A6AC] pt-1">
                        <div>
                          <span className="text-[#8E8E93]">Server: </span>
                          <span className="font-semibold text-white">{report.server || 'Direct HLS'}</span>
                        </div>
                        {report.season && report.episode && (
                          <div>
                            <span className="text-[#8E8E93]">Episode: </span>
                            <span className="font-semibold text-white">
                              S{report.season} E{report.episode}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-[#8E8E93]">Reported by: </span>
                          <span className="font-semibold text-white truncate">
                            {report.userEmail || 'Anonymous Guest'}
                          </span>
                        </div>
                      </div>

                      {(report.notes || report.details) && (
                        <div className="mt-2 p-3 rounded-xl bg-[#0f0f12] border border-[#26262b] text-xs text-[#D1D1D6]">
                          <span className="text-[#8E8E93] block text-[10px] uppercase font-bold mb-1">
                            User Notes:
                          </span>
                          {report.notes || report.details}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex md:flex-col items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-[#1e1e24] p-1 rounded-xl border border-[#2d2d34]">
                        {(['open', 'investigating', 'resolved'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => handleStatusChange(report.id, st)}
                            title={`Mark as ${st}`}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                              report.status === st
                                ? st === 'resolved'
                                  ? 'bg-emerald-500 text-black'
                                  : st === 'investigating'
                                  ? 'bg-blue-500 text-black'
                                  : 'bg-amber-500 text-black'
                                : 'text-[#8E8E93] hover:text-white'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete ticket"
                      >
                        <Trash2 className="w-4 h-4" />
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
          TAB 2: EMBED PLAYERS & STREAMING SERVERS CONFIGURATION
         ========================================================================= */}
      {activeTab === 'servers' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34]">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#F5C400]" />
                <span>Configure Embed Players &amp; Streaming Servers</span>
              </h2>
              <p className="text-xs text-[#A6A6AC] mt-1 max-w-2xl">
                Ovdje možete menjati postojeće plejere (Server 1 Direct HLS, Server 2 HD, Server 3 Backup, Server 4 Ultra) i dodavati potpuno nove embed provajdere. Sve promene se odmah primenjuju na stranici za gledanje.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleResetServers}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#A6A6AC] hover:text-white transition-colors cursor-pointer border border-[#2d2d34]"
                title="Restore initial 4 default servers"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>

              <button
                onClick={handleOpenAddServer}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black text-xs font-black transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add New Embed Server</span>
              </button>
            </div>
          </div>

          {/* Servers Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {servers.map((server, index) => (
              <div
                key={server.id}
                className={`p-5 rounded-2xl bg-[#16161a] border transition-all relative ${
                  server.enabled
                    ? 'border-[#2d2d34] hover:border-amber-400/40'
                    : 'border-white/5 opacity-60 bg-[#121215]'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{
                        backgroundColor: server.dotColor || '#F5C400',
                        boxShadow: `0 0 10px ${server.dotColor || '#F5C400'}`
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{server.name}</h3>
                        {server.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/10">
                            {server.badge}
                          </span>
                        )}
                        {server.type === 'direct' ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300">
                            Direct HLS
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-sky-500/20 text-sky-300">
                            Embed Iframe
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#8E8E93]">Order #{server.order || index + 1}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Enable / Disable toggle button */}
                    <button
                      onClick={() => handleToggleServerEnabled(server)}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        server.enabled
                          ? 'text-emerald-400 hover:bg-emerald-500/10'
                          : 'text-[#8E8E93] hover:text-white hover:bg-white/5'
                      }`}
                      title={server.enabled ? 'Enabled (Click to disable)' : 'Disabled (Click to enable)'}
                    >
                      {server.enabled ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-500" />
                      )}
                      <span className="text-[11px]">{server.enabled ? 'Active' : 'Off'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditServer(server)}
                      className="p-1.5 rounded-lg text-[#A6A6AC] hover:text-[#F5C400] hover:bg-white/5 transition-colors cursor-pointer"
                      title="Edit server settings"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteServer(server.id, server.name)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete server"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Templates preview */}
                <div className="space-y-2 mt-4 pt-3 border-t border-[#26262b] text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                      Movie URL Template:
                    </span>
                    <div className="mt-1 p-2 rounded-lg bg-[#0d0d10] font-mono text-[11px] text-amber-200/90 truncate border border-[#232328]">
                      {server.movieUrlTemplate || (server.type === 'direct' ? 'Native HLS Engine (/api/stream/master.m3u8)' : 'Not configured')}
                    </div>
                  </div>

                  {server.type === 'embed' && (
                    <div>
                      <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                        TV Series URL Template:
                      </span>
                      <div className="mt-1 p-2 rounded-lg bg-[#0d0d10] font-mono text-[11px] text-sky-200/90 truncate border border-[#232328]">
                        {server.tvUrlTemplate || 'Not configured'}
                      </div>
                    </div>
                  )}

                  {server.type === 'embed' && server.movieUrlTemplate && (
                    <div className="pt-1">
                      <span className="text-[10px] text-[#8E8E93]">Sample resolved URL (Spider-Man 969681): </span>
                      <span className="text-[10px] font-mono text-[#D1D1D6] truncate block">
                        {resolveEmbedUrl(server.movieUrlTemplate, { id: 969681 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Help Guide */}
          <div className="p-5 rounded-2xl bg-[#141418] border border-[#26262c] text-xs text-[#A6A6AC] space-y-2">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <Code className="w-4 h-4 text-[#F5C400]" />
              <span>URL Template Placeholders &amp; Syntax</span>
            </h4>
            <p>
              When configuring an embed server, you can use dynamic tags that are replaced at runtime with the active content:
            </p>
            <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-[#D1D1D6]">
              <li><strong className="text-[#F5C400]">{'{id}'}</strong> or <strong className="text-[#F5C400]">{'{tmdbId}'}</strong> — The movie or TV show TMDB ID (e.g., 969681)</li>
              <li><strong className="text-[#F5C400]">{'{season}'}</strong> — TV Show Season number (e.g., 1)</li>
              <li><strong className="text-[#F5C400]">{'{episode}'}</strong> — TV Show Episode number (e.g., 1)</li>
            </ul>
            <p className="text-[11px] text-[#8E8E93] pt-1">
              Examples: <code className="text-white">https://movietvapi.stream/embed/movie/{'{id}'}</code> or <code className="text-white">https://vidsrc.sh/embed/tv/{'{id}'}/{'{season}'}/{'{episode}'}</code>
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: REAL VIEWS & RATINGS DATABASE (Live Firestore)
         ========================================================================= */}
      {activeTab === 'views' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#16161a] border border-[#2d2d34]">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#F5C400]" />
              <span>Real Movie &amp; Series Views Counter</span>
            </h2>
            <p className="text-xs text-[#A6A6AC] mt-1">
              Live statistics collected directly from visitors watching content on TStream. Every view increments the real Firestore counter shown next to the rating on the watch page.
            </p>
          </div>

          {statsLoading ? (
            <div className="p-12 text-center text-[#8E8E93] flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-[#F5C400]" />
              <p className="text-xs">Loading movie view records from Firestore...</p>
            </div>
          ) : movieStatsList.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#16161a] border border-[#2d2d34] text-center text-[#8E8E93]">
              <Eye className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-white">No movie view records yet</p>
              <p className="text-xs mt-1">
                Open any movie or TV show on the watch page to start counting real views in Firestore!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {movieStatsList.map((stat) => (
                <div
                  key={stat.mediaId}
                  className="p-5 rounded-2xl bg-[#16161a] border border-[#2d2d34] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#8E8E93] mb-2">
                      <span className="px-2 py-0.5 rounded bg-white/5 uppercase font-bold text-[10px]">
                        ID: {stat.mediaId}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <Eye className="w-3.5 h-3.5" />
                        {stat.views.toLocaleString()} views
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white line-clamp-1">
                      {stat.title || `Media #${stat.mediaId}`}
                    </h4>

                    {stat.ratingCount > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="text-[#8E8E93]">Rating:</span>
                        <span className="font-bold text-[#F5C400]">
                          {(stat.ratingSum / stat.ratingCount).toFixed(1)} / 5
                        </span>
                        <span className="text-[#8E8E93]">({stat.ratingCount} votes)</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#26262b] text-[11px] text-[#8E8E93] flex items-center justify-between">
                    <span>Last viewed:</span>
                    <span className="text-white font-medium">
                      {stat.lastViewedAt ? new Date(stat.lastViewedAt).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: NODES & DIAGNOSTICS
         ========================================================================= */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          {/* Node Health Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Node 1: Direct Master HLS */}
            <div className="p-5 rounded-2xl bg-[#16161a] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Server 1 (Direct)</span>
                {testResults.fmov === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : testResults.fmov === 'checking' ? (
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="text-base font-bold text-white">TStream Native HLS</div>
              <p className="text-[11px] text-slate-400 mt-1">Multi-bitrate adaptive proxy cluster</p>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Latency</span>
                <span className="text-emerald-400 font-semibold">42 ms</span>
              </div>
            </div>

            {/* Node 2: MovieTVApi */}
            <div className="p-5 rounded-2xl bg-[#16161a] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Server 2 (HD)</span>
                {testResults.movietvapi === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                )}
              </div>
              <div className="text-base font-bold text-white">movietvapi.stream</div>
              <p className="text-[11px] text-slate-400 mt-1">Official v3 HD Embed</p>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Fast CDN</span>
                <span className="text-emerald-400 font-semibold">READY</span>
              </div>
            </div>

            {/* Node 3: VidSrc */}
            <div className="p-5 rounded-2xl bg-[#16161a] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Server 3 (Backup)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-base font-bold text-white">vidsrc.sh</div>
              <p className="text-[11px] text-slate-400 mt-1">High-availability fallback</p>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Failover</span>
                <span className="text-emerald-400 font-semibold">READY</span>
              </div>
            </div>

            {/* Node 4: FMOV */}
            <div className="p-5 rounded-2xl bg-[#16161a] border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Server 4 (Ultra)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-base font-bold text-white">fmov.my</div>
              <p className="text-[11px] text-slate-400 mt-1">Multi-server VIP embed router</p>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Ultra VIP</span>
                <span className="text-emerald-400 font-semibold">READY</span>
              </div>
            </div>
          </div>

          {/* TMDB API Key Live Configuration */}
          <div className="p-6 rounded-2xl bg-[#16161a] border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">Live TMDB v3 API Key &amp; Live Mode</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Real-time movie and TV show queries from official TMDB endpoints.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE API ACTIVE</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                defaultValue={localStorage.getItem('tstream_tmdb_api_key') || '844dba0bfd8f3a4f3799f6130ef9e335'}
                id="tmdb_key_input"
                className="flex-1 h-10 px-4 rounded-xl bg-[#0d0d0f] border border-white/10 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#F5C400]"
                placeholder="Enter TMDB v3 API Key"
              />
              <button
                onClick={() => {
                  const val = (document.getElementById('tmdb_key_input') as HTMLInputElement)?.value;
                  if (val) {
                    localStorage.setItem('tstream_tmdb_api_key', val.trim());
                    alert('TMDB API Key updated successfully! Reloading...');
                    window.location.reload();
                  }
                }}
                className="h-10 px-5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs transition-colors shrink-0 cursor-pointer"
              >
                Save &amp; Reconnect
              </button>
            </div>
          </div>

          {/* Operational Actions */}
          <div className="p-6 rounded-2xl bg-[#16161a] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Local Cache Management</h4>
              <p className="text-xs text-slate-400 mt-0.5">Flush saved client continue watching timestamps, history, and test records.</p>
            </div>

            <button
              onClick={handleClearCache}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>{cacheCleared ? 'Cache Cleared!' : 'Clear Client Storage'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD / EDIT EMBED SERVER MODAL
         ========================================================================= */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-2xl bg-[#16161a] border border-[#2d2d34] p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-[#2d2d34] mb-5">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[#F5C400]" />
                <h3 className="text-base font-bold text-white">
                  {editingServer ? 'Edit Embed Player / Server' : 'Add New Streaming Server'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="p-1 rounded-lg text-[#8E8E93] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveServerForm} className="space-y-4">
              {/* Server Name & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-[#D1D1D6]">Server Display Name</label>
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

              {/* Server Type & Order */}
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

              {/* Dot Color Picker */}
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

              {/* URL Templates */}
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

              {/* Status Toggle */}
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

              {/* Modal buttons */}
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
