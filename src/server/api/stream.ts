import { Hono } from 'hono';
import { getActiveProviders } from '../providers';

export const streamRoute = new Hono();

const PROVIDER_TIMEOUT_MS = 12000;

streamRoute.get('/:type/:id', async (c) => {
    const rawType = c.req.param('type');
    if (rawType !== 'movie' && rawType !== 'tv') {
        return c.json({ success: false, error: 'Invalid media type. Expected "movie" or "tv".' }, 400);
    }
    const type: 'movie' | 'tv' = rawType;

    const id = c.req.param('id');
    if (!id || !/^\d+$/.test(id) || parseInt(id, 10) <= 0) {
        return c.json({ success: false, error: 'Invalid or missing numeric TMDB id.' }, 400);
    }

    const rawSeason = c.req.query('season');
    const rawEpisode = c.req.query('episode');
    let season: number | undefined;
    let episode: number | undefined;

    if (rawSeason !== undefined) {
        if (!/^\d+$/.test(rawSeason) || parseInt(rawSeason, 10) < 1) {
            return c.json({ success: false, error: 'Invalid season parameter.' }, 400);
        }
        season = parseInt(rawSeason, 10);
    }

    if (rawEpisode !== undefined) {
        if (!/^\d+$/.test(rawEpisode) || parseInt(rawEpisode, 10) < 1) {
            return c.json({ success: false, error: 'Invalid episode parameter.' }, 400);
        }
        episode = parseInt(rawEpisode, 10);
    }

    const activeList = getActiveProviders();
    const results: any[] = [];
    let failedProviders = 0;

    // Test top active providers in parallel with strict per-provider timeout
    await Promise.allSettled(
        activeList.map(async (provider) => {
            try {
                const res = await Promise.race([
                    provider.getStream(id, type, season, episode),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Provider timeout')), PROVIDER_TIMEOUT_MS)
                    )
                ]);
                if (res.success && res.url) {
                    results.push({
                        key: provider.key,
                        label: provider.label,
                        priority: provider.priority,
                        url: res.url,
                        type: res.type || 'hls',
                        sources: res.sources || []
                    });
                }
            } catch {
                failedProviders++;
            }
        })
    );

    // Sort by defined priority (Vector -> Valence -> Eclipse -> BoxMovie -> Apex)
    results.sort((a, b) => a.priority - b.priority);

    if (results.length === 0) {
        if (activeList.length > 0 && failedProviders === activeList.length) {
            return c.json(
                { success: false, error: 'Upstream stream providers are temporarily unavailable or timed out.' },
                503
            );
        }
        return c.json(
            { success: false, error: 'No active server returned a working stream for this title.' },
            404
        );
    }

    const primary = results[0];

    return c.json({
        success: true,
        primaryServer: primary.label,
        url: primary.url,
        type: primary.type,
        servers: results
    });
});
