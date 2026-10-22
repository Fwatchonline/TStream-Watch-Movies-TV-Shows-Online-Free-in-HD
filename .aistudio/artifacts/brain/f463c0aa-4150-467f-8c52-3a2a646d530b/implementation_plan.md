# TStream.online — Production Implementation Plan & Audit Roadmap

A complete engineering blueprint for TStream.online to resolve pagination bugs, achieve pixel-accurate parity with the cinema Details Page reference, integrate hybrid TMDB metadata and resilient streaming playback, normalize multi-source subtitles, and deliver a responsive dark-charcoal streaming experience.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been confirmed via Phase 1 clarification:
>
> - **Details Page Layout**: Full-bleed cinematic backdrop hero with quick actions (Watch Now, Trailer, Watchlist, Watched, Share), metadata pills replaced with clean unboxed typographic separators (`·`), real cast carousels, TMDB franchise collections, and contextual recommendations.
> - **Metadata & Streaming Pipeline**: Hybrid engine pairing real TMDB REST queries with an instant, structured fallback catalogue covering trending movies, TV shows, and top franchises (Spider-Man, Harry Potter, Avengers, Pirates of the Caribbean). Streaming embeds connect to `https://api.fmov.my` with multiple server options, loading skeletons, and failure recovery.
> - **Library & State Persistence**: Browser LocalStorage guest-first repository with instant zero-friction Watchlist, Watch History, Continue Watching, and profile preference storage, structured for seamless Supabase synchronization.

---

## 1. Overview & Core Concept

- **What It Does**: TStream.online is a full-featured streaming web application allowing users to discover, search, track, and watch movies and TV shows across devices. It features deep media metadata, trailer playback, season/episode navigation, multi-server streaming with subtitle tracks (SRT/VTT), and personalized watchlists.
- **Target Audience / Persona**: Film and television enthusiasts seeking a fast, Netflix/TMDB-grade dark-mode streaming hub on desktop, tablet, smartphone, and Smart TV browsers.
- **Key Value**: Instant catalog discovery with verified pagination, zero dead buttons, real TMDB collection links, IMDb external links, and resilient multi-source video playback with subtitle selection.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Discovery & Exploration**:
   - The user lands on the Home page featuring a high-impact Hero banner with "Watch Now" and "More Info" CTAs.
   - Horizontal carousels highlight Trending Now, Popular Movies, Top Rated TV Shows, and New Episodes.
   - Dedicated catalogue pages (`/movies`, `/tv-shows`, `/trending`) offer real pagination (`?page=2`) with preserved genre, year, rating, and sorting filters.
2. **Global & Advanced Search**:
   - Live search overlay provides instant typeahead results with posters, release years, and media badges.
   - Advanced search page supports multi-filter combinations: genre selection, date range, rating sliders, and TMDB keyword IDs.
3. **Cinematic Details Page**:
   - Full-bleed backdrop with dark gradient scrim (`from-[#0d0d0f] via-[#0d0d0f]/80 to-transparent`).
   - Clean typographic header: Title, Release Year, Age Rating, Duration/Seasons, TMDB Score (`★ 8.4/10 (12,450 votes)`), and IMDb badge (with direct IMDb external link).
   - Primary action strip: High-contrast crimson `#E50914` "Watch Now" button, Trailer modal launcher, Watchlist toggle (`+ Watchlist` / `✓ Added`), Watched check, and Share dialog.
   - Media synopsis, clickable genre links, and production company credits.
   - Franchise Collection showcase (e.g. Spider-Man or Avengers collection cards with release dates).
   - Top Cast slider with actor portraits, character names, and actor filmography links.
   - TV Show season & episode selector with episode stills, air dates, and overviews.
   - "More Like This" & "Recommended" content grids.
