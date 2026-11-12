#!/usr/bin/env node
/**
 * Single-Authoritative Production Build Orchestrator for TStream.online
 *
 * Enforces `dist/` as the sole build output directory, rejects injected external flags
 * such as `--outDir dist-next`, builds sitemaps, Vite frontend, prerendered HTML +
 * `dist/prerender-report.json`, and `dist/server.mjs`, and verifies all required artifacts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function validateBuildArgs(args = process.argv.slice(2)) {
  const joined = args.join(' ');
  if (
    args.some(a => a === '--outDir' || a.startsWith('--outDir=') || a === '--outdir' || a.startsWith('--outdir=')) ||
    joined.includes('dist-next')
  ) {
    throw new Error(
      `Forbidden extra build argument detected (${joined}). TStream requires a single authoritative dist/ output directory.`
    );
  }
}

export function verifyDistArtifacts(rootDir = process.cwd()) {
  const distDir = path.resolve(rootDir, 'dist');
  const requiredFiles = [
    'index.html',
    'server.mjs',
    'robots.txt',
    'sitemap.xml',
    'sitemap-main.xml',
    'sitemap-movies.xml',
    'sitemap-tv.xml',
    'prerender-report.json'
  ];

  for (const rel of requiredFiles) {
    const filePath = path.join(distDir, rel);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required build artifact missing: dist/${rel}`);
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) {
      throw new Error(`Required build artifact is empty: dist/${rel}`);
    }
  }

  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir) || !fs.statSync(assetsDir).isDirectory()) {
    throw new Error('Required build directory missing: dist/assets/');
  }
  const assets = fs.readdirSync(assetsDir);
  if (assets.length === 0) {
    throw new Error('Required build directory dist/assets/ is empty');
  }

  return {
    distDir,
    files: requiredFiles,
    assetCount: assets.length
  };
}

function runCommand(bin, args, cwd) {
  execFileSync(bin, args, {
    cwd,
    stdio: 'inherit',
    env: process.env
  });
}

export function runProductionBuild(rootDir = process.cwd(), extraArgs = process.argv.slice(2)) {
  validateBuildArgs(extraArgs);

  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const esbuildLocal = path.resolve(rootDir, 'node_modules/.bin/esbuild');
  const viteLocal = path.resolve(rootDir, 'node_modules/.bin/vite');
  const tsxLocal = path.resolve(rootDir, 'node_modules/.bin/tsx');

  const execStep = (localBin, fallbackTool, args) => {
    if (fs.existsSync(localBin)) {
      runCommand(localBin, args, rootDir);
    } else {
      runCommand(npxBin, ['--no-install', fallbackTool, ...args], rootDir);
    }
  };

  console.log('[Build 1/4] Generating XML sitemaps...');
  execStep(tsxLocal, 'tsx', ['scripts/generate-sitemaps.ts']);

  console.log('[Build 2/4] Building Vite client bundle into dist/...');
  execStep(viteLocal, 'vite', ['build']);

  console.log('[Build 3/4] Prerendering & validating static HTML routes into dist/...');
  execStep(tsxLocal, 'tsx', ['scripts/prerender.ts']);

  console.log('[Build 4/4] Bundling Node.js server into dist/server.mjs...');
  execStep(esbuildLocal, 'esbuild', [
    'server.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--packages=external',
    '--outfile=dist/server.mjs'
  ]);

  const summary = verifyDistArtifacts(rootDir);
  console.log(
    `[Build Complete] Authoritative dist/ verified (${summary.files.length} root artifacts, ${summary.assetCount} asset files).`
  );
  return summary;
}

const isMain = Boolean(
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
);

if (isMain) {
  try {
    runProductionBuild();
  } catch (err) {
    console.error(`[Build Error] ${err?.message || err}`);
    process.exit(1);
  }
}
