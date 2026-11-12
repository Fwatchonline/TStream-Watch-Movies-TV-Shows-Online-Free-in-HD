import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Loads environment variables from `.env` in `cwd` (e.g. symlinked `$APP_DIR/shared/.env`)
 * BEFORE build, sitemap, or prerender scripts read `process.env`.
 *
 * - Never overwrites variables already present in `process.env` (CI secrets take precedence).
 * - Never logs secret values.
 */
export function loadBuildEnv(cwd = process.cwd(), options = {}) {
  const { override = false } = options;
  const resolvedCwd = path.resolve(cwd);
  const envPath = path.join(resolvedCwd, '.env');

  if (!fs.existsSync(envPath)) {
    return { loaded: false, envPath, keysLoaded: [] };
  }

  const beforeKeys = new Set(Object.keys(process.env));
  const result = dotenv.config({
    path: envPath,
    override,
    quiet: true
  });

  if (result.error) {
    throw new Error(`Failed loading environment file (${envPath}): ${result.error.message}`);
  }

  const parsedKeys = result.parsed ? Object.keys(result.parsed) : [];
  const appliedKeys = parsedKeys.filter(k => override || !beforeKeys.has(k));

  return {
    loaded: true,
    envPath,
    keysLoaded: appliedKeys
  };
}
