/**
 * Utility for SEO and clean URL slugs
 * Supports movie and tv URLs like:
 *   /watch/movie/spider-man-no-way-home-969681
 *   /movie/spider-man-no-way-home-969681
 *   /watch/tv/game-of-thrones-1399/1/1
 *   /tv/game-of-thrones-1399
 */

/**
 * Converts any title/name string into a clean URL-friendly slug
 */
export function slugifyTitle(title: string): string {
  if (!title) return 'stream';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')     // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
    .slice(0, 80) || 'media';
}

/**
 * Creates slug combining title and numeric ID
 * e.g. "Spider-Man: No Way Home", 969681 -> "spider-man-no-way-home-969681"
 */
export function createMediaSlug(title: string | undefined | null, id: number | string): string {
  const cleanId = String(id).trim();
  const baseSlug = slugifyTitle(title || '');
  return `${baseSlug}-${cleanId}`;
}

/**
 * Parses a slug param or raw ID from URL
 * Accepts:
 *   - "spider-man-no-way-home-969681" -> { id: 969681, slug: "spider-man-no-way-home" }
 *   - "movie name 969681" -> { id: 969681, slug: "movie-name" }
 *   - "969681" -> { id: 969681, slug: "" }
 */
export function parseMediaSlug(param: string): { id: number; slug: string } | null {
  if (!param) return null;
  const decoded = decodeURIComponent(param).trim();

  // If it's purely digits
  if (/^\d+$/.test(decoded)) {
    return { id: parseInt(decoded, 10), slug: '' };
  }

  // Look for trailing numeric ID e.g. "title-12345" or "title 12345"
  const matchTrailing = decoded.match(/(?:[-_ ]|^)(\d+)$/);
  if (matchTrailing && matchTrailing[1]) {
    const id = parseInt(matchTrailing[1], 10);
    const slug = decoded.slice(0, matchTrailing.index).trim();
    return { id, slug };
  }

  // Fallback: look for any continuous sequence of digits
  const anyDigits = decoded.match(/\b\d+\b/);
  if (anyDigits) {
    const id = parseInt(anyDigits[0], 10);
    return { id, slug: decoded };
  }

  return null;
}
