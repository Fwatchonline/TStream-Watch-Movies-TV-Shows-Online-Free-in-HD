import crypto from 'node:crypto';
import { VideoProvider, StreamResult, ProviderConfig } from '../types';
import { USER_AGENT } from '../utils/helpers';

const CINESRC_BASE = 'https://cinesrc.st';
const ENC_API = 'https://enc-dec.app/api';

const BASE_HEADERS = {
    Origin: CINESRC_BASE,
    Referer: `${CINESRC_BASE}/`,
    'Content-Type': 'text/plain;charset=UTF-8',
    'User-Agent': USER_AGENT
};

const K = [
    0x46C6C721, 0x4230C311, 0x18223A1D, 0x56389BA7,
    0xD4A87103, 0x07CB9E2F, 0x73085F9D, 0xD2396A1F,
    0x23AE5ADD, 0x4646C48F, 0x0F4E0903, 0x808F5F31,
    0x953D4E07, 0x7E238FFF, 0x634595DF, 0xCB5E4301
].map(x => x >>> 0);

const PERMUTATIONS = [
    [3, 5, 1, 0, 2, 4],
    [2, 0, 4, 5, 3, 1],
    [1, 4, 5, 3, 0, 2],
    [2, 0, 1, 5, 4, 3],
    [4, 2, 1, 0, 3, 5],
    [5, 0, 2, 1, 3, 4],
    [4, 5, 1, 0, 3, 2],
    [4, 0, 3, 5, 1, 2]
];

const SCHEDULES = [
    [0, 7, 6, 3, 2, 1, 5, 4, 0, 2, 4, 6, 5, 1, 7, 3],
    [5, 2, 1, 3, 0, 4, 6, 7, 4, 1, 0, 7, 3, 6, 5, 2],
    [4, 0, 2, 1, 5, 7, 6, 3, 2, 6, 0, 7, 4, 3, 5, 1],
    [5, 4, 7, 0, 2, 3, 1, 6, 5, 1, 4, 0, 7, 2, 3, 6],
    [4, 7, 0, 2, 1, 6, 5, 3, 6, 1, 3, 2, 0, 7, 4, 5],
    [0, 7, 2, 6, 3, 4, 5, 1, 6, 5, 0, 2, 7, 1, 4, 3],
    [0, 4, 5, 3, 1, 7, 2, 6, 3, 7, 5, 6, 1, 0, 2, 4],
    [7, 6, 0, 4, 2, 5, 1, 3, 7, 5, 3, 4, 2, 6, 0, 1]
];

const PROFILES: Record<number, [number, number]> = {
    0: [12, 15],
    1: [16, 17]
};

function rotl(x: number, n: number): number {
    const ux = x >>> 0;
    const shift = n & 31;
    return shift === 0 ? ux : ((ux << shift) | (ux >>> (32 - shift))) >>> 0;
}

function imulU32(a: number, b: number): number {
    return Math.imul(a | 0, b | 0) >>> 0;
}

