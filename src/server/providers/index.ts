import { ProviderHealthRecord, VideoProvider } from '../types';
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
 * All active direct streaming providers, ordered by baseline reliability & speed:
 *  1. Aether  (cinejoy)  — Priority 1 Default
 *  2. Vortex  (cinesrc)  — Priority 2
 *  3. Krypton (vidrock)  — Priority 3
 *  4. Cobalt  (vidup)    — Priority 4
 *  5. Helios  (hexa)     — Priority 5
 *  6. Vertex  (boxmovie) — Priority 6
 *  7. Flux    (meowtv)   — Priority 7
 *  8. Sigma   (vidapi)   — Priority 8
 *  9. Spectra (eclipse)  — Priority 9
 * 10. Nimbus  (vidrift)  — Priority 10
 * 11. Quantum (vidlink)  — Priority 11
 * 12. Onyx    (lmscript) — Priority 12
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

interface InternalProviderStats {
    ewmaLatencyMs: number | null;
    totalRequests: number;
    successfulRequests: number;
    successfulStarts: number;
    timeoutCount: number;
    playbackFailures: number;
    lastSuccessfulCheck: string | null;
    lastError: string | null;
}

const providerStatsMap = new Map<string, InternalProviderStats>();

function ensureStats(key: string): InternalProviderStats {
    let entry = providerStatsMap.get(key);
    if (!entry) {
        entry = {
            ewmaLatencyMs: null,
            totalRequests: 0,
            successfulRequests: 0,
            successfulStarts: 0,
            timeoutCount: 0,
            playbackFailures: 0,
            lastSuccessfulCheck: null,
            lastError: null
        };
        providerStatsMap.set(key, entry);
    }
    return entry;
}

function computeHealthScore(stat: InternalProviderStats | undefined, priority: number): number {
    if (!stat || stat.totalRequests === 0) {
        // Untested default priors strictly based on priority ranking
        return Math.max(50, 100 - priority * 2);
    }
    const successRate = stat.successfulRequests / Math.max(1, stat.totalRequests);
    const playbackPenalty = Math.min(30, stat.playbackFailures * 6);
    const timeoutPenalty = Math.min(25, stat.timeoutCount * 5);
    const latencyPenalty =
        stat.ewmaLatencyMs !== null ? Math.min(25, Math.max(0, (stat.ewmaLatencyMs - 800) / 250)) : 0;
    const raw = Math.round(successRate * 100 - playbackPenalty - timeoutPenalty - latencyPenalty);
    return Math.max(0, Math.min(100, raw));
}

export function recordProviderLatency(
    key: string,
    latencyMs: number,
    succeeded: boolean,
    options?: { timedOut?: boolean; error?: string }
): void {
    if (!key || !Number.isFinite(latencyMs) || latencyMs < 0) return;
    const stat = ensureStats(key);
    stat.totalRequests += 1;

    if (succeeded) {
        stat.successfulRequests += 1;
        stat.lastSuccessfulCheck = new Date().toISOString();
        stat.lastError = null;
        stat.ewmaLatencyMs =
            stat.ewmaLatencyMs === null
                ? latencyMs
                : Math.round(stat.ewmaLatencyMs * 0.4 + latencyMs * 0.6);
    } else {
        if (options?.timedOut) stat.timeoutCount += 1;
        if (options?.error) stat.lastError = options.error.slice(0, 160);
        const penalizedMs = Math.max(latencyMs + 5000, 8000);
        stat.ewmaLatencyMs =
            stat.ewmaLatencyMs === null
                ? penalizedMs
                : Math.round(stat.ewmaLatencyMs * 0.4 + penalizedMs * 0.6);
    }
}

export function recordProviderPlaybackOutcome(
    key: string,
    succeeded: boolean,
    reason?: string
): void {
    if (!key) return;
    const stat = ensureStats(key);
    if (succeeded) {
        stat.successfulStarts += 1;
        stat.lastSuccessfulCheck = new Date().toISOString();
        stat.lastError = null;
    } else {
        stat.playbackFailures += 1;
        if (reason) stat.lastError = reason.slice(0, 160);
    }
}

export function clearProviderLatencies(): void {
    providerStatsMap.clear();
}

export function getProviderLatencyMs(key: string): number | null {
    return providerStatsMap.get(key)?.ewmaLatencyMs ?? null;
}

export function setProviderEnabled(key: string, enabled: boolean, providerList: Record<string, VideoProvider> = providers): boolean {
    const target = providerList[key];
    if (!target) return false;
    target.enabled = enabled;
    return true;
}

export function getProviderHealth(
    key: string,
    providerList: Record<string, VideoProvider> = providers
): ProviderHealthRecord | null {
    const p = providerList[key];
    if (!p) return null;
    const stat = providerStatsMap.get(key);
    const total = stat?.totalRequests ?? 0;
    const successRate = total > 0 ? Number(((stat!.successfulRequests) / total).toFixed(3)) : 1;
    return {
        key: p.key,
        label: p.label,
        priority: p.priority,
        enabled: p.enabled !== false,
        averageResponseMs: stat?.ewmaLatencyMs ?? null,
        successRate,
        totalRequests: total,
        successfulStarts: stat?.successfulStarts ?? 0,
        timeoutCount: stat?.timeoutCount ?? 0,
        playbackFailures: stat?.playbackFailures ?? 0,
        lastSuccessfulCheck: stat?.lastSuccessfulCheck ?? null,
        lastError: stat?.lastError ?? null,
        healthScore: computeHealthScore(stat, p.priority)
    };
}

export function getProviderHealthRecords(providerList: Record<string, VideoProvider> = providers): ProviderHealthRecord[] {
    return Object.values(providerList)
        .map((p) => getProviderHealth(p.key, providerList)!)
        .sort((a, b) => a.priority - b.priority);
}

export function getActiveProviders(providerList: Record<string, VideoProvider> = providers): VideoProvider[] {
    return Object.values(providerList)
        .filter((p) => p.enabled !== false)
        .sort((a, b) => {
            const statA = providerStatsMap.get(a.key);
            const statB = providerStatsMap.get(b.key);
            const latA = statA?.ewmaLatencyMs ?? undefined;
            const latB = statB?.ewmaLatencyMs ?? undefined;

            // Penalize providers with repeated playback failures or timeouts
            const failPenaltyA = (statA?.playbackFailures ?? 0) * 1500 + (statA?.timeoutCount ?? 0) * 1500;
            const failPenaltyB = (statB?.playbackFailures ?? 0) * 1500 + (statB?.timeoutCount ?? 0) * 1500;

            if (latA !== undefined && latB !== undefined) {
                const effA = latA + failPenaltyA;
                const effB = latB + failPenaltyB;
                if (effA !== effB) return effA - effB;
            }
            if (latA !== undefined && latB === undefined && latA + failPenaltyA < 4000) {
                return -1;
            }
            if (latB !== undefined && latA === undefined && latB + failPenaltyB < 4000) {
                return 1;
            }
            return a.priority - b.priority;
        });
}
