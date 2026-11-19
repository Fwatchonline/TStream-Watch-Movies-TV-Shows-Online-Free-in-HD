# TStream.online — Security Specification & Threat Model

## 1. Repository Audit Findings (Baseline)

Audit of `firestore.rules`, `src/services/firebase.ts`, `src/services/embedServers.ts`, `src/services/analytics.ts`, `src/services/playerSettings.ts`, `src/server/utils/safeProxyFetch.ts`, and `src/server/app.ts` identified these baseline vulnerabilities:

1. **`reports/{reportId}` open read/update/delete (`allow read, update, delete: if true;`)**: Any unauthenticated visitor could dump all playback reports (exposing user emails/UIDs) or tamper/delete tickets.
2. **`systemSettings/{settingId}` open write (`allow write: if true;`)**: Any unauthenticated visitor could overwrite `systemSettings/embedServers` and inject malicious third-party embed templates for all site users.
3. **`movieStats/{mediaKey}` open create/update and lax delete (`allow create, update: if true; allow delete: if isSignedIn();`)**: Any user could reset ratings or delete public movie/TV stats documents.
4. **`analytics_visits`, `analytics_daily`, `analytics_summary` open writes/reads**: Public write access on summary/daily analytics documents and unvalidated create access on visit logs.
5. **Admin helper missing `email_verified` & RBAC registry**: `isAdmin()` checked `request.auth.token.email.lower()` without verifying `request.auth.token.email_verified == true` or checking `/admins/{uid}` / custom admin claim.
6. **Missing collections in rules & blueprint**: `users/{userId}/history/{mediaKey}`, `users/{userId}/completed/{mediaKey}`, `users/{userId}/preferences/{prefId}`, `introTimings/{timingKey}`, `featuredContent/{itemId}`, `admins/{uid}`, and `test/{docId}`.

## 2. Data & Authorization Invariants (The Eight Pillars)

1. **Default Deny Catch-All**: `match /{document=**} { allow read, write: if false; }` is enforced globally.
2. **PII & Private Subcollection Isolation**: `users/{userId}` and all private subcollections (`watchlist`, `continueWatching`, `history`, `completed`, `followedShows`, `notifications`, `preferences`) are readable only by `isOwner(userId)` or `isAdmin()`, writable only by `isOwner(userId)` with strict ownership (`userId == request.auth.uid`) and bounded schema validation. Never grant blanket `allow list: if isSignedIn()`.
3. **Privilege Escalation Prevention**: Users cannot create or modify `role`, `isAdmin`, or `admins/{uid}` records. `isAdmin()` requires `(exists(/databases/$(database)/documents/admins/$(request.auth.uid)) || request.auth.token.admin == true || (request.auth.token.email_verified == true && request.auth.token.email.lower() in ['snapmire@gmail.com', 'miroslav87@gmail.com']))`.
4. **Global System Settings Protection**: Only verified administrators (`isAdmin()`) may write `systemSettings/{settingId}`, `featuredContent/{itemId}`, `introTimings/{timingKey}`, or delete `reports`/`movieStats`.
5. **Bounded Payload & Path Variable Validation**: All document IDs enforce `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). All string and array fields enforce explicit `.size()` bounds.
6. **Action-Based Updates & Strict Keys**: Creates enforce `keys().hasAll(...) && keys().hasOnly(...)`. Non-admin updates enforce `diff(existing()).affectedKeys().hasOnly(...)` and immutable identifier preservation (`userId`, `mediaKey`, `tmdbId`, `createdAt`).
7. **Abuse-Resistant Public Feedback & Ratings**:
   - `reports/{reportId}` allows validated creation (`status == 'open'`, matching `userId`, bounded lengths) while restricting `read`, `update`, and `delete` to `isAdmin()`.
   - `movieStats/{mediaKey}` restricts non-admin updates strictly to valid +1 rating increments (`ratingCount == existing().ratingCount + 1`, `ratingSum` delta in `[1, 5]`).
8. **Server SSRF & Secret Isolation**: `/api/proxy` and `/api/subtitle-proxy` route upstream fetches through `safeFetchStream` (DNS pinning + private/loopback/metadata CIDR blocking + HTTP/HTTPS port allowlist). `TMDB_API_KEY` stays strictly server-side (never `VITE_TMDB_API_KEY`).

## 3. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Identity Spoofing on User Profile Create**: Signed-in user `alice` tries to write `/users/bob` or `/users/alice` with `userId: "bob"`.
2. **Ghost / Shadow Field Privilege Escalation**: Signed-in user `alice` creates or updates `/users/alice` with `isAdmin: true` or `role: "admin"`.
3. **PII Directory Scraping**: Signed-in non-admin user `alice` issues `LIST /users` or `GET /users/bob`.
4. **Cross-User Watch History Tampering**: Signed-in user `alice` tries to read/write `/users/bob/history/movie_550` or write `/users/alice/history/movie_550` with `userId: "bob"`.
5. **Unauthenticated Global Server Hijack**: Anonymous or non-admin user attempts `WRITE /systemSettings/embedServers` to inject malicious embed URLs.
6. **Non-Admin Email Spoofing**: Attacker authenticates with `email: "miroslav87@gmail.com"` where `email_verified: false` (no `/admins/{uid}` doc or `admin` claim) and attempts admin access.
7. **Report PII Leak / Ticket Forgery**: Unauthenticated or non-admin user issues `GET /reports` or `CREATE /reports/rep_1` with `status: "resolved"` or `userId: "other_uid"`.
8. **MovieStats Counter Reset / Manipulation**: Attacker sends `UPDATE /movieStats/movie_550` attempting to set `views: 9999999` or decrement `ratingCount`.
9. **MovieStats Deletion by Non-Admin**: Regular signed-in user attempts `DELETE /movieStats/movie_550`.
10. **Oversized Denial-of-Wallet Payload**: Signed-in user attempts `CREATE /users/alice/history/movie_550` with a 10KB `title` string or unallowed extra fields.
11. **Path ID Poisoning**: Attacker attempts write to `/users/alice/watchlist/bad$id/../../../admin` or ID exceeding 128 characters.
12. **Unauthorized Admin Registry / Featured Content Write**: Signed-in non-admin user attempts `CREATE /admins/alice`, `WRITE /featuredContent/hero_1`, or `WRITE /introTimings/anilist_1_ep_1`.
