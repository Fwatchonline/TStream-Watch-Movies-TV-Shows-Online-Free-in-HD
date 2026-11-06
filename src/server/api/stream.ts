import { Hono } from 'hono';
import { getActiveProviders } from '../providers';

export const streamRoute = new Hono();

streamRoute.get('/:type/:id', async (c) => {
    const type = c.req.param('type') as 'movie' | 'tv';
    const id = c.req.param('id');
    const season = c.req.query('season') ? parseInt(c.req.query('season')!, 10) : undefined;
    const episode = c.req.query('episode') ? parseInt(c.req.query('episode')!, 10) : undefined;

    const activeList = getActiveProviders();
    const results: any[] = [];

    // Test top active providers in parallel
    await Promise.allSettled(
        activeList.map(async (provider) => {
            try {
                const res = await provider.getStream(id, type, season, episode);
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
                // Ignore individual provider error, next provider will be used
            }
        })
    );

    // Sort by defined priority (Vector -> Valence -> Eclipse -> BoxMovie -> Apex)
    results.sort((a, b) => a.priority - b.priority);

    if (results.length === 0) {
        return c.json({ success: false, error: 'No active server returned a working stream for this title.' }, 404);
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
