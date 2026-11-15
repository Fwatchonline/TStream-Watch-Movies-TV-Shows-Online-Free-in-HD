const PROXIED_IMAGE_HOSTS = new Set([
  'images.metahub.space',
  'live.metahub.space',
  'episodes.metahub.space'
]);

export function buildImageProxyUrl(rawUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
}

export function isProxiedImagePath(url?: string | null): boolean {
  return Boolean(url && url.startsWith('/api/image-proxy?'));
}

export function unwrapImageProxyUrl(url?: string | null): string {
  if (!url) return '';
  if (!isProxiedImagePath(url)) return url;
  try {
    const parsed = new URL(url, 'https://tstream.online');
    return parsed.searchParams.get('url') || url;
  } catch {
    return url;
  }
}

export function shouldProactivelyProxyImage(url?: string | null): boolean {
  if (!url || typeof window === 'undefined') return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try {
    const parsed = new URL(url);
    return PROXIED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Resolves an image URL for browser rendering.
 * Hosts known to issue cross-origin 307 redirects (metahub.space) are routed
 * cleanly through the same-origin /api/image-proxy in the browser, while SSR
 * keeps original HTTPS URLs for SEO/OpenGraph metadata.
 */
export function resolveSafeImageSrc(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isProxiedImagePath(trimmed)) return trimmed;
  if (shouldProactivelyProxyImage(trimmed)) {
    return buildImageProxyUrl(trimmed);
  }
  return trimmed;
}
