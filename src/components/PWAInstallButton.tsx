import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          onClick={install}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F5C400] text-black font-extrabold text-xs hover:bg-[#e0b400] transition-all cursor-pointer shadow-md shadow-amber-500/20 ${className}`}
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-black" />
            <span>Install T Stream App</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-black/20 text-black text-[10px] font-black uppercase">
            PWA
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5C400] text-black font-extrabold text-xs hover:bg-[#e0b400] transition-all cursor-pointer shadow-md shadow-amber-500/15 ${className}`}
        title="Install T Stream on your device"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[#F5C400] font-bold text-xs border border-[#F5C400]/30 transition-all cursor-pointer ${className}`}
          title="Install on iPhone / iPad"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Install App</span>
        </button>

        {showIOSGuide && (
          <div
            onClick={() => setShowIOSGuide(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-[#1c1c20] border border-[#3A3A40] p-6 shadow-2xl text-white relative animate-in zoom-in-95 duration-150"
            >
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-[#F5C400] text-black flex items-center justify-center font-black mb-4 shadow-lg shadow-amber-500/20">
                <Download className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-white mb-2">
                Install T Stream on iPhone & iPad
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Install directly onto your home screen for full-screen playback with zero browser bars:
              </p>

              <ol className="space-y-3 text-xs text-slate-300 bg-white/5 p-3.5 rounded-xl border border-white/10 mb-4">
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F5C400] text-black font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Tap the <strong className="text-white">Share</strong> button <Share2 className="w-3.5 h-3.5 inline text-[#F5C400]" /> in Safari toolbar.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#F5C400] text-black font-extrabold text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Scroll down and tap <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-[#F5C400]" />.</span>
                </li>
              </ol>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#F5C400] text-black font-extrabold text-xs hover:bg-[#e0b400] transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback desktop / browser install button
  return (
    <button
      onClick={() => {
        alert('To install T Stream: Click the install icon in your browser address bar or use Chrome / Edge / Safari menu > Install.');
      }}
      className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer ${className}`}
      title="Install as App"
    >
      <Download className="w-3.5 h-3.5 text-[#F5C400]" />
      <span>Install App</span>
    </button>
  );
};
