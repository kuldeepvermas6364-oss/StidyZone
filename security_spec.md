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
