# PrepZone Firestore Security Specification (Phase 0 & Phase 5 Red Team)

## 1. Core Data Invariants
1. `users/{userId}` and `profiles/{userId}` contain PII (`email`, `fullName`, `district`, `schoolOrCoaching`) and may only be read or written by the authenticated verified owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`).
2. A student creating `users/{userId}` cannot self-assign `role: "super_admin"` — `role` must equal `"student"` on client creation and is immutable on student updates.
3. Every user-scoped record (`bookmarks`, `studyProgress`) must bind `uid == request.auth.uid` on create, keep `uid` immutable on update, and enforce `resource.data.uid == request.auth.uid` inside `allow list` rules (never delegating filtering to the client).
4. Published curriculum & assessment collections (`subjects`, `chapters`, `topics`, `studyMaterials`, `questions`, `quizzes`, `mockTests`) can only be written by verified admins (`isAdmin()`), and non-admin reads are restricted to `resource.data.isPublished == true`.
5. Every string field enforces `.size()` limits; every ID path parameter enforces `isValidId(id)`; every `create` and `update` enforces `hasAll` / `hasOnly` and `affectedKeys().hasOnly(...)` to block shadow/ghost fields.
6. All `createdAt` / `updatedAt` timestamps on client writes must equal `request.time` (`createdAt` immutable on updates).

## 2. "Dirty Dozen" Adversarial Test Payloads (Expected: `PERMISSION_DENIED`)
1. **Privilege Escalation on Signup**: `POST /users/{uid}` with `{ role: "super_admin", ... }` -> Denied (`role == 'student'` gate).
2. **Role Mutation on Profile Update**: `PATCH /users/{uid}` changing `role` to `"educator"` -> Denied (`affectedKeys().hasOnly(['displayName', 'photoURL', 'lastLoginAt'])`).
3. **Shadow/Ghost Field Injection**: `PATCH /profiles/{uid}` adding `{ isVerified: true, bonusCredits: 999 }` -> Denied (`affectedKeys().hasOnly(...)`).
4. **Cross-User PII Read**: Authenticated User B reading `/users/{userA}` or `/profiles/{userA}` -> Denied (`isOwner(userId)`).
5. **Unverified Email Spoof**: User with `email: "did78994@gmail.com"` and `email_verified: false` attempting admin write -> Denied (`request.auth.token.email_verified == true`).
6. **Blanket User List Scraping**: Authenticated student executing `list` on `/users` or `/profiles` -> Denied (`allow list: if isAdmin()`).
7. **Bookmark Ownership Spoof**: User A creating `/bookmarks/{id}` with `uid: userB` -> Denied (`incoming().uid == request.auth.uid`).
8. **Unscoped Bookmark Query**: User A running `collection('bookmarks')` without `where('uid', '==', auth.uid)` -> Denied (`allow list: if isSignedIn() && resource.data.uid == request.auth.uid`).
9. **ID Poisoning**: Creating `/bookmarks/<1500-char-invalid-id>` -> Denied (`isValidId(bookmarkId)`).
10. **Curriculum Tampering**: Authenticated student writing to `/subjects/physics-12` -> Denied (`isAdmin()`).
11. **Unpublished Draft Leak**: Student reading `/mockTests/draft-jee` where `isPublished: false` -> Denied (`resource.data.isPublished == true`).
12. **Client Timestamp Forgery**: Creating `/profiles/{uid}` with backdated `updatedAt` != `request.time` -> Denied (`incoming().updatedAt == request.time`).

## 3. Red Team Audit Summary
- Identity Spoofing: Blocked via `isOwner(userId)` and `incoming().uid == request.auth.uid`.
- State Shortcutting & Shadow Fields: Blocked via `isValid[Entity](incoming())` + `hasAll`/`hasOnly` on create + `affectedKeys().hasOnly(...)` on update.
- Resource Poisoning: Blocked via `isValidId()` regex (`^[a-zA-Z0-9_-]+$`, `<= 128` chars) and explicit `.size()` bounds on all strings.
- Query Trust: All user-owned `allow list` rules explicitly validate `resource.data.uid == request.auth.uid` without `get()`/`exists()` inside list rules.

## 4. Prompt 4 Assessment Engine Invariants
7. `questionAnswerKeys/{questionId}` is **strictly admin-only** (`allow read, write: if isAdmin()`); students reading `questionBank` never receive `correctAnswer`, `solutionSteps`, or `explanation` from Firestore prior to submission.
8. All `quizAttempts`, `examAttempts`, `studentAnswers`, `questionBookmarks`, `practiceHistory`, `performanceAnalytics`, and `weakTopics` enforce `uid == request.auth.uid` on read, query (`allow list`), create, and update.
9. Once an attempt reaches `status == "submitted"`, students cannot mutate scores, `status`, `startedAt`, or answers (`existing().status == 'in_progress'` enforced on student attempt updates).
10. `questionSets`, `examConfigurations`, `questionBank`, `quizzes`, and `mockTests` are admin-managed (`isAdmin()` write; `isPublished == true` read).

## 5. Prompt 5 AI Study Assistant & RAG Security Invariants
11. `aiConversations`, `aiMessages`, `aiFeedback`, `generatedQuizzes`, `studyRecommendations`, and `aiStudyPlans` strictly enforce `uid == request.auth.uid` on `get`, `list` (`resource.data.uid == request.auth.uid`), `create`, `update`, and `delete`, with immutable `uid`/`createdAt` fields and strict `request.time` server timestamps.
12. `aiUsage/{usageId}` prevents client quota tampering (`allow create, update, delete: if isAdmin()`), while allowing only the owning student or admin to read their usage counters.
13. `documentChunks`, `documentEmbeddings`, and `generatedSummaries` restrict writes to verified admins/server pipelines (`isAdmin()`), preventing students from injecting unverified RAG chunks or poisoned summaries into shared collections.
14. `generatedQuizzes` requires `sourceType == 'ai_generated'` on client creation so AI-generated items can never masquerade as `'verified_pyq'`.

## 6. Prompt 6 Admin Panel, Super Admin & Bulk Upload Security Invariants
15. **Super Admin Exclusivity**: Only `isSuperAdmin()` (`did78994@gmail.com` verified email OR active `super_admin` document in `/adminRoles` or `/admins`) may write `/admins/{adminId}`, `/adminRoles/{adminId}`, `/adminPermissions/{adminId}`, `/systemSettings/{settingId}`, or suspend/modify admin accounts. Content Admins (`content_admin` / `educator` / `moderator`) are explicitly **denied** role/system-setting mutations to block privilege escalation.
16. **Append-Only Audit Trail**: `/adminAuditLogs/{logId}` permits `create` by verified admins (`adminUid == request.auth.uid && createdAt == request.time`), permits `get`/`list` by `isSuperAdmin()` (or own logs for Content Admin), and enforces `allow update, delete: if false;` so audit trails can never be altered or erased.
17. **Student Isolation from Admin Panel**: Public student registrations always set `role: 'student'`; normal students are rejected (`PERMISSION_DENIED` in Firestore, HTTP `403` on `/api/admin/*`) from admin dashboards, upload jobs, integration diagnostics, AI settings, and student registries.
18. **Secret & Key Confidentiality**: Raw `GEMINI_API_KEY`, OAuth client secrets, `STORAGE_SIGNING_SECRET`, and student password hashes are never returned in `/api/admin/*`, `/admin/integrations`, `/admin/ai-management`, or `/admin/students` responses/exports.
19. **AI Preview & Pre-Test Answer Key Guard**: Bulk PDF auto-categorization creates `preview` jobs requiring explicit admin edit/confirm before publishing, AI-generated questions cannot be marked `verified_pyq`, and student endpoints never leak mock test answer keys prior to submission.