function b64UrlToBuffer(s: string): Buffer {
    const pad = (4 - (s.length % 4)) % 4;
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

function parseChallengeW(wStr: string) {
    const c = b64UrlToBuffer(wStr);
    if (c.length !== 32) {
        throw new Error('Invalid CSP4 challenge length');
    }
    if (
        c[16] !== 0x7d || c[17] !== 0xbd || c[18] !== 0xd2 || c[19] !== 0x43 ||
        c[20] !== 4 ||
        c.subarray(28, 32).toString('ascii') !== 'CSP4'
    ) {
        throw new Error('Invalid CSP4 challenge header');
    }
    const mode = c[21];
    const diff = c[22];
    const varI = c[23];
    const rnd = c[24];
    const m_b = c[25];
    const s_i = c[26];
    const p_i = c[27];
    if (diff < 1 || diff > 30) throw new Error('Invalid CSP4 difficulty');
    if (varI > 7 || s_i > 7 || p_i > 7) throw new Error('Invalid CSP4 selector');
    const prof = PROFILES[mode];
    if (!prof || prof[0] !== rnd || prof[1] !== m_b) throw new Error('Invalid CSP4 profile');
    const w = [c.readUInt32LE(0), c.readUInt32LE(4), c.readUInt32LE(8), c.readUInt32LE(12)];
    return { c, w, mode, diff, varI, rnd, m_b, s_i, p_i };
}

function buildState(w: number[], varI: number, s_i: number, m_b: number): Uint32Array {
    const size = 1 << m_b;
    const s = new Uint32Array(size);
    let x = (w[varI & 3] ^ K[s_i] ^ imulU32(K[8 + s_i], varI + 1)) >>> 0;
    let y = (w[(varI + 1) & 3] ^ K[15 - s_i]) >>> 0;
    for (let i = 0; i < size; i++) {
        x = (w[(i + s_i) & 3] + x + imulU32(K[(i + varI) & 15], i + 1)) >>> 0;
        x = (x ^ (x << 13)) >>> 0;
        x = (x ^ (x >>> 17)) >>> 0;
        x = (x ^ (x << 5)) >>> 0;
        y = rotl((imulU32(K[(i + 9) & 15], i + 3) ^ y ^ x) >>> 0, i + varI + s_i);
        s[i] = (imulU32(K[(i + 5) & 15], i ^ varI) ^ rotl(w[(i + varI) & 3], i + s_i) ^ x ^ y) >>> 0;
    }
    return s;
}

function mixState(
    w: number[],
    s: Uint32Array,
    varI: number,
    rnd: number,
    m_b: number,
    s_i: number,
    p_i: number,
    nBig: bigint
): number[] {
    const mask = (1 << m_b) - 1;
    const lo = Number(nBig & 0xffffffffn) >>> 0;
    const hi = Number((nBig >> 32n) & 0xffffffffn) >>> 0;
    let a = (w[0] ^ K[varI] ^ lo) >>> 0;
    let b = (rotl(lo, varI + 7) ^ w[2]) >>> 0;
    let c = (w[1] ^ K[8 + s_i] ^ hi) >>> 0;
    let d = (rotl((lo ^ hi) >>> 0, s_i + 11) ^ w[3]) >>> 0;
    let e = (K[s_i + varI] ^ lo ^ hi) >>> 0;
    let f = (K[15 - varI] ^ w[s_i & 3]) >>> 0;
    const sch = SCHEDULES[s_i];
    for (let r = 0; r < rnd; r++) {
        const i1 = (rotl(b, r + 1) ^ imulU32(K[r & 15], f) ^ e ^ a) & mask;
        const v1 = s[i1];
        const i2 = (rotl(e, varI + r + 3) ^ imulU32(K[(r + 7) & 15], d) ^ c ^ v1) & mask;
        const op = sch[r];
        if (op === 0) {
            a = rotl((a + d + v1) >>> 0, 5);
            c = (imulU32(c ^ f ^ a, 1187432225) + b) >>> 0;
        } else if (op === 1) {
            b = rotl((c ^ e ^ b ^ v1) >>> 0, 11);
            d = (imulU32(b ^ a, 1110491921) + d) >>> 0;
        } else if (op === 2) {
            c = rotl((c + b + v1) >>> 0, 17);
            a = (imulU32(d ^ f ^ c, 404896285) ^ a) >>> 0;
        } else if (op === 3) {
            d = rotl((a ^ d ^ v1) >>> 0, 23);
            b = (imulU32(c ^ e ^ d, 1446550439) + b) >>> 0;
        } else if (op === 4) {
            a = (imulU32(a ^ e ^ v1, -727158525) + rotl(b, 7)) >>> 0;
            d = (rotl((c + f + a) >>> 0, 13) ^ d) >>> 0;
        } else if (op === 5) {
            c = (imulU32((c + f + v1) >>> 0, 130784815) ^ rotl(d, 9)) >>> 0;
            b = (rotl((a ^ e ^ c) >>> 0, 19) + b) >>> 0;
        } else if (op === 6) {
            b = (imulU32(b ^ f ^ v1, 1929928605) + rotl(a, 3)) >>> 0;
            c = (rotl((d + e + b) >>> 0, 15) ^ c) >>> 0;
        } else {
            d = (imulU32((d + e + v1) >>> 0, -767989217) ^ rotl(c, 21)) >>> 0;
            a = (rotl((b ^ f ^ d) >>> 0, 27) + a) >>> 0;
        }
        const v2 = s[i2];
        if (((f ^ r ^ v1) & 1) === 0) {
            f = rotl((v2 + f + a) >>> 0, r + 5);
            e = (imulU32(K[8 + op], (v2 ^ e ^ f) >>> 0) + d) >>> 0;
        } else {
            e = rotl((v2 ^ e ^ b) >>> 0, r + 9);
            f = (imulU32(K[(op + 11) & 15], (v2 + f + e) >>> 0) ^ c) >>> 0;
        }
    }
    const v = [a, c, b, d, f, e];
    return PERMUTATIONS[p_i].map(idx => v[idx]);
}

function difficultyMatched(hash: Buffer, bits: number): boolean {
    const fullBytes = bits >> 3;
    const remBits = bits & 7;
    for (let i = 0; i < fullBytes; i++) {
        if (hash[i] !== 0) return false;
    }
    return remBits === 0 || (hash[fullBytes] >>> (8 - remBits)) === 0;
}

export function solveCinesrcStage1(challenge: { w: string }, seedHex: string): string {
    const seed = Buffer.from(seedHex, 'hex');
    const { c, w, mode, diff, varI, rnd, m_b, s_i, p_i } = parseChallengeW(challenge.w);
    const s = buildState(w, varI, s_i, m_b);
    const msg = Buffer.alloc(88);
    c.copy(msg, 24, 0, 16);
    const cfg = m_b ^ 0x6b29;
    msg[48] = 4;
    msg[49] = mode;
    msg[50] = varI;
    msg[51] = s_i;
    msg[52] = p_i;
    msg[53] = rnd;
    msg[54] = cfg & 0xff;
    msg[55] = (cfg >> 8) & 0xff;
    seed.copy(msg, 56, 0, 32);

    for (let n = 0n; ; n++) {
        const m = mixState(w, s, varI, rnd, m_b, s_i, p_i, n);
        for (let i = 0; i < 6; i++) msg.writeUInt32LE(m[i], i * 4);
        msg.writeBigUInt64LE(n, 40);
        const digest = crypto.createHash('sha256').update(msg).digest();
        if (difficultyMatched(digest, diff)) {
            return `m4.${n.toString(16)}`;
        }
    }
}

export function solveCinesrcStage2(challenge: { pack: string[] }): string {
    const target = challenge.pack[0].split('').reverse().join('');
    const salt = challenge.pack[3].split('').reverse().join('');
    const r = challenge.pack[4].split('').reverse().join('');
    const body = b64UrlToBuffer(r.split('.')[1]).toString('utf8');
    const payload = b64UrlToBuffer(body.split('.')[1]).toString('utf8');
    const difficulty = Number(JSON.parse(payload).d);
    const width = Math.floor((difficulty + 3) / 4);
    const limit = 1 << difficulty;
    for (let i = 0; i < limit; i++) {
        const key = i.toString(16).padStart(width, '0');
        const digest = crypto.createHash('sha256').update(salt + key).digest('hex');
        if (digest === target) {
            return key;
        }
    }
    throw new Error('CineSrc stage2 solution not found');
}

export class CineSrcProvider implements VideoProvider {
    key = 'cinesrc';
    label = 'Vortex';
    priority = 2;
    enabled = true;
    timeout = 11000;
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
            const sStr = type === 'tv' ? String(season || 1) : null;
            const eStr = type === 'tv' ? String(episode || 1) : null;
            const embedUrl =
                type === 'tv'
                    ? `${CINESRC_BASE}/embed/tv/${id}?s=${sStr}&e=${eStr}`
                    : `${CINESRC_BASE}/embed/movie/${id}`;

            const encodedQuery = Buffer.from(JSON.stringify([type, id, sStr, eStr])).toString('base64url');
            const bootstrapRes = await this.fetchImpl(`${CINESRC_BASE}/api/c/bootstrap`, {
                method: 'POST',
                headers: { ...BASE_HEADERS, 'x-cs-q': encodedQuery },
                signal: AbortSignal.timeout(4500)
            });
            if (!bootstrapRes.ok) {
                return { success: false, source: this.key, error: `Bootstrap HTTP ${bootstrapRes.status}` };
            }
            const bootstrap = await bootstrapRes.json();
            const csHeaders: Record<string, string> = {
                ...BASE_HEADERS,
                'x-cs-b': '20261014-a',
                'x-cs-q': encodedQuery,
                'x-cs-r': String(bootstrap?.r || ''),
                'x-cs-p': String(bootstrap?.p || '')
            };

            const issue1Res = await this.fetchImpl(`${CINESRC_BASE}/api/c/issue`, {
                headers: csHeaders,
                signal: AbortSignal.timeout(4500)
            });
            if (!issue1Res.ok) {
                return { success: false, source: this.key, error: 'Stage 1 challenge failed' };
            }
            const challenge1 = await issue1Res.json();

            const seedRes = await this.fetchImpl(`${ENC_API}/enc-cinesrc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                body: JSON.stringify({
                    data: { url: embedUrl, user_agent: USER_AGENT, challenge_data: challenge1 },
                    type: 'seed'
                }),
                signal: AbortSignal.timeout(4500)
            });
            if (!seedRes.ok) return { success: false, source: this.key, error: 'Seed exchange failed' };
            const seedJson = await seedRes.json();
            if (seedJson?.status !== 200 || !seedJson?.result?.seed || !seedJson?.result?.state) {
                return { success: false, source: this.key, error: 'Invalid seed payload' };
            }

            const solution1 = solveCinesrcStage1(challenge1, seedJson.result.seed);
            const issue2Res = await this.fetchImpl(`${CINESRC_BASE}/api/c/stage2/issue`, {
                headers: csHeaders,
                signal: AbortSignal.timeout(4500)
            });
            if (!issue2Res.ok) {
                return { success: false, source: this.key, error: 'Stage 2 challenge failed' };
            }
            const challenge2 = await issue2Res.json();
            const solution2 = solveCinesrcStage2(challenge2);

            const encRes = await this.fetchImpl(`${ENC_API}/enc-cinesrc`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                body: JSON.stringify({
                    data: {
                        url: embedUrl,
                        user_agent: USER_AGENT,
                        challenge_data: {
                            stage1: { challenge: challenge1, solution: solution1 },
                            stage2: { challenge: challenge2, solution: solution2 }
                        },
                        state: seedJson.result.state
                    },
                    type: 'encrypt'
                }),
                signal: AbortSignal.timeout(4500)
            });
            if (!encRes.ok) return { success: false, source: this.key, error: 'Token encryption failed' };
            const encJson = await encRes.json();
            if (encJson?.status !== 200 || !encJson?.result?.token || !encJson?.result?.headers) {
                return { success: false, source: this.key, error: 'Invalid encrypt result' };
            }

            const token = `${encJson.result.token}::c3::${csHeaders['x-cs-r']}`;
            const state = encJson.result.state;
            const actionHeaders = encJson.result.headers;

            const providersRes = await this.fetchImpl(embedUrl, {
                method: 'POST',
                headers: { ...BASE_HEADERS, 'Next-Action': actionHeaders.getProviderList },
                body: '[]',
                signal: AbortSignal.timeout(5000)
            });
            if (!providersRes.ok) {
                return { success: false, source: this.key, error: 'Provider list fetch failed' };
            }
            const providersText = await providersRes.text();
            const secondLine = providersText.split('\n')[1] || '';
            const colonIdx = secondLine.indexOf(':');
            if (colonIdx === -1) {
                return { success: false, source: this.key, error: 'Malformed provider list' };
            }
            const providerList: Array<{ id: string; name?: string }> = JSON.parse(secondLine.slice(colonIdx + 1));
            if (!Array.isArray(providerList) || providerList.length === 0) {
                return { success: false, source: this.key, error: 'Empty provider list' };
            }

            const actionArgsBase = [
                id,
                type === 'tv' ? 'show' : 'movie',
                type === 'tv' ? sStr : '$undefined',
                type === 'tv' ? eStr : '$undefined',
                token
            ];

            const topProviders = providerList.slice(0, 3);
            const settled = await Promise.allSettled(
                topProviders.map(async (prov) => {
                    const streamRes = await this.fetchImpl(embedUrl, {
                        method: 'POST',
                        headers: { ...BASE_HEADERS, 'Next-Action': actionHeaders.getStream },
                        body: JSON.stringify([...actionArgsBase, prov.id]),
                        signal: AbortSignal.timeout(6000)
                    });
                    if (!streamRes.ok) return null;
                    const encryptedText = await streamRes.text();
                    const decRes = await this.fetchImpl(`${ENC_API}/dec-cinesrc`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
                        body: JSON.stringify({ text: encryptedText, state }),
                        signal: AbortSignal.timeout(4500)
                    });
                    if (!decRes.ok) return null;
                    const decJson = await decRes.json();
                    if (decJson?.status !== 200 || !Array.isArray(decJson?.result?.url)) return null;

                    const items: NonNullable<StreamResult['sources']> = [];
                    for (const u of decJson.result.url) {
                        const raw = String(u?.url || '').trim();
                        if (!raw) continue;
                        const absUrl = raw.startsWith('/') ? `${CINESRC_BASE}${raw}` : raw;
                        if (!/^https?:\/\//i.test(absUrl)) continue;
                        const streamType = absUrl.toLowerCase().includes('.mp4') ? 'mp4' : 'hls';
                        const provLabel = prov.name || prov.id;
                        items.push({
                            name: `${this.label} · ${provLabel}`,
                            url: `/api/proxy?url=${encodeURIComponent(absUrl)}&referer=${encodeURIComponent(`${CINESRC_BASE}/`)}&origin=${encodeURIComponent(CINESRC_BASE)}`,
                            quality: u?.source === 'HLS' ? '1080p Auto' : String(u?.source || '1080p'),
                            type: streamType
                        });
                    }
                    return items.length > 0 ? items : null;
                })
            );

            const allSources: NonNullable<StreamResult['sources']> = [];
            const seenUrls = new Set<string>();
            for (const item of settled) {
                if (item.status === 'fulfilled' && item.value) {
                    for (const src of item.value) {
                        if (!seenUrls.has(src.url)) {
                            seenUrls.add(src.url);
                            allSources.push(src);
                        }
                    }
                }
            }

            if (allSources.length === 0) {
                return { success: false, source: this.key, error: 'No playable streams found' };
            }

            return {
                success: true,
                source: this.key,
                url: allSources[0].url,
                type: (allSources[0].type as 'hls' | 'mp4') || 'hls',
                sources: allSources
            };
        } catch (err: any) {
            return { success: false, source: this.key, error: err?.message || 'CineSrc resolution failed' };
        }
    }
}
