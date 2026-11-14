import { VideoProvider } from '../types';
import { VidAPIProvider } from './vidapi';
import { BoxMovieProvider } from './boxmovie';
import { EclipseProvider } from './eclipse';
import { LMScriptProvider } from './lmscript';
import { MeowTVProvider } from './meowtv';
import { VidRockProvider } from './vidrock';
import { VidLinkProvider } from './vidlink';
import { VidRiftProvider } from './vidrift';

/**
 * All active direct streaming providers ranked by baseline lowest-RTT architecture first:
 * 1. Vector   (vidapi)   — 1 RTT direct adaptive HLS
 * 2. Eclipse  (eclipse)  — 1 RTT direct 1080p MP4/HLS
 * 3. BoxMovie (boxmovie) — 1 RTT direct 1080p/720p MP4 CDN
 * 4. Core     (vidrock)  — AES-GCM HLS + parallel source validation
 * 5. Orion    (vidrift)  — 1 RTT embed HLS extraction
 * 6. Pulse    (vidlink)  — 2 RTTs enc-dec + vidlink.pro HLS/MP4
 * 7. Valence  (lmscript) — 2 RTTs TMDB + lmscript (Movies 1080p)
 * 8. Apex     (meowtv)   — 3 RTTs ticket + stream + decrypt (Multi-Audio HLS)
 */
export const providers: Record<string, VideoProvider> = {
    vidapi: new VidAPIProvider({ priority: 1, label: 'Vector' }),
    eclipse: new EclipseProvider({ priority: 2, label: 'Eclipse' }),
    boxmovie: new BoxMovieProvider({ priority: 3, label: 'BoxMovie' }),
    vidrock: new VidRockProvider({ priority: 4, label: 'Core' }),
    vidrift: new VidRiftProvider({ priority: 5, label: 'Orion' }),
    vidlink: new VidLinkProvider({ priority: 6, label: 'Pulse' }),
    lmscript: new LMScriptProvider({ priority: 7, label: 'Valence' }),
    meowtv: new MeowTVProvider({ priority: 8, label: 'Apex' })
};

const providerLatencyEwmaMs = new Map<string, number>();

export function recordProviderLatency(key: string, latencyMs: number, succeeded: boolean): void {
    if (!key || !Number.isFinite(latencyMs) || latencyMs < 0) return;
    // Penalize failed/empty responses gently so consistently healthy, fast providers win first place
    const effectiveMs = succeeded ? latencyMs : Math.max(latencyMs + 5000, 8000);
    const prev = providerLatencyEwmaMs.get(key);
    const next = prev === undefined ? effectiveMs : Math.round(prev * 0.4 + effectiveMs * 0.6);
    providerLatencyEwmaMs.set(key, next);
}

export function clearProviderLatencies(): void {
    providerLatencyEwmaMs.clear();
}

export function getProviderLatencyMs(key: string): number | null {
    const val = providerLatencyEwmaMs.get(key);
    return val === undefined ? null : val;
}

export function getActiveProviders(providerList: Record<string, VideoProvider> = providers): VideoProvider[] {
    return Object.values(providerList)
        .filter(p => p.enabled !== false)
        .sort((a, b) => {
            const latA = providerLatencyEwmaMs.get(a.key);
            const latB = providerLatencyEwmaMs.get(b.key);
            if (latA !== undefined && latB !== undefined && latA !== latB) {
                return latA - latB;
            }
            if (latA !== undefined && latB === undefined && latA < 4000) {
                return -1;
            }
            if (latB !== undefined && latA === undefined && latB < 4000) {
                return 1;
            }
            return a.priority - b.priority;
        });
}
