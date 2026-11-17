import { webcrypto } from 'node:crypto';
import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { fetchJson, USER_AGENT } from '../utils/helpers';
import { validateSourceUrl } from '../utils/validator';

const GCM_HEX_KEY = '7f3e9c2a8b5d1f4e6a9c3b7d2e5f8a1c4b6d9e2f5a8c1b4d7e9f2a5c8b1d4e7f';
const BASE_URL = 'https://vidrock.net/';
const PROXY_PREFIX = 'https://proxy.vidrock.store/';

let cryptoKey: CryptoKey | null = null;

function hexToBytes(hex: string) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

function base64UrlToBytes(value: string) {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function getSubtleCrypto() {
    return typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : webcrypto.subtle;
}

async function getKey() {
    if (cryptoKey) return cryptoKey;
    const keyBytes = hexToBytes(GCM_HEX_KEY);
    const subtle = getSubtleCrypto();
    cryptoKey = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    return cryptoKey;
}

export async function decryptVidRockStreamUrl(value: string): Promise<string | null> {
    try {
        const data = base64UrlToBytes(value);
        if (data.length < 28) throw new Error('Ciphertext too short');
        const iv = data.slice(0, 12);
        const ciphertext = data.slice(12);
        const key = await getKey();
        const subtle = getSubtleCrypto();
        const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    } catch {
        return null;
    }
}

export class VidRockProvider implements VideoProvider {
    key = 'vidrock';
    label = 'Krypton';
    priority = 3;
    enabled = true;
    timeout = 9000;

    constructor(config?: ProviderConfig) {
        if (config?.label !== undefined) this.label = config.label;
        if (config?.priority !== undefined) this.priority = config.priority;
        if (config?.enabled !== undefined) this.enabled = config.enabled;
        if (config?.timeout !== undefined) this.timeout = config.timeout;
    }

    async getStream(id: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<StreamResult> {
        try {
            const path = type === 'tv' ? `tv/${id}/${season || 1}/${episode || 1}` : `movie/${id}`;
            const apiData = await fetchJson(`${BASE_URL}api/${path}`, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Referer: BASE_URL,
                    Origin: BASE_URL.replace(/\/$/, '')
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!apiData || typeof apiData !== 'object') {
                return { success: false, source: this.key, error: 'Invalid API response' };
            }

            const entries = Object.entries(apiData) as [string, any][];
            const validated = await Promise.all(
                entries.map(async ([subProvider, info]) => {
                    if (!info?.url) return null;
                    const decryptedUrl = await decryptVidRockStreamUrl(info.url);
                    if (!decryptedUrl) return null;

                    let url = decryptedUrl;
                    if (url.startsWith(PROXY_PREFIX)) {
                        try {
                            url = decodeURIComponent(url.slice(PROXY_PREFIX.length).replace(/^\/+/, ''));
                        } catch {
                            return null;
                        }
                    }

                    const isXpass = url.includes('xpass.top');
                    const headers = {
                        'User-Agent': USER_AGENT,
                        Referer: isXpass ? 'https://play.xpass.top/' : BASE_URL,
                        Origin: isXpass ? 'https://play.xpass.top' : 'https://vidrock.net'
                    };

                    const isValid = await validateSourceUrl(url, headers);
                    if (!isValid) return null;

                    const sType = info.type === 'hls' || url.includes('.m3u8') ? 'hls' : 'mp4';
                    const subLabel = String(subProvider || '').trim();
                    return {
                        name: subLabel ? `${this.label} · ${subLabel}` : this.label,
                        url: `/api/proxy?url=${encodeURIComponent(url)}&origin=${encodeURIComponent(headers.Origin)}&referer=${encodeURIComponent(headers.Referer)}`,
                        quality: sType === 'hls' ? '1080p Auto' : '1080p',
                        type: sType as 'hls' | 'mp4',
                        headers
                    };
                })
            );

            const validSources = validated.filter((s): s is NonNullable<typeof s> => s !== null);
            if (validSources.length === 0) {
                return { success: false, source: this.key, error: 'No valid streams found' };
            }

            return {
                success: true,
                source: this.key,
                url: validSources[0].url,
                type: validSources[0].type,
                sources: validSources,
                headers: validSources[0].headers
            };
        } catch (e: any) {
            return { success: false, source: this.key, error: e.message };
        }
    }
}
