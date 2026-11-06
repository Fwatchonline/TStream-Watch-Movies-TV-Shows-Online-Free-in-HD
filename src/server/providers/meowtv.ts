import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { USER_AGENT } from '../utils/helpers';

const API_BASE = 'https://api.meowtv.ru';
const HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json',
    'Referer': 'https://meowtv.ru/',
    'Origin': 'https://meowtv.ru'
};

async function getTicket(): Promise<string | null> {
    try {
        const res = await fetch(`${API_BASE}/streams/ticket`, {
            method: 'POST',
            headers: { ...HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            signal: AbortSignal.timeout(4000)
        });
        if (!res.ok) return null;
        const d = await res.json();
        return d.ticket || null;
    } catch {
        return null;
    }
}

async function decryptPayload(payload: any): Promise<any> {
    try {
        const res = await fetch('https://enc-dec.app/api/dec-meowtv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
            body: JSON.stringify({ data: payload }),
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return null;
        const d = await res.json();
        return typeof d.result === 'string' ? JSON.parse(d.result) : d.result;
    } catch {
        return null;
    }
}

export class MeowTVProvider implements VideoProvider {
    key = 'meowtv';
    label = 'Apex';
    priority = 6;
    enabled = true;
    timeout = 9000;

    constructor(config?: ProviderConfig) {
        if (config?.priority !== undefined) this.priority = config.priority;
    }

    async getStream(id: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<StreamResult> {
        try {
            const ticket = await getTicket();
            if (!ticket) return { success: false, source: this.key, error: 'Ticket failed' };

            const path = type === 'tv'
                ? `/streams/tv/${id}/${season || 1}/${episode || 1}?s=dcloud`
                : `/streams/movie/${id}?s=dcloud`;

            const res = await fetch(`${API_BASE}${path}`, {
                headers: { ...HEADERS, 'x-stream-ticket': ticket },
                signal: AbortSignal.timeout(this.timeout)
            });
            if (!res.ok) return { success: false, source: this.key, error: 'Failed upstream' };

            const payload = await res.json();
            const decrypted = await decryptPayload(payload);
            if (!decrypted?.url) return { success: false, source: this.key, error: 'No stream url' };

            const streamUrl = `/api/proxy?url=${encodeURIComponent(decrypted.url)}&referer=${encodeURIComponent('https://meowtv.ru/')}&origin=${encodeURIComponent('https://meowtv.ru')}`;

            return {
                success: true,
                source: this.key,
                url: streamUrl,
                type: decrypted.url.includes('.mp4') ? 'mp4' : 'hls',
                sources: [{
                    name: 'Apex · Multi HLS',
                    url: streamUrl,
                    type: 'hls'
                }]
            };
        } catch (e: any) {
            return { success: false, source: this.key, error: e.message };
        }
    }
}
