# PrepZone Database & Security Architecture (Foundation Specification)

This document records the planned Firebase services, collection contracts, and security rules required for Prompt 2 and beyond.

## 1. Required Firebase Services
1. **Firebase Authentication**:
   - Email/Password provider
   - Google OAuth Sign-In provider
   - Custom claims or `adminRoles` document lookup for admin/educator RBAC
2. **Cloud Firestore**:
   - Primary structured store for `users`, `profiles`, `subjects`, `chapters`, `topics`, `studyMaterials`, `questions`, `quizzes`, `mockTests`, `bookmarks`, `studyProgress`, and `adminRoles`
3. **Firebase Realtime Database (Optional / Live Features)**:
   - Real-time CBT exam timer heartbeat, active test session state, and live leaderboard updates
4. **Firebase Cloud Storage**:
   - Secure storage buckets for NCERT PDFs, bilingual notes, formula sheets, and PYQ papers (`/materials/{examTrack}/{subjectId}/{fileName}`)

## 2. Planned Collections (`src/types/database.ts`)
- `users`: Core account metadata (`uid`, `email`, `role`, `createdAt`, `lastLoginAt`)
- `profiles`: Student study preferences (`primaryExam`, `preferredLanguage`, `studyMedium`, `dailyStudyTargetMinutes`)
- `subjects`: Bilingual subject catalog per exam track (`up-board-12`, `jee-main`, `jee-advanced`)
- `chapters`: Chapter units with syllabus weightage and estimated study hours
- `topics`: Granular syllabus checkpoints linked to notes, videos, and practice sets
- `studyMaterials`: Metadata + Storage paths for PDFs, NCERT books, PYQs, and video lectures
- `questions`: Bilingual question bank supporting single/multi MCQ, numerical, and UP Board subjective items
- `quizzes`: Chapter-level timed practice sets
- `mockTests`: Full-length UP Board model papers & NTA JEE Main CBT tests
- `bookmarks`: User-scoped saved items (`uid == request.auth.uid`)
- `studyProgress`: User-scoped chapter completion & logged minutes
- `adminRoles`: Server/super-admin managed educator and moderator permissions

## 3. Planned Firestore & Storage Security Rules
- **Student private data** (`users/{uid}`, `profiles/{uid}`, `bookmarks`, `studyProgress`):
  - `allow read, write: if request.auth != null && request.auth.uid == uid;`
  - Prevent client self-escalation of `role` field on `users/{uid}`.
- **Published curriculum & assessments** (`subjects`, `chapters`, `topics`, `studyMaterials`, `quizzes`, `mockTests`):
  - `allow read: if resource.data.isPublished == true || isAdmin();`
  - `allow write: if isAdmin();`
- **Answer keys & admin roles** (`questions`, `adminRoles`):
  - `adminRoles`: readable only by the owning user or super-admin; writable only via Admin SDK / super-admin.
  - `questions`: restrict answer explanations during live tests or serve graded evaluation via server route.
- **Firebase Storage**:
  - `allow read: if request.auth != null;` (or public read for free sample materials)
  - `allow write: if isAdmin();` with strict MIME type (`application/pdf`) and size limits.
