import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  Bookmark,
  LogOut,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Play,
  Trash2,
  Film,
  Tv,
  Eye,
  EyeOff,
  Clock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MediaItem } from '../types/media';

interface AuthModalProps {
  onSelectMedia?: (item: MediaItem) => void;
}

// 3 columns of real high-resolution TMDB posters for the animated showcase
const POSTER_COLUMNS = [
  // Column 1 (Scrolls UP)
  [
    'https://image.tmdb.org/t/p/w500/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg', // Avengers
    'https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', // Dune 2
    'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
    'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', // Interstellar
    'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', // Dune 1
    'https://image.tmdb.org/t/p/w500/r2J02Z2OpNTctfOSN2Ydgii51I3.jpg'  // Guardians
  ],
  // Column 2 (Scrolls DOWN)
  [
    'https://image.tmdb.org/t/p/w500/fiVW06jE7z9YnO4trhaMEdclSiC.jpg', // Fast X
    'https://image.tmdb.org/t/p/w500/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg', // Kung Fu Panda 4
    'https://image.tmdb.org/t/p/w500/vZloFAK7NKnMGKEslUsZ2bOGaVh.jpg', // Spider-Man No Way Home
    'https://image.tmdb.org/t/p/w500/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', // Avatar Way of Water
    'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', // Fight Club
    'https://image.tmdb.org/t/p/w500/cxevDYdeFUr4kVW7ca6VtRSTdA5.jpg'  // Air
  ],
  // Column 3 (Scrolls UP)
  [
    'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', // Oppenheimer
    'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', // Jurassic World
    'https://image.tmdb.org/t/p/w500/NNxYkU70HPurnNCSiCjYAmacwm.jpg', // Mission Impossible
    'https://image.tmdb.org/t/p/w500/ngl2FKBlU4fhbdsrtdom9LVLBXw.jpg', // Arcane
    'https://image.tmdb.org/t/p/w500/7iiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
    'https://image.tmdb.org/t/p/w500/reKs8y4mPwXZZG99vDrF3M1pmw5.jpg'  // Gladiator
  ]
];

