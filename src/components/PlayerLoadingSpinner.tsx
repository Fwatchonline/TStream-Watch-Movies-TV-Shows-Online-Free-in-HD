import React from 'react';
import { Play } from 'lucide-react';

interface PlayerLoadingSpinnerProps {
  title?: string;
  subtitle?: string;
  className?: string;
  serverName?: string;
}

export const PlayerLoadingSpinner: React.FC<PlayerLoadingSpinnerProps> = ({
  title,
  subtitle = 'Fast multi-server HLS playback, multilingual subtitles, and zero ads.',
  className = '',
  serverName
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-[#0a0a0d] w-full h-full select-none ${className}`}
    >
      {/* Harmonious, mathematically proportioned cinema spinner */}
      <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center mb-6">
        {/* Ambient radial golden halo glow */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(245,196,0,0.22)_0%,rgba(245,196,0,0.06)_45%,transparent_72%)] pointer-events-none animate-pulse-glow" />

        {/* Outer subtle ripple ring */}
        <div className="absolute inset-2 rounded-full border border-[#F5C400]/15 animate-ping [animation-duration:3.2s] pointer-events-none" />

        {/* SVG Concentric Rings and Rotating Text */}
        <svg
          viewBox="0 0 200 200"
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        >
          <defs>
            {/* Luminous energy arc gradient */}
            <linearGradient id="tstreamEnergyArc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5C400" stopOpacity="1" />
              <stop offset="60%" stopColor="#F5C400" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#F5C400" stopOpacity="0" />
            </linearGradient>

            {/* Inner secondary gradient */}
            <linearGradient id="tstreamInnerGrad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F5C400" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#F5C400" stopOpacity="0.05" />
            </linearGradient>

            {/* Golden glow filter */}
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Perfect circular path for the orbiting text (Radius = 70, Circumference = 2 * PI * 70 = 439.82) */}
            <path
              id="tstreamCirclePath"
              d="M 100, 100 m -70, 0 a 70,70 0 1,1 140,0 a 70,70 0 1,1 -140,0"
            />
          </defs>

          {/* 1. Outermost subtle cinema lens tick ring */}
          <circle
            cx="100"
            cy="100"
            r="94"
            fill="none"
            stroke="#F5C400"
            strokeOpacity="0.12"
            strokeWidth="1"
            strokeDasharray="2 6"
          />

          {/* 2. Precision corner/aperture accent dashes */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="#F5C400"
            strokeOpacity="0.25"
            strokeWidth="1.5"
            strokeDasharray="12 78"
            className="origin-center animate-spin [animation-duration:18s]"
          />

          {/* 3. Sleek, high-speed golden energy arc */}
          <g className="origin-center animate-spin [animation-duration:2.0s]">
            <circle
              cx="100"
              cy="100"
              r="84"
              fill="none"
              stroke="url(#tstreamEnergyArc)"
              strokeWidth="3"
              strokeDasharray="90 200"
              strokeLinecap="round"
            />
            {/* Glowing comet head dot */}
            <circle
              cx="184"
              cy="100"
              r="3"
              fill="#F5C400"
              filter="url(#goldGlow)"
            />
          </g>

          {/* 4. Fine concentric spacer ring */}
          <circle
            cx="100"
            cy="100"
            r="79"
            fill="none"
            stroke="#F5C400"
            strokeOpacity="0.18"
            strokeWidth="0.75"
          />

          {/* 5. Orbiting Brand Text: TSTREAM.ONLINE (Distributed with exact spacing across 360°) */}
          <g className="origin-center animate-spin [animation-duration:15s]">
            <text
              fill="#F5C400"
              fontSize="9"
              fontWeight="800"
              letterSpacing="2.2"
              className="uppercase font-sans select-none"
              filter="url(#goldGlow)"
            >
              <textPath
                href="#tstreamCirclePath"
                startOffset="0%"
                textLength="439.8"
                lengthAdjust="spacing"
              >
                ✦ TSTREAM.ONLINE ✦ TSTREAM.ONLINE 
              </textPath>
            </text>
          </g>

          {/* 6. Concentric inner ring divider */}
          <circle
            cx="100"
            cy="100"
            r="60"
            fill="none"
            stroke="#F5C400"
            strokeOpacity="0.2"
            strokeWidth="0.75"
          />

          {/* 7. Inner counter-rotating micro-segment ring for dynamic visual depth */}
          <g className="origin-center animate-spin-reverse-fast">
            <circle
              cx="100"
              cy="100"
              r="54"
              fill="none"
              stroke="url(#tstreamInnerGrad)"
              strokeWidth="1.5"
              strokeDasharray="25 60"
              strokeLinecap="round"
            />
          </g>
        </svg>

        {/* Center Floating Glassmorphic Cinema Disc with Play Badge */}
        <div className="relative w-22 h-22 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#24242d] via-[#15151a] to-[#0a0a0d] border border-[#F5C400]/45 flex flex-col items-center justify-center shadow-[0_0_32px_rgba(245,196,0,0.32)] transition-transform duration-300">
          {/* Subtle breathing golden aura */}
          <div className="absolute inset-1 rounded-full bg-[#F5C400]/10 animate-pulse pointer-events-none" />

          {/* Golden Play Icon with specular reflection */}
          <div className="relative z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-[#F5C400]/25 to-black/60 border border-[#F5C400]/30 flex items-center justify-center shadow-inner">
            <Play className="w-5 h-5 sm:w-6 sm:h-6 text-[#F5C400] fill-[#F5C400] translate-x-0.5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </div>

          {/* Mini dynamic audio/decoding equalizer bars */}
          <div className="relative z-10 flex items-end gap-1 mt-1.5 h-2.5">
            <span className="w-0.5 bg-[#F5C400] rounded-full animate-[soundWave_0.8s_ease-in-out_infinite]" />
            <span className="w-0.5 bg-[#F5C400] rounded-full animate-[soundWave_0.8s_ease-in-out_0.2s_infinite]" />
            <span className="w-0.5 bg-[#F5C400] rounded-full animate-[soundWave_0.8s_ease-in-out_0.4s_infinite]" />
            <span className="w-0.5 bg-[#F5C400] rounded-full animate-[soundWave_0.8s_ease-in-out_0.15s_infinite]" />
          </div>
        </div>
      </div>

      {/* Optional Status Heading (Only rendered if explicitly provided) */}
      {title && (
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-2 h-2 rounded-full bg-[#F5C400] animate-pulse shadow-[0_0_8px_#F5C400]" />
          <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
            {title}
          </h3>
        </div>
      )}

      {/* Optional Server indicator (Only rendered if explicitly provided) */}
      {serverName && (
        <div className="mb-2.5">
          <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-[#F5C400]">
            {serverName}
          </span>
        </div>
      )}

      {/* Subtitle / Streaming Features Bar */}
      {subtitle && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-[13px] text-[#A6A6AC] font-medium max-w-lg leading-relaxed px-4">
          <span className="inline-flex items-center gap-1.5 text-[#F3F3F3]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5C400]" />
            Fast multi-server HLS playback
          </span>
          <span className="text-[#555560]">·</span>
          <span className="inline-flex items-center gap-1.5 text-[#F3F3F3]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5C400]" />
            Multilingual subtitles
          </span>
          <span className="text-[#555560]">·</span>
          <span className="inline-flex items-center gap-1.5 text-[#F5C400] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5C400]" />
            Zero ads
          </span>
        </div>
      )}
    </div>
  );
};
