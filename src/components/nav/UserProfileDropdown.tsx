import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Bookmark,
  History,
  Sliders,
  LogOut,
  LogIn,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAdminUser } from '../../utils/admin';

interface UserProfileDropdownProps {
  onNavigate: (view: string, extraParams?: any) => void;
  onOpenPlaybackSettings?: () => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  onNavigate,
  onOpenPlaybackSettings
}) => {
  const { user, profile, watchlist, continueWatching, openAuthModal, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAdmin = isAdminUser(user?.email);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="h-8 px-3.5 rounded-lg bg-[#F5C400] hover:bg-[#e0b400] active:scale-95 text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In / Register</span>
        </button>
      </div>
    );
  }

  const displayName = profile?.displayName || user.displayName || user.email?.split('@')[0] || 'User';
  const initial = displayName[0]?.toUpperCase() || 'U';

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`h-8.5 pl-1.5 pr-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer border ${
          isOpen
            ? 'bg-[#303038] border-[#F5C400] text-white shadow-sm'
            : 'bg-[#212126] hover:bg-[#2b2b32] border-[#3A3A40] text-[#E5E5EA]'
        }`}
      >
        {/* Avatar */}
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={displayName}
            className="w-6 h-6 rounded-lg object-cover border border-[#F5C400]/40 shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-lg bg-[#F5C400] text-black font-black text-[11px] flex items-center justify-center shrink-0">
            {initial}
          </div>
        )}

        {/* Name */}
        <span className="text-xs font-bold max-w-[80px] lg:max-w-[100px] truncate text-left">
          {displayName}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[#8E8E93] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#F5C400]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[#1e1e24] border border-[#3A3A40] shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-2 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/50">
          {/* User Info Header */}
          <div className="p-2.5 rounded-xl bg-[#26262e] border border-white/5 mb-2">
            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="w-10 h-10 rounded-xl object-cover border border-[#F5C400]"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#F5C400] text-black font-black text-sm flex items-center justify-center shrink-0">
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-white truncate">{displayName}</p>
                  <CheckCircle2 className="w-3 h-3 text-[#F5C400] shrink-0" />
                </div>
                <p className="text-[10px] text-[#8E8E93] truncate">{user.email}</p>
                <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-[#F5C400]/15 text-[#F5C400]">
                  <Sparkles className="w-2.5 h-2.5" />
                  Free VIP Streamer
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="space-y-0.5 text-xs">
            {/* My Profile */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openAuthModal('profile');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer font-medium text-left group"
            >
              <User className="w-4 h-4 text-[#F5C400] group-hover:text-black transition-colors" />
              <span>My Profile</span>
            </button>

            {/* Watchlist */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openAuthModal('watchlist');
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer font-medium text-left group"
            >
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-4 h-4 text-[#F5C400] group-hover:text-black transition-colors" />
                <span>Watchlist</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full bg-[#303038] group-hover:bg-black group-hover:text-[#F5C400] text-white text-[10px] font-bold">
                {watchlist.length}
              </span>
            </button>

            {/* Watch History */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openAuthModal('watchlist');
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer font-medium text-left group"
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-[#F5C400] group-hover:text-black transition-colors" />
                <span>Watch History</span>
              </div>
              {continueWatching.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#303038] group-hover:bg-black group-hover:text-[#F5C400] text-slate-300 text-[10px] font-bold">
                  {continueWatching.length}
                </span>
              )}
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onNavigate('settings');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-200 hover:text-black hover:bg-[#F5C400] transition-colors cursor-pointer font-medium text-left group"
            >
              <Sliders className="w-4 h-4 text-[#F5C400] group-hover:text-black transition-colors" />
              <span>Player &amp; Server Settings</span>
            </button>

            {/* Admin Panel (if admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigate('admin');
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-amber-300 hover:text-black hover:bg-amber-400 transition-colors cursor-pointer font-bold text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:text-black" />
                  <span>Admin Panel</span>
                </div>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 group-hover:bg-black text-amber-300 group-hover:text-amber-400">
                  Root
                </span>
              </button>
            )}
          </div>

          <div className="my-1.5 h-px bg-white/10" />

          {/* Logout */}
          <button
            type="button"
            onClick={async () => {
              setIsOpen(false);
              await logout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-400 hover:text-white hover:bg-red-600/80 transition-colors cursor-pointer font-medium text-left group text-xs"
          >
            <LogOut className="w-4 h-4 text-red-400 group-hover:text-white transition-colors" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
