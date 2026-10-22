import React from 'react';
import { X, ShieldAlert, FileText, Mail, Info } from 'lucide-react';

interface LegalModalProps {
  page: 'terms' | 'privacy' | 'dmca' | 'contact' | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ page, onClose }) => {
  if (!page) return null;

  const getContent = () => {
    switch (page) {
      case 'terms':
        return {
          title: 'Terms of Service',
          icon: FileText,
          content: (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>Welcome to T Stream. By accessing or using this web application, you agree to comply with and be bound by these Terms of Service.</p>
              <h4 className="text-sm font-bold text-white">1. Use of Service</h4>
              <p>T Stream provides a metadata aggregator and web media indexer interface. We do not host or store any media files on our own servers. All media streams are embedded from third-party media nodes.</p>
              <h4 className="text-sm font-bold text-white">2. Disclaimer of Warranties</h4>
              <p>The materials and stream proxies are provided &quot;as is&quot; without warranties of any kind. T Stream does not warrant uninterrupted or error-free playback.</p>
            </div>
          )
        };
      case 'privacy':
        return {
          title: 'Privacy Policy',
          icon: Info,
          content: (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>Your privacy is important to us. T Stream does not sell personal information or require sensitive credentials for guest discovery.</p>
              <h4 className="text-sm font-bold text-white">1. Local Storage</h4>
              <p>We store your Watchlist, viewing progress, and playback preferences locally in your browser&apos;s LocalStorage. This data never leaves your device unless you explicitly sign in.</p>
              <h4 className="text-sm font-bold text-white">2. Analytics</h4>
              <p>We use Google Analytics 4 (Measurement ID: G-BHPTSX1FXP) to collect anonymous operational diagnostics, such as page visits and provider error frequencies, to maintain uptime.</p>
            </div>
          )
        };
      case 'dmca':
        return {
          title: 'DMCA Disclaimer',
          icon: ShieldAlert,
          content: (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>T Stream acts as a search index and client-side media player. None of the video media or copyrighted files are hosted on or transmitted through our servers.</p>
              <p>All videos are embedded from independent external services (such as api.fmov.my and third-party web content delivery networks). If you are a copyright owner and wish to remove content, please submit takedown notices directly to the hosting provider hosting the source media.</p>
            </div>
          )
        };
      case 'contact':
        return {
          title: 'Contact & Support',
          icon: Mail,
          content: (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>Have questions, provider reports, or subtitle requests? Get in touch with our team.</p>
              <div className="p-4 rounded-xl bg-[#1c1c24] border border-white/5 space-y-2">
                <div className="text-slate-400">General Inquiries: <span className="text-white font-mono">support@tstream.online</span></div>
                <div className="text-slate-400">Infrastructure Ops: <span className="text-white font-mono">admin@tstream.online</span></div>
                <div className="text-slate-400">Production Node: <span className="text-white font-mono">VPS port 3010 / Nginx</span></div>
              </div>
            </div>
          )
        };
    }
  };

  const data = getContent();
  const Icon = data.icon;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-[#29292D] border border-[#3A3A40] rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3A3A40] bg-[#232326]">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-[#F5C400]" />
            <h3 className="text-base font-bold text-white">{data.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A6AC] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {data.content}
        </div>
      </div>
    </div>
  );
};
