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
 * All active direct streaming providers.
 * Core (vidrock) is Priority 1 (default primary server loaded first),
 * followed by the remaining servers loaded right after:
 * 1. Core     (vidrock)  — Default primary AES-GCM HLS server
 * 2. BoxMovie (boxmovie) — 1 RTT direct 1080p/720p MP4 CDN
 * 3. Apex     (meowtv)   — Multi-Audio HLS Stream
 * 4. Vector   (vidapi)   — 1 RTT direct adaptive HLS
 * 5. Eclipse  (eclipse)  — 1 RTT direct 1080p MP4/HLS
 * 6. Orion    (vidrift)  — Embed HLS extraction
 * 7. Pulse    (vidlink)  — Enc-dec + vidlink.pro HLS/MP4
 * 8. Valence  (lmscript) — Movies 1080p
 */
export const providers: Record<string, VideoProvider> = {
    vidrock: new VidRockProvider({ priority: 1, label: 'Core' }),
    boxmovie: new BoxMovieProvider({ priority: 2, label: 'BoxMovie' }),
    meowtv: new MeowTVProvider({ priority: 3, label: 'Apex' }),
    vidapi: new VidAPIProvider({ priority: 4, label: 'Vector' }),
    eclipse: new EclipseProvider({ priority: 5, label: 'Eclipse' }),
    vidrift: new VidRiftProvider({ priority: 6, label: 'Orion' }),
    vidlink: new VidLinkProvider({ priority: 7, label: 'Pulse' }),
    lmscript: new LMScriptProvider({ priority: 8, label: 'Valence' })
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
