/**
 * Proxy sitemap generator calling the typed TypeScript sitemap generator.
 * Eliminates broad regex parsing issues and validates all sitemaps.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'generate-sitemaps.ts');
const args = process.argv.slice(2);

const result = spawnSync('npx', ['tsx', scriptPath, ...args], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

