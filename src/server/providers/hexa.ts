import crypto from 'node:crypto';
import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { USER_AGENT } from '../utils/helpers';

const HEXA_API_BASE = 'https://theemoviedb.hexa.su';
const HEXA_CAP_BASE = 'https://cap.hexa.su/15d2cf0395';
const ENC_API = 'https://enc-dec.app/api';
const HEXA_REFERER = 'https://hexa.su/';
const HEXA_ORIGIN = 'https://hexa.su';

const CAP_HEADERS = {
    'accept-language': 'en-US,en;q=0.9',
    origin: HEXA_ORIGIN,
    referer: HEXA_REFERER,
    'user-agent': USER_AGENT
};

let cachedCapToken: { token: string; remainingUses: number; expiresAt: number } | null = null;
let capTokenInFlight: Promise<string | null> | null = null;

async function getCapToken(fetchImpl: typeof fetch, forceRefresh = false): Promise<string | null> {
    const useCache = fetchImpl === fetch;
    const now = Date.now();
    if (useCache && !forceRefresh && cachedCapToken && cachedCapToken.expiresAt > now && cachedCapToken.remainingUses > 0) {
        cachedCapToken.remainingUses -= 1;
        return cachedCapToken.token;
    }

    if (useCache && capTokenInFlight) {
        return capTokenInFlight;
    }

    const work = async (): Promise<string | null> => {
        try {
            const chRes = await fetchImpl(`${HEXA_CAP_BASE}/challenge`, {
                method: 'POST',
                headers: CAP_HEADERS,
                signal: AbortSignal.timeout(5000)
            });
            if (!chRes.ok) return null;
            const challengeData = await chRes.json();

            const encRes = await fetchImpl(`${ENC_API}/enc-hexa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                body: JSON.stringify({ challenge_data: challengeData }),
                signal: AbortSignal.timeout(5000)
            });
            if (!encRes.ok) return null;
            const encJson = await encRes.json();
            if (encJson?.status !== 200 || !encJson?.result) return null;

            const redeemRes = await fetchImpl(`${HEXA_CAP_BASE}/redeem`, {
                method: 'POST',
                headers: { ...CAP_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify(encJson.result),
                signal: AbortSignal.timeout(5000)
            });
            if (!redeemRes.ok) return null;
            const redeemJson = await redeemRes.json();
            const token = typeof redeemJson?.token === 'string' ? redeemJson.token.trim() : '';
            if (!token) return null;

            if (useCache) {
                cachedCapToken = {
                    token,
                    remainingUses: 15,
                    expiresAt: Date.now() + 8 * 60 * 1000
                };
            }
            return token;
        } catch {
            return null;
        }
    };

    if (!useCache) {
        return work();
    }

    capTokenInFlight = work().finally(() => {
        capTokenInFlight = null;
    });
    return capTokenInFlight;
}

export class HexaProvider implements VideoProvider {
    key = 'hexa';
    label = 'Helios';
    priority = 5;
    enabled = true;
    timeout = 11500;
    private fetchImpl: typeof fetch;

    constructor(config?: ProviderConfig & { fetchImpl?: typeof fetch }) {
        if (config?.label !== undefined) this.label = config.label;
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
        this.fetchImpl = config?.fetchImpl || fetch;
    }

    async getStream(
        id: string,
        type: 'movie' | 'tv',
        season?: number,
        episode?: number
    ): Promise<StreamResult> {
        try {
            let capToken = await getCapToken(this.fetchImpl);
            if (!capToken) {
                return { success: false, source: this.key, error: 'Captcha token unavailable' };
            }

            const apiUrl =
                type === 'tv'
                    ? `${HEXA_API_BASE}/api/tmdb/tv/${id}/season/${season || 1}/episode/${episode || 1}/images`
                    : `${HEXA_API_BASE}/api/tmdb/movie/${id}/images`;

            let apiKeyHex = crypto.randomBytes(32).toString('hex');
            let upstreamRes = await this.fetchImpl(apiUrl, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Referer: HEXA_REFERER,
                    Accept: 'text/plain',
                    'X-Fingerprint-Lite': 'e9136c41504646444',
                    'X-Cap-Token': capToken,
                    'X-Api-Key': apiKeyHex
                },
                signal: AbortSignal.timeout(9000)
            });

            if (upstreamRes.status === 401 || upstreamRes.status === 403) {
                capToken = await getCapToken(this.fetchImpl, true);
                if (!capToken) {
                    return { success: false, source: this.key, error: `Auth failed HTTP ${upstreamRes.status}` };
                }
                apiKeyHex = crypto.randomBytes(32).toString('hex');
                upstreamRes = await this.fetchImpl(apiUrl, {
                    headers: {
                        'User-Agent': USER_AGENT,
                        Referer: HEXA_REFERER,
                        Accept: 'text/plain',
                        'X-Fingerprint-Lite': 'e9136c41504646444',
                        'X-Cap-Token': capToken,
                        'X-Api-Key': apiKeyHex
                    },
                    signal: AbortSignal.timeout(9000)
                });
            }

            if (!upstreamRes.ok) {
                return { success: false, source: this.key, error: `Upstream HTTP ${upstreamRes.status}` };
            }

            const encryptedText = await upstreamRes.text();
            const decRes = await this.fetchImpl(`${ENC_API}/dec-hexa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                body: JSON.stringify({ text: encryptedText, key: apiKeyHex }),
                signal: AbortSignal.timeout(5000)
            });
            if (!decRes.ok) {
                return { success: false, source: this.key, error: 'Decrypt failed' };
            }
            const decJson = await decRes.json();
            if (decJson?.status !== 200 || !Array.isArray(decJson?.result?.sources)) {
                return { success: false, source: this.key, error: 'No sources returned' };
            }

            const sources: NonNullable<StreamResult['sources']> = [];
            const seenUrls = new Set<string>();
            for (const s of decJson.result.sources) {
                const rawUrl = String(s?.url || '').trim();
                if (!/^https?:\/\//i.test(rawUrl) || seenUrls.has(rawUrl)) continue;
                seenUrls.add(rawUrl);
                const streamType = rawUrl.toLowerCase().includes('.mp4') ? 'mp4' : 'hls';
                const serverName = String(s?.server || 'Node').trim();
                sources.push({
                    name: `${this.label} · ${serverName}`,
                    url: `/api/proxy?url=${encodeURIComponent(rawUrl)}&referer=${encodeURIComponent(HEXA_REFERER)}&origin=${encodeURIComponent(HEXA_ORIGIN)}`,
                    quality: String(s?.quality || (streamType === 'hls' ? '1080p Auto' : '1080p')),
                    type: streamType
                });
            }

            if (sources.length === 0) {
                return { success: false, source: this.key, error: 'No playable sources' };
            }

            return {
                success: true,
                source: this.key,
                url: sources[0].url,
                type: (sources[0].type as 'hls' | 'mp4') || 'hls',
                sources
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err?.message || 'Hexa resolution failed' };
        }
    }
}
