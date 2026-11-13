/**
 * Canonical Tag Slug & Normalization Utility for TStream.online
 * Shared cleanly between React frontend, SEO helpers, prerender engine, and XML sitemap generator.
 */

import { POPULAR_TAGS } from '../services/catalogData.ts';

const POPULAR_TAG_SLUG_TO_NAME = new Map<string, string>();
const POPULAR_TAG_NAME_TO_SLUG = new Map<string, string>();

for (const tag of POPULAR_TAGS) {
  if (!tag?.name) continue;
  const normalizedName = tag.name.toLowerCase().trim().replace(/\s+/g, ' ');
  const slug = normalizedName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (normalizedName && slug) {
    POPULAR_TAG_SLUG_TO_NAME.set(slug, normalizedName);
    POPULAR_TAG_NAME_TO_SLUG.set(normalizedName, slug);
  }
}

function safeDecode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

/**
 * Normalizes raw user/URL tag input into a clean human-readable keyword phrase
 * suitable for TMDB keyword queries (e.g. "Time Travel", "time-travel", "time%20travel" -> "time travel").
 */
export function normalizeTag(raw: string): string {
  if (!raw) return '';
  const decoded = safeDecode(raw).replace(/^#/, '').trim().toLowerCase();
  if (!decoded) return '';

  const directSlug = decoded
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const known = POPULAR_TAG_SLUG_TO_NAME.get(directSlug);
  if (known) return known;

  return decoded.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converts any raw tag phrase or slug into its authoritative lowercase kebab-case URL slug
 * (e.g. "based on novel or book" -> "based-on-novel-or-book", "time travel" -> "time-travel").
 */
export function tagToSlug(raw: string): string {
  if (!raw) return '';
  const decoded = safeDecode(raw).replace(/^#/, '').trim().toLowerCase();
  if (!decoded) return '';

  const normalizedSpaces = decoded.replace(/\s+/g, ' ');
  const knownSlug = POPULAR_TAG_NAME_TO_SLUG.get(normalizedSpaces);
  if (knownSlug) return knownSlug;

  return decoded
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/**
 * Converts a canonical URL slug back to the canonical keyword query string
 * expected by TMDB keyword search and local catalog matching.
 */
export function slugToTag(rawSlugOrTag: string): string {
  if (!rawSlugOrTag) return '';
  const slug = tagToSlug(rawSlugOrTag);
  if (!slug) return '';
  const known = POPULAR_TAG_SLUG_TO_NAME.get(slug);
  if (known) return known;
  return normalizeTag(slug);
}

/**
 * Validates raw tag segment or slug syntax (rejecting control characters, HTML injection,
 * empty slugs, path traversal, or overly long strings).
 */
export function isValidTagSlug(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return false;
  }
  const trimmed = decoded.trim().replace(/^#/, '');
  if (!trimmed || trimmed.length > 60) return false;
  if (/[<>"{}\\/`]/.test(trimmed) || trimmed.includes('..')) return false;
  const slug = tagToSlug(trimmed);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 60;
}

/**
 * Builds the canonical HTTPS non-www tag landing URL using kebab-case slugification.
 */
export function getCanonicalTagUrl(rawTagOrSlug: string, page?: number): string {
  const slug = tagToSlug(rawTagOrSlug);
  const base = slug ? `https://tstream.online/tags/${slug}` : 'https://tstream.online/tags';
  if (page && Number.isInteger(page) && page > 1) {
    return `${base}?page=${page}`;
  }
  return base;
}

export function isPopularTag(rawTagOrSlug: string): boolean {
  const slug = tagToSlug(rawTagOrSlug);
  return Boolean(slug && POPULAR_TAG_SLUG_TO_NAME.has(slug));
}
