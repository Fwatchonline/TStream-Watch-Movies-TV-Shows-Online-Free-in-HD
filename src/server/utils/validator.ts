import { USER_AGENT } from './helpers';
import { safeFetchStream } from './safeProxyFetch';

export async function validateSourceUrl(
    url: string,
    headers: Record<string, string> = {},
    fetchImpl?: typeof fetch
): Promise<boolean> {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('error') && !lowerUrl.includes('m3u8')) return false;

    const requestHeaders: Record<string, string> = {
        ...headers,
        'User-Agent': headers['User-Agent'] || USER_AGENT,
        'Range': 'bytes=0-1024'
    };

    if (fetchImpl) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);
            let res = await fetchImpl(url, {
                method: 'GET',
                headers: requestHeaders,
                signal: controller.signal
            });
            clearTimeout(timeout);

            if ((res.status === 503 || res.status === 416) && requestHeaders['Range']) {
                const retryController = new AbortController();
                const retryTimeout = setTimeout(() => retryController.abort(), 2500);
                const retryHeaders = { ...requestHeaders };
                delete retryHeaders['Range'];
                try {
                    res = await fetchImpl(url, {
                        method: 'GET',
                        headers: retryHeaders,
                        signal: retryController.signal
                    });
                } catch {}
                clearTimeout(retryTimeout);
            }

            if (!res.ok && res.status !== 206 && res.status !== 302) return false;
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html')) return false;
            return true;
        } catch {
            return false;
        }
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        let result = await safeFetchStream(url, requestHeaders, controller.signal, 'GET');
        clearTimeout(timeout);

        let status = result.response.statusCode || 502;
        if ((status === 503 || status === 416) && requestHeaders['Range']) {
            result.response.destroy();
            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), 2500);
            const retryHeaders = { ...requestHeaders };
            delete retryHeaders['Range'];
            try {
                result = await safeFetchStream(url, retryHeaders, retryController.signal, 'GET');
                status = result.response.statusCode || 502;
            } finally {
                clearTimeout(retryTimeout);
            }
        }

        const ct = String(result.response.headers['content-type'] || '').toLowerCase();
        result.response.destroy();

        if ((status < 200 || status >= 300) && status !== 302) return false;
        if (ct.includes('text/html')) return false;
        return true;
    } catch {
        return false;
    }
}
