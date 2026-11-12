const fs = require('node:fs');
const path = require('node:path');

const appDir = (process.env.APP_DIR || process.env.TSTREAM_APP_DIR || '').trim();
const pm2AppName = (process.env.PM2_APP_NAME || process.env.TSTREAM_PM2_APP_NAME || '').trim();

if (!appDir) {
  throw new Error('ecosystem.config.cjs requires APP_DIR (or TSTREAM_APP_DIR) to be explicitly set.');
}
if (!pm2AppName) {
  throw new Error('ecosystem.config.cjs requires PM2_APP_NAME (or TSTREAM_PM2_APP_NAME) to be explicitly set.');
}

const currentDir = path.join(appDir, 'current');
const scriptPath = path.join(currentDir, 'dist', 'server.mjs');
const nodeBin = (process.env.NODE_BIN || 'node').trim();

let commitSha = (process.env.APP_COMMIT_SHA || '').trim();
if (!commitSha) {
  const releaseCommitFile = path.join(currentDir, '.release-commit');
  try {
    if (fs.existsSync(releaseCommitFile)) {
      commitSha = fs.readFileSync(releaseCommitFile, 'utf8').trim();
    }
  } catch {
    // ignore read failure
  }
}

module.exports = {
  apps: [
    {
      name: pm2AppName,
      script: scriptPath,
      cwd: currentDir,
      interpreter: nodeBin,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '900M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3000',
        HOST: process.env.HOST || '0.0.0.0',
        APP_DIR: appDir,
        ...(commitSha ? { APP_COMMIT_SHA: commitSha } : {})
      }
    }
  ]
};
