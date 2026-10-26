# TStream — Movies & TV Shows [LIVE DEMO ](https://tstream.online)

A modern, dark-themed movie and television discovery interface built with **React, TypeScript, and Vite**. TStream brings together a browsable media catalogue, title details, season and episode navigation, streaming-provider integration, subtitles, and a personal viewing library.

> **Project status:** Community/developer project. Metadata, playback sources, and subtitle availability depend on external services and may change without notice.

## Features

- **Discover and browse** movies and TV shows, including trending titles, top-rated titles, collections, tags, platform categories, and alphabetical browsing.
- **Search and filter** the catalogue by title and supported catalogue filters.
- **Detailed title pages** with artwork, descriptions, ratings, cast information, trailers where available, related titles, and franchise/collection information.
- **Movie and TV playback pages** with season and episode selection for television series.
- **Streaming integrations** that resolve supported providers and handle HLS playlists and other supported stream formats through the project's stream API middleware.
- **Subtitle lookup** through configured subtitle sources, with language-code normalization for languages including Serbian, Croatian, Bosnian, and English.
- **Personal library** with a watchlist, continue-watching entries, viewing history, and user preferences stored in the browser.
- **Collections and discovery tools** to explore related titles and franchises.
- **Responsive, dark-themed interface** built for desktop and smaller screens.
- **Utility pages** for legal/contact information and an operations/diagnostics interface.

Some external services and diagnostic indicators may be unavailable or demonstrative in the current implementation. Do not assume that every provider, subtitle source, or displayed service status is live or guaranteed to work.

## Technology stack

- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/)
- [hls.js](https://github.com/video-dev/hls.js)
- TMDB for movie and television metadata and artwork
- External streaming and subtitle services configured in the source code

## Requirements

- Node.js **22 or newer** recommended
- npm
- Git
- A TMDB API key for your own API configuration
- Any optional third-party API credentials required by the integrations you choose to enable

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/Fwatchonline/TStream-Watch-Movies-TV-Shows-Online-Free-in-HD.git
cd TStream-Watch-Movies-TV-Shows-Online-Free-in-HD
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set values relevant to your deployment. For example:

```dotenv
# Optional: Google Gemini integration, if enabled
GEMINI_API_KEY=your_gemini_api_key

# The URL where the application is running
APP_URL=http://localhost:3000

# Optional: your own TMDB API key
VITE_TMDB_API_KEY=your_tmdb_api_key
```

The repository's `.env.example` documents `GEMINI_API_KEY` and `APP_URL`. `VITE_TMDB_API_KEY` is read by the TMDB service when configured; the current source also contains a fallback API key. Before publishing or operating your own deployment, review the TMDB key handling and replace/remove any embedded fallback as appropriate.

**Security note:** Variables prefixed with `VITE_` are exposed to browser-side code in the built application. Never put private server credentials in a `VITE_` variable. For production, consider accessing TMDB through a server-side endpoint if you need to keep credentials off the client.

### 4. Start the development server

```bash
npm run dev
```

The configured Vite development server listens on port **3000** and binds to `0.0.0.0`. Open:

```text
http://localhost:3000
```

### 5. Build and preview

Create a production frontend build:

```bash
npm run build
```

Preview the build locally:

```bash
npm run preview
```

Vite writes the compiled frontend to `dist/`.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server on port 3000. |
| `npm run build` | Build the frontend for production. |
| `npm run preview` | Preview the production build using Vite. |
| `npm run lint` | Run the TypeScript compiler check (`tsc --noEmit`). |
| `npm test` | Run the pagination and subtitle-normalization tests. |
| `npm run clean` | Remove the generated `dist` directory and `server.js` if present. |

Run the checks before submitting changes:

```bash
npm run lint
npm test
npm run build
```

## Main application routes

The app reads the current browser path and supports routes including:

| Route | Purpose |
| --- | --- |
| `/` | Home and discovery page |
| `/movies` | Movie catalogue |
| `/tv-shows` | TV-show catalogue |
| `/trending` | Trending titles |
| `/top-rated` | Top-rated titles |
| `/collections` | Movie and franchise collections |
| `/search?q=...` | Search results |
| `/tags` | Browse tags |
| `/platform/:platform` | Browse by platform/category |
| `/az/:letter` | Alphabetical browsing |
| `/movie/:id` | Movie details |
| `/tv/:id` | TV-show details |
| `/watch/movie/:id` | Movie playback page |
| `/watch/tv/:id/:season/:episode` | TV episode playback page |
| `/library` | Watchlist, continue watching, history, and settings |
| `/admin` | Operations/diagnostics interface |

When deploying behind Nginx, Apache, or another web server, configure single-page application history fallback so valid application routes serve `index.html` rather than returning a server-side 404.

## Streaming API and production deployment

The project defines two streaming endpoints in `vite.config.ts`:

- `GET /api/stream-resolve` — resolves stream information for a TMDB ID, with optional season, episode, and provider parameters.
- `GET /api/stream-proxy` — proxies supported stream requests and rewrites HLS playlists so referenced resources can be requested through the proxy.

**Important:** These endpoints are registered through Vite's development and preview middleware. A static deployment of the generated `dist/` folder does **not** run this middleware and therefore does not provide the streaming API by itself. For production, deploy a server/runtime that implements and mounts equivalent endpoints, or build a separate backend and point the frontend to it.

The proxy fetches external URLs, so it must be secured before public production use. Add strict destination/hostname allowlists, block private and link-local IP ranges, validate redirects, set timeouts and response-size limits, and apply rate limiting. Do not expose an unrestricted URL-fetching proxy to the public internet.

## Data and storage

- Movie/TV metadata and images are obtained from TMDB and/or the project's local fallback catalogue.
- Watchlist, continue-watching information, history, and settings are stored in the user's browser. They are not automatically synchronized between browsers or devices unless a synchronization backend is added.
- Stream and subtitle availability is controlled by independent third-party services and can vary by title, region, device, or time.

## Contributing

Contributions and bug reports are welcome. Before opening a pull request:

1. Keep changes focused and describe the user-visible impact.
2. Run `npm run lint`, `npm test`, and `npm run build`.
3. Do not commit `.env` files, API credentials, session tokens, or other secrets.
4. Document any new environment variables and third-party integrations.

## Attribution and legal notice

TStream uses TMDB metadata and artwork. This product uses the TMDB API but is **not endorsed or certified by TMDB**. See [TMDB](https://www.themoviedb.org/) for its terms and attribution requirements.

Streaming and subtitle integrations may rely on third-party services. TStream does not control their uptime, content, advertising, access restrictions, or licensing status. Deployers are responsible for complying with applicable laws, service terms, copyright rules, and any required permissions in their jurisdiction. Only access or distribute media when you have the necessary rights.

## License

No `LICENSE` file was identified in the repository when this README was prepared. Unless the project owner adds a license, reuse and redistribution are not automatically granted. Add a license file to state the terms under which others may use the project.
