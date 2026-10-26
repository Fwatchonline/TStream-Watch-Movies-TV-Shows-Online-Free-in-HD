import React from 'react';
import { Film } from 'lucide-react';
import { TStreamLogo } from './TStreamLogo';

interface FooterProps {
  onNavigateLegal: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateLegal }) => {
  return (
    <footer className="w-full bg-[#232326] border-t border-[#3A3A40] py-12 text-[#A6A6AC] text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#3A3A40]">
          {/* Brand Info */}
          <div className="md:col-span-1">
            <div className="mb-3">
              <TStreamLogo size="md" />
            </div>
            <p className="text-[#A6A6AC] text-xs leading-relaxed max-w-sm">
              Free streaming service providing real-time metadata, trailers, subtitle search, and multi-server video playback for films and television series.
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Navigation
            </h4>
            <ul className="space-y-2">
              <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-white transition-colors">Back to Top</button></li>
              <li><button onClick={() => onNavigateLegal('movies')} className="hover:text-white transition-colors">Popular Movies</button></li>
              <li><button onClick={() => onNavigateLegal('tv-shows')} className="hover:text-white transition-colors">TV Series</button></li>
              <li><button onClick={() => onNavigateLegal('trending')} className="hover:text-white transition-colors">Trending Now</button></li>
              <li><button onClick={() => onNavigateLegal('collections')} className="hover:text-white transition-colors">Movie Collections</button></li>
              <li><button onClick={() => onNavigateLegal('tags')} className="hover:text-white transition-colors">Explore Tags</button></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Legal & Support
            </h4>
            <ul className="space-y-2">
              <li><button onClick={() => onNavigateLegal('terms')} className="hover:text-white transition-colors">Terms of Service</button></li>
              <li><button onClick={() => onNavigateLegal('privacy')} className="hover:text-white transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => onNavigateLegal('dmca')} className="hover:text-white transition-colors">DMCA Disclaimer</button></li>
              <li><button onClick={() => onNavigateLegal('contact')} className="hover:text-white transition-colors">Contact Support</button></li>
            </ul>
          </div>

          {/* Attribution */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Metadata Source
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              This product uses the TMDB API but is not endorsed or certified by TMDB. IMDb ratings and external links provided for informational reference.
            </p>
            <div className="mt-3 text-[11px] text-slate-500">
              Deployment Target: VPS port 3010 / 3011 · Nginx SSL
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-[11px]">
          <div>
            © {new Date().getFullYear()} T Stream. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span>Server: api.fmov.my</span>
            <span aria-hidden="true">·</span>
            <span>GA4: G-BHPTSX1FXP</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
