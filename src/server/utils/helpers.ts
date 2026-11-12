export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url}`);
    }
    return res.json() as Promise<T>;
}

export function getTmdbApiKey(): string {
    return (process.env.TMDB_API_KEY || '').trim();
}
