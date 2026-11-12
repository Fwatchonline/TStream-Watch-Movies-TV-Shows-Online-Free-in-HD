import React from 'react';
import { PLATFORM_CONFIGS, PlatformMeta, getPlatformConfigById } from './platformConfig';

export interface PlatformInfo extends PlatformMeta {
  renderLogo: (size?: 'sm' | 'md' | 'lg') => React.ReactNode;
}

const PLATFORM_LOGOS: Record<string, (size?: 'sm' | 'md' | 'lg') => React.ReactNode> = {
  netflix: (size = 'md') => {
    const textClass = size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'sm' ? 'text-sm' : 'text-lg sm:text-xl';
    return (
      <div className="flex flex-col items-center justify-center">
        <span className={`text-[#E50914] font-black ${textClass} tracking-tighter drop-shadow-[0_2px_10px_rgba(229,9,20,0.6)] font-sans select-none`}>
          NETFLIX
        </span>
      </div>
    );
  },
  apple: (size = 'md') => {
    const iconClass = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4 sm:w-5 sm:h-5';
    const textClass = size === 'lg' ? 'text-lg sm:text-xl' : size === 'sm' ? 'text-xs' : 'text-xs sm:text-sm';
    return (
      <div className="flex items-center justify-center gap-1.5 text-white select-none">
        <svg viewBox="0 0 170 170" className={`${iconClass} fill-white shrink-0`}>
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-6.41-9.79-11.48-21.03-15.19-33.71-3.71-12.68-5.57-24.16-5.57-34.46 0-14.68 3.73-26.79 11.19-36.31 7.46-9.52 16.9-14.37 28.34-14.55 4.89 0 10.36 1.3 16.42 3.91 6.06 2.61 9.94 4.02 11.64 4.23 1.28-.21 5.37-1.68 12.28-4.42 6.91-2.74 12.63-3.96 17.16-3.66 12.68 1.07 22.84 5.99 30.47 14.75-11.09 6.74-16.52 15.93-16.29 27.56.24 9.13 3.86 16.89 10.87 23.28 7.01 6.39 15.22 10.02 24.63 10.89-2.13 6.52-4.58 13.26-7.36 20.21zM119.22 33.15c0-7.39 2.61-14.47 7.83-21.25 5.22-6.78 11.83-10.96 19.83-12.55.21 1.07.32 2.03.32 2.87 0 7.39-2.72 14.52-8.15 21.39-5.43 6.87-12.15 11.02-20.15 12.45-.42-.96-.64-1.93-.64-2.91z"/>
        </svg>
        <span className={`font-extrabold ${textClass} tracking-tight`}>tv+</span>
      </div>
    );
  },
  max: (size = 'md') => {
    const hboClass = size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'sm' ? 'text-sm' : 'text-base sm:text-lg';
    const maxClass = size === 'lg' ? 'text-base sm:text-lg' : size === 'sm' ? 'text-[10px]' : 'text-xs sm:text-sm';
    return (
      <div className="flex items-center justify-center gap-1 select-none">
        <span className={`text-white font-black ${hboClass} tracking-tight leading-none`}>HBO</span>
        <span className={`text-[#9933FF] font-black ${maxClass} tracking-normal uppercase`}>MAX</span>
      </div>
    );
  },
  prime: (size = 'md') => {
    const textClass = size === 'lg' ? 'text-lg sm:text-xl' : size === 'sm' ? 'text-[11px]' : 'text-xs sm:text-sm';
    const smileClass = size === 'lg' ? 'w-16 h-4' : size === 'sm' ? 'w-8 h-2' : 'w-10 sm:w-12 h-2.5';
    return (
      <div className="flex flex-col items-center justify-center select-none">
        <div className="flex items-center gap-0.5 leading-none">
          <span className={`text-[#00A8E1] font-black ${textClass} tracking-tight`}>prime</span>
          <span className={`text-white font-extrabold ${textClass} tracking-tight`}>video</span>
        </div>
        <svg viewBox="0 0 100 20" className={`${smileClass} fill-[#00A8E1] mt-0.5`}>
          <path d="M12 2c26 13 52 13 76 0-3 4-8 8-13 10-20 6-42 5-60-5-2-2-3-3-3-5z"/>
        </svg>
      </div>
    );
  },
  disney: (size = 'md') => {
    const textClass = size === 'lg' ? 'text-xl sm:text-2xl' : size === 'sm' ? 'text-xs' : 'text-sm sm:text-base';
    const plusClass = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';
    return (
      <div className="flex items-center justify-center relative select-none">
        <span className={`text-white font-black ${textClass} tracking-tight font-serif italic`}>Disney</span>
        <span className={`text-[#3E7CFF] font-black ${plusClass} leading-none ml-0.5 -mt-1`}>+</span>
      </div>
    );
  },
  peacock: (size = 'md') => {
    const textClass = size === 'lg' ? 'text-xs sm:text-sm' : size === 'sm' ? 'text-[8px]' : 'text-[9px] sm:text-[10px]';
    return (
      <div className="flex flex-col items-center justify-center gap-1 select-none">
        <div className="flex items-center gap-0.5">
          <span className="w-1 h-2.5 rounded-full bg-[#FFD100]"></span>
          <span className="w-1 h-3 rounded-full bg-[#FF8000]"></span>
          <span className="w-1 h-3.5 rounded-full bg-[#E50914]"></span>
          <span className="w-1 h-3.5 rounded-full bg-[#C20092]"></span>
          <span className="w-1 h-3 rounded-full bg-[#6B18A4]"></span>
          <span className="w-1 h-2.5 rounded-full bg-[#008BE2]"></span>
        </div>
        <span className={`text-white font-black ${textClass} tracking-widest lowercase`}>peacock</span>
      </div>
    );
  },
  paramount: (size = 'md') => {
    const iconClass = size === 'lg' ? 'w-5 h-5' : size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-4 sm:h-4';
    const textClass = size === 'lg' ? 'text-xs sm:text-sm' : size === 'sm' ? 'text-[8px]' : 'text-[9px] sm:text-[10px]';
    return (
      <div className="flex items-center justify-center gap-0.5 text-white select-none">
        <svg viewBox="0 0 24 24" className={`${iconClass} fill-white shrink-0`}>
          <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z"/>
        </svg>
        <span className={`text-white font-black ${textClass} tracking-tight uppercase`}>Paramount</span>
        <span className="text-[#0064FF] font-black text-sm -mt-0.5">+</span>
      </div>
    );
  },
  hulu: (size = 'md') => {
    const textClass = size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'sm' ? 'text-sm' : 'text-lg sm:text-xl';
    return (
      <div className="flex items-center justify-center select-none">
        <span className={`text-[#1CE783] font-black ${textClass} tracking-tighter drop-shadow-[0_2px_8px_rgba(28,231,131,0.4)]`}>
          hulu
        </span>
      </div>
    );
  },
  crunchyroll: (size = 'md') => {
    const circleClass = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4 sm:w-5 sm:h-5';
    const textClass = size === 'lg' ? 'text-sm sm:text-base' : size === 'sm' ? 'text-[9px]' : 'text-[10px] sm:text-xs';
    return (
      <div className="flex items-center justify-center gap-1.5 select-none">
        <div className={`${circleClass} rounded-full bg-[#F47521] flex items-center justify-center relative shrink-0 shadow-md shadow-orange-500/20`}>
          <div className="w-2 h-2 rounded-full bg-[#141519] ml-0.5"></div>
        </div>
        <span className={`text-white font-black ${textClass} tracking-tight`}>crunchyroll</span>
      </div>
    );
  }
};

export const PLATFORMS_LIST: PlatformInfo[] = PLATFORM_CONFIGS.map(cfg => ({
  ...cfg,
  renderLogo: PLATFORM_LOGOS[cfg.id] || (() => <span>{cfg.name}</span>)
}));

export function getPlatformById(id?: string | null): PlatformInfo | undefined {
  const cfg = getPlatformConfigById(id);
  if (!cfg) return undefined;
  return PLATFORMS_LIST.find(p => p.id === cfg.id);
}
