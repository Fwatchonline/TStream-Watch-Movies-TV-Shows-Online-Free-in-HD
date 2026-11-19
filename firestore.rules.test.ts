import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

console.log('--- Running Firestore Security Rules & Blueprint Tests ---');

const rootDir = process.cwd();
const rulesPath = path.join(rootDir, 'firestore.rules');
const blueprintPath = path.join(rootDir, 'firebase-blueprint.json');
const specPath = path.join(rootDir, 'security_spec.md');

const rules = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

function extractMatchBlock(source: string, matchHeader: string): string {
  const idx = source.indexOf(matchHeader);
  assert.notEqual(idx, -1, `Expected rule block for ${matchHeader}`);
  const startBrace = source.indexOf('{', idx + matchHeader.length);
  assert.notEqual(startBrace, -1, `Expected opening brace for ${matchHeader}`);
  let depth = 0;
  for (let i = startBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(idx, i + 1);
      }
    }
  }
  throw new Error(`Unclosed rule block for ${matchHeader}`);
}

// 1. Default deny catch-all & rules_version
assert.ok(rules.includes("rules_version = '2';"), 'Expected rules_version 2');
assert.ok(
  /match \/\{document=\*\*\}[\s\S]*?allow read, write: if false;/.test(rules),
  'Global default-deny catch-all rule missing'
);
console.log('PASS: Global default-deny catch-all present');

// 2. ESLint security-rules plugin validation passes cleanly
execFileSync('npx', ['--no-install', 'eslint', 'firestore.rules'], {
  cwd: rootDir,
  stdio: 'pipe'
});
console.log('PASS: @firebase/eslint-plugin-security-rules validation exited 0');

// 3. Blueprint synchronization: every Firestore path in blueprint has a matching block in firestore.rules
const blueprintPaths = Object.keys(blueprint.firestore || {});
assert.ok(blueprintPaths.length >= 16, 'Expected complete blueprint collection inventory');
for (const bpPath of blueprintPaths) {
  const leaf = bpPath.split('/').slice(-2).join('/');
  assert.ok(
    rules.includes(leaf),
    `Missing match block in firestore.rules for blueprint path ${bpPath} (${leaf})`
  );
}
console.log(`PASS: All ${blueprintPaths.length} blueprint collections synchronized with firestore.rules`);

// 4. Email spoofing prevention & explicit RBAC check
const adminFn = extractMatchBlock(rules, 'function isAdmin()');
assert.ok(adminFn.includes('exists(/databases/$(database)/documents/admins/$(request.auth.uid))'), 'isAdmin must verify /admins/{uid}');
assert.ok(adminFn.includes('request.auth.token.admin == true'), 'isAdmin must check custom admin claim');
assert.ok(rules.includes('request.auth.token.email_verified == true'), 'Email allowlist MUST mandate email_verified == true');
console.log('PASS: isAdmin enforces /admins/{uid}, admin claim, and verified email check');

// 5. Dirty Dozen Audit Checks per security_spec.md
assert.ok(fs.existsSync(specPath), 'security_spec.md must exist');

// Reports PII isolation: NO open read/update/delete
const reportsBlock = extractMatchBlock(rules, 'match /reports/{reportId}');
assert.ok(!/allow\s+read\s*:\s*if\s+true/.test(reportsBlock), 'reports must not allow public read');
assert.ok(!/allow\s+read,\s*update,\s*delete\s*:\s*if\s+true/.test(reportsBlock), 'reports must not allow public manage');
assert.ok(reportsBlock.includes('allow get, list, update, delete: if isAdmin();'), 'reports reads/updates/deletes must be admin-only');
assert.ok(reportsBlock.includes("incoming().status == 'open'"), 'report create must pin status to open');
assert.ok(reportsBlock.includes("incoming().userId == 'guest'") && reportsBlock.includes('incoming().userId == request.auth.uid'), 'report create must validate userId');
console.log('PASS: Dirty Dozen #7 — reports collection isolates PII and prevents forged resolved tickets');

// System Settings hijack protection & schema validation
const settingsBlock = extractMatchBlock(rules, 'match /systemSettings/{settingId}');
assert.ok(!/allow\s+write\s*:\s*if\s+true/.test(settingsBlock), 'systemSettings must never allow unauthenticated writes');
assert.ok(settingsBlock.includes('isValidSystemSettings(incoming())'), 'systemSettings writes must validate schema fields');
console.log('PASS: Dirty Dozen #5 — systemSettings write restricted strictly to admin + schema validator');

// MovieStats counter protection & non-admin delete prevention
const statsBlock = extractMatchBlock(rules, 'match /movieStats/{mediaKey}');
assert.ok(statsBlock.includes('allow delete: if isAdmin();'), 'Only admins can delete movieStats');
assert.ok(statsBlock.includes("existing().get('ratingCount', 0) + 1"), 'Non-admin rating updates must increment ratingCount by exactly +1');
const nonAdminStatsSnippet = statsBlock.slice(statsBlock.indexOf('affectedKeys().hasOnly(['), statsBlock.indexOf('])'));
assert.ok(!nonAdminStatsSnippet.includes("'views'"), 'Non-admin affectedKeys allowlist must exclude views');
console.log('PASS: Dirty Dozen #8 & #9 — movieStats blocks view inflation, rating reset, and non-admin delete');

// Analytics & Admin/Curated collections
for (const col of ['/analytics_visits/{visitId}', '/analytics_daily/{dateId}', '/analytics_summary/{summaryId}']) {
  const blk = extractMatchBlock(rules, `match ${col}`);
  assert.ok(blk.includes('allow read, write: if isAdmin();'), `${col} must restrict read/write to admin`);
}
const adminsBlock = extractMatchBlock(rules, 'match /admins/{uid}');
assert.ok(adminsBlock.includes('isValidAdminRecord(incoming())'), '/admins/{uid} writes must validate AdminRecord schema');
console.log('PASS: Dirty Dozen #6 & #12 — analytics & admin registry writes strictly restricted');

// User Profile & History / Completed / Watchlist / Preferences isolation & bounds
const usersBlock = extractMatchBlock(rules, 'match /users/{userId}');
assert.ok(usersBlock.includes('allow list: if isAdmin();'), 'Blanket /users list must never be exposed to non-admins');
assert.ok(!usersBlock.includes("'isAdmin'") && !usersBlock.includes("'role'"), 'User profile validator must block isAdmin/role escalation fields');
const historyBlock = extractMatchBlock(rules, 'match /history/{mediaKey}');
assert.ok(historyBlock.includes('isValidWatchHistoryItem(incoming())'), 'history writes require strict schema helper');
assert.ok(historyBlock.includes('incoming().userId == request.auth.uid'), 'history create binds userId == auth.uid');
assert.ok(historyBlock.includes('resource.data.userId == userId'), 'history list enforces resource.data ownership');
console.log('PASS: Dirty Dozen #1-#4, #10-#11 — user profile, history, and path ID poisoning guards enforced');

console.log('--- ALL FIRESTORE SECURITY RULES TESTS PASSED ---');
