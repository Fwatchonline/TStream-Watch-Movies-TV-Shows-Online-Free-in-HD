import React, { useState, useRef, useEffect } from 'react';
import { Bell, Tv, Check, CheckCheck, Sparkles, ExternalLink, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EpisodeNotification } from '../services/firebase';

interface NotificationBellProps {
  onWatchEpisode?: (showId: number, showTitle: string, season: number, episode: number, posterPath?: string) => void;
  onNavigateNewEpisodes?: () => void;
  variant?: 'header' | 'topbar';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onWatchEpisode,
  onNavigateNewEpisodes,
  variant = 'header'
}) => {
  const {
    user,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    openAuthModal
  } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleBellClick = () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    setIsOpen(prev => !prev);
  };

  const handleNotificationClick = async (notif: EpisodeNotification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
    }
    setIsOpen(false);

    const tvId = parseInt(notif.showId, 10);
    if (!isNaN(tvId) && onWatchEpisode) {
      onWatchEpisode(tvId, notif.showTitle, notif.seasonNumber, notif.episodeNumber, notif.posterPath);
    }
  };

  const formatAirDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleBellClick}
        aria-label="New episode notifications"
        className={`relative p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
          variant === 'header'
            ? 'bg-[#242428] hover:bg-[#303036] border border-[#3A3A40] text-[#A6A6AC] hover:text-[#F5C400]'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
        title={user ? `${unreadNotificationsCount} new episode alerts` : 'Sign in for episode notifications'}
      >
        <Bell className="w-4 h-4" />

        {/* Unread indicator badge */}
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#F5C400] text-black text-[9px] font-black shadow-lg shadow-amber-500/40 animate-pulse">
            {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#1c1c22] border border-[#3A3A40] shadow-2xl z-50 overflow-hidden backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
          style={{ maxWidth: 'calc(100vw - 24px)' }}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#24242a] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#F5C400]/20 text-[#F5C400] flex items-center justify-center">
                <Tv className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                New Episodes
              </h3>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#F5C400] text-black text-[10px] font-black">
                  {unreadNotificationsCount} NEW
                </span>
              )}
            </div>

            {notifications.length > 0 && unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsRead()}
                className="text-[11px] font-semibold text-[#F5C400] hover:text-[#ffe066] flex items-center gap-1 transition-colors cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {notifications.length > 0 ? (
              notifications.map((notif) => {
                const isUnread = !notif.read;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 flex items-start gap-3 transition-colors cursor-pointer group ${
                      isUnread
                        ? 'bg-[#F5C400]/5 hover:bg-[#F5C400]/10'
                        : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {/* Poster thumbnail */}
                    <div className="relative w-11 h-16 rounded-lg bg-[#141418] shrink-0 overflow-hidden border border-white/10 shadow-sm">
                      {notif.posterPath ? (
                        <img
                          src={notif.posterPath}
                          alt={notif.showTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                          <Tv className="w-4 h-4" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 text-[#F5C400] fill-[#F5C400]" />
                      </div>
                    </div>

                    {/* Content details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#F5C400] transition-colors truncate">
                          {notif.showTitle}
                        </h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#F5C400] shrink-0 shadow-[0_0_8px_rgba(245,196,0,0.8)]" />
                        )}
                      </div>

                      {/* Episode code & title */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="px-1.5 py-0.5 rounded bg-[#F5C400] text-black text-[10px] font-extrabold font-mono">
                          S{notif.seasonNumber} · E{notif.episodeNumber}
                        </span>
                        <span className="text-[11px] text-slate-300 font-medium truncate">
                          {notif.episodeName || `Episode ${notif.episodeNumber}`}
                        </span>
                      </div>

                      {/* Air date & action */}
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                        <span>Aired {formatAirDate(notif.airDate)}</span>
                        <span className="text-[#F5C400] font-bold group-hover:underline flex items-center gap-0.5">
                          <span>Watch now</span>
                          <span className="text-[9px]">▶</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-white/5 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                  <Sparkles className="w-5 h-5 text-[#F5C400]" />
                </div>
                <p className="text-xs font-bold text-white mb-1">
                  No episode alerts yet
                </p>
                <p className="text-[11px] text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                  Follow your favorite TV shows to receive instant notifications when new episodes air!
                </p>
              </div>
            )}
          </div>

          {/* Footer: Link to all New Episodes */}
          <div className="p-2.5 bg-[#17171c] border-t border-white/5 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onNavigateNewEpisodes) onNavigateNewEpisodes();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#26262e] hover:bg-[#32323c] text-white font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/5 hover:border-[#F5C400]/40 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F5C400]" />
              <span>Explore All New Episodes</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
