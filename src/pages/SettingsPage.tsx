import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Server,
  Subtitles,
  Play,
  RotateCcw,
  Check,
  CheckCircle2,
  Sparkles,
  Shield,
  Film,
  Tv,
  Eye,
  Layers,
  Zap,
  Globe,
  Palette,
  Volume2,
  Maximize2,
  Info,
  Lock,
  LogIn,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  UserPlayerSettings,
  DEFAULT_PLAYER_SETTINGS,
  SUBTITLE_LANGUAGES,
  getUserPlayerSettings,
  saveUserPlayerSettings,
  loadUserPlayerSettingsFromFirestore
} from '../services/playerSettings';
import {
  EmbedServerConfig,
  getEmbedServers,
  DEFAULT_SERVERS
} from '../services/embedServers';

interface SettingsPageProps {
  onNavigate: (view: string, extraParams?: any) => void;
}

const QUALITY_PRESETS = [
  { label: 'Auto (Adaptive Bitrate)', value: 'Auto', desc: 'Recommended for smooth buffer-free streaming' },
  { label: '2160p (4K Ultra HD)', value: '2160p', desc: 'Maximum sharpness for 4K displays' },
  { label: '1080p (Full HD)', value: '1080p', desc: 'Crisp high definition standard' },
  { label: '720p (HD)', value: '720p', desc: 'Balanced for medium speed connections' },
  { label: '480p (SD)', value: '480p', desc: 'Data saver mode for mobile hotspots' }
];

const SPEED_PRESETS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