4. **Player & Subtitle Experience**:
   - Embedded streaming viewport with server switching tabs (`Server 1 (Primary)`, `Server 2 (Backup)`, `Server 3 (Fast)`).
   - Next/Previous episode controls for TV series.
   - Subtitle selector modal querying VDRK v1/v2 and Stremio OpenSubtitles v3 with normalized language codes (`sr`, `hr`, `bs`, `en`).
   - Continue Watching progress auto-saved every 5 seconds.
5. **Personal Library & Admin Panel**:
   - Continue Watching carousel on the homepage with percentage progress bar and quick resume.
   - Watchlist and Watch History management with quick removal and search.
   - Protected Admin Panel simulating operational dashboards: provider status, cache clearing, and site configuration.

### Visual Identity & Theme

- **Aesthetic Direction**: Cinematic dark charcoal streaming theater. Clean, restrained, and anti-slop, avoiding neon glows, generic pill capsules, or distracting decorative badges.
- **Color Palette**:
  - Dominant Neutral Field (60%): Deep Obsidian `#0d0d0f` and Charcoal `#141418`.
  - Structural Surfaces (30%): Elevated card panels `#1c1c22`, hairline borders `rgba(255,255,255,0.08)`, muted secondary text `#94a3b8`.
  - Accent Color (10%): Streaming Crimson `#E50914` for primary interactive CTAs, active tab indicators, and progress bars.
- **Typography & Hierarchy**:
  - Display / Headings: `Plus Jakarta Sans` or `Outfit` (Bold, tight tracking, `text-wrap: balance`).
  - Body & UI Controls: Clean sans-serif with 15–16px baseline for legibility on Smart TV and mobile.
  - Metadata & Tabular Figures: `tabular-nums` for durations, vote counts, ratings, and timestamps.
- **Zero-Pill Discipline**: Metadata displayed with typographic dot separators (`2024 · 2h 15m · PG-13 · Action, Sci-Fi`) rather than clunky pill borders.

---

## 3. Key Product Decisions & Trade-Offs

- **Pagination Bug Fix**:
  - *Problem*: Upstream routing previously dropped `?page=X` or returned page 1 repeatedly, failing search filter preservation.
  - *Solution*: Centralized URL search parameter hook `useCatalogPagination` coordinating URL query state, TMDB `page` parameter propagation, total page boundary limits (clamped 1–500), and history push/replace.
- **Hybrid TMDB Client**:
  - *Problem*: External TMDB requests may be rate-limited or require user-supplied keys in sandbox environments.
  - *Solution*: A hybrid adapter pattern. If `VITE_TMDB_API_KEY` is present, it issues live authenticated requests to `api.themoviedb.org/3`; otherwise, it routes seamlessly to a rich offline dataset covering 100+ titles, real collections, cast, trailers, and seasons.
- **Streaming Provider Integration (`api.fmov.my`)**:
  - *Architecture*: Multi-server iframe/HLS player wrapper with fallback handling, sandbox attribute management, and graceful error messages when a source responds with 403 or unavailable stream.
- **Multi-Source Subtitles**:
  - *Architecture*: Subtitle aggregator resolving tracks from VDRK v1, VDRK v2, and OpenSubtitles v3, normalizing ISO codes (`sr`, `hr`, `bs`, `en`), and presenting clean dropdown options.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TStream.online App                            │
└────────────────────────────────────────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  Navigation  │             │ Catalog &    │             │  Streaming   │
│  & Views     │             │ Pagination   │             │  Player Hub  │
└──────────────┘             └──────────────┘             └──────────────┘
  • Home / Hero                • /movies?page=2             • api.fmov.my
  • Movie Details              • /tv-shows?page=2           • Server 1/2/3
  • TV Details                 • /trending?page=2           • Subtitle VDRK
  • Watch Page                 • /search?q=...&page=2       • OpenSubtitles
  • Library / History          • Filter sync (genres/sort)  • Next/Prev Ep
       │                            │                            │
       └────────────────────────────┼────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   State, Storage & Metadata Engine                     │