export const AuthModal: React.FC<AuthModalProps> = ({ onSelectMedia }) => {
  const {
    user,
    profile,
    watchlist,
    continueWatching,
    isAuthModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    logout,
    toggleWatchlist
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'profile' | 'watchlist'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sync modal mode from context
  React.useEffect(() => {
    if (user) {
      if (authModalMode === 'watchlist') {
        setActiveTab('watchlist');
      } else {
        setActiveTab('profile');
      }
    } else {
      if (authModalMode === 'register') {
        setActiveTab('register');
      } else {
        setActiveTab('login');
      }
    }
    setErrorMsg('');
    setSuccessMsg('');
  }, [authModalMode, user, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      setSuccessMsg('Signed in successfully!');
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in cancelled.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignored
      } else {
        setErrorMsg(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
      setSuccessMsg('Signed in successfully!');
    } catch (err: any) {
      console.error('Login error:', err);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setErrorMsg('Incorrect email or password.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Please enter a valid email address.');
      } else {
        setErrorMsg(err.message || 'Sign-in failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      await registerWithEmail(email, password, displayName);
      setSuccessMsg('Account created successfully!');
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Please enter a valid email address.');
      } else {
        setErrorMsg(err.message || 'Registration failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={closeAuthModal}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-[#16161a] border border-[#303036] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden relative flex flex-col ${
          user ? 'max-w-xl p-6 sm:p-7' : 'max-w-4xl md:flex-row min-h-[580px]'
        }`}
      >
        {/* Floating Close Button for mobile or single-view */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 z-40 w-8 h-8 rounded-full bg-black/60 hover:bg-[#F5C400] text-slate-300 hover:text-black flex items-center justify-center transition-colors cursor-pointer border border-white/10 md:hidden"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* =========================================================================
            GUEST / AUTH VIEW (LOGIN & REGISTER - 2 COLUMNS EXACT MATCH TO ATTACHMENT)
           ========================================================================= */}
        {!user ? (
          <>
            {/* LEFT COLUMN: AUTH FORM */}
            <div className="w-full md:w-[54%] p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative z-20">
              <div>
                {/* Brand & VIP Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[#F5C400] flex items-center justify-center text-black font-black shadow-md shadow-amber-500/20">
                    <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                  </div>
                  <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                    T <span className="text-[#F5C400]">STREAM</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#F5C400]/20 text-[#F5C400] text-[10px] font-black uppercase tracking-wider border border-[#F5C400]/40">
                    VIP
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-auto hidden sm:block">
                    WATCH FREE MOVIES &amp; TV
                  </span>
                </div>

                {/* Heading */}
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1.5">
                  {activeTab === 'login' ? (
                    <>
                      Welcome back to <span className="text-[#F5C400]">T STREAM</span>
                    </>
                  ) : (
                    <>
                      Join <span className="text-[#F5C400]">T STREAM</span> Today
                    </>
                  )}
                </h2>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm text-[#A6A6AC] mb-6 leading-relaxed">
                  {activeTab === 'login'
                    ? 'Sign in to access your continue watching, library, and personalized streams.'
                    : 'Create an account to save movies, customize preferences, and sync across devices.'}
                </p>

                {/* Error & Success Messages */}
                {errorMsg && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Form Fields */}
                <form
                  onSubmit={activeTab === 'login' ? handleEmailLogin : handleEmailRegister}
                  className="space-y-3.5"
                >
                  {/* Display Name (Register only) */}
                  {activeTab === 'register' && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Display Name
                      </label>
                      <div className="relative flex items-center">
                        <UserIcon className="w-4 h-4 text-[#71717A] absolute left-3.5 pointer-events-none" />
                        <input
                          type="text"
                          required
                          placeholder="Enter your display name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0f0f12] border border-[#2d2d33] text-xs sm:text-sm text-white placeholder:text-[#63636B] focus:outline-none focus:border-[#F5C400] transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-[#71717A] absolute left-3.5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        placeholder="Username or email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#0f0f12] border border-[#2d2d33] text-xs sm:text-sm text-white placeholder:text-[#63636B] focus:outline-none focus:border-[#F5C400] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        Password
                      </label>
                      {activeTab === 'login' && (
                        <button
                          type="button"
                          onClick={() => setSuccessMsg('Password reset instructions sent to your email.')}
                          className="text-[10px] text-slate-400 hover:text-[#F5C400] transition-colors cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-[#71717A] absolute left-3.5 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#0f0f12] border border-[#2d2d33] text-xs sm:text-sm text-white placeholder:text-[#63636B] focus:outline-none focus:border-[#F5C400] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 text-[#71717A] hover:text-white transition-colors cursor-pointer"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-xl bg-[#F5C400] hover:bg-[#e0b400] text-black font-black text-sm active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-60 mt-3"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : activeTab === 'login' ? (
                      'Login'
                    ) : (
                      'Sign Up'
                    )}
                  </button>
                </form>

                {/* Tab Switcher */}
                <div className="text-center mt-4">
                  {activeTab === 'login' ? (
                    <p className="text-xs text-slate-400">
                      Don&apos;t have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('register');
                          setErrorMsg('');
                        }}
                        className="text-white hover:text-[#F5C400] font-black underline cursor-pointer ml-1"
                      >
                        Sign up
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('login');
                          setErrorMsg('');
                        }}
                        className="text-white hover:text-[#F5C400] font-black underline cursor-pointer ml-1"
                      >
                        Login
                      </button>
                    </p>
                  )}
                </div>

                {/* Or with Google divider & button */}
                <div className="relative flex items-center justify-center my-4">
                  <div className="border-t border-[#2e2e36] w-full" />
                  <span className="bg-[#16161a] px-2 text-[10px] text-[#71717A] uppercase tracking-wider font-semibold">
                    or
                  </span>
                  <div className="border-t border-[#2e2e36] w-full" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isSubmitting}
                  className="w-full h-10 px-4 rounded-xl bg-[#0f0f12] hover:bg-[#1f1f25] border border-[#2d2d33] text-slate-200 font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* Bottom legal notice */}
              <p className="text-[10px] text-slate-500 leading-tight mt-6 text-center">
                This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.
              </p>
            </div>

            {/* RIGHT COLUMN: 3 ANIMATED MOVING POSTER COLUMNS */}
            <div className="hidden md:flex w-[46%] bg-[#0e0e12] border-l border-[#2e2e34] relative overflow-hidden h-[590px]">
              {/* Circular close button on top right of the poster container */}
              <button
                onClick={closeAuthModal}
                className="absolute top-4 right-4 z-40 w-8 h-8 rounded-full bg-black/80 hover:bg-[#F5C400] text-white hover:text-black flex items-center justify-center transition-colors cursor-pointer border border-white/10 shadow-lg"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Top & Bottom fade masks */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0e0e12] via-[#0e0e12]/80 to-transparent z-20" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0e0e12] via-[#0e0e12]/80 to-transparent z-20" />

              {/* Poster 3-Column Marquee Grid */}
              <div className="grid grid-cols-3 gap-2.5 w-full h-full p-2.5 overflow-hidden">
                {/* Column 1 - Moving UP */}
                <div className="flex flex-col gap-2.5 animate-marquee-up">
                  {[...POSTER_COLUMNS[0], ...POSTER_COLUMNS[0]].map((src, i) => (
                    <div
                      key={i}
                      className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#1a1a20] shadow-md shrink-0 border border-white/5"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>

                {/* Column 2 - Moving DOWN */}
                <div className="flex flex-col gap-2.5 animate-marquee-down">
                  {[...POSTER_COLUMNS[1], ...POSTER_COLUMNS[1]].map((src, i) => (
                    <div
                      key={i}
                      className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#1a1a20] shadow-md shrink-0 border border-white/5"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>

                {/* Column 3 - Moving UP Fast */}
                <div className="flex flex-col gap-2.5 animate-marquee-up-fast">
                  {[...POSTER_COLUMNS[2], ...POSTER_COLUMNS[2]].map((src, i) => (
                    <div
                      key={i}
                      className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#1a1a20] shadow-md shrink-0 border border-white/5"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* =========================================================================
              LOGGED IN VIEW: PROFILE & WATCHLIST MANAGEMENT
             ========================================================================= */
          <div className="space-y-5">
            {/* Header close button */}
            <button
              onClick={closeAuthModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#A6A6AC] hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F5C400] flex items-center justify-center text-black font-black shadow-md shadow-amber-500/20">
                <UserIcon className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Member Account
                </h3>
                <p className="text-xs text-[#8E8E93]">
                  Connected via Google Cloud Firestore
                </p>
              </div>
            </div>

            {/* Segmented Control */}
            <div className="flex bg-[#121215] p-1 rounded-xl border border-[#2b2b32]">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[#F5C400] text-black shadow-sm font-bold'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                Profile Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('watchlist')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'watchlist'
                    ? 'bg-[#F5C400] text-black shadow-sm font-bold'
                    : 'text-[#A6A6AC] hover:text-white'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                Watchlist ({watchlist.length})
              </button>
            </div>

            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#121215] border border-[#2d2d33]">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar'}
                      className="w-12 h-12 rounded-full border border-[#F5C400] object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#F5C400] text-black font-black text-lg flex items-center justify-center">
                      {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-white truncate">
                      {profile?.displayName || user.displayName || 'User'}
                    </h4>
                    <p className="text-xs text-[#A6A6AC] truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                        Active VIP Member
                      </span>
                      <span className="text-[10px] text-[#A6A6AC]">
                        {continueWatching.length} in progress · {watchlist.length} saved
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#121215] p-3.5 rounded-xl border border-[#2d2d33] space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#242429]">
                    <span className="text-[#8E8E93]">Cloud User ID:</span>
                    <span className="font-mono text-[11px] text-[#C5C5C9] truncate max-w-[200px]">{user.uid}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#242429]">
                    <span className="text-[#8E8E93]">Continue Watching:</span>
                    <span className="text-emerald-400 font-semibold">{continueWatching.length} active streams</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#8E8E93]">Cloud Sync:</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Live Firestore Sync Active
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-2.5 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}

            {/* TAB: WATCHLIST */}
            {activeTab === 'watchlist' && (
              <div className="space-y-3">
                {watchlist.length === 0 ? (
                  <div className="p-8 text-center bg-[#121215] rounded-xl border border-[#242429]">
                    <Bookmark className="w-8 h-8 text-[#52525B] mx-auto mb-2" />
                    <p className="text-xs text-[#A6A6AC]">Your cloud watchlist is empty.</p>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                    {watchlist.map((item) => (
                      <div
                        key={item.tmdbId}
                        onClick={() => {
                          if (onSelectMedia) {
                            onSelectMedia({
                              id: parseInt(item.tmdbId, 10),
                              tmdbId: parseInt(item.tmdbId, 10),
                              title: item.title,
                              posterPath: item.posterPath || '',
                              backdropPath: item.posterPath || '',
                              releaseDate: item.releaseDate || '',
                              voteAverage: item.voteAverage || 8.0,
                              mediaType: item.mediaType,
                              overview: '',
                              voteCount: 100,
                              popularity: 100,
                              genres: []
                            });
                            closeAuthModal();
                          }
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#121215] hover:bg-[#1a1a20] border border-[#242429] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.posterPath ? (
                            <img
                              src={item.posterPath}
                              alt={item.title}
                              className="w-9 h-13 object-cover rounded-md shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-13 bg-[#1e1e24] rounded-md flex items-center justify-center shrink-0">
                              <Film className="w-4 h-4 text-slate-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs text-white group-hover:text-[#F5C400] transition-colors truncate">
                              {item.title}
                            </h5>
                            <span className="text-[10px] text-slate-400 uppercase">
                              {item.mediaType}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist({ id: parseInt(item.tmdbId, 10) });
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