const COLOR_PRESETS = [
  { name: 'TStream Yellow', hex: '#F5C400' },
  { name: 'Amber Gold', hex: '#FBBF24' },
  { name: 'Crimson Red', hex: '#E50914' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Neon Purple', hex: '#8B5CF6' },
  { name: 'Cyan Blue', hex: '#06B6D4' },
  { name: 'Pure White', hex: '#FFFFFF' }
];

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { user, openAuthModal } = useAuth();
  const [settings, setSettings] = useState<UserPlayerSettings>(getUserPlayerSettings);
  const [servers, setServers] = useState<EmbedServerConfig[]>(DEFAULT_SERVERS);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Load cloud settings from Firestore database if user is logged in
  useEffect(() => {
    if (user?.uid) {
      setIsLoadingSettings(true);
      loadUserPlayerSettingsFromFirestore(user.uid)
        .then((loaded) => {
          setSettings(loaded);
        })
        .finally(() => {
          setIsLoadingSettings(false);
        });
    }
  }, [user?.uid]);

  // Load configured streaming servers
  useEffect(() => {
    getEmbedServers().then((list) => {
      const enabled = list.filter((s) => s.enabled);
      setServers(enabled.length > 0 ? enabled : DEFAULT_SERVERS);
    });
  }, []);

  const handleChange = <K extends keyof UserPlayerSettings>(
    key: K,
    value: UserPlayerSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    setIsSaving(true);
    try {
      await saveUserPlayerSettings(settings, user.uid);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving settings to cloud database:', err);
      alert(err?.message || 'Failed to save settings to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    if (window.confirm('Are you sure you want to restore all player settings to default factory values?')) {
      const defaults = { ...DEFAULT_PLAYER_SETTINGS };
      setSettings(defaults);
      try {
        await saveUserPlayerSettings(defaults, user.uid);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } catch (e: any) {
        console.error('Error resetting defaults:', e);
      }
    }
  };

  // If user is not authenticated, render the exclusive registered member gate
  if (!user) {
    return (
      <div className="min-h-screen bg-[#18181c] text-[#F3F3F3] pb-24 font-sans select-none selection:bg-[#F5C400] selection:text-black">
        {/* Top Header Banner */}
        <div className="border-b border-[#3A3A40] bg-gradient-to-b from-[#25252c] to-[#1c1c22] py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="p-2 rounded-xl bg-[#F5C400]/15 text-[#F5C400] border border-[#F5C400]/30">
                  <Sliders className="w-5 h-5" />
                </span>
                <span className="text-xs font-black tracking-wider uppercase text-[#F5C400]">
                  Cloud Preferences
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Player &amp; Server Settings
              </h1>
              <p className="text-sm text-[#A6A6AC] mt-1 max-w-2xl">
                Personalized streaming servers, subtitles, and player settings saved directly to your cloud profile in the database.
              </p>
            </div>
          </div>
        </div>

        {/* Member Access Required Gate */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
          <div className="rounded-2xl border border-[#3A3A40] bg-[#212128]/95 p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden backdrop-blur-sm">
            {/* Background Glow */}
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F5C400]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#F5C400]/15 border border-[#F5C400]/40 text-[#F5C400] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#F5C400]/5">
                <Lock className="w-8 h-8" />
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5C400]/15 text-[#F5C400] text-xs font-bold uppercase tracking-wider mb-3 border border-[#F5C400]/30">
                <Shield className="w-3.5 h-3.5" />
                Registered Members Only
              </span>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
                Cloud Settings Require an Account
              </h2>

              <p className="text-sm sm:text-base text-[#A6A6AC] leading-relaxed mb-8">
                Player and server settings are stored in the cloud database and synced to your personal profile. Sign in or create a free account to customize your default servers, subtitle styles, and playback options.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#F5C400]/20 active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In / Create Free Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#2b2b34] hover:bg-[#34343f] text-[#E5E5EA] font-bold text-sm transition-all cursor-pointer"
                >
                  Return to Home
                </button>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-[#3A3A40]/60 text-left">
                <div className="p-4 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/40">
                  <div className="flex items-center gap-2 text-[#F5C400] mb-1 font-bold text-xs">
                    <Server className="w-4 h-4" />
                    <span>Default Server</span>
                  </div>
                  <p className="text-xs text-[#A6A6AC]">
                    Choose between Direct HLS or HD mirrors with auto-fallback.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/40">
                  <div className="flex items-center gap-2 text-[#F5C400] mb-1 font-bold text-xs">
                    <Subtitles className="w-4 h-4" />
                    <span>Custom Subtitles</span>
                  </div>
                  <p className="text-xs text-[#A6A6AC]">
                    Default language, font size, colors, and live real-time preview.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/40">
                  <div className="flex items-center gap-2 text-[#F5C400] mb-1 font-bold text-xs">
                    <Zap className="w-4 h-4" />
                    <span>Database Sync</span>
                  </div>
                  <p className="text-xs text-[#A6A6AC]">
                    Instantly synced across your TV, PC, tablet, and mobile devices.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#18181c] text-[#F3F3F3] pb-28 font-sans select-none selection:bg-[#F5C400] selection:text-black">
      {/* Top Header Banner */}
      <div className="border-b border-[#3A3A40] bg-gradient-to-b from-[#25252c] to-[#1c1c22] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 rounded-xl bg-[#F5C400]/15 text-[#F5C400] border border-[#F5C400]/30">
                <Sliders className="w-5 h-5" />
              </span>
              <span className="text-xs font-black tracking-wider uppercase text-[#F5C400]">
                Cloud Preferences
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Database Synced ({user.email})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Player &amp; Server Settings
            </h1>
            <p className="text-sm text-[#A6A6AC] mt-1 max-w-2xl">
              Configure your default streaming server, subtitle styling, and playback preferences. Changes are saved directly to your cloud profile in the database.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl bg-[#2b2b34] hover:bg-[#34343f] text-[#E5E5EA] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#F5C400]/20 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>Saved to Cloud!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Cloud Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Content Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Success Alert Toast */}
        {savedSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>All player and server settings successfully synced to your cloud account in the database!</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-[11px] underline cursor-pointer"
            >
              Go to Home
            </button>
          </div>
        )}

        {/* SECTION 1: DEFAULT STREAMING SERVER */}
        <section className="p-6 rounded-2xl bg-[#212128] border border-[#3A3A40] shadow-sm">
          <div className="flex items-center gap-2.5 mb-1 text-white">
            <Server className="w-5 h-5 text-[#F5C400]" />
            <h2 className="text-lg font-bold">1. Default Streaming Server</h2>
          </div>
          <p className="text-xs text-[#A6A6AC] mb-5">
            Choose your primary server. Videos will launch automatically on this server.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {servers.map((srv) => {
              const isSelected = settings.defaultServerId === srv.id;
              const isDirect = srv.id === 'server_1_direct';

              return (
                <div
                  key={srv.id}
                  onClick={() => handleChange('defaultServerId', srv.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#2b2b36] border-[#F5C400] shadow-md shadow-[#F5C400]/5 ring-1 ring-[#F5C400]/30'
                      : 'bg-[#1b1b22] border-[#3A3A40]/70 hover:border-[#F5C400]/50 hover:bg-[#23232c]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: srv.dotColor || '#F5C400' }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{srv.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-[#303038] text-[#F5C400] border border-[#F5C400]/30">
                            {srv.badge || (isDirect ? 'Direct HLS' : 'Mirror')}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#A6A6AC] mt-1">
                          {isDirect
                            ? 'Fast multi-server HLS stream without ads with multi-language subtitle track auto-loading.'
                            : 'Fast embed mirror with wide movie and TV series catalog.'}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#F5C400] border-[#F5C400] text-black'
                          : 'border-[#505058] bg-[#1a1a20]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Active Default
                      </span>
                      <span className="text-[#8E8E93]">Primary Source</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Auto Fallback Toggle */}
          <div className="mt-5 pt-4 border-t border-[#3A3A40]/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">
                Auto-Fallback Server on Stream Interruption
              </span>
              <span className="text-[11px] text-[#8E8E93] block">
                If the active server runs into a playback error or network block, automatically switch to the next backup server.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoFallbackServer}
                onChange={(e) => handleChange('autoFallbackServer', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#303038] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F5C400]"></div>
            </label>
          </div>
        </section>

        {/* SECTION 2: SUBTITLE PREFERENCES & LIVE PREVIEW */}
        <section className="p-6 rounded-2xl bg-[#212128] border border-[#3A3A40] shadow-sm">
          <div className="flex items-center gap-2.5 mb-1 text-white">
            <Subtitles className="w-5 h-5 text-[#F5C400]" />
            <h2 className="text-lg font-bold">2. Subtitle Preferences</h2>
          </div>
          <p className="text-xs text-[#A6A6AC] mb-5">
            Set your preferred language and personalize subtitle appearance with real-time visual feedback.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Subtitle Controls */}
            <div className="space-y-4">
              {/* Default Language Selector */}
              <div>
                <label className="text-xs font-bold text-white block mb-1.5">
                  Default Subtitle Language
                </label>
                <select
                  value={settings.defaultSubtitleLang}
                  onChange={(e) => handleChange('defaultSubtitleLang', e.target.value)}
                  className="w-full bg-[#1b1b22] border border-[#3A3A40] text-white text-xs rounded-xl px-3 py-2.5 focus:border-[#F5C400] focus:outline-none transition-colors cursor-pointer"
                >
                  {SUBTITLE_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-[#1b1b22] text-white">
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-Load Subtitles Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/70">
                <div>
                  <span className="text-xs font-bold text-white block">Auto-Load Subtitles</span>
                  <span className="text-[11px] text-[#8E8E93] block">
                    Automatically activate subtitles on stream launch
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoLoadSubtitles}
                    onChange={(e) => handleChange('autoLoadSubtitles', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#303038] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#F5C400]"></div>
                </label>
              </div>

              {/* Subtitle Font Size */}
              <div>
                <label className="text-xs font-bold text-white block mb-1.5">Subtitle Font Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'small', label: 'Small', px: '14px' },
                    { id: 'medium', label: 'Medium', px: '18px' },
                    { id: 'large', label: 'Large', px: '24px' },
                    { id: 'xlarge', label: 'Extra', px: '32px' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleChange('subtitleSize', s.id as any)}
                      className={`py-2 px-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                        settings.subtitleSize === s.id
                          ? 'bg-[#F5C400] text-black border-[#F5C400]'
                          : 'bg-[#1b1b22] text-[#A6A6AC] border-[#3A3A40] hover:text-white hover:bg-[#282830]'
                      }`}
                    >
                      <div>{s.label}</div>
                      <div className="text-[9px] opacity-75">{s.px}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtitle Color */}
              <div>
                <label className="text-xs font-bold text-white block mb-1.5">Subtitle Text Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: '#FFFFFF', name: 'White', tag: 'white' },
                    { id: '#FFD000', name: 'Yellow', tag: 'yellow' },
                    { id: '#00E5FF', name: 'Cyan', tag: 'cyan' },
                    { id: '#00FF88', name: 'Green', tag: 'green' }
                  ].map((col) => {
                    const isSelected =
                      settings.subtitleColor === col.id || settings.subtitleColor === col.tag;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => handleChange('subtitleColor', col.tag as any)}
                        className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#2b2b36] border-[#F5C400] text-white ring-1 ring-[#F5C400]'
                            : 'bg-[#1b1b22] border-[#3A3A40] text-[#A6A6AC] hover:text-white'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/30"
                          style={{ backgroundColor: col.id }}
                        />
                        <span>{col.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subtitle Background Style */}
              <div>
                <label className="text-xs font-bold text-white block mb-1.5">Background Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'shadow', label: 'Shadow Drop' },
                    { id: 'box', label: 'Dark Box' },
                    { id: 'outline', label: 'Outline Text' }
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleChange('subtitleBackground', bg.id as any)}
                      className={`py-2 px-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                        settings.subtitleBackground === bg.id
                          ? 'bg-[#F5C400] text-black border-[#F5C400]'
                          : 'bg-[#1b1b22] text-[#A6A6AC] border-[#3A3A40] hover:text-white'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Live Subtitle Preview Box */}
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white block mb-1.5 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#F5C400]" />
                Live Subtitle Preview
              </span>
              <div className="flex-1 rounded-2xl bg-black border border-[#3A3A40] relative overflow-hidden flex flex-col justify-between p-4 min-h-[260px] shadow-inner">
                {/* Simulated Movie Backdrop Scene */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-35 filter brightness-75 pointer-events-none"
                  style={{
                    backgroundImage:
                      'url(https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80)'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between text-[11px] text-white/70">
                  <span className="flex items-center gap-1 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE 4K RENDER
                  </span>
                  <span className="text-[#F5C400] font-bold">TStream Player</span>
                </div>

                {/* Subtitle rendered in exact selected styles */}
                <div className="relative z-10 my-auto text-center px-4">
                  <div
                    className={`inline-block max-w-[90%] leading-relaxed font-semibold transition-all ${
                      settings.subtitleSize === 'small'
                        ? 'text-xs sm:text-sm'
                        : settings.subtitleSize === 'large'
                        ? 'text-base sm:text-xl'
                        : settings.subtitleSize === 'xlarge'
                        ? 'text-lg sm:text-2xl'
                        : 'text-sm sm:text-base'
                    } ${
                      settings.subtitleColor === 'yellow' || settings.subtitleColor === '#FFD000'
                        ? 'text-[#FFD000]'
                        : settings.subtitleColor === 'cyan' || settings.subtitleColor === '#00E5FF'
                        ? 'text-[#00E5FF]'
                        : settings.subtitleColor === 'green' || settings.subtitleColor === '#00FF88'
                        ? 'text-[#00FF88]'
                        : 'text-white'
                    } ${
                      settings.subtitleBackground === 'shadow'
                        ? 'bg-black/35 backdrop-blur-[1px] px-3 py-1 rounded drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
                        : settings.subtitleBackground === 'outline'
                        ? 'bg-transparent px-2 py-0.5 [text-shadow:_0_0_4px_#000,_0_0_6px_#000,_0_0_8px_#000]'
                        : 'bg-black/85 border border-white/10 backdrop-blur-xs shadow-lg px-4 py-1.5 rounded-lg'
                    }`}
                  >
                    “The journey of a thousand miles begins with a single step.”
                  </div>
                </div>

                <div className="relative z-10 text-center text-[10px] text-[#8E8E93]">
                  Subtitles automatically adapt and sync according to your database profile
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: PLAYBACK & VIDEO QUALITY */}
        <section className="p-6 rounded-2xl bg-[#212128] border border-[#3A3A40] shadow-sm">
          <div className="flex items-center gap-2.5 mb-1 text-white">
            <Play className="w-5 h-5 text-[#F5C400]" />
            <h2 className="text-lg font-bold">3. Playback &amp; Video Quality</h2>
          </div>
          <p className="text-xs text-[#A6A6AC] mb-5">
            Configure default resolution, playback speed, and automated player controls.
          </p>

          <div className="space-y-6">
            {/* Resolution Selector */}
            <div>
              <label className="text-xs font-bold text-white block mb-2">
                Default Video Quality
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {QUALITY_PRESETS.map((q) => {
                  const isSelected = settings.defaultQuality === q.value;
                  return (
                    <div
                      key={q.value}
                      onClick={() => handleChange('defaultQuality', q.value as any)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#2b2b36] border-[#F5C400] text-white ring-1 ring-[#F5C400]'
                          : 'bg-[#1b1b22] border-[#3A3A40]/70 text-[#A6A6AC] hover:border-[#F5C400]/40 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{q.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#F5C400]" />}
                      </div>
                      <span className="text-[10px] text-[#8E8E93] mt-1">{q.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Playback Speed */}
            <div>
              <label className="text-xs font-bold text-white block mb-2">
                Default Playback Speed
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SPEED_PRESETS.map((spd) => {
                  const isSelected = settings.defaultSpeed === spd;
                  return (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handleChange('defaultSpeed', spd)}
                      className={`py-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#F5C400] text-black border-[#F5C400]'
                          : 'bg-[#1b1b22] text-[#A6A6AC] border-[#3A3A40] hover:text-white'
                      }`}
                    >
                      {spd === 1.0 ? '1.0x (Normal)' : `${spd}x`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Smart Automated Toggles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4 border-t border-[#3A3A40]/60">
              {/* Autoplay Next Episode */}
              <div className="p-3.5 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Autoplay Next Episode</span>
                  <span className="text-[10px] text-[#8E8E93]">
                    Automatically advance TV series
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoplayNextEpisode}
                    onChange={(e) => handleChange('autoplayNextEpisode', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#303038] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#F5C400]"></div>
                </label>
              </div>

              {/* Auto Resume Playback */}
              <div className="p-3.5 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Auto-Resume Position</span>
                  <span className="text-[10px] text-[#8E8E93]">
                    Resume exactly where you left off
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoResumePlayback}
                    onChange={(e) => handleChange('autoResumePlayback', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#303038] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#F5C400]"></div>
                </label>
              </div>

              {/* Default Theater Mode */}
              <div className="p-3.5 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Default Theater Mode</span>
                  <span className="text-[10px] text-[#8E8E93]">
                    Full width &amp; dimmed backdrop
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.defaultTheaterMode}
                    onChange={(e) => handleChange('defaultTheaterMode', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#303038] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#F5C400]"></div>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: PLAYER ACCENT COLOR */}
        <section className="p-6 rounded-2xl bg-[#212128] border border-[#3A3A40] shadow-sm">
          <div className="flex items-center gap-2.5 mb-1 text-white">
            <Palette className="w-5 h-5 text-[#F5C400]" />
            <h2 className="text-lg font-bold">4. Player Accent Theme</h2>
          </div>
          <p className="text-xs text-[#A6A6AC] mb-5">
            Personalize the progress bar scrubber, volume sliders, and player controls theme.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 mb-6">
            {COLOR_PRESETS.map((col) => {
              const isSelected = settings.playerAccentColor === col.hex;
              return (
                <button
                  key={col.hex}
                  type="button"
                  onClick={() => handleChange('playerAccentColor', col.hex)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2b2b36] border-[#F5C400] ring-1 ring-[#F5C400]'
                      : 'bg-[#1b1b22] border-[#3A3A40]/70 hover:border-[#F5C400]/40 hover:bg-[#23232a]'
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded-full border border-black/30 shadow-md"
                    style={{ backgroundColor: col.hex }}
                  />
                  <span className="text-[11px] font-bold text-white text-center truncate w-full">
                    {col.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scrubber Live Preview Bar */}
          <div className="p-4 rounded-xl bg-[#1b1b22] border border-[#3A3A40]/70">
            <div className="flex items-center justify-between text-xs text-[#8E8E93] mb-2 font-mono">
              <span>01:14:20</span>
              <span className="text-white font-bold">Progress Bar Preview</span>
              <span>02:28:45</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: '55%',
                  backgroundColor: settings.playerAccentColor || '#F5C400'
                }}
              />
            </div>
          </div>
        </section>

        {/* BOTTOM FLOATING SAVE BAR */}
        <div className="p-4 rounded-2xl bg-[#25252e] border border-[#3A3A40] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-[#F5C400]/15 text-[#F5C400]">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <span className="text-xs font-bold text-white block">
                Preferences Synced to Cloud Database
              </span>
              <span className="text-[11px] text-[#A6A6AC]">
                Your settings are safely stored in Firestore for {user.email} and take effect on all your playback sessions.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-[#1b1b22] hover:bg-[#282830] text-[#E5E5EA] text-xs font-bold transition-all cursor-pointer"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#F5C400]/20 active:scale-95 disabled:opacity-50 min-w-[170px]"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-black stroke-[3]" />
                  <span>Saved to Cloud!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Cloud Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
