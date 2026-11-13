/**
 * Phase 4 Task 2 Deployment Safety & Rollback Regression Tests
 *
 * Tests `ecosystem.config.cjs` validation and runs `scripts/update-vps.sh` inside
 * isolated temp directories with mocked `git`, `pm2`, `curl`, `npm`, and `nginx`
 * shims on `PATH` (never touching real VPS processes or live Nginx).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

function makeExecutable(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o755 });
}

interface DeploySandbox {
  root: string;
  appDir: string;
  binDir: string;
  stateDir: string;
  repoDir: string;
  nodeBin: string;
  commitA: string;
  commitB: string;
  prevReleaseDir: string;
}

function setupDeploySandbox(): DeploySandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tstream-deploy-test-'));
  const appDir = path.join(root, 'app');
  const binDir = path.join(root, 'bin');
  const stateDir = path.join(root, 'state');
  const repoDir = path.join(appDir, 'repo');
  const releasesDir = path.join(appDir, 'releases');
  const sharedDir = path.join(appDir, 'shared');
  const prevReleaseDir = path.join(releasesDir, '20261101-000000');

  fs.mkdirSync(repoDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  fs.mkdirSync(sharedDir, { recursive: true });
  fs.mkdirSync(path.join(prevReleaseDir, 'dist'), { recursive: true });

  fs.writeFileSync(path.join(sharedDir, '.env'), 'TMDB_API_KEY=SANDBOX_FAKE_KEY\n', 'utf8');

  // Create fake local git repo with 2 commits containing minimal release files + ecosystem.config.cjs + verify stub
  const initRepoFile = (rel: string, content: string) => {
    const full = path.join(repoDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  };

  execFileSync('git', ['init', '-b', 'main'], { cwd: repoDir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'ci@tstream.online'], { cwd: repoDir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'CI'], { cwd: repoDir, stdio: 'pipe' });

  initRepoFile('README.md', '# sandbox v1');
  initRepoFile('ecosystem.config.cjs', fs.readFileSync(path.resolve(process.cwd(), 'ecosystem.config.cjs'), 'utf8'));
  initRepoFile('scripts/verify-production.ts', 'console.log("ok"); process.exit(0);');
  execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'release A'], { cwd: repoDir, stdio: 'pipe' });
  const commitA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();

  initRepoFile('README.md', '# sandbox v2');
  execFileSync('git', ['add', '.'], { cwd: repoDir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'release B'], { cwd: repoDir, stdio: 'pipe' });
  const commitB = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();

  // Seed previous active release
  fs.writeFileSync(path.join(prevReleaseDir, '.release-commit'), `${commitA}\n`, 'utf8');
  fs.writeFileSync(path.join(prevReleaseDir, 'dist', 'server.mjs'), 'console.log("prev");', 'utf8');
  fs.writeFileSync(path.join(prevReleaseDir, 'ecosystem.config.cjs'), fs.readFileSync(path.resolve(process.cwd(), 'ecosystem.config.cjs'), 'utf8'), 'utf8');
  fs.symlinkSync(prevReleaseDir, path.join(appDir, 'current'));

  // Mock command shims
  // 1) git wrapper that ignores remote fetch when origin is absent, forwarding other subcommands to real git
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  makeExecutable(
    path.join(binDir, 'git'),
    `#!/usr/bin/env bash
if [ "$1" = "-C" ] && [ "$3" = "fetch" ]; then
  exit 0
fi
exec "${realGit}" "$@"
`
  );

  // 2) npm shim writing dist artifacts into CWD
  makeExecutable(
    path.join(binDir, 'npm'),
    `#!/usr/bin/env bash
set -e
cmd="\${1:-}"
sub="\${2:-}"
echo "$cmd $sub" >> "${stateDir}/npm.log"
if [ "$cmd" = "build" ] || [ "$sub" = "build" ]; then
  mkdir -p dist/assets
  echo "<html></html>" > dist/index.html
  echo "console.log('server');" > dist/server.mjs
  echo "User-agent: *" > dist/robots.txt
  echo "<sitemapindex></sitemapindex>" > dist/sitemap.xml
  echo "<urlset></urlset>" > dist/sitemap-main.xml
  echo "<urlset></urlset>" > dist/sitemap-movies.xml
  echo "<urlset></urlset>" > dist/sitemap-tv.xml
  echo "{}" > dist/prerender-report.json
fi
exit 0
`
  );

  // 3) npx shim consulting $SANDBOX_FAIL_VERIFY flag
  makeExecutable(
    path.join(binDir, 'npx'),
    `#!/usr/bin/env bash
echo "$*" >> "${stateDir}/npx.log"
if [ "\${SANDBOX_FAIL_VERIFY:-0}" = "1" ]; then
  echo "Simulated SEO verification failure" >&2
  exit 1
fi
exit 0
`
  );

  // 4) pm2 stateful shim tracking jlist, start/reload/delete/save actions cleanly
  makeExecutable(
    path.join(binDir, 'pm2'),
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const stateFile = path.join("${stateDir}", "pm2-state.json");
const actionsFile = path.join("${stateDir}", "pm2-actions.log");
const args = process.argv.slice(2);
const cmd = args[0] || "";
fs.appendFileSync(actionsFile, args.join(" ") + "\\n");

let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : { proc: null };

if (cmd === "describe") {
  process.exit(state.proc && state.proc.name === args[1] ? 0 : 1);
}
if (cmd === "jlist") {
  console.log(JSON.stringify(state.proc ? [state.proc] : []));
  process.exit(0);
}
if (cmd === "delete") {
  if (state.proc && state.proc.name === args[1]) state.proc = null;
  fs.writeFileSync(stateFile, JSON.stringify(state));
  process.exit(0);
}
if (cmd === "start" || cmd === "reload") {
  const ecoPath = args[1];
  const cfg = require(path.resolve(ecoPath));
  const app = cfg.apps[0];
  state.proc = {
    name: app.name,
    pm2_env: {
      status: "online",
      pm_cwd: app.cwd,
      pm_exec_path: app.script,
      APP_COMMIT_SHA: app.env.APP_COMMIT_SHA || ""
    }
  };
  fs.writeFileSync(stateFile, JSON.stringify(state));
  process.exit(0);
}
if (cmd === "save") {
  const activeSha = state.proc?.pm2_env?.APP_COMMIT_SHA || "";
  fs.appendFileSync(actionsFile, "SAVE_AT_SHA:" + activeSha + "\\n");
  process.exit(0);
}
if (cmd === "logs") {
  console.log("mock pm2 logs");
  process.exit(0);
}
process.exit(0);
`
  );

  // 5) curl shim returning current PM2 commit SHA (or forced mismatch when $SANDBOX_STALE_HEALTH_SHA is set)
  makeExecutable(
    path.join(binDir, 'curl'),
    `#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
if (process.env.SANDBOX_STALE_HEALTH_SHA) {
  console.log(JSON.stringify({ status: "ok", commitSha: process.env.SANDBOX_STALE_HEALTH_SHA }));
  process.exit(0);
}
const stateFile = path.join("${stateDir}", "pm2-state.json");
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
const sha = state.proc?.pm2_env?.APP_COMMIT_SHA || "";
console.log(JSON.stringify({ status: "ok", service: "tstream-production", version: sha, commitSha: sha }));
`
  );

  // 6) df shim guaranteeing >= 1GB free disk in sandbox
  makeExecutable(
    path.join(binDir, 'df'),
    `#!/usr/bin/env bash
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
echo "/dev/mock 20971520 1048576 19922944 5% /"
`
  );

  // 7) Node >= 24.12.0 sandbox shim when container host runs Node < 24.12.0
  const [nMaj, nMin] = process.versions.node.split('.').map(Number);
  let nodeBin = process.execPath;
  if (nMaj < 24 || (nMaj === 24 && nMin < 12)) {
    const preloadPath = path.join(stateDir, 'node24-preload.cjs');
    fs.writeFileSync(
      preloadPath,
      'Object.defineProperty(process.versions, "node", { value: "24.12.0", configurable: true });\n',
      'utf8'
    );
    nodeBin = path.join(binDir, 'node-24');
    makeExecutable(
      nodeBin,
      `#!/usr/bin/env bash\nexec "${process.execPath}" --require "${preloadPath}" "$@"\n`
    );
  }

  return { root, appDir, binDir, stateDir, repoDir, nodeBin, commitA, commitB, prevReleaseDir };
}

async function runTests() {
  console.log('--- Running Phase 4 Task 2 Deployment & Rollback Safety Tests ---\n');

  // 1. ecosystem.config.cjs rejects missing APP_DIR or PM2_APP_NAME rather than guessing
  const prevAppDir = process.env.APP_DIR;
  const prevTAppDir = process.env.TSTREAM_APP_DIR;
  const prevPm2Name = process.env.PM2_APP_NAME;
  const prevTPm2Name = process.env.TSTREAM_PM2_APP_NAME;
  delete process.env.APP_DIR;
  delete process.env.TSTREAM_APP_DIR;
  delete process.env.PM2_APP_NAME;
  delete process.env.TSTREAM_PM2_APP_NAME;

  const ecoPath = path.resolve(process.cwd(), 'ecosystem.config.cjs');
  delete require.cache[ecoPath];
  let threwMissingEco = false;
  try {
    require(ecoPath);
  } catch {
    threwMissingEco = true;
  }
  assert(threwMissingEco, 'ecosystem.config.cjs throws explicitly when APP_DIR/PM2_APP_NAME missing');

  process.env.APP_DIR = '/opt/verified-tstream';
  process.env.PM2_APP_NAME = 'tstream-prod';
  process.env.APP_COMMIT_SHA = 'deadbeef1234';
  delete require.cache[ecoPath];
  const ecoCfg = require(ecoPath);
  assert(
    ecoCfg.apps[0].name === 'tstream-prod' &&
      ecoCfg.apps[0].script === '/opt/verified-tstream/current/dist/server.mjs' &&
      ecoCfg.apps[0].cwd === '/opt/verified-tstream/current' &&
      ecoCfg.apps[0].env.APP_COMMIT_SHA === 'deadbeef1234',
    'ecosystem.config.cjs binds script to <APP_DIR>/current/dist/server.mjs with explicit SHA'
  );
  delete process.env.APP_COMMIT_SHA;
  if (prevAppDir !== undefined) process.env.APP_DIR = prevAppDir; else delete process.env.APP_DIR;
  if (prevTAppDir !== undefined) process.env.TSTREAM_APP_DIR = prevTAppDir; else delete process.env.TSTREAM_APP_DIR;
  if (prevPm2Name !== undefined) process.env.PM2_APP_NAME = prevPm2Name; else delete process.env.PM2_APP_NAME;
  if (prevTPm2Name !== undefined) process.env.TSTREAM_PM2_APP_NAME = prevTPm2Name; else delete process.env.TSTREAM_PM2_APP_NAME;

  const scriptPath = path.resolve(process.cwd(), 'scripts/update-vps.sh');

  // 2. Ownership validation test INCLUDING empty PREV_RELEASE="" edge case!
  {
    const sb = setupDeploySandbox();
    // Remove current symlink so PREV_RELEASE="" (previously caused `"$PREV_RELEASE"*` == `"*"` bug!)
    fs.unlinkSync(path.join(sb.appDir, 'current'));
    fs.writeFileSync(
      path.join(sb.stateDir, 'pm2-state.json'),
      JSON.stringify({
        proc: {
          name: 'tstream-app',
          pm2_env: {
            status: 'online',
            pm_cwd: '/var/www/unrelated-other-site',
            pm_exec_path: '/var/www/unrelated-other-site/server.js'
          }
        }
      }),
      'utf8'
    );

    const oldNodeBin = path.join(sb.binDir, 'node-legacy');
    makeExecutable(
      oldNodeBin,
      `#!/usr/bin/env bash\nexec "${process.execPath}" -e 'Object.defineProperty(process.versions, "node", { value: "22.23.2", configurable: true });' -- "$@"\n`
    );
    // Test rejection when Node < 24.12.0 before testing ownership validation
    const legacyNodeRes = spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        PATH: `${sb.binDir}:${process.env.PATH}`,
        APP_DIR: sb.appDir,
        PM2_APP_NAME: 'tstream-app',
        DEPLOY_REF: sb.commitB,
        SKIP_NGINX_CHECK: '1',
        NODE_BIN: process.versions.node.startsWith('22.') ? process.execPath : oldNodeBin
      },
      encoding: 'utf8'
    });
    assert(
      legacyNodeRes.status !== 0 &&
        (legacyNodeRes.stderr + legacyNodeRes.stdout).includes('Required >= 24.12.0'),
      'Task 2: update-vps.sh strictly rejects Node.js < 24.12.0'
    );

    const runRes = spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        PATH: `${sb.binDir}:${process.env.PATH}`,
        APP_DIR: sb.appDir,
        PM2_APP_NAME: 'tstream-app',
        DEPLOY_REF: sb.commitB,
        SKIP_NGINX_CHECK: '1',
        NODE_BIN: sb.nodeBin
      },
      encoding: 'utf8'
    });
    const actionsLog = fs.readFileSync(path.join(sb.stateDir, 'pm2-actions.log'), 'utf8');
    fs.rmSync(sb.root, { recursive: true, force: true });

    assert(
      runRes.status !== 0 &&
        !actionsLog.includes('delete') &&
        !actionsLog.includes('reload') &&
        !actionsLog.includes('start '),
      'Task 2: update-vps.sh rejects unrelated PM2 process even when PREV_RELEASE is empty without modifying PM2'
    );
  }

  // 3. Full successful deploy + pm2 save AFTER verification + keeps immediate rollback target safe from pruning
  {
    const sb = setupDeploySandbox();
    // Seed 5 extra old releases so total > 5 triggers pruning while PREV_RELEASE stays protected
    for (let i = 1; i <= 5; i++) {
      const oldDir = path.join(sb.appDir, 'releases', `2026100${i}-000000`);
      fs.mkdirSync(oldDir, { recursive: true });
      const pastTime = new Date(Date.now() - i * 86400_000);
      fs.utimesSync(oldDir, pastTime, pastTime);
    }
    // Make PREV_RELEASE look oldest in mtime so we prove explicit rollback protection preserves it even if older!
    const ancient = new Date(Date.now() - 30 * 86400_000);
    fs.utimesSync(sb.prevReleaseDir, ancient, ancient);

    // Seed matching active PM2 process inside prevReleaseDir
    fs.writeFileSync(
      path.join(sb.stateDir, 'pm2-state.json'),
      JSON.stringify({
        proc: {
          name: 'tstream-app',
          pm2_env: {
            status: 'online',
            pm_cwd: sb.appDir + '/current',
            pm_exec_path: sb.appDir + '/current/dist/server.mjs',
            APP_COMMIT_SHA: sb.commitA
          }
        }
      }),
      'utf8'
    );

    const runRes = spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        PATH: `${sb.binDir}:${process.env.PATH}`,
        APP_DIR: sb.appDir,
        PM2_APP_NAME: 'tstream-app',
        DEPLOY_REF: sb.commitB,
        SKIP_NGINX_CHECK: '1',
        NODE_BIN: sb.nodeBin
      },
      encoding: 'utf8'
    });

    const actionsLog = fs.readFileSync(path.join(sb.stateDir, 'pm2-actions.log'), 'utf8');
    const npxLog = fs.readFileSync(path.join(sb.stateDir, 'npx.log'), 'utf8');
    const finalCurrent = fs.realpathSync(path.join(sb.appDir, 'current'));
    const prevStillExists = fs.existsSync(sb.prevReleaseDir);
    fs.rmSync(sb.root, { recursive: true, force: true });

    assert(
      runRes.status === 0 &&
        finalCurrent !== sb.prevReleaseDir &&
        npxLog.includes(`--expected-commit=${sb.commitB}`) &&
        actionsLog.includes(`SAVE_AT_SHA:${sb.commitB}`) &&
        prevStillExists,
      'Task 2: Successful release switches symlink, verifies health commitSha, runs pm2 save AFTER SEO verification, and spares rollback target from pruning'
    );
  }

  // 4. Stale /api/health commitSha triggers automatic rollback to previous release + previous SHA
  {
    const sb = setupDeploySandbox();
    fs.writeFileSync(
      path.join(sb.stateDir, 'pm2-state.json'),
      JSON.stringify({
        proc: {
          name: 'tstream-app',
          pm2_env: {
            status: 'online',
            pm_cwd: sb.appDir + '/current',
            pm_exec_path: sb.appDir + '/current/dist/server.mjs',
            APP_COMMIT_SHA: sb.commitA
          }
        }
      }),
      'utf8'
    );

    const runRes = spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        PATH: `${sb.binDir}:${process.env.PATH}`,
        APP_DIR: sb.appDir,
        PM2_APP_NAME: 'tstream-app',
        DEPLOY_REF: sb.commitB,
        SKIP_NGINX_CHECK: '1',
        SANDBOX_STALE_HEALTH_SHA: sb.commitA, // Simulate server still reporting previous SHA after reload!
        NODE_BIN: sb.nodeBin
      },
      encoding: 'utf8'
    });

    const restoredCurrent = fs.realpathSync(path.join(sb.appDir, 'current'));
    const expectedPrev = fs.realpathSync(sb.prevReleaseDir);
    const actionsLog = fs.readFileSync(path.join(sb.stateDir, 'pm2-actions.log'), 'utf8');
    fs.rmSync(sb.root, { recursive: true, force: true });

    assert(
      runRes.status !== 0 &&
        restoredCurrent === expectedPrev &&
        actionsLog.includes(`SAVE_AT_SHA:${sb.commitA}`),
      'Task 2: Health commitSha mismatch triggers automatic rollback to PREV_RELEASE and restores PREV_COMMIT_SHA'
    );
  }

  // 5. Failed verify-production.ts triggers automatic rollback
  {
    const sb = setupDeploySandbox();
    fs.writeFileSync(
      path.join(sb.stateDir, 'pm2-state.json'),
      JSON.stringify({
        proc: {
          name: 'tstream-app',
          pm2_env: {
            status: 'online',
            pm_cwd: sb.appDir + '/current',
            pm_exec_path: sb.appDir + '/current/dist/server.mjs',
            APP_COMMIT_SHA: sb.commitA
          }
        }
      }),
      'utf8'
    );

    const runRes = spawnSync('bash', [scriptPath], {
      env: {
        ...process.env,
        PATH: `${sb.binDir}:${process.env.PATH}`,
        APP_DIR: sb.appDir,
        PM2_APP_NAME: 'tstream-app',
        DEPLOY_REF: sb.commitB,
        SKIP_NGINX_CHECK: '1',
        SANDBOX_FAIL_VERIFY: '1',
        NODE_BIN: sb.nodeBin
      },
      encoding: 'utf8'
    });

    const restoredCurrent = fs.realpathSync(path.join(sb.appDir, 'current'));
    const expectedPrev = fs.realpathSync(sb.prevReleaseDir);
    fs.rmSync(sb.root, { recursive: true, force: true });

    assert(
      runRes.status !== 0 && restoredCurrent === expectedPrev,
      'Task 2: Failed SEO verification triggers automatic rollback restoring previous symlink target'
    );
  }

  console.log('\n--- ALL DEPLOYMENT SAFETY & ROLLBACK REGRESSION TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('Deploy test error:', err);
  process.exit(1);
});
