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
import { NewEpisodesPage } from './pages/NewEpisodesPage';
import { TagsPage } from './pages/TagsPage';
import { RandomPage } from './pages/RandomPage';
import { PeoplePage } from './pages/PeoplePage';
import { PersonPage } from './pages/PersonPage';
import { SettingsPage } from './pages/SettingsPage';
import { SurpriseModal } from './components/SurpriseModal';
import { LegalModal } from './components/LegalModal';
import { AuthModal } from './components/AuthModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AuthProvider } from './context/AuthContext';
import { MediaItem, MediaDetail } from './types/media';
import { createMediaSlug, parseMediaSlug } from './utils/slug';
import { updateSEO } from './utils/seo';
import { getPlatformById } from './services/platformData';
import { recordSiteVisit } from './services/analytics';
import { auth } from './services/firebase';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'movie' | 'tv'>('movie');
  const [watchSeason, setWatchSeason] = useState<number>(1);
  const [watchEpisode, setWatchEpisode] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<number | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | 'dmca' | 'contact' | null>(null);
  const [navKey, setNavKey] = useState(0);

  // Initialize view from URL if provided
  useEffect(() => {
    const handleLocation = () => {
      setNavKey(k => k + 1);
      const path = window.location.pathname.replace(/^\//, '');
      const params = new URLSearchParams(window.location.search);

      if (params.has('genreId')) {
        const gid = parseInt(params.get('genreId')!, 10);
        if (!isNaN(gid)) setSelectedGenreId(gid);
      } else {
        setSelectedGenreId(null);
      }

      if (path === '' || path === 'index.html') {
        setCurrentView('home');
      } else if (path === 'movies') {
        setCurrentView('movies');
      } else if (path === 'tv-shows') {
        setCurrentView('tv-shows');
      } else if (path === 'trending') {
        setCurrentView('trending');
      } else if (path === 'top-rated') {
        setCurrentView('top-rated');
      } else if (path === 'new-episodes') {
        setCurrentView('new-episodes');
      } else if (path === 'collections') {
        setCurrentView('collections');
      } else if (path.startsWith('platform/')) {
        const parts = path.split('/');
        const plat = parts.length === 2 ? getPlatformById(parts[1]) : undefined;
        if (plat) {
          setSelectedPlatform(parts[1].toLowerCase());
          setCurrentView('platform');
        } else {
          setCurrentView('notfound');
        }
      } else if (path === 'platform' || params.has('platform')) {
        const platParam = params.get('platform') || 'netflix';
        if (getPlatformById(platParam)) {
          setSelectedPlatform(platParam.toLowerCase());
          setCurrentView('platform');
        } else {
          setCurrentView('notfound');
        }
      } else if (path.startsWith('az/')) {
        const parts = path.split('/');
        const letter = parts[1]?.toUpperCase();
        if (parts.length === 2 && letter && (/^[A-Z]$/.test(letter) || letter === '0-9')) {
          setSelectedLetter(letter);
          setCurrentView('az');
        } else {
          setCurrentView('notfound');
        }
      } else if (path === 'az' || params.has('letter')) {
        const letter = (params.get('letter') || 'A').toUpperCase();
        if (/^[A-Z]$/.test(letter) || letter === '0-9') {
          setSelectedLetter(letter);
          setCurrentView('az');
        } else {
          setCurrentView('notfound');
        }
      } else if (path.startsWith('tags/')) {
        const parts = path.split('/');
        if (parts.length === 2 && parts[1]) {
          const clean = decodeURIComponent(parts[1]).replace(/^#/, '').toLowerCase();
          setSelectedTag(clean);
          setCurrentView('tags');
        } else {
          setCurrentView('notfound');
        }
      } else if (path.startsWith('tag/')) {
        const parts = path.split('/');
        if (parts.length === 2 && parts[1]) {
          const clean = decodeURIComponent(parts[1]).replace(/^#/, '').toLowerCase();
          setSelectedTag(clean);
          setCurrentView('tags');
          window.history.replaceState({}, '', `/tags/${clean}`);
        } else {
          setCurrentView('notfound');
        }
      } else if (path === 'tags') {
        setCurrentView('tags');
        if (params.get('tag')) {
          const clean = decodeURIComponent(params.get('tag')!).replace(/^#/, '').toLowerCase();
          setSelectedTag(clean);
          window.history.replaceState({}, '', `/tags/${clean}`);
        } else {
          setSelectedTag(null);
        }
      } else if (path === 'search' || params.has('q')) {
        setCurrentView('search');
        if (params.get('q')) setSearchQuery(params.get('q')!);
      } else if (path === 'library') {
        setCurrentView('library');
      } else if (path === 'random') {
        setCurrentView('random');
      } else if (path === 'people') {
        setCurrentView('people');
      } else if (path.startsWith('person/')) {
        const parts = path.split('/');
        if (parts.length === 2 && /^\d+$/.test(parts[1])) {
          const pid = parseInt(parts[1], 10);
          if (pid > 0) {
            setSelectedPersonId(pid);
            setCurrentView('person');
          } else {
            setCurrentView('notfound');
          }
        } else {
          setCurrentView('notfound');
        }
      } else if (path === 'admin') {
        setCurrentView('admin');
      } else if (path === 'settings' || path === 'player-settings') {
        setCurrentView('settings');
      } else if (path.startsWith('movie/') || path.startsWith('tv/')) {
        const parts = path.split('/');
        const type = (parts[0] === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
        const parsed = parts.length === 2 ? parseMediaSlug(parts[1]) : null;
        if (parsed && Number.isInteger(parsed.id) && parsed.id > 0) {
          setSelectedMediaType(type);
          setSelectedMediaId(parsed.id);
          setCurrentView('details');
        } else {
          setCurrentView('notfound');
        }
      } else if (path.startsWith('watch/')) {
        const parts = path.split('/');
        if ((parts[1] === 'movie' && parts.length === 3) || (parts[1] === 'tv' && (parts.length === 3 || parts.length === 5))) {
          const type = (parts[1] === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
          const parsed = parseMediaSlug(parts[2]);
          const validNums = parts.length !== 5 || (/^\d+$/.test(parts[3]) && /^\d+$/.test(parts[4]) && parseInt(parts[3], 10) >= 1 && parseInt(parts[4], 10) >= 1);
          if (parsed && Number.isInteger(parsed.id) && parsed.id > 0 && validNums) {
            setSelectedMediaType(type);
            setSelectedMediaId(parsed.id);
            setCurrentView('watch');
            setWatchSeason(parts[3] ? parseInt(parts[3], 10) : 1);
            setWatchEpisode(parts[4] ? parseInt(parts[4], 10) : 1);
          } else {
            setCurrentView('notfound');
          }
        } else {
          setCurrentView('notfound');
        }
      } else {
        setCurrentView('notfound');
      }
    };

    handleLocation();
    window.addEventListener('popstate', handleLocation);
    return () => window.removeEventListener('popstate', handleLocation);
  }, []);

  // Update SEO for main catalog pages with explicit canonical URLs and index directives
  useEffect(() => {
    const urlWithQuery = `${window.location.pathname}${window.location.search}`;
    if (currentView === 'home') {
      updateSEO({ url: '/' });
    } else if (currentView === 'movies') {
      updateSEO({
        title: 'Popular & Latest Movies Free HD',
        description: 'Browse and watch thousands of blockbuster movies online in HD 1080p and 4K on T Stream.',
        url: urlWithQuery.startsWith('/movies') ? urlWithQuery : '/movies'
      });
    } else if (currentView === 'tv-shows') {
      updateSEO({
        title: 'TV Shows & Full Episodes Free',
        description: 'Stream full seasons and episodes of your favorite TV series and dramas on T Stream.',
        url: urlWithQuery.startsWith('/tv-shows') ? urlWithQuery : '/tv-shows'
      });
    } else if (currentView === 'trending') {
      updateSEO({
        title: 'Trending Movies & TV Shows Today',
        description: 'Discover the hottest and most popular movies and series streaming right now on T Stream.',
        url: urlWithQuery.startsWith('/trending') ? urlWithQuery : '/trending'
      });
    } else if (currentView === 'top-rated') {
      updateSEO({
        title: 'Top Rated Movies & Shows of All Time',
        description: 'Explore the highest critically-acclaimed films and television series on T Stream.',
        url: urlWithQuery.startsWith('/top-rated') ? urlWithQuery : '/top-rated'
      });
    } else if (currentView === 'new-episodes') {
      updateSEO({
        title: 'New TV Episodes & Releases Today — Free HD Stream',
        description: 'Track the latest TV episodes airing today and this week. Follow your favorite TV series to get instant notifications when new episodes air on T Stream.',
        noindex: true,
        url: '/new-episodes'
      });
    } else if (currentView === 'collections') {
      updateSEO({
        title: 'Movie Franchises & Sagas',
        description: 'Explore complete cinematic universes and movie franchises on T Stream.',
        url: '/collections'
      });
    } else if (currentView === 'platform') {
      const name = (selectedPlatform || 'netflix').toUpperCase();
      updateSEO({
        title: `${name} Hub — Movies & TV Series`,
        description: `Stream movies and television series from ${name} on T Stream.`,
        url: urlWithQuery.startsWith('/platform/') ? urlWithQuery : `/platform/${selectedPlatform || 'netflix'}`
      });
    } else if (currentView === 'az') {
      updateSEO({
        title: `Titles Starting With ${selectedLetter} — A-Z Directory`,
        description: `Browse movies and TV shows alphabetically starting with letter ${selectedLetter} on T Stream.`,
        url: `/az/${selectedLetter || 'A'}`
      });
    } else if (currentView === 'tags') {
      if (selectedTag) {
        const cleanTag = selectedTag.replace(/^#/, '').toLowerCase();
        updateSEO({
          title: `Movies & TV Shows Tagged #${cleanTag} — Watch Online Free`,
          description: `Discover top rated and popular movies and TV series tagged with #${cleanTag}. Stream free in 4K and 1080p HD with subtitles on T Stream.`,
          url: `/tags/${encodeURIComponent(cleanTag)}`
        });
      } else {
        updateSEO({
          title: 'Explore Movies & TV Series by Tag & Theme',
          description: 'Browse movies and TV series by genre tropes, story moods, themes, and aesthetic tags on T Stream.',
          url: '/tags'
        });
      }
    } else if (currentView === 'people') {
      updateSEO({
        title: 'Actors & Film Directors Directory',
        description: 'Explore popular film and TV cast members, directors, and filmographies on T Stream.',
        noindex: true,
        url: '/people'
      });
    } else if (currentView === 'random') {
      updateSEO({
        title: 'Random Movie & TV Show Picker — Reshuffle 20 Titles',
        description: 'Spin the wheel and pick from 20 random movies and TV series to watch online in HD on T Stream.',
        noindex: true,
        url: '/random'
      });
    } else if (currentView === 'search') {
      updateSEO({
        title: searchQuery ? `Search: "${searchQuery}"` : 'Search Movies & TV Shows',
        description: 'Search across tens of thousands of movies, series, actors, and sagas on T Stream.',
        noindex: true,
        url: '/search'
      });
    } else if (currentView === 'library') {
      updateSEO({
        title: 'My Watchlist & Library',
        description: 'Access your saved bookmarks, watchlist, and watched history on T Stream.',
        noindex: true,
        url: '/library'
      });
    } else if (currentView === 'admin') {
      updateSEO({
        title: 'Server & Player Settings',
        description: 'Configure custom streaming server priorities and player preferences on T Stream.',
        noindex: true,
        url: '/admin'
      });
    } else if (currentView === 'settings') {
      updateSEO({
        title: 'Player & Server Settings — T Stream',
        description: 'Customize default streaming servers, subtitle languages, playback quality, and player appearance.',
        noindex: true,
        url: '/settings'
      });
    } else if (currentView === 'notfound') {
      updateSEO({
        title: '404 — Page Not Found',
        description: 'The movie, television series, tag, or page you were looking for could not be found on T Stream.',
        noindex: true,
        url: '/404'
      });
    }

    const currentPath = window.location.pathname || '/';
    recordSiteVisit(currentPath, auth.currentUser);
  }, [currentView, searchQuery, selectedLetter, selectedPlatform, selectedTag]);

  const navigateTo = (view: string, extra?: any) => {
    setNavKey(k => k + 1);
    setCurrentView(view);
    let newPath = '/';

    if (view === 'home') {
      newPath = '/';
      setSelectedMediaId(null);
      setSelectedGenreId(null);
    } else if (view === 'movies') {
      const qParams = new URLSearchParams();
      if (extra?.genreId != null) {
        setSelectedGenreId(extra.genreId);
        qParams.set('genreId', extra.genreId.toString());
      } else {
        setSelectedGenreId(null);
      }
      if (extra?.sortBy) qParams.set('sortBy', extra.sortBy);
      if (extra?.year) qParams.set('year', extra.year.toString());
      if (extra?.minRating) qParams.set('minRating', extra.minRating.toString());
      if (extra?.country) qParams.set('country', extra.country);
      const qs = qParams.toString();
      newPath = qs ? `/movies?${qs}` : '/movies';
    } else if (view === 'tv-shows') {
      const qParams = new URLSearchParams();
      if (extra?.genreId != null) {
        setSelectedGenreId(extra.genreId);
        qParams.set('genreId', extra.genreId.toString());
      } else {
        setSelectedGenreId(null);
      }
      if (extra?.sortBy) qParams.set('sortBy', extra.sortBy);
      if (extra?.year) qParams.set('year', extra.year.toString());
      if (extra?.minRating) qParams.set('minRating', extra.minRating.toString());
      if (extra?.country) qParams.set('country', extra.country);
      const qs = qParams.toString();
      newPath = qs ? `/tv-shows?${qs}` : '/tv-shows';
    } else if (view === 'trending') {
      newPath = '/trending';
      setSelectedGenreId(null);
    } else if (view === 'top-rated') {
      newPath = '/top-rated';
      setSelectedGenreId(null);
    } else if (view === 'new-episodes') {
      newPath = '/new-episodes';
      setSelectedGenreId(null);
    } else if (view === 'collections') {
      newPath = '/collections';
      setSelectedCollectionId(extra?.collectionId || null);
      setSelectedGenreId(null);
    } else if (view === 'platform') {
      const plat = extra?.platform || selectedPlatform || 'netflix';
      setSelectedPlatform(plat);
      newPath = `/platform/${plat}`;
      setSelectedGenreId(null);
    } else if (view === 'az') {
      const letter = (extra?.letter || selectedLetter || 'A').toUpperCase();
      setSelectedLetter(letter);
      newPath = letter === 'ALL' ? '/movies' : `/az/${letter}`;
      setSelectedGenreId(null);
    } else if (view === 'tags') {
      if (extra?.tag) {
        const clean = encodeURIComponent(extra.tag.replace(/^#/, '').toLowerCase());
        newPath = `/tags/${clean}`;
        setSelectedTag(extra.tag.replace(/^#/, '').toLowerCase());
      } else {
        newPath = '/tags';
        setSelectedTag(null);
      }
      setSelectedGenreId(null);
    } else if (view === 'search') {
      newPath = extra?.query ? `/search?q=${encodeURIComponent(extra.query)}` : '/search';
      if (extra?.query) setSearchQuery(extra.query);
      setSelectedGenreId(null);
    } else if (view === 'library') {
      newPath = '/library';
      setSelectedGenreId(null);
    } else if (view === 'random') {
      newPath = '/random';
      setSelectedGenreId(null);
    } else if (view === 'people') {
      newPath = '/people';
      setSelectedGenreId(null);
    } else if (view === 'admin') {
      newPath = '/admin';
      setSelectedGenreId(null);
    } else if (view === 'settings') {
      newPath = '/settings';
      setSelectedGenreId(null);
    }

    window.history.pushState({}, '', newPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPerson = (personId: number) => {
    setSelectedPersonId(personId);
    setCurrentView('person');
    window.history.pushState({}, '', `/person/${personId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectMedia = (item: MediaItem) => {
    const id = item.id || item.tmdbId;
    setSelectedMediaId(id);
    setSelectedMediaType(item.mediaType);
    setCurrentView('details');
    const slug = createMediaSlug(item.title || (item as any).name, id);
    window.history.pushState({}, '', `/${item.mediaType}/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWatchMedia = (item: MediaItem, season = 1, episode = 1) => {
    const id = item.id || item.tmdbId;
    setSelectedMediaId(id);
    setSelectedMediaType(item.mediaType);
    setWatchSeason(season);
    setWatchEpisode(episode);
    setCurrentView('watch');

    const slug = createMediaSlug(item.title || (item as any).name, id);
    const watchUrl = item.mediaType === 'movie'
      ? `/watch/movie/${slug}`
      : `/watch/tv/${slug}/${season}/${episode}`;

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
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-[#232326] text-[#F3F3F3] font-sans selection:bg-[#F5C400] selection:text-black">
      {/* Universal T Stream Header on all pages */}
      <HomeHeader
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        onNavigate={navigateTo}
        onSearch={handleSearch}
        onSelectMedia={handleSelectMedia}
        onSelectGenre={(genreId) => navigateTo('movies', { genreId })}
        onSurpriseMe={() => navigateTo('random')}
        onOpenFilter={() => navigateTo('movies')}
        onWatchEpisode={(showId, showTitle, season, episode, posterPath) => {
          const media: MediaItem = {
            id: showId,
            tmdbId: showId,
            title: showTitle,
            overview: '',
            posterPath: posterPath || '',
            backdropPath: posterPath || '',
            releaseDate: '',
            voteAverage: 8.0,
            voteCount: 100,
            popularity: 50,
            mediaType: 'tv',
            genres: []
          };
          handleWatchMedia(media, season, episode);
        }}
        currentView={currentView}
      />

      {/* Universal Slide-out Left Sidebar Drawer */}
      <HomeSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={navigateTo}
        onSelectGenre={(genreId) => navigateTo('movies', { genreId })}
        selectedGenreId={selectedGenreId}
        onSelectPlatform={(platId) => navigateTo('platform', { platform: platId })}
        selectedPlatform={selectedPlatform || undefined}
        currentView={currentView}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-16 md:pb-0">
        {currentView === 'home' && (
          <HomePage
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
            onNavigate={navigateTo}
            onSurpriseMe={() => navigateTo('random')}
            onSearch={handleSearch}
            onOpenLegal={(page) => {
              if (['movies', 'tv-shows', 'trending', 'collections', 'tags', 'random'].includes(page)) {
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
            onSelectPerson={handleSelectPerson}
            onSelectTag={(tag) => navigateTo('tags', { tag })}
            onSelectGenre={(genreId) => navigateTo('movies', { genreId })}
            onNavigateCollections={() => navigateTo('collections')}
            onSelectPlatform={(platId) => navigateTo('platform', { platform: platId })}
          />
        )}

        {currentView === 'collections' && (
          <CollectionsPage
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
            initialCollectionId={selectedCollectionId}
          />
        )}

        {currentView === 'new-episodes' && (
          <NewEpisodesPage
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
            onBackToDetails={(media) => {
              if (media) {
                handleSelectMedia(media);
              } else {
                navigateTo(selectedMediaType === 'tv' ? 'tv-shows' : 'movies');
              }
            }}
            onSelectMedia={handleSelectMedia}
          />
        )}

        {currentView === 'movies' && (
          <CatalogPage
            key={`movies-${navKey}-${selectedGenreId || ''}`}
            category="movies"
            initialGenreId={selectedGenreId || undefined}
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'tv-shows' && (
          <CatalogPage
            key={`tv-shows-${navKey}-${selectedGenreId || ''}`}
            category="tv-shows"
            initialGenreId={selectedGenreId || undefined}
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'trending' && (
          <CatalogPage
            key={`trending-${navKey}`}
            category="trending"
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'top-rated' && (
          <CatalogPage
            key={`top-rated-${navKey}`}
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

        {currentView === 'random' && (
          <RandomPage
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'people' && (
          <PeoplePage
            onSelectPerson={handleSelectPerson}
          />
        )}

        {currentView === 'person' && (
          <PersonPage
            personId={selectedPersonId || 1083010}
            onBack={() => {
              setCurrentView('people');
              window.history.pushState({}, '', '/people');
            }}
            onSelectMedia={handleSelectMedia}
            onWatchMedia={handleWatchMedia}
          />
        )}

        {currentView === 'admin' && (
          <AdminPage />
        )}

        {currentView === 'settings' && (
          <SettingsPage onNavigate={navigateTo} />
        )}

        {currentView === 'notfound' && (
          <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
            <div className="text-center max-w-lg mx-auto">
              <div className="text-7xl font-black text-[#F5C400] mb-3">404</div>
              <h1 className="text-3xl font-extrabold text-white mb-3">Page Not Found</h1>
              <p className="text-sm text-[#A6A6AC] mb-8 leading-relaxed">
                The movie, television series, episode, tag, or page you were looking for could not be found or may have been removed.
              </p>
              <div className="flex flex-wrap justify-center gap-3 text-xs sm:text-sm font-bold">
                <button
                  onClick={() => navigateTo('home')}
                  className="px-5 py-2.5 bg-[#F5C400] hover:bg-[#e0b400] text-black rounded-xl transition-colors cursor-pointer"
                >
                  T Stream Home
                </button>
                <button
                  onClick={() => navigateTo('movies')}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors cursor-pointer"
                >
                  Browse Movies
                </button>
                <button
                  onClick={() => navigateTo('tv-shows')}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-colors cursor-pointer"
                >
                  Browse TV Shows
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer for non-home pages */}
      {currentView !== 'home' && (
        <Footer onNavigateLegal={(page) => {
          if (['movies', 'tv-shows', 'trending', 'top-rated', 'platform', 'az', 'collections', 'tags', 'random', 'people'].includes(page)) {
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

      {/* Cloud Authentication, Profile & Watchlist Modal */}
      <AuthModal onSelectMedia={handleSelectMedia} />

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Modern Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={navigateTo}
      />
    </div>
  </AuthProvider>
  );
}
