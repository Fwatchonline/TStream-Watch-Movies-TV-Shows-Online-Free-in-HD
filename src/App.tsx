import React, { useState, useEffect } from 'react';
import { HomeHeader } from './components/HomeHeader';
import { HomeSidebar } from './components/HomeSidebar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { DetailsPage } from './pages/DetailsPage';
import { WatchPage } from './pages/WatchPage';
import { CatalogPage } from './pages/CatalogPage';
import { LibraryPage } from './pages/LibraryPage';
import { AdminPage } from './pages/AdminPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { TagsPage } from './pages/TagsPage';
import { SurpriseModal } from './components/SurpriseModal';
import { LegalModal } from './components/LegalModal';
import { MediaItem, MediaDetail } from './types/media';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'movie' | 'tv'>('movie');
  const [watchSeason, setWatchSeason] = useState<number>(1);
  const [watchEpisode, setWatchEpisode] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'dmca' | 'contact' | null>(null);

  // Initialize view from URL if provided
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname.replace(/^\//, '');
      const params = new URLSearchParams(window.location.search);

      if (path === 'movies') {
        setCurrentView('movies');
      } else if (path === 'tv-shows') {
        setCurrentView('tv-shows');
      } else if (path === 'trending') {
        setCurrentView('trending');
      } else if (path === 'top-rated') {
        setCurrentView('top-rated');
      } else if (path === 'collections') {
        setCurrentView('collections');
      } else if (path.startsWith('platform/')) {
        const parts = path.split('/');
        if (parts[1]) {
          setSelectedPlatform(parts[1]);
          setCurrentView('platform');
        }
      } else if (path === 'platform' || params.has('platform')) {
        setSelectedPlatform(params.get('platform') || 'netflix');
        setCurrentView('platform');
      } else if (path.startsWith('az/')) {
        const parts = path.split('/');
        if (parts[1]) {
          setSelectedLetter(parts[1].toUpperCase());
          setCurrentView('az');
        }
      } else if (path === 'az' || params.has('letter')) {
        setSelectedLetter((params.get('letter') || 'A').toUpperCase());
        setCurrentView('az');
      } else if (path === 'tags') {
        setCurrentView('tags');
        if (params.get('tag')) setSelectedTag(params.get('tag')!);
      } else if (path === 'search' || params.has('q')) {
        setCurrentView('search');
        if (params.get('q')) setSearchQuery(params.get('q')!);
      } else if (path === 'library') {
        setCurrentView('library');
      } else if (path === 'admin') {
        setCurrentView('admin');
      } else if (path.startsWith('movie/') || path.startsWith('tv/')) {
        const parts = path.split('/');
        const type = parts[0] as 'movie' | 'tv';
        const id = parseInt(parts[1], 10);
        if (!isNaN(id)) {
          setSelectedMediaType(type);
          setSelectedMediaId(id);
          setCurrentView('details');
        }
      } else if (path.startsWith('watch/')) {
        const parts = path.split('/');
        const type = parts[1] as 'movie' | 'tv';
        const id = parseInt(parts[2], 10);
        if (!isNaN(id)) {
          setSelectedMediaType(type);
          setSelectedMediaId(id);
          setCurrentView('watch');
          if (parts[3]) setWatchSeason(parseInt(parts[3], 10) || 1);
          if (parts[4]) setWatchEpisode(parseInt(parts[4], 10) || 1);
        }
      } else {
        setCurrentView('home');
      }
    };

    handleLocation();
    window.addEventListener('popstate', handleLocation);
    return () => window.removeEventListener('popstate', handleLocation);
  }, []);

  const navigateTo = (view: string, extra?: any) => {
    setCurrentView(view);
    let newPath = '/';

    if (view === 'home') {
      newPath = '/';
      setSelectedMediaId(null);
    } else if (view === 'movies') {
      newPath = '/movies';
    } else if (view === 'tv-shows') {
      newPath = '/tv-shows';
    } else if (view === 'trending') {
      newPath = '/trending';
    } else if (view === 'top-rated') {
      newPath = '/top-rated';
    } else if (view === 'collections') {
      newPath = '/collections';
    } else if (view === 'platform') {
      const plat = extra?.platform || selectedPlatform || 'netflix';
      setSelectedPlatform(plat);
      newPath = `/platform/${plat}`;
    } else if (view === 'az') {
      const letter = (extra?.letter || selectedLetter || 'A').toUpperCase();
      setSelectedLetter(letter);
      newPath = letter === 'ALL' ? '/movies' : `/az/${letter}`;
    } else if (view === 'tags') {
      newPath = extra?.tag ? `/tags?tag=${encodeURIComponent(extra.tag)}` : '/tags';
      setSelectedTag(extra?.tag || null);
    } else if (view === 'search') {
      newPath = extra?.query ? `/search?q=${encodeURIComponent(extra.query)}` : '/search';
      if (extra?.query) setSearchQuery(extra.query);
    } else if (view === 'library') {
      newPath = '/library';
    } else if (view === 'admin') {
      newPath = '/admin';
    }

    window.history.pushState({}, '', newPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectMedia = (item: MediaItem) => {
    setSelectedMediaId(item.id || item.tmdbId);
    setSelectedMediaType(item.mediaType);
    setCurrentView('details');
    window.history.pushState({}, '', `/${item.mediaType}/${item.id || item.tmdbId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWatchMedia = (item: MediaItem, season = 1, episode = 1) => {
    setSelectedMediaId(item.id || item.tmdbId);
    setSelectedMediaType(item.mediaType);
    setWatchSeason(season);
    setWatchEpisode(episode);
    setCurrentView('watch');

    const watchUrl = item.mediaType === 'movie'
      ? `/watch/movie/${item.id || item.tmdbId}`
      : `/watch/tv/${item.id || item.tmdbId}/${season}/${episode}`;

    window.history.pushState({}, '', watchUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentView('search');
    window.history.pushState({}, '', `/search?q=${encodeURIComponent(query)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#232326] text-[#F3F3F3] font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Universal T Stream Header on all pages */}
      <HomeHeader
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onNavigate={navigateTo}
        onSearch={handleSearch}
        onSurpriseMe={() => setSurpriseOpen(true)}
        onOpenFilter={() => navigateTo('movies')}
        currentView={currentView}
      />

      {/* Universal Slide-out Left Sidebar Drawer */}
      <HomeSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={navigateTo}
        onSelectPlatform={(platId) => navigateTo('platform', { platform: platId })}
        selectedPlatform={selectedPlatform || undefined}
        currentView={currentView}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomePage
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
            onNavigate={navigateTo}
            onSurpriseMe={() => setSurpriseOpen(true)}
            onSearch={handleSearch}
            onOpenLegal={(page) => {
              if (['movies', 'tv-shows', 'trending', 'collections', 'tags'].includes(page)) {
                navigateTo(page);
              } else {
                setLegalPage(page as any);
              }
            }}
          />
        )}

        {currentView === 'details' && selectedMediaId && (
          <DetailsPage
            mediaId={selectedMediaId}
            mediaType={selectedMediaType}
            onBack={() => navigateTo('home')}
            onWatchNow={(detail, season, ep) => handleWatchMedia(detail, season || 1, ep || 1)}
            onSelectMedia={handleSelectMedia}
            onSelectTag={(tag) => navigateTo('tags', { tag })}
            onNavigateCollections={() => navigateTo('collections')}
            onSelectPlatform={(platId) => navigateTo('platform', { platform: platId })}
          />
        )}

        {currentView === 'collections' && (
          <CollectionsPage
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'tags' && (
          <TagsPage
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
            initialTag={selectedTag || undefined}
          />
        )}

        {currentView === 'watch' && selectedMediaId && (
          <WatchPage
            mediaId={selectedMediaId}
            mediaType={selectedMediaType}
            season={watchSeason}
            episode={watchEpisode}
            onBackToDetails={() => {
              setCurrentView('details');
              window.history.pushState({}, '', `/${selectedMediaType}/${selectedMediaId}`);
            }}
            onSelectMedia={handleSelectMedia}
          />
        )}

        {currentView === 'movies' && (
          <CatalogPage
            category="movies"
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'tv-shows' && (
          <CatalogPage
            category="tv-shows"
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'trending' && (
          <CatalogPage
            category="trending"
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'top-rated' && (
          <CatalogPage
            category="top-rated"
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'az' && (
          <CatalogPage
            category="az"
            initialLetter={selectedLetter}
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'platform' && (
          <CatalogPage
            category="platform"
            initialPlatform={selectedPlatform || 'netflix'}
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
            onSelectPlatform={(platId) => setSelectedPlatform(platId)}
          />
        )}

        {currentView === 'search' && (
          <CatalogPage
            category="search"
            initialQuery={searchQuery}
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'library' && (
          <LibraryPage
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
            onExplore={() => navigateTo('movies')}
          />
        )}

        {currentView === 'admin' && (
          <AdminPage />
        )}
      </main>

      {/* Footer for non-home pages */}
      {currentView !== 'home' && (
        <Footer onNavigateLegal={(page) => {
          if (['movies', 'tv-shows', 'trending', 'top-rated', 'platform', 'az', 'collections', 'tags'].includes(page)) {
            navigateTo(page);
          } else {
            setLegalPage(page as any);
          }
        }} />
      )}

      {/* Surprise Me Randomizer Modal */}
      <SurpriseModal
        isOpen={surpriseOpen}
        onClose={() => setSurpriseOpen(false)}
        onSelectMedia={handleSelectMedia}
        onWatchMedia={handleWatchMedia}
      />

      {/* Legal & Terms Modal */}
      <LegalModal
        page={legalPage}
        onClose={() => setLegalPage(null)}
      />
    </div>
  );
}