│  • LocalStorage Library (Watchlist, History, Resume Progress)          │
│  • Hybrid TMDB Client (Live API + High-Fidelity Fallback Dataset)       │
│  • SEO Metadata & JSON-LD Schema (Movie, TVSeries, WebSite)            │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy & Module Plan

- `src/types/media.ts`: Comprehensive TypeScript interfaces for MediaItem, MovieDetail, TVDetail, Season, Episode, Collection, CastMember, SubtitleTrack, and FilterOptions.
- `src/services/tmdb.ts`: Hybrid TMDB API adapter with pagination handling, error recovery, search query formatting, and collection fetching.
- `src/services/subtitles.ts`: Multi-source subtitle resolver querying VDRK and Stremio OpenSubtitles v3 with language normalization.
- `src/services/storage.ts`: Guest-first LocalStorage service managing Watchlist, History, Continue Watching timestamps, and user preferences.
- `src/components/Navbar.tsx`: 3-zone Top Bar Contract with brand wordmark, clean navigation links, search trigger, and library drawer.
- `src/components/Footer.tsx`: Restrained footer with copyright, genre directory, legal disclaimer, and status check.
- `src/components/MediaCard.tsx`: Fluid poster card with hover actions, rating badge, year, and media type indicator.
- `src/components/Pagination.tsx`: Robust pagination bar with Previous, Next, numbered pages, edge ellipsis, and disabled boundary handling.
- `src/components/FilterBar.tsx`: Advanced filter drawer with multi-genre selector, sort options, rating range, and year filters.
- `src/components/DetailsHero.tsx`: Full-bleed cinematic backdrop hero matching the reference screenshot with poster, quick action buttons, and ratings.
- `src/components/CastCarousel.tsx`: Top cast slider with actor portraits and character roles.
- `src/components/CollectionSection.tsx`: Franchise collection strip (e.g. Spider-Man, Avengers, Harry Potter).
- `src/components/StreamingPlayer.tsx`: Embed wrapper for `api.fmov.my` with server selection tabs, subtitle track selector, and episode navigation.
- `src/components/TrailerModal.tsx`: Embedded YouTube trailer player modal with keyboard escape listener.
- `src/pages/HomePage.tsx`: Featured Hero, Continue Watching, Trending Movies, Popular Series, and Top Collections.
- `src/pages/DetailsPage.tsx`: The primary Details page matching the reference screenshot.
- `src/pages/WatchPage.tsx`: Cinema watch view with player, server switch, episode guide, and recommended titles.
- `src/pages/CatalogPage.tsx`: Paginated browsing for Movies, TV Shows, Trending, Genres, and Tags.
- `src/pages/SearchPage.tsx`: Live and advanced search with instant filter updates and shareable URL query params.
- `src/pages/LibraryPage.tsx`: Watchlist, Continue Watching, and Watch History.
- `src/pages/AdminPage.tsx`: Operational admin console with provider diagnostic tests and configuration toggles.
- `src/pages/LegalPage.tsx`: About, Privacy, Terms, Cookies, and Support pages.

---

## 5. Verification Plan

1. **Pagination Verification**:
   - Verify `/movies?page=1` vs `/movies?page=2` returns distinct items.
   - Verify query parameters (`genre=28`, `sort_by=popularity.desc`) are preserved across page transitions.
   - Verify boundary conditions: Page 1 disables Previous; Last page disables Next; invalid page strings fallback safely to 1.
2. **Details Page Visual Parity**:
   - Inspect desktop and mobile layouts against the reference design: full-bleed backdrop, dark gradient scrim, poster shadow, typography hierarchy, cast carousel, and collection banner.
3. **Player & Subtitles**:
   - Verify `api.fmov.my` embed URL generation for movies (`/embed/movie/{id}`) and TV episodes (`/embed/tv/{id}/{s}/{e}`).
   - Verify subtitle normalization for Serbian (`sr`), Croatian (`hr`), Bosnian (`bs`), and English (`en`).
4. **Build & Quality Gates**:
   - Execute `compile_applet` to verify TypeScript types, Vite bundling, and production asset generation without warnings.
