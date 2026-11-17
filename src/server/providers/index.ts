import { VideoProvider } from '../types';
import { VidAPIProvider } from './vidapi';
import { BoxMovieProvider } from './boxmovie';
import { EclipseProvider } from './eclipse';
import { LMScriptProvider } from './lmscript';
import { MeowTVProvider } from './meowtv';
import { VidRockProvider } from './vidrock';
import { VidLinkProvider } from './vidlink';
import { VidRiftProvider } from './vidrift';
import { CinejoyProvider } from './cinejoy';
import { CineSrcProvider } from './cinesrc';
import { HexaProvider } from './hexa';
import { VidUpProvider } from './vidup';

/**
 * All active direct streaming providers, ordered by verified live movie + TV speed & reliability:
 *  1. Aether  (cinejoy)  — Priority 1 Default (~990ms avg, 4K / 1080p / 720p HLS + captions)
 *  2. Vortex  (cinesrc)  — CSP4 adaptive multi-server HLS (4K / 1080p / 720p)
 *  3. Krypton (vidrock)  — AES-GCM decrypted HLS/MP4 cluster (1080p / 720p)
 *  4. Cobalt  (vidup)    — Ultra-HD adaptive HLS (4K / 1440p / 1080p / 720p)
 *  5. Helios  (hexa)     — Multi-node encrypted HLS (1440p / 1080p / 720p)
 *  6. Vertex  (boxmovie) — Direct MP4 CDN (1080p / 720p / 480p)
 *  7. Flux    (meowtv)   — Multi-Audio HLS Stream
 *  8. Sigma   (vidapi)   — Direct adaptive HLS
 *  9. Spectra (eclipse)  — Direct 1080p MP4/HLS
 * 10. Nimbus  (vidrift)  — Embed HLS extraction
 * 11. Quantum (vidlink)  — Multi-quality HLS/MP4
 * 12. Onyx    (lmscript) — Movies 1080p
 */
export const providers: Record<string, VideoProvider> = {
    cinejoy: new CinejoyProvider({ priority: 1, label: 'Aether' }),
    cinesrc: new CineSrcProvider({ priority: 2, label: 'Vortex' }),
    vidrock: new VidRockProvider({ priority: 3, label: 'Krypton' }),
    vidup: new VidUpProvider({ priority: 4, label: 'Cobalt' }),
    hexa: new HexaProvider({ priority: 5, label: 'Helios' }),
    boxmovie: new BoxMovieProvider({ priority: 6, label: 'Vertex' }),
    meowtv: new MeowTVProvider({ priority: 7, label: 'Flux' }),
    vidapi: new VidAPIProvider({ priority: 8, label: 'Sigma' }),
    eclipse: new EclipseProvider({ priority: 9, label: 'Spectra' }),
    vidrift: new VidRiftProvider({ priority: 10, label: 'Nimbus' }),
    vidlink: new VidLinkProvider({ priority: 11, label: 'Quantum' }),
    lmscript: new LMScriptProvider({ priority: 12, label: 'Onyx' })
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
