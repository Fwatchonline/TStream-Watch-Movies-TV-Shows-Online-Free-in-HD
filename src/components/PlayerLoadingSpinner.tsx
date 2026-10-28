import React from 'react';
import { Play } from 'lucide-react';

interface PlayerLoadingSpinnerProps {
  title?: string;
  subtitle?: string;
  className?: string;
  serverName?: string;
}

export const PlayerLoadingSpinner: React.FC<PlayerLoadingSpinnerProps> = ({
  title = 'CONNECTING TO DIRECT HLS STREAM',
  subtitle = 'Fast multi-server HLS playback, multilingual subtitles, and zero ads.',
  className = '',
  serverName
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0d] w-full h-full select-none ${className}`}
    >
      {/* Circular Rotating Brand Spinner */}
      <div className="relative w-36 h-36 flex items-center justify-center mb-5">
        {/* Outer subtle glowing ring */}
        <div className="absolute inset-0 rounded-full border border-[#F5C400]/20 animate-pulse pointer-events-none" />

        {/* Thin accent fast spinning arc */}
        <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-[#F5C400] border-r-[#F5C400]/40 animate-spin [animation-duration:1.6s] pointer-events-none" />

        {/* Rotating Circular Text: Tstream.online */}
        <svg
          viewBox="0 0 160 160"
          className="absolute inset-0 w-full h-full animate-spin [animation-duration:9s] pointer-events-none"
        >
          <defs>
            {/* Clockwise Circle Path */}
            <path
              id="tstreamCirclePath"
              d="M 80, 80 m -56, 0 a 56,56 0 1,1 112,0 a 56,56 0 1,1 -112,0"
            />
          </defs>
          <text
            fill="#F5C400"
            fontSize="10"
            fontWeight="900"
            letterSpacing="2.6"
            className="uppercase font-mono drop-shadow-[0_0_6px_rgba(245,196,0,0.5)]"
          >
            <textPath href="#tstreamCirclePath" startOffset="0%">
              TSTREAM.ONLINE • TSTREAM.ONLINE • 
            </textPath>
          </text>
        </svg>

        {/* Center Logo / Play Icon with yellow neon glow */}
        <div className="relative w-14 h-14 rounded-full bg-[#16161a] border border-[#F5C400]/50 flex items-center justify-center shadow-[0_0_25px_rgba(245,196,0,0.3)]">
          <div className="w-10 h-10 rounded-full bg-[#F5C400]/15 flex items-center justify-center">
            <Play className="w-5 h-5 text-[#F5C400] fill-[#F5C400] translate-x-0.5" />
          </div>
        </div>
      </div>

      {/* Status Heading */}
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#F5C400] animate-pulse shadow-[0_0_8px_#F5C400]" />
          <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
            {title}
          </h3>
        </div>
      )}

      {/* Optional Server indicator */}
      {serverName && (
        <div className="mb-2">
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-[#F5C400]">
            {serverName}
          </span>
        </div>
      )}

      {/* Requested Subtitle */}
      <p className="text-xs text-[#A6A6AC] max-w-md leading-relaxed px-4 font-medium">
        {subtitle}
      </p>
    </div>
  );
};
