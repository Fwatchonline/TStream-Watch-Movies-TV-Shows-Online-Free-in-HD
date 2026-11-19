import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import app from '../../server/app';
import { safeFetchStream, ProxySecurityError } from '../../server/utils/safeProxyFetch';

async function runSecurityTests() {
  console.log('--- Running TStream Application Security Test Suite ---');

  // 1. Secret absence in frontend source & .env.example
  const srcRoot = path.resolve(process.cwd(), 'src');
  const checkNoClientTmdbSecret = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'server') continue;
        checkNoClientTmdbSecret(full);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        assert.ok(
          !text.includes('VITE_TMDB_API_KEY'),
          `Frontend file ${full} must never reference VITE_TMDB_API_KEY`
        );
      }
    }
  };
  checkNoClientTmdbSecret(srcRoot);
  console.log('PASS: Zero client-side TMDB secret references in src/');

  // 2. SSRF protection rejects private, loopback, metadata, non-HTTP schemes, and credentialed URLs
  const blockedUrls = [
    'http://127.0.0.1/admin',
    'http://localhost:3000/api/tmdb',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/internal',
    'http://192.168.1.1/router',
    'file:///etc/passwd',
    'http://user:pass@example.com/stream.m3u8'
  ];
  for (const target of blockedUrls) {
    let blocked = false;
    try {
      await safeFetchStream(target, {});
    } catch (err) {
      if (err instanceof ProxySecurityError) {
        blocked = true;
      }
    }
    assert.ok(blocked, `SSRF filter failed to block ${target}`);
  }
  console.log('PASS: safeFetchStream blocks all private/loopback/metadata/scheme SSRF targets');

  // 3. API proxy SSRF enforcement returns HTTP 403
  const proxyRes = await app.request('/api/proxy?url=' + encodeURIComponent('http://127.0.0.1:8080/secret'));
  assert.equal(proxyRes.status, 403);
  const subProxyRes = await app.request('/api/subtitle-proxy?url=' + encodeURIComponent('http://169.254.169.254/meta'));
  assert.equal(subProxyRes.status, 403);
  console.log('PASS: /api/proxy & /api/subtitle-proxy reject SSRF requests with HTTP 403');

  // 4. TMDB proxy blocks unauthorized private endpoints and untrusted CORS origins
  const tmdbAcct = await app.request('/api/tmdb/account');
  assert.equal(tmdbAcct.status, 400);
  const tmdbTraversal = await app.request('/api/tmdb/../account');
  assert.ok([400, 403, 404].includes(tmdbTraversal.status));
  const corsBlocked = await app.request('/api/tmdb/discover/movie', {
    headers: { Origin: 'https://evil-attacker.example' }
  });
  assert.equal(corsBlocked.status, 403);
  console.log('PASS: TMDB proxy allowlist and CORS origin enforcement active');

  // 5. firestore.rules prohibits open write on systemSettings & reports
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(!/match \/systemSettings[\s\S]*allow write:\s*if true/.test(rulesText), 'systemSettings write must be protected');
  assert.ok(!/match \/reports[\s\S]*allow read,\s*update,\s*delete:\s*if true/.test(rulesText), 'reports management must require admin');
  console.log('PASS: Firestore rules enforce admin-only systemSettings writes & report management');

  // 6. Client Firestore queries enforce where('userId', '==', userId) & UserPreferenceDoc wrapper
  const watchHistorySrc = fs.readFileSync(path.resolve(srcRoot, 'services', 'watchHistory.ts'), 'utf8');
  const firebaseSrc = fs.readFileSync(path.resolve(srcRoot, 'services', 'firebase.ts'), 'utf8');
  const playerSettingsSrc = fs.readFileSync(path.resolve(srcRoot, 'services', 'playerSettings.ts'), 'utf8');
  const recSrc = fs.readFileSync(path.resolve(srcRoot, 'services', 'recommendationEngine.ts'), 'utf8');

  assert.ok(watchHistorySrc.includes("where('userId', '==', userId)"), 'watchHistory.ts must constrain subcollection list queries with where(userId)');
  assert.ok(firebaseSrc.includes("where('userId', '==', userId)"), 'firebase.ts must constrain subcollection list queries with where(userId)');
  assert.ok(playerSettingsSrc.includes("prefId: 'player'") && playerSettingsSrc.includes('data: merged'), 'playerSettings.ts must wrap preferences/player doc per UserPreferenceDoc schema');
  assert.ok(recSrc.includes("prefId: 'recommendations'"), 'recommendationEngine.ts must wrap preferences/recommendations doc per UserPreferenceDoc schema');
  console.log('PASS: Firestore subcollection queries & preference payloads strictly match firestore.rules');

  console.log('--- ALL APPLICATION SECURITY TESTS PASSED ---');
}

runSecurityTests().catch((err) => {
  console.error('Security test failure:', err);
  process.exit(1);
});
